"use client"

import { useState, useEffect } from "react"
import type { OrderWithItems } from "@/lib/types"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Clock, User, CheckCircle, Package, Truck } from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import { format } from "date-fns"
import { ptBR } from "date-fns/locale"

interface OrdersListProps {
  initialOrders: OrderWithItems[]
}

export function OrdersList({ initialOrders }: OrdersListProps) {
  const [orders, setOrders] = useState<OrderWithItems[]>(initialOrders)
  const [updatingOrderId, setUpdatingOrderId] = useState<string | null>(null)

  useEffect(() => {
    const supabase = createClient()

    const channel = supabase
      .channel("orders-changes")
      .on("postgres_changes", { event: "*", schema: "public", table: "orders" }, async (payload) => {
        console.log("[v0] Order update received:", payload)

        if (payload.eventType === "UPDATE") {
          const { data: updatedOrder } = await supabase
            .from("orders")
            .select(`
                *,
                order_items (
                  *,
                  menu_items (*),
                  order_item_ingredients (
                    *,
                    ingredients (*)
                  )
                )
              `)
            .eq("id", payload.new.id)
            .single()

          if (updatedOrder) {
            setOrders((prevOrders) =>
              prevOrders.map((order) => (order.id === updatedOrder.id ? (updatedOrder as OrderWithItems) : order)),
            )
          }
        } else if (payload.eventType === "INSERT") {
          const { data: newOrder } = await supabase
            .from("orders")
            .select(`
                *,
                order_items (
                  *,
                  menu_items (*),
                  order_item_ingredients (
                    *,
                    ingredients (*)
                  )
                )
              `)
            .eq("id", payload.new.id)
            .single()

          if (newOrder) {
            setOrders((prevOrders) => [newOrder as OrderWithItems, ...prevOrders])
          }
        }
      })
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [])

  const statusConfig = {
    pending: { label: "Pendente", icon: Package, variant: "secondary" as const },
    preparing: { label: "Preparando", icon: Clock, variant: "default" as const },
    ready: { label: "Pronto", icon: CheckCircle, variant: "default" as const },
    delivered: { label: "Entregue", icon: Truck, variant: "outline" as const },
  }

  const updateOrderStatus = async (orderId: string, newStatus: string) => {
    setUpdatingOrderId(orderId)
    const supabase = createClient()

    const updateData: any = { status: newStatus }
    if (newStatus === "delivered") {
      updateData.completed_at = new Date().toISOString()
    }

    const { error } = await supabase.from("orders").update(updateData).eq("id", orderId)

    if (!error) {
      setOrders(
        orders.map((order) =>
          order.id === orderId
            ? { ...order, status: newStatus, completed_at: updateData.completed_at || order.completed_at }
            : order,
        ),
      )
    }

    setUpdatingOrderId(null)
  }

  const getNextStatus = (currentStatus: string) => {
    const statusFlow = ["pending", "preparing", "ready", "delivered"]
    const currentIndex = statusFlow.indexOf(currentStatus)
    return currentIndex < statusFlow.length - 1 ? statusFlow[currentIndex + 1] : null
  }

  const activeOrders = orders.filter((o) => o.status !== "delivered")
  const completedOrders = orders.filter((o) => o.status === "delivered")

  return (
    <div className="space-y-8">
      {/* Pedidos Ativos */}
      <div>
        <h2 className="text-2xl font-bold mb-4">Em Andamento</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {activeOrders.length === 0 ? (
            <p className="text-muted-foreground col-span-full text-center py-8">Nenhum pedido ativo no momento</p>
          ) : (
            activeOrders.map((order) => {
              const config = statusConfig[order.status as keyof typeof statusConfig] || statusConfig.pending
              const Icon = config.icon
              const nextStatus = getNextStatus(order.status)

              return (
                <Card key={order.id} className="border-2">
                  <CardHeader>
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <CardTitle className="text-lg">Pedido #{order.order_number}</CardTitle>
                        <CardDescription className="flex items-center gap-1 mt-1">
                          <User className="w-3 h-3" />
                          {order.customer_name}
                        </CardDescription>
                      </div>
                      <Badge variant={config.variant} className="flex items-center gap-1">
                        <Icon className="w-3 h-3" />
                        {config.label}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      {order.order_items.map((item) => (
                        <div key={item.id} className="text-sm">
                          <div className="flex justify-between">
                            <span className="font-medium">
                              {item.quantity}x {item.menu_items.name}
                            </span>
                            <span className="text-muted-foreground">R$ {(item.price * item.quantity).toFixed(2)}</span>
                          </div>
                          {item.order_item_ingredients && item.order_item_ingredients.length > 0 && (
                            <div className="pl-4 text-xs text-muted-foreground">
                              {item.order_item_ingredients.map((extra) => (
                                <div key={extra.id}>
                                  + {extra.quantity}x {extra.ingredients.name}
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>

                    {order.notes && (
                      <div className="pt-2 border-t">
                        <p className="text-xs text-muted-foreground">Obs: {order.notes}</p>
                      </div>
                    )}

                    <div className="pt-2 border-t space-y-2">
                      <div className="flex justify-between items-center text-sm">
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          Tempo estimado:
                        </span>
                        <span className="font-semibold">{order.estimated_wait_time} min</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="font-bold">Total:</span>
                        <span className="text-lg font-bold text-primary">R$ {order.total_price.toFixed(2)}</span>
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {format(new Date(order.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                      </div>
                    </div>

                    {nextStatus && (
                      <Button
                        className="w-full"
                        onClick={() => updateOrderStatus(order.id, nextStatus)}
                        disabled={updatingOrderId === order.id}
                      >
                        {updatingOrderId === order.id
                          ? "Atualizando..."
                          : `Marcar como ${statusConfig[nextStatus as keyof typeof statusConfig].label}`}
                      </Button>
                    )}
                  </CardContent>
                </Card>
              )
            })
          )}
        </div>
      </div>

      {/* Pedidos Concluídos */}
      {completedOrders.length > 0 && (
        <div>
          <h2 className="text-2xl font-bold mb-4">Concluídos Hoje</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {completedOrders.map((order) => (
              <Card key={order.id} className="opacity-75">
                <CardHeader>
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <CardTitle className="text-lg">Pedido #{order.order_number}</CardTitle>
                      <CardDescription className="flex items-center gap-1 mt-1">
                        <User className="w-3 h-3" />
                        {order.customer_name}
                      </CardDescription>
                    </div>
                    <Badge variant="outline" className="flex items-center gap-1">
                      <CheckCircle className="w-3 h-3" />
                      Entregue
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    {order.order_items.map((item) => (
                      <div key={item.id} className="text-sm">
                        <div className="flex justify-between">
                          <span>
                            {item.quantity}x {item.menu_items.name}
                          </span>
                          <span className="text-muted-foreground">R$ {(item.price * item.quantity).toFixed(2)}</span>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="pt-2 border-t">
                    <div className="flex justify-between items-center">
                      <span className="font-bold">Total:</span>
                      <span className="text-lg font-bold text-primary">R$ {order.total_price.toFixed(2)}</span>
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">
                      Entregue:{" "}
                      {order.completed_at &&
                        format(new Date(order.completed_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

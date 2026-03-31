"use client"

import { useState, useEffect } from "react"
import type { OrderWithItems } from "@/lib/types"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Clock, User, CheckCircle, Package, Truck, Printer } from "lucide-react"
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

  const printOrder = (order: OrderWithItems) => {
    const printWindow = window.open("", "_blank", "width=400,height=600")
    if (!printWindow) return

    const orderDate = format(new Date(order.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })
    
    const itemsHtml = order.order_items.map((item) => {
      const extrasHtml = item.order_item_ingredients && item.order_item_ingredients.length > 0
        ? item.order_item_ingredients.map((extra) => 
            `<div style="padding-left: 15px; font-size: 12px; color: #666;">+ ${extra.quantity}x ${extra.ingredients.name}</div>`
          ).join("")
        : ""
      
      return `
        <div style="margin-bottom: 8px; border-bottom: 1px dashed #ccc; padding-bottom: 8px;">
          <div style="display: flex; justify-content: space-between;">
            <strong>${item.quantity}x ${item.menu_items.name}</strong>
            <span>R$ ${(item.price * item.quantity).toFixed(2)}</span>
          </div>
          ${extrasHtml}
        </div>
      `
    }).join("")

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Pedido #${order.order_number}</title>
        <style>
          body {
            font-family: 'Courier New', monospace;
            padding: 20px;
            max-width: 300px;
            margin: 0 auto;
          }
          .header {
            text-align: center;
            border-bottom: 2px solid #000;
            padding-bottom: 10px;
            margin-bottom: 15px;
          }
          .header h1 {
            margin: 0;
            font-size: 18px;
          }
          .header h2 {
            margin: 5px 0;
            font-size: 14px;
            font-weight: normal;
          }
          .info {
            margin-bottom: 15px;
            font-size: 13px;
          }
          .info p {
            margin: 3px 0;
          }
          .items {
            margin-bottom: 15px;
          }
          .total {
            border-top: 2px solid #000;
            padding-top: 10px;
            font-size: 16px;
            font-weight: bold;
            display: flex;
            justify-content: space-between;
          }
          .notes {
            margin-top: 15px;
            padding: 10px;
            background: #f5f5f5;
            border-radius: 5px;
            font-size: 12px;
          }
          .footer {
            text-align: center;
            margin-top: 20px;
            font-size: 11px;
            color: #666;
          }
          @media print {
            body { padding: 0; }
          }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>MR. SMASH STREET</h1>
          <h2>Burger Joint</h2>
        </div>
        
        <div class="info">
          <p><strong>Pedido:</strong> #${order.order_number}</p>
          <p><strong>Cliente:</strong> ${order.customer_name}</p>
          <p><strong>Data:</strong> ${orderDate}</p>
          <p><strong>Tempo estimado:</strong> ${order.estimated_wait_time} min</p>
        </div>
        
        <div class="items">
          ${itemsHtml}
        </div>
        
        <div class="total">
          <span>TOTAL:</span>
          <span>R$ ${order.total_price.toFixed(2)}</span>
        </div>
        
        ${order.notes ? `
          <div class="notes">
            <strong>Observações:</strong><br/>
            ${order.notes}
          </div>
        ` : ""}
        
        <div class="footer">
          <p>Obrigado pela preferência!</p>
        </div>
      </body>
      </html>
    `

    printWindow.document.write(html)
    printWindow.document.close()
    printWindow.focus()
    printWindow.print()
  }

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

                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        className="flex-1"
                        onClick={() => printOrder(order)}
                      >
                        <Printer className="w-4 h-4 mr-2" />
                        Imprimir
                      </Button>
                      {nextStatus && (
                        <Button
                          className="flex-1"
                          onClick={() => updateOrderStatus(order.id, nextStatus)}
                          disabled={updatingOrderId === order.id}
                        >
                          {updatingOrderId === order.id
                            ? "Atualizando..."
                            : `${statusConfig[nextStatus as keyof typeof statusConfig].label}`}
                        </Button>
                      )}
                    </div>
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
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full mt-3"
                      onClick={() => printOrder(order)}
                    >
                      <Printer className="w-4 h-4 mr-2" />
                      Imprimir
                    </Button>
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

"use client"

import { useState, useEffect } from "react"
import type { OrderWithItems } from "@/lib/types"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Clock, User, CheckCircle, Package, Truck, Printer, Trash2 } from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import { format } from "date-fns"
import { ptBR } from "date-fns/locale"

interface OrdersListProps {
  initialOrders: OrderWithItems[]
}

export function OrdersList({ initialOrders }: OrdersListProps) {
  const [orders, setOrders] = useState<OrderWithItems[]>(initialOrders)
  const [updatingOrderId, setUpdatingOrderId] = useState<string | null>(null)
  const [deletingOrderId, setDeletingOrderId] = useState<string | null>(null)

  useEffect(() => {
    const supabase = createClient()

    const channel = supabase
      .channel("orders-changes")
      .on("postgres_changes", { event: "*", schema: "public", table: "orders" }, async (payload) => {
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
        } else if (payload.eventType === "DELETE") {
          setOrders((prevOrders) => prevOrders.filter((order) => order.id !== payload.old.id))
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

  const deleteOrder = async (orderId: string, orderNumber: number) => {
    const confirmed = window.confirm(
      `Tem certeza que deseja excluir o pedido #${orderNumber}?\n\nEsta ação não pode ser desfeita.`
    )
    
    if (!confirmed) return

    setDeletingOrderId(orderId)
    const supabase = createClient()

    try {
      // Primeiro excluir os ingredientes dos itens do pedido
      const { data: orderItems } = await supabase
        .from("order_items")
        .select("id")
        .eq("order_id", orderId)

      if (orderItems && orderItems.length > 0) {
        const orderItemIds = orderItems.map((item) => item.id)
        
        await supabase
          .from("order_item_ingredients")
          .delete()
          .in("order_item_id", orderItemIds)
      }

      // Excluir os itens do pedido
      await supabase
        .from("order_items")
        .delete()
        .eq("order_id", orderId)

      // Excluir o pedido
      const { error } = await supabase
        .from("orders")
        .delete()
        .eq("id", orderId)

      if (error) throw error

      // Atualizar estado local
      setOrders(orders.filter((order) => order.id !== orderId))
    } catch (error) {
      console.error("Erro ao excluir pedido:", error)
      alert("Erro ao excluir pedido. Tente novamente.")
    } finally {
      setDeletingOrderId(null)
    }
  }

  const activeOrders = orders.filter((o) => o.status !== "delivered")
  const completedOrders = orders.filter((o) => o.status === "delivered")

  const printOrder = (order: OrderWithItems) => {
    const printWindow = window.open("", "_blank", "width=250,height=400")
    if (!printWindow) return

    const orderDate = format(new Date(order.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })
    
    const itemsHtml = order.order_items.map((item) => {
      const extrasHtml = item.order_item_ingredients && item.order_item_ingredients.length > 0
        ? item.order_item_ingredients.map((extra) => 
            `<div class="extra">+ ${extra.quantity}x ${extra.ingredients.name}</div>`
          ).join("")
        : ""
      
      return `
        <div class="item">
          <div class="item-row">
            <span>${item.quantity}x ${item.menu_items.name}</span>
            <span>R$${(item.price * item.quantity).toFixed(2)}</span>
          </div>
          ${extrasHtml}
        </div>
      `
    }).join("")

    // Configurações para impressora térmica 58mm (largura útil ~48mm = ~180 pontos a 384dpi)
    // Fonte: 12x24 pontos (normal), 9x17 pontos (pequeno), 24x24 pontos (destaque)
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <title>Pedido #${order.order_number}</title>
        <style>
          * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
          }
          @page {
            size: 58mm auto;
            margin: 0;
          }
          body {
            font-family: 'Courier New', 'Lucida Console', monospace;
            font-size: 10px;
            line-height: 1.2;
            width: 48mm;
            padding: 2mm;
            background: #fff;
            color: #000;
          }
          .header {
            text-align: center;
            border-bottom: 1px dashed #000;
            padding-bottom: 3mm;
            margin-bottom: 2mm;
          }
          .header h1 {
            font-size: 12px;
            font-weight: bold;
            letter-spacing: -0.5px;
          }
          .header h2 {
            font-size: 9px;
            font-weight: normal;
          }
          .divider {
            border-top: 1px dashed #000;
            margin: 2mm 0;
          }
          .info {
            font-size: 9px;
            margin-bottom: 2mm;
          }
          .info p {
            margin: 1px 0;
          }
          .info .order-num {
            font-size: 14px;
            font-weight: bold;
            text-align: center;
            margin: 2mm 0;
          }
          .items {
            margin: 2mm 0;
          }
          .item {
            margin-bottom: 2mm;
            padding-bottom: 1mm;
            border-bottom: 1px dotted #ccc;
          }
          .item:last-child {
            border-bottom: none;
          }
          .item-row {
            display: flex;
            justify-content: space-between;
            font-size: 9px;
            font-weight: bold;
          }
          .extra {
            padding-left: 2mm;
            font-size: 8px;
            color: #333;
          }
          .total-section {
            border-top: 1px dashed #000;
            padding-top: 2mm;
            margin-top: 2mm;
          }
          .total {
            display: flex;
            justify-content: space-between;
            font-size: 12px;
            font-weight: bold;
          }
          .notes {
            margin-top: 2mm;
            padding: 2mm;
            border: 1px dashed #000;
            font-size: 8px;
          }
          .notes-title {
            font-weight: bold;
            margin-bottom: 1mm;
          }
          .footer {
            text-align: center;
            margin-top: 3mm;
            padding-top: 2mm;
            border-top: 1px dashed #000;
            font-size: 8px;
          }
          .footer p {
            margin: 1px 0;
          }
          @media print {
            body {
              width: 48mm;
              padding: 1mm;
            }
            .no-print {
              display: none;
            }
          }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>MR. SMASH STREET</h1>
          <h2>Burger Joint</h2>
        </div>
        
        <div class="info">
          <p class="order-num">#${order.order_number}</p>
          <p><b>Cliente:</b> ${order.customer_name}</p>
          <p><b>Data:</b> ${orderDate}</p>
          <p><b>Tempo:</b> ${order.estimated_wait_time} min</p>
        </div>
        
        <div class="divider"></div>
        
        <div class="items">
          ${itemsHtml}
        </div>
        
        <div class="total-section">
          <div class="total">
            <span>TOTAL:</span>
            <span>R$${order.total_price.toFixed(2)}</span>
          </div>
        </div>
        
        ${order.notes ? `
          <div class="notes">
            <div class="notes-title">OBS:</div>
            ${order.notes}
          </div>
        ` : ""}
        
        <div class="footer">
          <p>Obrigado pela preferencia!</p>
          <p>MR. SMASH STREET</p>
        </div>
      </body>
      </html>
    `

    printWindow.document.write(html)
    printWindow.document.close()
    printWindow.focus()
    setTimeout(() => {
      printWindow.print()
    }, 250)
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

                    <div className="flex flex-col gap-2">
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
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => deleteOrder(order.id, order.order_number)}
                        disabled={deletingOrderId === order.id}
                      >
                        <Trash2 className="w-4 h-4 mr-2" />
                        {deletingOrderId === order.id ? "Excluindo..." : "Excluir Pedido"}
                      </Button>
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
                    <div className="flex gap-2 mt-3">
                      <Button
                        variant="outline"
                        size="sm"
                        className="flex-1"
                        onClick={() => printOrder(order)}
                      >
                        <Printer className="w-4 h-4 mr-2" />
                        Imprimir
                      </Button>
                      <Button
                        variant="destructive"
                        size="sm"
                        className="flex-1"
                        onClick={() => deleteOrder(order.id, order.order_number)}
                        disabled={deletingOrderId === order.id}
                      >
                        <Trash2 className="w-4 h-4 mr-2" />
                        {deletingOrderId === order.id ? "..." : "Excluir"}
                      </Button>
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

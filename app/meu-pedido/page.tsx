"use client"

import { useState, useEffect } from "react"
import { createBrowserClient } from "@/lib/supabase/client"
import type { OrderWithItems } from "@/lib/types"
import { useSearchParams } from "next/navigation"
import Link from "next/link"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { ArrowLeft, Search, Clock, CheckCircle2, Loader2, Package } from "lucide-react"
import { ClientHeader } from "@/components/client-header"
import { ClientFooter } from "@/components/client-footer"
import { sanitizeString } from "@/lib/validations"
import { checkRateLimit } from "@/lib/rate-limit"

export default function MeuPedidoPage() {
  const searchParams = useSearchParams()
  const numeroParam = searchParams.get("numero")

  const [orderNumber, setOrderNumber] = useState(numeroParam || "")
  const [order, setOrder] = useState<OrderWithItems | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const supabase = createBrowserClient()

  useEffect(() => {
    if (numeroParam) {
      searchOrder(numeroParam)
    }
  }, [numeroParam])

  useEffect(() => {
    if (!order) return

    const channel = supabase
      .channel(`order-${order.id}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "orders", filter: `id=eq.${order.id}` },
        async () => {
          // Buscar pedido atualizado com todos os relacionamentos
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
            .eq("id", order.id)
            .single()

          if (updatedOrder) {
            setOrder(updatedOrder as OrderWithItems)
          }
        },
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [order])

  const searchOrder = async (numero: string) => {
    const trimmedNumero = numero.trim()
    
    if (!trimmedNumero) {
      setError("Digite o número do pedido")
      return
    }

    // Validação: apenas números
    if (!/^\d+$/.test(trimmedNumero)) {
      setError("Número do pedido inválido. Digite apenas números.")
      return
    }

    // Rate limiting - máximo 10 buscas por minuto
    const rateLimitResult = checkRateLimit("order-search", {
      maxAttempts: 10,
      windowMs: 60 * 1000,
      blockDurationMs: 60 * 1000,
    })

    if (!rateLimitResult.allowed) {
      setError(rateLimitResult.message || "Muitas tentativas. Aguarde um momento.")
      return
    }

    setLoading(true)
    setError("")

    try {
      const { data, error: fetchError } = await supabase
        .from("orders")
        .select(
          `
          *,
          order_items (
            *,
            menu_items (*),
            order_item_ingredients (
              *,
              ingredients (*)
            )
          )
        `,
        )
        .eq("order_number", Number.parseInt(trimmedNumero))
        .limit(1)

      if (fetchError) throw fetchError

      if (!data || data.length === 0) {
        setError("Pedido não encontrado. Verifique o número e tente novamente.")
        setOrder(null)
        return
      }

      setOrder(data[0] as OrderWithItems)
    } catch (err) {
      console.error("Erro ao buscar pedido:", err)
      setError("Erro ao buscar pedido. Tente novamente.")
      setOrder(null)
    } finally {
      setLoading(false)
    }
  }

  const getStatusInfo = (status: string) => {
    switch (status) {
      case "pendente":
        return { label: "Pendente", color: "bg-yellow-500", icon: Clock }
      case "preparando":
        return { label: "Preparando", color: "bg-blue-500", icon: Loader2 }
      case "pronto":
        return { label: "Pronto", color: "bg-green-500", icon: CheckCircle2 }
      case "entregue":
        return { label: "Entregue", color: "bg-gray-500", icon: Package }
      default:
        return { label: status, color: "bg-gray-500", icon: Clock }
    }
  }

  const statusInfo = order ? getStatusInfo(order.status) : null
  const StatusIcon = statusInfo?.icon

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-br from-background via-background to-muted">
      <ClientHeader />

      <main className="flex-1">
        <div className="container mx-auto px-4 py-8 max-w-2xl">
          <Link href="/">
            <Button variant="ghost" size="sm" className="mb-6">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Voltar
            </Button>
          </Link>

          <h1 className="text-3xl font-bold mb-8 text-center">Acompanhar Pedido</h1>

          <Card className="mb-6">
            <CardHeader>
              <CardTitle>Digite o número do seu pedido</CardTitle>
              <CardDescription>Você recebeu o número do pedido após finalizar a compra</CardDescription>
            </CardHeader>
            <CardContent>
              <form
                onSubmit={(e) => {
                  e.preventDefault()
                  searchOrder(orderNumber)
                }}
                className="flex gap-2"
              >
                <div className="flex-1">
                  <Label htmlFor="orderNumber" className="sr-only">
                    Número do Pedido
                  </Label>
                  <Input
                    id="orderNumber"
                    type="number"
                    value={orderNumber}
                    onChange={(e) => setOrderNumber(e.target.value)}
                    placeholder="Ex: 1234"
                    required
                  />
                </div>
                <Button type="submit" disabled={loading}>
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                </Button>
              </form>
              {error && <p className="text-destructive text-sm mt-2">{error}</p>}
            </CardContent>
          </Card>

          {order && (
            <>
              <Card className="mb-6">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle>Pedido #{order.order_number}</CardTitle>
                      <CardDescription>{order.customer_name}</CardDescription>
                    </div>
                    <Badge className={`${statusInfo?.color} text-white flex items-center gap-1`}>
                      {StatusIcon && <StatusIcon className="w-4 h-4" />}
                      {statusInfo?.label}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Data do Pedido</span>
                      <span>{new Date(order.created_at).toLocaleString("pt-BR")}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Tempo Estimado</span>
                      <span className="font-semibold">{order.estimated_wait_time} minutos</span>
                    </div>
                    {order.notes && (
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Observações</span>
                        <span className="max-w-[200px] text-right">{sanitizeString(order.notes)}</span>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>

              <Card className="mb-6">
                <CardHeader>
                  <CardTitle>Itens do Pedido</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {order.order_items.map((item) => (
                      <div key={item.id} className="border-b pb-3 last:border-0">
                        <div className="flex justify-between mb-1">
                          <p className="font-semibold">
                            {item.quantity}x {item.menu_items.name}
                          </p>
                          <p className="font-semibold">R$ {item.price.toFixed(2)}</p>
                        </div>
                        {item.order_item_ingredients && item.order_item_ingredients.length > 0 && (
                          <div className="text-sm text-muted-foreground ml-4">
                            <p className="mb-1">Extras:</p>
                            <ul className="space-y-1">
                              {item.order_item_ingredients.map((ing) => (
                                <li key={ing.id} className="flex justify-between">
                                  <span>
                                    • {ing.quantity}x {ing.ingredients.name}
                                  </span>
                                  <span>+R$ {ing.price.toFixed(2)}</span>
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>
                    ))}

                    <div className="flex justify-between text-lg font-bold pt-3">
                      <span>Total</span>
                      <span className="text-primary">R$ {order.total_price.toFixed(2)}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {order.status === "pronto" && (
                <Card className="bg-green-500/10 border-green-500">
                  <CardContent className="py-4">
                    <p className="text-center font-semibold text-green-700 dark:text-green-400">
                      Seu pedido está pronto! Pode retirar no balcão.
                    </p>
                  </CardContent>
                </Card>
              )}
            </>
          )}
        </div>
      </main>

      <ClientFooter />
    </div>
  )
}

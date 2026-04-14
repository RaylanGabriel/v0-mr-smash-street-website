"use client"

import { useState, useEffect } from "react"
import { createBrowserClient } from "@/lib/supabase/client"
import type { OrderWithItems } from "@/lib/types"
import type { User } from "@supabase/supabase-js"
import Link from "next/link"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { ArrowLeft, Clock, CheckCircle2, Loader2, Package, ShoppingBag, LogIn } from "lucide-react"
import { ClientHeader } from "@/components/client-header"
import { ClientFooter } from "@/components/client-footer"
import { sanitizeString } from "@/lib/validations"

export default function MeuPedidoPage() {
  const [user, setUser] = useState<User | null>(null)
  const [orders, setOrders] = useState<OrderWithItems[]>([])
  const [loading, setLoading] = useState(true)
  const [authLoading, setAuthLoading] = useState(true)
  const supabase = createBrowserClient()

  // Verificar autenticação
  useEffect(() => {
    const checkAuth = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      setUser(user)
      setAuthLoading(false)
    }

    checkAuth()

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
    })

    return () => subscription.unsubscribe()
  }, [])

  // Buscar pedidos do usuário
  useEffect(() => {
    if (!user) {
      setLoading(false)
      return
    }

    const fetchOrders = async () => {
      setLoading(true)
      const { data, error } = await supabase
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
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })

      if (!error && data) {
        setOrders(data as OrderWithItems[])
      }
      setLoading(false)
    }

    fetchOrders()

    // Realtime updates para os pedidos do usuário
    const channel = supabase
      .channel("user-orders")
      .on(
        "postgres_changes",
        { 
          event: "*", 
          schema: "public", 
          table: "orders",
          filter: `user_id=eq.${user.id}`
        },
        async () => {
          fetchOrders()
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [user])

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

  // Tela de loading de autenticação
  if (authLoading) {
    return (
      <div className="min-h-screen flex flex-col bg-gradient-to-br from-background via-background to-muted">
        <ClientHeader />
        <main className="flex-1 flex items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </main>
        <ClientFooter />
      </div>
    )
  }

  // Tela para usuário não logado
  if (!user) {
    return (
      <div className="min-h-screen flex flex-col bg-gradient-to-br from-background via-background to-muted">
        <ClientHeader />
        <main className="flex-1 flex items-center justify-center p-4">
          <Card className="w-full max-w-md text-center">
            <CardHeader>
              <div className="flex justify-center mb-4">
                <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center">
                  <LogIn className="w-8 h-8 text-primary" />
                </div>
              </div>
              <CardTitle>Faca login para ver seus pedidos</CardTitle>
              <CardDescription>
                Para garantir sua privacidade e seguranca, voce precisa estar logado para visualizar seus pedidos.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <Button asChild className="w-full">
                <Link href="/cliente/login">
                  <LogIn className="w-4 h-4 mr-2" />
                  Fazer Login
                </Link>
              </Button>
              <Button variant="outline" asChild className="w-full">
                <Link href="/cliente/cadastro">
                  Criar uma conta
                </Link>
              </Button>
              <Button variant="ghost" asChild className="w-full">
                <Link href="/">
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Voltar ao inicio
                </Link>
              </Button>
            </CardContent>
          </Card>
        </main>
        <ClientFooter />
      </div>
    )
  }

  // Tela de loading dos pedidos
  if (loading) {
    return (
      <div className="min-h-screen flex flex-col bg-gradient-to-br from-background via-background to-muted">
        <ClientHeader />
        <main className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <Loader2 className="w-8 h-8 animate-spin text-primary mx-auto mb-4" />
            <p className="text-muted-foreground">Carregando seus pedidos...</p>
          </div>
        </main>
        <ClientFooter />
      </div>
    )
  }

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-br from-background via-background to-muted">
      <ClientHeader />

      <main className="flex-1">
        <div className="container mx-auto px-4 py-8 max-w-3xl">
          <Link href="/">
            <Button variant="ghost" size="sm" className="mb-6">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Voltar
            </Button>
          </Link>

          <h1 className="text-3xl font-bold mb-2">Meus Pedidos</h1>
          <p className="text-muted-foreground mb-8">
            Ola, {user.user_metadata?.full_name || user.email?.split("@")[0]}! Aqui estao seus pedidos.
          </p>

          {orders.length === 0 ? (
            <Card className="text-center py-12">
              <CardContent>
                <div className="flex justify-center mb-4">
                  <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center">
                    <ShoppingBag className="w-8 h-8 text-muted-foreground" />
                  </div>
                </div>
                <h3 className="text-xl font-semibold mb-2">Nenhum pedido ainda</h3>
                <p className="text-muted-foreground mb-6">
                  Voce ainda nao fez nenhum pedido. Que tal experimentar nossos deliciosos burgers?
                </p>
                <Button asChild>
                  <Link href="/cardapio">Ver Cardapio</Link>
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-6">
              {orders.map((order) => {
                const statusInfo = getStatusInfo(order.status)
                const StatusIcon = statusInfo.icon

                return (
                  <Card key={order.id}>
                    <CardHeader>
                      <div className="flex items-center justify-between">
                        <div>
                          <CardTitle className="flex items-center gap-2">
                            Pedido #{order.order_number}
                            {order.status === "pronto" && (
                              <Badge variant="default" className="bg-green-500">
                                Pronto para retirar!
                              </Badge>
                            )}
                          </CardTitle>
                          <CardDescription>
                            {new Date(order.created_at).toLocaleString("pt-BR")}
                          </CardDescription>
                        </div>
                        <Badge className={`${statusInfo.color} text-white flex items-center gap-1`}>
                          <StatusIcon className="w-4 h-4" />
                          {statusInfo.label}
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-4">
                        {/* Itens do pedido */}
                        <div className="space-y-2">
                          {order.order_items.map((item) => (
                            <div key={item.id} className="flex justify-between text-sm">
                              <span>
                                {item.quantity}x {item.menu_items.name}
                                {item.order_item_ingredients && item.order_item_ingredients.length > 0 && (
                                  <span className="text-muted-foreground ml-1">
                                    (+{item.order_item_ingredients.map(i => i.ingredients.name).join(", ")})
                                  </span>
                                )}
                              </span>
                              <span>R$ {(item.price * item.quantity).toFixed(2)}</span>
                            </div>
                          ))}
                        </div>

                        {/* Informações adicionais */}
                        <div className="border-t pt-3 space-y-1 text-sm">
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Tempo estimado</span>
                            <span>{order.estimated_wait_time} minutos</span>
                          </div>
                          {order.notes && (
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">Observacoes</span>
                              <span className="max-w-[200px] text-right">{sanitizeString(order.notes)}</span>
                            </div>
                          )}
                        </div>

                        {/* Total */}
                        <div className="border-t pt-3 flex justify-between font-bold">
                          <span>Total</span>
                          <span className="text-primary">R$ {order.total_price.toFixed(2)}</span>
                        </div>

                        {/* Mensagem de pronto */}
                        {order.status === "pronto" && (
                          <div className="bg-green-500/10 border border-green-500 rounded-lg p-3 text-center">
                            <p className="font-semibold text-green-700 dark:text-green-400">
                              Seu pedido esta pronto! Pode retirar no balcao.
                            </p>
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                )
              })}
            </div>
          )}
        </div>
      </main>

      <ClientFooter />
    </div>
  )
}

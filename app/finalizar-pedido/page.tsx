"use client"

import type React from "react"

import { useState, useEffect, useRef } from "react"
import { createBrowserClient } from "@/lib/supabase/client"
import type { MenuItem, Ingredient } from "@/lib/types"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { ArrowLeft, Loader2 } from "lucide-react"
import { ClientHeader } from "@/components/client-header"
import { ClientFooter } from "@/components/client-footer"
import { checkoutSchema, sanitizeString } from "@/lib/validations"
import { checkRateLimit } from "@/lib/rate-limit"

interface CartItem {
  menuItem: MenuItem
  quantity: number
  selectedIngredients: { ingredient: Ingredient; quantity: number }[]
}

export default function FinalizarPedidoPage() {
  const [cart, setCart] = useState<CartItem[]>([])
  const [customerName, setCustomerName] = useState("")
  const [notes, setNotes] = useState("")
  const [loading, setLoading] = useState(false)
  const [fieldErrors, setFieldErrors] = useState<{ customerName?: string; notes?: string }>({})
  const [submitError, setSubmitError] = useState<string | null>(null)
  const isSubmitting = useRef(false) // Previne dupla submissão
  const router = useRouter()
  const supabase = createBrowserClient()

  useEffect(() => {
    const saved = localStorage.getItem("cart")
    if (saved) {
      setCart(JSON.parse(saved))
    } else {
      router.push("/cardapio")
    }
  }, [router])

  const calculateItemTotal = (item: CartItem) => {
    let total = item.menuItem.base_price * item.quantity
    item.selectedIngredients.forEach((ing) => {
      total += ing.ingredient.price * ing.quantity * item.quantity
    })
    return total
  }

  const calculateTotal = () => {
    return cart.reduce((sum, item) => sum + calculateItemTotal(item), 0)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setFieldErrors({})
    setSubmitError(null)

    // Previne dupla submissão
    if (isSubmitting.current || loading) return
    
    // Rate limiting - máximo 3 pedidos por minuto
    const rateLimitResult = checkRateLimit("checkout", {
      maxAttempts: 3,
      windowMs: 60 * 1000,
      blockDurationMs: 2 * 60 * 1000,
    })

    if (!rateLimitResult.allowed) {
      setSubmitError(rateLimitResult.message || "Aguarde antes de fazer outro pedido.")
      return
    }

    // Validação com Zod
    const validation = checkoutSchema.safeParse({ customerName, notes })
    if (!validation.success) {
      const errors = validation.error.flatten().fieldErrors
      setFieldErrors({
        customerName: errors.customerName?.[0],
        notes: errors.notes?.[0],
      })
      return
    }

    isSubmitting.current = true
    setLoading(true)

    try {
      const totalPrice = calculateTotal()
      const sanitizedName = sanitizeString(validation.data.customerName)
      const sanitizedNotes = validation.data.notes ? sanitizeString(validation.data.notes) : null

      const { data: orderData, error: orderError } = await supabase
        .from("orders")
        .insert({
          customer_name: sanitizedName,
          status: "pendente",
          total_price: totalPrice,
          estimated_wait_time: 20,
          notes: sanitizedNotes,
        })
        .select()
        .single()

      if (orderError) throw orderError

      for (const cartItem of cart) {
        const itemPrice = cartItem.menuItem.base_price * cartItem.quantity

        const { data: orderItemData, error: orderItemError } = await supabase
          .from("order_items")
          .insert({
            order_id: orderData.id,
            menu_item_id: cartItem.menuItem.id,
            quantity: cartItem.quantity,
            price: itemPrice,
          })
          .select()
          .single()

        if (orderItemError) throw orderItemError

        for (const ing of cartItem.selectedIngredients) {
          const ingPrice = ing.ingredient.price * ing.quantity * cartItem.quantity

          const { error: ingError } = await supabase.from("order_item_ingredients").insert({
            order_item_id: orderItemData.id,
            ingredient_id: ing.ingredient.id,
            quantity: ing.quantity * cartItem.quantity,
            price: ingPrice,
          })

          if (ingError) throw ingError
        }
      }

      localStorage.removeItem("cart")
      router.push(`/meu-pedido?numero=${orderData.order_number}`)
    } catch (error) {
      console.error("Erro ao criar pedido:", error)
      setSubmitError("Erro ao criar pedido. Tente novamente.")
    } finally {
      setLoading(false)
      isSubmitting.current = false
    }
  }

  if (cart.length === 0) {
    return null
  }

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-br from-background via-background to-muted">
      <ClientHeader />

      <main className="flex-1">
        <div className="container mx-auto px-4 py-8 max-w-2xl">
          <Link href="/cardapio">
            <Button variant="ghost" size="sm" className="mb-6">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Voltar ao Cardápio
            </Button>
          </Link>

          <h1 className="text-3xl font-bold mb-8 text-center">Finalizar Pedido</h1>

          <Card className="mb-6">
            <CardHeader>
              <CardTitle>Resumo do Pedido</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {cart.map((item, index) => (
                  <div key={index} className="flex justify-between text-sm">
                    <div>
                      <p className="font-semibold">
                        {item.quantity}x {item.menuItem.name}
                      </p>
                      {item.selectedIngredients.length > 0 && (
                        <p className="text-muted-foreground text-xs">
                          Extras:{" "}
                          {item.selectedIngredients.map((i) => `${i.ingredient.name} (${i.quantity}x)`).join(", ")}
                        </p>
                      )}
                    </div>
                    <p className="font-semibold">R$ {calculateItemTotal(item).toFixed(2)}</p>
                  </div>
                ))}
                <div className="border-t pt-3 mt-3 flex justify-between text-lg font-bold">
                  <span>Total</span>
                  <span className="text-primary">R$ {calculateTotal().toFixed(2)}</span>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Seus Dados</CardTitle>
              <CardDescription>Preencha as informações abaixo</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">
                {submitError && (
                  <div className="p-3 rounded-lg bg-destructive/10 border border-destructive">
                    <p className="text-sm text-destructive">{submitError}</p>
                  </div>
                )}

                <div>
                  <Label htmlFor="name">Nome *</Label>
                  <Input
                    id="name"
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    placeholder="Digite seu nome"
                    required
                    disabled={loading}
                    maxLength={100}
                    autoComplete="name"
                    className={fieldErrors.customerName ? "border-destructive" : ""}
                  />
                  {fieldErrors.customerName && (
                    <p className="text-sm text-destructive mt-1">{fieldErrors.customerName}</p>
                  )}
                </div>

                <div>
                  <Label htmlFor="notes">Observações</Label>
                  <Textarea
                    id="notes"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Alguma observação sobre o pedido? (opcional)"
                    rows={3}
                    disabled={loading}
                    maxLength={500}
                    className={fieldErrors.notes ? "border-destructive" : ""}
                  />
                  {fieldErrors.notes && (
                    <p className="text-sm text-destructive mt-1">{fieldErrors.notes}</p>
                  )}
                  <p className="text-xs text-muted-foreground mt-1">{notes.length}/500 caracteres</p>
                </div>

                <Button type="submit" className="w-full" size="lg" disabled={loading}>
                  {loading ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Finalizando...
                    </>
                  ) : (
                    "Confirmar Pedido"
                  )}
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>
      </main>

      <ClientFooter />
    </div>
  )
}

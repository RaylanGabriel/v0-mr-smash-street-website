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
import { ArrowLeft, Loader2, MapPin, Store, CreditCard, QrCode, Banknote, Truck } from "lucide-react"
import { Badge } from "@/components/ui/badge"
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
  const [fieldErrors, setFieldErrors] = useState<{ customerName?: string; notes?: string; address?: string; cep?: string }>({})
  const [submitError, setSubmitError] = useState<string | null>(null)
  const isSubmitting = useRef(false)
  const router = useRouter()
  const supabase = createBrowserClient()

  // Estados de entrega
  const [deliveryType, setDeliveryType] = useState<'pickup' | 'delivery'>('pickup')
  const [deliveryAddress, setDeliveryAddress] = useState("")
  const [deliveryCep, setDeliveryCep] = useState("")
  const [deliveryNeighborhood, setDeliveryNeighborhood] = useState("")
  const [deliveryFee, setDeliveryFee] = useState(0)
  const [loadingCep, setLoadingCep] = useState(false)

  // Estados de pagamento
  const [paymentMethod, setPaymentMethod] = useState<'counter' | 'pix' | 'credit' | 'debit'>('counter')

  // Taxas de entrega por bairro
  const deliveryFees: Record<string, number> = {
    "centro": 5,
    "jardim": 7,
    "vila": 8,
    "parque": 10,
    "bairro novo": 12,
    "zona rural": 15,
  }

  const getDeliveryFee = (neighborhood: string): number => {
    const normalizedNeighborhood = neighborhood.toLowerCase().trim()
    for (const [key, fee] of Object.entries(deliveryFees)) {
      if (normalizedNeighborhood.includes(key)) {
        return fee
      }
    }
    return 10 // Taxa padrão
  }

  const fetchAddressByCep = async (cep: string) => {
    const cleanCep = cep.replace(/\D/g, '')
    if (cleanCep.length !== 8) return

    setLoadingCep(true)
    try {
      const response = await fetch(`https://viacep.com.br/ws/${cleanCep}/json/`)
      const data = await response.json()
      
      if (!data.erro) {
        setDeliveryAddress(`${data.logradouro}, ${data.bairro}, ${data.localidade} - ${data.uf}`)
        setDeliveryNeighborhood(data.bairro)
        const fee = getDeliveryFee(data.bairro)
        setDeliveryFee(fee)
      }
    } catch (error) {
      console.error("Erro ao buscar CEP:", error)
    } finally {
      setLoadingCep(false)
    }
  }

  const formatCep = (value: string) => {
    const numbers = value.replace(/\D/g, '')
    if (numbers.length <= 5) return numbers
    return `${numbers.slice(0, 5)}-${numbers.slice(5, 8)}`
  }

  const handleCepChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatCep(e.target.value)
    setDeliveryCep(formatted)
    if (formatted.replace(/\D/g, '').length === 8) {
      fetchAddressByCep(formatted)
    }
  }

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

  const calculateSubtotal = () => {
    return cart.reduce((sum, item) => sum + calculateItemTotal(item), 0)
  }

  const calculateTotal = () => {
    return calculateSubtotal() + (deliveryType === 'delivery' ? deliveryFee : 0)
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

    // Validação de entrega
    if (deliveryType === 'delivery') {
      if (!deliveryAddress.trim()) {
        setFieldErrors(prev => ({ ...prev, address: "Endereço é obrigatório para entrega" }))
        return
      }
      if (!deliveryCep.trim() || deliveryCep.replace(/\D/g, '').length !== 8) {
        setFieldErrors(prev => ({ ...prev, cep: "CEP inválido" }))
        return
      }
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
          estimated_wait_time: deliveryType === 'delivery' ? 40 : 20,
          notes: sanitizedNotes,
          // Campos de entrega
          delivery_type: deliveryType,
          delivery_address: deliveryType === 'delivery' ? deliveryAddress : null,
          delivery_neighborhood: deliveryType === 'delivery' ? deliveryNeighborhood : null,
          delivery_fee: deliveryType === 'delivery' ? deliveryFee : 0,
          delivery_cep: deliveryType === 'delivery' ? deliveryCep : null,
          // Campos de pagamento
          payment_method: paymentMethod,
          payment_status: paymentMethod === 'counter' ? 'pending' : 'pending',
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
                <div className="border-t pt-3 mt-3 space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Subtotal</span>
                    <span>R$ {calculateSubtotal().toFixed(2)}</span>
                  </div>
                  {deliveryType === 'delivery' && (
                    <div className="flex justify-between text-sm">
                      <span>Taxa de entrega</span>
                      <span>R$ {deliveryFee.toFixed(2)}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-lg font-bold pt-2 border-t">
                    <span>Total</span>
                    <span className="text-primary">R$ {calculateTotal().toFixed(2)}</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Tipo de Entrega */}
          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Truck className="w-5 h-5" />
                Tipo de Entrega
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4">
                <button
                  type="button"
                  onClick={() => setDeliveryType('pickup')}
                  className={`p-4 rounded-lg border-2 transition-all ${
                    deliveryType === 'pickup' 
                      ? 'border-primary bg-primary/5' 
                      : 'border-border hover:border-primary/50'
                  }`}
                >
                  <Store className="w-8 h-8 mx-auto mb-2" />
                  <p className="font-semibold">Retirada</p>
                  <p className="text-xs text-muted-foreground">Retire no balcão</p>
                  <Badge variant="secondary" className="mt-2">Grátis</Badge>
                </button>
                <button
                  type="button"
                  onClick={() => setDeliveryType('delivery')}
                  className={`p-4 rounded-lg border-2 transition-all ${
                    deliveryType === 'delivery' 
                      ? 'border-primary bg-primary/5' 
                      : 'border-border hover:border-primary/50'
                  }`}
                >
                  <MapPin className="w-8 h-8 mx-auto mb-2" />
                  <p className="font-semibold">Entrega</p>
                  <p className="text-xs text-muted-foreground">Receba em casa</p>
                  <Badge variant="outline" className="mt-2">A partir de R$5</Badge>
                </button>
              </div>

              {deliveryType === 'delivery' && (
                <div className="mt-4 space-y-4 p-4 bg-muted/50 rounded-lg">
                  <div>
                    <Label htmlFor="cep">CEP *</Label>
                    <div className="flex gap-2">
                      <Input
                        id="cep"
                        value={deliveryCep}
                        onChange={handleCepChange}
                        placeholder="00000-000"
                        maxLength={9}
                        disabled={loading}
                        className={fieldErrors.cep ? "border-destructive" : ""}
                      />
                      {loadingCep && <Loader2 className="w-5 h-5 animate-spin self-center" />}
                    </div>
                    {fieldErrors.cep && (
                      <p className="text-sm text-destructive mt-1">{fieldErrors.cep}</p>
                    )}
                  </div>
                  <div>
                    <Label htmlFor="address">Endereço *</Label>
                    <Input
                      id="address"
                      value={deliveryAddress}
                      onChange={(e) => setDeliveryAddress(e.target.value)}
                      placeholder="Rua, número, bairro"
                      disabled={loading}
                      className={fieldErrors.address ? "border-destructive" : ""}
                    />
                    {fieldErrors.address && (
                      <p className="text-sm text-destructive mt-1">{fieldErrors.address}</p>
                    )}
                  </div>
                  {deliveryFee > 0 && (
                    <div className="flex items-center justify-between p-3 bg-background rounded-lg border">
                      <span className="text-sm">Taxa de entrega ({deliveryNeighborhood || 'calculando...'})</span>
                      <span className="font-bold text-primary">R$ {deliveryFee.toFixed(2)}</span>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Forma de Pagamento */}
          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CreditCard className="w-5 h-5" />
                Forma de Pagamento
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setPaymentMethod('counter')}
                  className={`p-4 rounded-lg border-2 transition-all ${
                    paymentMethod === 'counter' 
                      ? 'border-primary bg-primary/5' 
                      : 'border-border hover:border-primary/50'
                  }`}
                >
                  <Banknote className="w-6 h-6 mx-auto mb-2" />
                  <p className="font-semibold text-sm">No Balcão</p>
                  <p className="text-xs text-muted-foreground">Pague na retirada</p>
                </button>
                <button
                  type="button"
                  onClick={() => setPaymentMethod('pix')}
                  className={`p-4 rounded-lg border-2 transition-all ${
                    paymentMethod === 'pix' 
                      ? 'border-primary bg-primary/5' 
                      : 'border-border hover:border-primary/50'
                  }`}
                >
                  <QrCode className="w-6 h-6 mx-auto mb-2" />
                  <p className="font-semibold text-sm">PIX</p>
                  <p className="text-xs text-muted-foreground">Pague agora</p>
                </button>
                <button
                  type="button"
                  onClick={() => setPaymentMethod('credit')}
                  className={`p-4 rounded-lg border-2 transition-all ${
                    paymentMethod === 'credit' 
                      ? 'border-primary bg-primary/5' 
                      : 'border-border hover:border-primary/50'
                  }`}
                >
                  <CreditCard className="w-6 h-6 mx-auto mb-2" />
                  <p className="font-semibold text-sm">Crédito</p>
                  <p className="text-xs text-muted-foreground">Cartão de crédito</p>
                </button>
                <button
                  type="button"
                  onClick={() => setPaymentMethod('debit')}
                  className={`p-4 rounded-lg border-2 transition-all ${
                    paymentMethod === 'debit' 
                      ? 'border-primary bg-primary/5' 
                      : 'border-border hover:border-primary/50'
                  }`}
                >
                  <CreditCard className="w-6 h-6 mx-auto mb-2" />
                  <p className="font-semibold text-sm">Débito</p>
                  <p className="text-xs text-muted-foreground">Cartão de débito</p>
                </button>
              </div>
            </CardContent>
          </Card>

          {/* Dados do Cliente */}
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
                    `Confirmar Pedido - R$ ${calculateTotal().toFixed(2)}`
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

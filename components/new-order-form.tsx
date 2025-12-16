"use client"

import type React from "react"

import { useState } from "react"
import type { MenuItem, Ingredient } from "@/lib/types"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Plus, Minus, ShoppingCart, Trash2 } from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import { useRouter } from "next/navigation"

interface OrderItem {
  menuItem: MenuItem
  quantity: number
  extraIngredients: { ingredient: Ingredient; quantity: number }[]
}

interface NewOrderFormProps {
  menuItems: MenuItem[]
  ingredients: Ingredient[]
}

export function NewOrderForm({ menuItems, ingredients }: NewOrderFormProps) {
  const [customerName, setCustomerName] = useState("")
  const [notes, setNotes] = useState("")
  const [cart, setCart] = useState<OrderItem[]>([])
  const [selectedMenuItem, setSelectedMenuItem] = useState<MenuItem | null>(null)
  const [selectedIngredients, setSelectedIngredients] = useState<{ ingredient: Ingredient; quantity: number }[]>([])
  const [isSubmitting, setIsSubmitting] = useState(false)
  const router = useRouter()

  const addToCart = () => {
    if (!selectedMenuItem) return

    setCart([
      ...cart,
      {
        menuItem: selectedMenuItem,
        quantity: 1,
        extraIngredients: [...selectedIngredients],
      },
    ])

    setSelectedMenuItem(null)
    setSelectedIngredients([])
  }

  const removeFromCart = (index: number) => {
    setCart(cart.filter((_, i) => i !== index))
  }

  const updateCartItemQuantity = (index: number, delta: number) => {
    const newCart = [...cart]
    newCart[index].quantity = Math.max(1, newCart[index].quantity + delta)
    setCart(newCart)
  }

  const toggleIngredient = (ingredient: Ingredient) => {
    const existing = selectedIngredients.find((i) => i.ingredient.id === ingredient.id)
    if (existing) {
      setSelectedIngredients(selectedIngredients.filter((i) => i.ingredient.id !== ingredient.id))
    } else {
      setSelectedIngredients([...selectedIngredients, { ingredient, quantity: 1 }])
    }
  }

  const updateIngredientQuantity = (ingredientId: string, delta: number) => {
    setSelectedIngredients((prev) =>
      prev.map((item) =>
        item.ingredient.id === ingredientId ? { ...item, quantity: Math.max(1, item.quantity + delta) } : item,
      ),
    )
  }

  const calculateItemTotal = (item: OrderItem) => {
    const baseTotal = item.menuItem.base_price * item.quantity
    const extrasTotal = item.extraIngredients.reduce(
      (sum, extra) => sum + extra.ingredient.price * extra.quantity * item.quantity,
      0,
    )
    return baseTotal + extrasTotal
  }

  const calculateTotal = () => {
    return cart.reduce((sum, item) => sum + calculateItemTotal(item), 0)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (cart.length === 0 || !customerName.trim()) return

    setIsSubmitting(true)
    const supabase = createClient()

    try {
      // Criar pedido
      const { data: order, error: orderError } = await supabase
        .from("orders")
        .insert({
          customer_name: customerName,
          total_price: calculateTotal(),
          estimated_wait_time: cart.length * 10, // 10 minutos por item
          notes: notes || null,
          status: "pending",
        })
        .select()
        .single()

      if (orderError) throw orderError

      // Criar itens do pedido
      for (const item of cart) {
        const { data: orderItem, error: itemError } = await supabase
          .from("order_items")
          .insert({
            order_id: order.id,
            menu_item_id: item.menuItem.id,
            quantity: item.quantity,
            price: item.menuItem.base_price,
          })
          .select()
          .single()

        if (itemError) throw itemError

        // Adicionar ingredientes extras
        if (item.extraIngredients.length > 0) {
          const ingredientsToInsert = item.extraIngredients.map((extra) => ({
            order_item_id: orderItem.id,
            ingredient_id: extra.ingredient.id,
            quantity: extra.quantity,
            price: extra.ingredient.price,
          }))

          const { error: ingredientsError } = await supabase.from("order_item_ingredients").insert(ingredientsToInsert)

          if (ingredientsError) throw ingredientsError
        }
      }

      router.push("/admin/pedidos")
    } catch (error) {
      console.error("Erro ao criar pedido:", error)
      alert("Erro ao criar pedido. Tente novamente.")
    } finally {
      setIsSubmitting(false)
    }
  }

  const ingredientsByCategory = ingredients.reduce(
    (acc, ingredient) => {
      if (!acc[ingredient.category]) acc[ingredient.category] = []
      acc[ingredient.category].push(ingredient)
      return acc
    },
    {} as Record<string, Ingredient[]>,
  )

  const categoryNames: Record<string, string> = {
    protein: "Proteínas",
    cheese: "Queijos",
    vegetable: "Vegetais",
    sauce: "Molhos",
  }

  return (
    <form onSubmit={handleSubmit} className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Coluna 1: Seleção de Lanches */}
      <div className="lg:col-span-2 space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Selecione um Lanche</CardTitle>
            <CardDescription>Escolha do cardápio</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {menuItems.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setSelectedMenuItem(item)}
                  className={`p-4 rounded-lg border-2 text-left transition-all ${
                    selectedMenuItem?.id === item.id
                      ? "border-primary bg-primary/5"
                      : "border-border hover:border-primary/50"
                  }`}
                >
                  <h3 className="font-semibold text-lg mb-1">{item.name}</h3>
                  <p className="text-sm text-muted-foreground mb-2">{item.description}</p>
                  <p className="text-primary font-bold">R$ {item.base_price.toFixed(2)}</p>
                </button>
              ))}
            </div>
          </CardContent>
        </Card>

        {selectedMenuItem && (
          <Card>
            <CardHeader>
              <CardTitle>Adicionar Ingredientes Extras</CardTitle>
              <CardDescription>Personalize seu {selectedMenuItem.name}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {Object.entries(ingredientsByCategory).map(([category, items]) => (
                <div key={category}>
                  <h4 className="font-semibold mb-3">{categoryNames[category]}</h4>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                    {items.map((ingredient) => {
                      const selected = selectedIngredients.find((i) => i.ingredient.id === ingredient.id)
                      return (
                        <div key={ingredient.id} className="flex flex-col gap-1">
                          <button
                            type="button"
                            onClick={() => toggleIngredient(ingredient)}
                            className={`px-3 py-2 rounded-lg border text-sm transition-all ${
                              selected
                                ? "border-primary bg-primary text-primary-foreground"
                                : "border-border hover:border-primary"
                            }`}
                          >
                            <div className="font-medium">{ingredient.name}</div>
                            <div className="text-xs opacity-90">+R$ {ingredient.price.toFixed(2)}</div>
                          </button>
                          {selected && (
                            <div className="flex items-center justify-center gap-1">
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                onClick={() => updateIngredientQuantity(ingredient.id, -1)}
                                className="h-6 w-6 p-0"
                              >
                                <Minus className="w-3 h-3" />
                              </Button>
                              <span className="text-xs w-6 text-center">{selected.quantity}</span>
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                onClick={() => updateIngredientQuantity(ingredient.id, 1)}
                                className="h-6 w-6 p-0"
                              >
                                <Plus className="w-3 h-3" />
                              </Button>
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </div>
              ))}

              <Button type="button" onClick={addToCart} className="w-full" size="lg">
                <Plus className="w-4 h-4 mr-2" />
                Adicionar ao Pedido
              </Button>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Coluna 2: Carrinho e Finalização */}
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ShoppingCart className="w-5 h-5" />
              Carrinho
            </CardTitle>
            <CardDescription>
              {cart.length} {cart.length === 1 ? "item" : "itens"}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {cart.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">Nenhum item no carrinho</p>
            ) : (
              <div className="space-y-3">
                {cart.map((item, index) => (
                  <div key={index} className="p-3 rounded-lg border bg-card">
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div className="flex-1">
                        <h4 className="font-semibold text-sm">{item.menuItem.name}</h4>
                        <p className="text-xs text-muted-foreground">R$ {item.menuItem.base_price.toFixed(2)}</p>
                      </div>
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        onClick={() => removeFromCart(index)}
                        className="h-7 w-7 p-0"
                      >
                        <Trash2 className="w-3 h-3" />
                      </Button>
                    </div>

                    {item.extraIngredients.length > 0 && (
                      <div className="mb-2 flex flex-wrap gap-1">
                        {item.extraIngredients.map((extra, i) => (
                          <Badge key={i} variant="secondary" className="text-xs">
                            {extra.quantity}x {extra.ingredient.name}
                          </Badge>
                        ))}
                      </div>
                    )}

                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1">
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() => updateCartItemQuantity(index, -1)}
                          className="h-7 w-7 p-0"
                        >
                          <Minus className="w-3 h-3" />
                        </Button>
                        <span className="text-sm w-8 text-center font-medium">{item.quantity}</span>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() => updateCartItemQuantity(index, 1)}
                          className="h-7 w-7 p-0"
                        >
                          <Plus className="w-3 h-3" />
                        </Button>
                      </div>
                      <span className="text-sm font-bold text-primary">R$ {calculateItemTotal(item).toFixed(2)}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="pt-4 border-t">
              <div className="flex justify-between items-center mb-1">
                <span className="text-sm">Tempo estimado:</span>
                <span className="text-sm font-semibold">{cart.length * 10} min</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="font-bold">Total:</span>
                <span className="text-2xl font-bold text-primary">R$ {calculateTotal().toFixed(2)}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Dados do Pedido</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="customerName">Nome do Cliente *</Label>
              <Input
                id="customerName"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                placeholder="Digite o nome"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="notes">Observações</Label>
              <Textarea
                id="notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Observações adicionais..."
                rows={3}
              />
            </div>

            <Button
              type="submit"
              className="w-full"
              size="lg"
              disabled={cart.length === 0 || !customerName.trim() || isSubmitting}
            >
              {isSubmitting ? "Criando Pedido..." : "Finalizar Pedido"}
            </Button>
          </CardContent>
        </Card>
      </div>
    </form>
  )
}

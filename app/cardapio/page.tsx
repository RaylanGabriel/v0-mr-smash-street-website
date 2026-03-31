"use client"

import { useState, useEffect } from "react"
import { createBrowserClient } from "@/lib/supabase/client"
import type { MenuItem, Ingredient } from "@/lib/types"
import Image from "next/image"
import Link from "next/link"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { ShoppingCart, Plus, Minus, ArrowLeft } from "lucide-react"
import { useRouter } from "next/navigation"
import { ClientHeader } from "@/components/client-header"
import { ClientFooter } from "@/components/client-footer"

interface CartItem {
  menuItem: MenuItem
  quantity: number
  selectedIngredients: { ingredient: Ingredient; quantity: number }[]
}

export default function CardapioPage() {
  const [menuItems, setMenuItems] = useState<MenuItem[]>([])
  const [ingredients, setIngredients] = useState<Ingredient[]>([])
  const [cart, setCart] = useState<CartItem[]>([])
  const [selectedItem, setSelectedItem] = useState<MenuItem | null>(null)
  const [selectedIngredients, setSelectedIngredients] = useState<{ ingredient: Ingredient; quantity: number }[]>([])
  const [loading, setLoading] = useState(true)
  const router = useRouter()
  const supabase = createBrowserClient()

  useEffect(() => {
    loadData()
    loadCartFromStorage()
  }, [])

  const loadData = async () => {
    try {
      const [menuRes, ingredientsRes] = await Promise.all([
        supabase.from("menu_items").select("*").eq("active", true).order("name"),
        supabase.from("ingredients").select("*").eq("active", true).order("category, name"),
      ])

      if (menuRes.data) setMenuItems(menuRes.data)
      if (ingredientsRes.data) setIngredients(ingredientsRes.data)
    } catch (error) {
      console.error("Erro ao carregar dados:", error)
    } finally {
      setLoading(false)
    }
  }

  const loadCartFromStorage = () => {
    try {
      const saved = localStorage.getItem("cart")
      if (saved) {
        const parsed = JSON.parse(saved)
        // Validação básica da estrutura do carrinho
        if (Array.isArray(parsed) && parsed.every(item => 
          item.menuItem && 
          typeof item.quantity === 'number' && 
          item.quantity > 0
        )) {
          setCart(parsed)
        } else {
          // Limpa dados corrompidos
          localStorage.removeItem("cart")
        }
      }
    } catch (error) {
      // Limpa dados corrompidos
      console.error("Erro ao carregar carrinho:", error)
      localStorage.removeItem("cart")
    }
  }

  const saveCartToStorage = (newCart: CartItem[]) => {
    try {
      localStorage.setItem("cart", JSON.stringify(newCart))
    } catch (error) {
      console.error("Erro ao salvar carrinho:", error)
    }
  }

  const addToCart = () => {
    if (!selectedItem) return

    const newItem: CartItem = {
      menuItem: selectedItem,
      quantity: 1,
      selectedIngredients: selectedIngredients,
    }

    const newCart = [...cart, newItem]
    setCart(newCart)
    saveCartToStorage(newCart)

    setSelectedItem(null)
    setSelectedIngredients([])
  }

  const removeFromCart = (index: number) => {
    const newCart = cart.filter((_, i) => i !== index)
    setCart(newCart)
    saveCartToStorage(newCart)
  }

  const updateCartItemQuantity = (index: number, change: number) => {
    const newCart = [...cart]
    newCart[index].quantity = Math.max(1, newCart[index].quantity + change)
    setCart(newCart)
    saveCartToStorage(newCart)
  }

  const toggleIngredient = (ingredient: Ingredient) => {
    const existing = selectedIngredients.find((i) => i.ingredient.id === ingredient.id)
    if (existing) {
      setSelectedIngredients(selectedIngredients.filter((i) => i.ingredient.id !== ingredient.id))
    } else {
      setSelectedIngredients([...selectedIngredients, { ingredient, quantity: 1 }])
    }
  }

  const updateIngredientQuantity = (ingredientId: string, change: number) => {
    setSelectedIngredients(
      selectedIngredients.map((i) =>
        i.ingredient.id === ingredientId ? { ...i, quantity: Math.max(1, i.quantity + change) } : i,
      ),
    )
  }

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

  const groupedIngredients = ingredients.reduce(
    (acc, ing) => {
      if (!acc[ing.category]) acc[ing.category] = []
      acc[ing.category].push(ing)
      return acc
    },
    {} as Record<string, Ingredient[]>,
  )

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-lg">Carregando cardápio...</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-br from-background via-background to-muted">
      <ClientHeader />

      <main className="flex-1">
        <div className="container mx-auto px-4 py-8">
          <div className="flex items-center justify-between mb-8">
            <Link href="/">
              <Button variant="ghost" size="sm">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Voltar
              </Button>
            </Link>
            <div className="flex items-center gap-4">
              <div className="relative">
                <ShoppingCart className="w-6 h-6" />
                {cart.length > 0 && (
                  <Badge className="absolute -top-2 -right-2 w-5 h-5 flex items-center justify-center p-0">
                    {cart.length}
                  </Badge>
                )}
              </div>
            </div>
          </div>

          <div className="text-center mb-8">
            <div className="relative w-32 h-32 mx-auto mb-4">
              <Image src="/logo.png" alt="Mr. Smash Street" fill className="object-contain" />
            </div>
            <h1 className="text-4xl font-bold mb-2">Nosso Cardápio</h1>
            <p className="text-muted-foreground">Escolha seus lanches favoritos</p>
          </div>

          <div className="grid md:grid-cols-2 gap-8">
            <div>
              <h2 className="text-2xl font-bold mb-4">Lanches</h2>
              <div className="grid gap-4">
                {menuItems.map((item) => (
                  <Card
                    key={item.id}
                    className={`cursor-pointer transition-all hover:shadow-lg ${
                      selectedItem?.id === item.id ? "border-primary border-2" : ""
                    }`}
                    onClick={() => setSelectedItem(item)}
                  >
                    <CardHeader>
                      <CardTitle>{item.name}</CardTitle>
                      <CardDescription>{item.description}</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <p className="text-2xl font-bold text-primary">R$ {item.base_price.toFixed(2)}</p>
                    </CardContent>
                  </Card>
                ))}
              </div>

              {selectedItem && (
                <div className="mt-6">
                  <h3 className="text-xl font-bold mb-4">Ingredientes Extras</h3>
                  {Object.entries(groupedIngredients).map(([category, ings]) => (
                    <div key={category} className="mb-4">
                      <p className="text-sm font-semibold text-muted-foreground mb-2">{category}</p>
                      <div className="grid grid-cols-2 gap-2">
                        {ings.map((ing) => {
                          const selected = selectedIngredients.find((i) => i.ingredient.id === ing.id)
                          return (
                            <div key={ing.id} className="flex items-center gap-2">
                              <Button
                                variant={selected ? "default" : "outline"}
                                size="sm"
                                className="flex-1 justify-between"
                                onClick={() => toggleIngredient(ing)}
                              >
                                <span>{ing.name}</span>
                                <span>+R$ {ing.price.toFixed(2)}</span>
                              </Button>
                              {selected && (
                                <div className="flex items-center gap-1">
                                  <Button
                                    size="icon"
                                    variant="outline"
                                    className="h-8 w-8 bg-transparent"
                                    onClick={() => updateIngredientQuantity(ing.id, -1)}
                                  >
                                    <Minus className="w-3 h-3" />
                                  </Button>
                                  <span className="w-6 text-center">{selected.quantity}</span>
                                  <Button
                                    size="icon"
                                    variant="outline"
                                    className="h-8 w-8 bg-transparent"
                                    onClick={() => updateIngredientQuantity(ing.id, 1)}
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
                  <Button onClick={addToCart} className="w-full mt-4" size="lg">
                    <ShoppingCart className="w-4 h-4 mr-2" />
                    Adicionar ao Carrinho
                  </Button>
                </div>
              )}
            </div>

            <div>
              <h2 className="text-2xl font-bold mb-4">Seu Carrinho</h2>
              {cart.length === 0 ? (
                <Card>
                  <CardContent className="py-8 text-center text-muted-foreground">
                    Seu carrinho está vazio. Selecione um lanche para começar!
                  </CardContent>
                </Card>
              ) : (
                <>
                  <div className="space-y-4 mb-4">
                    {cart.map((item, index) => (
                      <Card key={index}>
                        <CardHeader>
                          <div className="flex justify-between items-start">
                            <div>
                              <CardTitle className="text-lg">{item.menuItem.name}</CardTitle>
                              {item.selectedIngredients.length > 0 && (
                                <CardDescription>
                                  Extras:{" "}
                                  {item.selectedIngredients
                                    .map((i) => `${i.ingredient.name} (${i.quantity}x)`)
                                    .join(", ")}
                                </CardDescription>
                              )}
                            </div>
                            <Button variant="ghost" size="sm" onClick={() => removeFromCart(index)}>
                              Remover
                            </Button>
                          </div>
                        </CardHeader>
                        <CardContent>
                          <div className="flex justify-between items-center">
                            <div className="flex items-center gap-2">
                              <Button size="icon" variant="outline" onClick={() => updateCartItemQuantity(index, -1)}>
                                <Minus className="w-4 h-4" />
                              </Button>
                              <span className="w-8 text-center font-semibold">{item.quantity}</span>
                              <Button size="icon" variant="outline" onClick={() => updateCartItemQuantity(index, 1)}>
                                <Plus className="w-4 h-4" />
                              </Button>
                            </div>
                            <p className="text-xl font-bold">R$ {calculateItemTotal(item).toFixed(2)}</p>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>

                  <Card className="bg-primary text-primary-foreground">
                    <CardContent className="py-4">
                      <div className="flex justify-between items-center text-xl font-bold">
                        <span>Total</span>
                        <span>R$ {calculateTotal().toFixed(2)}</span>
                      </div>
                    </CardContent>
                  </Card>

                  <Button className="w-full mt-4" size="lg" onClick={() => router.push("/finalizar-pedido")}>
                    Finalizar Pedido
                  </Button>
                </>
              )}
            </div>
          </div>
        </div>
      </main>

      <ClientFooter />
    </div>
  )
}

export interface MenuItem {
  id: string
  name: string
  description: string | null
  base_price: number
  image_url: string | null
  active: boolean
  created_at: string
}

export interface Ingredient {
  id: string
  name: string
  price: number
  category: string
  active: boolean
  created_at: string
}

export interface Order {
  id: string
  order_number: number
  customer_name: string
  status: string
  total_price: number
  estimated_wait_time: number
  notes: string | null
  created_at: string
  completed_at: string | null
  is_paid: boolean
  // Campos de entrega
  delivery_type: 'pickup' | 'delivery'
  delivery_address: string | null
  delivery_neighborhood: string | null
  delivery_fee: number
  delivery_cep: string | null
  // Campos de pagamento
  payment_method: 'counter' | 'pix' | 'credit' | 'debit'
  payment_status: 'pending' | 'approved' | 'rejected'
  payment_id: string | null
  pix_qrcode: string | null
  pix_qrcode_base64: string | null
}

export interface DeliveryFee {
  neighborhood: string
  fee: number
}

export interface OrderItem {
  id: string
  order_id: string
  menu_item_id: string
  quantity: number
  price: number
  created_at: string
  menu_items?: MenuItem
  order_item_ingredients?: OrderItemIngredient[]
}

export interface OrderItemIngredient {
  id: string
  order_item_id: string
  ingredient_id: string
  quantity: number
  price: number
  created_at: string
  ingredients?: Ingredient
}

export interface OrderWithItems extends Order {
  order_items: (OrderItem & {
    menu_items: MenuItem
    order_item_ingredients: (OrderItemIngredient & {
      ingredients: Ingredient
    })[]
  })[]
}

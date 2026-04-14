import { NextResponse } from "next/server"
import { createServerClient } from "@/lib/supabase/server"

export async function POST(request: Request) {
  try {
    const body = await request.json()

    // Mercado Pago envia diferentes tipos de notificação
    const { type, data, action } = body

    // Ignorar notificações de teste
    if (type === "test") {
      return NextResponse.json({ received: true })
    }

    // Processar apenas notificações de pagamento
    if (type !== "payment" && action !== "payment.created" && action !== "payment.updated") {
      return NextResponse.json({ received: true })
    }

    const paymentId = data?.id

    if (!paymentId) {
      return NextResponse.json({ received: true })
    }

    const accessToken = process.env.MERCADO_PAGO_ACCESS_TOKEN

    if (!accessToken) {
      console.error("Token do Mercado Pago não configurado")
      return NextResponse.json({ error: "Token não configurado" }, { status: 500 })
    }

    // Buscar detalhes do pagamento
    const paymentResponse = await fetch(
      `https://api.mercadopago.com/v1/payments/${paymentId}`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      }
    )

    if (!paymentResponse.ok) {
      console.error("Erro ao buscar pagamento:", await paymentResponse.text())
      return NextResponse.json({ error: "Erro ao buscar pagamento" }, { status: 500 })
    }

    const payment = await paymentResponse.json()

    // Mapear status do Mercado Pago para nosso sistema
    let paymentStatus: "pending" | "approved" | "rejected" = "pending"
    let isPaid = false

    switch (payment.status) {
      case "approved":
        paymentStatus = "approved"
        isPaid = true
        break
      case "rejected":
      case "cancelled":
      case "refunded":
        paymentStatus = "rejected"
        break
      default:
        paymentStatus = "pending"
    }

    // Atualizar pedido no banco de dados
    const supabase = await createServerClient()
    const orderId = payment.external_reference

    if (orderId) {
      const { error } = await supabase
        .from("orders")
        .update({
          payment_status: paymentStatus,
          payment_id: paymentId.toString(),
          is_paid: isPaid,
        })
        .eq("id", orderId)

      if (error) {
        console.error("Erro ao atualizar pedido:", error)
      }
    }

    return NextResponse.json({ received: true, status: paymentStatus })
  } catch (error) {
    console.error("Erro no webhook:", error)
    return NextResponse.json({ error: "Erro interno" }, { status: 500 })
  }
}

// Mercado Pago também pode enviar GET para verificar endpoint
export async function GET() {
  return NextResponse.json({ status: "ok", message: "Webhook endpoint ativo" })
}

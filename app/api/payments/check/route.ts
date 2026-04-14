import { NextResponse } from "next/server"
import { createServerClient } from "@/lib/supabase/server"

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const orderId = searchParams.get("orderId")
    const paymentId = searchParams.get("paymentId")

    if (!orderId && !paymentId) {
      return NextResponse.json(
        { error: "orderId ou paymentId é obrigatório" },
        { status: 400 }
      )
    }

    const accessToken = process.env.MERCADO_PAGO_ACCESS_TOKEN

    if (!accessToken) {
      return NextResponse.json(
        { error: "Token do Mercado Pago não configurado" },
        { status: 500 }
      )
    }

    // Se temos o paymentId, verificar diretamente no Mercado Pago
    if (paymentId) {
      const response = await fetch(
        `https://api.mercadopago.com/v1/payments/${paymentId}`,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        }
      )

      if (!response.ok) {
        return NextResponse.json(
          { error: "Pagamento não encontrado" },
          { status: 404 }
        )
      }

      const payment = await response.json()

      // Atualizar status no banco se mudou
      if (orderId && (payment.status === "approved" || payment.status === "rejected")) {
        const supabase = await createServerClient()
        
        await supabase
          .from("orders")
          .update({
            payment_status: payment.status === "approved" ? "approved" : "rejected",
            is_paid: payment.status === "approved",
          })
          .eq("id", orderId)
      }

      return NextResponse.json({
        status: payment.status,
        status_detail: payment.status_detail,
        is_paid: payment.status === "approved",
      })
    }

    // Se só temos orderId, buscar no banco
    const supabase = await createServerClient()
    
    const { data: order, error } = await supabase
      .from("orders")
      .select("payment_status, payment_id, is_paid")
      .eq("id", orderId)
      .single()

    if (error || !order) {
      return NextResponse.json(
        { error: "Pedido não encontrado" },
        { status: 404 }
      )
    }

    return NextResponse.json({
      status: order.payment_status,
      payment_id: order.payment_id,
      is_paid: order.is_paid,
    })
  } catch (error) {
    console.error("Erro ao verificar pagamento:", error)
    return NextResponse.json(
      { error: "Erro interno" },
      { status: 500 }
    )
  }
}

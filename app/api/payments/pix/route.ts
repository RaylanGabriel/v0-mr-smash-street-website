import { NextResponse } from "next/server"
import { createServerClient } from "@/lib/supabase/server"

export async function POST(request: Request) {
  try {
    const { orderId, amount, description, payerEmail } = await request.json()

    if (!orderId || !amount) {
      return NextResponse.json(
        { error: "orderId e amount são obrigatórios" },
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

    // Criar pagamento PIX no Mercado Pago
    const response = await fetch("https://api.mercadopago.com/v1/payments", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
        "X-Idempotency-Key": `pix-${orderId}-${Date.now()}`,
      },
      body: JSON.stringify({
        transaction_amount: amount,
        description: description || `Pedido Mr. Smash Street`,
        payment_method_id: "pix",
        payer: {
          email: payerEmail || "cliente@mrsmashstreet.com",
        },
        external_reference: orderId,
      }),
    })

    const paymentData = await response.json()

    if (!response.ok) {
      console.error("Erro Mercado Pago:", paymentData)
      return NextResponse.json(
        { error: "Erro ao criar pagamento PIX", details: paymentData },
        { status: response.status }
      )
    }

    // Atualizar pedido com informações do PIX
    const supabase = await createServerClient()
    
    const qrCode = paymentData.point_of_interaction?.transaction_data?.qr_code
    const qrCodeBase64 = paymentData.point_of_interaction?.transaction_data?.qr_code_base64

    await supabase
      .from("orders")
      .update({
        payment_id: paymentData.id.toString(),
        payment_status: "pending",
        pix_qrcode: qrCode,
        pix_qrcode_base64: qrCodeBase64,
      })
      .eq("id", orderId)

    return NextResponse.json({
      success: true,
      payment_id: paymentData.id,
      qr_code: qrCode,
      qr_code_base64: qrCodeBase64,
      ticket_url: paymentData.point_of_interaction?.transaction_data?.ticket_url,
    })
  } catch (error) {
    console.error("Erro ao processar pagamento PIX:", error)
    return NextResponse.json(
      { error: "Erro interno ao processar pagamento" },
      { status: 500 }
    )
  }
}

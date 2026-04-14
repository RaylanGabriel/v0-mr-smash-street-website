import { NextResponse } from "next/server"

export async function POST(request: Request) {
  try {
    const { orderId, orderNumber, items, amount, payerEmail } = await request.json()

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

    // URL base para callbacks
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || process.env.VERCEL_URL 
      ? `https://${process.env.VERCEL_URL}` 
      : "http://localhost:3000"

    // Criar preferência de pagamento
    const response = await fetch("https://api.mercadopago.com/checkout/preferences", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        items: items || [
          {
            title: `Pedido #${orderNumber} - Mr. Smash Street`,
            quantity: 1,
            unit_price: amount,
            currency_id: "BRL",
          },
        ],
        payer: {
          email: payerEmail || "",
        },
        external_reference: orderId,
        back_urls: {
          success: `${baseUrl}/meu-pedido?numero=${orderNumber}&status=approved`,
          failure: `${baseUrl}/meu-pedido?numero=${orderNumber}&status=rejected`,
          pending: `${baseUrl}/meu-pedido?numero=${orderNumber}&status=pending`,
        },
        auto_return: "approved",
        notification_url: `${baseUrl}/api/payments/webhook`,
        statement_descriptor: "MR SMASH STREET",
      }),
    })

    const preferenceData = await response.json()

    if (!response.ok) {
      console.error("Erro Mercado Pago:", preferenceData)
      return NextResponse.json(
        { error: "Erro ao criar preferência", details: preferenceData },
        { status: response.status }
      )
    }

    return NextResponse.json({
      success: true,
      preference_id: preferenceData.id,
      init_point: preferenceData.init_point,
      sandbox_init_point: preferenceData.sandbox_init_point,
    })
  } catch (error) {
    console.error("Erro ao criar preferência:", error)
    return NextResponse.json(
      { error: "Erro interno ao criar preferência" },
      { status: 500 }
    )
  }
}

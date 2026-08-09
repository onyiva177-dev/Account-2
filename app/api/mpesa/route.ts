// app/api/mpesa/route.ts
// M-Pesa Daraja STK Push integration
// Add these to Vercel env vars:
//   MPESA_CONSUMER_KEY, MPESA_CONSUMER_SECRET,
//   MPESA_PASSKEY, MPESA_SHORTCODE, MPESA_CALLBACK_URL

import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

const MPESA_BASE = 'https://api.safaricom.co.ke'  // prod
// const MPESA_BASE = 'https://sandbox.safaricom.co.ke'  // sandbox for testing

async function getMpesaToken(): Promise<string> {
  const key    = process.env.MPESA_CONSUMER_KEY!
  const secret = process.env.MPESA_CONSUMER_SECRET!
  const auth   = Buffer.from(`${key}:${secret}`).toString('base64')

  const res = await fetch(
    `${MPESA_BASE}/oauth/v1/generate?grant_type=client_credentials`,
    { headers: { Authorization: `Basic ${auth}` } }
  )
  const data = await res.json()
  return data.access_token
}

// POST /api/mpesa — initiates STK push
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { phone, tier_id, tier_name, amount } = body

    if (!phone || !tier_id || !amount) {
      return NextResponse.json({ error: 'phone, tier_id and amount required' }, { status: 400 })
    }

    // Validate session
    const cookieStore = await cookies()
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} } }
    )

    const { data: { session } } = await supabase.auth.getSession()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: profile } = await supabase
      .from('profiles').select('organization_id').eq('id', session.user.id).single()
    if (!profile?.organization_id) return NextResponse.json({ error: 'No org' }, { status: 400 })

    // Clean phone number → 2547XXXXXXXX format
    const cleanPhone = phone.replace(/\D/g, '').replace(/^0/, '254').replace(/^\+/, '')

    // Get M-Pesa token
    const token     = await getMpesaToken()
    const shortcode = process.env.MPESA_SHORTCODE!
    const passkey   = process.env.MPESA_PASSKEY!
    const timestamp = new Date().toISOString().replace(/[-T:.Z]/g, '').slice(0, 14)
    const password  = Buffer.from(`${shortcode}${passkey}${timestamp}`).toString('base64')
    const callbackUrl = process.env.MPESA_CALLBACK_URL!

    // STK Push request
    const stkRes = await fetch(`${MPESA_BASE}/mpesa/stkpush/v1/processrequest`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        BusinessShortCode: shortcode,
        Password:          password,
        Timestamp:         timestamp,
        TransactionType:   'CustomerPayBillOnline',
        Amount:            Math.ceil(amount),
        PartyA:            cleanPhone,
        PartyB:            shortcode,
        PhoneNumber:       cleanPhone,
        CallBackURL:       callbackUrl,
        AccountReference:  `FinAI-${profile.organization_id.slice(0, 8).toUpperCase()}`,
        TransactionDesc:   `FinAI ${tier_name} subscription`,
      }),
    })

    const stkData = await stkRes.json()

    if (stkData.ResponseCode !== '0') {
      return NextResponse.json(
        { error: stkData.ResponseDescription || 'STK push failed' },
        { status: 400 }
      )
    }

    // Record pending payment in DB
    await supabase.from('payment_transactions').insert({
      organization_id:   profile.organization_id,
      tier_id,
      amount,
      currency:          'KES',
      method:            'mpesa',
      status:            'pending',
      mpesa_checkout_id: stkData.CheckoutRequestID,
      phone_number:      cleanPhone,
      description:       `FinAI ${tier_name} subscription`,
    })

    return NextResponse.json({
      ok: true,
      checkout_request_id: stkData.CheckoutRequestID,
      message: 'Check your phone and enter M-Pesa PIN to complete payment',
    })

  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

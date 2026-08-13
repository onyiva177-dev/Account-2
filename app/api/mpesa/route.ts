import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export async function POST(req: NextRequest) {
  try {
    const CONSUMER_KEY    = process.env.MPESA_CONSUMER_KEY
    const CONSUMER_SECRET = process.env.MPESA_CONSUMER_SECRET
    const SHORTCODE       = process.env.MPESA_SHORTCODE
    const PASSKEY         = process.env.MPESA_PASSKEY
    const CALLBACK_URL    = process.env.MPESA_CALLBACK_URL
    const MPESA_BASE      = process.env.MPESA_BASE_URL || 'https://sandbox.safaricom.co.ke'

    const missing = [
      !CONSUMER_KEY    && 'MPESA_CONSUMER_KEY',
      !CONSUMER_SECRET && 'MPESA_CONSUMER_SECRET',
      !SHORTCODE       && 'MPESA_SHORTCODE',
      !PASSKEY         && 'MPESA_PASSKEY',
      !CALLBACK_URL    && 'MPESA_CALLBACK_URL',
    ].filter(Boolean)
    if (missing.length > 0)
      return NextResponse.json({ error: `Missing env vars: ${missing.join(', ')}` }, { status: 400 })

    const body = await req.json()
    const { phone, tier_id, tier_name, amount } = body
    if (!phone || !amount)
      return NextResponse.json({ error: 'phone and amount required' }, { status: 400 })

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

    const cleanPhone = phone.replace(/\D/g,'').replace(/^0/,'254').replace(/^\+/,'')
    if (cleanPhone.length < 12)
      return NextResponse.json({ error: 'Invalid phone — use 07XXXXXXXX or 254XXXXXXXXX' }, { status: 400 })

    const auth = Buffer.from(`${CONSUMER_KEY}:${CONSUMER_SECRET}`).toString('base64')
    const tokenRes = await fetch(`${MPESA_BASE}/oauth/v1/generate?grant_type=client_credentials`,
      { headers: { Authorization: `Basic ${auth}` } })
    const tokenData = await tokenRes.json()
    if (!tokenData.access_token)
      return NextResponse.json({ error: 'M-Pesa auth failed — check CONSUMER_KEY and CONSUMER_SECRET' }, { status: 400 })

    const timestamp = new Date().toISOString().replace(/[-T:.Z]/g,'').slice(0,14)
    const password  = Buffer.from(`${SHORTCODE}${PASSKEY}${timestamp}`).toString('base64')

    const stkRes = await fetch(`${MPESA_BASE}/mpesa/stkpush/v1/processrequest`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenData.access_token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        BusinessShortCode: SHORTCODE, Password: password, Timestamp: timestamp,
        TransactionType: 'CustomerPayBillOnline',
        Amount: Math.ceil(amount), PartyA: cleanPhone, PartyB: SHORTCODE, PhoneNumber: cleanPhone,
        CallBackURL: CALLBACK_URL,
        AccountReference: profile?.organization_id
          ? `FinAI-${profile.organization_id.slice(0,8).toUpperCase()}`
          : 'FinAI',
        TransactionDesc: tier_name ? `FinAI ${tier_name}` : 'FinAI Payment',
      }),
    })
    const stkData = await stkRes.json()
    if (stkData.ResponseCode !== '0')
      return NextResponse.json({ error: stkData.ResponseDescription || 'STK push failed' }, { status: 400 })

    if (tier_id && profile?.organization_id) {
      await supabase.from('payment_transactions').insert({
        organization_id: profile.organization_id, tier_id, amount,
        currency: 'KES', method: 'mpesa', status: 'pending',
        mpesa_checkout_id: stkData.CheckoutRequestID, phone_number: cleanPhone,
        description: `FinAI ${tier_name} subscription`,
      })
    }

    return NextResponse.json({ ok: true, checkout_request_id: stkData.CheckoutRequestID,
      message: 'STK push sent — customer enters PIN to pay' })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

// app/api/mpesa/route.ts  — FIXED VERSION
// Changes from original:
//  1. Better error messages when env vars missing
//  2. MPESA_BASE read from env so you can switch sandbox/prod without code change
//  3. Handles Safaricom error responses more clearly

import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export async function POST(req: NextRequest) {
  try {
    // Check env vars first — give clear error if missing
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

    if (missing.length > 0) {
      return NextResponse.json(
        { error: `Missing Vercel env vars: ${missing.join(', ')}. Add them in Vercel → Settings → Environment Variables then redeploy.` },
        { status: 400 }
      )
    }

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
      .from('profiles').select('organization_id')
      .eq('id', session.user.id).single()
    if (!profile?.organization_id) {
      return NextResponse.json({ error: 'No organisation found for this user' }, { status: 400 })
    }

    // Clean phone → 2547XXXXXXXX
    const cleanPhone = phone.replace(/\D/g, '')
      .replace(/^0/, '254')
      .replace(/^\+/, '')
    if (cleanPhone.length < 12) {
      return NextResponse.json({ error: 'Invalid phone number format. Use 07XXXXXXXX or 254XXXXXXXXX' }, { status: 400 })
    }

    // Get M-Pesa OAuth token
    const auth    = Buffer.from(`${CONSUMER_KEY}:${CONSUMER_SECRET}`).toString('base64')
    const tokenRes = await fetch(`${MPESA_BASE}/oauth/v1/generate?grant_type=client_credentials`, {
      headers: { Authorization: `Basic ${auth}` },
    })
    const tokenData = await tokenRes.json()

    if (!tokenData.access_token) {
      return NextResponse.json(
        { error: 'Failed to get M-Pesa token. Check MPESA_CONSUMER_KEY and MPESA_CONSUMER_SECRET.' },
        { status: 400 }
      )
    }

    // Build STK push password
    const timestamp = new Date().toISOString().replace(/[-T:.Z]/g, '').slice(0, 14)
    const password  = Buffer.from(`${SHORTCODE}${PASSKEY}${timestamp}`).toString('base64')

    // Send STK push
    const stkRes = await fetch(`${MPESA_BASE}/mpesa/stkpush/v1/processrequest`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${tokenData.access_token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        BusinessShortCode: SHORTCODE,
        Password:          password,
        Timestamp:         timestamp,
        TransactionType:   'CustomerPayBillOnline',
        Amount:            Math.ceil(amount),
        PartyA:            cleanPhone,
        PartyB:            SHORTCODE,
        PhoneNumber:       cleanPhone,
        CallBackURL:       CALLBACK_URL,
        AccountReference:  `FinAI-${profile.organization_id.slice(0, 8).toUpperCase()}`,
        TransactionDesc:   `FinAI ${tier_name} subscription`,
      }),
    })

    const stkData = await stkRes.json()

    if (stkData.ResponseCode !== '0') {
      return NextResponse.json(
        { error: stkData.ResponseDescription || stkData.errorMessage || 'STK push failed' },
        { status: 400 }
      )
    }

    // Record pending payment
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

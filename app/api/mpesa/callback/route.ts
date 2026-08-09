// app/api/mpesa/callback/route.ts
// Safaricom calls this URL after STK push is confirmed or rejected
// This is the critical file — it marks payment as completed and
// instantly grants module access via the DB trigger

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// Use SERVICE ROLE key here — this endpoint is called by Safaricom,
// not a logged-in user, so we bypass RLS
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const stk  = body?.Body?.stkCallback

    if (!stk) return NextResponse.json({ ok: true }) // Safaricom test ping

    const checkoutId = stk.CheckoutRequestID
    const resultCode = stk.ResultCode  // 0 = success

    if (resultCode === 0) {
      // Extract receipt number from metadata
      const items   = stk.CallbackMetadata?.Item || []
      const receipt = items.find((i: any) => i.Name === 'MpesaReceiptNumber')?.Value || ''
      const amount  = items.find((i: any) => i.Name === 'Amount')?.Value || 0

      // Mark payment as completed → DB trigger fires → modules unlocked instantly
      await supabase
        .from('payment_transactions')
        .update({
          status:        'completed',
          mpesa_receipt: receipt,
          amount,
          paid_at:       new Date().toISOString(),
          expires_at:    new Date(Date.now() + 30 * 86400000).toISOString(), // +30 days
        })
        .eq('mpesa_checkout_id', checkoutId)
        .eq('status', 'pending')

    } else {
      // Payment failed or cancelled
      await supabase
        .from('payment_transactions')
        .update({
          status:   'failed',
          metadata: { result_code: resultCode, result_desc: stk.ResultDesc },
        })
        .eq('mpesa_checkout_id', checkoutId)
    }

    // Always respond 200 to Safaricom
    return NextResponse.json({ ResultCode: 0, ResultDesc: 'Accepted' })

  } catch (e: any) {
    console.error('M-Pesa callback error:', e.message)
    return NextResponse.json({ ResultCode: 0, ResultDesc: 'Accepted' })
  }
}

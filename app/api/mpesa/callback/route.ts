import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const stk  = body?.Body?.stkCallback
    if (!stk) return NextResponse.json({ ResultCode:0, ResultDesc:'Accepted' })

    const checkoutId = stk.CheckoutRequestID
    const resultCode = stk.ResultCode

    if (resultCode === 0) {
      const items   = stk.CallbackMetadata?.Item || []
      const receipt = items.find((i:any) => i.Name==='MpesaReceiptNumber')?.Value || ''
      const amount  = items.find((i:any) => i.Name==='Amount')?.Value || 0
      await supabase.from('payment_transactions').update({
        status: 'completed', mpesa_receipt: receipt, amount,
        paid_at: new Date().toISOString(),
        expires_at: new Date(Date.now()+30*86400000).toISOString(),
      }).eq('mpesa_checkout_id', checkoutId).eq('status','pending')
    } else {
      await supabase.from('payment_transactions').update({
        status: 'failed', metadata: { result_code: resultCode, result_desc: stk.ResultDesc },
      }).eq('mpesa_checkout_id', checkoutId)
    }
    return NextResponse.json({ ResultCode:0, ResultDesc:'Accepted' })
  } catch {
    return NextResponse.json({ ResultCode:0, ResultDesc:'Accepted' })
  }
}

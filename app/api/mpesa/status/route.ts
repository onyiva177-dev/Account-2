import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export async function GET(req: NextRequest) {
  const checkoutId = req.nextUrl.searchParams.get('checkout_id')
  if (!checkoutId) return NextResponse.json({ error: 'checkout_id required' }, { status: 400 })
  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} } }
  )
  const { data } = await supabase.from('payment_transactions')
    .select('status,mpesa_receipt,amount,paid_at,tier_id')
    .eq('mpesa_checkout_id', checkoutId).single()
  return NextResponse.json(data || { status:'not_found' })
}

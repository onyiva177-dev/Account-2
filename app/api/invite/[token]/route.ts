// app/api/invite/[token]/route.ts
// Fixed for Next.js 15 — params is now a Promise
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const adminSupabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params   // ← must await in Next.js 15

  const { data, error } = await adminSupabase.rpc('fn_get_invite_by_token', { p_token: token })
  if (error || !data || data.length === 0)
    return NextResponse.json({ error: 'Invalid or expired invite' }, { status: 404 })
  return NextResponse.json(data[0])
}

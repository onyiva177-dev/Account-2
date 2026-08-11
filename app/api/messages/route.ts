// app/api/messages/route.ts
// In-app messaging between org members (employees)
// No external service needed — stored in app_messages table

import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

// POST — send an in-app message
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { recipient_id, subject, message } = body

    if (!recipient_id || !message) {
      return NextResponse.json({ error: 'recipient_id and message required' }, { status: 400 })
    }

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

    const { data: msg, error } = await supabase.from('app_messages').insert({
      organization_id: profile!.organization_id,
      sender_id:       session.user.id,
      recipient_id,
      channel:         'app',
      subject,
      body:            message,
      is_read:         false,
    }).select().single()

    if (error) return NextResponse.json({ error: error.message }, { status: 400 })
    return NextResponse.json({ ok: true, message: msg })

  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

// GET — fetch inbox for current user
export async function GET(req: NextRequest) {
  try {
    const cookieStore = await cookies()
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} } }
    )

    const { data: { session } } = await supabase.auth.getSession()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data } = await supabase
      .from('app_messages')
      .select('*, sender:profiles!app_messages_sender_id_fkey(full_name), contact:contacts(name)')
      .eq('recipient_id', session.user.id)
      .order('created_at', { ascending: false })
      .limit(50)

    return NextResponse.json(data || [])
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

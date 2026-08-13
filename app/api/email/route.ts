import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

const RESEND_API = 'https://api.resend.com/emails'
const FROM_EMAIL = 'FinAI <noreply@finai.co.ke>'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { to_email, to_name, subject, body_html, body_text, type } = body
    if (!to_email || !subject)
      return NextResponse.json({ error: 'to_email and subject required' }, { status: 400 })

    const cookieStore = await cookies()
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} } }
    )
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const { data: profile } = await supabase.from('profiles')
      .select('organization_id').eq('id', session.user.id).single()

    const { data: emailLog } = await supabase.from('email_messages').insert({
      organization_id: profile!.organization_id, sent_by: session.user.id,
      to_email, to_name, subject, body_html, body_text,
      type: type || 'manual', status: 'queued',
    }).select().single()

    const resendRes = await fetch(RESEND_API, {
      method: 'POST',
      headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: FROM_EMAIL, to: [to_email], subject,
        html: body_html || `<p>${body_text}</p>`, text: body_text }),
    })
    const resendData = await resendRes.json()

    if (!resendRes.ok) {
      await supabase.from('email_messages').update({ status:'failed', error:resendData.message }).eq('id', emailLog!.id)
      return NextResponse.json({ error: resendData.message }, { status: 400 })
    }
    await supabase.from('email_messages').update({
      status:'sent', resend_id:resendData.id, sent_at:new Date().toISOString()
    }).eq('id', emailLog!.id)
    return NextResponse.json({ ok:true, email_id:resendData.id })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

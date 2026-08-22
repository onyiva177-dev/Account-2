// app/api/whatsapp/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// GET — Meta webhook verification
export async function GET(req: NextRequest) {
  const p = req.nextUrl.searchParams
  if (
    p.get('hub.mode') === 'subscribe' &&
    p.get('hub.verify_token') === process.env.WHATSAPP_WEBHOOK_SECRET
  ) return new NextResponse(p.get('hub.challenge'), { status: 200 })
  return new NextResponse('Forbidden', { status: 403 })
}

export async function POST(req: NextRequest) {
  const body = await req.json()

  // ── Incoming reply FROM customer via Meta webhook ─────────────
  if (body?.object === 'whatsapp_business_account') {
    const messages = body.entry?.[0]?.changes?.[0]?.value?.messages || []
    for (const msg of messages) {
      if (msg.type !== 'text') continue
      const fromPhone = msg.from   // e.g. 254712345678
      const text      = msg.text?.body
      const waId      = msg.id

      // Find the contact by phone number (try both formats)
      const phone10 = fromPhone.replace(/^254/, '0')   // 0712345678
      const { data: contact } = await admin
        .from('contacts')
        .select('id, organization_id, name')
        .or(`whatsapp_number.eq.${fromPhone},phone.eq.${fromPhone},whatsapp_number.eq.${phone10},phone.eq.${phone10}`)
        .limit(1)
        .maybeSingle()

      if (!contact) continue

      // Find org owner to receive it
      const { data: owner } = await admin
        .from('profiles')
        .select('id')
        .eq('organization_id', contact.organization_id)
        .in('role', ['super_admin', 'owner'])
        .limit(1)
        .maybeSingle()

      // Store with recipient_contact_id so thread query finds it
      await admin.from('app_messages').insert({
        organization_id:      contact.organization_id,
        sender_id:            null,            // external sender
        recipient_id:         owner?.id || null,
        recipient_contact_id: contact.id,      // KEY: links to the contact thread
        channel:              'whatsapp',
        body:                 text,
        is_read:              false,
        whatsapp_msg_id:      waId,
        whatsapp_status:      'received',
        metadata:             { from_name: contact.name, from_phone: fromPhone, direction: 'inbound' },
      })
    }
    return NextResponse.json({ ok: true })
  }

  // ── Outbound: send WhatsApp message ──────────────────────────
  try {
    const { contact_id, message, contact_phone } = body
    if (!message) return NextResponse.json({ error: 'message required' }, { status: 400 })

    const PHONE_ID = process.env.WHATSAPP_PHONE_NUMBER_ID
    const TOKEN    = process.env.WHATSAPP_ACCESS_TOKEN
    if (!PHONE_ID || !TOKEN)
      return NextResponse.json({ error: 'WHATSAPP_PHONE_NUMBER_ID and WHATSAPP_ACCESS_TOKEN not set in Vercel' }, { status: 400 })

    const cookieStore = await cookies()
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} } }
    )
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const { data: profile } = await supabase.from('profiles')
      .select('organization_id, full_name').eq('id', session.user.id).single()

    let phone = contact_phone
    let contactName = ''
    if (contact_id && !phone) {
      const { data: c } = await supabase.from('contacts').select('*').eq('id', contact_id).single()
      phone = c?.whatsapp_number || c?.phone
      contactName = c?.name || ''
      if (!phone) return NextResponse.json({ error: 'Contact has no WhatsApp number or phone' }, { status: 400 })
    }

    const cleanPhone = phone.replace(/\D/g, '').replace(/^0/, '254').replace(/^\+/, '')

    const waRes = await fetch(`https://graph.facebook.com/v19.0/${PHONE_ID}/messages`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messaging_product: 'whatsapp', to: cleanPhone, type: 'text',
        text: { body: message, preview_url: false },
      }),
    })
    const waData = await waRes.json()
    if (!waRes.ok || waData.error)
      return NextResponse.json({ error: waData.error?.message || 'WhatsApp API error' }, { status: 400 })

    // Store outbound message — also with recipient_contact_id for thread grouping
    await supabase.from('app_messages').insert({
      organization_id:      profile!.organization_id,
      sender_id:            session.user.id,
      recipient_id:         null,
      recipient_contact_id: contact_id || null,
      channel:              'whatsapp',
      body:                 message,
      is_read:              true,
      whatsapp_msg_id:      waData.messages?.[0]?.id,
      whatsapp_status:      'sent',
      metadata:             { to_phone: cleanPhone, to_name: contactName, direction: 'outbound' },
    })

    return NextResponse.json({ ok: true, message_id: waData.messages?.[0]?.id })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

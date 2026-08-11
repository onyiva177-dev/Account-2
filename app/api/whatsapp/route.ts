// app/api/whatsapp/route.ts
// Send WhatsApp messages via WhatsApp Business Cloud API (Meta)
// FREE tier: 1000 conversations/month
//
// Setup:
// 1. Go to developers.facebook.com → Create App → Business
// 2. Add WhatsApp product
// 3. Get Phone Number ID and Access Token
// Add to Vercel env vars:
//   WHATSAPP_PHONE_NUMBER_ID=your_phone_number_id
//   WHATSAPP_ACCESS_TOKEN=your_access_token
//   WHATSAPP_WEBHOOK_SECRET=your_webhook_verify_token

import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

const WA_API = 'https://graph.facebook.com/v19.0'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { contact_id, message, contact_phone, contact_name } = body

    if (!message || (!contact_id && !contact_phone)) {
      return NextResponse.json({ error: 'message and contact required' }, { status: 400 })
    }

    const PHONE_NUMBER_ID = process.env.WHATSAPP_PHONE_NUMBER_ID
    const ACCESS_TOKEN    = process.env.WHATSAPP_ACCESS_TOKEN

    if (!PHONE_NUMBER_ID || !ACCESS_TOKEN) {
      return NextResponse.json({
        error: 'WhatsApp not configured. Add WHATSAPP_PHONE_NUMBER_ID and WHATSAPP_ACCESS_TOKEN to Vercel env vars.'
      }, { status: 400 })
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
      .from('profiles').select('organization_id, full_name').eq('id', session.user.id).single()

    // Get contact phone if contact_id provided
    let phone = contact_phone
    if (contact_id && !phone) {
      const { data: contact } = await supabase
        .from('contacts').select('whatsapp_number, phone, name').eq('id', contact_id).single()
      phone = contact?.whatsapp_number || contact?.phone
      if (!phone) return NextResponse.json({ error: 'Contact has no phone/WhatsApp number' }, { status: 400 })
    }

    // Clean phone number — must be international format without +
    const cleanPhone = phone.replace(/\D/g, '').replace(/^0/, '254')

    // Send via WhatsApp Business API
    const waRes = await fetch(`${WA_API}/${PHONE_NUMBER_ID}/messages`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${ACCESS_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to: cleanPhone,
        type: 'text',
        text: {
          body: message,
          preview_url: false,
        },
      }),
    })

    const waData = await waRes.json()

    if (!waRes.ok || waData.error) {
      return NextResponse.json(
        { error: waData.error?.message || 'WhatsApp API error' },
        { status: 400 }
      )
    }

    // Log in app_messages
    await supabase.from('app_messages').insert({
      organization_id:     profile!.organization_id,
      sender_id:           session.user.id,
      recipient_contact_id: contact_id || null,
      channel:             'whatsapp',
      body:                message,
      whatsapp_msg_id:     waData.messages?.[0]?.id,
      whatsapp_status:     'sent',
    })

    return NextResponse.json({
      ok: true,
      message_id: waData.messages?.[0]?.id,
      phone: cleanPhone,
    })

  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

// WhatsApp webhook — Meta sends delivery/read receipts here
// Also receives replies from customers
export async function GET(req: NextRequest) {
  const params   = req.nextUrl.searchParams
  const mode     = params.get('hub.mode')
  const token    = params.get('hub.verify_token')
  const challenge = params.get('hub.challenge')

  if (mode === 'subscribe' && token === process.env.WHATSAPP_WEBHOOK_SECRET) {
    return new NextResponse(challenge, { status: 200 })
  }
  return new NextResponse('Forbidden', { status: 403 })
}

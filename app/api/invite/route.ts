// app/api/invite/route.ts
// Create invite + send email with signup link
import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

const BASE_URL     = process.env.NEXT_PUBLIC_APP_URL || 'https://account-2.vercel.app'
const RESEND_API   = 'https://api.resend.com/emails'
const FROM_EMAIL   = 'FinAI <noreply@finai.co.ke>'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { email, name, role_id, role_name, modules, agreement_text, letter_subject, letter_body } = body

    if (!email || !name || !role_id)
      return NextResponse.json({ error: 'email, name and role_id required' }, { status: 400 })

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
    const { data: org } = await supabase.from('organizations')
      .select('name').eq('id', profile!.organization_id).single()

    // Create invite record
    const { data: invite, error: invErr } = await supabase.from('invitations').insert({
      organization_id: profile!.organization_id,
      invited_by:      session.user.id,
      email, name, role_id, role_name,
      modules:         modules || [],
      status:          'pending',
      agreement_text:  agreement_text || null,
    }).select().single()

    if (invErr) return NextResponse.json({ error: invErr.message }, { status: 400 })

    const signupLink = `${BASE_URL}/invite/${invite.token}`

    // Build email HTML
    const emailHtml = `
<!DOCTYPE html><html><head><meta charset="utf-8"></head>
<body style="font-family:Inter,Arial,sans-serif;margin:0;padding:0;background:#f8fafc">
<div style="max-width:600px;margin:32px auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,0.08)">
  <div style="background:linear-gradient(135deg,#1d4ed8,#7c3aed);padding:32px">
    <h1 style="color:white;margin:0;font-size:22px">You're invited to join ${org?.name} on FinAI</h1>
    <p style="color:rgba(255,255,255,0.8);margin:8px 0 0;font-size:14px">Role: ${role_name}</p>
  </div>
  <div style="padding:32px">
    <p style="color:#374151;font-size:15px">Hi ${name},</p>
    <p style="color:#374151;font-size:14px;line-height:1.6">
      ${profile?.full_name} has invited you to join <strong>${org?.name}</strong> on FinAI as <strong>${role_name}</strong>.
    </p>
    ${letter_body ? `<div style="background:#f8fafc;border-left:4px solid #1d4ed8;padding:16px 20px;margin:20px 0;border-radius:0 8px 8px 0;white-space:pre-wrap;font-size:13px;color:#374151;line-height:1.7">${letter_body}</div>` : ''}
    <p style="color:#374151;font-size:14px">Click the button below to set up your account and sign the employment agreement:</p>
    <a href="${signupLink}" style="display:inline-block;margin:16px 0;padding:14px 28px;background:#1d4ed8;color:white;text-decoration:none;border-radius:10px;font-weight:600;font-size:15px">
      Accept Invitation & Sign Up
    </a>
    <p style="color:#9ca3af;font-size:12px">This link expires in 7 days. If you did not expect this invitation, ignore this email.</p>
    <p style="color:#9ca3af;font-size:12px">Or copy this link: ${signupLink}</p>
  </div>
</div>
</body></html>`

    // Send email via Resend
    const resendRes = await fetch(RESEND_API, {
      method: 'POST',
      headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: FROM_EMAIL, to: [email],
        subject: letter_subject || `You're invited to join ${org?.name} on FinAI`,
        html: emailHtml,
      }),
    })
    const resendData = await resendRes.json()

    if (!resendRes.ok) {
      // Update status but warn about email
      await supabase.from('invitations').update({ status: 'pending' }).eq('id', invite.id)
      return NextResponse.json({
        ok: true, invite_id: invite.id, token: invite.token,
        warning: 'Invite created but email failed: ' + resendData.message + '. Share the link manually: ' + signupLink,
        link: signupLink,
      })
    }

    // Update status to sent
    await supabase.from('invitations').update({ status: 'sent' }).eq('id', invite.id)

    return NextResponse.json({ ok: true, invite_id: invite.id, token: invite.token, link: signupLink })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

// GET — fetch all invites for this org
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
    const { data: profile } = await supabase.from('profiles')
      .select('organization_id').eq('id', session.user.id).single()

    const { data } = await supabase.from('invitations')
      .select('*, role:org_roles(name), inviter:profiles!invitations_invited_by_fkey(full_name)')
      .eq('organization_id', profile!.organization_id)
      .order('created_at', { ascending: false })

    return NextResponse.json(data || [])
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

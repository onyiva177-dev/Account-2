'use client'
import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import { Shield, CheckCircle2, AlertTriangle, Eye, EyeOff, Pen } from 'lucide-react'

export default function InvitePage() {
  const params   = useParams()
  const router   = useRouter()
  const token    = params.token as string
  const supabase = createClient()

  const [invite,  setInvite]  = useState<any>(null)
  const [step,    setStep]    = useState<'loading'|'error'|'signup'|'agreement'|'done'>('loading')
  const [error,   setError]   = useState('')
  const [saving,  setSaving]  = useState(false)
  const [signed,  setSigned]  = useState(false)
  const [showPw,  setShowPw]  = useState(false)
  const [form,    setForm]    = useState({ full_name:'', password:'', confirm:'' })

  useEffect(() => { loadInvite() }, [token])

  const loadInvite = async () => {
    const { data, error: rpcErr } = await supabase.rpc('fn_get_invite_by_token', { p_token: token })
    if (rpcErr || !data || data.length === 0) {
      setError('This invite link is invalid or has expired. Ask your manager to send a new one.')
      setStep('error'); return
    }
    const inv = data[0]
    setInvite(inv)
    setForm(p => ({ ...p, full_name: inv.name || '' }))
    setStep('signup')
  }

  const handleSignup = async () => {
    if (!form.full_name.trim()) { setError('Enter your full name'); return }
    if (form.password.length < 6) { setError('Password must be at least 6 characters'); return }
    if (form.password !== form.confirm) { setError('Passwords do not match'); return }
    setSaving(true); setError('')

    const { data: authData, error: authErr } = await supabase.auth.signUp({
      email: invite.email, password: form.password,
      options: { data: { full_name: form.full_name } },
    })
    if (authErr) { setError(authErr.message); setSaving(false); return }
    if (!authData.user) { setError('Sign up failed'); setSaving(false); return }

    const { error: profileErr } = await supabase.from('profiles').insert({
      id:              authData.user.id,
      organization_id: invite.organization_id,
      full_name:       form.full_name,
      email:           invite.email,
      role:            'employee',
      invitation_id:   invite.id,
    })
    if (profileErr && !profileErr.message.includes('duplicate')) {
      setError('Profile setup failed: ' + profileErr.message); setSaving(false); return
    }

    await supabase.from('invitations').update({
      status: 'accepted', accepted_at: new Date().toISOString(),
    }).eq('id', invite.id)

    setSaving(false)
    if (invite.agreement_text) setStep('agreement')
    else { await completeInvite(authData.user.id); setStep('done') }
  }

  const completeInvite = async (userId?: string) => {
    let uid = userId
    if (!uid) {
      const { data: { user } } = await supabase.auth.getUser()
      uid = user?.id
    }
    if (!uid) return

    // Assign org role
    if (invite.role_id) {
      await supabase.from('profiles').update({ org_role_id: invite.role_id }).eq('id', uid)
    }

    // If specific modules were assigned, set them on the profile
    if (invite.modules && invite.modules.length > 0) {
      await supabase.from('profiles').update({
        org_permissions: { enabled_modules: invite.modules }
      }).eq('id', uid)
    }

    await supabase.from('invitations').update({
      status: 'signed', signed_at: new Date().toISOString(),
    }).eq('id', invite.id)
  }

  const handleSign = async () => {
    if (!signed) { setError('You must check the box to agree'); return }
    setSaving(true); setError('')
    await completeInvite()
    setSaving(false); setStep('done')
  }

  const iStyle: React.CSSProperties = {
    width:'100%', padding:'11px 14px', borderRadius:10,
    border:'1px solid #e2e8f0', fontSize:14, outline:'none',
    background:'#fafafa', color:'#0f172a', boxSizing:'border-box',
  }
  const bStyle: React.CSSProperties = {
    width:'100%', padding:'13px 0', background:'#1d4ed8', color:'white',
    border:'none', borderRadius:10, fontWeight:700, fontSize:15,
    cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', gap:8,
  }

  if (step === 'loading') return (
    <div style={{ minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center', background:'#f8fafc' }}>
      <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:16 }}>
        <div style={{ width:40, height:40, border:'4px solid #bfdbfe', borderTopColor:'#2563eb', borderRadius:'50%', animation:'spin 0.8s linear infinite' }}/>
        <p style={{ color:'#64748b', fontSize:14 }}>Loading your invitation…</p>
        <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      </div>
    </div>
  )

  if (step === 'error') return (
    <div style={{ minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center', padding:24, background:'#f8fafc', fontFamily:'Inter,system-ui,sans-serif' }}>
      <div style={{ maxWidth:440, width:'100%', background:'white', borderRadius:16, padding:40, textAlign:'center', boxShadow:'0 4px 24px rgba(0,0,0,0.08)' }}>
        <AlertTriangle size={40} style={{ color:'#f59e0b', margin:'0 auto 16px' }}/>
        <h2 style={{ fontWeight:700, fontSize:20, color:'#0f172a', marginBottom:8 }}>Invite Not Found</h2>
        <p style={{ color:'#64748b', fontSize:14, lineHeight:1.6 }}>{error}</p>
      </div>
    </div>
  )

  if (step === 'done') return (
    <div style={{ minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center', padding:24, background:'#f8fafc', fontFamily:'Inter,system-ui,sans-serif' }}>
      <div style={{ maxWidth:440, width:'100%', background:'white', borderRadius:16, padding:40, textAlign:'center', boxShadow:'0 4px 24px rgba(0,0,0,0.08)' }}>
        <div style={{ width:64, height:64, background:'#d1fae5', borderRadius:'50%', display:'flex', alignItems:'center', justifyContent:'center', margin:'0 auto 20px' }}>
          <CheckCircle2 size={32} style={{ color:'#059669' }}/>
        </div>
        <h2 style={{ fontWeight:700, fontSize:22, color:'#0f172a', marginBottom:8 }}>Welcome to {invite?.org_name}!</h2>
        <p style={{ color:'#64748b', fontSize:14, lineHeight:1.6, marginBottom:24 }}>
          Your account is set up{invite?.agreement_text ? ' and agreement signed' : ''}. Log in to start using FinAI.
        </p>
        <button onClick={() => router.push('/login')} style={bStyle}>Go to Login</button>
      </div>
    </div>
  )

  return (
    <div style={{ minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center', padding:24, background:'#f8fafc', fontFamily:'Inter,system-ui,sans-serif' }}>
      <div style={{ maxWidth:520, width:'100%', background:'white', borderRadius:16, overflow:'hidden', boxShadow:'0 4px 24px rgba(0,0,0,0.08)' }}>

        <div style={{ background:'linear-gradient(135deg,#1d4ed8,#7c3aed)', padding:'28px 32px' }}>
          <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:12 }}>
            <div style={{ width:36, height:36, background:'rgba(255,255,255,0.2)', borderRadius:10, display:'flex', alignItems:'center', justifyContent:'center' }}>
              <Shield size={18} color="white"/>
            </div>
            <span style={{ color:'white', fontWeight:700, fontSize:16 }}>FinAI</span>
          </div>
          <h1 style={{ color:'white', fontWeight:700, fontSize:20, margin:'0 0 4px' }}>
            {step === 'signup' ? `You've been invited to ${invite?.org_name}` : 'Employment Agreement'}
          </h1>
          <p style={{ color:'rgba(255,255,255,0.75)', fontSize:13, margin:0 }}>
            {step === 'signup'
              ? `Role: ${invite?.role_name} · Invited by ${invite?.invited_by_name}`
              : 'Please read carefully and sign below'}
          </p>
        </div>

        <div style={{ padding:'28px 32px' }}>
          {error && (
            <div style={{ background:'#fef2f2', border:'1px solid #fca5a5', borderRadius:10, padding:'10px 14px', marginBottom:16, color:'#dc2626', fontSize:13 }}>
              {error}
            </div>
          )}

          {step === 'signup' && (
            <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
              <div style={{ background:'#f0fdf4', border:'1px solid #86efac', borderRadius:10, padding:'10px 14px', fontSize:13, color:'#166534' }}>
                Signing up as <strong>{invite?.email}</strong>
              </div>
              <div>
                <label style={{ display:'block', fontSize:12, fontWeight:600, color:'#64748b', marginBottom:6 }}>FULL NAME</label>
                <input value={form.full_name} onChange={e=>setForm(p=>({...p,full_name:e.target.value}))} placeholder="Your full name" style={iStyle}/>
              </div>
              <div>
                <label style={{ display:'block', fontSize:12, fontWeight:600, color:'#64748b', marginBottom:6 }}>CREATE PASSWORD</label>
                <div style={{ position:'relative' }}>
                  <input type={showPw?'text':'password'} value={form.password} onChange={e=>setForm(p=>({...p,password:e.target.value}))} placeholder="Minimum 6 characters" style={{ ...iStyle, paddingRight:42 }}/>
                  <button type="button" onClick={()=>setShowPw(s=>!s)} style={{ position:'absolute', right:12, top:'50%', transform:'translateY(-50%)', background:'none', border:'none', cursor:'pointer', color:'#94a3b8' }}>
                    {showPw ? <EyeOff size={15}/> : <Eye size={15}/>}
                  </button>
                </div>
              </div>
              <div>
                <label style={{ display:'block', fontSize:12, fontWeight:600, color:'#64748b', marginBottom:6 }}>CONFIRM PASSWORD</label>
                <input type="password" value={form.confirm} onChange={e=>setForm(p=>({...p,confirm:e.target.value}))} placeholder="Repeat password" style={iStyle}/>
              </div>
              {invite?.modules && invite.modules.length > 0 && (
                <div style={{ background:'#f8fafc', borderRadius:10, padding:'12px 14px' }}>
                  <p style={{ fontSize:12, fontWeight:600, color:'#64748b', marginBottom:6 }}>YOUR MODULE ACCESS</p>
                  <div style={{ display:'flex', flexWrap:'wrap', gap:6 }}>
                    {(invite.modules as string[]).map((m:string) => (
                      <span key={m} style={{ background:'#dbeafe', color:'#1d4ed8', padding:'2px 10px', borderRadius:20, fontSize:12, fontWeight:600, textTransform:'capitalize' }}>{m}</span>
                    ))}
                  </div>
                </div>
              )}
              <button onClick={handleSignup} disabled={saving} style={{ ...bStyle, marginTop:4 }}>
                {saving ? 'Setting up account…' : invite?.agreement_text ? 'Continue to Agreement →' : 'Create Account & Join'}
              </button>
            </div>
          )}

          {step === 'agreement' && (
            <div style={{ display:'flex', flexDirection:'column', gap:16 }}>
              <p style={{ fontSize:14, color:'#374151' }}>Read the employment agreement carefully before signing.</p>
              <div style={{ background:'#f8fafc', border:'1px solid #e2e8f0', borderRadius:10, padding:'16px 18px', maxHeight:320, overflowY:'auto', fontSize:13, color:'#374151', lineHeight:1.8, whiteSpace:'pre-wrap' }}>
                {invite?.agreement_text}
              </div>
              <label style={{ display:'flex', alignItems:'flex-start', gap:10, cursor:'pointer', padding:'12px 14px', background:'#fafafa', borderRadius:10, border:`1.5px solid ${signed?'#1d4ed8':'#e2e8f0'}` }}>
                <input type="checkbox" checked={signed} onChange={e=>setSigned(e.target.checked)} style={{ width:18, height:18, marginTop:1, accentColor:'#1d4ed8', flexShrink:0 }}/>
                <span style={{ fontSize:13, color:'#374151', lineHeight:1.6 }}>
                  I, <strong>{form.full_name}</strong>, have read and agree to the terms of this employment agreement with <strong>{invite?.org_name}</strong>.
                </span>
              </label>
              <div style={{ display:'flex', gap:10 }}>
                <button onClick={()=>setStep('signup')} style={{ flex:1, padding:'11px 0', background:'#f8fafc', color:'#374151', border:'1px solid #e2e8f0', borderRadius:10, fontWeight:600, fontSize:14, cursor:'pointer' }}>
                  Back
                </button>
                <button onClick={handleSign} disabled={!signed||saving} style={{ ...bStyle, flex:2, opacity:signed?1:0.5, cursor:signed?'pointer':'not-allowed' }}>
                  <Pen size={14}/>
                  {saving ? 'Signing…' : 'Sign & Complete Setup'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

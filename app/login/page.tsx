'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import toast from 'react-hot-toast'
import { BarChart3, Shield, Zap, Globe, ArrowRight, Eye, EyeOff } from 'lucide-react'
import { SECTORS } from '@/lib/utils'

type AuthMode = 'signin' | 'signup' | 'reset'

export default function LoginPage() {
  const router   = useRouter()
  const supabase = createClient()
  const [mode, setMode]         = useState<AuthMode>('signin')
  const [loading, setLoading]   = useState(false)
  const [loadingMsg, setLoadingMsg] = useState('Processing…')
  const [showPass, setShowPass] = useState(false)
  const [form, setForm] = useState({
    email: '', password: '', full_name: '', org_name: '', sector: 'business',
  })

  const update = (k: string, v: string) => setForm(p => ({ ...p, [k]: v }))

  // ── Sign In ──────────────────────────────────────────────────────
  const handleSignIn = async () => {
    if (!form.email || !form.password) return toast.error('Fill in all fields')
    setLoading(true)
    setLoadingMsg('Signing you in…')
    const { error } = await supabase.auth.signInWithPassword({
      email: form.email, password: form.password,
    })
    if (error) toast.error(error.message)
    else { toast.success('Welcome back!'); router.push('/dashboard') }
    setLoading(false)
  }

  // ── Sign Up ──────────────────────────────────────────────────────
  const handleSignUp = async () => {
    if (!form.email || !form.password || !form.full_name || !form.org_name)
      return toast.error('Fill in all fields')
    if (form.password.length < 6)
      return toast.error('Password must be at least 6 characters')

    setLoading(true)
    setLoadingMsg('Creating your account…')

    // ── 1. Create auth user ────────────────────────────────────────
    const { data, error: authError } = await supabase.auth.signUp({
      email: form.email,
      password: form.password,
      options: { data: { full_name: form.full_name } },
    })

    if (authError) {
      toast.error(authError.message)
      setLoading(false)
      return
    }

    if (!data.user) {
      toast.error('Signup failed — please try again')
      setLoading(false)
      return
    }

    // ── 2. Create organisation ─────────────────────────────────────
    // RLS policy "allow_signup_insert_org" allows any authenticated user
    setLoadingMsg('Setting up your organisation…')
    const { data: org, error: orgError } = await supabase
      .from('organizations')
      .insert({
        name: form.org_name,
        sector: form.sector,
        country: 'KE',
        base_currency: 'KES',
        settings: {},
      })
      .select()
      .single()

    if (orgError) {
      // Org failed — sign out the orphaned auth user so they can retry cleanly
      await supabase.auth.signOut()
      toast.error('Could not create organisation: ' + orgError.message)
      setLoading(false)
      return
    }

    // ── 3. Create profile linked to org ───────────────────────────
    // RLS policy "allow_signup_insert_profile" allows user to insert own row
    const { error: profileError } = await supabase
      .from('profiles')
      .insert({
        id: data.user.id,
        organization_id: org.id,
        full_name: form.full_name,
        email: form.email,
        role: 'super_admin',
      })

    if (profileError) {
      // Profile failed — sign out so user doesn't land in a ghost session
      await supabase.auth.signOut()
      toast.error('Could not create profile: ' + profileError.message)
      setLoading(false)
      return
    }

    // ── 4. Seed via SECURITY DEFINER RPCs (bypass RLS, runs as DB owner) ──
    setLoadingMsg('Seeding default data…')
    await supabase.rpc('seed_default_coa',     { org_id: org.id })
    await supabase.rpc('seed_default_modules', { org_id: org.id })
    await supabase.rpc('seed_default_tax',     { org_id: org.id })

    toast.success('Account created! Signing you in…')

    // ── 5. Auto sign in ────────────────────────────────────────────
    setLoadingMsg('Signing you in…')
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: form.email, password: form.password,
    })

    if (!signInError) {
      router.push('/dashboard')
    } else {
      // Email verification is on — ask them to verify then sign in manually
      toast.success('Check your email to verify your account, then sign in.')
      setMode('signin')
    }

    setLoading(false)
  }

  // ── Reset Password ───────────────────────────────────────────────
  const handleReset = async () => {
    if (!form.email) return toast.error('Enter your email')
    setLoading(true)
    setLoadingMsg('Sending reset link…')
    const { error } = await supabase.auth.resetPasswordForEmail(form.email, {
      redirectTo: `${window.location.origin}/dashboard`,
    })
    if (error) toast.error(error.message)
    else toast.success('Reset link sent to your email')
    setLoading(false)
  }

  const features = [
    { icon: <BarChart3 size={18} />, text: 'AI-powered financial insights' },
    { icon: <Shield size={18} />,    text: 'Bank-level security & audit trails' },
    { icon: <Zap size={18} />,       text: 'Auto journal entries & reports' },
    { icon: <Globe size={18} />,     text: 'Multi-currency & KRA-compliant' },
  ]

  return (
    <div className="min-h-screen flex">
      {/* ── Left brand panel ── */}
      <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden" style={{
        background: 'linear-gradient(145deg, #0c4a6e 0%, #0369a1 40%, #7e22ce 100%)'
      }}>
        <div className="absolute inset-0 opacity-10" style={{
          backgroundImage: 'radial-gradient(circle at 20% 50%, white 1px, transparent 1px), radial-gradient(circle at 80% 80%, white 1px, transparent 1px)',
          backgroundSize: '40px 40px',
        }} />
        <div className="relative z-10 flex flex-col justify-between p-14 text-white">
          <div>
            <div className="flex items-center gap-3 mb-16">
              <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
                <BarChart3 size={20} />
              </div>
              <span className="text-xl font-semibold tracking-tight">FinAI</span>
            </div>
            <h1 className="font-display text-5xl font-bold leading-tight mb-6">
              Smart<br />Accounting<br />Simplified.
            </h1>
            <p className="text-blue-100 text-lg leading-relaxed max-w-sm">
              AI-assisted financial management for businesses, schools, hospitals, and more.
            </p>
          </div>
          <div className="space-y-4">
            {features.map((f, i) => (
              <div key={i} className="flex items-center gap-3 text-blue-100">
                <div className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center flex-shrink-0">
                  {f.icon}
                </div>
                <span className="text-sm">{f.text}</span>
              </div>
            ))}
            <div className="mt-8 p-5 rounded-2xl bg-white/10 border border-white/20">
              <p className="text-sm text-blue-100 italic">
                "FinAI transformed our school's accounting — journal entries are auto-generated and reports take seconds."
              </p>
              <div className="mt-3 flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center text-xs">JM</div>
                <div>
                  <p className="text-xs font-medium">Jane Mwangi</p>
                  <p className="text-xs text-blue-200">Finance Director, Nairobi Academy</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Right form panel ── */}
      <div className="flex-1 flex items-center justify-center p-6 lg:p-16 bg-white">
        <div className="w-full max-w-md animate-fade-up">
          {/* Mobile logo */}
          <div className="lg:hidden flex items-center gap-2 mb-8">
            <div className="w-8 h-8 bg-brand-600 rounded-lg flex items-center justify-center">
              <BarChart3 size={16} className="text-white" />
            </div>
            <span className="text-lg font-bold text-slate-900">FinAI</span>
          </div>

          <h2 className="text-2xl font-semibold text-slate-900 mb-1">
            {mode === 'signin' ? 'Welcome back' : mode === 'signup' ? 'Create your account' : 'Reset password'}
          </h2>
          <p className="text-slate-500 text-sm mb-8">
            {mode === 'signin'  ? 'Sign in to your organisation'   :
             mode === 'signup'  ? 'Get started for free today'     :
             "We'll send you a reset link"}
          </p>

          <div className="space-y-4">
            {mode === 'signup' && (
              <>
                <div>
                  <label className="input-label">Full Name</label>
                  <input className="input" placeholder="Jane Mwangi"
                    value={form.full_name} onChange={e => update('full_name', e.target.value)} />
                </div>
                <div>
                  <label className="input-label">Organisation Name</label>
                  <input className="input" placeholder="Nairobi Academy Ltd"
                    value={form.org_name} onChange={e => update('org_name', e.target.value)} />
                </div>
                <div>
                  <label className="input-label">Sector</label>
                  <select className="input" value={form.sector} onChange={e => update('sector', e.target.value)}>
                    {SECTORS.map(s => (
                      <option key={s.value} value={s.value}>{s.icon} {s.label}</option>
                    ))}
                  </select>
                </div>
              </>
            )}

            <div>
              <label className="input-label">Email</label>
              <input className="input" type="email" placeholder="jane@example.com"
                value={form.email} onChange={e => update('email', e.target.value)}
                onKeyDown={e => e.key === 'Enter' && mode === 'signin' && handleSignIn()} />
            </div>

            {mode !== 'reset' && (
              <div>
                <label className="input-label">Password</label>
                <div className="relative">
                  <input className="input pr-10"
                    type={showPass ? 'text' : 'password'}
                    placeholder="Minimum 6 characters"
                    value={form.password}
                    onChange={e => update('password', e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && mode === 'signin' && handleSignIn()} />
                  <button type="button"
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                    onClick={() => setShowPass(s => !s)}>
                    {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
                {mode === 'signin' && (
                  <button className="text-xs text-brand-600 hover:underline mt-1 float-right"
                    onClick={() => setMode('reset')}>
                    Forgot password?
                  </button>
                )}
              </div>
            )}

            <button
              className="btn-primary w-full justify-center py-3 text-base mt-2"
              onClick={mode === 'signin' ? handleSignIn : mode === 'signup' ? handleSignUp : handleReset}
              disabled={loading}
            >
              {loading ? (
                <span className="flex items-center gap-2">
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  {loadingMsg}
                </span>
              ) : (
                <>
                  {mode === 'signin'  ? 'Sign In'         :
                   mode === 'signup'  ? 'Create Account'  :
                   'Send Reset Link'}
                  <ArrowRight size={16} />
                </>
              )}
            </button>
          </div>

          <p className="text-sm text-slate-500 text-center mt-6">
            {mode === 'signin' ? (
              <>Don&apos;t have an account?{' '}
                <button className="text-brand-600 font-medium hover:underline"
                  onClick={() => setMode('signup')}>Sign up free</button>
              </>
            ) : (
              <>Already have an account?{' '}
                <button className="text-brand-600 font-medium hover:underline"
                  onClick={() => setMode('signin')}>Sign in</button>
              </>
            )}
          </p>
        </div>
      </div>
    </div>
  )
}

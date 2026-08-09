'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import toast from 'react-hot-toast'
import { BarChart3, Shield, Zap, Globe, ArrowRight, Eye, EyeOff } from 'lucide-react'

type Mode = 'signin' | 'signup' | 'reset'

// Sector → default modules mapping (Improvement 6)
const SECTOR_MODULES: Record<string, string[]> = {
  school:         ['accounting','transactions','contacts','payroll','budgeting','reports'],
  hospital:       ['accounting','transactions','contacts','payroll','inventory','budgeting','reports'],
  retail:         ['accounting','transactions','contacts','inventory','pos','banking','analytics'],
  manufacturing:  ['accounting','transactions','contacts','inventory','payroll','banking','budgeting','analytics'],
  ngo:            ['accounting','transactions','contacts','payroll','budgeting','reports'],
  government:     ['accounting','transactions','contacts','payroll','tax','budgeting','reports'],
  hospitality:    ['accounting','transactions','contacts','inventory','pos','banking','payroll'],
  transport:      ['accounting','transactions','contacts','banking','payroll','analytics'],
  agriculture:    ['accounting','transactions','contacts','inventory','banking','budgeting'],
  business:       ['accounting','transactions','contacts','banking','analytics'],
  other:          ['accounting','transactions','contacts'],
}

const SECTORS = [
  { value: 'business',      label: 'Business / General',    icon: '🏢' },
  { value: 'school',        label: 'School / Education',    icon: '🎓' },
  { value: 'hospital',      label: 'Hospital / Clinic',     icon: '🏥' },
  { value: 'retail',        label: 'Retail / Shop',         icon: '🛒' },
  { value: 'manufacturing', label: 'Manufacturing',         icon: '🏭' },
  { value: 'ngo',           label: 'NGO / Non-profit',      icon: '🤝' },
  { value: 'government',    label: 'Government / County',   icon: '🏛️' },
  { value: 'hospitality',   label: 'Hotel / Restaurant',    icon: '🍽️' },
  { value: 'transport',     label: 'Transport / Logistics', icon: '🚛' },
  { value: 'agriculture',   label: 'Agriculture / Farm',    icon: '🌾' },
  { value: 'other',         label: 'Other',                 icon: '📋' },
]

const FEATURES = [
  { icon: <BarChart3 size={16} />, text: 'AI-powered financial insights' },
  { icon: <Shield     size={16} />, text: 'Bank-level security & audit trails' },
  { icon: <Zap        size={16} />, text: 'Auto journal entries & reports' },
  { icon: <Globe      size={16} />, text: 'Multi-currency & KRA-compliant' },
]

export default function LoginPage() {
  const router   = useRouter()
  const supabase = createClient()
  const [mode, setMode]       = useState<Mode>('signin')
  const [loading, setLoading] = useState(false)
  const [showPw, setShowPw]   = useState(false)
  const [form, setForm] = useState({
    email: '', password: '', full_name: '', org_name: '', sector: 'business',
  })

  const upd = (k: string, v: string) => setForm(p => ({ ...p, [k]: v }))

  // ── Sign In ─────────────────────────────────────────────────────
  const handleSignIn = async () => {
    if (!form.email || !form.password) { toast.error('Fill in all fields'); return }
    setLoading(true)
    const { error } = await supabase.auth.signInWithPassword({
      email: form.email, password: form.password,
    })
    if (error) { toast.error(error.message); setLoading(false); return }

    // Log login activity
    fetch('/api/log', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'login', page: '/login' }),
    }).catch(() => {})

    toast.success('Welcome back!')
    router.push('/dashboard')
    setLoading(false)
  }

  // ── Sign Up (sector-aware) ──────────────────────────────────────
  const handleSignUp = async () => {
    if (!form.email || !form.password || !form.full_name || !form.org_name)
      return toast.error('Fill in all fields')
    if (form.password.length < 6)
      return toast.error('Password must be at least 6 characters')

    setLoading(true)

    // 1. Create auth user
    const { data, error: authError } = await supabase.auth.signUp({
      email: form.email,
      password: form.password,
      options: { data: { full_name: form.full_name } },
    })
    if (authError) { toast.error(authError.message); setLoading(false); return }
    if (!data.user) { toast.error('Sign up failed'); setLoading(false); return }

    // 2. Create organisation
    const { data: org, error: orgError } = await supabase
      .from('organizations')
      .insert({
        name:          form.org_name,
        sector:        form.sector,
        country:       'KE',
        base_currency: 'KES',
        settings:      {},
      })
      .select()
      .single()

    if (orgError) { toast.error('Could not create organisation: ' + orgError.message); setLoading(false); return }

    // 3. Create profile
    await supabase.from('profiles').insert({
      id:              data.user.id,
      organization_id: org.id,
      full_name:       form.full_name,
      email:           form.email,
      role:            'super_admin',
    })

    // 4. Seed COA, modules and tax policies
    await supabase.rpc('seed_default_coa',     { org_id: org.id })
    await supabase.rpc('seed_default_tax',     { org_id: org.id })

    // 5. Sector-aware module defaults (Improvement 6)
    const sectorModules = SECTOR_MODULES[form.sector] || SECTOR_MODULES.business
    await supabase.from('organizations').update({
      settings: { enabled_modules: sectorModules }
    }).eq('id', org.id)

    // 6. Seed org roles for this new org
    await supabase.rpc('seed_default_modules', { org_id: org.id })

    // 7. Set up monthly report schedule
    await supabase.from('report_schedules').insert({
      organization_id: org.id,
      report_type:     'monthly_transactions',
      recipient_email: form.email,
      is_active:       true,
    })

    // 8. Seed org roles
    const rolePayloads = [
      { name:'Owner',      slug:'owner',      permissions:{ modules:'all', can_delete:true, can_manage_users:true, can_view_reports:true }, is_system:true },
      { name:'Manager',    slug:'manager',    permissions:{ modules:sectorModules, can_delete:false, can_manage_users:false, can_view_reports:true }, is_system:true },
      { name:'Accountant', slug:'accountant', permissions:{ modules:['accounting','transactions','contacts','banking'], can_delete:false, can_manage_users:false, can_view_reports:true }, is_system:true },
      { name:'Cashier',    slug:'cashier',    permissions:{ modules:['pos','inventory','contacts'], can_delete:false, can_manage_users:false, can_view_reports:false }, is_system:true },
      { name:'Viewer',     slug:'viewer',     permissions:{ modules:['analytics','reports'], can_delete:false, can_manage_users:false, can_view_reports:true }, is_system:true },
    ]
    await supabase.from('org_roles').insert(
      rolePayloads.map(r => ({ ...r, organization_id: org.id }))
    )

    // 9. Auto sign in
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: form.email, password: form.password,
    })

    if (!signInError) {
      toast.success(`Welcome to FinAI, ${form.full_name.split(' ')[0]}!`)
      router.push('/dashboard')
    } else {
      toast.success('Account created! Check your email then sign in.')
      setMode('signin')
    }
    setLoading(false)
  }

  // ── Reset ───────────────────────────────────────────────────────
  const handleReset = async () => {
    if (!form.email) { toast.error('Enter your email'); return }
    setLoading(true)
    const { error } = await supabase.auth.resetPasswordForEmail(form.email, {
      redirectTo: `${window.location.origin}/dashboard`,
    })
    if (error) { toast.error(error.message); setLoading(false); return }
    toast.success('Reset link sent to your email')
    setLoading(false)
  }

  const submit = mode === 'signin' ? handleSignIn : mode === 'signup' ? handleSignUp : handleReset

  return (
    <div className="min-h-screen flex">
      {/* ── Left brand panel ── */}
      <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden flex-col justify-between p-14"
        style={{ background: 'linear-gradient(145deg,#0c4a6e 0%,#0369a1 40%,#7e22ce 100%)' }}>
        <div className="absolute inset-0 opacity-10" style={{
          backgroundImage: 'radial-gradient(circle at 20% 50%,white 1px,transparent 1px),radial-gradient(circle at 80% 80%,white 1px,transparent 1px)',
          backgroundSize: '40px 40px',
        }} />
        <div className="relative z-10">
          <div className="flex items-center gap-3 mb-16">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center"
              style={{ background: 'rgba(255,255,255,0.2)' }}>
              <BarChart3 size={20} className="text-white" />
            </div>
            <span className="text-xl font-semibold text-white tracking-tight">FinAI</span>
          </div>
          <h1 className="text-5xl font-bold text-white leading-tight mb-6">
            Smart<br />Accounting<br />Simplified.
          </h1>
          <p className="text-blue-100 text-lg leading-relaxed max-w-sm">
            AI-assisted financial management built for Kenyan businesses, schools, hospitals, and more.
          </p>
        </div>
        <div className="relative z-10 space-y-4">
          {FEATURES.map((f, i) => (
            <div key={i} className="flex items-center gap-3 text-blue-100">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                style={{ background: 'rgba(255,255,255,0.1)' }}>
                {f.icon}
              </div>
              <span className="text-sm">{f.text}</span>
            </div>
          ))}
        </div>
      </div>

      {/* ── Right form panel ── */}
      <div className="flex-1 flex items-center justify-center p-6 lg:p-16 bg-white overflow-y-auto">
        <div className="w-full max-w-md animate-fade-up">

          {/* Mobile logo */}
          <div className="lg:hidden flex items-center gap-2 mb-8">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center"
              style={{ background: 'var(--brand)' }}>
              <BarChart3 size={16} className="text-white" />
            </div>
            <span className="text-lg font-bold text-slate-900">FinAI</span>
          </div>

          <h2 className="text-2xl font-semibold text-slate-900 mb-1">
            {mode === 'signin' ? 'Welcome back' : mode === 'signup' ? 'Create your account' : 'Reset password'}
          </h2>
          <p className="text-slate-500 text-sm mb-8">
            {mode === 'signin'  ? 'Sign in to your organisation'
           : mode === 'signup'  ? 'Get started for free today'
           : "We'll send you a reset link"}
          </p>

          <div className="space-y-4">
            {/* Sign Up only fields */}
            {mode === 'signup' && (
              <>
                <div>
                  <label className="input-label">Full Name</label>
                  <input className="input" placeholder="Evans Onjiri"
                    value={form.full_name} onChange={e => upd('full_name', e.target.value)} />
                </div>
                <div>
                  <label className="input-label">Organisation Name</label>
                  <input className="input" placeholder="Dairy Mbuzi Ltd"
                    value={form.org_name} onChange={e => upd('org_name', e.target.value)} />
                </div>

                {/* Sector selector with icons */}
                <div>
                  <label className="input-label">Sector</label>
                  <select className="input" value={form.sector} onChange={e => upd('sector', e.target.value)}>
                    {SECTORS.map(s => (
                      <option key={s.value} value={s.value}>{s.icon} {s.label}</option>
                    ))}
                  </select>
                  {/* Show which modules will be enabled */}
                  <div className="mt-2 p-2.5 rounded-lg text-xs" style={{ background: '#f0f9ff', border: '1px solid #bae6fd' }}>
                    <span className="font-semibold text-blue-700">Modules pre-selected for your sector: </span>
                    <span className="text-blue-600">
                      {(SECTOR_MODULES[form.sector] || []).join(', ')}
                    </span>
                  </div>
                </div>
              </>
            )}

            {/* Email */}
            <div>
              <label className="input-label">Email</label>
              <input className="input" type="email" placeholder="you@example.com"
                value={form.email} onChange={e => upd('email', e.target.value)}
                onKeyDown={e => e.key === 'Enter' && mode === 'signin' && submit()} />
            </div>

            {/* Password */}
            {mode !== 'reset' && (
              <div>
                <label className="input-label">Password</label>
                <div className="relative">
                  <input className="input pr-10"
                    type={showPw ? 'text' : 'password'}
                    placeholder="Minimum 6 characters"
                    value={form.password}
                    onChange={e => upd('password', e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && mode === 'signin' && submit()} />
                  <button type="button" onClick={() => setShowPw(s => !s)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                    {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
                {mode === 'signin' && (
                  <button className="text-xs float-right mt-1 hover:underline"
                    style={{ color: 'var(--brand)' }}
                    onClick={() => setMode('reset')}>
                    Forgot password?
                  </button>
                )}
              </div>
            )}

            <button className="btn-primary w-full justify-center py-3 mt-2 text-base"
              onClick={submit} disabled={loading}>
              {loading
                ? <span className="flex items-center gap-2">
                    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    {mode === 'signup' ? 'Setting up your account…' : 'Processing…'}
                  </span>
                : <>{mode === 'signin' ? 'Sign In' : mode === 'signup' ? 'Create Account' : 'Send Reset Link'}<ArrowRight size={16} /></>}
            </button>
          </div>

          <p className="text-sm text-slate-500 text-center mt-6">
            {mode === 'signin' ? (
              <>Don&apos;t have an account?{' '}
                <button className="font-medium hover:underline" style={{ color: 'var(--brand)' }}
                  onClick={() => setMode('signup')}>Sign up free</button>
              </>
            ) : (
              <>Already have an account?{' '}
                <button className="font-medium hover:underline" style={{ color: 'var(--brand)' }}
                  onClick={() => setMode('signin')}>Sign in</button>
              </>
            )}
          </p>
        </div>
      </div>
    </div>
  )
}

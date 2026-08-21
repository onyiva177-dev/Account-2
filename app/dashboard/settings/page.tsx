'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'
import { useAppStore } from '@/lib/store'
import {
  Package, Users, Shield, Bell, Building2, Key,
  CheckCircle2, X, Plus, Smartphone, Mail, Lock, RefreshCw
} from 'lucide-react'
import toast from 'react-hot-toast'
import type { Sector } from '@/types'

const ALL_MODULES = [
  { key: 'accounting',   label: 'Accounting',       desc: 'Journal entries, COA, Trial Balance' },
  { key: 'transactions', label: 'Transactions',      desc: 'Invoices, bills, expenses' },
  { key: 'contacts',     label: 'Contacts',          desc: 'Customers, vendors, employees' },
  { key: 'banking',      label: 'Banking',           desc: 'Accounts & reconciliation' },
  { key: 'inventory',    label: 'Inventory',         desc: 'Products & stock levels' },
  { key: 'payroll',      label: 'Payroll',           desc: 'PAYE, NHIF, NSSF auto-calculated' },
  { key: 'tax',          label: 'Tax & Compliance',  desc: 'VAT, KRA compliance' },
  { key: 'analytics',    label: 'Analytics',         desc: 'AI-powered insights' },
  { key: 'budgeting',    label: 'Budgets',           desc: 'Budget vs actual' },
  { key: 'pos',          label: 'POS',               desc: 'Point of sale system' },
  { key: 'reports',      label: 'Reports',           desc: 'Financial statements' },
]

const TABS = [
  { key: 'organisation', label: 'Organisation', icon: Building2 },
  { key: 'modules',      label: 'Modules',      icon: Package },
  { key: 'team',         label: 'Team & Roles', icon: Users },
  { key: 'security',     label: 'Security',     icon: Shield },
  { key: 'notifications',label: 'Notifications',icon: Bell },
]

export default function SettingsPage() {
  const supabase = createClient()
  const { organization, profile, setOrganization } = useAppStore()
  const [tab, setTab]             = useState('organisation')
  const [saving, setSaving]       = useState(false)
  const [subscription, setSubscription] = useState<any>(null)
  const [tierModules, setTierModules]   = useState<string[]>([])
  const [enabledModules, setEnabledModules] = useState<string[]>([])
  const [orgRoles, setOrgRoles]     = useState<any[]>([])
  const [teamMembers, setTeamMembers] = useState<any[]>([])
  const [allTiers, setAllTiers]     = useState<any[]>([])

  // Org form
  const [orgForm, setOrgForm] = useState<{ name:string; sector:Sector; country:string; tax_id:string }>({
    name: '', sector: 'business', country: 'KE', tax_id: '',
  })

  // Security
  const [pwForm, setPwForm]           = useState({ newPw: '', confirm: '' })
  const [archivePw, setArchivePw]     = useState('')
  const [archiveConfirm, setArchiveConfirm] = useState('')

  // Notifications
  const [notifForm, setNotifForm] = useState({ monthly_report: true, report_email: '' })

  // Payment modal
  const [showPayment, setShowPayment]   = useState(false)
  const [selectedTier, setSelectedTier] = useState<any>(null)
  const [phone, setPhone]               = useState('')
  const [payLoading, setPayLoading]     = useState(false)
  const [checkoutId, setCheckoutId]     = useState('')
  const [polling, setPolling]           = useState(false)

  // Invite
  const [invites, setInvites]             = useState<any[]>([])
  const [templates, setTemplates]         = useState<any[]>([])
  const [showInvite, setShowInvite]       = useState(false)
  const [inviteStep, setInviteStep]       = useState<'form'|'letter'|'done'>('form')
  const [inviteLink, setInviteLink]       = useState('')
  const [inviteForm, setInviteForm]       = useState({ email:'', name:'', role_id:'', modules:[] as string[], use_letter:false })
  const [letterForm, setLetterForm]       = useState({ subject:'', body:'', agreement:'' })
  const [inviteSaving, setInviteSaving]   = useState(false)
  const [showTemplate, setShowTemplate]   = useState(false)
  const [templateForm, setTemplateForm]   = useState({ name:'', subject:'', body:'', type:'offer_letter' })
  const [templateSaving, setTemplateSaving] = useState(false)

  useEffect(() => {
    if (organization) {
      setOrgForm({
        name:    organization.name || '',
        sector:  ((organization as any).sector || 'business') as Sector,
        country: organization.country || 'KE',
        tax_id:  (organization as any).tax_id || '',
      })
      loadAll()
    }
  }, [organization])

  const loadAll = async () => {
    const orgId = organization!.id

    // Load subscription + tier
    const { data: sub } = await supabase
      .from('org_subscriptions')
      .select('*, tier:tiers(*)')
      .eq('organization_id', orgId)
      .maybeSingle()       // maybeSingle so no error if no subscription
    setSubscription(sub)

    const tierMods: string[] = (sub?.tier?.enabled_modules as string[]) || []
    setTierModules(tierMods)

    // KEY FIX: enabled_modules in org settings must ONLY contain
    // modules that are ALSO in the tier. Anything extra gets stripped.
    const rawEnabled: string[] = (organization?.settings as any)?.enabled_modules || []
    // accounting is always enabled — enforce it regardless of tier
    const validEnabled = [
      ...rawEnabled.filter(m => tierMods.includes(m) || m === 'accounting'),
      ...(!rawEnabled.includes('accounting') ? ['accounting'] : []),
    ].filter((v, i, a) => a.indexOf(v) === i)  // deduplicate

    // If there is a mismatch (org has modules not in tier), fix it in DB
    if (validEnabled.length !== rawEnabled.length) {
      await supabase.from('organizations').update({
        settings: {
          ...((organization?.settings as any) || {}),
          enabled_modules: validEnabled,
        }
      }).eq('id', orgId)
      setOrganization({
        ...organization!,
        settings: { ...((organization?.settings as any) || {}), enabled_modules: validEnabled },
      })
    }

    setEnabledModules(validEnabled)

    // Load all tiers for upgrade modal
    const { data: tiers } = await supabase
      .from('tiers').select('*').eq('is_active', true).order('sort_order')
    setAllTiers(tiers || [])

    // Load org roles
    const { data: roles } = await supabase
      .from('org_roles').select('*').eq('organization_id', orgId).order('name')
    setOrgRoles(roles || [])

    // Load team
    const { data: members } = await supabase
      .from('profiles')
      .select('*, org_role:org_roles(name,slug)')
      .eq('organization_id', orgId)
    setTeamMembers(members || [])

    // Load notification schedule
    const { data: sched } = await supabase
      .from('report_schedules').select('*').eq('organization_id', orgId).maybeSingle()
    if (sched) {
      setNotifForm({ monthly_report: sched.is_active, report_email: sched.recipient_email })
    } else {
      setNotifForm({ monthly_report: false, report_email: profile?.email || '' })
    }
    // Load invitations
    const invRes = await fetch('/api/invite')
    if (invRes.ok) { const d = await invRes.json(); setInvites(Array.isArray(d) ? d : []) }
    // Load letter templates
    const { data: tmplData } = await supabase.from('letter_templates').select('*').eq('organization_id', orgId).order('created_at')
    setTemplates(tmplData || [])
  }

  // ── Save org ───────────────────────────────────────────────────
  const saveOrg = async () => {
    setSaving(true)
    const { error } = await supabase.from('organizations')
      .update(orgForm).eq('id', organization!.id)
    if (error) { toast.error(error.message); setSaving(false); return }
    setOrganization({ ...organization!, ...orgForm })
    toast.success('Saved')
    setSaving(false)
  }

  // ── Module toggle — strictly gated by tier ─────────────────────
  const toggleModule = async (key: string, currentlyEnabled: boolean) => {
    // Accounting can never be disabled — it is always free
    if (key === 'accounting') {
      toast.error('Accounting is always enabled — it is the core free module')
      return
    }
    // Hard gate: module must be in tier
    if (!tierModules.includes(key)) {
      const modLabel = ALL_MODULES.find(m => m.key === key)?.label
      toast.error(`${modLabel} is not included in your current plan. Click "Upgrade Package" to unlock it.`)
      return
    }

    const newEnabled = currentlyEnabled
      ? enabledModules.filter(m => m !== key)
      : [...enabledModules, key]

    const newSettings = {
      ...((organization?.settings as any) || {}),
      enabled_modules: newEnabled,
    }

    const { error } = await supabase.from('organizations')
      .update({ settings: newSettings }).eq('id', organization!.id)
    if (error) { toast.error(error.message); return }

    setEnabledModules(newEnabled)
    setOrganization({ ...organization!, settings: newSettings })
    toast.success(`${key} ${currentlyEnabled ? 'disabled' : 'enabled'}`)
  }

  // ── M-Pesa payment ─────────────────────────────────────────────
  const initiateMpesa = async () => {
    if (!phone || phone.replace(/\D/g,'').length < 9) {
      toast.error('Enter a valid M-Pesa number'); return
    }
    if (!selectedTier) { toast.error('Select a package'); return }
    setPayLoading(true)

    const res = await fetch('/api/mpesa', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        phone,
        tier_id:   selectedTier.id,
        tier_name: selectedTier.name,
        amount:    selectedTier.price_kes,
      }),
    })
    const data = await res.json()
    setPayLoading(false)

    if (!res.ok) {
      // Show exact error so Evans can debug M-Pesa setup
      toast.error(data.error || 'Payment failed — check M-Pesa env vars in Vercel')
      return
    }

    setCheckoutId(data.checkout_request_id)
    setPolling(true)
    toast.success('STK push sent — enter PIN on your phone')
    pollStatus(data.checkout_request_id)
  }

  const pollStatus = (cid: string) => {
    const interval = setInterval(async () => {
      const res  = await fetch(`/api/mpesa/status?checkout_id=${cid}`)
      const data = await res.json()
      if (data.status === 'completed') {
        clearInterval(interval)
        setPolling(false)
        setShowPayment(false)
        setCheckoutId('')
        toast.success(`Payment confirmed! Receipt: ${data.mpesa_receipt}`)
        loadAll()
      } else if (data.status === 'failed') {
        clearInterval(interval)
        setPolling(false)
        toast.error('Payment was cancelled or failed')
      }
    }, 3000)
    setTimeout(() => { clearInterval(interval); setPolling(false) }, 180000)
  }

  // ── Change password ────────────────────────────────────────────
  const changePassword = async () => {
    if (pwForm.newPw !== pwForm.confirm) { toast.error('Passwords do not match'); return }
    if (pwForm.newPw.length < 6) { toast.error('Minimum 6 characters'); return }
    setSaving(true)
    const { error } = await supabase.auth.updateUser({ password: pwForm.newPw })
    if (error) { toast.error(error.message); setSaving(false); return }
    toast.success('Password changed')
    setPwForm({ newPw: '', confirm: '' })
    setSaving(false)
  }

  // ── Archive password ───────────────────────────────────────────
  const setArchivePassword = async () => {
    if (archivePw !== archiveConfirm) { toast.error('Passwords do not match'); return }
    if (archivePw.length < 6) { toast.error('Minimum 6 characters'); return }
    const buf  = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(archivePw))
    const hash = Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('')
    const settings = { ...((organization?.settings as any) || {}), archive_password_hash: hash }
    await supabase.from('organizations').update({ settings }).eq('id', organization!.id)
    setOrganization({ ...organization!, settings })
    toast.success('Archive password set')
    setArchivePw(''); setArchiveConfirm('')
  }

  // ── Save notifications ─────────────────────────────────────────
  const saveNotifications = async () => {
    setSaving(true)
    const { data: existing } = await supabase.from('report_schedules')
      .select('id').eq('organization_id', organization!.id).maybeSingle()
    if (existing) {
      await supabase.from('report_schedules').update({
        is_active: notifForm.monthly_report,
        recipient_email: notifForm.report_email,
      }).eq('id', existing.id)
    } else {
      await supabase.from('report_schedules').insert({
        organization_id: organization!.id,
        report_type:     'monthly_transactions',
        recipient_email: notifForm.report_email,
        is_active:       notifForm.monthly_report,
      })
    }
    toast.success('Saved')
    setSaving(false)
  }

  // ── Invite member ──────────────────────────────────────────────
  const sendInvite = async () => {
    if (!inviteForm.email || !inviteForm.name || !inviteForm.role_id) { toast.error('Email, name and role required'); return }
    setInviteSaving(true)
    const roleName = orgRoles.find(r => r.id === inviteForm.role_id)?.name || ''
    const res = await fetch('/api/invite', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: inviteForm.email, name: inviteForm.name, role_id: inviteForm.role_id,
        role_name: roleName, modules: inviteForm.modules,
        agreement_text: letterForm.agreement || null,
        letter_subject: letterForm.subject || null,
        letter_body: letterForm.body || null,
      }),
    })
    const data = await res.json()
    setInviteSaving(false)
    if (!res.ok) { toast.error(data.error || 'Failed'); return }
    if (data.warning) toast.error('Warning: ' + data.warning)
    else toast.success('Invite sent to ' + inviteForm.email)
    setInviteLink(data.link || '')
    setInviteStep('done')
    loadAll()
  }

  const saveTemplate = async () => {
    if (!templateForm.name || !templateForm.body) { toast.error('Name and body required'); return }
    setTemplateSaving(true)
    await supabase.from('letter_templates').insert({ ...templateForm, organization_id: organization!.id })
    toast.success('Template saved'); setShowTemplate(false)
    setTemplateForm({ name:'', subject:'', body:'', type:'offer_letter' })
    setTemplateSaving(false); loadAll()
  }

  const toggleInviteMod = (m: string) => setInviteForm(p => ({
    ...p, modules: p.modules.includes(m) ? p.modules.filter(x => x !== m) : [...p.modules, m]
  }))

  const loadTemplate = (t: any) => {
    const roleName = orgRoles.find(r => r.id === inviteForm.role_id)?.name || ''
    const body = t.body.replace(/{{ORG_NAME}}/g, organization?.name||'').replace(/{{NAME}}/g, inviteForm.name).replace(/{{ROLE}}/g, roleName).replace(/{{SENDER_NAME}}/g, profile?.full_name||'')
    setLetterForm(p => ({ ...p, subject: t.subject.replace(/{{ROLE}}/g, roleName), body }))
  }

  const inviteMember = async () => {
    if (!inviteForm.email || !inviteForm.role_id) {
      toast.error('Email and role required'); return
    }
    setInviteSaving(true)
    await fetch('/api/email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        to_email:  inviteForm.email,
        subject:   `You have been invited to join ${organization?.name} on FinAI`,
        body_html: `<p>You have been invited to join <strong>${organization?.name}</strong> on FinAI.</p>
                    <p><a href="${window.location.origin}/login">Click here to sign up or log in</a></p>`,
        type: 'invite',
      }),
    })
    toast.success(`Invite sent to ${inviteForm.email}`)
    setShowInvite(false)
    setInviteForm({ email: '', role_id: '' })
    setInviteSaving(false)
  }

  const tierName  = subscription?.tier?.name || 'Free'
  const tierColor: Record<string,string> = {
    Free: '#64748b', Starter: '#2563eb', Pro: '#7c3aed', Enterprise: '#d97706'
  }

  return (
    <div className="space-y-5 animate-fade-up">
      <div>
        <h1 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>Settings</h1>
        <p className="text-sm mt-0.5" style={{ color: 'var(--text-secondary)' }}>
          Manage your organisation, team and preferences
        </p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 overflow-x-auto pb-1">
        {TABS.map(t => {
          const Icon = t.icon
          return (
            <button key={t.key} onClick={() => setTab(t.key)}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium whitespace-nowrap transition-all flex-shrink-0"
              style={{
                background: tab === t.key ? 'var(--brand)' : 'var(--bg-table-head)',
                color: tab === t.key ? '#fff' : 'var(--text-secondary)',
                border: `1px solid ${tab === t.key ? 'var(--brand)' : 'var(--border)'}`,
              }}>
              <Icon size={14} />{t.label}
            </button>
          )
        })}
      </div>

      {/* ── ORGANISATION TAB ── */}
      {tab === 'organisation' && (
        <div className="card p-5 space-y-4 max-w-lg">
          <h3 className="font-semibold text-sm" style={{ color: 'var(--text-primary)' }}>Organisation Details</h3>
          <div>
            <label className="input-label">Organisation Name</label>
            <input className="input" value={orgForm.name}
              onChange={e => setOrgForm(p => ({ ...p, name: e.target.value }))} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="input-label">Sector</label>
              <select className="input" value={orgForm.sector}
                onChange={e => setOrgForm(p => ({ ...p, sector: e.target.value as Sector }))}>
                {([
                  ['business',   'Business / General'],
                  ['retail',     'Retail / Shop'],
                  ['education',  'School / Education'],
                  ['healthcare', 'Hospital / Healthcare'],
                  ['ngo',        'NGO / Non-profit'],
                  ['government', 'Government / County'],
                ] as [Sector, string][]).map(([val, label]) => (
                  <option key={val} value={val}>{label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="input-label">Country</label>
              <select className="input" value={orgForm.country}
                onChange={e => setOrgForm(p => ({ ...p, country: e.target.value }))}>
                <option value="KE">Kenya</option>
                <option value="UG">Uganda</option>
                <option value="TZ">Tanzania</option>
                <option value="RW">Rwanda</option>
              </select>
            </div>
          </div>
          <div>
            <label className="input-label">KRA PIN / Tax ID</label>
            <input className="input" placeholder="A000000000X" value={orgForm.tax_id}
              onChange={e => setOrgForm(p => ({ ...p, tax_id: e.target.value }))} />
          </div>
          <button className="btn-primary" onClick={saveOrg} disabled={saving}>
            <CheckCircle2 size={15} />{saving ? 'Saving…' : 'Save Changes'}
          </button>
        </div>
      )}

      {/* ── MODULES TAB ── */}
      {tab === 'modules' && (
        <div className="space-y-4 max-w-2xl">

          {/* Plan card */}
          <div className="card p-4 flex items-center justify-between flex-wrap gap-3">
            <div>
              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Current Package</p>
              <p className="font-bold text-lg" style={{ color: tierColor[tierName] || '#64748b' }}>
                {tierName}
              </p>
              <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
                {tierModules.length} module{tierModules.length !== 1 ? 's' : ''} unlocked
                {subscription?.current_period_end
                  ? ` · renews ${new Date(subscription.current_period_end).toLocaleDateString('en-KE')}`
                  : ''}
              </p>
            </div>
            <button className="btn-primary" onClick={() => { setShowPayment(true); setCheckoutId(''); setSelectedTier(null) }}>
              <Package size={14} />Upgrade Package
            </button>
          </div>

          {/* Module grid — toggles locked for non-tier modules */}
          <div className="card p-4">
            <p className="text-xs font-semibold mb-4 uppercase tracking-wider"
              style={{ color: 'var(--text-muted)' }}>Module Access</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {ALL_MODULES.map(mod => {
                // accounting is always free — never locked behind a tier
                const inTier    = mod.key === 'accounting' || tierModules.includes(mod.key)
                const isEnabled = enabledModules.includes(mod.key)
                return (
                  <div key={mod.key}
                    className="flex items-center justify-between p-3 rounded-xl"
                    style={{
                      background: inTier && isEnabled
                        ? 'var(--brand-dim)' : 'var(--bg-table-head)',
                      border: `1px solid ${inTier && isEnabled ? 'var(--brand)' : 'var(--border)'}40`,
                    }}>
                    <div className="min-w-0 pr-3">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                          {mod.label}
                        </p>
                        {/* Show Upgrade badge if not in tier */}
                        {!inTier && (
                          <span className="badge text-xs"
                            style={{ background: 'var(--warning-dim)', color: 'var(--warning)' }}>
                            Upgrade
                          </span>
                        )}
                      </div>
                      <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
                        {mod.desc}
                      </p>
                    </div>

                    {/* Toggle — disabled visually and functionally if not in tier */}
                    <button
                      onClick={() => toggleModule(mod.key, isEnabled)}
                      title={!inTier ? 'Not in your plan — upgrade to unlock' : undefined}
                      style={{
                        width: 44, height: 24, borderRadius: 12, flexShrink: 0,
                        // If not in tier: always grey and OFF regardless of DB value
                        background: (inTier && isEnabled) ? 'var(--brand)' : '#cbd5e1',
                        border: 'none',
                        cursor: inTier ? 'pointer' : 'not-allowed',
                        position: 'relative', transition: 'background 0.2s',
                        opacity: inTier ? 1 : 0.5,
                      }}>
                      <span style={{
                        position: 'absolute', top: 3,
                        // Dot position: right if in-tier AND enabled, else left
                        left: (inTier && isEnabled) ? 23 : 3,
                        width: 18, height: 18, borderRadius: '50%', background: '#fff',
                        transition: 'left 0.2s',
                      }} />
                    </button>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      )}

      {/* ── TEAM & ROLES TAB ── */}
      {tab === 'team' && (
        <div className="space-y-4 max-w-3xl">
          {/* Active members */}
          <div className="card">
            <div className="px-4 py-3" style={{ borderBottom:'1px solid var(--border)' }}>
              <h3 className="font-semibold text-sm" style={{ color:'var(--text-primary)' }}>Team Members</h3>
            </div>
            <div className="table-container">
              <table className="table">
                <thead><tr><th>Member</th><th>Email</th><th>Role</th><th>Joined</th></tr></thead>
                <tbody>
                  {teamMembers.length === 0
                    ? <tr><td colSpan={4} className="text-center py-6" style={{ color:'var(--text-muted)' }}>No team members yet</td></tr>
                    : teamMembers.map(m => (
                      <tr key={m.id}>
                        <td className="font-medium text-sm">{m.full_name}</td>
                        <td className="text-xs" style={{ color:'var(--text-secondary)' }}>{m.email||'—'}</td>
                        <td><span className="badge badge-blue text-xs capitalize">{(m.org_role as any)?.name||'Owner'}</span></td>
                        <td className="text-xs" style={{ color:'var(--text-muted)' }}>{m.created_at ? new Date(m.created_at).toLocaleDateString('en-KE') : '—'}</td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Letter templates */}
          <div className="card p-4">
            <div className="flex items-center justify-between mb-3">
              <div>
                <h3 className="font-semibold text-sm" style={{ color:'var(--text-primary)' }}>Letter Templates</h3>
                <p className="text-xs mt-0.5" style={{ color:'var(--text-muted)' }}>Offer letters, contracts and NDAs for employee invites</p>
              </div>
              <button className="btn-secondary text-sm" onClick={() => setShowTemplate(true)}><Plus size={13}/>New Template</button>
            </div>
            {templates.length === 0
              ? <p className="text-sm text-center py-4" style={{ color:'var(--text-muted)' }}>No templates yet — run INVITE_SCHEMA.sql in Supabase to seed a default offer letter</p>
              : <div className="space-y-2">{templates.map((t:any) => (
                  <div key={t.id} className="flex items-center justify-between p-3 rounded-xl" style={{ background:'var(--bg-table-head)', border:'1px solid var(--border)' }}>
                    <div>
                      <p className="text-sm font-medium" style={{ color:'var(--text-primary)' }}>{t.name}</p>
                      <p className="text-xs mt-0.5 capitalize" style={{ color:'var(--text-muted)' }}>{t.type?.replace('_',' ')}</p>
                    </div>
                    {t.is_default && <span className="badge badge-green text-xs">Default</span>}
                  </div>
                ))}</div>}
          </div>

          {/* Invitations with status tracking */}
          <div className="card">
            <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom:'1px solid var(--border)' }}>
              <div>
                <h3 className="font-semibold text-sm" style={{ color:'var(--text-primary)' }}>Invitations</h3>
                <p className="text-xs mt-0.5" style={{ color:'var(--text-muted)' }}>Real emails with signup link · Status: Pending → Sent → Accepted → Signed</p>
              </div>
              <button className="btn-primary text-sm" onClick={() => { setShowInvite(true); setInviteStep('form'); setInviteForm({ email:'', name:'', role_id:'', modules:[], use_letter:false }); setLetterForm({ subject:'', body:'', agreement:'' }); setInviteLink('') }}>
                <Plus size={14}/>Invite Member
              </button>
            </div>
            {invites.length === 0
              ? <div className="p-8 text-center" style={{ color:'var(--text-muted)' }}>
                  <Mail size={28} className="mx-auto mb-2 opacity-30"/>
                  <p className="text-sm">No invitations yet</p>
                  <p className="text-xs mt-1">Employees receive a real email with a signup link and agreement to sign</p>
                </div>
              : <div className="table-container">
                  <table className="table">
                    <thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Status</th><th>Date</th><th style={{ width:'70px' }}>Actions</th></tr></thead>
                    <tbody>
                      {invites.map((inv:any) => {
                        const sts = ({
                          pending:  { label:'Pending',  bg:'#fef3c7', col:'#92400e' },
                          sent:     { label:'Sent',     bg:'#dbeafe', col:'#1e40af' },
                          accepted: { label:'Accepted', bg:'#e0f2fe', col:'#0369a1' },
                          signed:   { label:'Signed ✓', bg:'#d1fae5', col:'#065f46' },
                        } as any)[inv.status] || { label:inv.status, bg:'#f1f5f9', col:'#94a3b8' }
                        return (
                          <tr key={inv.id}>
                            <td className="font-medium text-sm">{inv.name}</td>
                            <td className="text-xs" style={{ color:'var(--text-secondary)' }}>{inv.email}</td>
                            <td><span className="badge badge-blue text-xs">{inv.role_name||(inv.role as any)?.name||'—'}</span></td>
                            <td><span className="badge text-xs" style={{ background:sts.bg, color:sts.col }}>{sts.label}</span></td>
                            <td className="text-xs" style={{ color:'var(--text-muted)' }}>
                              {new Date(inv.created_at).toLocaleDateString('en-KE')}
                              {inv.signed_at && <span className="block" style={{ color:'var(--success)' }}>Signed {new Date(inv.signed_at).toLocaleDateString('en-KE')}</span>}
                            </td>
                            <td>
                              <div className="flex gap-1">
                                {inv.status !== 'signed' && (
                                  <button className="btn-ghost p-1.5" title="Resend"
                                    onClick={() => { setInviteForm({ email:inv.email, name:inv.name, role_id:inv.role_id||'', modules:inv.modules||[], use_letter:false }); setLetterForm({ subject:'', body:'', agreement:'' }); setInviteStep('form'); setInviteLink(''); setShowInvite(true) }}>
                                    <RefreshCw size={12}/>
                                  </button>
                                )}
                                <button className="btn-ghost p-1.5" title="Remove" style={{ color:'var(--danger)' }}
                                  onClick={async () => { await supabase.from('invitations').delete().eq('id',inv.id); toast.success('Removed'); loadAll() }}>
                                  <Trash2 size={12}/>
                                </button>
                              </div>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>}
          </div>

          {/* Roles */}
          <div className="card p-4">
            <h4 className="font-semibold text-sm mb-3" style={{ color:'var(--text-primary)' }}>Available Roles</h4>
            <div className="space-y-2">
              {orgRoles.map(role => {
                const perms = role.permissions as any
                const mods = perms?.modules==='all' ? 'All modules' : Array.isArray(perms?.modules) ? perms.modules.join(', ') : '—'
                return (
                  <div key={role.id} className="flex items-start justify-between p-3 rounded-xl" style={{ background:'var(--bg-table-head)', border:'1px solid var(--border)' }}>
                    <div>
                      <p className="font-semibold text-sm" style={{ color:'var(--text-primary)' }}>{role.name}</p>
                      <p className="text-xs mt-0.5" style={{ color:'var(--text-muted)' }}>{mods}</p>
                    </div>
                    <div className="flex gap-2 flex-wrap">
                      {perms?.can_delete       && <span className="badge badge-red text-xs">Delete</span>}
                      {perms?.can_manage_users && <span className="badge badge-purple text-xs">Manage users</span>}
                      {perms?.can_view_reports && <span className="badge badge-green text-xs">Reports</span>}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      )}

      {/* ── SECURITY TAB ── */}
      {tab === 'security' && (
        <div className="space-y-4 max-w-md">
          <div className="card p-5 space-y-3">
            <h3 className="font-semibold text-sm" style={{ color: 'var(--text-primary)' }}>Change Password</h3>
            <div>
              <label className="input-label">New Password</label>
              <input type="password" className="input" placeholder="Minimum 6 characters"
                value={pwForm.newPw} onChange={e => setPwForm(p => ({ ...p, newPw: e.target.value }))} />
            </div>
            <div>
              <label className="input-label">Confirm Password</label>
              <input type="password" className="input"
                value={pwForm.confirm} onChange={e => setPwForm(p => ({ ...p, confirm: e.target.value }))} />
            </div>
            <button className="btn-primary" onClick={changePassword} disabled={saving}>
              <Key size={14} />{saving ? 'Saving…' : 'Change Password'}
            </button>
          </div>
          <div className="card p-5 space-y-3">
            <h3 className="font-semibold text-sm" style={{ color: 'var(--text-primary)' }}>Archive Password</h3>
            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
              Protects deleted entries archive. Separate from your login password.
            </p>
            <div>
              <label className="input-label">New Archive Password</label>
              <input type="password" className="input" placeholder="Minimum 6 characters"
                value={archivePw} onChange={e => setArchivePw(e.target.value)} />
            </div>
            <div>
              <label className="input-label">Confirm</label>
              <input type="password" className="input"
                value={archiveConfirm} onChange={e => setArchiveConfirm(e.target.value)} />
            </div>
            <button className="btn-primary" onClick={setArchivePassword}>
              <Lock size={14} />Set Archive Password
            </button>
          </div>
        </div>
      )}

      {/* ── NOTIFICATIONS TAB ── */}
      {tab === 'notifications' && (
        <div className="card p-5 space-y-4 max-w-md">
          <h3 className="font-semibold text-sm" style={{ color: 'var(--text-primary)' }}>Email Notifications</h3>
          <div className="flex items-center justify-between p-3 rounded-xl"
            style={{ background: 'var(--bg-table-head)', border: '1px solid var(--border)' }}>
            <div>
              <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>Monthly Financial Report</p>
              <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
                Auto-sent on the 1st of every month
              </p>
            </div>
            <button onClick={() => setNotifForm(p => ({ ...p, monthly_report: !p.monthly_report }))}
              style={{
                width: 44, height: 24, borderRadius: 12, flexShrink: 0,
                background: notifForm.monthly_report ? 'var(--brand)' : '#cbd5e1',
                border: 'none', cursor: 'pointer', position: 'relative', transition: 'background 0.2s',
              }}>
              <span style={{
                position: 'absolute', top: 3,
                left: notifForm.monthly_report ? 23 : 3,
                width: 18, height: 18, borderRadius: '50%', background: '#fff',
                transition: 'left 0.2s',
              }} />
            </button>
          </div>
          {notifForm.monthly_report && (
            <div>
              <label className="input-label">Send report to this email</label>
              <input type="email" className="input" placeholder="owner@company.com"
                value={notifForm.report_email}
                onChange={e => setNotifForm(p => ({ ...p, report_email: e.target.value }))} />
            </div>
          )}
          <button className="btn-primary" onClick={saveNotifications} disabled={saving}>
            <Bell size={14} />{saving ? 'Saving…' : 'Save Preferences'}
          </button>
        </div>
      )}

      {/* ── UPGRADE / PAYMENT MODAL ── */}
      {showPayment && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center"
          style={{ background: 'rgba(0,0,0,0.5)' }}
          onClick={e => e.target === e.currentTarget && !polling && setShowPayment(false)}>
          <div className="w-full sm:max-w-lg rounded-t-2xl sm:rounded-2xl max-h-[92vh] flex flex-col overflow-hidden"
            style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
            <div className="flex items-center justify-between p-4"
              style={{ borderBottom: '1px solid var(--border)' }}>
              <h2 className="font-bold" style={{ color: 'var(--text-primary)' }}>Upgrade Package</h2>
              {!polling && (
                <button className="btn-ghost p-2" onClick={() => setShowPayment(false)}>
                  <X size={16} />
                </button>
              )}
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {!checkoutId ? (
                <>
                  {/* Tier grid */}
                  <div className="grid grid-cols-2 gap-3">
                    {allTiers.map(tier => (
                      <button key={tier.id} onClick={() => setSelectedTier(tier)}
                        className="text-left p-4 rounded-xl transition-all"
                        style={{
                          border: `2px solid ${selectedTier?.id === tier.id ? 'var(--brand)' : 'var(--border)'}`,
                          background: selectedTier?.id === tier.id ? 'var(--brand-dim)' : 'var(--bg-table-head)',
                        }}>
                        <p className="font-bold text-sm" style={{ color: 'var(--text-primary)' }}>{tier.name}</p>
                        <p className="font-bold text-lg mt-1" style={{ color: 'var(--brand)' }}>
                          KES {Number(tier.price_kes).toLocaleString()}
                          <span className="text-xs font-normal" style={{ color: 'var(--text-muted)' }}>/mo</span>
                        </p>
                        <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
                          {(tier.enabled_modules as string[]).length} modules · {tier.max_users} users
                        </p>
                      </button>
                    ))}
                  </div>

                  {selectedTier && Number(selectedTier.price_kes) > 0 && (
                    <div className="space-y-3">
                      <div className="p-3 rounded-xl"
                        style={{ background: 'var(--success-dim)', border: '1px solid var(--success)40' }}>
                        <p className="text-sm font-medium" style={{ color: 'var(--success)' }}>
                          Pay KES {Number(selectedTier.price_kes).toLocaleString()} via M-Pesa
                        </p>
                        <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
                          Modules unlock instantly after payment confirmation
                        </p>
                      </div>
                      <div>
                        <label className="input-label">M-Pesa Phone Number</label>
                        <div className="relative">
                          <Smartphone size={14} className="absolute left-3 top-1/2 -translate-y-1/2"
                            style={{ color: 'var(--text-muted)' }} />
                          <input className="input pl-8" placeholder="07XXXXXXXX or 254XXXXXXXXX"
                            value={phone} onChange={e => setPhone(e.target.value)} />
                        </div>
                      </div>
                      <button className="btn-primary w-full justify-center"
                        onClick={initiateMpesa} disabled={payLoading}>
                        {payLoading
                          ? <><RefreshCw size={14} className="animate-spin" />Sending STK push…</>
                          : <><Smartphone size={14} />Pay KES {Number(selectedTier.price_kes).toLocaleString()} via M-Pesa</>}
                      </button>
                    </div>
                  )}

                  {selectedTier && Number(selectedTier.price_kes) === 0 && (
                    <p className="text-sm text-center" style={{ color: 'var(--text-muted)' }}>
                      Free plan — no payment needed
                    </p>
                  )}
                </>
              ) : (
                /* Polling state */
                <div className="flex flex-col items-center justify-center py-12 gap-4 text-center">
                  <div className="w-16 h-16 rounded-full flex items-center justify-center"
                    style={{ background: 'var(--brand-dim)' }}>
                    <Smartphone size={28} style={{ color: 'var(--brand)' }} />
                  </div>
                  <div>
                    <p className="font-bold text-base" style={{ color: 'var(--text-primary)' }}>
                      Waiting for M-Pesa…
                    </p>
                    <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
                      Enter your PIN on your phone to confirm
                    </p>
                    <div className="flex justify-center gap-1 mt-4">
                      {[0,1,2].map(i => (
                        <div key={i} className="w-2 h-2 rounded-full animate-bounce"
                          style={{ background: 'var(--brand)', animationDelay: `${i*0.15}s` }} />
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── INVITE MODAL ── */}
      {showInvite && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center"
          style={{ background: 'rgba(0,0,0,0.5)' }}
          onClick={e => e.target === e.currentTarget && setShowInvite(false)}>
          <div className="w-full sm:max-w-sm rounded-t-2xl sm:rounded-2xl"
            style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
            <div className="flex items-center justify-between p-4"
              style={{ borderBottom: '1px solid var(--border)' }}>
              <h2 className="font-bold" style={{ color: 'var(--text-primary)' }}>Invite Team Member</h2>
              <button className="btn-ghost p-2" onClick={() => setShowInvite(false)}><X size={16} /></button>
            </div>
            <div className="p-4 space-y-3">
              <div>
                <label className="input-label">Email Address *</label>
                <input type="email" className="input" placeholder="colleague@company.com"
                  value={inviteForm.email}
                  onChange={e => setInviteForm(p => ({ ...p, email: e.target.value }))} />
              </div>
              <div>
                <label className="input-label">Assign Role *</label>
                <select className="input" value={inviteForm.role_id}
                  onChange={e => setInviteForm(p => ({ ...p, role_id: e.target.value }))}>
                  <option value="">Select role…</option>
                  {orgRoles.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                </select>
              </div>
              <div className="flex gap-3 pt-1">
                <button className="btn-secondary flex-1" onClick={() => setShowInvite(false)}>Cancel</button>
                <button className="btn-primary flex-1 justify-center"
                  onClick={inviteMember} disabled={inviteSaving}>
                  <Mail size={14} />{inviteSaving ? 'Sending…' : 'Send Invite'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── INVITE MODAL ── */}
      {showInvite && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center" style={{ background:'rgba(0,0,0,0.5)' }} onClick={e => e.target===e.currentTarget&&setShowInvite(false)}>
          <div className="w-full sm:max-w-xl rounded-t-2xl sm:rounded-2xl max-h-[92vh] flex flex-col" style={{ background:'var(--bg-card)', border:'1px solid var(--border)' }}>
            <div className="flex items-center justify-between p-4" style={{ borderBottom:'1px solid var(--border)' }}>
              <div>
                <h2 className="font-bold" style={{ color:'var(--text-primary)' }}>
                  {inviteStep==='form'?'Invite Team Member':inviteStep==='letter'?'Write Official Letter':'Invite Sent!'}
                </h2>
                {inviteStep!=='done' && (
                  <div className="flex items-center gap-2 mt-1">
                    {(['form','letter','done'] as const).map((s,i) => (
                      <div key={s} className="flex items-center gap-1">
                        <div className="w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0"
                          style={{ background:inviteStep===s?'var(--brand)':'var(--bg-table-head)', color:inviteStep===s?'white':'var(--text-muted)' }}>{i+1}</div>
                        {i<2 && <div className="w-4 h-0.5" style={{ background:'var(--border)' }}/>}
                      </div>
                    ))}
                    <span className="text-xs" style={{ color:'var(--text-muted)' }}>Details → Letter → Done</span>
                  </div>
                )}
              </div>
              <button className="btn-ghost p-2" onClick={()=>setShowInvite(false)}><X size={16}/></button>
            </div>
            <div className="flex-1 overflow-y-auto p-4">
              {inviteStep==='form' && (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-3">
                    <div><label className="input-label">Full Name *</label>
                      <input className="input" placeholder="Jane Mwangi" value={inviteForm.name} onChange={e=>setInviteForm(p=>({...p,name:e.target.value}))}/></div>
                    <div><label className="input-label">Email *</label>
                      <input type="email" className="input" placeholder="jane@example.com" value={inviteForm.email} onChange={e=>setInviteForm(p=>({...p,email:e.target.value}))}/></div>
                  </div>
                  <div><label className="input-label">Assign Role *</label>
                    <select className="input" value={inviteForm.role_id} onChange={e=>setInviteForm(p=>({...p,role_id:e.target.value}))}>
                      <option value="">Select role…</option>
                      {orgRoles.map(r=><option key={r.id} value={r.id}>{r.name}</option>)}
                    </select></div>
                  <div>
                    <label className="input-label">Module Access</label>
                    <p className="text-xs mb-2" style={{ color:'var(--text-muted)' }}>Select specific modules — overrides role defaults. Leave unchecked to use role defaults.</p>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                      {ALL_MODULES.map(m => (
                        <label key={m.key} className="flex items-center gap-2 p-2 rounded-xl cursor-pointer transition-all"
                          style={{ background:inviteForm.modules.includes(m.key)?'var(--brand-dim)':'var(--bg-table-head)', border:`1px solid ${inviteForm.modules.includes(m.key)?'var(--brand)':'var(--border)'}` }}>
                          <input type="checkbox" checked={inviteForm.modules.includes(m.key)} onChange={()=>toggleInviteMod(m.key)} style={{ accentColor:'var(--brand)' }}/>
                          <span className="text-xs font-medium" style={{ color:'var(--text-primary)' }}>{m.label}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                  <div className="flex gap-3 pt-2">
                    <button className="btn-secondary flex-1" onClick={()=>setShowInvite(false)}>Cancel</button>
                    <button className="btn-secondary flex-1" onClick={()=>setInviteStep('letter')}><FileText size={14}/>Add Letter</button>
                    <button className="btn-primary flex-1 justify-center" onClick={sendInvite} disabled={inviteSaving}>
                      <Send size={14}/>{inviteSaving?'Sending…':'Send Invite'}
                    </button>
                  </div>
                </div>
              )}
              {inviteStep==='letter' && (
                <div className="space-y-4">
                  {templates.length > 0 && (
                    <div><label className="input-label">Load from Template</label>
                      <select className="input" defaultValue="" onChange={e=>{const t=templates.find((t:any)=>t.id===e.target.value);if(t)loadTemplate(t)}}>
                        <option value="">Select template…</option>
                        {templates.map((t:any)=><option key={t.id} value={t.id}>{t.name}</option>)}
                      </select></div>
                  )}
                  <div><label className="input-label">Email Subject</label>
                    <input className="input" placeholder="Offer of Employment" value={letterForm.subject} onChange={e=>setLetterForm(p=>({...p,subject:e.target.value}))}/></div>
                  <div><label className="input-label">Letter Body (shown in invite email)</label>
                    <textarea className="input" rows={5} style={{ resize:'vertical',height:'auto' }} value={letterForm.body} onChange={e=>setLetterForm(p=>({...p,body:e.target.value}))} placeholder="Dear {{NAME}}, We are pleased to offer you the position of {{ROLE}}…"/></div>
                  <div><label className="input-label">Employment Agreement</label>
                    <p className="text-xs mb-1" style={{ color:'var(--text-muted)' }}>Employee must read and sign before accessing FinAI. Leave blank to skip.</p>
                    <textarea className="input" rows={7} style={{ resize:'vertical',height:'auto' }} value={letterForm.agreement} onChange={e=>setLetterForm(p=>({...p,agreement:e.target.value}))} placeholder="1. TERMS OF EMPLOYMENT&#10;&#10;6. ACCEPTANCE — By signing you agree to the above terms."/></div>
                  <div className="flex gap-3">
                    <button className="btn-secondary flex-1" onClick={()=>setInviteStep('form')}>← Back</button>
                    <button className="btn-primary flex-1 justify-center" onClick={sendInvite} disabled={inviteSaving}>
                      <Send size={14}/>{inviteSaving?'Sending…':'Send Invite + Letter'}
                    </button>
                  </div>
                </div>
              )}
              {inviteStep==='done' && (
                <div className="flex flex-col items-center text-center gap-4 py-6">
                  <div className="w-16 h-16 rounded-full flex items-center justify-center" style={{ background:'var(--success-dim)' }}>
                    <CheckCircle2 size={30} style={{ color:'var(--success)' }}/>
                  </div>
                  <div>
                    <p className="font-bold text-base" style={{ color:'var(--text-primary)' }}>Invite Sent!</p>
                    <p className="text-sm mt-1" style={{ color:'var(--text-muted)' }}>
                      {inviteForm.name} will receive an email with a signup link.
                      {letterForm.agreement && ' They must sign the agreement before accessing FinAI.'}
                    </p>
                  </div>
                  {inviteLink && (
                    <div className="w-full">
                      <p className="text-xs font-semibold mb-2" style={{ color:'var(--text-secondary)' }}>Share link if email bounces:</p>
                      <div className="flex gap-2">
                        <input className="input text-xs flex-1" value={inviteLink} readOnly style={{ fontFamily:'monospace' }}/>
                        <button className="btn-secondary px-3" onClick={()=>{navigator.clipboard.writeText(inviteLink);toast.success('Copied')}}>
                          <Copy size={14}/>
                        </button>
                      </div>
                    </div>
                  )}
                  <button className="btn-primary" onClick={()=>setShowInvite(false)}>Done</button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── TEMPLATE MODAL ── */}
      {showTemplate && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center" style={{ background:'rgba(0,0,0,0.5)' }} onClick={e=>e.target===e.currentTarget&&setShowTemplate(false)}>
          <div className="w-full sm:max-w-lg rounded-t-2xl sm:rounded-2xl max-h-[92vh] flex flex-col" style={{ background:'var(--bg-card)', border:'1px solid var(--border)' }}>
            <div className="flex items-center justify-between p-4" style={{ borderBottom:'1px solid var(--border)' }}>
              <h2 className="font-bold" style={{ color:'var(--text-primary)' }}>New Letter Template</h2>
              <button className="btn-ghost p-2" onClick={()=>setShowTemplate(false)}><X size={16}/></button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              <div><label className="input-label">Template Name *</label>
                <input className="input" placeholder="Standard Offer Letter" value={templateForm.name} onChange={e=>setTemplateForm(p=>({...p,name:e.target.value}))}/></div>
              <div><label className="input-label">Type</label>
                <select className="input" value={templateForm.type} onChange={e=>setTemplateForm(p=>({...p,type:e.target.value}))}>
                  <option value="offer_letter">Offer Letter</option>
                  <option value="contract">Employment Contract</option>
                  <option value="nda">NDA / Confidentiality</option>
                  <option value="policy">HR Policy</option>
                </select></div>
              <div><label className="input-label">Email Subject</label>
                <input className="input" placeholder="Offer of Employment — {{ROLE}}" value={templateForm.subject} onChange={e=>setTemplateForm(p=>({...p,subject:e.target.value}))}/>
                <p className="text-xs mt-1" style={{ color:'var(--text-muted)' }}>Variables: {'{{NAME}} {{ROLE}} {{ORG_NAME}} {{SENDER_NAME}}'}</p></div>
              <div><label className="input-label">Letter Body *</label>
                <textarea className="input" rows={10} style={{ resize:'vertical',height:'auto' }} placeholder="Dear {{NAME}},&#10;&#10;We are pleased to offer you the position of {{ROLE}} at {{ORG_NAME}}…" value={templateForm.body} onChange={e=>setTemplateForm(p=>({...p,body:e.target.value}))}/></div>
            </div>
            <div className="flex gap-3 p-4" style={{ borderTop:'1px solid var(--border)' }}>
              <button className="btn-secondary flex-1" onClick={()=>setShowTemplate(false)}>Cancel</button>
              <button className="btn-primary flex-1 justify-center" onClick={saveTemplate} disabled={templateSaving}>
                <CheckCircle2 size={15}/>{templateSaving?'Saving…':'Save Template'}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}

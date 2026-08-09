'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'
import { useAppStore } from '@/lib/store'
import {
  Package, Users, Shield, Bell, Building2, Key,
  CheckCircle2, AlertTriangle, RefreshCw, X, Plus,
  Smartphone, Mail, Lock, Unlock
} from 'lucide-react'
import toast from 'react-hot-toast'

const ALL_MODULES = [
  { key: 'accounting',   label: 'Accounting',        desc: 'Journal entries, COA, Trial Balance' },
  { key: 'transactions', label: 'Transactions',       desc: 'Invoices, bills, expenses' },
  { key: 'contacts',     label: 'Contacts',           desc: 'Customers, vendors, employees' },
  { key: 'banking',      label: 'Banking',            desc: 'Accounts & reconciliation' },
  { key: 'inventory',    label: 'Inventory',          desc: 'Products & stock levels' },
  { key: 'payroll',      label: 'Payroll',            desc: 'PAYE, NHIF, NSSF auto-calculated' },
  { key: 'tax',          label: 'Tax & Compliance',   desc: 'VAT, KRA compliance' },
  { key: 'analytics',    label: 'Analytics',          desc: 'AI-powered insights' },
  { key: 'budgeting',    label: 'Budgets',            desc: 'Budget vs actual' },
  { key: 'pos',          label: 'POS',                desc: 'Point of sale system' },
  { key: 'reports',      label: 'Reports',            desc: 'Financial statements' },
]

const TABS = [
  { key: 'organisation', label: 'Organisation',  icon: Building2 },
  { key: 'modules',      label: 'Modules',       icon: Package },
  { key: 'team',         label: 'Team & Roles',  icon: Users },
  { key: 'security',     label: 'Security',      icon: Shield },
  { key: 'notifications',label: 'Notifications', icon: Bell },
]

export default function SettingsPage() {
  const supabase = createClient()
  const { organization, profile, setOrganization } = useAppStore()
  const [tab, setTab]               = useState('organisation')
  const [saving, setSaving]         = useState(false)
  const [subscription, setSubscription] = useState<any>(null)
  const [tierModules, setTierModules]   = useState<string[]>([])
  const [orgRoles, setOrgRoles]         = useState<any[]>([])
  const [teamMembers, setTeamMembers]   = useState<any[]>([])

  // Org form
  const [orgForm, setOrgForm] = useState({
    name: organization?.name || '',
    sector: (organization as any)?.sector || 'business',
    country: organization?.country || 'KE',
    tax_id: (organization as any)?.tax_id || '',
  })

  // Security
  const [pwForm, setPwForm]               = useState({ current: '', newPw: '', confirm: '' })
  const [archivePw, setArchivePw]         = useState('')
  const [archiveConfirm, setArchiveConfirm] = useState('')

  // Notifications
  const [notifForm, setNotifForm] = useState({
    monthly_report: true,
    report_email: profile?.email || '',
  })

  // M-Pesa payment modal
  const [showPayment, setShowPayment]     = useState(false)
  const [selectedTier, setSelectedTier]   = useState<any>(null)
  const [allTiers, setAllTiers]           = useState<any[]>([])
  const [phone, setPhone]                 = useState('')
  const [payLoading, setPayLoading]       = useState(false)
  const [checkoutId, setCheckoutId]       = useState('')
  const [polling, setPolling]             = useState(false)

  // Invite team member
  const [showInvite, setShowInvite]   = useState(false)
  const [inviteForm, setInviteForm]   = useState({ email: '', role_id: '' })
  const [inviteSaving, setInviteSaving] = useState(false)

  useEffect(() => {
    if (!organization) return
    loadAll()
    if (organization?.name) setOrgForm(p => ({ ...p, name: organization.name }))
  }, [organization])

  const loadAll = async () => {
    const orgId = organization!.id

    // Load subscription + tier
    const { data: sub } = await supabase
      .from('org_subscriptions')
      .select('*, tier:tiers(*)')
      .eq('organization_id', orgId)
      .single()
    setSubscription(sub)
    setTierModules((sub?.tier?.enabled_modules as string[]) || [])

    // Load all tiers for upgrade
    const { data: tiers } = await supabase.from('tiers').select('*').eq('is_active', true).order('sort_order')
    setAllTiers(tiers || [])

    // Load org roles
    const { data: roles } = await supabase.from('org_roles')
      .select('*').eq('organization_id', orgId).order('name')
    setOrgRoles(roles || [])

    // Load team members
    const { data: members } = await supabase.from('profiles')
      .select('*, org_role:org_roles(name, slug)')
      .eq('organization_id', orgId)
    setTeamMembers(members || [])

    // Load notification settings
    const { data: schedule } = await supabase.from('report_schedules')
      .select('*').eq('organization_id', orgId).single()
    if (schedule) {
      setNotifForm({ monthly_report: schedule.is_active, report_email: schedule.recipient_email })
    }
  }

  // ── Save organisation ──────────────────────────────────────────
  const saveOrg = async () => {
    setSaving(true)
    const { error } = await supabase.from('organizations')
      .update(orgForm).eq('id', organization!.id)
    if (error) { toast.error('Failed: ' + error.message); setSaving(false); return }
    setOrganization({ ...organization!, ...orgForm })
    toast.success('Organisation saved')
    setSaving(false)
  }

  // ── Module toggle (package-gated) ─────────────────────────────
  const toggleModule = async (key: string, currentlyEnabled: boolean) => {
    if (!tierModules.includes(key)) {
      toast.error(`${ALL_MODULES.find(m => m.key === key)?.label} is not included in your current package. Upgrade to unlock it.`)
      return
    }
    const currentModules: string[] = (organization?.settings as any)?.enabled_modules || []
    const newModules = currentlyEnabled
      ? currentModules.filter(m => m !== key)
      : [...currentModules, key]

    const { error } = await supabase.from('organizations')
      .update({ settings: { ...((organization?.settings as any) || {}), enabled_modules: newModules } })
      .eq('id', organization!.id)
    if (error) { toast.error(error.message); return }
    setOrganization({ ...organization!, settings: { ...((organization?.settings as any) || {}), enabled_modules: newModules } })
    toast.success(`${key} ${currentlyEnabled ? 'disabled' : 'enabled'}`)
  }

  // ── M-Pesa payment ─────────────────────────────────────────────
  const initiateMpesa = async () => {
    if (!phone || phone.length < 9) { toast.error('Enter valid phone number'); return }
    if (!selectedTier) return
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

    if (!res.ok) { toast.error(data.error || 'Payment failed'); return }

    setCheckoutId(data.checkout_request_id)
    setPolling(true)
    toast.success('Check your phone — enter M-Pesa PIN to pay')
    pollStatus(data.checkout_request_id)
  }

  const pollStatus = async (cid: string) => {
    const interval = setInterval(async () => {
      const res  = await fetch(`/api/mpesa/status?checkout_id=${cid}`)
      const data = await res.json()
      if (data.status === 'completed') {
        clearInterval(interval)
        setPolling(false)
        setShowPayment(false)
        toast.success(`Payment confirmed! Receipt: ${data.mpesa_receipt}`)
        loadAll()
      } else if (data.status === 'failed') {
        clearInterval(interval)
        setPolling(false)
        toast.error('Payment failed or was cancelled')
      }
    }, 3000)
    // Stop polling after 3 minutes
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
    setPwForm({ current: '', newPw: '', confirm: '' })
    setSaving(false)
  }

  // ── Set archive password ───────────────────────────────────────
  const setArchivePassword = async () => {
    if (archivePw !== archiveConfirm) { toast.error('Passwords do not match'); return }
    if (archivePw.length < 6) { toast.error('Minimum 6 characters'); return }
    const buf  = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(archivePw))
    const hash = Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('')
    const settings = { ...((organization?.settings as any) || {}), archive_password_hash: hash }
    const { error } = await supabase.from('organizations').update({ settings }).eq('id', organization!.id)
    if (error) { toast.error(error.message); return }
    setOrganization({ ...organization!, settings })
    toast.success('Archive password set')
    setArchivePw(''); setArchiveConfirm('')
  }

  // ── Save notification settings ─────────────────────────────────
  const saveNotifications = async () => {
    setSaving(true)
    const { data: existing } = await supabase.from('report_schedules')
      .select('id').eq('organization_id', organization!.id).single()

    if (existing) {
      await supabase.from('report_schedules').update({
        is_active:        notifForm.monthly_report,
        recipient_email:  notifForm.report_email,
      }).eq('id', existing.id)
    } else {
      await supabase.from('report_schedules').insert({
        organization_id: organization!.id,
        report_type:     'monthly_transactions',
        recipient_email: notifForm.report_email,
        is_active:       notifForm.monthly_report,
      })
    }
    toast.success('Notification settings saved')
    setSaving(false)
  }

  // ── Invite team member ─────────────────────────────────────────
  const inviteMember = async () => {
    if (!inviteForm.email || !inviteForm.role_id) { toast.error('Email and role required'); return }
    setInviteSaving(true)
    // Send invite email
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
    toast.success(`Invitation sent to ${inviteForm.email}`)
    setShowInvite(false)
    setInviteForm({ email: '', role_id: '' })
    setInviteSaving(false)
  }

  const enabledModules: string[] = (organization?.settings as any)?.enabled_modules || []
  const tierName = subscription?.tier?.name || 'Free'
  const tierColor: Record<string, string> = {
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
            <input className="input" value={orgForm.name} onChange={e => setOrgForm(p => ({ ...p, name: e.target.value }))} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="input-label">Sector</label>
              <select className="input" value={orgForm.sector} onChange={e => setOrgForm(p => ({ ...p, sector: e.target.value }))}>
                {['business','school','hospital','ngo','government','retail','manufacturing','agriculture','transport','hospitality','other']
                  .map(s => <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>)}
              </select>
            </div>
            <div>
              <label className="input-label">Country</label>
              <select className="input" value={orgForm.country} onChange={e => setOrgForm(p => ({ ...p, country: e.target.value }))}>
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
          {/* Current plan */}
          <div className="card p-4 flex items-center justify-between flex-wrap gap-3">
            <div>
              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Current Package</p>
              <p className="font-bold text-lg" style={{ color: tierColor[tierName] || 'var(--brand)' }}>{tierName}</p>
              {subscription?.current_period_end && (
                <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
                  Renews: {new Date(subscription.current_period_end).toLocaleDateString('en-KE')}
                </p>
              )}
            </div>
            <button className="btn-primary" onClick={() => setShowPayment(true)}>
              <Package size={14} />Upgrade Package
            </button>
          </div>

          {/* Module grid */}
          <div className="card p-4">
            <p className="text-xs font-semibold mb-4 uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
              Module Access
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {ALL_MODULES.map(mod => {
                const inPlan    = tierModules.includes(mod.key)
                const isEnabled = enabledModules.includes(mod.key)
                return (
                  <div key={mod.key} className="flex items-center justify-between p-3 rounded-xl"
                    style={{
                      background: isEnabled ? 'var(--brand-dim)' : 'var(--bg-table-head)',
                      border: `1px solid ${isEnabled ? 'var(--brand)' : 'var(--border)'}40`,
                      opacity: inPlan ? 1 : 0.5,
                    }}>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{mod.label}</p>
                        {!inPlan && (
                          <span className="badge text-xs" style={{ background: 'var(--warning-dim)', color: 'var(--warning)' }}>
                            Upgrade
                          </span>
                        )}
                      </div>
                      <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>{mod.desc}</p>
                    </div>
                    <button
                      onClick={() => toggleModule(mod.key, isEnabled)}
                      title={!inPlan ? 'Not in your plan — upgrade to unlock' : ''}
                      style={{
                        width: 44, height: 24, borderRadius: 12,
                        background: isEnabled ? 'var(--brand)' : 'var(--border)',
                        border: 'none', cursor: inPlan ? 'pointer' : 'not-allowed',
                        position: 'relative', transition: 'background 0.2s', flexShrink: 0,
                      }}>
                      <span style={{
                        position: 'absolute', top: 3, left: isEnabled ? 23 : 3,
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
        <div className="space-y-4 max-w-2xl">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-sm" style={{ color: 'var(--text-primary)' }}>Team Members</h3>
            <button className="btn-primary text-sm" onClick={() => setShowInvite(true)}>
              <Plus size={14} />Invite Member
            </button>
          </div>

          <div className="card overflow-hidden">
            <table className="table">
              <thead><tr><th>Member</th><th>Email</th><th>Role</th><th>Joined</th></tr></thead>
              <tbody>
                {teamMembers.length === 0 ? (
                  <tr><td colSpan={4} className="text-center py-8" style={{ color: 'var(--text-muted)' }}>
                    No team members yet
                  </td></tr>
                ) : teamMembers.map(m => (
                  <tr key={m.id}>
                    <td className="font-medium text-sm">{m.full_name}</td>
                    <td className="text-xs" style={{ color: 'var(--text-secondary)' }}>{m.email || '—'}</td>
                    <td>
                      <span className="badge badge-blue text-xs capitalize">
                        {(m.org_role as any)?.name || 'Owner'}
                      </span>
                    </td>
                    <td className="text-xs" style={{ color: 'var(--text-muted)' }}>
                      {m.created_at ? new Date(m.created_at).toLocaleDateString('en-KE') : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Roles list */}
          <div className="card p-4">
            <h4 className="font-semibold text-sm mb-3" style={{ color: 'var(--text-primary)' }}>Available Roles</h4>
            <div className="space-y-2">
              {orgRoles.map(role => {
                const perms = role.permissions as any
                const modules = perms?.modules === 'all' ? 'All modules' :
                  Array.isArray(perms?.modules) ? perms.modules.join(', ') : '—'
                return (
                  <div key={role.id} className="flex items-start justify-between p-3 rounded-xl"
                    style={{ background: 'var(--bg-table-head)', border: '1px solid var(--border)' }}>
                    <div>
                      <p className="font-semibold text-sm" style={{ color: 'var(--text-primary)' }}>{role.name}</p>
                      <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>{modules}</p>
                    </div>
                    <div className="flex gap-2 text-xs">
                      {perms?.can_delete && <span className="badge badge-red">Can delete</span>}
                      {perms?.can_manage_users && <span className="badge badge-purple">Manage users</span>}
                      {perms?.can_view_reports && <span className="badge badge-green">View reports</span>}
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
          {/* Change password */}
          <div className="card p-5 space-y-3">
            <h3 className="font-semibold text-sm" style={{ color: 'var(--text-primary)' }}>Change Password</h3>
            <div>
              <label className="input-label">New Password</label>
              <input type="password" className="input" placeholder="Minimum 6 characters"
                value={pwForm.newPw} onChange={e => setPwForm(p => ({ ...p, newPw: e.target.value }))} />
            </div>
            <div>
              <label className="input-label">Confirm Password</label>
              <input type="password" className="input" placeholder="Repeat password"
                value={pwForm.confirm} onChange={e => setPwForm(p => ({ ...p, confirm: e.target.value }))} />
            </div>
            <button className="btn-primary" onClick={changePassword} disabled={saving}>
              <Key size={14} />{saving ? 'Saving…' : 'Change Password'}
            </button>
          </div>

          {/* Archive password */}
          <div className="card p-5 space-y-3">
            <h3 className="font-semibold text-sm" style={{ color: 'var(--text-primary)' }}>Archive Password</h3>
            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
              Protects the deletion archive. Separate from your login password.
            </p>
            <div>
              <label className="input-label">New Archive Password</label>
              <input type="password" className="input" placeholder="Minimum 6 characters"
                value={archivePw} onChange={e => setArchivePw(e.target.value)} />
            </div>
            <div>
              <label className="input-label">Confirm</label>
              <input type="password" className="input" value={archiveConfirm}
                onChange={e => setArchiveConfirm(e.target.value)} />
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
                Auto-sent on the 1st of every month with journal entries and P&L summary
              </p>
            </div>
            <button onClick={() => setNotifForm(p => ({ ...p, monthly_report: !p.monthly_report }))}
              style={{
                width: 44, height: 24, borderRadius: 12, flexShrink: 0,
                background: notifForm.monthly_report ? 'var(--brand)' : 'var(--border)',
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
              <label className="input-label">Send report to</label>
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

      {/* ── M-PESA PAYMENT MODAL ── */}
      {showPayment && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center"
          style={{ background: 'rgba(0,0,0,0.5)' }}
          onClick={e => e.target === e.currentTarget && !polling && setShowPayment(false)}>
          <div className="w-full sm:max-w-lg rounded-t-2xl sm:rounded-2xl max-h-[92vh] flex flex-col overflow-hidden"
            style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
            <div className="flex items-center justify-between p-4" style={{ borderBottom: '1px solid var(--border)' }}>
              <h2 className="font-bold" style={{ color: 'var(--text-primary)' }}>Upgrade Package</h2>
              {!polling && (
                <button className="btn-ghost p-2" onClick={() => setShowPayment(false)}><X size={16} /></button>
              )}
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {!checkoutId ? (
                <>
                  {/* Tier selection */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {allTiers.map(tier => (
                      <button key={tier.id} onClick={() => setSelectedTier(tier)}
                        className="text-left p-4 rounded-xl transition-all"
                        style={{
                          border: `2px solid ${selectedTier?.id === tier.id ? 'var(--brand)' : 'var(--border)'}`,
                          background: selectedTier?.id === tier.id ? 'var(--brand-dim)' : 'var(--bg-table-head)',
                        }}>
                        <p className="font-bold" style={{ color: 'var(--text-primary)' }}>{tier.name}</p>
                        <p className="text-lg font-bold mt-1" style={{ color: 'var(--brand)' }}>
                          KES {Number(tier.price_kes).toLocaleString()}<span className="text-xs font-normal" style={{ color: 'var(--text-muted)' }}>/mo</span>
                        </p>
                        <p className="text-xs mt-2" style={{ color: 'var(--text-muted)' }}>
                          {(tier.enabled_modules as string[]).length} modules · {tier.max_users} users
                        </p>
                      </button>
                    ))}
                  </div>

                  {selectedTier && selectedTier.price_kes > 0 && (
                    <div className="space-y-3">
                      <div className="p-3 rounded-xl" style={{ background: 'var(--success-dim)', border: '1px solid var(--success)30' }}>
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
                          <Smartphone size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-muted)' }} />
                          <input className="input pl-8" placeholder="07XXXXXXXX or 254XXXXXXXXX"
                            value={phone} onChange={e => setPhone(e.target.value)} />
                        </div>
                      </div>
                      <button className="btn-primary w-full justify-center" onClick={initiateMpesa} disabled={payLoading}>
                        {payLoading
                          ? <><RefreshCw size={14} className="animate-spin" />Sending STK push…</>
                          : <><Smartphone size={14} />Pay KES {Number(selectedTier.price_kes).toLocaleString()} via M-Pesa</>}
                      </button>
                    </div>
                  )}
                </>
              ) : (
                // Polling state
                <div className="flex flex-col items-center justify-center py-10 gap-4 text-center">
                  {polling ? (
                    <>
                      <div className="w-16 h-16 rounded-full flex items-center justify-center" style={{ background: 'var(--brand-dim)' }}>
                        <Smartphone size={28} style={{ color: 'var(--brand)' }} />
                      </div>
                      <div>
                        <p className="font-bold text-base" style={{ color: 'var(--text-primary)' }}>Waiting for M-Pesa…</p>
                        <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
                          Enter your M-Pesa PIN on your phone to confirm payment
                        </p>
                        <div className="flex justify-center gap-1 mt-4">
                          {[0,1,2].map(i => (
                            <div key={i} className="w-2 h-2 rounded-full animate-bounce"
                              style={{ background: 'var(--brand)', animationDelay: `${i * 0.15}s` }} />
                          ))}
                        </div>
                      </div>
                    </>
                  ) : (
                    <div className="flex flex-col items-center gap-3">
                      <CheckCircle2 size={40} style={{ color: 'var(--success)' }} />
                      <p className="font-bold" style={{ color: 'var(--text-primary)' }}>Payment confirmed!</p>
                    </div>
                  )}
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
            <div className="flex items-center justify-between p-4" style={{ borderBottom: '1px solid var(--border)' }}>
              <h2 className="font-bold" style={{ color: 'var(--text-primary)' }}>Invite Team Member</h2>
              <button className="btn-ghost p-2" onClick={() => setShowInvite(false)}><X size={16} /></button>
            </div>
            <div className="p-4 space-y-3">
              <div>
                <label className="input-label">Email Address *</label>
                <input type="email" className="input" placeholder="colleague@company.com"
                  value={inviteForm.email} onChange={e => setInviteForm(p => ({ ...p, email: e.target.value }))} />
              </div>
              <div>
                <label className="input-label">Assign Role *</label>
                <select className="input" value={inviteForm.role_id}
                  onChange={e => setInviteForm(p => ({ ...p, role_id: e.target.value }))}>
                  <option value="">Select role…</option>
                  {orgRoles.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                </select>
              </div>
              <div className="flex gap-3 pt-2">
                <button className="btn-secondary flex-1" onClick={() => setShowInvite(false)}>Cancel</button>
                <button className="btn-primary flex-1 justify-center" onClick={inviteMember} disabled={inviteSaving}>
                  <Mail size={14} />{inviteSaving ? 'Sending…' : 'Send Invite'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

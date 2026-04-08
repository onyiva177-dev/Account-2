'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase'
import { useAppStore } from '@/lib/store'
import { SECTORS, CURRENCIES } from '@/lib/utils'
import type { Sector } from '@/types'
import {
  Building2, Shield, Bell, Zap, Save, Lock,
  Eye, EyeOff, RefreshCw, CheckCircle2, AlertTriangle,
  CreditCard, Key, LogOut
} from 'lucide-react'
import toast from 'react-hot-toast'

const MODULES = [
  { key: 'accounting', label: 'Accounting Core',      desc: 'Journal entries, ledger, trial balance', icon: '📒', required: true },
  { key: 'tax',        label: 'Tax & Compliance',     desc: 'VAT, PAYE, corporate tax calculations',   icon: '🧾', required: false },
  { key: 'payroll',    label: 'Payroll',               desc: 'Employee salary, PAYE, NHIF, NSSF',      icon: '💰', required: false },
  { key: 'pos',        label: 'Point of Sale',         desc: 'Sales, receipts, barcode scanning',       icon: '🛍️', required: false },
  { key: 'inventory',  label: 'Inventory',             desc: 'Stock tracking and management',           icon: '📦', required: false },
  { key: 'budgeting',  label: 'Budgets & Forecasting', desc: 'Budget planning and variance analysis',   icon: '📊', required: false },
  { key: 'banking',    label: 'Banking & Reconciliation', desc: 'Bank feeds and statement matching',    icon: '🏦', required: false },
  { key: 'analytics',  label: 'Analytics',             desc: 'AI-powered financial intelligence',       icon: '🤖', required: false },
]

const TABS = ['Organization', 'Modules', 'Tax Policy', 'Security', 'Notifications']

// Reusable toggle component with real state
function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      onClick={(e) => { e.stopPropagation(); onChange(!checked); }}
      className={`w-11 h-6 rounded-full relative transition-colors flex-shrink-0 ${checked ? 'bg-brand-600' : 'bg-slate-200'}`}
    >
      <span className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-transform ${checked ? 'translate-x-6' : 'translate-x-1'}`} />
    </button>
  )
}

export default function SettingsPage() {
  const supabase = createClient()
  const { organization, profile, setOrganization } = useAppStore()
  const [tab, setTab] = useState(0)
  const [saving, setSaving] = useState(false)

  // ── Tab 0: Organization ───────────────────────────────────────────────────
  const [orgForm, setOrgForm] = useState({
    name:          organization?.name          || '',
    sector:        (organization?.sector       || 'business') as Sector,
    country:       organization?.country       || 'KE',
    base_currency: organization?.base_currency || 'KES',
    tax_id:        organization?.tax_id        || '',
  })

  // Keep form in sync if store loads asynchronously
  useEffect(() => {
    if (organization) {
      setOrgForm({
        name:          organization.name          || '',
        sector:        (organization.sector       || 'business') as Sector,
        country:       organization.country       || 'KE',
        base_currency: organization.base_currency || 'KES',
        tax_id:        organization.tax_id        || '',
      })
    }
  }, [organization?.id])

  const saveOrg = async () => {
    if (!organization) return
    if (!orgForm.name.trim()) { toast.error('Organization name is required'); return }
    setSaving(true)
    const { error } = await supabase
      .from('organizations')
      .update({
        name:          orgForm.name.trim(),
        sector:        orgForm.sector,
        country:       orgForm.country,
        base_currency: orgForm.base_currency,
        tax_id:        orgForm.tax_id.trim() || null,
      })
      .eq('id', organization.id)

    if (error) {
      toast.error('Save failed: ' + error.message)
    } else {
      // Update the global store so the rest of the app reflects changes
      setOrganization({ ...organization, ...orgForm })
      toast.success('Organization settings saved')
    }
    setSaving(false)
  }

  // ── Tab 1: Modules ────────────────────────────────────────────────────────
  // Stored in organizations.settings JSON column
  const defaultModules = ['accounting', 'tax', 'payroll', 'inventory', 'banking', 'analytics']
  const [enabledModules, setEnabledModules] = useState<string[]>(
    (organization?.settings as any)?.enabled_modules || defaultModules
  )
  const [savingModules, setSavingModules] = useState(false)

  const toggleModule = (key: string) => {
    if (key === 'accounting') return
    setEnabledModules(prev =>
      prev.includes(key) ? prev.filter(m => m !== key) : [...prev, key]
    )
  }

  const saveModules = async () => {
    if (!organization) return
    setSavingModules(true)
    const currentSettings = (organization.settings as any) || {}
    const { error } = await supabase
      .from('organizations')
      .update({ settings: { ...currentSettings, enabled_modules: enabledModules } })
      .eq('id', organization.id)

    if (error) {
      toast.error('Save failed: ' + error.message)
    } else {
      setOrganization({ ...organization, settings: { ...currentSettings, enabled_modules: enabledModules } })
      toast.success('Module preferences saved')
    }
    setSavingModules(false)
  }

  // ── Tab 2: Tax Policy ─────────────────────────────────────────────────────
  const currentSettings = (organization?.settings as any) || {}
  const taxDefaults = currentSettings.tax_policy || {}

  const [taxForm, setTaxForm] = useState({
    vat_rate:          String(taxDefaults.vat_rate          ?? 16),
    corporate_tax:     String(taxDefaults.corporate_tax     ?? 30),
    withholding_tax:   String(taxDefaults.withholding_tax   ?? 5),
    auto_calculate:    taxDefaults.auto_calculate    ?? true,
    block_remittance:  taxDefaults.block_remittance  ?? true,
  })
  const [savingTax, setSavingTax] = useState(false)

  const saveTaxPolicy = async () => {
    if (!organization) return
    const vat = parseFloat(taxForm.vat_rate)
    const corp = parseFloat(taxForm.corporate_tax)
    const wht = parseFloat(taxForm.withholding_tax)
    if (isNaN(vat) || vat < 0 || vat > 100) { toast.error('VAT rate must be 0–100'); return }
    if (isNaN(corp) || corp < 0 || corp > 100) { toast.error('Corporate tax rate must be 0–100'); return }

    setSavingTax(true)
    const newSettings = {
      ...currentSettings,
      tax_policy: {
        vat_rate:         vat,
        corporate_tax:    corp,
        withholding_tax:  wht,
        auto_calculate:   taxForm.auto_calculate,
        block_remittance: taxForm.block_remittance,
      }
    }
    const { error } = await supabase
      .from('organizations')
      .update({ settings: newSettings })
      .eq('id', organization.id)

    if (error) {
      toast.error('Save failed: ' + error.message)
    } else {
      setOrganization({ ...organization, settings: newSettings })
      toast.success('Tax policy saved')
    }
    setSavingTax(false)
  }

  // ── Tab 3: Security ───────────────────────────────────────────────────────
  const secDefaults = currentSettings.security || {}
  const [security, setSecurity] = useState({
    two_factor:      secDefaults.two_factor      ?? false,
    ip_whitelist:    secDefaults.ip_whitelist     ?? false,
    audit_log:       secDefaults.audit_log        ?? true,
    session_timeout: secDefaults.session_timeout  ?? true,
  })
  const [passwordForm, setPasswordForm] = useState({ current: '', newPass: '', confirm: '' })
  const [showPasswords, setShowPasswords] = useState(false)
  const [savingSecurity, setSavingSecurity] = useState(false)
  const [savingPassword, setSavingPassword] = useState(false)

  const saveSecurity = async () => {
    if (!organization) return
    setSavingSecurity(true)
    const newSettings = { ...currentSettings, security }
    const { error } = await supabase
      .from('organizations')
      .update({ settings: newSettings })
      .eq('id', organization.id)

    if (error) {
      toast.error('Save failed: ' + error.message)
    } else {
      setOrganization({ ...organization, settings: newSettings })
      toast.success('Security settings saved')
    }
    setSavingSecurity(false)
  }

  const changePassword = async () => {
    if (!passwordForm.current) { toast.error('Enter your current password'); return }
    if (passwordForm.newPass.length < 8) { toast.error('New password must be at least 8 characters'); return }
    if (passwordForm.newPass !== passwordForm.confirm) { toast.error('Passwords do not match'); return }
    setSavingPassword(true)
    const { error } = await supabase.auth.updateUser({ password: passwordForm.newPass })
    if (error) {
      toast.error('Password change failed: ' + error.message)
    } else {
      toast.success('Password changed successfully')
      setPasswordForm({ current: '', newPass: '', confirm: '' })
    }
    setSavingPassword(false)
  }

  // ── Tab 4: Notifications ──────────────────────────────────────────────────
  const notifDefaults = currentSettings.notifications || {}
  const [notifications, setNotifications] = useState({
    tax_reminders:        notifDefaults.tax_reminders        ?? true,
    overdue_invoices:     notifDefaults.overdue_invoices      ?? true,
    low_cash_warning:     notifDefaults.low_cash_warning      ?? true,
    ai_anomaly_alerts:    notifDefaults.ai_anomaly_alerts     ?? true,
    payroll_reminder:     notifDefaults.payroll_reminder      ?? false,
    budget_variance:      notifDefaults.budget_variance       ?? true,
  })
  const [lowCashThreshold, setLowCashThreshold] = useState(
    String(notifDefaults.low_cash_threshold ?? 50000)
  )
  const [savingNotifs, setSavingNotifs] = useState(false)

  const saveNotifications = async () => {
    if (!organization) return
    setSavingNotifs(true)
    const newSettings = {
      ...currentSettings,
      notifications: { ...notifications, low_cash_threshold: parseFloat(lowCashThreshold) || 50000 }
    }
    const { error } = await supabase
      .from('organizations')
      .update({ settings: newSettings })
      .eq('id', organization.id)

    if (error) {
      toast.error('Save failed: ' + error.message)
    } else {
      setOrganization({ ...organization, settings: newSettings })
      toast.success('Notification preferences saved')
    }
    setSavingNotifs(false)
  }

  return (
    <div className="space-y-5 animate-fade-up">
      <div>
        <h1 className="text-xl font-bold text-slate-900">Settings</h1>
        <p className="text-sm text-slate-500 mt-0.5">Configure your financial workspace</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-slate-100 p-1 rounded-xl w-fit overflow-x-auto">
        {TABS.map((t, i) => (
          <button key={t} onClick={() => setTab(i)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all whitespace-nowrap ${tab === i ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
            {t}
          </button>
        ))}
      </div>

      {/* ── TAB 0: Organization ── */}
      {tab === 0 && (
        <div className="card p-6 max-w-xl space-y-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-brand-50 flex items-center justify-center">
              <Building2 size={18} className="text-brand-600" />
            </div>
            <div>
              <h3 className="font-semibold text-slate-900">Organization Details</h3>
              <p className="text-xs text-slate-500">Saved directly to your database</p>
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <label className="input-label">Organization Name *</label>
              <input className="input" value={orgForm.name}
                onChange={e => setOrgForm(p => ({ ...p, name: e.target.value }))} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="input-label">Sector</label>
                <select className="input" value={orgForm.sector}
                  onChange={e => setOrgForm(p => ({ ...p, sector: e.target.value as Sector }))}>
                  {SECTORS.map(s => <option key={s.value} value={s.value}>{s.icon} {s.label}</option>)}
                </select>
              </div>
              <div>
                <label className="input-label">Base Currency</label>
                <select className="input" value={orgForm.base_currency}
                  onChange={e => setOrgForm(p => ({ ...p, base_currency: e.target.value }))}>
                  {CURRENCIES.map(c => <option key={c.code} value={c.code}>{c.code} — {c.name}</option>)}
                </select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="input-label">Country</label>
                <select className="input" value={orgForm.country}
                  onChange={e => setOrgForm(p => ({ ...p, country: e.target.value }))}>
                  {[
                    ['KE','Kenya'],['UG','Uganda'],['TZ','Tanzania'],
                    ['RW','Rwanda'],['NG','Nigeria'],['ZA','South Africa'],
                    ['GB','United Kingdom'],['US','United States'],
                  ].map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </select>
              </div>
              <div>
                <label className="input-label">Tax / KRA PIN</label>
                <input className="input" placeholder="A000000000X" value={orgForm.tax_id}
                  onChange={e => setOrgForm(p => ({ ...p, tax_id: e.target.value }))} />
              </div>
            </div>
          </div>

          <button onClick={saveOrg} disabled={saving} className="btn-primary">
            {saving ? <RefreshCw size={14} className="animate-spin" /> : <Save size={15} />}
            {saving ? 'Saving…' : 'Save Changes'}
          </button>
        </div>
      )}

      {/* ── TAB 1: Modules ── */}
      {tab === 1 && (
        <div className="space-y-4 max-w-2xl">
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 flex items-start gap-3">
            <Zap size={16} className="text-brand-600 mt-0.5 flex-shrink-0" />
            <p className="text-sm text-slate-700">Toggle modules on/off. Changes are saved to your workspace settings.</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {MODULES.map(m => {
              const isEnabled = enabledModules.includes(m.key)
              return (
                <div key={m.key}
                  className={`card p-4 flex items-center gap-3 transition-all ${
                    m.required ? 'opacity-75' : 'cursor-pointer hover:shadow-md'
                  } ${isEnabled ? 'ring-2 ring-brand-500' : ''}`}
                  >
                  <span className="text-2xl">{m.icon}</span>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-slate-900 text-sm flex items-center gap-2">
                      {m.label}
                      {m.required && <span className="text-xs text-slate-400 font-normal">(required)</span>}
                    </p>
                    <p className="text-xs text-slate-500 mt-0.5 leading-tight">{m.desc}</p>
                  </div>
                  <Toggle checked={isEnabled} onChange={() => !m.required && toggleModule(m.key)} />
                </div>
              )
            })}
          </div>
          <button onClick={saveModules} disabled={savingModules} className="btn-primary">
            {savingModules ? <RefreshCw size={14} className="animate-spin" /> : <Save size={15} />}
            {savingModules ? 'Saving…' : 'Save Module Preferences'}
          </button>
        </div>
      )}

      {/* ── TAB 2: Tax Policy ── */}
      {tab === 2 && (
        <div className="card p-6 max-w-2xl space-y-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-50 flex items-center justify-center">
              <CreditCard size={18} className="text-amber-600" />
            </div>
            <div>
              <h3 className="font-semibold text-slate-900">Tax Policy Configuration</h3>
              <p className="text-xs text-slate-500">Kenya Revenue Authority compliance settings</p>
            </div>
          </div>

          <div className="space-y-4">
            {[
              { label: 'VAT Rate (Standard)', key: 'vat_rate',        suffix: '%', min: 0, max: 100 },
              { label: 'Corporate Tax Rate',  key: 'corporate_tax',   suffix: '%', min: 0, max: 100 },
              { label: 'Withholding Tax Rate',key: 'withholding_tax', suffix: '%', min: 0, max: 100 },
            ].map(f => (
              <div key={f.key}>
                <label className="input-label">{f.label}</label>
                <div className="relative">
                  <input type="number" min={f.min} max={f.max} step="0.1" className="input pr-8"
                    value={(taxForm as any)[f.key]}
                    onChange={e => setTaxForm(p => ({ ...p, [f.key]: e.target.value }))} />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">{f.suffix}</span>
                </div>
              </div>
            ))}

            <div className="flex items-center justify-between p-4 bg-slate-50 rounded-xl">
              <div>
                <p className="font-medium text-slate-900 text-sm">Auto-calculate Tax on Transactions</p>
                <p className="text-xs text-slate-500 mt-0.5">Automatically compute VAT on invoices and bills</p>
              </div>
              <Toggle checked={taxForm.auto_calculate}
                onChange={v => setTaxForm(p => ({ ...p, auto_calculate: v }))} />
            </div>
            <div className="flex items-center justify-between p-4 bg-amber-50 rounded-xl">
              <div>
                <p className="font-medium text-slate-900 text-sm">Block Auto-remittance</p>
                <p className="text-xs text-slate-500 mt-0.5">Require manual approval before any tax payment</p>
              </div>
              <Toggle checked={taxForm.block_remittance}
                onChange={v => setTaxForm(p => ({ ...p, block_remittance: v }))} />
            </div>
          </div>

          <button onClick={saveTaxPolicy} disabled={savingTax} className="btn-primary">
            {savingTax ? <RefreshCw size={14} className="animate-spin" /> : <Save size={15} />}
            {savingTax ? 'Saving…' : 'Save Tax Policy'}
          </button>
        </div>
      )}

      {/* ── TAB 3: Security ── */}
      {tab === 3 && (
        <div className="space-y-4 max-w-xl">
          {/* Security toggles */}
          <div className="card p-6 space-y-4">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-xl bg-red-50 flex items-center justify-center">
                <Shield size={18} className="text-red-600" />
              </div>
              <h3 className="font-semibold text-slate-900">Security Settings</h3>
            </div>

            {[
              { key: 'two_factor',      label: 'Two-Factor Authentication',  desc: 'Require OTP on every login' },
              { key: 'ip_whitelist',    label: 'IP Whitelisting',            desc: 'Restrict access to approved IPs' },
              { key: 'audit_log',       label: 'Audit Log',                  desc: 'Record every action with timestamp' },
              { key: 'session_timeout', label: 'Session Timeout (30 min)',   desc: 'Auto-logout after inactivity' },
            ].map(s => (
              <div key={s.key} className="flex items-center justify-between p-3 bg-slate-50 rounded-xl">
                <div>
                  <p className="font-medium text-slate-900 text-sm">{s.label}</p>
                  <p className="text-xs text-slate-500 mt-0.5">{s.desc}</p>
                </div>
                <Toggle
                  checked={(security as any)[s.key]}
                  onChange={v => setSecurity(p => ({ ...p, [s.key]: v }))}
                />
              </div>
            ))}

            <button onClick={saveSecurity} disabled={savingSecurity} className="btn-primary">
              {savingSecurity ? <RefreshCw size={14} className="animate-spin" /> : <Save size={15} />}
              {savingSecurity ? 'Saving…' : 'Save Security Settings'}
            </button>
          </div>

          {/* Change password */}
          <div className="card p-6 space-y-4">
            <div className="flex items-center gap-3 mb-1">
              <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center">
                <Key size={18} className="text-slate-600" />
              </div>
              <div>
                <h3 className="font-semibold text-slate-900">Change Password</h3>
                <p className="text-xs text-slate-500">Logged in as {profile?.email}</p>
              </div>
            </div>

            <div className="space-y-3">
              {[
                { key: 'current', label: 'Current Password',  placeholder: 'Enter current password' },
                { key: 'newPass', label: 'New Password',       placeholder: 'Min. 8 characters' },
                { key: 'confirm', label: 'Confirm New Password', placeholder: 'Repeat new password' },
              ].map(f => (
                <div key={f.key}>
                  <label className="input-label">{f.label}</label>
                  <div className="relative">
                    <input
                      type={showPasswords ? 'text' : 'password'}
                      className="input pr-10"
                      placeholder={f.placeholder}
                      value={(passwordForm as any)[f.key]}
                      onChange={e => setPasswordForm(p => ({ ...p, [f.key]: e.target.value }))}
                    />
                    {f.key === 'newPass' && (
                      <button type="button" onClick={() => setShowPasswords(p => !p)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                        {showPasswords ? <EyeOff size={15} /> : <Eye size={15} />}
                      </button>
                    )}
                  </div>
                </div>
              ))}
              {passwordForm.newPass && passwordForm.confirm && passwordForm.newPass !== passwordForm.confirm && (
                <p className="text-xs text-red-500 flex items-center gap-1"><AlertTriangle size={11} />Passwords do not match</p>
              )}
              {passwordForm.newPass && passwordForm.confirm && passwordForm.newPass === passwordForm.confirm && passwordForm.newPass.length >= 8 && (
                <p className="text-xs text-green-600 flex items-center gap-1"><CheckCircle2 size={11} />Passwords match</p>
              )}
            </div>

            <button onClick={changePassword} disabled={savingPassword} className="btn-primary">
              {savingPassword ? <RefreshCw size={14} className="animate-spin" /> : <Lock size={15} />}
              {savingPassword ? 'Updating…' : 'Update Password'}
            </button>
          </div>
        </div>
      )}

      {/* ── TAB 4: Notifications ── */}
      {tab === 4 && (
        <div className="card p-6 max-w-xl space-y-1">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-xl bg-purple-50 flex items-center justify-center">
              <Bell size={18} className="text-purple-600" />
            </div>
            <div>
              <h3 className="font-semibold text-slate-900">Notification Preferences</h3>
              <p className="text-xs text-slate-500">Saved to your workspace settings</p>
            </div>
          </div>

          {[
            { key: 'tax_reminders',     label: 'Tax Reminders',           desc: '7 days before KRA due date' },
            { key: 'overdue_invoices',  label: 'Overdue Invoice Alerts',  desc: 'Daily digest of overdue invoices' },
            { key: 'ai_anomaly_alerts', label: 'AI Anomaly Alerts',       desc: 'Unusual transactions detected' },
            { key: 'payroll_reminder',  label: 'Payroll Reminder',        desc: '3 days before payroll run' },
            { key: 'budget_variance',   label: 'Budget Variance Alert',   desc: 'When spending exceeds 90% of budget' },
          ].map(n => (
            <div key={n.key} className="flex items-center justify-between py-3 border-b border-slate-100 last:border-0">
              <div>
                <p className="text-sm font-medium text-slate-900">{n.label}</p>
                <p className="text-xs text-slate-500 mt-0.5">{n.desc}</p>
              </div>
              <Toggle
                checked={(notifications as any)[n.key]}
                onChange={v => setNotifications(p => ({ ...p, [n.key]: v }))}
              />
            </div>
          ))}

          {/* Low cash threshold */}
          <div className="flex items-center justify-between py-3 border-b border-slate-100">
            <div>
              <div className="flex items-center gap-3">
                <div>
                  <p className="text-sm font-medium text-slate-900">Low Cash Balance Warning</p>
                  <p className="text-xs text-slate-500 mt-0.5">Alert when cash drops below threshold</p>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs">KES</span>
                <input
                  type="number" min="0"
                  className="input text-right text-sm w-32 pl-10"
                  value={lowCashThreshold}
                  onChange={e => setLowCashThreshold(e.target.value)}
                />
              </div>
              <Toggle
                checked={notifications.low_cash_warning}
                onChange={v => setNotifications(p => ({ ...p, low_cash_warning: v }))}
              />
            </div>
          </div>

          <div className="pt-4">
            <button onClick={saveNotifications} disabled={savingNotifs} className="btn-primary">
              {savingNotifs ? <RefreshCw size={14} className="animate-spin" /> : <Save size={15} />}
              {savingNotifs ? 'Saving…' : 'Save Preferences'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

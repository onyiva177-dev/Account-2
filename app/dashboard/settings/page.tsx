'use client'

import { useState } from 'react'
import { useAppStore } from '@/lib/store'
import { SECTORS, CURRENCIES } from '@/lib/utils'
import type { Sector } from '@/types'
import { Settings, Building2, Shield, Bell, Database, CreditCard, Globe, Zap, Save } from 'lucide-react'
import toast from 'react-hot-toast'

const MODULES = [
  { key: 'accounting', label: 'Accounting Core', desc: 'Journal entries, ledger, trial balance', icon: '📒', required: true },
  { key: 'tax', label: 'Tax & Compliance', desc: 'VAT, PAYE, corporate tax calculations', icon: '🧾', required: false },
  { key: 'payroll', label: 'Payroll', desc: 'Employee salary, PAYE, NHIF, NSSF', icon: '💰', required: false },
  { key: 'pos', label: 'Point of Sale', desc: 'Sales, receipts, barcode scanning', icon: '🛍️', required: false },
  { key: 'inventory', label: 'Inventory', desc: 'Stock tracking and management', icon: '📦', required: false },
  { key: 'budgeting', label: 'Budgets & Forecasting', desc: 'Budget planning and variance', icon: '📊', required: false },
  { key: 'banking', label: 'Banking & Reconciliation', desc: 'Bank feeds and reconciliation', icon: '🏦', required: false },
  { key: 'analytics', label: 'Analytics', desc: 'AI-powered financial intelligence', icon: '🤖', required: false },
]

const TABS = ['Organization', 'Modules', 'Tax Policy', 'Security', 'Notifications']

export default function SettingsPage() {
  const { organization, profile } = useAppStore()
  const [tab, setTab] = useState(0)
  const [enabledModules, setEnabledModules] = useState(['accounting', 'tax', 'payroll', 'inventory', 'banking', 'analytics', 'reports'])
  const [orgForm, setOrgForm] = useState({
    name: organization?.name || '',
    sector: organization?.sector || 'business',
    country: organization?.country || 'KE',
    base_currency: organization?.base_currency || 'KES',
    tax_id: organization?.tax_id || '',
  })

  const toggleModule = (key: string) => {
    if (key === 'accounting') return // required
    setEnabledModules(prev => prev.includes(key) ? prev.filter(m => m !== key) : [...prev, key])
  }

  const saveOrg = () => {
    toast.success('Organization settings saved')
  }

  return (
    <div className="space-y-5 animate-fade-up">
      <div>
        <h1 className="text-xl font-bold text-slate-900">Settings</h1>
        <p className="text-sm text-slate-500 mt-0.5">Configure your financial workspace</p>
      </div>

      <div className="flex gap-1 bg-slate-100 p-1 rounded-xl w-fit">
        {TABS.map((t, i) => (
          <button
            key={t}
            onClick={() => setTab(i)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all whitespace-nowrap ${tab === i ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
          >
            {t}
          </button>
        ))}
      </div>

      {/* Organization */}
      {tab === 0 && (
        <div className="card p-6 max-w-xl space-y-5">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-xl bg-brand-50 flex items-center justify-center">
              <Building2 size={18} className="text-brand-600" />
            </div>
            <div>
              <h3 className="font-semibold text-slate-900">Organization Details</h3>
              <p className="text-xs text-slate-500">Update your organization information</p>
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <label className="input-label">Organization Name</label>
              <input className="input" value={orgForm.name} onChange={e => setOrgForm(p => ({ ...p, name: e.target.value }))} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="input-label">Sector</label>
                <select className="input" value={orgForm.sector} onChange={e => setOrgForm(p => ({ ...p, sector: e.target.value as Sector }))}>
                  {SECTORS.map(s => <option key={s.value} value={s.value}>{s.icon} {s.label}</option>)}
                </select>
              </div>
              <div>
                <label className="input-label">Base Currency</label>
                <select className="input" value={orgForm.base_currency} onChange={e => setOrgForm(p => ({ ...p, base_currency: e.target.value }))}>
                  {CURRENCIES.map(c => <option key={c.code} value={c.code}>{c.code} — {c.name}</option>)}
                </select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="input-label">Country</label>
                <select className="input" value={orgForm.country} onChange={e => setOrgForm(p => ({ ...p, country: e.target.value }))}>
                  <option value="KE">Kenya</option>
                  <option value="UG">Uganda</option>
                  <option value="TZ">Tanzania</option>
                  <option value="RW">Rwanda</option>
                  <option value="NG">Nigeria</option>
                  <option value="ZA">South Africa</option>
                  <option value="GB">United Kingdom</option>
                  <option value="US">United States</option>
                </select>
              </div>
              <div>
                <label className="input-label">Tax / KRA PIN</label>
                <input className="input" placeholder="A000000000X" value={orgForm.tax_id} onChange={e => setOrgForm(p => ({ ...p, tax_id: e.target.value }))} />
              </div>
            </div>
          </div>
          <button onClick={saveOrg} className="btn-primary">
            <Save size={15} />Save Changes
          </button>
        </div>
      )}

      {/* Modules */}
      {tab === 1 && (
        <div className="space-y-4">
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 flex items-start gap-3 max-w-2xl">
            <Zap size={16} className="text-brand-600 mt-0.5" />
            <p className="text-sm text-slate-700">Enable or disable modules to customize your workspace. Core accounting is always enabled.</p>
          </div>
          <div className="grid grid-cols-2 gap-3 max-w-2xl">
            {MODULES.map(m => {
              const isEnabled = enabledModules.includes(m.key)
              return (
                <div
                  key={m.key}
                  className={`card p-4 flex items-center gap-3 cursor-pointer transition-all ${isEnabled ? 'ring-2 ring-brand-500' : ''}`}
                  onClick={() => toggleModule(m.key)}
                >
                  <span className="text-2xl">{m.icon}</span>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-slate-900 text-sm">{m.label}</p>
                    <p className="text-xs text-slate-500 mt-0.5 leading-tight">{m.desc}</p>
                  </div>
                  <div className={`w-11 h-6 rounded-full transition-colors flex-shrink-0 relative ${isEnabled ? 'bg-brand-600' : 'bg-slate-200'}`}>
                    <div className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-transform ${isEnabled ? 'translate-x-6' : 'translate-x-1'}`} />
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Tax Policy */}
      {tab === 2 && (
        <div className="card p-6 max-w-2xl space-y-5">
          <div className="flex items-center gap-3 mb-2">
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
              { label: 'VAT Rate (Standard)', type: 'number', value: '16', suffix: '%' },
              { label: 'Corporate Tax Rate', type: 'number', value: '30', suffix: '%' },
              { label: 'Withholding Tax Rate', type: 'number', value: '5', suffix: '%' },
            ].map(f => (
              <div key={f.label}>
                <label className="input-label">{f.label}</label>
                <div className="relative">
                  <input type={f.type} className="input pr-8" defaultValue={f.value} />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">{f.suffix}</span>
                </div>
              </div>
            ))}
            <div className="flex items-center justify-between p-4 bg-slate-50 rounded-xl">
              <div>
                <p className="font-medium text-slate-900 text-sm">Auto-calculate Tax on Transactions</p>
                <p className="text-xs text-slate-500 mt-0.5">Automatically compute VAT on invoices and bills</p>
              </div>
              <div className="w-11 h-6 rounded-full bg-brand-600 relative cursor-pointer">
                <div className="absolute top-1 right-1 w-4 h-4 bg-white rounded-full shadow" />
              </div>
            </div>
            <div className="flex items-center justify-between p-4 bg-amber-50 rounded-xl">
              <div>
                <p className="font-medium text-slate-900 text-sm">Block Auto-remittance</p>
                <p className="text-xs text-slate-500 mt-0.5">Require manual approval before any tax payment</p>
              </div>
              <div className="w-11 h-6 rounded-full bg-brand-600 relative cursor-pointer">
                <div className="absolute top-1 right-1 w-4 h-4 bg-white rounded-full shadow" />
              </div>
            </div>
          </div>
          <button className="btn-primary"><Save size={15} />Save Tax Policy</button>
        </div>
      )}

      {/* Security */}
      {tab === 3 && (
        <div className="card p-6 max-w-xl space-y-5">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-xl bg-red-50 flex items-center justify-center">
              <Shield size={18} className="text-red-600" />
            </div>
            <h3 className="font-semibold text-slate-900">Security Settings</h3>
          </div>
          <div className="space-y-3">
            {[
              { label: 'Two-Factor Authentication', enabled: false },
              { label: 'IP Whitelisting', enabled: false },
              { label: 'Audit Log Enabled', enabled: true },
              { label: 'Session Timeout (30 min)', enabled: true },
            ].map(s => (
              <div key={s.label} className="flex items-center justify-between p-4 bg-slate-50 rounded-xl">
                <p className="font-medium text-slate-900 text-sm">{s.label}</p>
                <div className={`w-11 h-6 rounded-full relative cursor-pointer transition-colors ${s.enabled ? 'bg-brand-600' : 'bg-slate-200'}`}>
                  <div className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-transform ${s.enabled ? 'translate-x-6' : 'translate-x-1'}`} />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Notifications */}
      {tab === 4 && (
        <div className="card p-6 max-w-xl space-y-4">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-xl bg-purple-50 flex items-center justify-center">
              <Bell size={18} className="text-purple-600" />
            </div>
            <h3 className="font-semibold text-slate-900">Notification Preferences</h3>
          </div>
          {[
            { label: 'Tax Reminders', desc: '7 days before due date', enabled: true },
            { label: 'Overdue Invoice Alerts', desc: 'Daily digest of overdue invoices', enabled: true },
            { label: 'Low Cash Balance Warning', desc: 'Below KES 50,000', enabled: true },
            { label: 'AI Anomaly Alerts', desc: 'Unusual transactions detected', enabled: true },
            { label: 'Payroll Reminder', desc: '3 days before payroll run', enabled: false },
            { label: 'Budget Variance Alert', desc: 'When spending exceeds 90%', enabled: true },
          ].map(n => (
            <div key={n.label} className="flex items-center justify-between py-3 border-b border-slate-100 last:border-0">
              <div>
                <p className="text-sm font-medium text-slate-900">{n.label}</p>
                <p className="text-xs text-slate-500 mt-0.5">{n.desc}</p>
              </div>
              <div className={`w-11 h-6 rounded-full relative cursor-pointer transition-colors ${n.enabled ? 'bg-brand-600' : 'bg-slate-200'}`}>
                <div className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-transform ${n.enabled ? 'translate-x-6' : 'translate-x-1'}`} />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

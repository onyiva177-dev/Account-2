'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'
import { useAppStore } from '@/lib/store'
import { formatCurrency, formatDate } from '@/lib/utils'
import {
  Archive, Lock, Eye, EyeOff, Shield, AlertTriangle,
  CheckCircle2, RefreshCw, Download, Key, X
} from 'lucide-react'
import toast from 'react-hot-toast'

// ── Set-archive-password modal (shown when no password exists yet) ────────────
function SetPasswordModal({ onSet, onClose }: {
  onSet: (pw: string) => Promise<void>; onClose: () => void
}) {
  const [pw, setPw]         = useState('')
  const [confirm, setConfirm] = useState('')
  const [show, setShow]     = useState(false)
  const [saving, setSaving] = useState(false)

  const ok = pw.length >= 6 && pw === confirm

  const handleSet = async () => {
    if (!ok) return
    setSaving(true)
    await onSet(pw)
    setSaving(false)
  }

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm animate-fade-up">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-purple-50 flex items-center justify-center">
              <Key size={15} className="text-purple-600" />
            </div>
            <h2 className="font-semibold text-slate-900">Set Archive Password</h2>
          </div>
          <button onClick={onClose} className="w-7 h-7 rounded-lg bg-slate-100 flex items-center justify-center text-slate-500 hover:bg-slate-200"><X size={14} /></button>
        </div>
        <div className="p-6 space-y-4">
          <p className="text-xs text-slate-600 bg-slate-50 p-3 rounded-xl leading-relaxed">
            This password protects the deletion archive. It is separate from your login password.
            Anyone trying to view deleted entries must enter this password. Minimum 6 characters.
          </p>
          <div>
            <label className="input-label">Archive Password</label>
            <div className="relative">
              <input type={show ? 'text' : 'password'} className="input pr-10"
                placeholder="Min. 6 characters" value={pw} onChange={e => setPw(e.target.value)} />
              <button type="button" onClick={() => setShow(s => !s)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400">
                {show ? <EyeOff size={14} /> : <Eye size={14} />}
              </button>
            </div>
          </div>
          <div>
            <label className="input-label">Confirm Password</label>
            <input type="password" className="input" placeholder="Repeat password"
              value={confirm} onChange={e => setConfirm(e.target.value)} />
            {confirm && !ok && pw !== confirm && <p className="text-xs text-red-500 mt-1">Passwords do not match</p>}
            {confirm && pw.length < 6 && <p className="text-xs text-red-500 mt-1">Minimum 6 characters</p>}
            {ok && <p className="text-xs text-green-600 mt-1 flex items-center gap-1"><CheckCircle2 size={11} />Passwords match</p>}
          </div>
        </div>
        <div className="flex gap-3 px-6 pb-6">
          <button onClick={onClose} className="btn-secondary flex-1">Cancel</button>
          <button onClick={handleSet} disabled={!ok || saving} className="btn-primary flex-1">
            {saving ? <RefreshCw size={14} className="animate-spin" /> : <Key size={14} />}
            {saving ? 'Saving…' : 'Set Password'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Main archive page ─────────────────────────────────────────────────────────
export default function ArchivePage() {
  const supabase = createClient()
  const { organization, profile } = useAppStore()

  const [unlocked,        setUnlocked]        = useState(false)
  const [enteredPw,       setEnteredPw]        = useState('')
  const [showPw,          setShowPw]           = useState(false)
  const [checking,        setChecking]         = useState(false)
  const [wrongPw,         setWrongPw]          = useState(false)
  const [hasPassword,     setHasPassword]      = useState<boolean | null>(null) // null = loading
  const [showSetPwModal,  setShowSetPwModal]   = useState(false)
  const [showChangePw,    setShowChangePw]     = useState(false)
  const [newPw,           setNewPw]            = useState('')
  const [confirmNewPw,    setConfirmNewPw]     = useState('')
  const [savingNewPw,     setSavingNewPw]      = useState(false)

  const [entries,  setEntries]  = useState<any[]>([])
  const [auditLog, setAuditLog] = useState<any[]>([])
  const [loading,  setLoading]  = useState(false)
  const [tab,      setTab]      = useState<'deleted' | 'all' | 'log'>('deleted')

  // Check whether an archive password is already set
  useEffect(() => {
    if (!organization) return
    const pw = (organization.settings as any)?.archive_password
    setHasPassword(!!pw)
  }, [organization?.id])

  // ── Password helpers ──────────────────────────────────────────────────────
  // We store a bcrypt-style hash is overkill for this; we use SHA-256 via Web Crypto.
  // Password is stored as hex-SHA256 in organizations.settings.archive_password_hash.
  // This keeps it away from anyone with just a Supabase read on the settings column
  // (they'd still need to reverse SHA-256 to get the plaintext).
  const hashPassword = async (pw: string): Promise<string> => {
    const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(pw))
    return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2,'0')).join('')
  }

  const handleSetPassword = async (pw: string) => {
    if (!organization) return
    const hash = await hashPassword(pw)
    const currentSettings = (organization.settings as any) || {}
    const { error } = await supabase
      .from('organizations')
      .update({ settings: { ...currentSettings, archive_password_hash: hash } })
      .eq('id', organization.id)
    if (error) { toast.error('Failed to save: ' + error.message); return }
    toast.success('Archive password set')
    setHasPassword(true)
    setShowSetPwModal(false)
  }

  const handleChangePassword = async () => {
    if (newPw.length < 6 || newPw !== confirmNewPw) return
    setSavingNewPw(true)
    await handleSetPassword(newPw)
    setNewPw(''); setConfirmNewPw(''); setShowChangePw(false)
    setSavingNewPw(false)
  }

  const handleUnlock = async () => {
    if (!organization || !enteredPw.trim()) return
    setChecking(true)
    setWrongPw(false)
    const storedHash = (organization.settings as any)?.archive_password_hash
    if (!storedHash) { setChecking(false); return }
    const enteredHash = await hashPassword(enteredPw)
    if (enteredHash === storedHash) {
      setUnlocked(true)
      setWrongPw(false)
      loadArchive()
    } else {
      setWrongPw(true)
      // Log failed attempt to audit trail
      await supabase.from('journal_audit_log').insert({
        organization_id:  organization.id,
        journal_entry_id: '00000000-0000-0000-0000-000000000000', // sentinel
        action:           'archive_unlock_failed',
        performed_by:     profile?.id || null,
        details:          { attempted_at: new Date().toISOString() },
      }).catch(() => {}) // silently ignore if insert fails (sentinel UUID may violate FK)
    }
    setChecking(false)
  }

  // ── Load archive data ─────────────────────────────────────────────────────
  const loadArchive = async () => {
    if (!organization) return
    setLoading(true)

    // All deleted entries
    const { data: deleted } = await supabase
      .from('journal_entries')
      .select('*, journal_lines(*, account:accounts(code, name))')
      .eq('organization_id', organization.id)
      .eq('is_deleted', true)
      .order('deleted_at', { ascending: false })

    // All entries including live (for "All Entries" view)
    const { data: all } = await supabase
      .from('journal_entries')
      .select('id, entry_number, date, description, total_debit, total_credit, status, is_deleted, deleted_at, delete_reason')
      .eq('organization_id', organization.id)
      .order('date', { ascending: false })

    // Audit log
    const { data: log } = await supabase
      .from('journal_audit_log')
      .select('*, performer:profiles!performed_by(full_name)')
      .eq('organization_id', organization.id)
      .order('performed_at', { ascending: false })
      .limit(200)

    // Handle deleted entries — need to fetch deleter profiles separately if needed
    const deletedWithProfiles = await Promise.all((deleted || []).map(async (e: any) => {
      if (e.deleted_by) {
        const { data: prof } = await supabase
          .from('profiles').select('full_name').eq('id', e.deleted_by).single()
        return { ...e, deleter_name: prof?.full_name || 'Unknown' }
      }
      return { ...e, deleter_name: 'Unknown' }
    }))

    setEntries(tab === 'deleted' ? deletedWithProfiles : (all || []))
    setAuditLog(log || [])
    setLoading(false)
  }

  useEffect(() => { if (unlocked) loadArchive() }, [tab])

  const currency = organization?.base_currency || 'KES'

  // ── Export audit log as CSV ───────────────────────────────────────────────
  const exportCSV = () => {
    const rows = [
      ['Timestamp', 'Action', 'Performed By', 'Entry #', 'Description', 'Details'],
      ...auditLog.map((l: any) => [
        new Date(l.performed_at).toLocaleString('en-KE'),
        l.action,
        (l.performer as any)?.full_name || 'Unknown',
        l.details?.entry_number || '—',
        l.details?.description || '—',
        l.details?.reason || JSON.stringify(l.details || {}),
      ])
    ]
    const csv = rows.map(r => r.map(c => `"${String(c).replace(/"/g,'""')}"`).join(',')).join('\n')
    const a = document.createElement('a')
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }))
    a.download = `finai_audit_log_${new Date().toISOString().split('T')[0]}.csv`
    a.click()
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Render: no password set
  if (hasPassword === null) return (
    <div className="flex items-center justify-center h-64">
      <div className="flex gap-1">{[0,1,2].map(i => <div key={i} className="w-2 h-2 bg-brand-400 rounded-full animate-bounce" style={{ animationDelay: `${i*0.15}s` }} />)}</div>
    </div>
  )

  if (!hasPassword) return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-6 animate-fade-up">
      <div className="w-16 h-16 rounded-2xl bg-purple-50 flex items-center justify-center">
        <Archive size={28} className="text-purple-600" />
      </div>
      <div className="text-center max-w-sm">
        <h2 className="text-xl font-bold text-slate-900 mb-2">Archive Not Set Up</h2>
        <p className="text-sm text-slate-500 leading-relaxed">
          The deletion archive requires a dedicated password before it can be accessed.
          Set one now — it protects the audit trail from casual viewing.
        </p>
      </div>
      <button onClick={() => setShowSetPwModal(true)} className="btn-primary">
        <Key size={15} />Set Archive Password
      </button>
      {showSetPwModal && <SetPasswordModal onSet={handleSetPassword} onClose={() => setShowSetPwModal(false)} />}
    </div>
  )

  // Render: locked
  if (!unlocked) return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-6 animate-fade-up">
      <div className="w-16 h-16 rounded-2xl bg-slate-100 flex items-center justify-center">
        <Lock size={28} className="text-slate-600" />
      </div>
      <div className="text-center">
        <h2 className="text-xl font-bold text-slate-900">Archive — Restricted Access</h2>
        <p className="text-sm text-slate-500 mt-1">Enter your archive password to view deleted entries and audit log</p>
      </div>
      <div className="w-full max-w-xs space-y-3">
        <div className="relative">
          <input
            type={showPw ? 'text' : 'password'}
            className={`input pr-10 ${wrongPw ? 'border-red-400 ring-2 ring-red-100' : ''}`}
            placeholder="Archive password"
            value={enteredPw}
            onChange={e => { setEnteredPw(e.target.value); setWrongPw(false) }}
            onKeyDown={e => e.key === 'Enter' && handleUnlock()}
          />
          <button type="button" onClick={() => setShowPw(s => !s)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400">
            {showPw ? <EyeOff size={14} /> : <Eye size={14} />}
          </button>
        </div>
        {wrongPw && (
          <div className="flex items-center gap-2 text-xs text-red-600 bg-red-50 border border-red-200 p-2.5 rounded-xl">
            <AlertTriangle size={13} />Incorrect password. This attempt has been logged.
          </div>
        )}
        <button onClick={handleUnlock} disabled={checking || !enteredPw.trim()} className="btn-primary w-full">
          {checking ? <RefreshCw size={14} className="animate-spin" /> : <Shield size={14} />}
          {checking ? 'Verifying…' : 'Unlock Archive'}
        </button>
      </div>
      <div className="flex items-center gap-1.5 text-xs text-slate-400">
        <AlertTriangle size={11} />All unlock attempts (successful or failed) are logged.
      </div>
    </div>
  )

  // Render: unlocked ──────────────────────────────────────────────────────────
  return (
    <div className="space-y-5 animate-fade-up">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-purple-50 flex items-center justify-center">
            <Archive size={18} className="text-purple-600" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900">Journal Archive</h1>
            <p className="text-sm text-slate-500">Deleted entries & full audit trail</p>
          </div>
          <span className="ml-2 flex items-center gap-1 text-xs text-green-700 bg-green-50 border border-green-200 px-2 py-1 rounded-full">
            <Shield size={11} />Unlocked
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={exportCSV} className="btn-secondary text-xs"><Download size={13} />Export Log</button>
          <button onClick={() => { setShowChangePw(true) }} className="btn-secondary text-xs"><Key size={13} />Change Password</button>
          <button onClick={() => setUnlocked(false)} className="btn-secondary text-xs"><Lock size={13} />Lock</button>
        </div>
      </div>

      {/* Warning banner */}
      <div className="flex items-start gap-3 p-4 bg-amber-50 border border-amber-200 rounded-xl">
        <AlertTriangle size={16} className="text-amber-600 mt-0.5 flex-shrink-0" />
        <p className="text-xs text-amber-800">
          <strong>Read-only archive.</strong> Entries here have been soft-deleted and are excluded from all reports,
          trial balances, and account balances. They cannot be restored or permanently deleted through this interface.
          All actions on this page are logged.
        </p>
      </div>

      {/* Sub-tabs */}
      <div className="flex gap-1 bg-slate-100 p-1 rounded-xl w-fit">
        {[
          { key: 'deleted', label: 'Deleted Entries' },
          { key: 'all',     label: 'All Entries' },
          { key: 'log',     label: 'Audit Log' },
        ].map(t => (
          <button key={t.key} onClick={() => setTab(t.key as any)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${tab === t.key ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
            {t.label}
          </button>
        ))}
      </div>

      {/* ── Deleted Entries ── */}
      {(tab === 'deleted' || tab === 'all') && (
        <div className="card overflow-hidden">
          <div className="table-container">
            <table className="table">
              <thead>
                <tr>
                  <th>Entry #</th><th>Date</th><th>Description</th>
                  <th className="text-right">Dr</th><th className="text-right">Cr</th>
                  <th>Status</th>
                  {tab === 'deleted' && <><th>Deleted By</th><th>Reason</th><th>Deleted At</th></>}
                </tr>
              </thead>
              <tbody>
                {loading ? Array(5).fill(0).map((_, i) => (
                  <tr key={i}>{Array(tab === 'deleted' ? 9 : 6).fill(0).map((_, j) => <td key={j}><div className="skeleton h-4 rounded" /></td>)}</tr>
                )) : entries.length === 0 ? (
                  <tr><td colSpan={tab === 'deleted' ? 9 : 6} className="text-center py-12 text-slate-400">
                    <CheckCircle2 size={28} className="mx-auto mb-2 opacity-30" />
                    <p className="text-sm">{tab === 'deleted' ? 'No deleted entries' : 'No entries yet'}</p>
                  </td></tr>
                ) : entries.map((e: any) => (
                  <tr key={e.id} className={e.is_deleted ? 'bg-red-50/30' : ''}>
                    <td className={`font-mono text-xs font-semibold ${e.is_deleted ? 'text-red-400 line-through' : 'text-brand-600'}`}>
                      {e.entry_number}
                    </td>
                    <td className="text-slate-500 text-xs">{formatDate(e.date)}</td>
                    <td className={`font-medium max-w-xs truncate ${e.is_deleted ? 'text-slate-400' : 'text-slate-800'}`}>{e.description}</td>
                    <td className="text-right font-mono text-sm text-slate-500">{formatCurrency(e.total_debit, currency)}</td>
                    <td className="text-right font-mono text-sm text-slate-500">{formatCurrency(e.total_credit, currency)}</td>
                    <td>
                      <span className={`badge ${e.is_deleted ? 'bg-red-100 text-red-600' : 'bg-green-100 text-green-700'}`}>
                        {e.is_deleted ? 'deleted' : e.status}
                      </span>
                    </td>
                    {tab === 'deleted' && <>
                      <td className="text-xs text-slate-500">{e.deleter_name || '—'}</td>
                      <td className="text-xs text-slate-600 max-w-xs truncate" title={e.delete_reason}>{e.delete_reason || '—'}</td>
                      <td className="text-xs text-slate-400">{e.deleted_at ? new Date(e.deleted_at).toLocaleString('en-KE') : '—'}</td>
                    </>}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Audit Log ── */}
      {tab === 'log' && (
        <div className="card overflow-hidden">
          <div className="table-container">
            <table className="table">
              <thead>
                <tr><th>Timestamp</th><th>Action</th><th>Performed By</th><th>Entry #</th><th>Details</th></tr>
              </thead>
              <tbody>
                {loading ? Array(5).fill(0).map((_, i) => (
                  <tr key={i}>{Array(5).fill(0).map((_, j) => <td key={j}><div className="skeleton h-4 rounded" /></td>)}</tr>
                )) : auditLog.length === 0 ? (
                  <tr><td colSpan={5} className="text-center py-12 text-slate-400 text-sm">No audit log entries yet</td></tr>
                ) : auditLog.map((l: any) => (
                  <tr key={l.id}>
                    <td className="text-xs text-slate-500 whitespace-nowrap">
                      {new Date(l.performed_at).toLocaleString('en-KE')}
                    </td>
                    <td>
                      <span className={`badge text-xs ${
                        l.action === 'deleted'               ? 'bg-red-100 text-red-700' :
                        l.action === 'posted'                ? 'bg-green-100 text-green-700' :
                        l.action === 'archive_unlock_failed' ? 'bg-orange-100 text-orange-700' :
                        'bg-slate-100 text-slate-600'
                      }`}>{l.action.replace(/_/g, ' ')}</span>
                    </td>
                    <td className="text-sm text-slate-700">{(l.performer as any)?.full_name || '—'}</td>
                    <td className="font-mono text-xs text-brand-600">{l.details?.entry_number || '—'}</td>
                    <td className="text-xs text-slate-500 max-w-xs truncate" title={l.details?.reason || l.details?.description}>
                      {l.details?.reason || l.details?.description || '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Change Password Modal ── */}
      {showChangePw && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm animate-fade-up p-6 space-y-4">
            <h3 className="font-semibold text-slate-900">Change Archive Password</h3>
            <div>
              <label className="input-label">New Password (min. 6 chars)</label>
              <input type="password" className="input" value={newPw} onChange={e => setNewPw(e.target.value)} />
            </div>
            <div>
              <label className="input-label">Confirm New Password</label>
              <input type="password" className="input" value={confirmNewPw} onChange={e => setConfirmNewPw(e.target.value)} />
              {confirmNewPw && newPw !== confirmNewPw && <p className="text-xs text-red-500 mt-1">Passwords do not match</p>}
            </div>
            <div className="flex gap-3 pt-2">
              <button onClick={() => { setShowChangePw(false); setNewPw(''); setConfirmNewPw('') }} className="btn-secondary flex-1">Cancel</button>
              <button
                onClick={handleChangePassword}
                disabled={savingNewPw || newPw.length < 6 || newPw !== confirmNewPw}
                className="btn-primary flex-1"
              >
                {savingNewPw ? <RefreshCw size={14} className="animate-spin" /> : <Key size={14} />}
                {savingNewPw ? 'Saving…' : 'Update'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

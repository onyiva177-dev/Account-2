'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'
import { useAppStore } from '@/lib/store'
import { formatCurrency, formatDate, getStatusColor } from '@/lib/utils'
import {
  Plus, Search, Filter, Eye, CheckCircle2, BookOpen, Edit2,
  AlertCircle, X, AlertTriangle, GitBranch, Trash2, Archive
} from 'lucide-react'
import toast from 'react-hot-toast'
import type { JournalEntry, Account } from '@/types'

const TABS = ['Journal Entries', 'Chart of Accounts', 'Trial Balance']
const CATEGORY_ORDER = ['asset', 'liability', 'equity', 'revenue', 'expense']

// ── Sub-account picker (dropdown when parent has children) ────────────────────
function SubAccountPicker({ parentAccount, children, value, onChange }: {
  parentAccount: Account; children: Account[]; value: string; onChange: (id: string) => void
}) {
  if (!children.length) return (
    <input className="input text-xs text-slate-500" placeholder="Narration (optional)" readOnly />
  )
  return (
    <select className="input text-xs" value={value} onChange={e => onChange(e.target.value)}>
      <option value={parentAccount.id}>— Use parent ({parentAccount.name})</option>
      {children.map(c => <option key={c.id} value={c.id}>{c.code} — {c.name}</option>)}
    </select>
  )
}

// ── Delete confirmation modal ─────────────────────────────────────────────────
function DeleteModal({ entry, onConfirm, onClose, loading }: {
  entry: JournalEntry; onConfirm: (reason: string) => void; onClose: () => void; loading: boolean
}) {
  const [reason, setReason] = useState('')
  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md animate-fade-up">
        <div className="p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-xl bg-red-50 flex items-center justify-center flex-shrink-0">
              <Trash2 size={18} className="text-red-500" />
            </div>
            <div>
              <h3 className="font-semibold text-slate-900">Delete Journal Entry</h3>
              <p className="text-xs text-slate-500">{entry.entry_number} · {formatDate(entry.date)}</p>
            </div>
          </div>
          <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl mb-4">
            <p className="text-xs text-amber-800">
              <strong>This entry will be soft-deleted.</strong> It will no longer affect account
              balances or reports, but remains permanently in the audit archive for security.
              A deletion record is logged with your user ID and timestamp.
            </p>
          </div>
          <div className="mb-4">
            <label className="input-label">Reason for deletion *</label>
            <textarea
              className="input resize-none text-sm"
              rows={3}
              placeholder="e.g. Duplicate entry, incorrect account used…"
              value={reason}
              onChange={e => setReason(e.target.value)}
            />
          </div>
          <div className="flex gap-3">
            <button onClick={onClose} className="btn-secondary flex-1">Cancel</button>
            <button
              onClick={() => reason.trim() && onConfirm(reason.trim())}
              disabled={!reason.trim() || loading}
              className="btn-danger flex-1"
            >
              {loading ? 'Deleting…' : 'Delete Entry'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Create / Edit Sub-account modal ───────────────────────────────────────────
function SubAccountModal({
  parentAccount,
  editAccount,
  accounts,
  onSave,
  onClose,
}: {
  parentAccount: Account | null
  editAccount: Account | null
  accounts: Account[]
  onSave: (data: { name: string; code: string; parentId: string }) => Promise<void>
  onClose: () => void
}) {
  // Determine the default parent: if editing, use its parent_id; if creating, use parentAccount
  const defaultParentId = editAccount?.parent_id || parentAccount?.id || ''
  const [form, setForm] = useState({
    name: editAccount?.name || '',
    code: editAccount?.code || '',
    parentId: defaultParentId,
  })
  const [saving, setSaving] = useState(false)

  const parentAccounts = accounts.filter(a => !a.parent_id)

  // Auto-suggest next code based on chosen parent
  useEffect(() => {
    if (!editAccount && form.parentId) {
      const parent = accounts.find(a => a.id === form.parentId)
      if (!parent) return
      const existingSubs = accounts.filter(a => a.parent_id === form.parentId)
      const nextNum = existingSubs.length + 1
      setForm(p => ({ ...p, code: `${parent.code}-${String(nextNum).padStart(2,'0')}` }))
    }
  }, [form.parentId])

  const handleSave = async () => {
    if (!form.name.trim()) { toast.error('Name is required'); return }
    if (!form.code.trim()) { toast.error('Code is required'); return }
    if (!form.parentId)    { toast.error('Select a parent account'); return }
    // Ensure code is unique
    const duplicate = accounts.find(a =>
      a.code.toLowerCase() === form.code.toLowerCase() && a.id !== editAccount?.id
    )
    if (duplicate) { toast.error(`Code "${form.code}" is already in use by "${duplicate.name}"`); return }
    setSaving(true)
    await onSave({ name: form.name.trim(), code: form.code.trim(), parentId: form.parentId })
    setSaving(false)
  }

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md animate-fade-up">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-brand-50 flex items-center justify-center">
              <GitBranch size={15} className="text-brand-600" />
            </div>
            <h2 className="font-semibold text-slate-900">
              {editAccount ? 'Edit Sub-account' : 'Create Sub-account'}
            </h2>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center text-slate-500 hover:bg-slate-200">
            <X size={16} />
          </button>
        </div>
        <div className="p-6 space-y-4">
          <div>
            <label className="input-label">Parent Account *</label>
            <select
              className="input"
              value={form.parentId}
              onChange={e => setForm(p => ({ ...p, parentId: e.target.value }))}
              disabled={!!editAccount} // can't change parent when editing
            >
              <option value="">Select parent account…</option>
              {CATEGORY_ORDER.map(cat => {
                const catParents = parentAccounts.filter(a => a.account_type?.category === cat)
                if (!catParents.length) return null
                return (
                  <optgroup key={cat} label={cat.charAt(0).toUpperCase() + cat.slice(1)}>
                    {catParents.map(a => <option key={a.id} value={a.id}>{a.code} — {a.name}</option>)}
                  </optgroup>
                )
              })}
            </select>
            {editAccount && <p className="text-xs text-slate-400 mt-1">Parent account cannot be changed after creation.</p>}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="input-label">Account Code *</label>
              <input className="input font-mono" placeholder="e.g. 1500-01"
                value={form.code} onChange={e => setForm(p => ({ ...p, code: e.target.value }))} />
            </div>
            <div>
              <label className="input-label">Account Name *</label>
              <input className="input" placeholder="e.g. Motor Vehicle - Van"
                value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} />
            </div>
          </div>
          {form.parentId && (
            <div className="flex items-center gap-2 p-3 bg-slate-50 rounded-xl text-xs text-slate-600">
              <GitBranch size={12} className="text-brand-500" />
              Sub-account of: <strong>{accounts.find(a => a.id === form.parentId)?.name}</strong>
              &nbsp;— inherits account type and normal balance from parent.
            </div>
          )}
        </div>
        <div className="flex gap-3 px-6 pb-6">
          <button onClick={onClose} className="btn-secondary flex-1">Cancel</button>
          <button onClick={handleSave} disabled={saving} className="btn-primary flex-1">
            <CheckCircle2 size={15} />
            {saving ? 'Saving…' : editAccount ? 'Save Changes' : 'Create Sub-account'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ═════════════════════════════════════════════════════════════════════════════
export default function AccountingPage() {
  const supabase = createClient()
  const { organization, profile } = useAppStore()
  const [tab, setTab]           = useState(0)
  const [entries, setEntries]   = useState<JournalEntry[]>([])
  const [accounts, setAccounts] = useState<Account[]>([])
  const [loading, setLoading]   = useState(true)
  const [search, setSearch]     = useState('')

  // Modals
  const [showNewEntry,    setShowNewEntry]    = useState(false)
  const [viewEntry,       setViewEntry]       = useState<JournalEntry | null>(null)
  const [deleteTarget,    setDeleteTarget]    = useState<JournalEntry | null>(null)
  const [deletingId,      setDeletingId]      = useState<string | null>(null)
  const [showSubModal,    setShowSubModal]    = useState(false)
  const [subModalParent,  setSubModalParent]  = useState<Account | null>(null)
  const [editSubAccount,  setEditSubAccount]  = useState<Account | null>(null)

  const [newEntry, setNewEntry] = useState({
    date: new Date().toISOString().split('T')[0],
    description: '', reference: '',
    lines: [
      { account_id: '', sub_account_id: '', description: '', debit: 0, credit: 0 },
      { account_id: '', sub_account_id: '', description: '', debit: 0, credit: 0 },
    ]
  })

  useEffect(() => {
    if (!organization) return
    loadAccounts()
    loadData()
  }, [organization, tab])

  const loadAccounts = async () => {
  const { data } = await supabase
    .from('accounts')
    .select(`
      id,
      organization_id,
      code,
      name,
      balance,
      currency,
      account_type_id,
      parent_id,
      is_active,
      account_type:account_types!inner(category, normal_balance)
    `)
    .eq('organization_id', organization!.id)
    .eq('is_active', true)
    .order('code')

  setAccounts((data as Account[]) || [])
}

  const loadData = async () => {
    setLoading(true)
    if (tab === 0) {
      const { data } = await supabase
        .from('journal_entries')
        .select('*, journal_lines(*, account:accounts(code, name, parent_id))')
        .eq('organization_id', organization!.id)
        .eq('is_deleted', false)          // ← only show live entries
        .order('date', { ascending: false })
        .limit(50)
      setEntries(data || [])
    } else {
      await loadAccounts()
    }
    setLoading(false)
  }

  // ── Account helpers ──────────────────────────────────────────────────────
  const parentAccounts = accounts.filter(a => !a.parent_id)
  const childrenOf = (pid: string) => accounts.filter(a => a.parent_id === pid)
  const hasChildren = (id: string) => accounts.some(a => a.parent_id === id)
  const resolveId = (l: typeof newEntry.lines[0]) =>
    l.sub_account_id && l.sub_account_id !== l.account_id ? l.sub_account_id : l.account_id

  // ── Create sub-account from the app ──────────────────────────────────────
  const handleSaveSubAccount = async (data: { name: string; code: string; parentId: string }) => {
    const parent = accounts.find(a => a.id === data.parentId)
    if (!parent) return

    if (editSubAccount) {
      // UPDATE existing sub-account name + code
      const { error } = await supabase
        .from('accounts')
        .update({ name: data.name, code: data.code })
        .eq('id', editSubAccount.id)
      if (error) { toast.error('Update failed: ' + error.message); return }
      toast.success(`Sub-account "${data.name}" updated`)
    } else {
      // INSERT new sub-account, inheriting account_type_id from parent
      const { error } = await supabase.from('accounts').insert({
        organization_id: organization!.id,
        code:            data.code,
        name:            data.name,
        balance:         0,
        currency:        organization!.base_currency,
        account_type_id: (parent as any).account_type_id,
        parent_id:       data.parentId,
        is_active:       true,
      })
      if (error) { toast.error('Create failed: ' + error.message); return }
      toast.success(`Sub-account "${data.name}" created`)
    }

    setShowSubModal(false)
    setEditSubAccount(null)
    setSubModalParent(null)
    await loadAccounts()
  }

  // ── Soft-delete journal entry + audit log ─────────────────────────────────
  const handleDeleteEntry = async (reason: string) => {
    if (!deleteTarget) return
    setDeletingId(deleteTarget.id)

    // 1. Reverse the account balance effect of this entry's lines
    const { data: lines } = await supabase
      .from('journal_lines')
      .select('account_id, debit, credit')
      .eq('journal_entry_id', deleteTarget.id)

    if (lines) {
      await Promise.all(lines.map(async (l: any) => {
        const { data: acc } = await supabase
          .from('accounts')
          .select('balance')
          .eq('id', l.account_id)
          .single()
        if (acc) {
          await supabase.from('accounts')
            .update({ balance: acc.balance - l.debit + l.credit })
            .eq('id', l.account_id)
        }
      }))
    }

    // 2. Soft-delete the entry
    const { error } = await supabase
      .from('journal_entries')
      .update({
        is_deleted:    true,
        deleted_at:    new Date().toISOString(),
        deleted_by:    profile?.id || null,
        delete_reason: reason,
        status:        'voided',
      })
      .eq('id', deleteTarget.id)

    if (error) { toast.error('Delete failed: ' + error.message); setDeletingId(null); return }

    // 3. Append to audit log
    await supabase.from('journal_audit_log').insert({
      organization_id:  organization!.id,
      journal_entry_id: deleteTarget.id,
      action:           'deleted',
      performed_by:     profile?.id || null,
      details: {
        entry_number:  deleteTarget.entry_number,
        date:          deleteTarget.date,
        description:   deleteTarget.description,
        total_debit:   deleteTarget.total_debit,
        total_credit:  deleteTarget.total_credit,
        reason,
      },
    })

    toast.success('Entry deleted and logged to audit trail')
    setDeleteTarget(null)
    setDeletingId(null)
    loadData()
  }

  // ── Journal entry form ────────────────────────────────────────────────────
  const addLine = () => setNewEntry(p => ({
    ...p, lines: [...p.lines, { account_id: '', sub_account_id: '', description: '', debit: 0, credit: 0 }]
  }))

  const updateLine = (i: number, k: string, v: string | number) => {
    const lines = [...newEntry.lines]
    lines[i] = { ...lines[i], [k]: v }
    if (k === 'account_id') lines[i].sub_account_id = v as string
    setNewEntry(p => ({ ...p, lines }))
  }

  const removeLine = (i: number) => {
    if (newEntry.lines.length <= 2) return
    setNewEntry(p => ({ ...p, lines: p.lines.filter((_, idx) => idx !== i) }))
  }

  const resetForm = () => setNewEntry({
    date: new Date().toISOString().split('T')[0], description: '', reference: '',
    lines: [
      { account_id: '', sub_account_id: '', description: '', debit: 0, credit: 0 },
      { account_id: '', sub_account_id: '', description: '', debit: 0, credit: 0 },
    ]
  })

  const totalDebit  = newEntry.lines.reduce((s, l) => s + (Number(l.debit)  || 0), 0)
  const totalCredit = newEntry.lines.reduce((s, l) => s + (Number(l.credit) || 0), 0)
  const isBalanced  = totalDebit > 0 && Math.abs(totalDebit - totalCredit) < 0.01

  const saveEntry = async (status: 'draft' | 'posted') => {
    if (!newEntry.description) return toast.error('Description is required')
    if (!isBalanced) return toast.error('Debits must equal credits')

    const { data: entry, error } = await supabase.from('journal_entries').insert({
      organization_id: organization!.id,
      date: newEntry.date, description: newEntry.description,
      reference: newEntry.reference, status, type: 'manual',
      total_debit: totalDebit, total_credit: totalCredit,
      currency: organization!.base_currency, is_deleted: false,
    }).select().single()

    if (error) { toast.error('Failed to save entry'); return }

    const validLines = newEntry.lines.filter(l => l.account_id)
    const { error: linesError } = await supabase.from('journal_lines').insert(
      validLines.map((l, i) => ({
        organization_id: organization!.id,
        journal_entry_id: entry.id,
        account_id: resolveId(l),
        description: l.description,
        debit: Number(l.debit) || 0,
        credit: Number(l.credit) || 0,
        line_number: i + 1,
      }))
    )
    if (linesError) { toast.error('Lines failed: ' + linesError.message); return }

    // Audit log entry creation
    await supabase.from('journal_audit_log').insert({
      organization_id:  organization!.id,
      journal_entry_id: entry.id,
      action:           status === 'posted' ? 'posted' : 'created',
      performed_by:     profile?.id || null,
      details: { entry_number: entry.entry_number, description: newEntry.description, total_debit: totalDebit },
    })

    toast.success(`Entry ${status === 'posted' ? 'posted' : 'saved as draft'}`)
    setShowNewEntry(false)
    resetForm()
    loadData()
  }

  const currency = organization?.base_currency || 'KES'

  // ── Trial Balance ─────────────────────────────────────────────────────────
  const getDebit  = (a: Account) => (a.account_type?.normal_balance === 'debit'  && a.balance > 0) ? a.balance
                                  : (a.account_type?.normal_balance !== 'debit'  && a.balance > 0) ? a.balance : 0
  const getCredit = (a: Account) => (a.account_type?.normal_balance === 'credit' && a.balance < 0) ? Math.abs(a.balance)
                                  : (a.account_type?.normal_balance === 'debit'  && a.balance < 0) ? Math.abs(a.balance) : 0

  const tbRows: { account: Account; indent: boolean; isGroupLabel: boolean }[] = []
  for (const p of parentAccounts.filter(a => a.balance !== 0 || hasChildren(a.id))) {
    const kids = childrenOf(p.id).filter(c => c.balance !== 0)
    if (kids.length) {
      tbRows.push({ account: p, indent: false, isGroupLabel: true })
      kids.forEach(k => tbRows.push({ account: k, indent: true, isGroupLabel: false }))
      if (p.balance !== 0) tbRows.push({ account: { ...p, name: `${p.name} — Unallocated` }, indent: true, isGroupLabel: false })
    } else if (p.balance !== 0) {
      tbRows.push({ account: p, indent: false, isGroupLabel: false })
    }
  }

  const totalTBDebit  = tbRows.filter(r => !r.isGroupLabel).reduce((s, r) => s + getDebit(r.account), 0)
  const totalTBCredit = tbRows.filter(r => !r.isGroupLabel).reduce((s, r) => s + getCredit(r.account), 0)
  const tbIsBalanced  = Math.abs(totalTBDebit - totalTBCredit) < 0.01

  const tbSummary = tbRows.filter(r => !r.isGroupLabel).reduce((acc: Record<string, { debit: number; credit: number }>, r) => {
    const cat = r.account.account_type?.category || 'other'
    if (!acc[cat]) acc[cat] = { debit: 0, credit: 0 }
    acc[cat].debit  += getDebit(r.account)
    acc[cat].credit += getCredit(r.account)
    return acc
  }, {})
  const sortedSummary = Object.entries(tbSummary).sort(([a], [b]) => CATEGORY_ORDER.indexOf(a) - CATEGORY_ORDER.indexOf(b))

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-5 animate-fade-up">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Accounting</h1>
          <p className="text-sm text-slate-500 mt-0.5">Journal entries, ledgers & chart of accounts</p>
        </div>
        <div className="flex items-center gap-2">
          <a href="/dashboard/archive" className="btn-secondary text-xs">
            <Archive size={14} />Archive
          </a>
          <button className="btn-primary" onClick={() => { resetForm(); setShowNewEntry(true) }}>
            <Plus size={16} />New Journal Entry
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-slate-100 p-1 rounded-xl w-fit">
        {TABS.map((t, i) => (
          <button key={t} onClick={() => setTab(i)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${tab === i ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
            {t}
          </button>
        ))}
      </div>

      {/* Search */}
      <div className="flex gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input className="input pl-9" placeholder="Search…" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <button className="btn-secondary"><Filter size={15} />Filter</button>
      </div>

      {/* ── Journal Entries ── */}
      {tab === 0 && (
        <div className="card overflow-hidden">
          <div className="table-container">
            <table className="table">
              <thead>
                <tr><th>Entry #</th><th>Date</th><th>Description</th><th>Type</th>
                  <th className="text-right">Debit</th><th className="text-right">Credit</th>
                  <th>Status</th><th></th></tr>
              </thead>
              <tbody>
                {loading ? Array(5).fill(0).map((_, i) => (
                  <tr key={i}>{Array(8).fill(0).map((_, j) => <td key={j}><div className="skeleton h-4 rounded w-full" /></td>)}</tr>
                )) : entries.length === 0 ? (
                  <tr><td colSpan={8} className="text-center py-12 text-slate-400">
                    <BookOpen size={32} className="mx-auto mb-2 opacity-40" /><p>No entries yet</p>
                  </td></tr>
                ) : entries
                    .filter(e => !search || e.description?.toLowerCase().includes(search.toLowerCase()) || e.entry_number?.toLowerCase().includes(search.toLowerCase()))
                    .map(entry => (
                      <tr key={entry.id}>
                        <td className="font-mono text-xs text-brand-600 font-semibold">{entry.entry_number}</td>
                        <td className="text-slate-500 text-xs">{formatDate(entry.date)}</td>
                        <td className="font-medium text-slate-800 max-w-xs truncate">{entry.description}</td>
                        <td><span className="badge bg-slate-100 text-slate-600">{entry.type?.replace('_', ' ')}</span></td>
                        <td className="text-right font-mono text-sm">{formatCurrency(entry.total_debit, currency)}</td>
                        <td className="text-right font-mono text-sm">{formatCurrency(entry.total_credit, currency)}</td>
                        <td><span className={`badge ${getStatusColor(entry.status)}`}>{entry.status}</span></td>
                        <td>
                          <div className="flex items-center gap-1">
                            <button className="btn-ghost p-1.5" onClick={() => setViewEntry(entry)} title="View lines">
                              <Eye size={14} />
                            </button>
                            <button
                              className="btn-ghost p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50"
                              onClick={() => setDeleteTarget(entry)}
                              title="Delete entry"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Chart of Accounts ── */}
      {tab === 1 && (
        <div className="space-y-3">
          <div className="flex justify-end">
            <button
              className="btn-secondary text-xs"
              onClick={() => { setEditSubAccount(null); setSubModalParent(null); setShowSubModal(true) }}
            >
              <GitBranch size={13} />New Sub-account
            </button>
          </div>
          <div className="card overflow-hidden">
            <div className="table-container">
              <table className="table">
                <thead>
                  <tr><th>Code</th><th>Account Name</th><th>Category</th><th>Normal Balance</th>
                    <th className="text-right">Balance</th><th>Status</th><th></th></tr>
                </thead>
                <tbody>
                  {loading ? Array(8).fill(0).map((_, i) => (
                    <tr key={i}>{Array(7).fill(0).map((_, j) => <td key={j}><div className="skeleton h-4 rounded" /></td>)}</tr>
                  )) : accounts
                      .filter(a => !search || a.name?.toLowerCase().includes(search.toLowerCase()) || a.code?.includes(search))
                      .map(account => (
                        <tr key={account.id}>
                          <td className={`font-mono text-xs font-semibold ${account.parent_id ? 'pl-8 text-slate-400' : 'text-brand-600'}`}>
                            {account.parent_id && <span className="mr-1 text-slate-300">└</span>}
                            {account.code}
                          </td>
                          <td className={`font-medium ${account.parent_id ? 'text-slate-600 pl-2' : 'text-slate-800'}`}>
                            {account.name}
                            {hasChildren(account.id) && (
                              <span className="ml-2 inline-flex items-center gap-1 text-xs text-brand-400 font-normal">
                                <GitBranch size={10} />sub-accounts
                              </span>
                            )}
                          </td>
                          <td><span className="badge bg-slate-100 text-slate-600 capitalize">{account.account_type?.category}</span></td>
                          <td className="text-slate-500 capitalize text-xs">{account.account_type?.normal_balance}</td>
                          <td className={`text-right font-mono text-sm ${account.balance < 0 ? 'negative' : account.balance > 0 ? 'text-slate-900 font-semibold' : 'text-slate-400'}`}>
                            {formatCurrency(account.balance, account.currency || currency)}
                          </td>
                          <td><span className="dot-green" /></td>
                          <td>
                            {/* Edit button — only for sub-accounts */}
                            {account.parent_id && (
                              <button
                                className="btn-ghost p-1.5 text-slate-400 hover:text-brand-600"
                                title="Edit sub-account"
                                onClick={() => { setEditSubAccount(account); setShowSubModal(true) }}
                              >
                                <Edit2 size={13} />
                              </button>
                            )}
                            {/* Quick-create sub-account from parent row */}
                            {!account.parent_id && (
                              <button
                                className="btn-ghost p-1.5 text-slate-300 hover:text-brand-500"
                                title="Add sub-account"
                                onClick={() => { setSubModalParent(account); setEditSubAccount(null); setShowSubModal(true) }}
                              >
                                <Plus size={13} />
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ── Trial Balance ── */}
      {tab === 2 && (
        <div className="space-y-4 max-w-2xl">
          {!tbIsBalanced && tbRows.length > 0 && (
            <div className="flex items-start gap-3 p-4 bg-red-50 border border-red-200 rounded-xl">
              <AlertTriangle size={18} className="text-red-500 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-sm font-semibold text-red-700">Trial Balance is out of balance</p>
                <p className="text-xs text-red-600 mt-0.5">Difference: {formatCurrency(Math.abs(totalTBDebit - totalTBCredit), currency)}. Run SUPABASE_FIX.sql.</p>
              </div>
            </div>
          )}

          <div className="card p-6">
            <h2 className="text-base font-semibold mb-1">Trial Balance — Summary</h2>
            <p className="text-xs text-slate-500 mb-5">{organization?.name} · As of {new Date().toLocaleDateString('en-KE', { year: 'numeric', month: 'long', day: 'numeric' })}</p>
            <table className="table border border-slate-200 rounded-xl overflow-hidden w-full">
              <thead><tr><th>Category</th><th className="text-right">Total Debit</th><th className="text-right">Total Credit</th></tr></thead>
              <tbody>
                {sortedSummary.map(([cat, vals]) => (
                  <tr key={cat}>
                    <td className="font-medium capitalize">{cat}</td>
                    <td className="text-right font-mono text-sm">{vals.debit > 0 ? formatCurrency(vals.debit, currency) : <span className="text-slate-300">—</span>}</td>
                    <td className="text-right font-mono text-sm">{vals.credit > 0 ? formatCurrency(vals.credit, currency) : <span className="text-slate-300">—</span>}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-slate-50 font-bold">
                  <td>Totals</td>
                  <td className="text-right font-mono">{formatCurrency(totalTBDebit, currency)}</td>
                  <td className={`text-right font-mono ${tbIsBalanced ? 'text-success-600' : 'text-danger-500'}`}>{formatCurrency(totalTBCredit, currency)}</td>
                </tr>
              </tfoot>
            </table>
          </div>

          <div className="card p-6">
            <h2 className="text-base font-semibold mb-5">Trial Balance — Detail</h2>
            <table className="table border border-slate-200 rounded-xl overflow-hidden w-full">
              <thead><tr><th>Code</th><th>Account</th><th className="text-right">Debit</th><th className="text-right">Credit</th></tr></thead>
              <tbody>
                {tbRows.length === 0 ? (
                  <tr><td colSpan={4} className="text-center py-8 text-slate-400 text-sm">No account balances yet.</td></tr>
                ) : tbRows
                    .filter(r => !search || r.account.name?.toLowerCase().includes(search.toLowerCase()))
                    .map((r, i) => r.isGroupLabel ? (
                      <tr key={r.account.id + '-label'} className="bg-slate-50/70">
                        <td className="font-mono text-xs text-brand-600 font-semibold">{r.account.code}</td>
                        <td className="text-sm font-semibold text-slate-800">
                          <span className="flex items-center gap-1.5"><GitBranch size={12} className="text-brand-400" />{r.account.name}</span>
                        </td>
                        <td className="text-right text-slate-300 text-xs">—</td>
                        <td className="text-right text-slate-300 text-xs">—</td>
                      </tr>
                    ) : (
                      <tr key={r.account.id + '-' + i}>
                        <td className={`font-mono text-xs ${r.indent ? 'pl-8 text-slate-400' : 'text-brand-600'}`}>
                          {r.indent && <span className="mr-1 text-slate-300">└</span>}{r.account.code}
                        </td>
                        <td className={`text-sm ${r.indent ? 'pl-2 text-slate-600' : 'text-slate-800'}`}>{r.account.name}</td>
                        <td className="text-right font-mono text-sm">{getDebit(r.account) > 0 ? formatCurrency(getDebit(r.account), currency) : <span className="text-slate-300">—</span>}</td>
                        <td className="text-right font-mono text-sm">{getCredit(r.account) > 0 ? formatCurrency(getCredit(r.account), currency) : <span className="text-slate-300">—</span>}</td>
                      </tr>
                    ))}
              </tbody>
              <tfoot className="bg-slate-50 font-bold">
                <tr>
                  <td colSpan={2} className="px-4 py-3">Totals</td>
                  <td className="text-right px-4 py-3 font-mono">{formatCurrency(totalTBDebit, currency)}</td>
                  <td className={`text-right px-4 py-3 font-mono ${tbIsBalanced ? 'text-success-600' : 'text-danger-500'}`}>{formatCurrency(totalTBCredit, currency)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}

      {/* ── View Entry Modal ── */}
      {viewEntry && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[85vh] flex flex-col animate-fade-up">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <div><h2 className="font-semibold text-slate-900">{viewEntry.entry_number}</h2>
                <p className="text-xs text-slate-500">{formatDate(viewEntry.date)} · {viewEntry.description}</p></div>
              <button onClick={() => setViewEntry(null)} className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center text-slate-500 hover:bg-slate-200"><X size={16} /></button>
            </div>
            <div className="flex-1 overflow-y-auto p-6">
              <table className="table border border-slate-200 rounded-xl overflow-hidden w-full">
                <thead><tr><th>Account</th><th>Narration</th><th className="text-right">Debit</th><th className="text-right">Credit</th></tr></thead>
                <tbody>
                  {viewEntry.journal_lines?.map((line, i) => (
                    <tr key={i}>
                      <td className="text-sm font-medium">{(line.account as any)?.code} — {(line.account as any)?.name}</td>
                      <td className="text-xs text-slate-500">{line.description || '—'}</td>
                      <td className="text-right font-mono text-sm">{line.debit > 0 ? formatCurrency(line.debit, currency) : '—'}</td>
                      <td className="text-right font-mono text-sm">{line.credit > 0 ? formatCurrency(line.credit, currency) : '—'}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="bg-slate-50 font-bold">
                  <tr><td colSpan={2} className="px-4 py-3">Total</td>
                    <td className="text-right px-4 py-3 font-mono">{formatCurrency(viewEntry.total_debit, currency)}</td>
                    <td className="text-right px-4 py-3 font-mono">{formatCurrency(viewEntry.total_credit, currency)}</td></tr>
                </tfoot>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ── Delete Modal ── */}
      {deleteTarget && (
        <DeleteModal
          entry={deleteTarget}
          loading={!!deletingId}
          onConfirm={handleDeleteEntry}
          onClose={() => setDeleteTarget(null)}
        />
      )}

      {/* ── Sub-account Modal ── */}
      {showSubModal && (
        <SubAccountModal
          parentAccount={subModalParent}
          editAccount={editSubAccount}
          accounts={accounts}
          onSave={handleSaveSubAccount}
          onClose={() => { setShowSubModal(false); setEditSubAccount(null); setSubModalParent(null) }}
        />
      )}

      {/* ── New Journal Entry Modal ── */}
      {showNewEntry && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[92vh] flex flex-col animate-fade-up">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <div><h2 className="text-lg font-semibold text-slate-900">New Journal Entry</h2>
                <p className="text-xs text-slate-500 mt-0.5">Debits must equal credits to post</p></div>
              <button onClick={() => setShowNewEntry(false)} className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center text-slate-500 hover:bg-slate-200"><X size={16} /></button>
            </div>
            <div className="flex-1 overflow-y-auto p-6 space-y-5">
              <div className="grid grid-cols-3 gap-4">
                <div><label className="input-label">Date *</label>
                  <input type="date" className="input" value={newEntry.date} onChange={e => setNewEntry(p => ({ ...p, date: e.target.value }))} /></div>
                <div><label className="input-label">Description *</label>
                  <input className="input" placeholder="e.g. Being opening capital" value={newEntry.description} onChange={e => setNewEntry(p => ({ ...p, description: e.target.value }))} /></div>
                <div><label className="input-label">Reference</label>
                  <input className="input" placeholder="Voucher / receipt no." value={newEntry.reference} onChange={e => setNewEntry(p => ({ ...p, reference: e.target.value }))} /></div>
              </div>
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="input-label mb-0">Line Items</label>
                  <div className="flex items-center gap-2">
                    {!isBalanced && totalDebit > 0 && (
                      <span className="text-xs text-danger-500 flex items-center gap-1"><AlertCircle size={12} />Diff: {formatCurrency(Math.abs(totalDebit - totalCredit), currency)}</span>
                    )}
                    {isBalanced && <span className="text-xs text-success-600 flex items-center gap-1"><CheckCircle2 size={12} />Balanced</span>}
                  </div>
                </div>
                <div className="grid grid-cols-12 gap-2 mb-1 px-1">
                  <div className="col-span-4 text-xs text-slate-400 font-medium">Account</div>
                  <div className="col-span-3 text-xs text-slate-400 font-medium flex items-center gap-1"><GitBranch size={10} />Sub-account</div>
                  <div className="col-span-2 text-xs text-slate-400 font-medium text-right">Debit</div>
                  <div className="col-span-2 text-xs text-slate-400 font-medium text-right">Credit</div>
                </div>
                <div className="space-y-2">
                  {newEntry.lines.map((line, i) => {
                    const selectedAccount = accounts.find(a => a.id === line.account_id)
                    const kids = line.account_id ? childrenOf(line.account_id) : []
                    return (
                      <div key={i} className="grid grid-cols-12 gap-2 items-start">
                        <div className="col-span-4">
                          <select className="input text-xs" value={line.account_id} onChange={e => updateLine(i, 'account_id', e.target.value)}>
                            <option value="">Select account…</option>
                            {CATEGORY_ORDER.map(cat => {
                              const catAccounts = parentAccounts.filter(a => a.account_type?.category === cat)
                              if (!catAccounts.length) return null
                              return (
                                <optgroup key={cat} label={cat.charAt(0).toUpperCase() + cat.slice(1)}>
                                  {catAccounts.map(a => (
                                    <option key={a.id} value={a.id}>{a.code} — {a.name}{hasChildren(a.id) ? ' ▸' : ''}</option>
                                  ))}
                                </optgroup>
                              )
                            })}
                          </select>
                        </div>
                        <div className="col-span-3">
                          {!selectedAccount ? (
                            // No account chosen yet
                            <input className="input text-xs text-slate-300 cursor-not-allowed"
                              placeholder="Select account first" disabled />
                          ) : kids.length > 0 ? (
                            // Account has sub-accounts — show picker
                            <SubAccountPicker
                              parentAccount={selectedAccount} children={kids}
                              value={line.sub_account_id || line.account_id}
                              onChange={v => updateLine(i, 'sub_account_id', v)}
                            />
                          ) : (
                            // Account has NO sub-accounts yet — narration + inline create button
                            <div className="flex gap-1 items-center">
                              <input className="input text-xs flex-1"
                                placeholder="Narration (optional)"
                                value={line.description}
                                onChange={e => updateLine(i, 'description', e.target.value)} />
                              <button
                                type="button"
                                title={`Create sub-account under ${selectedAccount.name}`}
                                className="flex-shrink-0 w-8 h-10 flex items-center justify-center rounded-xl border border-dashed border-brand-300 text-brand-500 hover:bg-brand-50 transition-colors"
                                onClick={() => {
                                  setSubModalParent(selectedAccount)
                                  setEditSubAccount(null)
                                  setShowSubModal(true)
                                }}
                              >
                                <GitBranch size={11} />
                              </button>
                            </div>
                          )}
                        </div>
                        <div className="col-span-2">
                          <input type="number" min="0" className="input text-xs text-right" placeholder="0.00"
                            value={line.debit || ''} onChange={e => updateLine(i, 'debit', e.target.value)} />
                        </div>
                        <div className="col-span-2">
                          <input type="number" min="0" className="input text-xs text-right" placeholder="0.00"
                            value={line.credit || ''} onChange={e => updateLine(i, 'credit', e.target.value)} />
                        </div>
                        <div className="col-span-1 flex justify-center pt-1">
                          <button onClick={() => removeLine(i)} className="w-7 h-7 rounded-lg text-slate-400 hover:bg-red-50 hover:text-red-500 flex items-center justify-center transition-colors"><X size={13} /></button>
                        </div>
                      </div>
                    )
                  })}
                </div>
                <div className="grid grid-cols-12 gap-2 mt-3 pt-3 border-t border-slate-200">
                  <div className="col-span-9 text-xs font-semibold text-slate-600">Totals</div>
                  <div className="col-span-2 text-right text-xs font-bold font-mono">{formatCurrency(totalDebit, currency)}</div>
                </div>
                <button onClick={addLine} className="btn-ghost text-xs mt-3 text-brand-600"><Plus size={13} />Add line</button>
              </div>
              <div className="flex items-start gap-2 p-3 bg-brand-50 rounded-xl">
                <GitBranch size={14} className="text-brand-600 mt-0.5 flex-shrink-0" />
                <p className="text-xs text-brand-700">
                  <strong>Sub-accounts:</strong> Accounts marked <strong>▸</strong> show a sub-account picker.
                  If an account has none yet, click the <GitBranch size={10} className="inline" /> button beside the narration to create one instantly.
                  After creating, the picker will appear automatically.
                </p>
              </div>
            </div>
            <div className="flex items-center justify-between px-6 py-4 border-t border-slate-100">
              <button onClick={() => setShowNewEntry(false)} className="btn-secondary">Cancel</button>
              <div className="flex gap-2">
                <button onClick={() => saveEntry('draft')} className="btn-secondary">Save Draft</button>
                <button onClick={() => saveEntry('posted')} className="btn-primary" disabled={!isBalanced}>
                  <CheckCircle2 size={15} />Post Entry
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

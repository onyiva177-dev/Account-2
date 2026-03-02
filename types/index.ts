export type Sector = 'education' | 'business' | 'healthcare' | 'ngo' | 'government' | 'retail'
export type Role = 'super_admin' | 'admin' | 'accountant' | 'manager' | 'cashier' | 'auditor' | 'viewer'
export type JournalStatus = 'draft' | 'posted' | 'reversed' | 'voided'
export type TransactionType = 'invoice' | 'bill' | 'credit_note' | 'debit_note' | 'receipt' | 'payment' | 'expense'
export type TransactionStatus = 'draft' | 'sent' | 'partial' | 'paid' | 'overdue' | 'voided' | 'cancelled'
export type ModuleKey = 'accounting' | 'tax' | 'payroll' | 'pos' | 'inventory' | 'budgeting' | 'banking' | 'analytics' | 'reports' | 'settings'

export interface Organization {
  id: string
  name: string
  sector: Sector
  country: string
  base_currency: string
  tax_id?: string
  settings?: Record<string, unknown>
  logo_url?: string
}

export interface Profile {
  id: string
  organization_id: string
  full_name: string
  email: string
  role: Role
  permissions: Record<string, boolean>
  avatar_url?: string
}

export interface Account {
  id: string
  organization_id: string
  code: string
  name: string
  balance: number
  currency: string
  account_type?: {
    category: string
    normal_balance: string
  }
}

export interface JournalEntry {
  id: string
  entry_number: string
  date: string
  description: string
  status: JournalStatus
  type: string
  total_debit: number
  total_credit: number
  currency: string
  ai_confidence?: number
  ai_notes?: string
  journal_lines?: JournalLine[]
}

export interface JournalLine {
  id: string
  account_id: string
  description?: string
  debit: number
  credit: number
  account?: Account
}

export interface Transaction {
  id: string
  type: TransactionType
  number: string
  date: string
  due_date?: string
  status: TransactionStatus
  subtotal: number
  tax_amount: number
  total: number
  amount_paid: number
  balance_due: number
  currency: string
  contact?: Contact
  lines?: TransactionLine[]
}

export interface TransactionLine {
  id: string
  description: string
  quantity: number
  unit_price: number
  tax_rate: number
  tax_amount: number
  total: number
}

export interface Contact {
  id: string
  type: string
  name: string
  email?: string
  phone?: string
  balance: number
}

export interface Product {
  id: string
  code: string
  name: string
  type: string
  cost_price: number
  selling_price: number
  stock_quantity: number
  reorder_level: number
}

export interface AIInsight {
  id: string
  type: 'anomaly' | 'forecast' | 'suggestion' | 'alert' | 'health_score' | 'scenario'
  title: string
  description: string
  severity: 'critical' | 'warning' | 'info' | 'positive'
  data?: Record<string, unknown>
  is_read: boolean
  created_at: string
}

export interface DashboardStats {
  total_revenue: number
  total_expenses: number
  net_profit: number
  cash_balance: number
  accounts_receivable: number
  accounts_payable: number
  revenue_growth: number
  expense_growth: number
}

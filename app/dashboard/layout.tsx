'use client'

import { useEffect, useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase'
import { useAppStore } from '@/lib/store'
import { cn } from '@/lib/utils'
import {
  LayoutDashboard, BookOpen, FileText, Users, Package,
  CreditCard, PieChart, Settings, ChevronLeft, ChevronRight,
  Bell, Search, LogOut, Building2, BarChart3, Wallet,
  Receipt, ShoppingCart, Calculator, Lock
} from 'lucide-react'
import toast from 'react-hot-toast'

// module: null  = always visible (dashboard, settings, reports)
// module: 'key' = only visible if key is in org's enabled_modules
const NAV_ITEMS = [
  { key: 'dashboard',    label: 'Dashboard',       href: '/dashboard',              icon: LayoutDashboard, module: null },
  { key: 'accounting',   label: 'Accounting',       href: '/dashboard/accounting',   icon: BookOpen,        module: 'accounting' },
  { key: 'transactions', label: 'Transactions',     href: '/dashboard/transactions', icon: Receipt,         module: 'transactions' },
  { key: 'contacts',     label: 'Contacts',         href: '/dashboard/contacts',     icon: Users,           module: 'contacts' },
  { key: 'inventory',    label: 'Inventory',        href: '/dashboard/inventory',    icon: Package,         module: 'inventory' },
  { key: 'pos',          label: 'POS',              href: '/dashboard/pos',          icon: ShoppingCart,    module: 'pos' },
  { key: 'payroll',      label: 'Payroll',          href: '/dashboard/payroll',      icon: Wallet,          module: 'payroll' },
  { key: 'tax',          label: 'Tax & Compliance', href: '/dashboard/tax',          icon: Calculator,      module: 'tax' },
  { key: 'banking',      label: 'Banking',          href: '/dashboard/banking',      icon: CreditCard,      module: 'banking' },
  { key: 'budgeting',    label: 'Budgets',          href: '/dashboard/budgeting',    icon: PieChart,        module: 'budgeting' },
  { key: 'analytics',    label: 'Analytics',        href: '/dashboard/analytics',    icon: BarChart3,       module: 'analytics' },
  { key: 'reports',      label: 'Reports',          href: '/dashboard/reports',      icon: FileText,        module: 'reports' },
  { key: 'settings',     label: 'Settings',         href: '/dashboard/settings',     icon: Settings,        module: null },
]

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router   = useRouter()
  const pathname = usePathname()
  const supabase = createClient()
  const { organization, profile, sidebarOpen, unreadInsights, setSidebarOpen, setOrganization, setProfile } = useAppStore()
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const initUser = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { router.push('/login'); return }

      const { data: profileData } = await supabase
        .from('profiles')
        .select('*, organizations(*)')
        .eq('id', session.user.id)
        .single()

      if (profileData) {
        setProfile(profileData)
        if (profileData.organizations) setOrganization(profileData.organizations)
      }
      setLoading(false)
    }
    initUser()
  }, [])

  // Log page views for admin activity panel
  useEffect(() => {
    if (!loading && profile) {
      fetch('/api/log', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'page_view', page: pathname }),
      }).catch(() => {})
    }
  }, [pathname, loading, profile])

  const handleSignOut = async () => {
    fetch('/api/log', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'logout', page: pathname }),
    }).catch(() => {})
    await supabase.auth.signOut()
    toast.success('Signed out')
    router.push('/login')
  }

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-surface-50">
      <div className="flex flex-col items-center gap-4">
        <div className="w-12 h-12 bg-brand-600 rounded-2xl flex items-center justify-center">
          <BarChart3 size={24} className="text-white" />
        </div>
        <div className="flex gap-1">
          {[0,1,2].map(i => (
            <div key={i} className="w-2 h-2 bg-brand-400 rounded-full animate-bounce"
              style={{ animationDelay: `${i * 0.15}s` }} />
          ))}
        </div>
      </div>
    </div>
  )

  // ── Module gating ────────────────────────────────────────────────────────────
  // Reads enabled_modules from org settings (set by admin or M-Pesa payment)
  // Accounting is ALWAYS enabled regardless — it is the core free module
  const enabledModules: string[] =
    (organization?.settings as any)?.enabled_modules || ['accounting']

  const visibleItems = NAV_ITEMS.filter(item =>
    item.module === null ||           // dashboard + settings always show
    item.module === 'accounting' ||   // accounting is always free
    enabledModules.includes(item.module)
  )

  const activeKey = NAV_ITEMS.find(n =>
    pathname === n.href || pathname.startsWith(n.href + '/')
  )?.key || 'dashboard'

  return (
    <div className="min-h-screen flex bg-surface-50">
      {/* Sidebar */}
      <aside className={cn(
        'flex flex-col bg-white border-r border-slate-200 transition-all duration-300 ease-in-out flex-shrink-0 relative z-20',
        sidebarOpen ? 'w-60' : 'w-16'
      )}>
        {/* Logo */}
        <div className={cn(
          'flex items-center gap-3 px-4 py-5 border-b border-slate-100',
          !sidebarOpen && 'justify-center px-2'
        )}>
          <div className="w-8 h-8 bg-brand-600 rounded-lg flex items-center justify-center flex-shrink-0">
            <BarChart3 size={16} className="text-white" />
          </div>
          {sidebarOpen && (
            <div className="min-w-0">
              <p className="font-semibold text-slate-900 text-base leading-tight">FinAI</p>
              {organization?.name && (
                <p className="text-xs text-slate-400 truncate max-w-36">{organization.name}</p>
              )}
            </div>
          )}
        </div>

        {/* Nav — only enabled modules shown */}
        <nav className="flex-1 p-2 space-y-0.5 overflow-y-auto">
          {visibleItems.map(item => {
            const Icon = item.icon
            const isActive = item.key === activeKey
            return (
              <Link
                key={item.key}
                href={item.href}
                className={cn(
                  'sidebar-item',
                  isActive && 'active',
                  !sidebarOpen && 'justify-center px-2'
                )}
                title={!sidebarOpen ? item.label : undefined}
              >
                <Icon size={18} className="flex-shrink-0" />
                {sidebarOpen && <span>{item.label}</span>}
              </Link>
            )
          })}

          {/* Upgrade hint at bottom of nav for free users */}
          {sidebarOpen && enabledModules.length <= 1 && (
            <div className="mt-3 mx-1 p-3 rounded-xl bg-amber-50 border border-amber-200">
              <div className="flex items-center gap-2 mb-1">
                <Lock size={12} className="text-amber-600" />
                <p className="text-xs font-semibold text-amber-700">Free plan</p>
              </div>
              <p className="text-xs text-amber-600 leading-relaxed">
                Upgrade in Settings to unlock Transactions, Contacts, Payroll and more.
              </p>
            </div>
          )}
        </nav>

        {/* User row */}
        <div className={cn('p-3 border-t border-slate-100', !sidebarOpen && 'flex flex-col items-center gap-2')}>
          {sidebarOpen ? (
            <div className="flex items-center gap-3 px-2 py-2">
              <div className="w-8 h-8 rounded-full bg-brand-100 flex items-center justify-center text-brand-700 text-xs font-bold flex-shrink-0">
                {profile?.full_name?.charAt(0) || 'U'}
              </div>
              <div className="min-w-0">
                <p className="text-sm font-medium text-slate-900 truncate">{profile?.full_name}</p>
                <p className="text-xs text-slate-500 truncate capitalize">
                  {profile?.role?.replace('_', ' ')}
                </p>
              </div>
              <button onClick={handleSignOut}
                className="ml-auto text-slate-400 hover:text-red-500 transition-colors"
                title="Sign out">
                <LogOut size={15} />
              </button>
            </div>
          ) : (
            <button onClick={handleSignOut}
              className="text-slate-400 hover:text-red-500 transition-colors p-2"
              title="Sign out">
              <LogOut size={18} />
            </button>
          )}
        </div>

        {/* Collapse toggle */}
        <button
          onClick={() => setSidebarOpen(!sidebarOpen)}
          className="absolute -right-3 top-16 w-6 h-6 rounded-full bg-white border border-slate-200 flex items-center justify-center text-slate-500 hover:text-slate-900 transition-colors shadow-sm"
        >
          {sidebarOpen ? <ChevronLeft size={12} /> : <ChevronRight size={12} />}
        </button>
      </aside>

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Topbar */}
        <header className="h-14 bg-white border-b border-slate-200 flex items-center px-6 gap-4 flex-shrink-0">
          <div className="flex-1 max-w-md">
            <div className="relative">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                className="w-full pl-9 pr-4 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent"
                placeholder="Search transactions, accounts..."
              />
            </div>
          </div>
          <div className="ml-auto flex items-center gap-2">
            {organization && (
              <div className="flex items-center gap-2 px-3 py-1.5 bg-surface-50 rounded-xl border border-slate-200">
                <Building2 size={14} className="text-slate-400" />
                <span className="text-sm font-medium text-slate-700 max-w-32 truncate">
                  {organization.name}
                </span>
              </div>
            )}
            <button className="relative w-9 h-9 rounded-xl bg-surface-50 border border-slate-200 flex items-center justify-center text-slate-500 hover:text-brand-600 transition-colors">
              <Bell size={16} />
              {unreadInsights > 0 && (
                <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white text-xs rounded-full flex items-center justify-center">
                  {unreadInsights}
                </span>
              )}
            </button>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto p-6">
          {children}
        </main>
      </div>
    </div>
  )
}

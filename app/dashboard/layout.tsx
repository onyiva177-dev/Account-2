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
  Receipt, ShoppingCart, Calculator
} from 'lucide-react'
import toast from 'react-hot-toast'

const ALL_NAV_ITEMS = [
  { key: 'dashboard',    label: 'Dashboard',       href: '/dashboard',             icon: LayoutDashboard, module: null },
  { key: 'accounting',   label: 'Accounting',       href: '/dashboard/accounting',  icon: BookOpen,        module: null },
  { key: 'transactions', label: 'Transactions',     href: '/dashboard/transactions',icon: Receipt,         module: null },
  { key: 'contacts',     label: 'Contacts',         href: '/dashboard/contacts',    icon: Users,           module: null },
  { key: 'inventory',    label: 'Inventory',        href: '/dashboard/inventory',   icon: Package,         module: 'inventory' },
  { key: 'pos',          label: 'POS',              href: '/dashboard/pos',         icon: ShoppingCart,    module: 'pos' },
  { key: 'payroll',      label: 'Payroll',          href: '/dashboard/payroll',     icon: Wallet,          module: 'payroll' },
  { key: 'tax',          label: 'Tax & Compliance', href: '/dashboard/tax',         icon: Calculator,      module: 'tax' },
  { key: 'banking',      label: 'Banking',          href: '/dashboard/banking',     icon: CreditCard,      module: 'banking' },
  { key: 'budgeting',    label: 'Budgets',          href: '/dashboard/budgeting',   icon: PieChart,        module: 'budgeting' },
  { key: 'analytics',    label: 'Analytics',        href: '/dashboard/analytics',   icon: BarChart3,       module: 'analytics' },
  { key: 'reports',      label: 'Reports',          href: '/dashboard/reports',     icon: FileText,        module: null },
  { key: 'settings',     label: 'Settings',         href: '/dashboard/settings',    icon: Settings,        module: null },
]

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router   = useRouter()
  const pathname = usePathname()
  const supabase = createClient()
  const { organization, profile, sidebarOpen, unreadInsights, setSidebarOpen, setOrganization, setProfile } = useAppStore()
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const init = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { router.push('/login'); return }
      const { data: p } = await supabase
        .from('profiles').select('*, organizations(*)')
        .eq('id', session.user.id).single()
      if (p) { setProfile(p); if (p.organizations) setOrganization(p.organizations) }
      setLoading(false)
    }
    init()
  }, [])

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--bg-page)' }}>
      <div className="flex flex-col items-center gap-4">
        <div className="w-12 h-12 rounded-2xl flex items-center justify-center" style={{ background: 'var(--brand)' }}>
          <BarChart3 size={24} className="text-white" />
        </div>
        <div className="flex gap-1">
          {[0,1,2].map(i => (
            <div key={i} className="w-2 h-2 rounded-full animate-bounce"
              style={{ background: 'var(--brand)', animationDelay: `${i*0.15}s` }} />
          ))}
        </div>
      </div>
    </div>
  )

  const enabledModules: string[] =
    (organization?.settings as any)?.enabled_modules ||
    ['accounting','tax','payroll','inventory','banking','analytics','budgeting','pos']

  const visibleItems = ALL_NAV_ITEMS.filter(item =>
    item.module === null || enabledModules.includes(item.module)
  )

  const activeKey = visibleItems.find(n =>
    pathname === n.href || pathname.startsWith(n.href + '/')
  )?.key || 'dashboard'

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    toast.success('Signed out')
    router.push('/login')
  }

  return (
    <div className="min-h-screen flex" style={{ background: 'var(--bg-page)' }}>

      {/* ── Sidebar ── */}
      <aside className={cn(
        'flex flex-col flex-shrink-0 relative z-20 transition-all duration-300',
        sidebarOpen ? 'w-60' : 'w-16'
      )} style={{ background: 'var(--bg-sidebar)', borderRight: '1px solid var(--border)' }}>

        {/* Logo */}
        <div className={cn(
          'flex items-center gap-3 px-4 py-5',
          !sidebarOpen && 'justify-center px-2'
        )} style={{ borderBottom: '1px solid var(--border)' }}>
          <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
            style={{ background: 'var(--brand)' }}>
            <BarChart3 size={16} className="text-white" />
          </div>
          {sidebarOpen && (
            <div>
              <span className="font-bold text-base" style={{ color: 'var(--text-primary)' }}>FinAI</span>
              {organization?.name && (
                <p className="text-xs truncate max-w-[140px]" style={{ color: 'var(--text-muted)' }}>
                  {organization.name}
                </p>
              )}
            </div>
          )}
        </div>

        {/* Nav */}
        <nav className="flex-1 p-2 space-y-0.5 overflow-y-auto">
          {visibleItems.map(item => {
            const Icon = item.icon
            const isActive = item.key === activeKey
            return (
              <Link key={item.key} href={item.href}
                className={cn('sidebar-item', isActive && 'active', !sidebarOpen && 'justify-center px-2')}
                title={!sidebarOpen ? item.label : undefined}>
                <Icon size={17} className="flex-shrink-0" />
                {sidebarOpen && <span>{item.label}</span>}
                {sidebarOpen && isActive && (
                  <span className="ml-auto w-1.5 h-1.5 rounded-full flex-shrink-0"
                    style={{ background: 'var(--brand)' }} />
                )}
              </Link>
            )
          })}
        </nav>

        {/* User row */}
        <div className={cn('p-3', !sidebarOpen && 'flex flex-col items-center')}
          style={{ borderTop: '1px solid var(--border)' }}>
          {sidebarOpen ? (
            <div className="flex items-center gap-3 px-2 py-2">
              <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0"
                style={{ background: 'var(--brand-dim)', color: 'var(--brand)' }}>
                {profile?.full_name?.charAt(0)?.toUpperCase() || 'U'}
              </div>
              <div className="min-w-0">
                <p className="text-sm font-medium truncate" style={{ color: 'var(--text-primary)' }}>
                  {profile?.full_name}
                </p>
                <p className="text-xs capitalize truncate" style={{ color: 'var(--text-muted)' }}>
                  {profile?.role?.replace('_',' ')}
                </p>
              </div>
              <button onClick={handleSignOut} className="ml-auto p-1.5 rounded-lg transition-colors hover:bg-red-900/30"
                style={{ color: 'var(--text-muted)' }} title="Sign out">
                <LogOut size={14} />
              </button>
            </div>
          ) : (
            <button onClick={handleSignOut} className="p-2 rounded-lg transition-colors"
              style={{ color: 'var(--text-muted)' }} title="Sign out">
              <LogOut size={18} />
            </button>
          )}
        </div>

        {/* Collapse toggle */}
        <button onClick={() => setSidebarOpen(!sidebarOpen)}
          className="absolute -right-3 top-16 w-6 h-6 rounded-full flex items-center justify-center transition-colors z-30"
          style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', color: 'var(--text-secondary)' }}>
          {sidebarOpen ? <ChevronLeft size={12} /> : <ChevronRight size={12} />}
        </button>
      </aside>

      {/* ── Main ── */}
      <div className="flex-1 flex flex-col min-w-0">

        {/* Topbar */}
        <header className="h-14 flex items-center px-6 gap-4 flex-shrink-0"
          style={{ background: 'var(--bg-sidebar)', borderBottom: '1px solid var(--border)' }}>
          <div className="flex-1 max-w-md">
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2"
                style={{ color: 'var(--text-muted)' }} />
              <input
                className="w-full pl-9 pr-4 py-2 text-sm rounded-lg"
                style={{
                  background: 'var(--bg-page)',
                  border: '1px solid var(--border)',
                  color: 'var(--text-primary)',
                }}
                placeholder="Search transactions, accounts..."
              />
            </div>
          </div>
          <div className="ml-auto flex items-center gap-2">
            {organization && (
              <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-lg"
                style={{ background: 'var(--bg-page)', border: '1px solid var(--border)' }}>
                <Building2 size={13} style={{ color: 'var(--text-muted)' }} />
                <span className="text-sm font-medium max-w-32 truncate"
                  style={{ color: 'var(--text-secondary)' }}>{organization.name}</span>
              </div>
            )}
            <button className="relative w-9 h-9 rounded-lg flex items-center justify-center transition-colors"
              style={{ background: 'var(--bg-page)', border: '1px solid var(--border)', color: 'var(--text-secondary)' }}>
              <Bell size={15} />
              {unreadInsights > 0 && (
                <span className="absolute -top-1 -right-1 w-4 h-4 text-white text-xs rounded-full flex items-center justify-center"
                  style={{ background: 'var(--danger)' }}>
                  {unreadInsights}
                </span>
              )}
            </button>
          </div>
        </header>

        {/* Page */}
        <main className="flex-1 overflow-y-auto p-6">
          {children}
        </main>
      </div>
    </div>
  )
}

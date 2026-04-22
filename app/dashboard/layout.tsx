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
  Receipt, ShoppingCart, Calculator, Menu, X
} from 'lucide-react'
import toast from 'react-hot-toast'

const NAV_ITEMS = [
  { key: 'dashboard',    label: 'Dashboard',        href: '/dashboard',              icon: LayoutDashboard },
  { key: 'accounting',   label: 'Accounting',        href: '/dashboard/accounting',   icon: BookOpen },
  { key: 'transactions', label: 'Transactions',      href: '/dashboard/transactions', icon: Receipt },
  { key: 'contacts',     label: 'Contacts',          href: '/dashboard/contacts',     icon: Users },
  { key: 'inventory',    label: 'Inventory',         href: '/dashboard/inventory',    icon: Package },
  { key: 'pos',          label: 'POS',               href: '/dashboard/pos',          icon: ShoppingCart },
  { key: 'payroll',      label: 'Payroll',           href: '/dashboard/payroll',      icon: Wallet },
  { key: 'tax',          label: 'Tax & Compliance',  href: '/dashboard/tax',          icon: Calculator },
  { key: 'banking',      label: 'Banking',           href: '/dashboard/banking',      icon: CreditCard },
  { key: 'budgeting',    label: 'Budgets',           href: '/dashboard/budgeting',    icon: PieChart },
  { key: 'analytics',    label: 'Analytics',         href: '/dashboard/analytics',    icon: BarChart3 },
  { key: 'reports',      label: 'Reports',           href: '/dashboard/reports',      icon: FileText },
  { key: 'settings',     label: 'Settings',          href: '/dashboard/settings',     icon: Settings },
]

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router   = useRouter()
  const pathname = usePathname()
  const supabase = createClient()
  const { organization, profile, sidebarOpen, unreadInsights, setSidebarOpen, setOrganization, setProfile } = useAppStore()

  const [loading,      setLoading]      = useState(true)
  const [mobileOpen,   setMobileOpen]   = useState(false)  // mobile drawer

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

  // Close mobile drawer on route change
  useEffect(() => { setMobileOpen(false) }, [pathname])

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

  const activeKey = NAV_ITEMS.find(n =>
    pathname === n.href || pathname.startsWith(n.href + '/')
  )?.key || 'dashboard'

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    toast.success('Signed out')
    router.push('/login')
  }

  // ── Shared nav content (used in both desktop sidebar and mobile drawer) ──
  const NavContent = ({ compact }: { compact?: boolean }) => (
    <>
      <nav className="flex-1 p-2 space-y-0.5 overflow-y-auto">
        {NAV_ITEMS.map(item => {
          const Icon = item.icon
          const isActive = item.key === activeKey
          return (
            <Link key={item.key} href={item.href}
              className={cn('sidebar-item', isActive && 'active', compact && 'justify-center px-2')}
              title={compact ? item.label : undefined}>
              <Icon size={17} className="flex-shrink-0" />
              {!compact && <span>{item.label}</span>}
            </Link>
          )
        })}
      </nav>

      {/* User row */}
      <div className={cn('p-3', compact && 'flex flex-col items-center')}
        style={{ borderTop: '1px solid var(--border)' }}>
        {!compact ? (
          <div className="flex items-center gap-3 px-2 py-2">
            <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0"
              style={{ background: 'var(--brand-dim)', color: 'var(--brand)' }}>
              {profile?.full_name?.charAt(0)?.toUpperCase() || 'U'}
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold truncate" style={{ color: 'var(--text-primary)' }}>
                {profile?.full_name}
              </p>
              <p className="text-xs capitalize" style={{ color: 'var(--text-muted)' }}>
                {profile?.role?.replace('_', ' ')}
              </p>
            </div>
            <button onClick={handleSignOut}
              className="ml-auto p-1.5 rounded-lg transition-colors"
              style={{ color: 'var(--text-muted)' }}
              onMouseEnter={e => (e.currentTarget.style.color = 'var(--danger)')}
              onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-muted)')}
              title="Sign out">
              <LogOut size={14} />
            </button>
          </div>
        ) : (
          <button onClick={handleSignOut}
            className="p-2 rounded-lg transition-colors"
            style={{ color: 'var(--text-muted)' }} title="Sign out">
            <LogOut size={17} />
          </button>
        )}
      </div>
    </>
  )

  return (
    <div className="min-h-screen flex" style={{ background: 'var(--bg-page)' }}>

      {/* ── Mobile drawer overlay ── */}
      {mobileOpen && (
        <div className="fixed inset-0 z-40 lg:hidden"
          style={{ background: 'rgba(32,33,36,0.4)' }}
          onClick={() => setMobileOpen(false)} />
      )}

      {/* ── Mobile drawer ── */}
      <aside className={cn(
        'fixed inset-y-0 left-0 z-50 w-64 flex flex-col transition-transform duration-300 ease-in-out lg:hidden',
        mobileOpen ? 'translate-x-0' : '-translate-x-full'
      )} style={{ background: 'var(--bg-sidebar)', borderRight: '1px solid var(--border)' }}>
        {/* Mobile drawer header */}
        <div className="flex items-center justify-between px-4 py-4"
          style={{ borderBottom: '1px solid var(--border)' }}>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center"
              style={{ background: 'var(--brand)' }}>
              <BarChart3 size={15} className="text-white" />
            </div>
            <div>
              <p className="font-bold text-sm" style={{ color: 'var(--text-primary)' }}>FinAI</p>
              {organization?.name && (
                <p className="text-xs truncate max-w-36" style={{ color: 'var(--text-muted)' }}>
                  {organization.name}
                </p>
              )}
            </div>
          </div>
          <button onClick={() => setMobileOpen(false)}
            className="w-8 h-8 rounded-lg flex items-center justify-center"
            style={{ background: 'var(--bg-table-head)', color: 'var(--text-secondary)' }}>
            <X size={16} />
          </button>
        </div>
        <NavContent />
      </aside>

      {/* ── Desktop sidebar ── */}
      <aside className={cn(
        'hidden lg:flex flex-col flex-shrink-0 relative z-20 transition-all duration-300',
        sidebarOpen ? 'w-60' : 'w-16'
      )} style={{ background: 'var(--bg-sidebar)', borderRight: '1px solid var(--border)' }}>

        {/* Logo */}
        <div className={cn(
          'flex items-center gap-3 px-4 py-4',
          !sidebarOpen && 'justify-center px-2'
        )} style={{ borderBottom: '1px solid var(--border)' }}>
          <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
            style={{ background: 'var(--brand)' }}>
            <BarChart3 size={15} className="text-white" />
          </div>
          {sidebarOpen && (
            <div>
              <p className="font-bold text-sm" style={{ color: 'var(--text-primary)' }}>FinAI</p>
              {organization?.name && (
                <p className="text-xs truncate max-w-[140px]" style={{ color: 'var(--text-muted)' }}>
                  {organization.name}
                </p>
              )}
            </div>
          )}
        </div>

        <NavContent compact={!sidebarOpen} />

        {/* Collapse toggle */}
        <button onClick={() => setSidebarOpen(!sidebarOpen)}
          className="absolute -right-3 top-14 w-6 h-6 rounded-full flex items-center justify-center transition-colors z-30"
          style={{
            background: 'var(--bg-sidebar)',
            border: '1px solid var(--border)',
            color: 'var(--text-secondary)',
          }}>
          {sidebarOpen ? <ChevronLeft size={12} /> : <ChevronRight size={12} />}
        </button>
      </aside>

      {/* ── Main content ── */}
      <div className="flex-1 flex flex-col min-w-0">

        {/* ── Topbar ── */}
        <header className="h-13 flex items-center px-3 sm:px-5 gap-3 flex-shrink-0"
          style={{
            background: 'var(--bg-sidebar)',
            borderBottom: '1px solid var(--border)',
            height: '52px',
          }}>

          {/* Mobile hamburger */}
          <button onClick={() => setMobileOpen(true)}
            className="lg:hidden w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
            style={{ background: 'var(--bg-table-head)', color: 'var(--text-secondary)' }}>
            <Menu size={17} />
          </button>

          {/* Search bar */}
          <div className="flex-1 max-w-xs sm:max-w-md">
            <div className="relative">
              <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2"
                style={{ color: 'var(--text-muted)' }} />
              <input
                className="w-full pl-8 pr-3 py-1.5 text-sm rounded-lg"
                style={{
                  background: 'var(--bg-table-head)',
                  border: '1px solid var(--border)',
                  color: 'var(--text-primary)',
                  height: '34px',
                }}
                placeholder="Search…"
              />
            </div>
          </div>

          <div className="ml-auto flex items-center gap-2">
            {/* Org badge — hidden on small screens */}
            {organization && (
              <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-lg"
                style={{
                  background: 'var(--bg-table-head)',
                  border: '1px solid var(--border)',
                }}>
                <Building2 size={12} style={{ color: 'var(--text-muted)' }} />
                <span className="text-xs font-medium max-w-32 truncate"
                  style={{ color: 'var(--text-secondary)' }}>
                  {organization.name}
                </span>
              </div>
            )}

            {/* Notification bell */}
            <button className="relative w-8 h-8 rounded-lg flex items-center justify-center"
              style={{
                background: 'var(--bg-table-head)',
                border: '1px solid var(--border)',
                color: 'var(--text-secondary)',
              }}>
              <Bell size={14} />
              {unreadInsights > 0 && (
                <span className="absolute -top-1 -right-1 w-4 h-4 text-white text-xs rounded-full flex items-center justify-center"
                  style={{ background: 'var(--danger)', fontSize: '9px' }}>
                  {unreadInsights}
                </span>
              )}
            </button>
          </div>
        </header>

        {/* ── Page content ── */}
        <main className="flex-1 overflow-y-auto p-3 sm:p-5 lg:p-6">
          {children}
        </main>
      </div>
    </div>
  )
}

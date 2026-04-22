// ─────────────────────────────────────────────────────────────────
// DarkModeToggle — drop this anywhere in your settings page or
// topbar. It reads/writes localStorage('finai_theme') and toggles
// class="dark" on <html>. Works without any extra libraries.
// ─────────────────────────────────────────────────────────────────
'use client'

import { useEffect, useState } from 'react'
import { Moon, Sun } from 'lucide-react'

export function DarkModeToggle({ showLabel = true }: { showLabel?: boolean }) {
  const [dark, setDark] = useState(false)

  // Read saved preference on mount
  useEffect(() => {
    const saved = localStorage.getItem('finai_theme')
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
    const isDark = saved ? saved === 'dark' : prefersDark
    setDark(isDark)
    document.documentElement.classList.toggle('dark', isDark)
  }, [])

  const toggle = () => {
    const next = !dark
    setDark(next)
    document.documentElement.classList.toggle('dark', next)
    localStorage.setItem('finai_theme', next ? 'dark' : 'light')
  }

  return (
    <button
      onClick={toggle}
      className="flex items-center gap-2 px-3 py-2 rounded-lg transition-all text-sm font-medium"
      style={{
        background: dark ? 'var(--brand-dim)' : 'var(--bg-table-head)',
        border: '1px solid var(--border)',
        color: dark ? 'var(--brand)' : 'var(--text-secondary)',
      }}
      title={dark ? 'Switch to light mode' : 'Switch to dark mode'}
    >
      {dark ? <Sun size={15} /> : <Moon size={15} />}
      {showLabel && <span>{dark ? 'Light mode' : 'Dark mode'}</span>}
    </button>
  )
}

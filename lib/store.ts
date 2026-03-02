import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Organization, Profile, AIInsight } from '@/types'

interface AppState {
  organization: Organization | null
  profile: Profile | null
  activeModule: string
  sidebarOpen: boolean
  insights: AIInsight[]
  unreadInsights: number
  setOrganization: (org: Organization) => void
  setProfile: (profile: Profile) => void
  setActiveModule: (module: string) => void
  setSidebarOpen: (open: boolean) => void
  setInsights: (insights: AIInsight[]) => void
  markInsightRead: (id: string) => void
}

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      organization: null,
      profile: null,
      activeModule: 'dashboard',
      sidebarOpen: true,
      insights: [],
      unreadInsights: 0,
      setOrganization: (org) => set({ organization: org }),
      setProfile: (profile) => set({ profile }),
      setActiveModule: (module) => set({ activeModule: module }),
      setSidebarOpen: (open) => set({ sidebarOpen: open }),
      setInsights: (insights) => set({
        insights,
        unreadInsights: insights.filter(i => !i.is_read).length
      }),
      markInsightRead: (id) => {
        const insights = get().insights.map(i => i.id === id ? { ...i, is_read: true } : i)
        set({ insights, unreadInsights: insights.filter(i => !i.is_read).length })
      }
    }),
    { name: 'finai-store', partialize: (s) => ({ activeModule: s.activeModule, sidebarOpen: s.sidebarOpen }) }
  )
)

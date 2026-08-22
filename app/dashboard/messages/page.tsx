'use client'
import { useEffect, useState, useRef } from 'react'
import { createClient } from '@/lib/supabase'
import { useAppStore } from '@/lib/store'
import { MessageSquare, MessageCircle, Send, RefreshCw, Users } from 'lucide-react'
import toast from 'react-hot-toast'

export default function MessagesPage() {
  const supabase = createClient()
  const { organization, profile } = useAppStore()
  const [threads, setThreads]     = useState<any[]>([])
  const [active, setActive]       = useState<any>(null)
  const [messages, setMessages]   = useState<any[]>([])
  const [reply, setReply]         = useState('')
  const [loading, setLoading]     = useState(true)
  const [sending, setSending]     = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => { if (organization) load() }, [organization])
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages])

  // Auto-refresh every 15s for incoming WhatsApp replies
  useEffect(() => {
    const interval = setInterval(() => {
      if (active) loadThread(active)
      else load()
    }, 15000)
    return () => clearInterval(interval)
  }, [active])

  const load = async () => {
    setLoading(true)
    // All messages for this org — group into threads by contact or member
    const { data: all } = await supabase
      .from('app_messages')
      .select('*, sender:profiles!app_messages_sender_id_fkey(full_name), contact:contacts(id,name,phone,whatsapp_number)')
      .eq('organization_id', organization!.id)
      .order('created_at', { ascending: false })

    if (!all) { setLoading(false); return }

    // Group messages into conversation threads
    const threadMap = new Map<string, any>()

    all.forEach((m: any) => {
      const contactId  = m.recipient_contact_id
      const contactObj = m.contact as any
      const isInbound  = m.metadata?.direction === 'inbound' || (!m.sender_id)

      // Thread key: prefer contact_id, fallback to other party profile
      let key: string
      let threadName: string
      let threadPhone: string | null = null
      let isWhatsApp = m.channel === 'whatsapp'

      if (contactId) {
        key         = `contact_${contactId}`
        threadName  = contactObj?.name || m.metadata?.from_name || 'Contact'
        threadPhone = contactObj?.whatsapp_number || contactObj?.phone || m.metadata?.from_phone || null
      } else if (m.channel === 'app') {
        const otherId = m.sender_id === profile?.id ? m.recipient_id : m.sender_id
        key        = `member_${otherId}`
        threadName = (m.sender as any)?.full_name || 'Team Member'
      } else {
        return // skip orphan messages
      }

      if (!threadMap.has(key)) {
        threadMap.set(key, {
          key, threadName, isWhatsApp, contactId, threadPhone,
          memberId: m.channel === 'app' ? (m.sender_id === profile?.id ? m.recipient_id : m.sender_id) : null,
          lastMessage: m.body,
          lastTime:    m.created_at,
          unread: isInbound && !m.is_read ? 1 : 0,
        })
      } else {
        if (isInbound && !m.is_read) threadMap.get(key)!.unread++
      }
    })

    setThreads(Array.from(threadMap.values()))
    setLoading(false)
  }

  const loadThread = async (thread: any) => {
    setActive(thread)

    let q = supabase
      .from('app_messages')
      .select('*, sender:profiles!app_messages_sender_id_fkey(full_name)')
      .eq('organization_id', organization!.id)
      .order('created_at', { ascending: true })
      .limit(100)

    if (thread.contactId) {
      // WhatsApp thread — all messages (in and out) linked to this contact
      q = q.eq('recipient_contact_id', thread.contactId)
    } else if (thread.memberId) {
      // In-app thread — messages between me and this member
      q = q.or(
        `and(sender_id.eq.${profile?.id},recipient_id.eq.${thread.memberId}),and(sender_id.eq.${thread.memberId},recipient_id.eq.${profile?.id})`
      )
    }

    const { data } = await q
    setMessages(data || [])

    // Mark inbound messages as read
    if (thread.unread > 0) {
      await supabase
        .from('app_messages')
        .update({ is_read: true, read_at: new Date().toISOString() })
        .eq('organization_id', organization!.id)
        .eq('is_read', false)
        .eq('recipient_contact_id', thread.contactId || null)
    }

    // Update thread unread to 0
    setThreads(prev => prev.map(t => t.key === thread.key ? { ...t, unread: 0 } : t))
  }

  const sendReply = async () => {
    if (!reply.trim() || !active) return
    setSending(true)

    if (active.isWhatsApp) {
      const res = await fetch('/api/whatsapp', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contact_id:    active.contactId,
          contact_phone: active.threadPhone,
          message:       reply,
        }),
      })
      const data = await res.json()
      if (!res.ok) { toast.error(data.error || 'WhatsApp send failed'); setSending(false); return }
    } else {
      const res = await fetch('/api/messages', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ recipient_id: active.memberId, message: reply }),
      })
      const data = await res.json()
      if (!res.ok) { toast.error(data.error); setSending(false); return }
    }

    setReply('')
    setSending(false)
    await loadThread(active)
    load()
  }

  const timeAgo = (d: string) => {
    const diff = Date.now() - new Date(d).getTime()
    const m = Math.floor(diff / 60000)
    if (m < 1) return 'Just now'
    if (m < 60) return `${m}m ago`
    const h = Math.floor(m / 60)
    if (h < 24) return `${h}h ago`
    return `${Math.floor(h / 24)}d ago`
  }

  return (
    <div className="animate-fade-up flex flex-col" style={{ height: 'calc(100vh - 120px)' }}>
      <div className="flex items-center justify-between mb-4 flex-shrink-0">
        <div>
          <h1 className="text-lg sm:text-xl font-bold" style={{ color: 'var(--text-primary)' }}>Messages</h1>
          <p className="text-xs sm:text-sm mt-0.5" style={{ color: 'var(--text-secondary)' }}>
            In-app team messages + WhatsApp conversations (sent and received)
          </p>
        </div>
        <button onClick={() => { load(); if (active) loadThread(active) }} className="btn-secondary">
          <RefreshCw size={14} />Refresh
        </button>
      </div>

      <div className="flex gap-4 flex-1 min-h-0">

        {/* Thread list */}
        <div className="w-72 flex-shrink-0 flex flex-col gap-2 overflow-y-auto">
          {loading ? (
            Array(4).fill(0).map((_, i) => <div key={i} className="skeleton h-16 rounded-xl" />)
          ) : threads.length === 0 ? (
            <div className="card p-8 flex flex-col items-center text-center gap-3" style={{ color: 'var(--text-muted)' }}>
              <MessageSquare size={32} style={{ opacity: 0.3 }} />
              <p className="text-sm">No messages yet</p>
              <p className="text-xs">Send a message from the Contacts page to start a conversation</p>
            </div>
          ) : threads.map(t => (
            <button key={t.key} onClick={() => loadThread(t)}
              className="card p-3 text-left transition-all"
              style={{
                border: active?.key === t.key ? '1.5px solid var(--brand)' : '1px solid var(--border)',
                background: active?.key === t.key ? 'var(--brand-dim)' : 'var(--bg-card)',
              }}>
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0"
                  style={{ background: t.isWhatsApp ? '#25D366' : 'var(--brand)', color: 'white' }}>
                  {t.threadName?.charAt(0)?.toUpperCase()}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-1">
                    <p className="text-sm font-semibold truncate" style={{ color: 'var(--text-primary)' }}>{t.threadName}</p>
                    <p className="text-xs flex-shrink-0" style={{ color: 'var(--text-muted)' }}>{timeAgo(t.lastTime)}</p>
                  </div>
                  <div className="flex items-center gap-1 mt-0.5">
                    {t.isWhatsApp
                      ? <MessageSquare size={10} style={{ color: '#25D366', flexShrink: 0 }} />
                      : <MessageCircle size={10} style={{ color: 'var(--brand)', flexShrink: 0 }} />}
                    <p className="text-xs truncate" style={{ color: 'var(--text-secondary)' }}>{t.lastMessage}</p>
                  </div>
                </div>
                {t.unread > 0 && (
                  <span className="w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0"
                    style={{ background: 'var(--danger)', color: 'white' }}>{t.unread}</span>
                )}
              </div>
            </button>
          ))}
        </div>

        {/* Chat area */}
        <div className="flex-1 card flex flex-col min-h-0 overflow-hidden">
          {!active ? (
            <div className="flex-1 flex flex-col items-center justify-center gap-3" style={{ color: 'var(--text-muted)' }}>
              <MessageSquare size={40} style={{ opacity: 0.2 }} />
              <p className="text-sm">Select a conversation from the left</p>
            </div>
          ) : (
            <>
              {/* Header */}
              <div className="flex items-center gap-3 p-4 flex-shrink-0" style={{ borderBottom: '1px solid var(--border)' }}>
                <div className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold"
                  style={{ background: active.isWhatsApp ? '#25D366' : 'var(--brand)', color: 'white' }}>
                  {active.threadName?.charAt(0)?.toUpperCase()}
                </div>
                <div>
                  <p className="font-semibold text-sm" style={{ color: 'var(--text-primary)' }}>{active.threadName}</p>
                  <div className="flex items-center gap-1">
                    {active.isWhatsApp
                      ? <><MessageSquare size={11} style={{ color: '#25D366' }} /><span className="text-xs" style={{ color: '#25D366' }}>WhatsApp · Replies appear here automatically</span></>
                      : <><MessageCircle size={11} style={{ color: 'var(--brand)' }} /><span className="text-xs" style={{ color: 'var(--brand)' }}>In-App</span></>}
                  </div>
                </div>
              </div>

              {/* Messages */}
              <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {messages.length === 0 ? (
                  <p className="text-center text-sm py-8" style={{ color: 'var(--text-muted)' }}>No messages yet — send one below</p>
                ) : messages.map((m: any, i) => {
                  const isMe      = !!m.sender_id && m.sender_id === profile?.id
                  const isInbound = m.metadata?.direction === 'inbound' || (!m.sender_id)
                  return (
                    <div key={m.id || i} className={`flex ${isInbound ? 'justify-start' : 'justify-end'}`}>
                      <div className="max-w-xs sm:max-w-sm">
                        <div className="rounded-2xl px-4 py-2.5 text-sm"
                          style={{
                            background: isInbound ? 'var(--bg-table-head)' : 'var(--brand)',
                            color: isInbound ? 'var(--text-primary)' : 'white',
                            borderRadius: isInbound ? '4px 18px 18px 18px' : '18px 4px 18px 18px',
                          }}>
                          {m.body}
                        </div>
                        <p className="text-xs mt-1 px-1" style={{ color: 'var(--text-muted)', textAlign: isInbound ? 'left' : 'right' }}>
                          {isInbound ? (m.metadata?.from_name || (m.sender as any)?.full_name || 'Contact') : 'You'}
                          {' · '}{timeAgo(m.created_at)}
                          {m.whatsapp_status && m.whatsapp_status !== 'received' && ` · ${m.whatsapp_status}`}
                        </p>
                      </div>
                    </div>
                  )
                })}
                <div ref={bottomRef} />
              </div>

              {/* Reply input */}
              <div className="p-3 flex gap-2 flex-shrink-0" style={{ borderTop: '1px solid var(--border)' }}>
                <textarea
                  className="input text-sm flex-1"
                  rows={2}
                  placeholder={active.isWhatsApp ? 'Reply via WhatsApp…' : 'Reply in-app…'}
                  value={reply}
                  onChange={e => setReply(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendReply() } }}
                  style={{ resize: 'none', height: 'auto' }}
                />
                <button className="btn-primary px-3" onClick={sendReply} disabled={sending || !reply.trim()}>
                  {sending ? <RefreshCw size={16} className="animate-spin" /> : <Send size={16} />}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

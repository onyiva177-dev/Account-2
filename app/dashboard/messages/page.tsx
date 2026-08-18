'use client'
import { useEffect, useState, useRef } from 'react'
import { createClient } from '@/lib/supabase'
import { useAppStore } from '@/lib/store'
import { MessageSquare, MessageCircle, Send, Search, RefreshCw, Users } from 'lucide-react'
import toast from 'react-hot-toast'

export default function MessagesPage() {
  const supabase = createClient()
  const { organization, profile } = useAppStore()
  const [threads, setThreads]       = useState<any[]>([])   // list of conversations
  const [active, setActive]         = useState<any>(null)   // selected thread
  const [messages, setMessages]     = useState<any[]>([])   // messages in active thread
  const [reply, setReply]           = useState('')
  const [loading, setLoading]       = useState(true)
  const [sending, setSending]       = useState(false)
  const [teamMembers, setTeamMembers] = useState<any[]>([])
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => { if (organization) load() }, [organization])
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior:'smooth' }) }, [messages])

  // Auto-refresh every 15s for new incoming WhatsApp replies
  useEffect(() => {
    const interval = setInterval(() => { if (active) loadThread(active) }, 15000)
    return () => clearInterval(interval)
  }, [active])

  const load = async () => {
    setLoading(true)
    // Get all unique conversations grouped by contact or recipient
    const { data: all } = await supabase.from('app_messages')
      .select('*, sender:profiles!app_messages_sender_id_fkey(full_name), contact:contacts(name,phone,whatsapp_number)')
      .eq('organization_id', organization!.id)
      .order('created_at', { ascending: false })

    if (!all) { setLoading(false); return }

    // Group into threads
    const threadMap = new Map<string, any>()
    all.forEach((m: any) => {
      const key = m.recipient_contact_id
        ? `contact_${m.recipient_contact_id}`
        : m.recipient_id
        ? `member_${m.sender_id === profile?.id ? m.recipient_id : m.sender_id}`
        : `unknown`

      const contactName = m.contact?.name || m.metadata?.from_name || 'Unknown'
      const isWhatsApp  = m.channel === 'whatsapp'
      const isIncoming  = !m.sender_id || m.sender_id !== profile?.id

      if (!threadMap.has(key)) {
        threadMap.set(key, {
          key,
          name:        contactName,
          channel:     m.channel,
          contactId:   m.recipient_contact_id || null,
          memberId:    m.recipient_id || null,
          lastMessage: m.body,
          lastTime:    m.created_at,
          unread:      isIncoming && !m.is_read ? 1 : 0,
          isWhatsApp,
          fromPhone:   m.metadata?.from_phone || m.contact?.whatsapp_number || m.contact?.phone,
        })
      } else {
        const t = threadMap.get(key)
        if (isIncoming && !m.is_read) t.unread++
      }
    })

    setThreads(Array.from(threadMap.values()))

    // Load team members for in-app messaging
    const { data: members } = await supabase.from('profiles')
      .select('id, full_name, email').eq('organization_id', organization!.id)
    setTeamMembers(members || [])
    setLoading(false)
  }

  const loadThread = async (thread: any) => {
    setActive(thread)
    let query = supabase.from('app_messages')
      .select('*, sender:profiles!app_messages_sender_id_fkey(full_name), contact:contacts(name)')
      .eq('organization_id', organization!.id)
      .eq('channel', thread.channel)
      .order('created_at', { ascending: true })

    if (thread.contactId) {
      query = query.eq('recipient_contact_id', thread.contactId)
    } else if (thread.memberId) {
      query = query.or(
        `and(sender_id.eq.${profile?.id},recipient_id.eq.${thread.memberId}),and(sender_id.eq.${thread.memberId},recipient_id.eq.${profile?.id})`
      )
    }

    const { data } = await query.limit(100)
    setMessages(data || [])

    // Mark unread as read
    await supabase.from('app_messages')
      .update({ is_read: true, read_at: new Date().toISOString() })
      .eq('organization_id', organization!.id)
      .eq('is_read', false)
      .neq('sender_id', profile?.id)
  }

  const sendReply = async () => {
    if (!reply.trim() || !active) return
    setSending(true)

    if (active.isWhatsApp && active.fromPhone) {
      const res = await fetch('/api/whatsapp', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contact_id: active.contactId, message: reply, contact_phone: active.fromPhone }),
      })
      const data = await res.json()
      if (!res.ok) { toast.error(data.error || 'Failed to send'); setSending(false); return }
    } else if (active.memberId) {
      const res = await fetch('/api/messages', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ recipient_id: active.memberId, message: reply }),
      })
      const data = await res.json()
      if (!res.ok) { toast.error(data.error); setSending(false); return }
    }

    setReply('')
    setSending(false)
    loadThread(active)
    load()
  }

  const timeAgo = (d: string) => {
    const diff = Date.now() - new Date(d).getTime()
    const mins = Math.floor(diff/60000)
    if (mins < 1) return 'Just now'
    if (mins < 60) return `${mins}m ago`
    const hrs = Math.floor(mins/60)
    if (hrs < 24) return `${hrs}h ago`
    return `${Math.floor(hrs/24)}d ago`
  }

  return (
    <div className="animate-fade-up flex flex-col h-full" style={{ height:'calc(100vh - 120px)' }}>
      <div className="flex items-center justify-between mb-4 flex-shrink-0">
        <div>
          <h1 className="text-lg sm:text-xl font-bold" style={{ color:'var(--text-primary)' }}>Messages</h1>
          <p className="text-xs sm:text-sm mt-0.5" style={{ color:'var(--text-secondary)' }}>
            In-app team messages + WhatsApp replies from contacts
          </p>
        </div>
        <button onClick={load} className="btn-secondary">
          <RefreshCw size={14}/>Refresh
        </button>
      </div>

      <div className="flex gap-4 flex-1 min-h-0">
        {/* Thread list */}
        <div className="w-72 flex-shrink-0 flex flex-col gap-2 overflow-y-auto">
          {loading ? (
            Array(4).fill(0).map((_,i) => <div key={i} className="skeleton h-16 rounded-xl"/>)
          ) : threads.length === 0 ? (
            <div className="card p-8 flex flex-col items-center text-center gap-3" style={{ color:'var(--text-muted)' }}>
              <MessageSquare size={32} style={{ opacity:0.3 }}/>
              <p className="text-sm">No messages yet</p>
              <p className="text-xs">Send a message from Contacts page</p>
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
                  style={{ background: t.isWhatsApp ? '#25D366' : 'var(--brand)', color:'white' }}>
                  {t.name?.charAt(0)?.toUpperCase()}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-1">
                    <p className="text-sm font-semibold truncate" style={{ color:'var(--text-primary)' }}>{t.name}</p>
                    <p className="text-xs flex-shrink-0" style={{ color:'var(--text-muted)' }}>{timeAgo(t.lastTime)}</p>
                  </div>
                  <div className="flex items-center gap-1 mt-0.5">
                    {t.isWhatsApp
                      ? <MessageSquare size={10} style={{ color:'#25D366', flexShrink:0 }}/>
                      : <MessageCircle size={10} style={{ color:'var(--brand)', flexShrink:0 }}/>}
                    <p className="text-xs truncate" style={{ color:'var(--text-secondary)' }}>{t.lastMessage}</p>
                  </div>
                </div>
                {t.unread > 0 && (
                  <span className="w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0"
                    style={{ background:'var(--danger)', color:'white' }}>{t.unread}</span>
                )}
              </div>
            </button>
          ))}
        </div>

        {/* Chat area */}
        <div className="flex-1 card flex flex-col min-h-0 overflow-hidden">
          {!active ? (
            <div className="flex-1 flex flex-col items-center justify-center gap-3" style={{ color:'var(--text-muted)' }}>
              <MessageSquare size={40} style={{ opacity:0.2 }}/>
              <p className="text-sm">Select a conversation</p>
            </div>
          ) : (
            <>
              {/* Thread header */}
              <div className="flex items-center gap-3 p-4 flex-shrink-0" style={{ borderBottom:'1px solid var(--border)' }}>
                <div className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold"
                  style={{ background: active.isWhatsApp ? '#25D366' : 'var(--brand)', color:'white' }}>
                  {active.name?.charAt(0)?.toUpperCase()}
                </div>
                <div>
                  <p className="font-semibold text-sm" style={{ color:'var(--text-primary)' }}>{active.name}</p>
                  <div className="flex items-center gap-1">
                    {active.isWhatsApp
                      ? <><MessageSquare size={11} style={{ color:'#25D366' }}/><span className="text-xs" style={{ color:'#25D366' }}>WhatsApp</span></>
                      : <><MessageCircle size={11} style={{ color:'var(--brand)' }}/><span className="text-xs" style={{ color:'var(--brand)' }}>In-App</span></>}
                  </div>
                </div>
              </div>

              {/* Messages */}
              <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {messages.map((m: any, i) => {
                  const isMe = m.sender_id === profile?.id
                  const isIncoming = !m.sender_id || !isMe
                  return (
                    <div key={m.id || i} className={`flex ${isIncoming ? 'justify-start' : 'justify-end'}`}>
                      <div className="max-w-xs sm:max-w-sm">
                        <div className="rounded-2xl px-4 py-2.5 text-sm"
                          style={{
                            background: isIncoming ? 'var(--bg-table-head)' : 'var(--brand)',
                            color: isIncoming ? 'var(--text-primary)' : 'white',
                            borderRadius: isIncoming ? '4px 18px 18px 18px' : '18px 4px 18px 18px',
                          }}>
                          {m.body}
                        </div>
                        <p className="text-xs mt-1 px-1" style={{ color:'var(--text-muted)', textAlign: isIncoming?'left':'right' }}>
                          {isIncoming ? (m.sender?.full_name || m.metadata?.from_name || 'Contact') : 'You'} · {timeAgo(m.created_at)}
                          {m.whatsapp_status && ` · ${m.whatsapp_status}`}
                        </p>
                      </div>
                    </div>
                  )
                })}
                <div ref={bottomRef}/>
              </div>

              {/* Reply box */}
              <div className="p-3 flex gap-2 flex-shrink-0" style={{ borderTop:'1px solid var(--border)' }}>
                <textarea
                  className="input text-sm flex-1"
                  rows={2}
                  placeholder={active.isWhatsApp ? 'Reply via WhatsApp…' : 'Reply in-app…'}
                  value={reply}
                  onChange={e => setReply(e.target.value)}
                  onKeyDown={e => { if (e.key==='Enter' && !e.shiftKey) { e.preventDefault(); sendReply() } }}
                  style={{ resize:'none', height:'auto' }}
                />
                <button className="btn-primary px-3" onClick={sendReply} disabled={sending || !reply.trim()}>
                  {sending ? <RefreshCw size={16} className="animate-spin"/> : <Send size={16}/>}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

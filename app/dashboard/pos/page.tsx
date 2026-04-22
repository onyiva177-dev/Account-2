'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'
import { useAppStore } from '@/lib/store'
import { formatCurrency } from '@/lib/utils'
import { ShoppingCart, Plus, Minus, Trash2, CreditCard, Banknote, Smartphone, Search, Package, CheckCircle2, PackageX } from 'lucide-react'
import toast from 'react-hot-toast'

type CartItem = { id:string; name:string; price:number; qty:number; code:string; tax_rate:number }

export default function POSPage() {
  const supabase = createClient()
  const { organization, profile } = useAppStore()
  const currency = organization?.base_currency || 'KES'
  const [products, setProducts]     = useState<any[]>([])
  const [cart, setCart]             = useState<CartItem[]>([])
  const [search, setSearch]         = useState('')
  const [payMethod, setPayMethod]   = useState<'cash'|'card'|'mobile'>('cash')
  const [cashReceived, setCashReceived] = useState('')
  const [success, setSuccess]       = useState(false)
  const [loading, setLoading]       = useState(true)
  const [processing, setProcessing] = useState(false)
  const [session, setSession]       = useState<any>(null)
  // Mobile: toggle between products and cart
  const [mobileTab, setMobileTab]   = useState<'products'|'cart'>('products')

  useEffect(() => { if (organization) { loadProducts(); openSession() } }, [organization])

  const loadProducts = async () => {
    setLoading(true)
    const { data } = await supabase.from('products').select('*')
      .eq('organization_id', organization!.id).eq('is_active', true).order('name')
    setProducts(data || [])
    setLoading(false)
  }

  const openSession = async () => {
    const today = new Date().toISOString().split('T')[0]
    const { data: existing } = await supabase.from('pos_sessions').select('*')
      .eq('organization_id', organization!.id).eq('status', 'open')
      .gte('opened_at', today).limit(1).single()
    if (existing) { setSession(existing) } else {
      const { data: ns } = await supabase.from('pos_sessions')
        .insert({ organization_id:organization!.id, cashier_id:profile?.id, opening_cash:0, status:'open' })
        .select().single()
      setSession(ns)
    }
  }

  const filtered = products.filter(p =>
    !search || p.name?.toLowerCase().includes(search.toLowerCase()) ||
    p.code?.toLowerCase().includes(search.toLowerCase()) || p.barcode?.includes(search))

  const addToCart = (product:any) => {
    if (product.stock_quantity<=0 && product.type==='product') { toast.error(`${product.name} is out of stock`); return }
    setCart(prev => {
      const ex = prev.find(i=>i.id===product.id)
      if (ex) return prev.map(i=>i.id===product.id?{...i,qty:i.qty+1}:i)
      return [...prev, { id:product.id, name:product.name, price:product.selling_price, qty:1, code:product.code, tax_rate:product.tax_rate||0 }]
    })
    // Switch to cart tab on mobile after adding
    setMobileTab('cart')
  }

  const updateQty = (id:string, delta:number) =>
    setCart(prev=>prev.map(i=>i.id===id?{...i,qty:Math.max(0,i.qty+delta)}:i).filter(i=>i.qty>0))
  const removeItem = (id:string) => setCart(prev=>prev.filter(i=>i.id!==id))

  const subtotal  = cart.reduce((s,i)=>s+i.price*i.qty,0)
  const taxAmount = cart.reduce((s,i)=>s+(i.price*i.qty*(i.tax_rate/100)),0)
  const total     = subtotal+taxAmount
  const change    = payMethod==='cash'?(Number(cashReceived)||0)-total:0

  const handleCheckout = async () => {
    if (cart.length===0) { toast.error('Cart is empty'); return }
    if (payMethod==='cash'&&Number(cashReceived)<total) { toast.error('Insufficient cash received'); return }
    if (!session) { toast.error('No active POS session'); return }
    setProcessing(true)
    const orderNum = `POS-${Date.now().toString().slice(-6)}`
    const { data: order, error } = await supabase.from('pos_orders').insert({
      organization_id:organization!.id, session_id:session.id, order_number:orderNum,
      status:'paid', subtotal, tax_amount:taxAmount, total, payment_method:payMethod, created_by:profile?.id
    }).select().single()
    if (error) { toast.error('Failed to process sale'); setProcessing(false); return }
    await supabase.from('pos_order_items').insert(
      cart.map((item,i)=>({ order_id:order.id, product_id:item.id, quantity:item.qty,
        unit_price:item.price, tax_amount:item.price*item.qty*(item.tax_rate/100),
        total:item.price*item.qty*(1+item.tax_rate/100), line_number:i+1 })))
    for (const item of cart) {
      const product = products.find(p=>p.id===item.id)
      if (product&&product.type==='product') {
        await supabase.from('products').update({ stock_quantity:Math.max(0,product.stock_quantity-item.qty) }).eq('id',item.id)
        await supabase.from('stock_movements').insert({
          organization_id:organization!.id, product_id:item.id, type:'out',
          quantity:item.qty, unit_cost:product.cost_price, reference:orderNum })
      }
    }
    await supabase.from('pos_sessions').update({ total_sales:(session.total_sales||0)+total }).eq('id',session.id)
    toast.success(`Sale ${orderNum} completed!`)
    setProcessing(false); setSuccess(true); loadProducts()
    setTimeout(() => { setSuccess(false); setCart([]); setCashReceived(''); setMobileTab('products') }, 3000)
  }

  // ── Shared cart panel content ─────────────────────────────────────────────
  const CartPanel = () => (
    <div className="flex flex-col gap-3 h-full">
      {/* Cart items */}
      <div className="card flex-1 flex flex-col p-3 sm:p-4" style={{ minHeight:'200px' }}>
        <div className="flex items-center gap-2 mb-3">
          <ShoppingCart size={16} style={{ color:'var(--text-secondary)' }}/>
          <h2 className="font-bold text-sm" style={{ color:'var(--text-primary)' }}>Cart</h2>
          {cart.length>0 && <span className="badge text-xs ml-auto" style={{ background:'var(--brand-dim)', color:'var(--brand)' }}>{cart.length}</span>}
        </div>
        {success ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center gap-3">
            <div className="w-14 h-14 rounded-full flex items-center justify-center" style={{ background:'var(--success-dim)' }}>
              <CheckCircle2 size={28} style={{ color:'var(--success)' }}/>
            </div>
            <div>
              <p className="font-bold text-base" style={{ color:'var(--text-primary)' }}>Sale Complete!</p>
              {payMethod==='cash'&&change>0 && (
                <p className="text-sm font-semibold mt-1" style={{ color:'var(--success)' }}>
                  Change: {formatCurrency(change,currency)}
                </p>
              )}
            </div>
          </div>
        ) : cart.length===0 ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center gap-2" style={{ color:'var(--text-muted)' }}>
            <ShoppingCart size={32} style={{ opacity:0.3 }}/>
            <p className="text-sm">Cart empty — tap a product</p>
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto space-y-2">
            {cart.map(item => (
              <div key={item.id} className="flex items-center gap-2 py-2" style={{ borderBottom:'1px solid var(--border-light)' }}>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate" style={{ color:'var(--text-primary)' }}>{item.name}</p>
                  <p className="text-xs" style={{ color:'var(--text-muted)' }}>{formatCurrency(item.price,currency)}</p>
                </div>
                <div className="flex items-center gap-1">
                  <button onClick={()=>updateQty(item.id,-1)} className="w-6 h-6 rounded flex items-center justify-center text-xs font-bold"
                    style={{ background:'var(--bg-table-head)', color:'var(--text-primary)' }}>
                    <Minus size={10}/>
                  </button>
                  <span className="w-5 text-center text-sm font-bold" style={{ color:'var(--text-primary)' }}>{item.qty}</span>
                  <button onClick={()=>updateQty(item.id,1)} className="w-6 h-6 rounded flex items-center justify-center"
                    style={{ background:'var(--brand-dim)', color:'var(--brand)' }}>
                    <Plus size={10}/>
                  </button>
                </div>
                <span className="text-sm font-bold font-mono w-20 text-right" style={{ color:'var(--text-primary)' }}>
                  {formatCurrency(item.price*item.qty,currency)}
                </span>
                <button onClick={()=>removeItem(item.id)} style={{ color:'var(--text-muted)' }}>
                  <Trash2 size={12}/>
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Payment */}
      <div className="card p-3 sm:p-4 space-y-3">
        <div className="space-y-1 text-sm">
          <div className="flex justify-between" style={{ color:'var(--text-secondary)' }}>
            <span>Subtotal</span><span>{formatCurrency(subtotal,currency)}</span>
          </div>
          <div className="flex justify-between" style={{ color:'var(--text-secondary)' }}>
            <span>Tax</span><span>{formatCurrency(taxAmount,currency)}</span>
          </div>
          <div className="flex justify-between font-bold text-base pt-1" style={{ borderTop:'1px solid var(--border)', color:'var(--text-primary)' }}>
            <span>Total</span>
            <span style={{ color:'var(--brand)' }}>{formatCurrency(total,currency)}</span>
          </div>
        </div>
        <div>
          <p className="text-xs font-medium mb-2" style={{ color:'var(--text-muted)' }}>Payment Method</p>
          <div className="grid grid-cols-3 gap-2">
            {([{ key:'cash',icon:Banknote,label:'Cash' },{ key:'card',icon:CreditCard,label:'Card' },{ key:'mobile',icon:Smartphone,label:'M-Pesa' }] as const).map(m=>(
              <button key={m.key} onClick={()=>setPayMethod(m.key)}
                className="flex flex-col items-center gap-1 p-2 rounded-xl border transition-all text-xs font-medium"
                style={{
                  border: payMethod===m.key?`1px solid var(--brand)`:`1px solid var(--border)`,
                  background: payMethod===m.key?'var(--brand-dim)':'transparent',
                  color: payMethod===m.key?'var(--brand)':'var(--text-secondary)',
                }}>
                <m.icon size={15}/>{m.label}
              </button>
            ))}
          </div>
        </div>
        {payMethod==='cash' && (
          <div>
            <label className="input-label">Cash Received</label>
            <input type="number" className="input" placeholder="0.00" value={cashReceived} onChange={e=>setCashReceived(e.target.value)}/>
            {change>0 && <p className="text-xs mt-1 font-semibold" style={{ color:'var(--success)' }}>Change: {formatCurrency(change,currency)}</p>}
          </div>
        )}
        <button onClick={handleCheckout} disabled={cart.length===0||processing}
          className="btn-primary w-full justify-center py-2.5">
          {processing
            ? <span className="flex items-center gap-2"><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"/>Processing…</span>
            : <><CheckCircle2 size={16}/>Complete Sale</>}
        </button>
      </div>
    </div>
  )

  return (
    <div className="animate-fade-up h-full flex flex-col gap-3">
      {/* Header */}
      <div>
        <h1 className="text-lg sm:text-xl font-bold" style={{ color:'var(--text-primary)' }}>Point of Sale</h1>
        <p className="text-xs sm:text-sm" style={{ color:'var(--text-secondary)' }}>
          {session?`Session open · ${products.length} products`:'Opening session…'}
        </p>
      </div>

      {/* ── MOBILE: tab switcher ── */}
      <div className="flex gap-1 p-1 rounded-xl lg:hidden" style={{ background:'var(--bg-table-head)' }}>
        {([{ key:'products',label:`Products (${filtered.length})` },{ key:'cart',label:`Cart (${cart.length})` }] as const).map(t=>(
          <button key={t.key} onClick={()=>setMobileTab(t.key)}
            className="flex-1 py-2 rounded-lg text-sm font-medium transition-all"
            style={{
              background: mobileTab===t.key?'var(--bg-card)':'transparent',
              color: mobileTab===t.key?'var(--text-primary)':'var(--text-secondary)',
              boxShadow: mobileTab===t.key?'0 1px 3px rgba(0,0,0,0.1)':'none',
            }}>{t.label}</button>
        ))}
      </div>

      {/* ── MOBILE: products tab ── */}
      <div className={`flex-1 flex flex-col gap-3 lg:hidden ${mobileTab==='products'?'':'hidden'}`}>
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color:'var(--text-muted)' }}/>
          <input className="input pl-8 text-sm" placeholder="Search or scan barcode…" value={search} onChange={e=>setSearch(e.target.value)}/>
        </div>
        {loading ? (
          <div className="grid grid-cols-2 gap-2">{Array(6).fill(0).map((_,i)=><div key={i} className="skeleton h-28 rounded-xl"/>)}</div>
        ) : products.length===0 ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center gap-3 py-12" style={{ color:'var(--text-muted)' }}>
            <PackageX size={36} style={{ opacity:0.3 }}/>
            <p className="text-sm">Add products in Inventory first</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-2 overflow-y-auto flex-1 pb-2">
            {filtered.map(product=>{
              const out = product.type==='product'&&product.stock_quantity<=0
              return (
                <button key={product.id} onClick={()=>addToCart(product)} disabled={out}
                  className="card p-3 text-left transition-all"
                  style={{ opacity:out?0.5:1, cursor:out?'not-allowed':'pointer' }}>
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center mb-2" style={{ background:'var(--brand-dim)' }}>
                    <Package size={15} style={{ color:'var(--brand)' }}/>
                  </div>
                  <p className="font-semibold text-xs truncate" style={{ color:'var(--text-primary)' }}>{product.name}</p>
                  <p className="text-xs" style={{ color:'var(--text-muted)' }}>{product.code}</p>
                  {product.type==='product'&&<p className="text-xs mt-0.5" style={{ color:'var(--text-secondary)' }}>
                    {out?'Out of stock':`Qty: ${product.stock_quantity}`}</p>}
                  <p className="font-bold text-sm mt-1" style={{ color:'var(--brand)' }}>{formatCurrency(product.selling_price,currency)}</p>
                </button>
              )
            })}
          </div>
        )}
      </div>

      {/* ── MOBILE: cart tab ── */}
      <div className={`flex-1 flex flex-col lg:hidden ${mobileTab==='cart'?'':'hidden'}`}>
        <CartPanel/>
      </div>

      {/* ── DESKTOP: side by side ── */}
      <div className="hidden lg:flex gap-5 flex-1">
        {/* Products panel */}
        <div className="flex-1 flex flex-col gap-3 min-w-0">
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color:'var(--text-muted)' }}/>
            <input className="input pl-8" placeholder="Search by name, code or scan barcode…" value={search} onChange={e=>setSearch(e.target.value)}/>
          </div>
          {loading ? (
            <div className="grid grid-cols-2 xl:grid-cols-3 gap-3">{Array(6).fill(0).map((_,i)=><div key={i} className="skeleton h-32 rounded-xl"/>)}</div>
          ) : products.length===0 ? (
            <div className="flex-1 flex flex-col items-center justify-center text-slate-400 gap-3">
              <PackageX size={40} style={{ opacity:0.3 }}/><p className="text-sm">Add products in Inventory first</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 xl:grid-cols-3 gap-3 overflow-y-auto flex-1 pb-4">
              {filtered.map(product=>{
                const out=product.type==='product'&&product.stock_quantity<=0
                return (
                  <button key={product.id} onClick={()=>{ addToCart(product); setMobileTab('cart') }} disabled={out}
                    className="card p-4 text-left transition-all group"
                    style={{ opacity:out?0.5:1, cursor:out?'not-allowed':'pointer' }}>
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-3" style={{ background:'var(--brand-dim)' }}>
                      <Package size={18} style={{ color:'var(--brand)' }}/>
                    </div>
                    <p className="font-semibold text-sm truncate" style={{ color:'var(--text-primary)' }}>{product.name}</p>
                    <p className="text-xs mt-0.5" style={{ color:'var(--text-muted)' }}>{product.code}</p>
                    {product.type==='product'&&<p className="text-xs mt-0.5" style={{ color:'var(--text-secondary)' }}>
                      {out?'Out of stock':`Stock: ${product.stock_quantity}`}</p>}
                    <p className="font-bold mt-2" style={{ color:'var(--brand)' }}>{formatCurrency(product.selling_price,currency)}</p>
                  </button>
                )
              })}
            </div>
          )}
        </div>
        {/* Cart panel */}
        <div className="w-80 xl:w-96 flex-shrink-0 flex flex-col gap-3"><CartPanel/></div>
      </div>
    </div>
  )
}

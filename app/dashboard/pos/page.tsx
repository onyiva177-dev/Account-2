'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'
import { useAppStore } from '@/lib/store'
import { formatCurrency } from '@/lib/utils'
import { ShoppingCart, Plus, Minus, Trash2, Search, CheckCircle2, RefreshCw, Smartphone, CreditCard, Banknote, Package, PackageX, Tag } from 'lucide-react'
import toast from 'react-hot-toast'

type CartItem = { id:string; name:string; price:number; qty:number; code:string; tax_rate:number; stock:number }

export default function POSPage() {
  const supabase = createClient()
  const { organization, profile } = useAppStore()
  const currency = organization?.base_currency || 'KES'
  const [products,   setProducts]   = useState<any[]>([])
  const [cart,       setCart]       = useState<CartItem[]>([])
  const [search,     setSearch]     = useState('')
  const [payMethod,  setPayMethod]  = useState<'cash'|'card'|'mpesa'>('cash')
  const [cashIn,     setCashIn]     = useState('')
  const [phoneNo,    setPhoneNo]    = useState('')
  const [success,    setSuccess]    = useState<any>(null)
  const [loading,    setLoading]    = useState(true)
  const [processing, setProcessing] = useState(false)
  const [session,    setSession]    = useState<any>(null)
  const [mobileTab,  setMobileTab]  = useState<'products'|'cart'>('products')

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
      .gte('opened_at', today).limit(1).maybeSingle()
    if (existing) { setSession(existing); return }
    const { data: ns } = await supabase.from('pos_sessions').insert({
      organization_id: organization!.id, cashier_id: profile?.id, opening_cash: 0, status: 'open'
    }).select().single()
    setSession(ns)
  }

  const filtered = products.filter(p =>
    !search || p.name?.toLowerCase().includes(search.toLowerCase()) || p.code?.toLowerCase().includes(search.toLowerCase()))

  const addToCart = (product: any) => {
    if (product.type === 'product' && product.stock_quantity <= 0) { toast.error(`${product.name} out of stock`); return }
    setCart(prev => {
      const ex = prev.find(i => i.id === product.id)
      if (ex) return prev.map(i => i.id===product.id ? {...i,qty:i.qty+1} : i)
      return [...prev, { id:product.id, name:product.name, price:product.selling_price, qty:1, code:product.code, tax_rate:product.tax_rate||0, stock:product.stock_quantity }]
    })
    if (window.innerWidth < 1024) setMobileTab('cart')
  }

  const updateQty = (id: string, delta: number) =>
    setCart(prev => prev.map(i => i.id===id ? {...i,qty:Math.max(0,i.qty+delta)} : i).filter(i => i.qty>0))

  const subtotal  = cart.reduce((s,i) => s+i.price*i.qty, 0)
  const taxAmount = cart.reduce((s,i) => s+(i.price*i.qty*(i.tax_rate/100)), 0)
  const total     = subtotal + taxAmount
  const change    = payMethod==='cash' ? (Number(cashIn)||0)-total : 0

  const handleCheckout = async () => {
    if (cart.length === 0) { toast.error('Cart is empty'); return }
    if (payMethod==='cash' && Number(cashIn) < total) { toast.error('Cash received is less than total'); return }
    if (payMethod==='mpesa' && !phoneNo) { toast.error('Enter customer M-Pesa phone number'); return }
    if (!session) { toast.error('No session open'); return }
    setProcessing(true)

    // For M-Pesa — send STK push to CUSTOMER phone (goes to business shortcode)
    let mpesaReceiptRef = ''
    if (payMethod === 'mpesa') {
      const stkRes = await fetch('/api/mpesa', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: phoneNo, amount: total, tier_name: 'POS Sale' }),
      })
      const stkData = await stkRes.json()
      if (!stkRes.ok) { toast.error(stkData.error || 'M-Pesa STK failed'); setProcessing(false); return }
      mpesaReceiptRef = stkData.checkout_request_id || ''
      toast.success('STK push sent — waiting for customer PIN')
    }

    const orderNum = `POS-${Date.now().toString().slice(-6)}`

    // Create POS order
    const { data: order, error: orderErr } = await supabase.from('pos_orders').insert({
      organization_id: organization!.id, session_id: session.id,
      order_number: orderNum, status: 'paid',
      subtotal, tax_amount: taxAmount, total,
      payment_method: payMethod, created_by: profile?.id,
    }).select().single()
    if (orderErr) { toast.error('Sale failed: ' + orderErr.message); setProcessing(false); return }

    // Order items
    await supabase.from('pos_order_items').insert(
      cart.map((item, i) => ({
        order_id: order.id, product_id: item.id, quantity: item.qty,
        unit_price: item.price, tax_amount: item.price*item.qty*(item.tax_rate/100),
        total: item.price*item.qty*(1+item.tax_rate/100), line_number: i+1,
      }))
    )

    // Decrement stock + movements
    for (const item of cart) {
      const p = products.find(p => p.id===item.id)
      if (p?.type==='product') {
        await supabase.from('products').update({ stock_quantity: Math.max(0,p.stock_quantity-item.qty) }).eq('id',item.id)
        await supabase.from('stock_movements').insert({
          organization_id: organization!.id, product_id: item.id,
          type: 'out', quantity: item.qty, unit_cost: p.cost_price, reference: orderNum,
        })
      }
    }

    // ── Create TRANSACTION record (this makes it appear in Transactions page) ──
    await supabase.from('transactions').insert({
      organization_id: organization!.id,
      type:            'receipt',          // valid TransactionType
      number:          orderNum,
      date:            new Date().toISOString().split('T')[0],
      description:     `POS Sale — ${payMethod.toUpperCase()}${mpesaReceiptRef ? ' · '+mpesaReceiptRef : ''}`,
      subtotal,
      tax_amount:      taxAmount,
      total,
      amount_paid:     total,
      balance_due:     0,
      currency:        currency,
      status:          'paid',
    })

    // Auto journal entry
    const { error: jeErr } = await supabase.rpc('fn_pos_sale_journal', {
      p_order_id: order.id, p_org_id: organization!.id,
    })
    if (jeErr) toast.error('Journal entry failed: ' + jeErr.message)

    // Update session
    await supabase.from('pos_sessions').update({ total_sales:(session.total_sales||0)+total }).eq('id',session.id)

    setSuccess({ orderNum, total, change, method: payMethod })
    setProcessing(false)
    loadProducts()
    setTimeout(() => { setSuccess(null); setCart([]); setCashIn(''); setPhoneNo(''); setMobileTab('products') }, 4000)
  }

  const CartPanel = () => (
    <div className="flex flex-col gap-3 h-full">
      <div className="card flex-1 flex flex-col overflow-hidden" style={{ minHeight:200 }}>
        <div className="flex items-center justify-between px-4 py-3 flex-shrink-0" style={{ borderBottom:'1px solid var(--border)' }}>
          <div className="flex items-center gap-2">
            <ShoppingCart size={15} style={{ color:'var(--text-secondary)' }}/>
            <span className="font-semibold text-sm" style={{ color:'var(--text-primary)' }}>Cart</span>
          </div>
          {cart.length > 0 && <span className="badge badge-blue text-xs">{cart.length} item{cart.length!==1?'s':''}</span>}
        </div>
        {success ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center gap-3 p-4">
            <div className="w-16 h-16 rounded-full flex items-center justify-center" style={{ background:'var(--success-dim)' }}>
              <CheckCircle2 size={30} style={{ color:'var(--success)' }}/>
            </div>
            <div>
              <p className="font-bold text-base" style={{ color:'var(--text-primary)' }}>Sale Complete!</p>
              <p className="text-sm mt-1 font-mono" style={{ color:'var(--brand)' }}>{success.orderNum}</p>
              <p className="text-xs mt-1" style={{ color:'var(--text-muted)' }}>Recorded in Transactions & Journal</p>
              {success.method==='cash' && success.change > 0 && (
                <p className="text-sm font-bold mt-2" style={{ color:'var(--success)' }}>Change: {formatCurrency(success.change,currency)}</p>
              )}
              {success.method==='mpesa' && (
                <p className="text-xs mt-2" style={{ color:'var(--text-muted)' }}>Awaiting M-Pesa PIN confirmation</p>
              )}
            </div>
          </div>
        ) : cart.length===0 ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-2" style={{ color:'var(--text-muted)' }}>
            <ShoppingCart size={32} style={{ opacity:0.25 }}/><p className="text-sm">Tap a product to add</p>
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto p-3 space-y-2">
            {cart.map(item => (
              <div key={item.id} className="flex items-center gap-2 p-2 rounded-xl" style={{ background:'var(--bg-table-head)' }}>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate" style={{ color:'var(--text-primary)' }}>{item.name}</p>
                  <p className="text-xs" style={{ color:'var(--text-muted)' }}>{formatCurrency(item.price,currency)}</p>
                </div>
                <div className="flex items-center gap-1.5">
                  <button onClick={()=>updateQty(item.id,-1)} className="w-6 h-6 rounded-lg flex items-center justify-center" style={{ background:'var(--border)',color:'var(--text-primary)' }}><Minus size={10}/></button>
                  <span className="w-6 text-center text-sm font-bold" style={{ color:'var(--text-primary)' }}>{item.qty}</span>
                  <button onClick={()=>updateQty(item.id,1)} className="w-6 h-6 rounded-lg flex items-center justify-center" style={{ background:'var(--brand-dim)',color:'var(--brand)' }}><Plus size={10}/></button>
                </div>
                <span className="text-sm font-bold font-mono w-20 text-right" style={{ color:'var(--text-primary)' }}>{formatCurrency(item.price*item.qty,currency)}</span>
                <button onClick={()=>updateQty(item.id,-item.qty)} className="btn-ghost p-1" style={{ color:'var(--text-muted)' }}><Trash2 size={12}/></button>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="card p-4 space-y-3">
        <div className="space-y-1">
          <div className="flex justify-between text-sm" style={{ color:'var(--text-secondary)' }}><span>Subtotal</span><span>{formatCurrency(subtotal,currency)}</span></div>
          {taxAmount>0 && <div className="flex justify-between text-sm" style={{ color:'var(--text-secondary)' }}><span>Tax</span><span>{formatCurrency(taxAmount,currency)}</span></div>}
          <div className="flex justify-between font-bold text-base pt-1" style={{ borderTop:'1px solid var(--border)',color:'var(--text-primary)' }}>
            <span>Total</span><span style={{ color:'var(--brand)' }}>{formatCurrency(total,currency)}</span>
          </div>
        </div>

        <div>
          <p className="text-xs font-medium mb-2" style={{ color:'var(--text-muted)' }}>Payment Method</p>
          <div className="grid grid-cols-3 gap-2">
            {([{key:'cash',icon:Banknote,label:'Cash'},{key:'card',icon:CreditCard,label:'Card'},{key:'mpesa',icon:Smartphone,label:'M-Pesa'}] as const).map(m=>(
              <button key={m.key} onClick={()=>setPayMethod(m.key)}
                className="flex flex-col items-center gap-1 py-2 px-1 rounded-xl text-xs font-medium transition-all"
                style={{ border:`1.5px solid ${payMethod===m.key?'var(--brand)':'var(--border)'}`,background:payMethod===m.key?'var(--brand-dim)':'transparent',color:payMethod===m.key?'var(--brand)':'var(--text-secondary)' }}>
                <m.icon size={16}/>{m.label}
              </button>
            ))}
          </div>
        </div>

        {payMethod==='cash' && (
          <div>
            <label className="input-label">Cash Received</label>
            <input type="number" className="input" placeholder="0.00" value={cashIn} onChange={e=>setCashIn(e.target.value)}/>
            {change>0 && <p className="text-sm font-bold mt-1" style={{ color:'var(--success)' }}>Change: {formatCurrency(change,currency)}</p>}
          </div>
        )}

        {payMethod==='mpesa' && (
          <div>
            <label className="input-label">Customer Phone Number</label>
            <input type="tel" className="input" placeholder="07XXXXXXXX" value={phoneNo} onChange={e=>setPhoneNo(e.target.value)}/>
            <p className="text-xs mt-1" style={{ color:'var(--text-muted)' }}>STK push sent to customer — they enter PIN. Money goes to business shortcode.</p>
          </div>
        )}

        {payMethod==='card' && (
          <div className="p-2 rounded-lg text-xs" style={{ background:'var(--brand-dim)',color:'var(--brand)' }}>
            Swipe/tap card on your terminal. Confirm payment received then click Complete Sale.
          </div>
        )}

        <button onClick={handleCheckout} disabled={cart.length===0||processing} className="btn-primary w-full justify-center py-2.5 text-sm">
          {processing
            ? <><RefreshCw size={14} className="animate-spin"/>Processing…</>
            : <><CheckCircle2 size={15}/>Complete Sale — {formatCurrency(total,currency)}</>}
        </button>
      </div>
    </div>
  )

  return (
    <div className="animate-fade-up flex flex-col gap-3 h-full">
      <div>
        <h1 className="text-lg sm:text-xl font-bold" style={{ color:'var(--text-primary)' }}>Point of Sale</h1>
        <p className="text-xs sm:text-sm" style={{ color:'var(--text-secondary)' }}>
          {session ? `Session open · ${products.length} product${products.length!==1?'s':''}` : 'Opening session…'}
        </p>
      </div>

      <div className="flex gap-1 p-1 rounded-xl lg:hidden" style={{ background:'var(--bg-table-head)' }}>
        {([{key:'products',label:`Products (${filtered.length})`},{key:'cart',label:`Cart (${cart.length})`}] as const).map(t=>(
          <button key={t.key} onClick={()=>setMobileTab(t.key)}
            className="flex-1 py-2 rounded-lg text-sm font-medium transition-all"
            style={{ background:mobileTab===t.key?'var(--bg-card)':'transparent',color:mobileTab===t.key?'var(--text-primary)':'var(--text-secondary)',boxShadow:mobileTab===t.key?'0 1px 3px rgba(0,0,0,0.08)':'none' }}>
            {t.label}
          </button>
        ))}
      </div>

      <div className={`flex-1 flex flex-col gap-3 lg:hidden ${mobileTab==='products'?'':'hidden'}`}>
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color:'var(--text-muted)' }}/>
          <input className="input pl-8 text-sm" placeholder="Search products…" value={search} onChange={e=>setSearch(e.target.value)}/>
        </div>
        {loading ? (
          <div className="grid grid-cols-2 gap-2">{Array(4).fill(0).map((_,i)=><div key={i} className="skeleton h-32 rounded-xl"/>)}</div>
        ) : products.length===0 ? (
          <div className="flex flex-col items-center justify-center py-12 gap-3" style={{ color:'var(--text-muted)' }}>
            <PackageX size={36} style={{ opacity:0.3 }}/><p className="text-sm">Add products in Inventory first</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-2 overflow-y-auto flex-1">
            {filtered.map(product => {
              const out = product.type==='product' && product.stock_quantity<=0
              const inCart = cart.find(i=>i.id===product.id)
              return (
                <button key={product.id} onClick={()=>!out&&addToCart(product)} disabled={out}
                  className="card p-3 text-left transition-all active:scale-95"
                  style={{ opacity:out?0.45:1,cursor:out?'not-allowed':'pointer',border:inCart?'1.5px solid var(--brand)':'1px solid var(--border)' }}>
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-2" style={{ background:'var(--brand-dim)' }}>
                    <Package size={18} style={{ color:'var(--brand)' }}/>
                  </div>
                  <p className="font-semibold text-xs truncate" style={{ color:'var(--text-primary)' }}>{product.name}</p>
                  <p className="text-xs" style={{ color:'var(--text-muted)' }}>{product.code}</p>
                  {product.type==='product' && <p className="text-xs mt-0.5" style={{ color:out?'var(--danger)':'var(--text-muted)' }}>{out?'Out of stock':`${product.stock_quantity} in stock`}</p>}
                  <div className="flex items-center justify-between mt-2">
                    <p className="font-bold text-sm" style={{ color:'var(--brand)' }}>{formatCurrency(product.selling_price,currency)}</p>
                    {inCart && <span className="badge badge-blue text-xs">{inCart.qty}</span>}
                  </div>
                </button>
              )
            })}
          </div>
        )}
      </div>

      <div className={`flex-1 flex flex-col lg:hidden ${mobileTab==='cart'?'':'hidden'}`}><CartPanel/></div>

      <div className="hidden lg:flex gap-5 flex-1 min-h-0">
        <div className="flex-1 flex flex-col gap-3 min-w-0">
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color:'var(--text-muted)' }}/>
            <input className="input pl-8" placeholder="Search by name, code or scan barcode…" value={search} onChange={e=>setSearch(e.target.value)}/>
          </div>
          {loading ? (
            <div className="grid grid-cols-2 xl:grid-cols-3 gap-3">{Array(6).fill(0).map((_,i)=><div key={i} className="skeleton h-36 rounded-xl"/>)}</div>
          ) : products.length===0 ? (
            <div className="flex-1 flex flex-col items-center justify-center gap-3" style={{ color:'var(--text-muted)' }}>
              <PackageX size={40} style={{ opacity:0.3 }}/><p className="text-sm">Add products in Inventory first</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 xl:grid-cols-3 gap-3 overflow-y-auto flex-1 pb-4">
              {filtered.map(product => {
                const out = product.type==='product' && product.stock_quantity<=0
                const inCart = cart.find(i=>i.id===product.id)
                return (
                  <button key={product.id} onClick={()=>!out&&addToCart(product)} disabled={out}
                    className="card p-4 text-left transition-all"
                    style={{ opacity:out?0.45:1,cursor:out?'not-allowed':'pointer',border:inCart?'1.5px solid var(--brand)':'1px solid var(--border)' }}>
                    <div className="flex items-start justify-between mb-3">
                      <div className="w-11 h-11 rounded-xl flex items-center justify-center" style={{ background:'var(--brand-dim)' }}>
                        <Package size={20} style={{ color:'var(--brand)' }}/>
                      </div>
                      {product.type==='product' && (
                        <span className="badge text-xs" style={{ background:out?'var(--danger-dim)':inCart?'var(--brand-dim)':'var(--success-dim)',color:out?'var(--danger)':inCart?'var(--brand)':'var(--success)' }}>
                          {out?'Out':inCart?`${inCart.qty} in cart`:`${product.stock_quantity} stock`}
                        </span>
                      )}
                    </div>
                    <p className="font-semibold text-sm truncate" style={{ color:'var(--text-primary)' }}>{product.name}</p>
                    <p className="text-xs mt-0.5" style={{ color:'var(--text-muted)' }}>{product.code}</p>
                    <div className="flex items-center justify-between mt-3">
                      <p className="font-bold text-base" style={{ color:'var(--brand)' }}>{formatCurrency(product.selling_price,currency)}</p>
                      {product.tax_rate>0 && <span className="flex items-center gap-1 text-xs" style={{ color:'var(--text-muted)' }}><Tag size={10}/>VAT {product.tax_rate}%</span>}
                    </div>
                  </button>
                )
              })}
            </div>
          )}
        </div>
        <div className="w-80 xl:w-96 flex-shrink-0 flex flex-col gap-3 overflow-y-auto pb-4"><CartPanel/></div>
      </div>
    </div>
  )
}

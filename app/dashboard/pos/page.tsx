'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'
import { useAppStore } from '@/lib/store'
import { formatCurrency } from '@/lib/utils'
import { ShoppingCart, Plus, Minus, Trash2, CreditCard, Banknote, Smartphone, Search, Package, CheckCircle2, PackageX } from 'lucide-react'
import toast from 'react-hot-toast'

type CartItem = { id: string; name: string; price: number; qty: number; code: string; tax_rate: number }

export default function POSPage() {
  const supabase = createClient()
  const { organization, profile } = useAppStore()
  const currency = organization?.base_currency || 'KES'
  const [products, setProducts] = useState<any[]>([])
  const [cart, setCart] = useState<CartItem[]>([])
  const [search, setSearch] = useState('')
  const [payMethod, setPayMethod] = useState<'cash' | 'card' | 'mobile'>('cash')
  const [cashReceived, setCashReceived] = useState('')
  const [success, setSuccess] = useState(false)
  const [loading, setLoading] = useState(true)
  const [processing, setProcessing] = useState(false)
  const [session, setSession] = useState<any>(null)

  useEffect(() => {
    if (!organization) return
    loadProducts()
    openSession()
  }, [organization])

  const loadProducts = async () => {
    setLoading(true)
    const { data } = await supabase
      .from('products')
      .select('*')
      .eq('organization_id', organization!.id)
      .eq('is_active', true)
      .order('name')
    setProducts(data || [])
    setLoading(false)
  }

  const openSession = async () => {
    // Check for open session today
    const today = new Date().toISOString().split('T')[0]
    const { data: existing } = await supabase
      .from('pos_sessions')
      .select('*')
      .eq('organization_id', organization!.id)
      .eq('status', 'open')
      .gte('opened_at', today)
      .limit(1)
      .single()

    if (existing) {
      setSession(existing)
    } else {
      const { data: newSession } = await supabase
        .from('pos_sessions')
        .insert({
          organization_id: organization!.id,
          cashier_id: profile?.id,
          opening_cash: 0,
          status: 'open'
        })
        .select()
        .single()
      setSession(newSession)
    }
  }

  const filtered = products.filter(p =>
    !search ||
    p.name?.toLowerCase().includes(search.toLowerCase()) ||
    p.code?.toLowerCase().includes(search.toLowerCase()) ||
    p.barcode?.includes(search)
  )

  const addToCart = (product: any) => {
    if (product.stock_quantity <= 0 && product.type === 'product') {
      toast.error(`${product.name} is out of stock`)
      return
    }
    setCart(prev => {
      const existing = prev.find(i => i.id === product.id)
      if (existing) return prev.map(i => i.id === product.id ? { ...i, qty: i.qty + 1 } : i)
      return [...prev, {
        id: product.id,
        name: product.name,
        price: product.selling_price,
        qty: 1,
        code: product.code,
        tax_rate: product.tax_rate || 0
      }]
    })
  }

  const updateQty = (id: string, delta: number) => {
    setCart(prev => prev.map(i => i.id === id ? { ...i, qty: Math.max(0, i.qty + delta) } : i).filter(i => i.qty > 0))
  }

  const removeItem = (id: string) => setCart(prev => prev.filter(i => i.id !== id))

  const subtotal = cart.reduce((s, i) => s + i.price * i.qty, 0)
  const taxAmount = cart.reduce((s, i) => s + (i.price * i.qty * (i.tax_rate / 100)), 0)
  const total = subtotal + taxAmount
  const change = payMethod === 'cash' ? (Number(cashReceived) || 0) - total : 0

  const handleCheckout = async () => {
    if (cart.length === 0) { toast.error('Cart is empty'); return }
    if (payMethod === 'cash' && Number(cashReceived) < total) { toast.error('Insufficient cash received'); return }
    if (!session) { toast.error('No active POS session'); return }

    setProcessing(true)

    // Generate order number
    const orderNum = `POS-${Date.now().toString().slice(-6)}`

    // Create POS order
    const { data: order, error } = await supabase
      .from('pos_orders')
      .insert({
        organization_id: organization!.id,
        session_id: session.id,
        order_number: orderNum,
        status: 'paid',
        subtotal,
        tax_amount: taxAmount,
        total,
        payment_method: payMethod,
        created_by: profile?.id
      })
      .select()
      .single()

    if (error) { toast.error('Failed to process sale'); setProcessing(false); return }

    // Insert order items
    await supabase.from('pos_order_items').insert(
      cart.map((item, i) => ({
        order_id: order.id,
        product_id: item.id,
        quantity: item.qty,
        unit_price: item.price,
        tax_amount: item.price * item.qty * (item.tax_rate / 100),
        total: item.price * item.qty * (1 + item.tax_rate / 100),
        line_number: i + 1
      }))
    )

    // Deduct stock for products
    for (const item of cart) {
      const product = products.find(p => p.id === item.id)
      if (product && product.type === 'product') {
        await supabase
          .from('products')
          .update({ stock_quantity: Math.max(0, product.stock_quantity - item.qty) })
          .eq('id', item.id)

        await supabase.from('stock_movements').insert({
          organization_id: organization!.id,
          product_id: item.id,
          type: 'out',
          quantity: item.qty,
          unit_cost: product.cost_price,
          reference: orderNum
        })
      }
    }

    // Update session totals
    await supabase
      .from('pos_sessions')
      .update({ total_sales: (session.total_sales || 0) + total })
      .eq('id', session.id)

    toast.success(`Sale ${orderNum} completed!`)
    setProcessing(false)
    setSuccess(true)
    loadProducts() // refresh stock

    setTimeout(() => {
      setSuccess(false)
      setCart([])
      setCashReceived('')
    }, 3000)
  }

  return (
    <div className="h-full flex gap-5 animate-fade-up">
      {/* Products Panel */}
      <div className="flex-1 flex flex-col space-y-4 min-w-0">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Point of Sale</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            {session ? `Session open · ${products.length} products` : 'Opening session...'}
          </p>
        </div>

        <div className="relative">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            className="input pl-9"
            placeholder="Search by name, code or scan barcode..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>

        {loading ? (
          <div className="grid grid-cols-2 xl:grid-cols-3 gap-3">
            {Array(6).fill(0).map((_, i) => <div key={i} className="skeleton h-32 rounded-xl" />)}
          </div>
        ) : products.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center text-slate-400 gap-3">
            <PackageX size={40} className="opacity-30" />
            <div className="text-center">
              <p className="font-medium text-slate-600">No products found</p>
              <p className="text-sm mt-1">Add products in the Inventory page first</p>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-2 xl:grid-cols-3 gap-3 overflow-y-auto flex-1 pb-4">
            {filtered.map(product => {
              const outOfStock = product.type === 'product' && product.stock_quantity <= 0
              return (
                <button
                  key={product.id}
                  onClick={() => addToCart(product)}
                  disabled={outOfStock}
                  className={`card p-4 text-left transition-all group ${outOfStock ? 'opacity-50 cursor-not-allowed' : 'hover:ring-2 hover:ring-brand-500 cursor-pointer'}`}
                >
                  <div className="w-10 h-10 rounded-xl bg-brand-50 flex items-center justify-center mb-3 group-hover:bg-brand-100 transition-colors">
                    <Package size={18} className="text-brand-600" />
                  </div>
                  <p className="font-medium text-slate-800 text-sm leading-tight truncate">{product.name}</p>
                  <p className="text-xs text-slate-400 mt-0.5">{product.code}</p>
                  {product.type === 'product' && (
                    <p className={`text-xs mt-0.5 ${product.stock_quantity <= product.reorder_level ? 'text-amber-500' : 'text-slate-400'}`}>
                      {outOfStock ? 'Out of stock' : `Stock: ${product.stock_quantity}`}
                    </p>
                  )}
                  <p className="font-bold text-brand-600 mt-2">{formatCurrency(product.selling_price, currency)}</p>
                </button>
              )
            })}
          </div>
        )}
      </div>

      {/* Cart Panel */}
      <div className="w-80 xl:w-96 flex flex-col gap-4 flex-shrink-0">
        <div className="card flex-1 flex flex-col p-4">
          <div className="flex items-center gap-2 mb-4">
            <ShoppingCart size={18} className="text-slate-600" />
            <h2 className="font-semibold text-slate-900">Cart</h2>
            {cart.length > 0 && (
              <span className="ml-auto badge bg-brand-100 text-brand-700">{cart.length} items</span>
            )}
          </div>

          {success ? (
            <div className="flex-1 flex flex-col items-center justify-center text-center gap-4">
              <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center">
                <CheckCircle2 size={32} className="text-success-600" />
              </div>
              <div>
                <p className="font-semibold text-slate-900 text-lg">Sale Complete!</p>
                <p className="text-sm text-slate-500 mt-1">Saved to database</p>
                {payMethod === 'cash' && change > 0 && (
                  <p className="text-sm font-semibold text-success-600 mt-2">
                    Change: {formatCurrency(change, currency)}
                  </p>
                )}
              </div>
            </div>
          ) : cart.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center text-center gap-3 text-slate-400">
              <ShoppingCart size={36} className="opacity-30" />
              <p className="text-sm">Cart is empty</p>
              <p className="text-xs">Click products to add them</p>
            </div>
          ) : (
            <div className="flex-1 overflow-y-auto space-y-2">
              {cart.map(item => (
                <div key={item.id} className="flex items-center gap-3 py-2 border-b border-slate-100 last:border-0">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-800 truncate">{item.name}</p>
                    <p className="text-xs text-slate-400">{formatCurrency(item.price, currency)}</p>
                  </div>
                  <div className="flex items-center gap-1">
                    <button onClick={() => updateQty(item.id, -1)} className="w-6 h-6 rounded-lg bg-slate-100 flex items-center justify-center text-slate-600 hover:bg-slate-200">
                      <Minus size={11} />
                    </button>
                    <span className="w-6 text-center text-sm font-semibold">{item.qty}</span>
                    <button onClick={() => updateQty(item.id, 1)} className="w-6 h-6 rounded-lg bg-brand-100 flex items-center justify-center text-brand-700 hover:bg-brand-200">
                      <Plus size={11} />
                    </button>
                  </div>
                  <div className="w-20 text-right">
                    <p className="text-sm font-semibold text-slate-900">{formatCurrency(item.price * item.qty, currency)}</p>
                  </div>
                  <button onClick={() => removeItem(item.id)} className="text-slate-300 hover:text-danger-500 transition-colors">
                    <Trash2 size={13} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Summary & Payment */}
        <div className="card p-4 space-y-4">
          <div className="space-y-2 text-sm">
            <div className="flex justify-between text-slate-600">
              <span>Subtotal</span>
              <span>{formatCurrency(subtotal, currency)}</span>
            </div>
            <div className="flex justify-between text-slate-600">
              <span>Tax</span>
              <span>{formatCurrency(taxAmount, currency)}</span>
            </div>
            <div className="flex justify-between font-bold text-base pt-2 border-t border-slate-200">
              <span>Total</span>
              <span className="text-brand-700">{formatCurrency(total, currency)}</span>
            </div>
          </div>

          <div>
            <p className="text-xs font-medium text-slate-500 mb-2">Payment Method</p>
            <div className="grid grid-cols-3 gap-2">
              {([
                { key: 'cash', icon: Banknote, label: 'Cash' },
                { key: 'card', icon: CreditCard, label: 'Card' },
                { key: 'mobile', icon: Smartphone, label: 'M-Pesa' },
              ] as const).map(m => (
                <button
                  key={m.key}
                  onClick={() => setPayMethod(m.key)}
                  className={`flex flex-col items-center gap-1 p-2.5 rounded-xl border transition-all ${payMethod === m.key ? 'border-brand-500 bg-brand-50 text-brand-700' : 'border-slate-200 text-slate-500 hover:border-slate-300'}`}
                >
                  <m.icon size={16} />
                  <span className="text-xs font-medium">{m.label}</span>
                </button>
              ))}
            </div>
          </div>

          {payMethod === 'cash' && (
            <div>
              <label className="input-label">Cash Received</label>
              <input
                type="number"
                className="input"
                placeholder="0.00"
                value={cashReceived}
                onChange={e => setCashReceived(e.target.value)}
              />
              {change > 0 && (
                <p className="text-xs text-success-600 mt-1 font-medium">
                  Change: {formatCurrency(change, currency)}
                </p>
              )}
            </div>
          )}

          <button
            onClick={handleCheckout}
            disabled={cart.length === 0 || processing}
            className="btn-primary w-full justify-center py-3 text-base"
          >
            {processing ? (
              <span className="flex items-center gap-2">
                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Processing...
              </span>
            ) : (
              <><CheckCircle2 size={18} />Complete Sale</>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}

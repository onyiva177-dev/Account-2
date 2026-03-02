'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase'
import { useAppStore } from '@/lib/store'
import { formatCurrency } from '@/lib/utils'
import { ShoppingCart, Plus, Minus, Trash2, CreditCard, Banknote, Smartphone, Search, Package, CheckCircle2 } from 'lucide-react'
import toast from 'react-hot-toast'

type CartItem = { id: string; name: string; price: number; qty: number; code: string }

const SAMPLE_PRODUCTS = [
  { id: '1', code: 'P001', name: 'Office Chair', price: 12500, category: 'Furniture' },
  { id: '2', code: 'P002', name: 'A4 Paper Ream', price: 680, category: 'Stationery' },
  { id: '3', code: 'P003', name: 'Ballpoint Pens (Box)', price: 350, category: 'Stationery' },
  { id: '4', code: 'P004', name: 'Desktop Computer', price: 85000, category: 'Electronics' },
  { id: '5', code: 'P005', name: 'Printer Cartridge', price: 2400, category: 'Electronics' },
  { id: '6', code: 'P006', name: 'Whiteboard Marker Set', price: 280, category: 'Stationery' },
  { id: '7', code: 'P007', name: 'Stapler', price: 450, category: 'Stationery' },
  { id: '8', code: 'P008', name: 'Filing Cabinet', price: 18500, category: 'Furniture' },
]

export default function POSPage() {
  const { organization } = useAppStore()
  const currency = organization?.base_currency || 'KES'
  const [cart, setCart] = useState<CartItem[]>([])
  const [search, setSearch] = useState('')
  const [payMethod, setPayMethod] = useState<'cash' | 'card' | 'mobile'>('cash')
  const [cashReceived, setCashReceived] = useState('')
  const [success, setSuccess] = useState(false)

  const filtered = SAMPLE_PRODUCTS.filter(p =>
    !search || p.name.toLowerCase().includes(search.toLowerCase()) || p.code.includes(search)
  )

  const addToCart = (product: typeof SAMPLE_PRODUCTS[0]) => {
    setCart(prev => {
      const existing = prev.find(i => i.id === product.id)
      if (existing) return prev.map(i => i.id === product.id ? { ...i, qty: i.qty + 1 } : i)
      return [...prev, { id: product.id, name: product.name, price: product.price, qty: 1, code: product.code }]
    })
  }

  const updateQty = (id: string, delta: number) => {
    setCart(prev => prev.map(i => i.id === id ? { ...i, qty: Math.max(0, i.qty + delta) } : i).filter(i => i.qty > 0))
  }

  const removeItem = (id: string) => setCart(prev => prev.filter(i => i.id !== id))

  const subtotal = cart.reduce((s, i) => s + i.price * i.qty, 0)
  const tax = subtotal * 0.16
  const total = subtotal + tax
  const change = payMethod === 'cash' ? (Number(cashReceived) || 0) - total : 0

  const handleCheckout = () => {
    if (cart.length === 0) return toast.error('Cart is empty')
    if (payMethod === 'cash' && Number(cashReceived) < total) return toast.error('Insufficient cash received')
    setSuccess(true)
    setTimeout(() => {
      setSuccess(false)
      setCart([])
      setCashReceived('')
    }, 3000)
    toast.success('Sale completed!')
  }

  return (
    <div className="h-full flex gap-5 animate-fade-up">
      {/* Products Panel */}
      <div className="flex-1 flex flex-col space-y-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Point of Sale</h1>
          <p className="text-sm text-slate-500 mt-0.5">Click items to add to cart</p>
        </div>
        
        <div className="relative">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input className="input pl-9" placeholder="Search products or scan barcode..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>

        <div className="grid grid-cols-2 xl:grid-cols-3 gap-3 overflow-y-auto flex-1 pb-4">
          {filtered.map(product => (
            <button
              key={product.id}
              onClick={() => addToCart(product)}
              className="card p-4 text-left hover:ring-2 hover:ring-brand-500 transition-all cursor-pointer group"
            >
              <div className="w-10 h-10 rounded-xl bg-brand-50 flex items-center justify-center mb-3 group-hover:bg-brand-100 transition-colors">
                <Package size={18} className="text-brand-600" />
              </div>
              <p className="font-medium text-slate-800 text-sm leading-tight">{product.name}</p>
              <p className="text-xs text-slate-400 mt-0.5">{product.code} · {product.category}</p>
              <p className="font-bold text-brand-600 mt-2">{formatCurrency(product.price, currency)}</p>
            </button>
          ))}
        </div>
      </div>

      {/* Cart Panel */}
      <div className="w-80 xl:w-96 flex flex-col gap-4">
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
                <p className="text-sm text-slate-500 mt-1">Receipt generated</p>
                {payMethod === 'cash' && change > 0 && (
                  <p className="text-sm font-semibold text-success-600 mt-2">Change: {formatCurrency(change, currency)}</p>
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
              <span>VAT (16%)</span>
              <span>{formatCurrency(tax, currency)}</span>
            </div>
            <div className="flex justify-between font-bold text-base pt-2 border-t border-slate-200">
              <span>Total</span>
              <span className="text-brand-700">{formatCurrency(total, currency)}</span>
            </div>
          </div>

          {/* Payment method */}
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
              <input type="number" className="input" placeholder="0.00" value={cashReceived} onChange={e => setCashReceived(e.target.value)} />
              {change > 0 && <p className="text-xs text-success-600 mt-1 font-medium">Change: {formatCurrency(change, currency)}</p>}
            </div>
          )}

          <button
            onClick={handleCheckout}
            className="btn-primary w-full justify-center py-3 text-base"
            disabled={cart.length === 0}
          >
            <CheckCircle2 size={18} />
            Complete Sale
          </button>
        </div>
      </div>
    </div>
  )
}

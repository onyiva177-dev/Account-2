'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'
import { useAppStore } from '@/lib/store'
import { formatCurrency } from '@/lib/utils'
import { Plus, Search, Package, AlertTriangle, TrendingUp } from 'lucide-react'
import type { Product } from '@/types'

export default function InventoryPage() {
  const supabase = createClient()
  const { organization } = useAppStore()
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const currency = organization?.base_currency || 'KES'

  useEffect(() => {
    if (!organization) return
    supabase.from('products').select('*').eq('organization_id', organization.id).order('name').then(({ data }) => {
      setProducts(data || [])
      setLoading(false)
    })
  }, [organization])

  const filtered = products.filter(p => !search || p.name?.toLowerCase().includes(search.toLowerCase()) || p.code?.includes(search))
  const lowStock = products.filter(p => p.stock_quantity <= p.reorder_level && p.reorder_level > 0)
  const totalValue = products.reduce((s, p) => s + p.stock_quantity * p.cost_price, 0)

  return (
    <div className="space-y-5 animate-fade-up">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Inventory</h1>
          <p className="text-sm text-slate-500 mt-0.5">Products, stock levels and movements</p>
        </div>
        <button className="btn-primary"><Plus size={16} />Add Product</button>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div className="card p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-brand-50 flex items-center justify-center">
            <Package size={18} className="text-brand-600" />
          </div>
          <div>
            <p className="text-xs text-slate-500">Total Products</p>
            <p className="text-xl font-bold text-slate-900">{products.length}</p>
          </div>
        </div>
        <div className="card p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-50 flex items-center justify-center">
            <AlertTriangle size={18} className="text-amber-600" />
          </div>
          <div>
            <p className="text-xs text-slate-500">Low Stock Items</p>
            <p className="text-xl font-bold text-slate-900">{lowStock.length}</p>
          </div>
        </div>
        <div className="card p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-green-50 flex items-center justify-center">
            <TrendingUp size={18} className="text-green-600" />
          </div>
          <div>
            <p className="text-xs text-slate-500">Total Stock Value</p>
            <p className="text-xl font-bold text-slate-900">{formatCurrency(totalValue, currency)}</p>
          </div>
        </div>
      </div>

      <div className="relative max-w-sm">
        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <input className="input pl-9" placeholder="Search products..." value={search} onChange={e => setSearch(e.target.value)} />
      </div>

      <div className="card overflow-hidden">
        <table className="table">
          <thead>
            <tr>
              <th>Code</th><th>Product</th><th>Type</th><th className="text-right">Cost</th>
              <th className="text-right">Price</th><th className="text-right">Stock</th>
              <th className="text-right">Reorder</th><th>Status</th>
            </tr>
          </thead>
          <tbody>
            {loading ? Array(5).fill(0).map((_, i) => (
              <tr key={i}>{Array(8).fill(0).map((_, j) => <td key={j}><div className="skeleton h-4 rounded" /></td>)}</tr>
            )) : filtered.length === 0 ? (
              <tr>
                <td colSpan={8} className="text-center py-12 text-slate-400">
                  <Package size={32} className="mx-auto mb-2 opacity-40" />
                  <p>No products yet</p>
                </td>
              </tr>
            ) : filtered.map(p => {
              const isLow = p.stock_quantity <= p.reorder_level && p.reorder_level > 0
              return (
                <tr key={p.id}>
                  <td className="font-mono text-xs text-brand-600 font-semibold">{p.code}</td>
                  <td className="font-medium text-slate-800">{p.name}</td>
                  <td><span className="badge bg-slate-100 text-slate-600 capitalize">{p.type}</span></td>
                  <td className="text-right font-mono text-sm">{formatCurrency(p.cost_price, currency)}</td>
                  <td className="text-right font-mono text-sm font-semibold">{formatCurrency(p.selling_price, currency)}</td>
                  <td className={`text-right font-semibold text-sm ${isLow ? 'text-danger-500' : 'text-slate-900'}`}>{p.stock_quantity}</td>
                  <td className="text-right text-sm text-slate-400">{p.reorder_level}</td>
                  <td>
                    {isLow
                      ? <span className="badge bg-red-100 text-red-700 flex items-center gap-1 w-fit"><AlertTriangle size={10} />Low Stock</span>
                      : <span className="dot-green" />
                    }
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

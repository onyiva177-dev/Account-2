'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'
import { useAppStore } from '@/lib/store'
import { formatCurrency } from '@/lib/utils'
import { Plus, Search, Package, AlertTriangle, TrendingUp, Edit2, X, CheckCircle2, RefreshCw, ArrowUpDown } from 'lucide-react'
import toast from 'react-hot-toast'

const BLANK_PRODUCT = { code: '', name: '', description: '', type: 'product', cost_price: '', selling_price: '', stock_quantity: '', reorder_level: '', unit: 'pcs', barcode: '', tax_rate: '0' }
const BLANK_ADJ = { product_id: '', type: 'in', quantity: '', notes: '' }

export default function InventoryPage() {
  const supabase = createClient()
  const { organization } = useAppStore()
  const [products, setProducts] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [showProduct, setShowProduct] = useState(false)
  const [showAdj, setShowAdj] = useState(false)
  const [editing, setEditing] = useState<any>(null)
  const [form, setForm] = useState<typeof BLANK_PRODUCT>(BLANK_PRODUCT)
  const [adjForm, setAdjForm] = useState<typeof BLANK_ADJ>(BLANK_ADJ)
  const [saving, setSaving] = useState(false)
  const currency = organization?.base_currency || 'KES'

  useEffect(() => {
    if (!organization) return
    load()
  }, [organization])

  const load = async () => {
    setLoading(true)
    const { data } = await supabase.from('products').select('*')
      .eq('organization_id', organization!.id).order('name')
    setProducts(data || [])
    setLoading(false)
  }

  const openCreate = () => {
    setEditing(null)
    setForm({ ...BLANK_PRODUCT, code: `P-${Date.now().toString().slice(-5)}` })
    setShowProduct(true)
  }

  const openEdit = (p: any) => {
    setEditing(p)
    setForm({
      code: p.code, name: p.name, description: p.description || '', type: p.type,
      cost_price: String(p.cost_price), selling_price: String(p.selling_price),
      stock_quantity: String(p.stock_quantity), reorder_level: String(p.reorder_level),
      unit: p.unit || 'pcs', barcode: p.barcode || '', tax_rate: String(p.tax_rate || 0),
    })
    setShowProduct(true)
  }

  const saveProduct = async () => {
    if (!form.name.trim() || !form.code.trim()) { toast.error('Name and code are required'); return }
    if (Number(form.selling_price) <= 0) { toast.error('Selling price must be > 0'); return }
    setSaving(true)
    const payload = {
      code: form.code.trim(), name: form.name.trim(), description: form.description,
      type: form.type,
      cost_price:     Number(form.cost_price)     || 0,
      selling_price:  Number(form.selling_price)  || 0,
      stock_quantity: Number(form.stock_quantity) || 0,
      reorder_level:  Number(form.reorder_level)  || 0,
      unit: form.unit, barcode: form.barcode || null,
      tax_rate: Number(form.tax_rate) || 0, is_active: true,
    }
    if (editing) {
      const { error } = await supabase.from('products').update(payload).eq('id', editing.id)
      if (error) { toast.error('Update failed: ' + error.message); setSaving(false); return }
      toast.success('Product updated')
    } else {
      const { error } = await supabase.from('products').insert({ ...payload, organization_id: organization!.id })
      if (error) { toast.error('Create failed: ' + error.message); setSaving(false); return }
      toast.success(`${form.name} added to inventory`)
    }
    setShowProduct(false); setSaving(false); load()
  }

  const saveAdjustment = async () => {
    if (!adjForm.product_id || !adjForm.quantity) { toast.error('Select product and quantity'); return }
    setSaving(true)
    const product = products.find(p => p.id === adjForm.product_id)
    if (!product) { setSaving(false); return }
    const qty = Number(adjForm.quantity)
    const newQty = adjForm.type === 'in'
      ? product.stock_quantity + qty
      : adjForm.type === 'out'
        ? Math.max(0, product.stock_quantity - qty)
        : qty // adjustment = set absolute value

    await supabase.from('products').update({ stock_quantity: newQty }).eq('id', product.id)
    await supabase.from('stock_movements').insert({
      organization_id: organization!.id, product_id: product.id,
      type: adjForm.type, quantity: qty, unit_cost: product.cost_price,
      notes: adjForm.notes, reference: `ADJ-${Date.now().toString().slice(-5)}`
    })

    toast.success(`Stock updated for ${product.name}`)
    setShowAdj(false); setAdjForm(BLANK_ADJ); setSaving(false); load()
  }

  const filtered   = products.filter(p => !search || p.name?.toLowerCase().includes(search.toLowerCase()) || p.code?.includes(search))
  const lowStock   = products.filter(p => p.stock_quantity <= p.reorder_level && p.reorder_level > 0 && p.type === 'product')
  const totalValue = products.reduce((s, p) => s + p.stock_quantity * p.cost_price, 0)
  const upd = (k: string, v: string) => setForm(p => ({ ...p, [k]: v }))

  return (
    <div className="space-y-5 animate-fade-up">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Inventory</h1>
          <p className="text-sm text-slate-500 mt-0.5">Products, stock levels and movements</p>
        </div>
        <div className="flex gap-2">
          <button className="btn-secondary" onClick={() => setShowAdj(true)}><ArrowUpDown size={15} />Adjust Stock</button>
          <button className="btn-primary" onClick={openCreate}><Plus size={16} />Add Product</button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <div className="card p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-brand-50 flex items-center justify-center"><Package size={18} className="text-brand-600" /></div>
          <div><p className="text-xs text-slate-500">Total Products</p><p className="text-xl font-bold text-slate-900">{products.length}</p></div>
        </div>
        <div className="card p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-50 flex items-center justify-center"><AlertTriangle size={18} className="text-amber-600" /></div>
          <div>
            <p className="text-xs text-slate-500">Low Stock Alerts</p>
            <p className={`text-xl font-bold ${lowStock.length > 0 ? 'text-amber-600' : 'text-slate-900'}`}>{lowStock.length}</p>
          </div>
        </div>
        <div className="card p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-green-50 flex items-center justify-center"><TrendingUp size={18} className="text-green-600" /></div>
          <div><p className="text-xs text-slate-500">Total Stock Value</p><p className="text-xl font-bold text-slate-900">{formatCurrency(totalValue, currency)}</p></div>
        </div>
      </div>

      {/* Low stock banner */}
      {lowStock.length > 0 && (
        <div className="flex items-start gap-3 p-4 bg-amber-50 border border-amber-200 rounded-xl">
          <AlertTriangle size={16} className="text-amber-600 mt-0.5 flex-shrink-0" />
          <div>
            <p className="text-sm font-semibold text-amber-800">Low stock: {lowStock.map(p => p.name).join(', ')}</p>
            <p className="text-xs text-amber-700 mt-0.5">Click "Adjust Stock" to restock these items.</p>
          </div>
        </div>
      )}

      <div className="relative max-w-sm">
        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <input className="input pl-9" placeholder="Search products..." value={search} onChange={e => setSearch(e.target.value)} />
      </div>

      {/* Table */}
      <div className="card overflow-hidden">
        <table className="table">
          <thead>
            <tr><th>Code</th><th>Product</th><th>Type</th><th className="text-right">Cost</th><th className="text-right">Price</th><th className="text-right">Stock</th><th className="text-right">Reorder</th><th>Status</th><th></th></tr>
          </thead>
          <tbody>
            {loading ? Array(5).fill(0).map((_, i) => (
              <tr key={i}>{Array(9).fill(0).map((_, j) => <td key={j}><div className="skeleton h-4 rounded" /></td>)}</tr>
            )) : filtered.length === 0 ? (
              <tr>
                <td colSpan={9} className="text-center py-12 text-slate-400">
                  <Package size={32} className="mx-auto mb-2 opacity-40" />
                  <p>No products yet. Click "Add Product" to create one.</p>
                </td>
              </tr>
            ) : filtered.map(p => {
              const isLow = p.stock_quantity <= p.reorder_level && p.reorder_level > 0 && p.type === 'product'
              return (
                <tr key={p.id}>
                  <td className="font-mono text-xs text-brand-600 font-semibold">{p.code}</td>
                  <td>
                    <p className="font-medium text-slate-800">{p.name}</p>
                    {p.description && <p className="text-xs text-slate-400 truncate max-w-xs">{p.description}</p>}
                  </td>
                  <td><span className="badge bg-slate-100 text-slate-600 capitalize">{p.type}</span></td>
                  <td className="text-right font-mono text-sm">{formatCurrency(p.cost_price, currency)}</td>
                  <td className="text-right font-mono text-sm font-semibold">{formatCurrency(p.selling_price, currency)}</td>
                  <td className={`text-right font-semibold text-sm ${isLow ? 'text-danger-500' : 'text-slate-900'}`}>{p.stock_quantity} {p.unit}</td>
                  <td className="text-right text-sm text-slate-400">{p.reorder_level}</td>
                  <td>
                    {isLow
                      ? <span className="badge bg-red-100 text-red-700 flex items-center gap-1 w-fit"><AlertTriangle size={10} />Low</span>
                      : p.is_active ? <span className="dot-green" /> : <span className="dot-red" />
                    }
                  </td>
                  <td>
                    <button className="btn-ghost p-1.5" onClick={() => openEdit(p)} title="Edit"><Edit2 size={14} /></button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Add / Edit Product Modal */}
      {showProduct && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[92vh] flex flex-col animate-fade-up">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <h2 className="text-lg font-semibold text-slate-900">{editing ? 'Edit Product' : 'New Product'}</h2>
              <button onClick={() => setShowProduct(false)} className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center text-slate-500 hover:bg-slate-200"><X size={16} /></button>
            </div>
            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="input-label">Product Code *</label>
                  <input className="input font-mono" placeholder="P-001" value={form.code} onChange={e => upd('code', e.target.value)} />
                </div>
                <div>
                  <label className="input-label">Type</label>
                  <select className="input" value={form.type} onChange={e => upd('type', e.target.value)}>
                    <option value="product">Physical Product</option>
                    <option value="service">Service</option>
                  </select>
                </div>
                <div className="col-span-2">
                  <label className="input-label">Product Name *</label>
                  <input className="input" placeholder="e.g. Office Chair" value={form.name} onChange={e => upd('name', e.target.value)} />
                </div>
                <div className="col-span-2">
                  <label className="input-label">Description</label>
                  <input className="input" placeholder="Optional description" value={form.description} onChange={e => upd('description', e.target.value)} />
                </div>
                <div>
                  <label className="input-label">Cost Price ({currency})</label>
                  <input type="number" min="0" className="input" placeholder="0.00" value={form.cost_price} onChange={e => upd('cost_price', e.target.value)} />
                </div>
                <div>
                  <label className="input-label">Selling Price ({currency}) *</label>
                  <input type="number" min="0" className="input" placeholder="0.00" value={form.selling_price} onChange={e => upd('selling_price', e.target.value)} />
                </div>
                {form.type === 'product' && <>
                  <div>
                    <label className="input-label">Opening Stock Qty</label>
                    <input type="number" min="0" className="input" placeholder="0" value={form.stock_quantity} onChange={e => upd('stock_quantity', e.target.value)} />
                  </div>
                  <div>
                    <label className="input-label">Reorder Level</label>
                    <input type="number" min="0" className="input" placeholder="0" value={form.reorder_level} onChange={e => upd('reorder_level', e.target.value)} />
                  </div>
                </>}
                <div>
                  <label className="input-label">Unit</label>
                  <select className="input" value={form.unit} onChange={e => upd('unit', e.target.value)}>
                    {['pcs','kg','litres','metres','boxes','bags','hours','days'].map(u => <option key={u} value={u}>{u}</option>)}
                  </select>
                </div>
                <div>
                  <label className="input-label">VAT Rate (%)</label>
                  <select className="input" value={form.tax_rate} onChange={e => upd('tax_rate', e.target.value)}>
                    <option value="0">0% (Exempt)</option>
                    <option value="16">16% (Standard VAT)</option>
                    <option value="8">8% (Reduced)</option>
                  </select>
                </div>
                <div>
                  <label className="input-label">Barcode (optional)</label>
                  <input className="input font-mono" placeholder="123456789012" value={form.barcode} onChange={e => upd('barcode', e.target.value)} />
                </div>
              </div>
              {/* Margin preview */}
              {form.cost_price && form.selling_price && Number(form.selling_price) > 0 && (
                <div className="bg-slate-50 rounded-xl p-3 text-sm">
                  <p className="text-xs font-semibold text-slate-600 mb-2">Margin Preview</p>
                  <div className="flex gap-6">
                    <div><p className="text-xs text-slate-500">Gross Margin</p>
                      <p className="font-bold text-green-600">{(((Number(form.selling_price) - Number(form.cost_price)) / Number(form.selling_price)) * 100).toFixed(1)}%</p></div>
                    <div><p className="text-xs text-slate-500">Markup</p>
                      <p className="font-bold text-brand-600">
                        {Number(form.cost_price) > 0 ? (((Number(form.selling_price) - Number(form.cost_price)) / Number(form.cost_price)) * 100).toFixed(1) : 'N/A'}%
                      </p></div>
                    <div><p className="text-xs text-slate-500">Profit per unit</p>
                      <p className="font-bold text-slate-900">{formatCurrency(Number(form.selling_price) - Number(form.cost_price), currency)}</p></div>
                  </div>
                </div>
              )}
            </div>
            <div className="flex justify-end gap-3 px-6 py-4 border-t border-slate-100">
              <button onClick={() => setShowProduct(false)} className="btn-secondary">Cancel</button>
              <button onClick={saveProduct} disabled={saving} className="btn-primary">
                {saving ? <RefreshCw size={14} className="animate-spin" /> : <CheckCircle2 size={15} />}
                {saving ? 'Saving...' : editing ? 'Save Changes' : 'Add Product'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Stock Adjustment Modal */}
      {showAdj && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md animate-fade-up">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <h2 className="text-lg font-semibold text-slate-900">Stock Adjustment</h2>
              <button onClick={() => setShowAdj(false)} className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center text-slate-500 hover:bg-slate-200"><X size={16} /></button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="input-label">Product *</label>
                <select className="input" value={adjForm.product_id} onChange={e => setAdjForm(p => ({ ...p, product_id: e.target.value }))}>
                  <option value="">Select product...</option>
                  {products.filter(p => p.type === 'product').map(p => (
                    <option key={p.id} value={p.id}>{p.name} (current: {p.stock_quantity} {p.unit})</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="input-label">Adjustment Type</label>
                <select className="input" value={adjForm.type} onChange={e => setAdjForm(p => ({ ...p, type: e.target.value }))}>
                  <option value="in">Stock In (add)</option>
                  <option value="out">Stock Out (remove)</option>
                  <option value="adjustment">Set Absolute Value</option>
                </select>
              </div>
              <div>
                <label className="input-label">Quantity *</label>
                <input type="number" min="0" className="input" placeholder="0"
                  value={adjForm.quantity} onChange={e => setAdjForm(p => ({ ...p, quantity: e.target.value }))} />
              </div>
              <div>
                <label className="input-label">Notes</label>
                <input className="input" placeholder="e.g. Annual stock count" value={adjForm.notes} onChange={e => setAdjForm(p => ({ ...p, notes: e.target.value }))} />
              </div>
            </div>
            <div className="flex justify-end gap-3 px-6 pb-6">
              <button onClick={() => setShowAdj(false)} className="btn-secondary">Cancel</button>
              <button onClick={saveAdjustment} disabled={saving} className="btn-primary">
                {saving ? <RefreshCw size={14} className="animate-spin" /> : <CheckCircle2 size={15} />}
                {saving ? 'Saving...' : 'Apply Adjustment'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

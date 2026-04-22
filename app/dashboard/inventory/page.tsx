'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'
import { useAppStore } from '@/lib/store'
import { formatCurrency } from '@/lib/utils'
import { Plus, Search, Package, AlertTriangle, TrendingUp, Edit2, X, CheckCircle2, ArrowUpDown } from 'lucide-react'
import toast from 'react-hot-toast'

const BLANK = { code:'', name:'', description:'', type:'product', cost_price:'', selling_price:'', stock_quantity:'', reorder_level:'', unit:'pcs', tax_rate:'0' }
const BLANK_ADJ = { product_id:'', type:'in', quantity:'', notes:'' }

export default function InventoryPage() {
  const supabase = createClient()
  const { organization } = useAppStore()
  const [products, setProducts] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [showProduct, setShowProduct] = useState(false)
  const [showAdj, setShowAdj] = useState(false)
  const [editing, setEditing] = useState<any>(null)
  const [form, setForm] = useState<typeof BLANK>(BLANK)
  const [adjForm, setAdjForm] = useState<typeof BLANK_ADJ>(BLANK_ADJ)
  const [saving, setSaving] = useState(false)
  const currency = organization?.base_currency || 'KES'

  useEffect(() => { if (organization) load() }, [organization])

  const load = async () => {
    setLoading(true)
    const { data } = await supabase.from('products').select('*')
      .eq('organization_id', organization!.id).order('name')
    setProducts(data || [])
    setLoading(false)
  }

  const openCreate = () => {
    setEditing(null)
    setForm({ ...BLANK, code:`P-${Date.now().toString().slice(-5)}` })
    setShowProduct(true)
  }
  const openEdit = (p:any) => {
    setEditing(p)
    setForm({ code:p.code, name:p.name, description:p.description||'', type:p.type,
      cost_price:String(p.cost_price), selling_price:String(p.selling_price),
      stock_quantity:String(p.stock_quantity), reorder_level:String(p.reorder_level),
      unit:p.unit||'pcs', tax_rate:String(p.tax_rate||0) })
    setShowProduct(true)
  }

  const saveProduct = async () => {
    if (!form.name.trim() || !form.code.trim()) { toast.error('Name and code required'); return }
    setSaving(true)
    const payload = { code:form.code.trim(), name:form.name.trim(), description:form.description, type:form.type,
      cost_price:Number(form.cost_price)||0, selling_price:Number(form.selling_price)||0,
      stock_quantity:Number(form.stock_quantity)||0, reorder_level:Number(form.reorder_level)||0,
      unit:form.unit, tax_rate:Number(form.tax_rate)||0, is_active:true }
    if (editing) {
      await supabase.from('products').update(payload).eq('id', editing.id)
      toast.success('Product updated')
    } else {
      await supabase.from('products').insert({ ...payload, organization_id:organization!.id })
      toast.success(`${form.name} added`)
    }
    setShowProduct(false); setSaving(false); load()
  }

  const saveAdj = async () => {
    if (!adjForm.product_id || !adjForm.quantity) { toast.error('Select product and quantity'); return }
    setSaving(true)
    const product = products.find(p=>p.id===adjForm.product_id)
    if (!product) { setSaving(false); return }
    const qty = Number(adjForm.quantity)
    const newQty = adjForm.type==='in' ? product.stock_quantity+qty
                 : adjForm.type==='out' ? Math.max(0,product.stock_quantity-qty) : qty
    await supabase.from('products').update({ stock_quantity:newQty }).eq('id', product.id)
    await supabase.from('stock_movements').insert({
      organization_id:organization!.id, product_id:product.id, type:adjForm.type,
      quantity:qty, unit_cost:product.cost_price, notes:adjForm.notes,
      reference:`ADJ-${Date.now().toString().slice(-5)}`
    })
    toast.success(`Stock updated for ${product.name}`)
    setShowAdj(false); setAdjForm(BLANK_ADJ); setSaving(false); load()
  }

  const filtered = products.filter(p => !search || p.name?.toLowerCase().includes(search.toLowerCase()) || p.code?.includes(search))
  const lowStock  = products.filter(p => p.stock_quantity<=p.reorder_level && p.reorder_level>0 && p.type==='product')
  const totalValue = products.reduce((s,p)=>s+p.stock_quantity*p.cost_price,0)
  const upd = (k:string,v:string) => setForm(p=>({...p,[k]:v}))

  return (
    <div className="space-y-4 animate-fade-up">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h1 className="text-lg sm:text-xl font-bold" style={{ color:'var(--text-primary)' }}>Inventory</h1>
          <p className="text-xs sm:text-sm mt-0.5" style={{ color:'var(--text-secondary)' }}>Products, stock levels and movements</p>
        </div>
        <div className="flex gap-2 flex-shrink-0">
          <button className="btn-secondary text-xs sm:text-sm px-2 sm:px-4" onClick={()=>setShowAdj(true)}>
            <ArrowUpDown size={13}/><span className="hidden sm:inline">Adjust Stock</span>
          </button>
          <button className="btn-primary text-xs sm:text-sm px-2 sm:px-4" onClick={openCreate}>
            <Plus size={13}/><span className="hidden sm:inline">Add Product</span><span className="sm:hidden">Add</span>
          </button>
        </div>
      </div>

      {/* Stats — 1 row on mobile with scroll, 3 cols on desktop */}
      <div className="grid grid-cols-3 gap-2 sm:gap-3">
        {[
          { label:'Products',    val:String(products.length),          icon:Package,       bg:'var(--brand-dim)',   col:'var(--brand)' },
          { label:'Low Stock',   val:String(lowStock.length),          icon:AlertTriangle, bg:'var(--warning-dim)', col:'var(--warning)' },
          { label:'Stock Value', val:formatCurrency(totalValue,currency), icon:TrendingUp, bg:'var(--success-dim)', col:'var(--success)' },
        ].map(s=>(
          <div key={s.label} className="card p-3 flex items-center gap-2">
            <div className="w-7 h-7 sm:w-9 sm:h-9 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background:s.bg }}>
              <s.icon size={13} style={{ color:s.col }} />
            </div>
            <div className="min-w-0">
              <p className="text-xs truncate" style={{ color:'var(--text-secondary)' }}>{s.label}</p>
              <p className="font-bold text-xs sm:text-sm truncate" style={{ color:'var(--text-primary)' }}>{s.val}</p>
            </div>
          </div>
        ))}
      </div>

      {lowStock.length>0 && (
        <div className="flex items-start gap-2 p-3 rounded-xl text-sm"
          style={{ background:'var(--warning-dim)', border:'1px solid var(--warning)' }}>
          <AlertTriangle size={14} style={{ color:'var(--warning)' }} className="flex-shrink-0 mt-0.5"/>
          <p style={{ color:'var(--warning)' }} className="text-xs sm:text-sm">
            <strong>Low stock:</strong> {lowStock.map(p=>p.name).join(', ')}
          </p>
        </div>
      )}

      <div className="relative">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color:'var(--text-muted)' }}/>
        <input className="input pl-8 text-sm" placeholder="Search products…" value={search} onChange={e=>setSearch(e.target.value)}/>
      </div>

      {/* Table */}
      <div className="card">
        <div className="table-container">
          <table className="table">
            <thead>
              <tr>
                <th>Code</th>
                <th>Product</th>
                <th className="hidden sm:table-cell">Type</th>
                <th className="text-right hidden md:table-cell">Cost</th>
                <th className="text-right">Price</th>
                <th className="text-right">Stock</th>
                <th className="hidden sm:table-cell">Status</th>
                <th style={{ width:'40px' }}></th>
              </tr>
            </thead>
            <tbody>
              {loading ? Array(5).fill(0).map((_,i)=>(
                <tr key={i}>{Array(8).fill(0).map((_,j)=><td key={j}><div className="skeleton h-4 rounded"/></td>)}</tr>
              )) : filtered.length===0 ? (
                <tr><td colSpan={8} className="text-center py-10" style={{ color:'var(--text-muted)' }}>
                  <Package size={28} className="mx-auto mb-2 opacity-30"/>
                  <p className="text-sm">No products yet. Click "Add".</p>
                </td></tr>
              ) : filtered.map(p => {
                const isLow = p.stock_quantity<=p.reorder_level && p.reorder_level>0 && p.type==='product'
                return (
                  <tr key={p.id}>
                    <td className="font-mono text-xs font-bold" style={{ color:'var(--brand)' }}>{p.code}</td>
                    <td className="text-sm font-medium max-w-28 sm:max-w-none">
                      <p className="truncate">{p.name}</p>
                      {p.description && <p className="text-xs truncate" style={{ color:'var(--text-muted)' }}>{p.description}</p>}
                    </td>
                    <td className="hidden sm:table-cell">
                      <span className="badge text-xs" style={{ background:'var(--bg-table-head)', color:'var(--text-secondary)' }}>
                        {p.type}
                      </span>
                    </td>
                    <td className="text-right font-mono text-xs hidden md:table-cell">{formatCurrency(p.cost_price,currency)}</td>
                    <td className="text-right font-mono text-sm font-semibold">{formatCurrency(p.selling_price,currency)}</td>
                    <td className="text-right font-semibold text-sm" style={{ color:isLow?'var(--danger)':'var(--text-primary)' }}>
                      {p.stock_quantity}
                    </td>
                    <td className="hidden sm:table-cell">
                      {isLow
                        ? <span className="badge text-xs" style={{ background:'var(--danger-dim)', color:'var(--danger)' }}>Low</span>
                        : <span className="dot-green"/>}
                    </td>
                    <td><button className="btn-ghost p-1.5" onClick={()=>openEdit(p)}><Edit2 size={13}/></button></td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add/Edit modal */}
      {showProduct && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center"
          style={{ background:'rgba(32,33,36,0.5)' }}
          onClick={e=>e.target===e.currentTarget&&setShowProduct(false)}>
          <div className="w-full sm:max-w-lg rounded-t-2xl sm:rounded-2xl max-h-[92vh] flex flex-col"
            style={{ background:'var(--bg-card)', border:'1px solid var(--border)' }}>
            <div className="flex items-center justify-between p-4" style={{ borderBottom:'1px solid var(--border)' }}>
              <h2 className="font-bold" style={{ color:'var(--text-primary)' }}>{editing?'Edit Product':'New Product'}</h2>
              <button className="btn-ghost p-2" onClick={()=>setShowProduct(false)}><X size={16}/></button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div><label className="input-label">Code *</label>
                  <input className="input font-mono" value={form.code} onChange={e=>upd('code',e.target.value)}/></div>
                <div><label className="input-label">Type</label>
                  <select className="input" value={form.type} onChange={e=>upd('type',e.target.value)}>
                    <option value="product">Product</option>
                    <option value="service">Service</option>
                  </select></div>
              </div>
              <div><label className="input-label">Name *</label>
                <input className="input" placeholder="Product name" value={form.name} onChange={e=>upd('name',e.target.value)}/></div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="input-label">Cost Price</label>
                  <input className="input" type="number" min="0" value={form.cost_price} onChange={e=>upd('cost_price',e.target.value)}/></div>
                <div><label className="input-label">Selling Price *</label>
                  <input className="input" type="number" min="0" value={form.selling_price} onChange={e=>upd('selling_price',e.target.value)}/></div>
              </div>
              {form.type==='product' && (
                <div className="grid grid-cols-2 gap-3">
                  <div><label className="input-label">Opening Stock</label>
                    <input className="input" type="number" min="0" value={form.stock_quantity} onChange={e=>upd('stock_quantity',e.target.value)}/></div>
                  <div><label className="input-label">Reorder Level</label>
                    <input className="input" type="number" min="0" value={form.reorder_level} onChange={e=>upd('reorder_level',e.target.value)}/></div>
                </div>
              )}
              <div className="grid grid-cols-2 gap-3">
                <div><label className="input-label">Unit</label>
                  <select className="input" value={form.unit} onChange={e=>upd('unit',e.target.value)}>
                    {['pcs','kg','litres','metres','boxes','bags','hours'].map(u=><option key={u} value={u}>{u}</option>)}
                  </select></div>
                <div><label className="input-label">VAT Rate (%)</label>
                  <select className="input" value={form.tax_rate} onChange={e=>upd('tax_rate',e.target.value)}>
                    <option value="0">0% (Exempt)</option>
                    <option value="16">16% (Standard)</option>
                    <option value="8">8% (Reduced)</option>
                  </select></div>
              </div>
              {/* Margin preview */}
              {form.cost_price && form.selling_price && Number(form.selling_price)>0 && (
                <div className="rounded-xl p-3 text-xs" style={{ background:'var(--bg-table-head)' }}>
                  <p className="font-semibold mb-2" style={{ color:'var(--text-primary)' }}>Margin Preview</p>
                  <div className="flex gap-4">
                    <div><p style={{ color:'var(--text-muted)' }}>Margin</p>
                      <p className="font-bold" style={{ color:'var(--success)' }}>
                        {(((Number(form.selling_price)-Number(form.cost_price))/Number(form.selling_price))*100).toFixed(1)}%
                      </p></div>
                    <div><p style={{ color:'var(--text-muted)' }}>Profit/unit</p>
                      <p className="font-bold" style={{ color:'var(--text-primary)' }}>
                        {formatCurrency(Number(form.selling_price)-Number(form.cost_price),currency)}
                      </p></div>
                  </div>
                </div>
              )}
            </div>
            <div className="flex gap-3 p-4" style={{ borderTop:'1px solid var(--border)' }}>
              <button className="btn-secondary flex-1" onClick={()=>setShowProduct(false)}>Cancel</button>
              <button className="btn-primary flex-1 justify-center" onClick={saveProduct} disabled={saving}>
                <CheckCircle2 size={15}/>{saving?'Saving…':editing?'Save':'Add Product'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Adjust stock modal */}
      {showAdj && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center"
          style={{ background:'rgba(32,33,36,0.5)' }}
          onClick={e=>e.target===e.currentTarget&&setShowAdj(false)}>
          <div className="w-full sm:max-w-sm rounded-t-2xl sm:rounded-2xl"
            style={{ background:'var(--bg-card)', border:'1px solid var(--border)' }}>
            <div className="flex items-center justify-between p-4" style={{ borderBottom:'1px solid var(--border)' }}>
              <h2 className="font-bold" style={{ color:'var(--text-primary)' }}>Stock Adjustment</h2>
              <button className="btn-ghost p-2" onClick={()=>setShowAdj(false)}><X size={16}/></button>
            </div>
            <div className="p-4 space-y-3">
              <div><label className="input-label">Product *</label>
                <select className="input" value={adjForm.product_id}
                  onChange={e=>setAdjForm(p=>({...p,product_id:e.target.value}))}>
                  <option value="">Select product…</option>
                  {products.filter(p=>p.type==='product').map(p=>(
                    <option key={p.id} value={p.id}>{p.name} (stock: {p.stock_quantity})</option>
                  ))}
                </select></div>
              <div><label className="input-label">Type</label>
                <select className="input" value={adjForm.type}
                  onChange={e=>setAdjForm(p=>({...p,type:e.target.value}))}>
                  <option value="in">Stock In</option>
                  <option value="out">Stock Out</option>
                  <option value="adjustment">Set Absolute</option>
                </select></div>
              <div><label className="input-label">Quantity *</label>
                <input className="input" type="number" min="0" value={adjForm.quantity}
                  onChange={e=>setAdjForm(p=>({...p,quantity:e.target.value}))}/></div>
              <div><label className="input-label">Notes</label>
                <input className="input" placeholder="e.g. Annual stock count" value={adjForm.notes}
                  onChange={e=>setAdjForm(p=>({...p,notes:e.target.value}))}/></div>
            </div>
            <div className="flex gap-3 p-4" style={{ borderTop:'1px solid var(--border)' }}>
              <button className="btn-secondary flex-1" onClick={()=>setShowAdj(false)}>Cancel</button>
              <button className="btn-primary flex-1 justify-center" onClick={saveAdj} disabled={saving}>
                <CheckCircle2 size={15}/>{saving?'Saving…':'Apply'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

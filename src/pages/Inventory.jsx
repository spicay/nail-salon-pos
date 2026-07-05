import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'

const BLANK = { name: '', category: '', retail_price: 0, stock_quantity: 0, unit: 'pcs', low_stock_threshold: 5, cost_per_unit: 0 }

export default function Inventory() {
  const [products, setProducts] = useState([])
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [form, setForm] = useState(BLANK)

  useEffect(() => { load() }, [])

  async function load() {
    const { data } = await supabase.from('products').select('*').eq('active', true).order('name')
    setProducts(data || [])
  }

  function openNew() { setForm(BLANK); setEditingId(null); setShowForm(true) }
  function openEdit(p) {
    setForm({ name: p.name, category: p.category || '', retail_price: p.retail_price, stock_quantity: p.stock_quantity, unit: p.unit, low_stock_threshold: p.low_stock_threshold, cost_per_unit: p.cost_per_unit })
    setEditingId(p.id); setShowForm(true)
  }

  async function save() {
    if (!form.name) { alert('Product name is required'); return }
    if (editingId) {
      const { error } = await supabase.from('products').update(form).eq('id', editingId)
      if (error) { alert(error.message); return }
    } else {
      const { error } = await supabase.from('products').insert(form)
      if (error) { alert(error.message); return }
    }
    setShowForm(false); load()
  }

  async function adjustStock(p, delta) {
    const newQty = Math.max(0, Number(p.stock_quantity) + delta)
    await supabase.from('products').update({ stock_quantity: newQty }).eq('id', p.id)
    load()
  }

  async function deactivate(id) {
    if (!confirm('Remove this item from inventory?')) return
    await supabase.from('products').update({ active: false }).eq('id', id)
    load()
  }

  return (
    <div>
      <div className="page-header">
        <h1>Supplies & Inventory</h1>
        <button className="btn btn-accent" onClick={openNew}>+ Add Item</button>
      </div>
      <div className="card">
        <table>
          <thead><tr><th>Item Name</th><th>Category</th><th>Current Stock</th><th>Unit</th><th>Cost per Unit</th><th>Low Stock Alert At</th><th></th></tr></thead>
          <tbody>
            {products.map(p => {
              const low = Number(p.stock_quantity) <= Number(p.low_stock_threshold)
              return (
                <tr key={p.id}>
                  <td style={{ fontWeight: 600 }}>{p.name}</td>
                  <td>{p.category || '-'}</td>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ color: low ? 'var(--danger)' : 'var(--ink)', fontWeight: low ? 700 : 400 }}>{p.stock_quantity}</span>
                      {low && <span className="badge badge-no_show">Low</span>}
                      <button className="btn btn-ghost" style={{ minHeight: 28, padding: '2px 8px', fontSize: 13 }} onClick={() => adjustStock(p, -1)}>−</button>
                      <button className="btn btn-ghost" style={{ minHeight: 28, padding: '2px 8px', fontSize: 13 }} onClick={() => adjustStock(p, 1)}>+</button>
                    </div>
                  </td>
                  <td>{p.unit}</td>
                  <td>Rp {Number(p.cost_per_unit).toLocaleString('id-ID')}</td>
                  <td>{p.low_stock_threshold} {p.unit}</td>
                  <td>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button className="btn btn-ghost" style={{ minHeight: 30, padding: '4px 10px', fontSize: 13 }} onClick={() => openEdit(p)}>Edit</button>
                      <button className="btn btn-ghost" style={{ minHeight: 30, padding: '4px 10px', fontSize: 13, color: 'var(--danger)' }} onClick={() => deactivate(p.id)}>Remove</button>
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {showForm && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50 }}>
          <div className="card" style={{ width: 420 }}>
            <h3 style={{ marginBottom: 16 }}>{editingId ? 'Edit Item' : 'Add Supply / Inventory Item'}</h3>

            <label style={{ fontSize: 13, color: 'var(--muted)' }}>Item Name</label>
            <input className="input" style={{ marginBottom: 10, marginTop: 4 }} placeholder="e.g. Gel Polish - Red, Acetone, Cotton Pads" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />

            <label style={{ fontSize: 13, color: 'var(--muted)' }}>Category</label>
            <input className="input" style={{ marginBottom: 10, marginTop: 4 }} placeholder="e.g. polish, consumables, tools" value={form.category} onChange={e => setForm({ ...form, category: e.target.value })} />

            <div style={{ display: 'flex', gap: 10, marginBottom: 10 }}>
              <div style={{ flex: 1 }}>
                <label style={{ fontSize: 13, color: 'var(--muted)' }}>Current Stock Quantity</label>
                <input type="number" className="input" style={{ marginTop: 4 }} value={form.stock_quantity} onChange={e => setForm({ ...form, stock_quantity: Number(e.target.value) })} />
              </div>
              <div style={{ flex: 1 }}>
                <label style={{ fontSize: 13, color: 'var(--muted)' }}>Unit (pcs, ml, bottle…)</label>
                <input className="input" style={{ marginTop: 4 }} value={form.unit} onChange={e => setForm({ ...form, unit: e.target.value })} />
              </div>
            </div>

            <div style={{ display: 'flex', gap: 10, marginBottom: 10 }}>
              <div style={{ flex: 1 }}>
                <label style={{ fontSize: 13, color: 'var(--muted)' }}>Cost per Unit (Rp)</label>
                <input type="number" className="input" style={{ marginTop: 4 }} value={form.cost_per_unit} onChange={e => setForm({ ...form, cost_per_unit: Number(e.target.value) })} />
              </div>
              <div style={{ flex: 1 }}>
                <label style={{ fontSize: 13, color: 'var(--muted)' }}>Low Stock Alert — warn when below</label>
                <input type="number" className="input" style={{ marginTop: 4 }} value={form.low_stock_threshold} onChange={e => setForm({ ...form, low_stock_threshold: Number(e.target.value) })} />
              </div>
            </div>

            <div style={{ display: 'flex', gap: 10, marginTop: 6 }}>
              <button className="btn btn-ghost" style={{ flex: 1 }} onClick={() => setShowForm(false)}>Cancel</button>
              <button className="btn btn-accent" style={{ flex: 1 }} onClick={save}>Save</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

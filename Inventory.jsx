import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'

export default function Inventory() {
  const [products, setProducts] = useState([])
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ name: '', category: '', retail_price: 0, stock_quantity: 0, unit: 'pcs', low_stock_threshold: 5, cost_per_unit: 0 })

  useEffect(() => { load() }, [])

  async function load() {
    const { data } = await supabase.from('products').select('*').eq('active', true).order('name')
    setProducts(data || [])
  }

  async function save() {
    if (!form.name) { alert('Name is required'); return }
    const { error } = await supabase.from('products').insert(form)
    if (error) { alert(error.message); return }
    setShowForm(false)
    setForm({ name: '', category: '', retail_price: 0, stock_quantity: 0, unit: 'pcs', low_stock_threshold: 5, cost_per_unit: 0 })
    load()
  }

  async function adjustStock(p, delta) {
    const newQty = Math.max(0, Number(p.stock_quantity) + delta)
    await supabase.from('products').update({ stock_quantity: newQty }).eq('id', p.id)
    load()
  }

  return (
    <div>
      <div className="page-header">
        <h1>Inventory</h1>
        <button className="btn btn-accent" onClick={() => setShowForm(true)}>+ Add Product</button>
      </div>

      <div className="card">
        <table>
          <thead><tr><th>Product</th><th>Category</th><th>Stock</th><th>Retail Price</th><th>Cost</th><th></th></tr></thead>
          <tbody>
            {products.map(p => {
              const low = Number(p.stock_quantity) <= Number(p.low_stock_threshold)
              return (
                <tr key={p.id}>
                  <td style={{ fontWeight: 600 }}>{p.name}</td>
                  <td>{p.category || '-'}</td>
                  <td>
                    <span style={{ color: low ? 'var(--danger)' : 'var(--ink)', fontWeight: low ? 700 : 400 }}>
                      {p.stock_quantity} {p.unit}
                    </span>
                    {low && <span className="badge badge-no_show" style={{ marginLeft: 8 }}>Low stock</span>}
                  </td>
                  <td>Rp {Number(p.retail_price).toLocaleString('id-ID')}</td>
                  <td>Rp {Number(p.cost_per_unit).toLocaleString('id-ID')}</td>
                  <td>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button className="btn btn-ghost" style={{ minHeight: 32, padding: '4px 10px' }} onClick={() => adjustStock(p, -1)}>−</button>
                      <button className="btn btn-ghost" style={{ minHeight: 32, padding: '4px 10px' }} onClick={() => adjustStock(p, 1)}>+</button>
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
          <div className="card" style={{ width: 380 }}>
            <h3 style={{ marginBottom: 16 }}>Add Product</h3>
            <input className="input" placeholder="Product name" style={{ marginBottom: 10 }} value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
            <input className="input" placeholder="Category" style={{ marginBottom: 10 }} value={form.category} onChange={e => setForm({ ...form, category: e.target.value })} />
            <div style={{ display: 'flex', gap: 10, marginBottom: 10 }}>
              <input type="number" className="input" placeholder="Retail price" value={form.retail_price} onChange={e => setForm({ ...form, retail_price: Number(e.target.value) })} />
              <input type="number" className="input" placeholder="Cost/unit" value={form.cost_per_unit} onChange={e => setForm({ ...form, cost_per_unit: Number(e.target.value) })} />
            </div>
            <div style={{ display: 'flex', gap: 10, marginBottom: 10 }}>
              <input type="number" className="input" placeholder="Stock qty" value={form.stock_quantity} onChange={e => setForm({ ...form, stock_quantity: Number(e.target.value) })} />
              <input className="input" placeholder="Unit (pcs, ml...)" value={form.unit} onChange={e => setForm({ ...form, unit: e.target.value })} />
            </div>
            <input type="number" className="input" placeholder="Low stock threshold" style={{ marginBottom: 16 }} value={form.low_stock_threshold} onChange={e => setForm({ ...form, low_stock_threshold: Number(e.target.value) })} />
            <div style={{ display: 'flex', gap: 10 }}>
              <button className="btn btn-ghost" style={{ flex: 1 }} onClick={() => setShowForm(false)}>Cancel</button>
              <button className="btn btn-accent" style={{ flex: 1 }} onClick={save}>Save</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'

const BLANK = { name: '', category: 'manicure', price: 0, duration_minutes: 30, description: '' }

export default function Services() {
  const [list, setList] = useState([])
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [form, setForm] = useState(BLANK)

  useEffect(() => { load() }, [])

  async function load() {
    const { data } = await supabase.from('services').select('*').eq('active', true).order('category').order('name')
    setList(data || [])
  }

  function openNew() {
    setForm(BLANK); setEditingId(null); setShowForm(true)
  }

  function openEdit(svc) {
    setForm({
      name: svc.name, category: svc.category || 'manicure', price: svc.price,
      duration_minutes: svc.duration_minutes, description: svc.description || ''
    })
    setEditingId(svc.id)
    setShowForm(true)
  }

  async function save() {
    if (!form.name || !form.price) { alert('Service name and price are required'); return }
    if (editingId) {
      const { error } = await supabase.from('services').update(form).eq('id', editingId)
      if (error) { alert(error.message); return }
    } else {
      const { error } = await supabase.from('services').insert(form)
      if (error) { alert(error.message); return }
    }
    setShowForm(false)
    load()
  }

  async function deactivate(id) {
    if (!confirm('Remove this service from your price list? (It stays on past receipts/reports, just won\'t be offered for new bookings.)')) return
    await supabase.from('services').update({ active: false }).eq('id', id)
    load()
  }

  const grouped = list.reduce((acc, s) => {
    const cat = s.category || 'other'
    acc[cat] = acc[cat] || []
    acc[cat].push(s)
    return acc
  }, {})

  return (
    <div>
      <div className="page-header">
        <h1>Services & Price List</h1>
        <button className="btn btn-accent" onClick={openNew}>+ Add Service</button>
      </div>

      {Object.entries(grouped).map(([cat, items]) => (
        <div key={cat} className="card" style={{ marginBottom: 18 }}>
          <h3 style={{ marginBottom: 14, textTransform: 'capitalize' }}>{cat.replace('_', ' ')}</h3>
          <table>
            <thead><tr><th>Service</th><th>Price</th><th>Duration</th><th>Description</th><th></th></tr></thead>
            <tbody>
              {items.map(s => (
                <tr key={s.id}>
                  <td style={{ fontWeight: 600 }}>{s.name}</td>
                  <td>Rp {Number(s.price).toLocaleString('id-ID')}</td>
                  <td>{s.duration_minutes} min</td>
                  <td style={{ color: 'var(--muted)', fontSize: 13.5 }}>{s.description || '-'}</td>
                  <td>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button className="btn btn-ghost" style={{ minHeight: 32, padding: '4px 12px', fontSize: 13 }} onClick={() => openEdit(s)}>Edit</button>
                      <button className="btn btn-ghost" style={{ minHeight: 32, padding: '4px 12px', fontSize: 13, color: 'var(--danger)' }} onClick={() => deactivate(s.id)}>Remove</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}

      {showForm && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50 }}>
          <div className="card" style={{ width: 420 }}>
            <h3 style={{ marginBottom: 16 }}>{editingId ? 'Edit Service' : 'Add Service'}</h3>

            <label style={{ fontSize: 13, color: 'var(--muted)' }}>Service Name</label>
            <input className="input" style={{ marginTop: 4, marginBottom: 10 }} value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />

            <label style={{ fontSize: 13, color: 'var(--muted)' }}>Category</label>
            <select className="input" style={{ marginTop: 4, marginBottom: 10 }} value={form.category} onChange={e => setForm({ ...form, category: e.target.value })}>
              <option value="manicure">Manicure</option>
              <option value="pedicure">Pedicure</option>
              <option value="gel">Gel</option>
              <option value="acrylic">Acrylic</option>
              <option value="nail_art">Nail Art</option>
              <option value="add_on">Add-on</option>
              <option value="other">Other</option>
            </select>

            <div style={{ display: 'flex', gap: 10, marginBottom: 10 }}>
              <div style={{ flex: 1 }}>
                <label style={{ fontSize: 13, color: 'var(--muted)' }}>Price (Rp)</label>
                <input type="number" className="input" style={{ marginTop: 4 }} value={form.price} onChange={e => setForm({ ...form, price: Number(e.target.value) })} />
              </div>
              <div style={{ flex: 1 }}>
                <label style={{ fontSize: 13, color: 'var(--muted)' }}>Duration (minutes)</label>
                <input type="number" className="input" style={{ marginTop: 4 }} value={form.duration_minutes} onChange={e => setForm({ ...form, duration_minutes: Number(e.target.value) })} />
              </div>
            </div>

            <label style={{ fontSize: 13, color: 'var(--muted)' }}>Description / Notes (optional)</label>
            <textarea className="input" rows={3} style={{ marginTop: 4, marginBottom: 16 }} placeholder="e.g. includes cuticle care, nail shaping, top coat..." value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} />

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

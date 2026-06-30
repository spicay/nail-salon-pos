import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'

export default function Customers() {
  const [list, setList] = useState([])
  const [search, setSearch] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ full_name: '', phone: '', email: '', notes: '' })

  useEffect(() => { load() }, [])

  async function load() {
    const { data } = await supabase.from('customers').select('*').order('full_name')
    setList(data || [])
  }

  async function save() {
    if (!form.full_name) { alert('Name is required'); return }
    const { error } = await supabase.from('customers').insert(form)
    if (error) { alert(error.message); return }
    setShowForm(false); setForm({ full_name: '', phone: '', email: '', notes: '' })
    load()
  }

  const filtered = list.filter(c => c.full_name.toLowerCase().includes(search.toLowerCase()) || (c.phone || '').includes(search))

  return (
    <div>
      <div className="page-header">
        <h1>Customers</h1>
        <button className="btn btn-accent" onClick={() => setShowForm(true)}>+ Add Customer</button>
      </div>

      <input className="input" placeholder="Search by name or phone..." style={{ width: 320, marginBottom: 18 }} value={search} onChange={e => setSearch(e.target.value)} />

      <div className="card">
        <table>
          <thead><tr><th>Name</th><th>Phone</th><th>Email</th><th>Loyalty Points</th><th>Notes</th></tr></thead>
          <tbody>
            {filtered.map(c => (
              <tr key={c.id}>
                <td style={{ fontWeight: 600 }}>{c.full_name}</td>
                <td>{c.phone || '-'}</td>
                <td>{c.email || '-'}</td>
                <td>{c.loyalty_points}</td>
                <td>{c.notes || '-'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showForm && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50 }}>
          <div className="card" style={{ width: 380 }}>
            <h3 style={{ marginBottom: 16 }}>Add Customer</h3>
            <input className="input" placeholder="Full name" style={{ marginBottom: 10 }} value={form.full_name} onChange={e => setForm({ ...form, full_name: e.target.value })} />
            <input className="input" placeholder="Phone" style={{ marginBottom: 10 }} value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} />
            <input className="input" placeholder="Email" style={{ marginBottom: 10 }} value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} />
            <textarea className="input" placeholder="Notes (allergies, preferences...)" style={{ marginBottom: 16 }} rows={2} value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} />
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

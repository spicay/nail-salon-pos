import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'

export default function Staff() {
  const [list, setList] = useState([])
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ full_name: '', pin_code: '', role: 'technician', commission_rate: 0, phone: '' })

  useEffect(() => { load() }, [])

  async function load() {
    const { data } = await supabase.from('staff').select('*').eq('active', true).order('full_name')
    setList(data || [])
  }

  async function save() {
    if (!form.full_name || !form.pin_code) { alert('Name and PIN are required'); return }
    if (!/^\d{4,6}$/.test(form.pin_code)) { alert('PIN must be 4-6 digits'); return }
    const { error } = await supabase.from('staff').insert(form)
    if (error) { alert(error.message); return }
    setShowForm(false); setForm({ full_name: '', pin_code: '', role: 'technician', commission_rate: 0, phone: '' })
    load()
  }

  async function deactivate(id) {
    if (!confirm('Deactivate this staff member?')) return
    await supabase.from('staff').update({ active: false }).eq('id', id)
    load()
  }

  return (
    <div>
      <div className="page-header">
        <h1>Staff</h1>
        <button className="btn btn-accent" onClick={() => setShowForm(true)}>+ Add Staff</button>
      </div>

      <div className="card">
        <table>
          <thead><tr><th>Name</th><th>Role</th><th>Phone</th><th>Commission</th><th></th></tr></thead>
          <tbody>
            {list.map(s => (
              <tr key={s.id}>
                <td style={{ fontWeight: 600 }}>{s.full_name}</td>
                <td style={{ textTransform: 'capitalize' }}>{s.role}</td>
                <td>{s.phone || '-'}</td>
                <td>{s.commission_rate}%</td>
                <td><button className="btn btn-ghost" style={{ minHeight: 32, padding: '4px 12px', fontSize: 13 }} onClick={() => deactivate(s.id)}>Deactivate</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showForm && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50 }}>
          <div className="card" style={{ width: 380 }}>
            <h3 style={{ marginBottom: 16 }}>Add Staff Member</h3>
            <input className="input" placeholder="Full name" style={{ marginBottom: 10 }} value={form.full_name} onChange={e => setForm({ ...form, full_name: e.target.value })} />
            <input className="input" placeholder="4-6 digit PIN" style={{ marginBottom: 10 }} value={form.pin_code} onChange={e => setForm({ ...form, pin_code: e.target.value.replace(/\D/g,'') })} />
            <select className="input" style={{ marginBottom: 10 }} value={form.role} onChange={e => setForm({ ...form, role: e.target.value })}>
              <option value="technician">Technician</option>
              <option value="cashier">Cashier</option>
              <option value="manager">Manager</option>
              <option value="owner">Owner</option>
            </select>
            <input className="input" placeholder="Phone" style={{ marginBottom: 10 }} value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} />
            <input type="number" className="input" placeholder="Commission rate %" style={{ marginBottom: 16 }} value={form.commission_rate} onChange={e => setForm({ ...form, commission_rate: Number(e.target.value) })} />
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

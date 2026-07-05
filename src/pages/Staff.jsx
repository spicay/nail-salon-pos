import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'

const BLANK = { full_name: '', pin_code: '', role: 'technician', commission_rate: 0, phone: '' }

export default function Staff() {
  const [list, setList] = useState([])
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [form, setForm] = useState(BLANK)

  useEffect(() => { load() }, [])

  async function load() {
    const { data } = await supabase.from('staff').select('*').eq('active', true).order('full_name')
    setList(data || [])
  }

  function openNew() { setForm(BLANK); setEditingId(null); setShowForm(true) }
  function openEdit(s) {
    setForm({ full_name: s.full_name, pin_code: s.pin_code, role: s.role, commission_rate: s.commission_rate, phone: s.phone || '' })
    setEditingId(s.id); setShowForm(true)
  }

  async function save() {
    if (!form.full_name || !form.pin_code) { alert('Name and PIN are required'); return }
    if (!/^\d{4,6}$/.test(form.pin_code)) { alert('PIN must be 4-6 digits'); return }
    if (editingId) {
      const { error } = await supabase.from('staff').update(form).eq('id', editingId)
      if (error) { alert(error.message); return }
    } else {
      const { error } = await supabase.from('staff').insert(form)
      if (error) { alert(error.message); return }
    }
    setShowForm(false); load()
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
        <button className="btn btn-accent" onClick={openNew}>+ Add Staff</button>
      </div>
      <div className="card">
        <table>
          <thead><tr><th>Name</th><th>Role</th><th>Phone</th><th>Commission Rate</th><th></th></tr></thead>
          <tbody>
            {list.map(s => (
              <tr key={s.id}>
                <td style={{ fontWeight: 600 }}>{s.full_name}</td>
                <td style={{ textTransform: 'capitalize' }}>{s.role}</td>
                <td>{s.phone || '-'}</td>
                <td>{s.commission_rate}%</td>
                <td>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button className="btn btn-ghost" style={{ minHeight: 30, padding: '4px 10px', fontSize: 13 }} onClick={() => openEdit(s)}>Edit</button>
                    <button className="btn btn-ghost" style={{ minHeight: 30, padding: '4px 10px', fontSize: 13, color: 'var(--danger)' }} onClick={() => deactivate(s.id)}>Deactivate</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showForm && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50 }}>
          <div className="card" style={{ width: 400 }}>
            <h3 style={{ marginBottom: 16 }}>{editingId ? 'Edit Staff Member' : 'Add Staff Member'}</h3>

            <label style={{ fontSize: 13, color: 'var(--muted)' }}>Full Name</label>
            <input className="input" style={{ marginBottom: 10, marginTop: 4 }} placeholder="e.g. Rina Dewi" value={form.full_name} onChange={e => setForm({ ...form, full_name: e.target.value })} />

            <label style={{ fontSize: 13, color: 'var(--muted)' }}>Login PIN (4–6 digits, used to sign into the app)</label>
            <input className="input" style={{ marginBottom: 10, marginTop: 4 }} placeholder="e.g. 1234" value={form.pin_code} onChange={e => setForm({ ...form, pin_code: e.target.value.replace(/\D/g,'') })} />

            <label style={{ fontSize: 13, color: 'var(--muted)' }}>Role</label>
            <select className="input" style={{ marginBottom: 10, marginTop: 4 }} value={form.role} onChange={e => setForm({ ...form, role: e.target.value })}>
              <option value="technician">Technician (nail tech, can use cashier)</option>
              <option value="cashier">Cashier (front desk, no admin access)</option>
              <option value="manager">Manager</option>
              <option value="owner">Owner (full access)</option>
            </select>

            <label style={{ fontSize: 13, color: 'var(--muted)' }}>Phone Number</label>
            <input className="input" style={{ marginBottom: 10, marginTop: 4 }} placeholder="e.g. 0812-3456-7890" value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} />

            <label style={{ fontSize: 13, color: 'var(--muted)' }}>Commission Rate — percentage of service revenue they earn (e.g. 40 = 40%)</label>
            <input type="number" className="input" style={{ marginBottom: 16, marginTop: 4 }} placeholder="e.g. 40" value={form.commission_rate} onChange={e => setForm({ ...form, commission_rate: Number(e.target.value) })} />

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

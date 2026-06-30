import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import { format } from 'date-fns'

const STATUSES = ['booked','confirmed','in_progress','completed','no_show','cancelled']

export default function Appointments() {
  const [date, setDate] = useState(format(new Date(), 'yyyy-MM-dd'))
  const [appts, setAppts] = useState([])
  const [customers, setCustomers] = useState([])
  const [staffList, setStaffList] = useState([])
  const [services, setServices] = useState([])
  const [showForm, setShowForm] = useState(false)

  const [form, setForm] = useState({ customer_id: '', technician_id: '', time: '10:00', service_ids: [], notes: '' })

  useEffect(() => { loadRefs(); }, [])
  useEffect(() => { loadAppts() }, [date])

  async function loadRefs() {
    const [c, s, sv] = await Promise.all([
      supabase.from('customers').select('*').order('full_name'),
      supabase.from('staff').select('*').eq('active', true).order('full_name'),
      supabase.from('services').select('*').eq('active', true).order('name'),
    ])
    setCustomers(c.data || []); setStaffList(s.data || []); setServices(sv.data || [])
  }

  async function loadAppts() {
    const start = `${date}T00:00:00`
    const end = `${date}T23:59:59`
    const { data } = await supabase.from('appointments')
      .select('*, customers(full_name), staff(full_name), appointment_services(*, services(name, price))')
      .gte('scheduled_start', start).lte('scheduled_start', end)
      .order('scheduled_start')
    setAppts(data || [])
  }

  async function updateStatus(id, status) {
    await supabase.from('appointments').update({ status }).eq('id', id)
    loadAppts()
  }

  async function createAppointment() {
    if (!form.technician_id || form.service_ids.length === 0) {
      alert('Please choose a technician and at least one service'); return
    }
    const selectedServices = services.filter(s => form.service_ids.includes(s.id))
    const totalMinutes = selectedServices.reduce((s, x) => s + (x.duration_minutes || 30), 0)
    const start = new Date(`${date}T${form.time}:00`)
    const end = new Date(start.getTime() + totalMinutes * 60000)

    const { data: appt, error } = await supabase.from('appointments').insert({
      customer_id: form.customer_id || null,
      technician_id: form.technician_id,
      scheduled_start: start.toISOString(),
      scheduled_end: end.toISOString(),
      notes: form.notes,
      status: 'booked'
    }).select().single()

    if (error) { alert(error.message); return }

    await supabase.from('appointment_services').insert(
      selectedServices.map(s => ({ appointment_id: appt.id, service_id: s.id, price_at_booking: s.price }))
    )

    setShowForm(false)
    setForm({ customer_id: '', technician_id: '', time: '10:00', service_ids: [], notes: '' })
    loadAppts()
  }

  return (
    <div>
      <div className="page-header">
        <h1>Appointments</h1>
        <button className="btn btn-accent" onClick={() => setShowForm(true)}>+ New Appointment</button>
      </div>

      <input type="date" className="input" style={{ width: 200, marginBottom: 18 }} value={date} onChange={e => setDate(e.target.value)} />

      <div className="card">
        {appts.length === 0 && <p style={{ color: 'var(--muted)' }}>No appointments for this date.</p>}
        <table>
          <thead><tr><th>Time</th><th>Customer</th><th>Technician</th><th>Services</th><th>Status</th><th></th></tr></thead>
          <tbody>
            {appts.map(a => (
              <tr key={a.id}>
                <td>{format(new Date(a.scheduled_start), 'h:mm a')}</td>
                <td>{a.customers?.full_name || 'Walk-in'}</td>
                <td>{a.staff?.full_name || '-'}</td>
                <td>{a.appointment_services.map(s => s.services?.name).join(', ')}</td>
                <td><span className={`badge badge-${a.status}`}>{a.status.replace('_',' ')}</span></td>
                <td>
                  <select className="input" style={{ padding: '6px 8px', fontSize: 13, width: 140 }}
                    value={a.status} onChange={e => updateStatus(a.id, e.target.value)}>
                    {STATUSES.map(s => <option key={s} value={s}>{s.replace('_',' ')}</option>)}
                  </select>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showForm && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50 }}>
          <div className="card" style={{ width: 420, maxHeight: '85vh', overflowY: 'auto', background: 'var(--paper-card)' }}>
            <h3 style={{ marginBottom: 16 }}>New Appointment</h3>

            <label style={{ fontSize: 13, color: 'var(--muted)' }}>Customer</label>
            <select className="input" style={{ marginBottom: 10, marginTop: 4 }} value={form.customer_id} onChange={e => setForm({ ...form, customer_id: e.target.value })}>
              <option value="">Walk-in</option>
              {customers.map(c => <option key={c.id} value={c.id}>{c.full_name}</option>)}
            </select>

            <label style={{ fontSize: 13, color: 'var(--muted)' }}>Technician</label>
            <select className="input" style={{ marginBottom: 10, marginTop: 4 }} value={form.technician_id} onChange={e => setForm({ ...form, technician_id: e.target.value })}>
              <option value="">Select technician</option>
              {staffList.map(s => <option key={s.id} value={s.id}>{s.full_name}</option>)}
            </select>

            <label style={{ fontSize: 13, color: 'var(--muted)' }}>Time</label>
            <input type="time" className="input" style={{ marginBottom: 10, marginTop: 4 }} value={form.time} onChange={e => setForm({ ...form, time: e.target.value })} />

            <label style={{ fontSize: 13, color: 'var(--muted)' }}>Services</label>
            <div style={{ marginTop: 4, marginBottom: 10, maxHeight: 160, overflowY: 'auto', border: '1.5px solid var(--line)', borderRadius: 9, padding: 8 }}>
              {services.map(s => (
                <label key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 4px', fontSize: 14 }}>
                  <input type="checkbox" checked={form.service_ids.includes(s.id)}
                    onChange={e => {
                      setForm(f => ({
                        ...f,
                        service_ids: e.target.checked ? [...f.service_ids, s.id] : f.service_ids.filter(id => id !== s.id)
                      }))
                    }} />
                  {s.name} — Rp {Number(s.price).toLocaleString('id-ID')}
                </label>
              ))}
            </div>

            <label style={{ fontSize: 13, color: 'var(--muted)' }}>Notes</label>
            <textarea className="input" style={{ marginTop: 4, marginBottom: 16 }} rows={2} value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} />

            <div style={{ display: 'flex', gap: 10 }}>
              <button className="btn btn-ghost" style={{ flex: 1 }} onClick={() => setShowForm(false)}>Cancel</button>
              <button className="btn btn-accent" style={{ flex: 1 }} onClick={createAppointment}>Book Appointment</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

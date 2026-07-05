import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import { format } from 'date-fns'

export default function Membership() {
  const [members, setMembers] = useState([])
  const [allCustomers, setAllCustomers] = useState([])
  const [showAddForm, setShowAddForm] = useState(false)
  const [selectedCustomerId, setSelectedCustomerId] = useState('')
  const [birthdayInput, setBirthdayInput] = useState('')

  const currentYear = new Date().getFullYear()
  const currentMonth = new Date().getMonth() + 1 // 1-12

  useEffect(() => { load() }, [])

  async function load() {
    const { data: m } = await supabase.from('customers').select('*').eq('is_member', true).order('full_name')
    const { data: all } = await supabase.from('customers').select('*').order('full_name')
    setMembers(m || [])
    setAllCustomers(all || [])
  }

  async function makeMember() {
    if (!selectedCustomerId) { alert('Choose a customer first'); return }
    const updates = { is_member: true, member_since: format(new Date(), 'yyyy-MM-dd') }
    if (birthdayInput) updates.birthday = birthdayInput
    const { error } = await supabase.from('customers').update(updates).eq('id', selectedCustomerId)
    if (error) { alert(error.message); return }
    setShowAddForm(false); setSelectedCustomerId(''); setBirthdayInput('')
    load()
  }

  async function removeMember(id) {
    if (!confirm('Remove membership for this customer?')) return
    await supabase.from('customers').update({ is_member: false }).eq('id', id)
    load()
  }

  async function updateBirthday(id, value) {
    await supabase.from('customers').update({ birthday: value }).eq('id', id)
    load()
  }

  async function markTreatRedeemed(id) {
    await supabase.from('customers').update({ birthday_treat_used_year: currentYear }).eq('id', id)
    load()
  }

  function isBirthdayMonth(birthday) {
    if (!birthday) return false
    const m = Number(birthday.split('-')[1])
    return m === currentMonth
  }

  const birthdayThisMonth = members.filter(m => isBirthdayMonth(m.birthday))
  const nonMembers = allCustomers.filter(c => !c.is_member)

  return (
    <div>
      <div className="page-header">
        <h1>Membership</h1>
        <button className="btn btn-accent" onClick={() => setShowAddForm(true)}>+ Add Member</button>
      </div>

      {birthdayThisMonth.length > 0 && (
        <div className="card" style={{ marginBottom: 20, borderColor: 'var(--gold)', background: '#fdf8ef' }}>
          <h3 style={{ marginBottom: 10 }}>🎂 Birthdays This Month — Free Treat Eligible</h3>
          <table>
            <thead><tr><th>Name</th><th>Birthday</th><th>Status</th><th></th></tr></thead>
            <tbody>
              {birthdayThisMonth.map(m => {
                const redeemed = m.birthday_treat_used_year === currentYear
                return (
                  <tr key={m.id}>
                    <td style={{ fontWeight: 600 }}>{m.full_name}</td>
                    <td>{format(new Date(m.birthday + 'T00:00:00'), 'MMMM d')}</td>
                    <td>
                      <span className={`badge ${redeemed ? 'badge-completed' : 'badge-booked'}`}>
                        {redeemed ? 'Treat redeemed' : 'Not yet redeemed'}
                      </span>
                    </td>
                    <td>
                      {!redeemed && (
                        <button className="btn btn-ghost" style={{ minHeight: 32, padding: '4px 12px', fontSize: 13 }} onClick={() => markTreatRedeemed(m.id)}>
                          Mark as redeemed
                        </button>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      <div className="card">
        <h3 style={{ marginBottom: 14 }}>All Members ({members.length})</h3>
        {members.length === 0 && <p style={{ color: 'var(--muted)' }}>No members yet. Add customers to your membership program above.</p>}
        <table>
          <thead><tr><th>Name</th><th>Phone</th><th>Member Since</th><th>Birthday</th><th></th></tr></thead>
          <tbody>
            {members.map(m => (
              <tr key={m.id}>
                <td style={{ fontWeight: 600 }}>{m.full_name}</td>
                <td>{m.phone || '-'}</td>
                <td>{m.member_since || '-'}</td>
                <td>
                  <input type="date" className="input" style={{ padding: '6px 8px', fontSize: 13, width: 150 }}
                    value={m.birthday || ''} onChange={e => updateBirthday(m.id, e.target.value)} />
                </td>
                <td>
                  <button className="btn btn-ghost" style={{ minHeight: 32, padding: '4px 12px', fontSize: 13, color: 'var(--danger)' }} onClick={() => removeMember(m.id)}>Remove</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showAddForm && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50 }}>
          <div className="card" style={{ width: 380 }}>
            <h3 style={{ marginBottom: 16 }}>Add Member</h3>
            <label style={{ fontSize: 13, color: 'var(--muted)' }}>Customer</label>
            <select className="input" style={{ marginTop: 4, marginBottom: 10 }} value={selectedCustomerId} onChange={e => setSelectedCustomerId(e.target.value)}>
              <option value="">Select a customer</option>
              {nonMembers.map(c => <option key={c.id} value={c.id}>{c.full_name}</option>)}
            </select>
            <label style={{ fontSize: 13, color: 'var(--muted)' }}>Birthday (optional, for free birthday treats)</label>
            <input type="date" className="input" style={{ marginTop: 4, marginBottom: 16 }} value={birthdayInput} onChange={e => setBirthdayInput(e.target.value)} />
            <div style={{ display: 'flex', gap: 10 }}>
              <button className="btn btn-ghost" style={{ flex: 1 }} onClick={() => setShowAddForm(false)}>Cancel</button>
              <button className="btn btn-accent" style={{ flex: 1 }} onClick={makeMember}>Add as Member</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

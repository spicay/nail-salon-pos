import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import { useStaff } from '../lib/StaffContext'
import { format } from 'date-fns'

export default function Settings() {
  const { staff } = useStaff()
  const [settings, setSettings] = useState(null)
  const [expenses, setExpenses] = useState([])
  const [expForm, setExpForm] = useState({ category: 'supplies', description: '', amount: 0, expense_date: format(new Date(), 'yyyy-MM-dd') })

  useEffect(() => { load() }, [])

  async function load() {
    const { data } = await supabase.from('business_settings').select('*').single()
    setSettings(data)
    const { data: exp } = await supabase.from('expenses').select('*').order('expense_date', { ascending: false }).limit(20)
    setExpenses(exp || [])
  }

  async function saveSettings() {
    const { error } = await supabase.from('business_settings').update(settings).eq('id', 1)
    if (error) alert(error.message)
    else alert('Settings saved')
  }

  async function addExpense() {
    if (!expForm.description || !expForm.amount) { alert('Description and amount required'); return }
    const { error } = await supabase.from('expenses').insert({ ...expForm, created_by: staff?.id })
    if (error) { alert(error.message); return }
    setExpForm({ category: 'supplies', description: '', amount: 0, expense_date: format(new Date(), 'yyyy-MM-dd') })
    load()
  }

  if (!settings) return null

  return (
    <div>
      <div className="page-header"><h1>Settings</h1></div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
        <div className="card">
          <h3 style={{ marginBottom: 14 }}>Business Info</h3>
          <label style={{ fontSize: 13, color: 'var(--muted)' }}>Business Name</label>
          <input className="input" style={{ marginBottom: 10, marginTop: 4 }} value={settings.business_name || ''} onChange={e => setSettings({ ...settings, business_name: e.target.value })} />
          <label style={{ fontSize: 13, color: 'var(--muted)' }}>Address</label>
          <input className="input" style={{ marginBottom: 10, marginTop: 4 }} value={settings.address || ''} onChange={e => setSettings({ ...settings, address: e.target.value })} />
          <label style={{ fontSize: 13, color: 'var(--muted)' }}>Phone</label>
          <input className="input" style={{ marginBottom: 10, marginTop: 4 }} value={settings.phone || ''} onChange={e => setSettings({ ...settings, phone: e.target.value })} />
          <label style={{ fontSize: 13, color: 'var(--muted)' }}>Tax Rate (%)</label>
          <input type="number" className="input" style={{ marginBottom: 10, marginTop: 4 }} value={settings.tax_rate || 0} onChange={e => setSettings({ ...settings, tax_rate: Number(e.target.value) })} />
          <label style={{ fontSize: 13, color: 'var(--muted)' }}>Receipt Footer</label>
          <textarea className="input" style={{ marginBottom: 16, marginTop: 4 }} rows={2} value={settings.receipt_footer || ''} onChange={e => setSettings({ ...settings, receipt_footer: e.target.value })} />
          <button className="btn btn-accent" onClick={saveSettings}>Save Settings</button>
        </div>

        <div className="card">
          <h3 style={{ marginBottom: 14 }}>Log an Expense</h3>
          <label style={{ fontSize: 13, color: 'var(--muted)' }}>Category</label>
          <select className="input" style={{ marginBottom: 10, marginTop: 4 }} value={expForm.category} onChange={e => setExpForm({ ...expForm, category: e.target.value })}>
            <option value="rent">Rent</option>
            <option value="utilities">Utilities</option>
            <option value="payroll">Payroll</option>
            <option value="supplies">Supplies</option>
            <option value="other">Other</option>
          </select>
          <label style={{ fontSize: 13, color: 'var(--muted)' }}>Description</label>
          <input className="input" style={{ marginBottom: 10, marginTop: 4 }} value={expForm.description} onChange={e => setExpForm({ ...expForm, description: e.target.value })} />
          <label style={{ fontSize: 13, color: 'var(--muted)' }}>Amount (Rp)</label>
          <input type="number" className="input" style={{ marginBottom: 10, marginTop: 4 }} value={expForm.amount} onChange={e => setExpForm({ ...expForm, amount: Number(e.target.value) })} />
          <label style={{ fontSize: 13, color: 'var(--muted)' }}>Date</label>
          <input type="date" className="input" style={{ marginBottom: 16, marginTop: 4 }} value={expForm.expense_date} onChange={e => setExpForm({ ...expForm, expense_date: e.target.value })} />
          <button className="btn btn-accent" onClick={addExpense}>Add Expense</button>

          <h4 style={{ marginTop: 22, marginBottom: 10, fontSize: 14 }}>Recent Expenses</h4>
          <table>
            <thead><tr><th>Date</th><th>Category</th><th>Description</th><th>Amount</th></tr></thead>
            <tbody>
              {expenses.map(e => (
                <tr key={e.id}>
                  <td>{e.expense_date}</td>
                  <td style={{ textTransform: 'capitalize' }}>{e.category}</td>
                  <td>{e.description}</td>
                  <td>Rp {Number(e.amount).toLocaleString('id-ID')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

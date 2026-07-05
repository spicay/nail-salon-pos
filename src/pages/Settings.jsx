import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import { useStaff } from '../lib/StaffContext'
import { format } from 'date-fns'

const EXPENSE_CATEGORIES = ['rent', 'utilities', 'payroll', 'supplies', 'equipment', 'marketing', 'other']

export default function Settings() {
  const { staff } = useStaff()
  const [settings, setSettings] = useState(null)
  const [saved, setSaved] = useState(false)
  const [expenses, setExpenses] = useState([])
  const [expForm, setExpForm] = useState({
    category: 'supplies', custom_category: '', description: '', amount: '', expense_date: format(new Date(), 'yyyy-MM-dd')
  })

  useEffect(() => { load() }, [])

  async function load() {
    const { data } = await supabase.from('business_settings').select('*').single()
    setSettings(data)
    const { data: exp } = await supabase.from('expenses').select('*').order('expense_date', { ascending: false }).limit(30)
    setExpenses(exp || [])
  }

  async function saveSettings() {
    const { error } = await supabase.from('business_settings').update(settings).eq('id', 1)
    if (error) { alert(error.message); return }
    setSaved(true); setTimeout(() => setSaved(false), 2000)
  }

  async function addExpense() {
    const finalCategory = expForm.category === 'other' ? (expForm.custom_category?.trim() || 'other') : expForm.category
    if (!expForm.description?.trim()) { alert('Description is required'); return }
    if (!expForm.amount || Number(expForm.amount) <= 0) { alert('Please enter a valid amount'); return }
    if (expForm.category === 'other' && !expForm.custom_category?.trim()) { alert('Please describe the expense type'); return }

    const { error } = await supabase.from('expenses').insert({
      category: finalCategory,
      description: expForm.description,
      amount: Number(expForm.amount),
      expense_date: expForm.expense_date,
      created_by: staff?.id
    })
    if (error) { alert(error.message); return }
    setExpForm({ category: 'supplies', custom_category: '', description: '', amount: '', expense_date: format(new Date(), 'yyyy-MM-dd') })
    load()
  }

  if (!settings) return null

  const S = settings
  const set = (key, val) => setSettings({ ...S, [key]: val })

  return (
    <div>
      <div className="page-header"><h1>Settings</h1></div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 20 }}>
        {/* Business Info */}
        <div className="card">
          <h3 style={{ marginBottom: 14 }}>Business Info</h3>
          <label style={{ fontSize: 13, color: 'var(--muted)' }}>Business Name (appears on receipts)</label>
          <input className="input" style={{ marginBottom: 10, marginTop: 4 }} value={S.business_name || ''} onChange={e => set('business_name', e.target.value)} />
          <label style={{ fontSize: 13, color: 'var(--muted)' }}>Address</label>
          <input className="input" style={{ marginBottom: 10, marginTop: 4 }} value={S.address || ''} onChange={e => set('address', e.target.value)} />
          <label style={{ fontSize: 13, color: 'var(--muted)' }}>Phone Number</label>
          <input className="input" style={{ marginBottom: 10, marginTop: 4 }} value={S.phone || ''} onChange={e => set('phone', e.target.value)} />
          <label style={{ fontSize: 13, color: 'var(--muted)' }}>Instagram Handle (without @)</label>
          <input className="input" style={{ marginBottom: 10, marginTop: 4 }} placeholder="e.g. naileditjakarta" value={S.instagram_handle || ''} onChange={e => set('instagram_handle', e.target.value)} />
          <label style={{ fontSize: 13, color: 'var(--muted)' }}>WhatsApp Number (for sharing receipts)</label>
          <input className="input" style={{ marginBottom: 10, marginTop: 4 }} placeholder="e.g. 628123456789" value={S.whatsapp_number || ''} onChange={e => set('whatsapp_number', e.target.value)} />
        </div>

        {/* Receipt & Tax settings */}
        <div className="card">
          <h3 style={{ marginBottom: 14 }}>Receipt & Tax</h3>
          <label style={{ fontSize: 13, color: 'var(--muted)' }}>Tax Rate (%) — 0 if you don't charge tax</label>
          <input type="number" className="input" style={{ marginBottom: 10, marginTop: 4 }} placeholder="e.g. 11 for 11% PPN" value={S.tax_rate || 0} onChange={e => set('tax_rate', Number(e.target.value))} />
          <label style={{ fontSize: 13, color: 'var(--muted)' }}>Receipt Header — shown below business name</label>
          <textarea className="input" style={{ marginBottom: 10, marginTop: 4 }} rows={2} placeholder="e.g. Thank you for visiting!" value={S.receipt_header || ''} onChange={e => set('receipt_header', e.target.value)} />
          <label style={{ fontSize: 13, color: 'var(--muted)' }}>Receipt Footer — bottom of every receipt</label>
          <textarea className="input" style={{ marginBottom: 10, marginTop: 4 }} rows={2} placeholder="e.g. Follow us @nailedit • Book again via WA" value={S.receipt_footer || ''} onChange={e => set('receipt_footer', e.target.value)} />
          <label style={{ fontSize: 13, color: 'var(--muted)' }}>Bank / QRIS Account Info (shown on deposit receipts)</label>
          <textarea className="input" style={{ marginBottom: 16, marginTop: 4 }} rows={2} placeholder="e.g. BCA 1234567890 a/n Nailed by Spica" value={S.bank_account_info || ''} onChange={e => set('bank_account_info', e.target.value)} />
          <button className="btn btn-accent" onClick={saveSettings}>
            {saved ? '✓ Saved' : 'Save Settings'}
          </button>
        </div>
      </div>

      {/* Expense logging */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
        <div className="card">
          <h3 style={{ marginBottom: 14 }}>Log an Expense</h3>

          <label style={{ fontSize: 13, color: 'var(--muted)' }}>Expense Category</label>
          <select className="input" style={{ marginBottom: 10, marginTop: 4 }} value={expForm.category} onChange={e => setExpForm({ ...expForm, category: e.target.value, custom_category: '' })}>
            {EXPENSE_CATEGORIES.map(c => (
              <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>
            ))}
          </select>

          {expForm.category === 'other' && (
            <>
              <label style={{ fontSize: 13, color: 'var(--muted)' }}>Specify expense type (required)</label>
              <input className="input" style={{ marginBottom: 10, marginTop: 4 }} placeholder="e.g. repairs, courier, decoration" value={expForm.custom_category} onChange={e => setExpForm({ ...expForm, custom_category: e.target.value })} />
            </>
          )}

          <label style={{ fontSize: 13, color: 'var(--muted)' }}>Description (required)</label>
          <input className="input" style={{ marginBottom: 10, marginTop: 4 }} placeholder="e.g. Monthly studio rent, BRI transfer" value={expForm.description} onChange={e => setExpForm({ ...expForm, description: e.target.value })} />

          <label style={{ fontSize: 13, color: 'var(--muted)' }}>Amount (Rp)</label>
          <input type="number" className="input" style={{ marginBottom: 10, marginTop: 4 }} placeholder="e.g. 5000000" value={expForm.amount} onChange={e => setExpForm({ ...expForm, amount: e.target.value })} />

          <label style={{ fontSize: 13, color: 'var(--muted)' }}>Date</label>
          <input type="date" className="input" style={{ marginBottom: 16, marginTop: 4 }} value={expForm.expense_date} onChange={e => setExpForm({ ...expForm, expense_date: e.target.value })} />

          <button className="btn btn-accent" onClick={addExpense}>Add Expense</button>
        </div>

        <div className="card">
          <h3 style={{ marginBottom: 14 }}>Recent Expenses</h3>
          {expenses.length === 0 && <p style={{ color: 'var(--muted)' }}>No expenses logged yet.</p>}
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

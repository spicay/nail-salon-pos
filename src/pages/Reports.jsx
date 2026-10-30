import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import { useStaff } from '../lib/StaffContext'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'
import { startOfMonth, endOfMonth, startOfYear, endOfYear, format, eachMonthOfInterval } from 'date-fns'

export default function Reports() {
  const { staff } = useStaff()
  const isOwner = staff?.role === 'owner'

  const [mode, setMode] = useState('monthly')
  const [year, setYear] = useState(new Date().getFullYear())
  const [month, setMonth] = useState(new Date().getMonth())
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const [txns, setTxns] = useState([])
  const [expenses, setExpenses] = useState([])
  const [lines, setLines] = useState([])
  const [serviceMap, setServiceMap] = useState({})
  const [staffMap, setStaffMap] = useState({})
  const [customerMap, setCustomerMap] = useState({})
  const [deleting, setDeleting] = useState(false)
  const [review, setReview] = useState(null)
  const [zoomUrl, setZoomUrl] = useState(null)

  useEffect(() => { load() }, [mode, year, month])

  function getRange() {
    if (mode === 'monthly') {
      const d = new Date(year, month, 1)
      return { start: startOfMonth(d), end: endOfMonth(d) }
    }
    const d = new Date(year, 0, 1)
    return { start: startOfYear(d), end: endOfYear(d) }
  }

  async function load() {
    setLoading(true); setError(null)
    const { start, end } = getRange()

    const [t, e, tl, sv, st, cu] = await Promise.all([
      supabase.from('transactions').select('*')
        .gte('created_at', start.toISOString()).lte('created_at', end.toISOString())
        .order('created_at', { ascending: false }),
      supabase.from('expenses').select('*')
        .gte('expense_date', format(start, 'yyyy-MM-dd')).lte('expense_date', format(end, 'yyyy-MM-dd'))
        .order('expense_date', { ascending: false }),
      supabase.from('transaction_services').select('transaction_id, price, service_id, technician_id').limit(10000),
      supabase.from('services').select('id, name'),
      supabase.from('staff').select('id, full_name'),
      supabase.from('customers').select('id, full_name'),
    ])

    if (t.error) { setError('Could not load sales: ' + t.error.message); setLoading(false); return }
    setTxns((t.data || []).filter(x => x.status === 'completed' || !x.status))
    setExpenses(e.data || [])
    setLines(tl.data || [])
    setServiceMap(Object.fromEntries((sv.data || []).map(x => [x.id, x.name])))
    setStaffMap(Object.fromEntries((st.data || []).map(x => [x.id, x.full_name])))
    setCustomerMap(Object.fromEntries((cu.data || []).map(x => [x.id, x.full_name])))
    setLoading(false)
  }

  // ---------- calculations ----------
  const revenue = txns.reduce((s, t) => s + Number(t.total_amount), 0)
  const expenseTotal = expenses.reduce((s, x) => s + Number(x.amount), 0)
  const profit = revenue - expenseTotal

  const txnIds = new Set(txns.map(t => t.id))
  const periodLines = lines.filter(l => txnIds.has(l.transaction_id))

  const byPayment = {}
  txns.forEach(t => { byPayment[t.payment_method] = (byPayment[t.payment_method] || 0) + Number(t.total_amount) })

  const svcTotals = {}
  periodLines.forEach(l => {
    const n = serviceMap[l.service_id] || 'Unknown'
    svcTotals[n] = (svcTotals[n] || 0) + Number(l.price)
  })
  const byService = Object.entries(svcTotals).sort((a, b) => b[1] - a[1]).slice(0, 8)

  const techTotals = {}
  periodLines.forEach(l => {
    const n = staffMap[l.technician_id] || 'Unassigned'
    techTotals[n] = (techTotals[n] || 0) + Number(l.price)
  })
  const byTech = Object.entries(techTotals).sort((a, b) => b[1] - a[1])

  const { start: rStart, end: rEnd } = getRange()
  let chartData
  if (mode === 'yearly') {
    chartData = eachMonthOfInterval({ start: rStart, end: rEnd }).map(m => {
      const total = txns.filter(t => {
        const d = new Date(t.created_at)
        return d.getMonth() === m.getMonth() && d.getFullYear() === m.getFullYear()
      }).reduce((s, t) => s + Number(t.total_amount), 0)
      return { label: format(m, 'MMM'), revenue: total }
    })
  } else {
    const days = endOfMonth(rStart).getDate()
    chartData = Array.from({ length: days }, (_, i) => ({
      label: String(i + 1),
      revenue: txns.filter(t => new Date(t.created_at).getDate() === i + 1)
        .reduce((s, t) => s + Number(t.total_amount), 0)
    }))
  }

  const years = Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - i)
  const periodLabel = mode === 'monthly' ? format(new Date(year, month, 1), 'MMMM yyyy') : String(year)

  // ---------- owner-only deletion ----------
  // Removes stored proof photos for sales that are about to be deleted
  async function removePhotosFor(ids) {
    try {
      for (let i = 0; i < ids.length; i += 40) {
        const chunk = ids.slice(i, i + 40)
        const { data } = await supabase.from('transaction_photos').select('photo_path').in('transaction_id', chunk)
        const paths = (data || []).map(x => x.photo_path)
        if (paths.length) await supabase.storage.from('proof-photos').remove(paths)
      }
    } catch (e) { console.error('photo cleanup failed', e) }
  }

  // Opens the review window for one sale: item lines + proof photos
  async function openReview(t) {
    setReview({ txn: t, lines: [], photos: [], loading: true, note: null })
    const [l, p] = await Promise.all([
      supabase.from('transaction_services').select('*').eq('transaction_id', t.id),
      supabase.from('transaction_photos').select('*').eq('transaction_id', t.id).order('created_at'),
    ])
    let photos = []
    let note = null
    if (p.error) {
      note = 'Photos could not be loaded: ' + p.error.message + ' (has migration_4.sql been run?)'
    } else {
      const paths = (p.data || []).map(x => x.photo_path)
      if (paths.length) {
        const { data: signed, error: sErr } = await supabase.storage.from('proof-photos').createSignedUrls(paths, 3600)
        if (sErr) note = 'Photos could not be opened: ' + sErr.message
        photos = (signed || []).filter(s => s.signedUrl).map(s => ({ url: s.signedUrl, path: s.path }))
      }
    }
    setReview({ txn: t, lines: l.data || [], photos, loading: false, note })
  }

  async function deleteTransaction(t) {
    if (!isOwner) return
    const label = '#' + String(t.order_number || '').padStart(7, '0')
    if (!confirm(`Permanently delete sale ${label} (Rp ${Number(t.total_amount).toLocaleString('id-ID')})?\n\nThis cannot be undone.`)) return
    setDeleting(true)
    await removePhotosFor([t.id])
    const { data, error: err } = await supabase.from('transactions').delete().eq('id', t.id).select()
    setDeleting(false)
    if (err) { alert('Could not delete: ' + err.message); return }
    if (!data || data.length === 0) { alert('Nothing was deleted. The database refused the request.'); return }
    load()
  }

  async function deleteExpense(x) {
    if (!isOwner) return
    if (!confirm(`Permanently delete expense "${x.description}" (Rp ${Number(x.amount).toLocaleString('id-ID')})?\n\nThis cannot be undone.`)) return
    setDeleting(true)
    const { data, error: err } = await supabase.from('expenses').delete().eq('id', x.id).select()
    setDeleting(false)
    if (err) { alert('Could not delete: ' + err.message); return }
    if (!data || data.length === 0) { alert('Nothing was deleted. The database refused the request.'); return }
    load()
  }

  async function deleteWholePeriod() {
    if (!isOwner) return
    const typed = prompt(
      `This will permanently delete ALL ${txns.length} sales and ${expenses.length} expenses for ${periodLabel}.\n\nThis cannot be undone.\n\nType DELETE to confirm:`
    )
    if (typed !== 'DELETE') { if (typed !== null) alert('Cancelled. You must type DELETE exactly.'); return }
    setDeleting(true)
    const { start, end } = getRange()
    const idRes = await supabase.from('transactions').select('id')
      .gte('created_at', start.toISOString()).lte('created_at', end.toISOString())
    await removePhotosFor((idRes.data || []).map(x => x.id))
    const r1 = await supabase.from('transactions').delete()
      .gte('created_at', start.toISOString()).lte('created_at', end.toISOString()).select()
    if (r1.error) { setDeleting(false); alert('Could not delete sales: ' + r1.error.message); load(); return }
    const r2 = await supabase.from('expenses').delete()
      .gte('expense_date', format(start, 'yyyy-MM-dd')).lte('expense_date', format(end, 'yyyy-MM-dd')).select()
    setDeleting(false)
    if (r2.error) { alert('Sales deleted, but expenses failed: ' + r2.error.message) }
    else alert(`Deleted ${r1.data?.length || 0} sales and ${r2.data?.length || 0} expenses for ${periodLabel}.`)
    load()
  }

  return (
    <div>
      <div className="page-header">
        <h1>Financial Reports</h1>
        <div style={{ display: 'flex', gap: 10 }}>
          <button className={mode === 'monthly' ? 'btn btn-primary' : 'btn btn-ghost'} onClick={() => setMode('monthly')}>Monthly</button>
          <button className={mode === 'yearly' ? 'btn btn-primary' : 'btn btn-ghost'} onClick={() => setMode('yearly')}>Yearly</button>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 10, marginBottom: 20 }}>
        {mode === 'monthly' && (
          <select className="input" style={{ width: 160 }} value={month} onChange={e => setMonth(Number(e.target.value))}>
            {Array.from({ length: 12 }, (_, i) => <option key={i} value={i}>{format(new Date(2024, i, 1), 'MMMM')}</option>)}
          </select>
        )}
        <select className="input" style={{ width: 120 }} value={year} onChange={e => setYear(Number(e.target.value))}>
          {years.map(y => <option key={y} value={y}>{y}</option>)}
        </select>
      </div>

      {error && <div style={{ background: '#fde8e8', border: '1px solid #f5c6c6', borderRadius: 8, padding: '12px 16px', marginBottom: 16, fontSize: 13, color: '#8b1c1c' }}>⚠️ {error}</div>}

      <div className="grid" style={{ gridTemplateColumns: 'repeat(4, 1fr)', marginBottom: 22 }}>
        <Stat label="Revenue" value={`Rp ${revenue.toLocaleString('id-ID')}`} />
        <Stat label="Expenses" value={`Rp ${expenseTotal.toLocaleString('id-ID')}`} />
        <Stat label="Net Profit" value={`Rp ${profit.toLocaleString('id-ID')}`} accent={profit >= 0 ? 'var(--success)' : 'var(--danger)'} />
        <Stat label="Transactions" value={txns.length} />
      </div>

      <div className="card" style={{ marginBottom: 20 }}>
        <h3 style={{ marginBottom: 16 }}>{mode === 'yearly' ? 'Revenue by Month' : 'Revenue by Day'}</h3>
        <ResponsiveContainer width="100%" height={260}>
          <BarChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e8e0d8" />
            <XAxis dataKey="label" tick={{ fontSize: 12 }} />
            <YAxis tick={{ fontSize: 12 }} tickFormatter={v => `${v / 1000}k`} />
            <Tooltip formatter={v => `Rp ${Number(v).toLocaleString('id-ID')}`} />
            <Bar dataKey="revenue" fill="#c4607a" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
        <div className="card">
          <h3 style={{ marginBottom: 14 }}>Top Services</h3>
          <table>
            <thead><tr><th>Service</th><th>Revenue</th></tr></thead>
            <tbody>{byService.map(([n, v]) => <tr key={n}><td>{n}</td><td>Rp {v.toLocaleString('id-ID')}</td></tr>)}</tbody>
          </table>
        </div>
        <div className="card">
          <h3 style={{ marginBottom: 14 }}>Revenue by Technician</h3>
          <table>
            <thead><tr><th>Technician</th><th>Revenue</th></tr></thead>
            <tbody>{byTech.map(([n, v]) => <tr key={n}><td>{n}</td><td>Rp {v.toLocaleString('id-ID')}</td></tr>)}</tbody>
          </table>
        </div>
      </div>

      <div className="card" style={{ marginTop: 20 }}>
        <h3 style={{ marginBottom: 14 }}>Revenue by Payment Method</h3>
        <table>
          <thead><tr><th>Method</th><th>Total</th></tr></thead>
          <tbody>
            {Object.entries(byPayment).map(([m, v]) => (
              <tr key={m}><td style={{ textTransform: 'capitalize' }}>{m.replace('_', ' ')}</td><td>Rp {v.toLocaleString('id-ID')}</td></tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* ============ OWNER ONLY ============ */}
      {isOwner && (
        <div className="card" style={{ marginTop: 28, borderColor: '#e3b5b1' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
            <div>
              <h3>Review & Manage Records (Owner only)</h3>
              <p style={{ fontSize: 13, color: 'var(--muted)', marginTop: 4 }}>
                Tap Review to check a sale's items, recalculated total and proof photos. Deleting a sale or expense removes it from the reports permanently. Showing records for <strong>{periodLabel}</strong>.
              </p>
            </div>
            <button className="btn btn-danger" style={{ minHeight: 40, padding: '8px 14px', fontSize: 13 }}
              disabled={deleting || (txns.length === 0 && expenses.length === 0)} onClick={deleteWholePeriod}>
              Delete all of {periodLabel}
            </button>
          </div>

          <h4 style={{ margin: '18px 0 8px', fontSize: 14 }}>Sales ({txns.length})</h4>
          {txns.length === 0 && <p style={{ fontSize: 13, color: 'var(--muted)' }}>No sales in this period.</p>}
          {txns.length > 0 && (
            <div style={{ maxHeight: 320, overflowY: 'auto', border: '1px solid var(--line)', borderRadius: 9 }}>
              <table>
                <thead><tr><th>No.</th><th>Date</th><th>Customer</th><th>Payment</th><th>Total</th><th></th></tr></thead>
                <tbody>
                  {txns.map(t => (
                    <tr key={t.id}>
                      <td>{String(t.order_number || '').padStart(7, '0')}</td>
                      <td>{format(new Date(t.created_at), 'd MMM yyyy, h:mm a')}</td>
                      <td>{customerMap[t.customer_id] || 'Walk-in'}</td>
                      <td style={{ textTransform: 'capitalize' }}>{(t.payment_method || '').replace('_', ' ')}</td>
                      <td>Rp {Number(t.total_amount).toLocaleString('id-ID')}</td>
                      <td>
                        <div style={{ display: 'flex', gap: 6 }}>
                          <button className="btn btn-ghost" disabled={deleting}
                            style={{ minHeight: 32, padding: '4px 12px', fontSize: 13 }}
                            onClick={() => openReview(t)}>Review</button>
                          <button className="btn btn-ghost" disabled={deleting}
                            style={{ minHeight: 32, padding: '4px 12px', fontSize: 13, color: 'var(--danger)' }}
                            onClick={() => deleteTransaction(t)}>Delete</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <h4 style={{ margin: '20px 0 8px', fontSize: 14 }}>Expenses ({expenses.length})</h4>
          {expenses.length === 0 && <p style={{ fontSize: 13, color: 'var(--muted)' }}>No expenses in this period.</p>}
          {expenses.length > 0 && (
            <div style={{ maxHeight: 260, overflowY: 'auto', border: '1px solid var(--line)', borderRadius: 9 }}>
              <table>
                <thead><tr><th>Date</th><th>Category</th><th>Description</th><th>Amount</th><th></th></tr></thead>
                <tbody>
                  {expenses.map(x => (
                    <tr key={x.id}>
                      <td>{x.expense_date}</td>
                      <td style={{ textTransform: 'capitalize' }}>{x.category}</td>
                      <td>{x.description}</td>
                      <td>Rp {Number(x.amount).toLocaleString('id-ID')}</td>
                      <td>
                        <button className="btn btn-ghost" disabled={deleting}
                          style={{ minHeight: 32, padding: '4px 12px', fontSize: 13, color: 'var(--danger)' }}
                          onClick={() => deleteExpense(x)}>Delete</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
      {review && (
        <ReviewModal review={review} serviceMap={serviceMap} staffMap={staffMap} customerMap={customerMap}
          onClose={() => setReview(null)} onZoom={u => setZoomUrl(u)} />
      )}
      {zoomUrl && (
        <div onClick={() => setZoomUrl(null)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.88)', zIndex: 120, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 12 }}>
          <img src={zoomUrl} alt="Proof of work" style={{ maxWidth: '96vw', maxHeight: '96vh', borderRadius: 8 }} />
        </div>
      )}
    </div>
  )
}

function Stat({ label, value, accent }) {
  return (
    <div className="card">
      <div style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 6 }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 700, fontFamily: 'var(--font-display)', color: accent }}>{value}</div>
    </div>
  )
}

function ReviewModal({ review, serviceMap, staffMap, customerMap, onClose, onZoom }) {
  const t = review.txn
  const rp = n => 'Rp ' + Number(n).toLocaleString('id-ID')

  // group identical item lines (same service, technician, price) into quantities
  const groups = {}
  review.lines.forEach(l => {
    const key = `${l.service_id}|${l.technician_id}|${l.price}`
    if (!groups[key]) groups[key] = { service: serviceMap[l.service_id] || 'Unknown service', tech: staffMap[l.technician_id] || 'Unassigned', unit: Number(l.price), qty: 0 }
    groups[key].qty += 1
  })
  const rows = Object.values(groups)

  const itemsSum = review.lines.reduce((s, l) => s + Number(l.price), 0)
  const discount = Number(t.discount_amount || 0)
  const tax = Number(t.tax_amount || 0)
  const tip = Number(t.tip_amount || 0)
  const calcTotal = itemsSum - discount + tax + tip
  const recorded = Number(t.total_amount)
  const totalDiff = recorded - calcTotal
  const subtotalDiff = Number(t.subtotal || 0) - itemsSum
  const matches = Math.abs(totalDiff) < 1 && Math.abs(subtotalDiff) < 1
  const noLines = !review.loading && review.lines.length === 0

  const line = (label, value, bold) => (
    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, marginBottom: 4, fontWeight: bold ? 700 : 400 }}>
      <span>{label}</span><span>{value}</span>
    </div>
  )

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 80, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div className="card" onClick={e => e.stopPropagation()} style={{ width: 600, maxWidth: '100%', maxHeight: '90vh', overflowY: 'auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4 }}>
          <div>
            <h3>Sale #{String(t.order_number || '').padStart(7, '0')}</h3>
            <p style={{ fontSize: 13, color: 'var(--muted)', marginTop: 4 }}>
              {format(new Date(t.created_at), 'EEEE, d MMM yyyy, h:mm a')} · {customerMap[t.customer_id] || 'Walk-in'} · rung up by {staffMap[t.cashier_id] || 'unknown'}
            </p>
          </div>
          <button className="btn btn-ghost" style={{ minHeight: 36, padding: '4px 14px' }} onClick={onClose}>Close</button>
        </div>

        <h4 style={{ margin: '18px 0 8px', fontSize: 14 }}>Items charged</h4>
        {review.loading && <p style={{ fontSize: 13, color: 'var(--muted)' }}>Loading…</p>}
        {noLines && <p style={{ fontSize: 13, color: 'var(--danger)' }}>No item lines were recorded for this sale.</p>}
        {rows.length > 0 && (
          <table>
            <thead><tr><th>Service</th><th>Technician</th><th>Qty</th><th>Unit</th><th>Line total</th></tr></thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={i}>
                  <td>{r.service}</td><td>{r.tech}</td><td>{r.qty}</td><td>{rp(r.unit)}</td><td>{rp(r.unit * r.qty)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {!review.loading && (
          <div style={{ marginTop: 16, padding: 14, background: '#f7f3ee', borderRadius: 9 }}>
            <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 8 }}>Calculation check</div>
            {line('Items added up', rp(itemsSum))}
            {discount > 0 && line('Discount', '-' + rp(discount))}
            {tax > 0 && line('Tax', rp(tax))}
            {tip > 0 && line('Tip', rp(tip))}
            <div style={{ borderTop: '1px solid var(--line)', margin: '8px 0' }} />
            {line('Total it should be', rp(calcTotal), true)}
            {line('Total recorded in system', rp(recorded), true)}
            <div style={{ marginTop: 10 }}>
              {matches
                ? <span className="badge badge-completed">✓ Calculation matches</span>
                : <span className="badge badge-no_show">⚠ Does not match</span>}
            </div>
            {!matches && (
              <p style={{ fontSize: 13, color: 'var(--danger)', marginTop: 8 }}>
                {Math.abs(totalDiff) >= 1 && <>Recorded total is {rp(Math.abs(totalDiff))} {totalDiff > 0 ? 'higher' : 'lower'} than the items add up to. </>}
                {Math.abs(subtotalDiff) >= 1 && <>Recorded subtotal ({rp(t.subtotal || 0)}) differs from the item lines ({rp(itemsSum)}).</>}
              </p>
            )}
            {t.is_deposit && (
              <p style={{ fontSize: 13, color: 'var(--muted)', marginTop: 8 }}>
                Down payment sale: {rp(t.deposit_amount)} received, {rp(t.balance_due)} still due.
              </p>
            )}
          </div>
        )}

        <h4 style={{ margin: '18px 0 8px', fontSize: 14 }}>Proof of work photos ({review.photos.length})</h4>
        {review.note && <p style={{ fontSize: 13, color: 'var(--danger)', marginBottom: 8 }}>{review.note}</p>}
        {!review.loading && !review.note && review.photos.length === 0 && (
          <p style={{ fontSize: 13, color: 'var(--muted)' }}>No proof photos were attached to this sale.</p>
        )}
        {review.photos.length > 0 && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
            {review.photos.map(ph => (
              <img key={ph.path} src={ph.url} alt="Proof of work" onClick={() => onZoom(ph.url)}
                style={{ width: '100%', aspectRatio: '1 / 1', objectFit: 'cover', borderRadius: 9, cursor: 'zoom-in', border: '1px solid var(--line)' }} />
            ))}
          </div>
        )}
        {review.photos.length > 0 && <p style={{ fontSize: 12, color: 'var(--muted)', marginTop: 8 }}>Tap a photo to enlarge it.</p>}
      </div>
    </div>
  )
}

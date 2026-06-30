import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'
import { startOfMonth, endOfMonth, startOfYear, endOfYear, format, eachMonthOfInterval } from 'date-fns'

export default function Reports() {
  const [mode, setMode] = useState('monthly') // monthly | yearly
  const [year, setYear] = useState(new Date().getFullYear())
  const [month, setMonth] = useState(new Date().getMonth()) // 0-indexed

  const [revenue, setRevenue] = useState(0)
  const [expenseTotal, setExpenseTotal] = useState(0)
  const [byPayment, setByPayment] = useState({})
  const [byService, setByService] = useState([])
  const [byTechnician, setByTechnician] = useState([])
  const [chartData, setChartData] = useState([])
  const [txnCount, setTxnCount] = useState(0)

  useEffect(() => { load() }, [mode, year, month])

  async function load() {
    let rangeStart, rangeEnd
    if (mode === 'monthly') {
      const d = new Date(year, month, 1)
      rangeStart = startOfMonth(d); rangeEnd = endOfMonth(d)
    } else {
      const d = new Date(year, 0, 1)
      rangeStart = startOfYear(d); rangeEnd = endOfYear(d)
    }

    const { data: txns } = await supabase.from('transactions')
      .select('*, transaction_services(*, services(name), staff:technician_id(full_name)), transaction_products(*, products(name))')
      .gte('created_at', rangeStart.toISOString()).lte('created_at', rangeEnd.toISOString())
      .eq('status', 'completed')

    const { data: expenses } = await supabase.from('expenses')
      .select('*').gte('expense_date', format(rangeStart, 'yyyy-MM-dd')).lte('expense_date', format(rangeEnd, 'yyyy-MM-dd'))

    const all = txns || []
    setTxnCount(all.length)
    setRevenue(all.reduce((s, t) => s + Number(t.total_amount), 0))
    setExpenseTotal((expenses || []).reduce((s, e) => s + Number(e.amount), 0))

    // by payment method
    const pay = {}
    all.forEach(t => { pay[t.payment_method] = (pay[t.payment_method] || 0) + Number(t.total_amount) })
    setByPayment(pay)

    // by service
    const svcMap = {}
    all.forEach(t => t.transaction_services.forEach(ts => {
      const name = ts.services?.name || 'Unknown'
      svcMap[name] = (svcMap[name] || 0) + Number(ts.price)
    }))
    setByService(Object.entries(svcMap).sort((a,b) => b[1]-a[1]).slice(0, 8))

    // by technician
    const techMap = {}
    all.forEach(t => t.transaction_services.forEach(ts => {
      const name = ts.staff?.full_name || 'Unassigned'
      techMap[name] = (techMap[name] || 0) + Number(ts.price)
    }))
    setByTechnician(Object.entries(techMap).sort((a,b) => b[1]-a[1]))

    // chart data
    if (mode === 'yearly') {
      const months = eachMonthOfInterval({ start: rangeStart, end: rangeEnd })
      const data = months.map(m => {
        const mStart = startOfMonth(m), mEnd = endOfMonth(m)
        const total = all.filter(t => {
          const d = new Date(t.created_at)
          return d >= mStart && d <= mEnd
        }).reduce((s, t) => s + Number(t.total_amount), 0)
        return { label: format(m, 'MMM'), revenue: total }
      })
      setChartData(data)
    } else {
      // daily breakdown within month
      const daysInMonth = endOfMonth(rangeStart).getDate()
      const data = Array.from({ length: daysInMonth }, (_, i) => {
        const day = i + 1
        const total = all.filter(t => new Date(t.created_at).getDate() === day)
          .reduce((s, t) => s + Number(t.total_amount), 0)
        return { label: String(day), revenue: total }
      })
      setChartData(data)
    }
  }

  const profit = revenue - expenseTotal
  const years = Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - i)

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
            {Array.from({ length: 12 }, (_, i) => (
              <option key={i} value={i}>{format(new Date(2024, i, 1), 'MMMM')}</option>
            ))}
          </select>
        )}
        <select className="input" style={{ width: 120 }} value={year} onChange={e => setYear(Number(e.target.value))}>
          {years.map(y => <option key={y} value={y}>{y}</option>)}
        </select>
      </div>

      <div className="grid" style={{ gridTemplateColumns: 'repeat(4, 1fr)', marginBottom: 22 }}>
        <Stat label="Revenue" value={`Rp ${revenue.toLocaleString('id-ID')}`} />
        <Stat label="Expenses" value={`Rp ${expenseTotal.toLocaleString('id-ID')}`} />
        <Stat label="Net Profit" value={`Rp ${profit.toLocaleString('id-ID')}`} accent={profit >= 0 ? 'var(--success)' : 'var(--danger)'} />
        <Stat label="Transactions" value={txnCount} />
      </div>

      <div className="card" style={{ marginBottom: 20 }}>
        <h3 style={{ marginBottom: 16 }}>{mode === 'yearly' ? 'Revenue by Month' : 'Revenue by Day'}</h3>
        <ResponsiveContainer width="100%" height={260}>
          <BarChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--line)" />
            <XAxis dataKey="label" tick={{ fontSize: 12 }} />
            <YAxis tick={{ fontSize: 12 }} tickFormatter={v => `${(v/1000)}k`} />
            <Tooltip formatter={v => `Rp ${Number(v).toLocaleString('id-ID')}`} />
            <Bar dataKey="revenue" fill="#c4607a" radius={[4,4,0,0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
        <div className="card">
          <h3 style={{ marginBottom: 14 }}>Top Services</h3>
          <table>
            <thead><tr><th>Service</th><th>Revenue</th></tr></thead>
            <tbody>
              {byService.map(([name, total]) => (
                <tr key={name}><td>{name}</td><td>Rp {total.toLocaleString('id-ID')}</td></tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="card">
          <h3 style={{ marginBottom: 14 }}>Revenue by Technician</h3>
          <table>
            <thead><tr><th>Technician</th><th>Revenue</th></tr></thead>
            <tbody>
              {byTechnician.map(([name, total]) => (
                <tr key={name}><td>{name}</td><td>Rp {total.toLocaleString('id-ID')}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="card" style={{ marginTop: 20 }}>
        <h3 style={{ marginBottom: 14 }}>Revenue by Payment Method</h3>
        <table>
          <thead><tr><th>Method</th><th>Total</th></tr></thead>
          <tbody>
            {Object.entries(byPayment).map(([method, total]) => (
              <tr key={method}><td style={{ textTransform: 'capitalize' }}>{method.replace('_',' ')}</td><td>Rp {total.toLocaleString('id-ID')}</td></tr>
            ))}
          </tbody>
        </table>
      </div>
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

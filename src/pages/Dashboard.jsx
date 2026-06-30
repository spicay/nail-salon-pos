import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import { format } from 'date-fns'

export default function Dashboard() {
  const [stats, setStats] = useState({ todayRevenue: 0, todayCount: 0, appointmentsToday: 0, lowStock: 0 })
  const [upcoming, setUpcoming] = useState([])

  useEffect(() => { load() }, [])

  async function load() {
    const todayStart = new Date(); todayStart.setHours(0,0,0,0)
    const todayEnd = new Date(); todayEnd.setHours(23,59,59,999)

    const { data: txns } = await supabase.from('transactions')
      .select('total_amount').gte('created_at', todayStart.toISOString()).lte('created_at', todayEnd.toISOString())

    const { data: appts } = await supabase.from('appointments')
      .select('*, customers(full_name), staff(full_name)')
      .gte('scheduled_start', todayStart.toISOString()).lte('scheduled_start', todayEnd.toISOString())
      .order('scheduled_start')

    const { data: products } = await supabase.from('products').select('*').eq('active', true)
    const low = (products || []).filter(p => Number(p.stock_quantity) <= Number(p.low_stock_threshold)).length

    setStats({
      todayRevenue: (txns || []).reduce((s, t) => s + Number(t.total_amount), 0),
      todayCount: (txns || []).length,
      appointmentsToday: (appts || []).length,
      lowStock: low
    })
    setUpcoming(appts || [])
  }

  return (
    <div>
      <div className="page-header"><h1>Dashboard</h1></div>

      <div className="grid" style={{ gridTemplateColumns: 'repeat(4, 1fr)', marginBottom: 24 }}>
        <StatCard label="Today's Revenue" value={`Rp ${stats.todayRevenue.toLocaleString('id-ID')}`} />
        <StatCard label="Transactions Today" value={stats.todayCount} />
        <StatCard label="Appointments Today" value={stats.appointmentsToday} />
        <StatCard label="Low Stock Items" value={stats.lowStock} accent={stats.lowStock > 0 ? 'var(--danger)' : undefined} />
      </div>

      <div className="card">
        <h3 style={{ marginBottom: 14 }}>Today's Schedule</h3>
        {upcoming.length === 0 && <p style={{ color: 'var(--muted)' }}>No appointments scheduled today.</p>}
        <table>
          <thead><tr><th>Time</th><th>Customer</th><th>Technician</th><th>Status</th></tr></thead>
          <tbody>
            {upcoming.map(a => (
              <tr key={a.id}>
                <td>{format(new Date(a.scheduled_start), 'h:mm a')}</td>
                <td>{a.customers?.full_name || 'Walk-in'}</td>
                <td>{a.staff?.full_name || '-'}</td>
                <td><span className={`badge badge-${a.status}`}>{a.status.replace('_',' ')}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function StatCard({ label, value, accent }) {
  return (
    <div className="card">
      <div style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 6 }}>{label}</div>
      <div style={{ fontSize: 24, fontWeight: 700, fontFamily: 'var(--font-display)', color: accent }}>{value}</div>
    </div>
  )
}

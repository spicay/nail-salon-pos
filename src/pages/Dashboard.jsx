import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import { format, startOfWeek, endOfWeek, addDays, isSameDay } from 'date-fns'

export default function Dashboard() {
  const [stats, setStats] = useState({ todayRevenue: 0, todayCount: 0, appointmentsToday: 0 })
  const [weekAppts, setWeekAppts] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    const now = new Date()
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0)
    const todayEnd   = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59)
    const weekStart  = startOfWeek(now, { weekStartsOn: 1 }) // Monday
    const weekEnd    = endOfWeek(now, { weekStartsOn: 1 })   // Sunday

    const [txns, rawAppts, apptSvcs, customers, staffData] = await Promise.all([
      supabase.from('transactions').select('total_amount')
        .gte('created_at', todayStart.toISOString())
        .lte('created_at', todayEnd.toISOString()),
      supabase.from('appointments').select('*')
        .gte('scheduled_start', weekStart.toISOString())
        .lte('scheduled_start', weekEnd.toISOString())
        .order('scheduled_start'),
      supabase.from('appointment_services').select('appointment_id, services(name)'),
      supabase.from('customers').select('id, full_name'),
      supabase.from('staff').select('id, full_name'),
    ])

    const low = (products.data || []).filter(p => Number(p.stock_quantity) <= Number(p.low_stock_threshold)).length
    const todayAppts = (rawAppts.data || []).filter(a => isSameDay(new Date(a.scheduled_start), now))

    setStats({
      todayRevenue: (txns.data || []).reduce((s, t) => s + Number(t.total_amount), 0),
      todayCount: (txns.data || []).length,
      appointmentsToday: todayAppts.length,

    })

    // Merge week appointments with names
    const custMap  = Object.fromEntries((customers.data || []).map(x => [x.id, x]))
    const staffMap = Object.fromEntries((staffData.data || []).map(x => [x.id, x]))
    const svcMap   = {}
    ;(apptSvcs.data || []).forEach(as => {
      if (!svcMap[as.appointment_id]) svcMap[as.appointment_id] = []
      if (as.services?.name) svcMap[as.appointment_id].push(as.services.name)
    })

    const merged = (rawAppts.data || []).map(a => ({
      ...a,
      customerName: custMap[a.customer_id]?.full_name || 'Walk-in',
      techName:     staffMap[a.technician_id]?.full_name || '-',
      serviceNames: (svcMap[a.id] || []).join(', ') || '-'
    }))

    setWeekAppts(merged)
    setLoading(false)
  }

  // Group appointments by day for the weekly view
  const weekStart = startOfWeek(new Date(), { weekStartsOn: 1 })
  const weekDays  = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i))
  const today     = new Date()

  return (
    <div>
      <div className="page-header">
        <h1>Dashboard</h1>
        <span style={{ fontSize: 13, color: 'var(--muted)' }}>{format(today, 'EEEE, d MMMM yyyy')}</span>
      </div>

      {/* Today's stats */}
      <div className="grid" style={{ gridTemplateColumns: 'repeat(3, 1fr)', marginBottom: 24 }}>
        <StatCard label="Today's Revenue" value={`Rp ${stats.todayRevenue.toLocaleString('id-ID')}`} />
        <StatCard label="Transactions Today" value={stats.todayCount} />
        <StatCard label="Appointments Today" value={stats.appointmentsToday} />

      </div>

      {/* Weekly schedule */}
      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
          <h3>This Week's Schedule</h3>
          <span style={{ fontSize: 13, color: 'var(--muted)' }}>
            {format(weekStart, 'MMM d')} – {format(addDays(weekStart, 6), 'MMM d, yyyy')}
          </span>
        </div>

        {loading && <p style={{ color: 'var(--muted)' }}>Loading…</p>}

        {!loading && weekAppts.length === 0 && (
          <p style={{ color: 'var(--muted)' }}>No appointments this week.</p>
        )}

        {!loading && weekDays.map(day => {
          const dayAppts = weekAppts.filter(a => isSameDay(new Date(a.scheduled_start), day))
          const isToday  = isSameDay(day, today)
          if (dayAppts.length === 0 && !isToday) return null // hide empty non-today days to keep it compact

          return (
            <div key={day.toString()} style={{ marginBottom: 18 }}>
              {/* Day header */}
              <div style={{
                display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8,
                paddingBottom: 6, borderBottom: '1.5px solid var(--line)'
              }}>
                <span style={{
                  fontWeight: 700, fontSize: 14,
                  color: isToday ? 'var(--rose)' : 'var(--ink)'
                }}>
                  {format(day, 'EEEE, d MMM')}
                </span>
                {isToday && (
                  <span style={{ fontSize: 11, background: 'var(--rose)', color: 'white', borderRadius: 100, padding: '2px 8px', fontWeight: 600 }}>
                    Today
                  </span>
                )}
                <span style={{ fontSize: 12, color: 'var(--muted)', marginLeft: 'auto' }}>
                  {dayAppts.length} appointment{dayAppts.length !== 1 ? 's' : ''}
                </span>
              </div>

              {dayAppts.length === 0 && (
                <p style={{ fontSize: 13, color: 'var(--muted)', paddingLeft: 4 }}>No appointments</p>
              )}

              {dayAppts.map(a => (
                <div key={a.id} style={{
                  display: 'grid', gridTemplateColumns: '80px 1fr 1fr 1fr auto',
                  gap: 12, alignItems: 'center',
                  padding: '10px 12px', marginBottom: 6,
                  background: isToday ? '#fdf8f6' : 'var(--paper)',
                  borderRadius: 8, border: '1px solid var(--line)'
                }}>
                  <span style={{ fontWeight: 700, fontSize: 13 }}>
                    {format(new Date(a.scheduled_start), 'h:mm a')}
                  </span>
                  <span style={{ fontSize: 13, fontWeight: 600 }}>{a.customerName}</span>
                  <span style={{ fontSize: 13, color: 'var(--muted)' }}>{a.techName}</span>
                  <span style={{ fontSize: 13, color: 'var(--muted)' }}>{a.serviceNames}</span>
                  <span className={`badge badge-${a.status}`} style={{ whiteSpace: 'nowrap' }}>
                    {a.status.replace('_', ' ')}
                  </span>
                </div>
              ))}
            </div>
          )
        })}
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

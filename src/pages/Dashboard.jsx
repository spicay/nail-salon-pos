import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import { format, startOfWeek, addDays, isSameDay } from 'date-fns'

function toLocalDateStr(isoStr) {
  const d = new Date(isoStr)
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
}

export default function Dashboard() {
  const [stats, setStats] = useState({ todayRevenue: 0, todayCount: 0, appointmentsToday: 0 })
  const [weekAppts, setWeekAppts] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    const now = new Date()
    const todayStr = toLocalDateStr(now.toISOString())
    const weekStart = startOfWeek(now, { weekStartsOn: 1 })
    const weekEnd = addDays(weekStart, 6)
    const weekStartStr = toLocalDateStr(weekStart.toISOString())
    const weekEndStr = toLocalDateStr(weekEnd.toISOString())

    // Load everything separately (same approach as working Appointments page)
    const [txns, rawAppts, apptSvcs, customers, staffData] = await Promise.all([
      supabase.from('transactions')
        .select('total_amount')
        .gte('created_at', new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0,0,0).toISOString())
        .lte('created_at', new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23,59,59).toISOString()),
      supabase.from('appointments').select('*').order('scheduled_start').limit(500),
      supabase.from('appointment_services').select('appointment_id, services(name)'),
      supabase.from('customers').select('id, full_name'),
      supabase.from('staff').select('id, full_name'),
    ])

    // Today's stats
    const todayTxns = txns.data || []
    setStats({
      todayRevenue: todayTxns.reduce((s, t) => s + Number(t.total_amount), 0),
      todayCount: todayTxns.length,
      appointmentsToday: (rawAppts.data || []).filter(a => toLocalDateStr(a.scheduled_start) === todayStr).length
    })

    // Filter to this week only (client-side)
    const custMap  = Object.fromEntries((customers.data || []).map(x => [x.id, x]))
    const staffMap = Object.fromEntries((staffData.data || []).map(x => [x.id, x]))
    const svcMap   = {}
    ;(apptSvcs.data || []).forEach(as => {
      if (!svcMap[as.appointment_id]) svcMap[as.appointment_id] = []
      if (as.services?.name) svcMap[as.appointment_id].push(as.services.name)
    })

    const thisWeek = (rawAppts.data || [])
      .filter(a => {
        const d = toLocalDateStr(a.scheduled_start)
        return d >= weekStartStr && d <= weekEndStr
      })
      .map(a => ({
        ...a,
        customerName: custMap[a.customer_id]?.full_name || 'Walk-in',
        techName: staffMap[a.technician_id]?.full_name || '-',
        serviceNames: (svcMap[a.id] || []).join(', ') || '-'
      }))

    setWeekAppts(thisWeek)
    setLoading(false)
  }

  const today = new Date()
  const weekStart = startOfWeek(today, { weekStartsOn: 1 })
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i))

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
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:18 }}>
          <h3>This Week's Schedule</h3>
          <span style={{ fontSize:13, color:'var(--muted)' }}>
            {format(weekStart,'MMM d')} – {format(addDays(weekStart,6),'MMM d, yyyy')}
          </span>
        </div>

        {loading && <p style={{ color:'var(--muted)' }}>Loading…</p>}

        {!loading && weekAppts.length === 0 && (
          <p style={{ color:'var(--muted)' }}>No appointments this week.</p>
        )}

        {!loading && weekDays.map(day => {
          const dayStr = toLocalDateStr(day.toISOString())
          const dayAppts = weekAppts
            .filter(a => toLocalDateStr(a.scheduled_start) === dayStr)
            .sort((a,b) => new Date(a.scheduled_start) - new Date(b.scheduled_start))
          const isToday = isSameDay(day, today)

          if (dayAppts.length === 0 && !isToday) return null

          return (
            <div key={dayStr} style={{ marginBottom:18 }}>
              <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:8, paddingBottom:6, borderBottom:'1.5px solid var(--line)' }}>
                <span style={{ fontWeight:700, fontSize:14, color: isToday ? 'var(--rose)' : 'var(--ink)' }}>
                  {format(day,'EEEE, d MMM')}
                </span>
                {isToday && (
                  <span style={{ fontSize:11, background:'var(--rose)', color:'white', borderRadius:100, padding:'2px 8px', fontWeight:600 }}>
                    Today
                  </span>
                )}
                <span style={{ fontSize:12, color:'var(--muted)', marginLeft:'auto' }}>
                  {dayAppts.length} appointment{dayAppts.length !== 1 ? 's' : ''}
                </span>
              </div>

              {dayAppts.length === 0 && (
                <p style={{ fontSize:13, color:'var(--muted)', paddingLeft:4 }}>No appointments</p>
              )}

              {dayAppts.map(a => (
                <div key={a.id} style={{
                  display:'grid', gridTemplateColumns:'80px 1fr 1fr 1fr auto',
                  gap:12, alignItems:'center',
                  padding:'10px 12px', marginBottom:6,
                  background: isToday ? '#fdf8f6' : 'var(--paper)',
                  borderRadius:8, border:'1px solid var(--line)'
                }}>
                  <span style={{ fontWeight:700, fontSize:13 }}>{format(new Date(a.scheduled_start),'h:mm a')}</span>
                  <span style={{ fontSize:13, fontWeight:600 }}>{a.customerName}</span>
                  <span style={{ fontSize:13, color:'var(--muted)' }}>{a.techName}</span>
                  <span style={{ fontSize:13, color:'var(--muted)' }}>{a.serviceNames}</span>
                  <span className={`badge badge-${a.status}`} style={{ whiteSpace:'nowrap' }}>
                    {a.status.replace('_',' ')}
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
      <div style={{ fontSize:13, color:'var(--muted)', marginBottom:6 }}>{label}</div>
      <div style={{ fontSize:24, fontWeight:700, fontFamily:'var(--font-display)', color:accent }}>{value}</div>
    </div>
  )
}

import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import { format, startOfWeek, addDays, addWeeks, subWeeks } from 'date-fns'

const STATUSES = ['booked','confirmed','in_progress','completed','no_show','cancelled']
const STATUS_COLORS = {
  booked:'#dde0f6', confirmed:'#dcefe3', in_progress:'#fbe7c8',
  completed:'#dcefe3', no_show:'#f6dada', cancelled:'#e9e6e9'
}
const DAY_START_HOUR = 8, DAY_END_HOUR = 21, PX_PER_MIN = 1.1

function toLocalDateStr(isoStr) {
  const d = new Date(isoStr)
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
}

export default function Appointments() {
  const [view, setView] = useState('list')
  const [date, setDate] = useState(format(new Date(),'yyyy-MM-dd'))
  const [weekAnchor, setWeekAnchor] = useState(new Date())
  const [allAppts, setAllAppts] = useState([])
  const [customers, setCustomers] = useState([])
  const [staffList, setStaffList] = useState([])
  const [services, setServices] = useState([])
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [detailAppt, setDetailAppt] = useState(null)
  const [form, setForm] = useState({ customer_id:'', technician_id:'', date:format(new Date(),'yyyy-MM-dd'), time:'10:00', service_ids:[], notes:'' })

  useEffect(() => { loadAll() }, [])

  async function loadAll() {
    setLoading(true)
    setError(null)

    // Step 1: load reference data
    const [c, s, sv] = await Promise.all([
      supabase.from('customers').select('id, full_name, phone'),
      supabase.from('staff').select('id, full_name').eq('active', true),
      supabase.from('services').select('id, name, price, duration_minutes').eq('active', true),
    ])
    setCustomers(c.data || [])
    setStaffList(s.data || [])
    setServices(sv.data || [])

    // Step 2: load appointments WITHOUT joins first to isolate the issue
    const { data: rawAppts, error: apptErr } = await supabase
      .from('appointments')
      .select('*')
      .order('scheduled_start', { ascending: false })
      .limit(500)

    if (apptErr) {
      setError(`Appointments error: ${apptErr.message} (code: ${apptErr.code})`)
      setLoading(false)
      return
    }

    if (!rawAppts || rawAppts.length === 0) {
      setAllAppts([])
      setLoading(false)
      return
    }

    // Step 3: load appointment_services separately
    const apptIds = rawAppts.map(a => a.id)
    const { data: apptSvcs, error: svcErr } = await supabase
      .from('appointment_services')
      .select('*, services(name, price)')
      .in('appointment_id', apptIds)

    if (svcErr) {
      setError(`Appointment services error: ${svcErr.message}`)
    }

    // Step 4: merge everything client-side
    const custMap = Object.fromEntries((c.data||[]).map(x => [x.id, x]))
    const staffMap = Object.fromEntries((s.data||[]).map(x => [x.id, x]))
    const svcsByAppt = {}
    ;(apptSvcs||[]).forEach(as => {
      if (!svcsByAppt[as.appointment_id]) svcsByAppt[as.appointment_id] = []
      svcsByAppt[as.appointment_id].push(as)
    })

    const merged = rawAppts.map(a => ({
      ...a,
      customers: custMap[a.customer_id] || null,
      staff: staffMap[a.technician_id] || null,
      appointment_services: svcsByAppt[a.id] || []
    }))

    setAllAppts(merged)
    setLoading(false)
  }

  const appts = allAppts
    .filter(a => toLocalDateStr(a.scheduled_start) === date)
    .sort((a, b) => new Date(a.scheduled_start) - new Date(b.scheduled_start))

  async function updateStatus(id, status) {
    await supabase.from('appointments').update({ status }).eq('id', id)
    setAllAppts(prev => prev.map(a => a.id === id ? {...a, status} : a))
    if (detailAppt?.id === id) setDetailAppt(d => ({...d, status}))
  }

  function openForm(prefillDate, prefillTime) {
    setForm({ customer_id:'', technician_id:'', date: prefillDate||date, time: prefillTime||'10:00', service_ids:[], notes:'' })
    setShowForm(true)
  }

  async function createAppointment() {
    if (!form.technician_id || form.service_ids.length === 0) { alert('Choose a technician and at least one service'); return }
    setSaving(true)
    const sel = services.filter(s => form.service_ids.includes(s.id))
    const totalMin = sel.reduce((s,x) => s + (x.duration_minutes||30), 0)
    const [y,m,d] = form.date.split('-').map(Number)
    const [hh,mm] = form.time.split(':').map(Number)
    const startDt = new Date(y,m-1,d,hh,mm,0)
    const endDt = new Date(startDt.getTime() + totalMin*60000)

    const { data: appt, error: err } = await supabase.from('appointments').insert({
      customer_id: form.customer_id||null,
      technician_id: form.technician_id,
      scheduled_start: startDt.toISOString(),
      scheduled_end: endDt.toISOString(),
      notes: form.notes, status:'booked'
    }).select().single()

    if (err) { alert('Error: ' + err.message); setSaving(false); return }

    await supabase.from('appointment_services').insert(
      sel.map(s => ({ appointment_id:appt.id, service_id:s.id, price_at_booking:s.price }))
    )

    const custMap = Object.fromEntries(customers.map(x=>[x.id,x]))
    const staffMap = Object.fromEntries(staffList.map(x=>[x.id,x]))
    const newAppt = {
      ...appt,
      customers: custMap[appt.customer_id]||null,
      staff: staffMap[appt.technician_id]||null,
      appointment_services: sel.map(s=>({services:{name:s.name,price:s.price}}))
    }
    setAllAppts(prev => [newAppt, ...prev])
    setDate(form.date)
    setView('list')
    setShowForm(false)
    setSaving(false)
  }

  const weekStart = useMemo(()=>startOfWeek(weekAnchor,{weekStartsOn:1}),[weekAnchor])
  const weekDays = useMemo(()=>Array.from({length:7},(_,i)=>addDays(weekStart,i)),[weekStart])
  const weekAppts = allAppts.filter(a=>{const d=new Date(a.scheduled_start);return d>=weekStart&&d<addDays(weekStart,7)})

  function blockStyle(appt) {
    const s=new Date(appt.scheduled_start),e=new Date(appt.scheduled_end)
    const top=(s.getHours()-DAY_START_HOUR)*60+s.getMinutes()
    const h=Math.max(20,(e-s)/60000)
    return {position:'absolute',top:`${top*PX_PER_MIN}px`,height:`${h*PX_PER_MIN-2}px`,left:2,right:2,background:STATUS_COLORS[appt.status]||'#eee',borderRadius:6,padding:'3px 5px',fontSize:11,overflow:'hidden',cursor:'pointer',border:'1px solid rgba(0,0,0,0.08)'}
  }

  return (
    <div>
      <div className="page-header">
        <h1>Appointments</h1>
        <div style={{display:'flex',gap:10}}>
          <button className={view==='list'?'btn btn-primary':'btn btn-ghost'} onClick={()=>setView('list')}>List</button>
          <button className={view==='calendar'?'btn btn-primary':'btn btn-ghost'} onClick={()=>setView('calendar')}>Calendar</button>
          <button className="btn btn-accent" onClick={()=>openForm()}>+ New Appointment</button>
        </div>
      </div>

      {error && (
        <div style={{background:'#fde8e8',border:'1px solid #f5c6c6',borderRadius:8,padding:'12px 16px',marginBottom:16,fontSize:13,color:'#8b1c1c'}}>
          ⚠️ {error}
        </div>
      )}

      {view==='list' && (
        <>
          <div style={{display:'flex',gap:12,alignItems:'center',marginBottom:18}}>
            <input type="date" className="input" style={{width:200}} value={date} onChange={e=>setDate(e.target.value)} />
            <button className="btn btn-ghost" onClick={loadAll} style={{minHeight:40}}>
              {loading?'⟳ Loading…':'↻ Refresh'}
            </button>
            <span style={{fontSize:12,color:'var(--muted)'}}>
              {appts.length} on this date · {allAppts.length} total loaded
            </span>
          </div>

          <div className="card">
            {loading && <p style={{color:'var(--muted)'}}>Loading…</p>}
            {!loading && appts.length===0 && (
              <div>
                <p style={{color:'var(--muted)',marginBottom:allAppts.length>0?8:0}}>No appointments for {date}.</p>
                {allAppts.length>0 && (
                  <p style={{fontSize:13,color:'var(--gold)'}}>
                    {allAppts.length} appointments exist on other dates. Change the date above to find them.
                  </p>
                )}
              </div>
            )}
            {!loading && appts.length>0 && (
              <table>
                <thead><tr><th>Time</th><th>Customer</th><th>Technician</th><th>Services</th><th>Status</th><th></th></tr></thead>
                <tbody>
                  {appts.map(a=>(
                    <tr key={a.id}>
                      <td>{format(new Date(a.scheduled_start),'h:mm a')}</td>
                      <td>{a.customers?.full_name||'Walk-in'}</td>
                      <td>{a.staff?.full_name||'-'}</td>
                      <td>{(a.appointment_services||[]).map(s=>s.services?.name).join(', ')}</td>
                      <td><span className={`badge badge-${a.status}`}>{a.status.replace('_',' ')}</span></td>
                      <td>
                        <select className="input" style={{padding:'6px 8px',fontSize:13,width:140}}
                          value={a.status} onChange={e=>updateStatus(a.id,e.target.value)}>
                          {STATUSES.map(s=><option key={s} value={s}>{s.replace('_',' ')}</option>)}
                        </select>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </>
      )}

      {view==='calendar' && (
        <>
          <div style={{display:'flex',alignItems:'center',gap:12,marginBottom:16}}>
            <button className="btn btn-ghost" onClick={()=>setWeekAnchor(subWeeks(weekAnchor,1))}>← Prev</button>
            <span style={{fontWeight:600}}>{format(weekStart,'MMM d')} – {format(addDays(weekStart,6),'MMM d, yyyy')}</span>
            <button className="btn btn-ghost" onClick={()=>setWeekAnchor(addWeeks(weekAnchor,1))}>Next →</button>
            <button className="btn btn-ghost" onClick={()=>setWeekAnchor(new Date())}>Today</button>
          </div>
          <div className="card" style={{overflowX:'auto'}}>
            <div style={{display:'grid',gridTemplateColumns:'50px repeat(7, 1fr)',minWidth:700}}>
              <div/>
              {weekDays.map(d=>(
                <div key={d.toString()} style={{textAlign:'center',fontWeight:600,fontSize:13,paddingBottom:8,borderBottom:'1.5px solid var(--line)'}}>
                  {format(d,'EEE d')}
                </div>
              ))}
              <div>
                {Array.from({length:DAY_END_HOUR-DAY_START_HOUR},(_,i)=>DAY_START_HOUR+i).map(h=>(
                  <div key={h} style={{height:`${60*PX_PER_MIN}px`,fontSize:11,color:'var(--muted)',textAlign:'right',paddingRight:6}}>
                    {h%12===0?12:h%12}{h<12?'am':'pm'}
                  </div>
                ))}
              </div>
              {weekDays.map(wd=>{
                const dayStr=format(wd,'yyyy-MM-dd')
                const dayAppts=weekAppts.filter(a=>toLocalDateStr(a.scheduled_start)===dayStr).sort((a,b)=>new Date(a.scheduled_start)-new Date(b.scheduled_start))
                return (
                  <div key={dayStr} style={{position:'relative',borderLeft:'1px solid var(--line)',height:`${(DAY_END_HOUR-DAY_START_HOUR)*60*PX_PER_MIN}px`,cursor:'pointer'}}
                    onClick={()=>openForm(dayStr)}>
                    {Array.from({length:DAY_END_HOUR-DAY_START_HOUR},(_,i)=>DAY_START_HOUR+i).map(h=>(
                      <div key={h} style={{position:'absolute',top:`${(h-DAY_START_HOUR)*60*PX_PER_MIN}px`,left:0,right:0,borderTop:'1px solid var(--line)'}}/>
                    ))}
                    {dayAppts.map(a=>(
                      <div key={a.id} style={blockStyle(a)} onClick={e=>{e.stopPropagation();setDetailAppt(a)}}>
                        <div style={{fontWeight:700}}>{format(new Date(a.scheduled_start),'h:mm a')}</div>
                        <div>{a.customers?.full_name||'Walk-in'}</div>
                        <div style={{color:'#555'}}>{a.staff?.full_name}</div>
                      </div>
                    ))}
                  </div>
                )
              })}
            </div>
          </div>
        </>
      )}

      {detailAppt && (
        <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.4)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:50}} onClick={()=>setDetailAppt(null)}>
          <div className="card" style={{width:360}} onClick={e=>e.stopPropagation()}>
            <h3 style={{marginBottom:10}}>{detailAppt.customers?.full_name||'Walk-in'}</h3>
            <p style={{fontSize:14,color:'var(--muted)',marginBottom:4}}>{format(new Date(detailAppt.scheduled_start),'EEEE, MMM d — h:mm a')} · {detailAppt.staff?.full_name||'unassigned'}</p>
            <p style={{fontSize:14,marginBottom:14}}>{(detailAppt.appointment_services||[]).map(s=>s.services?.name).join(', ')}</p>
            <label style={{fontSize:13,color:'var(--muted)'}}>Status</label>
            <select className="input" style={{marginTop:4,marginBottom:16}} value={detailAppt.status} onChange={e=>updateStatus(detailAppt.id,e.target.value)}>
              {STATUSES.map(s=><option key={s} value={s}>{s.replace('_',' ')}</option>)}
            </select>
            <button className="btn btn-ghost" style={{width:'100%'}} onClick={()=>setDetailAppt(null)}>Close</button>
          </div>
        </div>
      )}

      {showForm && (
        <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.4)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:50}}>
          <div className="card" style={{width:420,maxHeight:'85vh',overflowY:'auto',background:'var(--paper-card)'}}>
            <h3 style={{marginBottom:16}}>New Appointment</h3>
            <label style={{fontSize:13,color:'var(--muted)'}}>Customer</label>
            <select className="input" style={{marginBottom:10,marginTop:4}} value={form.customer_id} onChange={e=>setForm({...form,customer_id:e.target.value})}>
              <option value="">Walk-in</option>
              {customers.map(c=><option key={c.id} value={c.id}>{c.full_name}</option>)}
            </select>
            <label style={{fontSize:13,color:'var(--muted)'}}>Technician</label>
            <select className="input" style={{marginBottom:10,marginTop:4}} value={form.technician_id} onChange={e=>setForm({...form,technician_id:e.target.value})}>
              <option value="">Select technician</option>
              {staffList.map(s=><option key={s.id} value={s.id}>{s.full_name}</option>)}
            </select>
            <div style={{display:'flex',gap:10,marginBottom:10}}>
              <div style={{flex:1}}>
                <label style={{fontSize:13,color:'var(--muted)'}}>Date</label>
                <input type="date" className="input" style={{marginTop:4}} value={form.date} onChange={e=>setForm({...form,date:e.target.value})}/>
              </div>
              <div style={{flex:1}}>
                <label style={{fontSize:13,color:'var(--muted)'}}>Time</label>
                <input type="time" className="input" style={{marginTop:4}} value={form.time} onChange={e=>setForm({...form,time:e.target.value})}/>
              </div>
            </div>
            <label style={{fontSize:13,color:'var(--muted)'}}>Services</label>
            <div style={{marginTop:4,marginBottom:10,maxHeight:180,overflowY:'auto',border:'1.5px solid var(--line)',borderRadius:9,padding:8}}>
              {services.map(s=>(
                <label key={s.id} style={{display:'flex',alignItems:'center',gap:8,padding:'6px 4px',fontSize:14}}>
                  <input type="checkbox" checked={form.service_ids.includes(s.id)}
                    onChange={e=>setForm(f=>({...f,service_ids:e.target.checked?[...f.service_ids,s.id]:f.service_ids.filter(id=>id!==s.id)}))}/>
                  {s.name} — Rp {Number(s.price).toLocaleString('id-ID')} ({s.duration_minutes}min)
                </label>
              ))}
            </div>
            <label style={{fontSize:13,color:'var(--muted)'}}>Notes</label>
            <textarea className="input" style={{marginTop:4,marginBottom:16}} rows={2} value={form.notes} onChange={e=>setForm({...form,notes:e.target.value})}/>
            <div style={{display:'flex',gap:10}}>
              <button className="btn btn-ghost" style={{flex:1}} onClick={()=>setShowForm(false)} disabled={saving}>Cancel</button>
              <button className="btn btn-accent" style={{flex:1}} onClick={createAppointment} disabled={saving}>{saving?'Saving…':'Book Appointment'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

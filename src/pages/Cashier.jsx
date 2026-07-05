import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import { useStaff } from '../lib/StaffContext'
import { format } from 'date-fns'

export default function Cashier() {
  const { staff } = useStaff()
  const [services, setServices] = useState([])
  const [staffList, setStaffList] = useState([])
  const [customers, setCustomers] = useState([])
  const [settings, setSettings] = useState(null)
  const [cart, setCart] = useState([])
  const [customerId, setCustomerId] = useState('')
  const [discount, setDiscount] = useState(0)
  const [taxRate, setTaxRate] = useState(0)
  const [tip, setTip] = useState(0)
  const [paymentMethod, setPaymentMethod] = useState('cash')
  const [isDeposit, setIsDeposit] = useState(false)
  const [depositAmount, setDepositAmount] = useState(0)
  const [saving, setSaving] = useState(false)
  const [receipt, setReceipt] = useState(null)

  useEffect(() => { loadAll() }, [])

  async function loadAll() {
    const [s, st, c, biz] = await Promise.all([
      supabase.from('services').select('*').eq('active', true).order('category'),
      supabase.from('staff').select('*').eq('active', true).order('full_name'),
      supabase.from('customers').select('*').order('full_name'),
      supabase.from('business_settings').select('*').single(),
    ])
    setServices(s.data || [])
    setStaffList(st.data || [])
    setCustomers(c.data || [])
    if (biz.data) { setSettings(biz.data); setTaxRate(Number(biz.data.tax_rate) || 0) }
  }

  function addService(svc) {
    setCart(c => [...c, {
      id: svc.id, name: svc.name, price: Number(svc.price),
      technician_id: staffList[0]?.id || ''
    }])
  }

  function updateCartItem(idx, patch) {
    setCart(c => c.map((item, i) => i === idx ? { ...item, ...patch } : item))
  }

  function removeCartItem(idx) {
    setCart(c => c.filter((_, i) => i !== idx))
  }

  const subtotal = cart.reduce((sum, item) => sum + item.price, 0)
  const taxAmount = (subtotal - discount) * (taxRate / 100)
  const total = subtotal - discount + taxAmount + Number(tip || 0)
  const amountDueNow = isDeposit ? Number(depositAmount || 0) : total
  const balanceRemaining = isDeposit ? Math.max(0, total - Number(depositAmount || 0)) : 0

  async function checkout() {
    if (cart.length === 0) return
    if (isDeposit && (!depositAmount || depositAmount <= 0)) {
      alert('Enter a down payment amount'); return
    }
    setSaving(true)
    try {
      const { data: txn, error: txnError } = await supabase.from('transactions').insert({
        customer_id: customerId || null,
        cashier_id: staff?.id,
        subtotal, discount_amount: discount, tax_amount: taxAmount,
        tip_amount: tip || 0, total_amount: total,
        payment_method: paymentMethod,
        is_deposit: isDeposit,
        deposit_amount: isDeposit ? Number(depositAmount) : 0,
        balance_due: isDeposit ? balanceRemaining : 0,
      }).select().single()
      if (txnError) throw txnError

      const serviceRows = cart.map(c => ({
        transaction_id: txn.id, service_id: c.id,
        technician_id: c.technician_id || null,
        price: c.price, tip_amount: 0
      }))
      const { error } = await supabase.from('transaction_services').insert(serviceRows)
      if (error) throw error

      const customer = customers.find(c => c.id === customerId)
      setReceipt({
        ...txn,
        items: cart,
        customerName: customer?.full_name || 'Walk-in',
        customerPhone: customer?.phone || '',
        cashierName: staff?.full_name || '',
        createdAt: new Date(),
      })
      setCart([]); setCustomerId(''); setDiscount(0); setTip(0)
      setIsDeposit(false); setDepositAmount(0)
    } catch (e) {
      alert('Error saving transaction: ' + e.message)
    }
    setSaving(false)
  }

  const grouped = services.reduce((acc, s) => {
    acc[s.category || 'other'] = acc[s.category || 'other'] || []
    acc[s.category || 'other'].push(s)
    return acc
  }, {})

  return (
    <div>
      <div className="page-header"><h1>Cashier</h1></div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 380px', gap: 20, alignItems: 'start' }}>
        <div className="card">
          {Object.entries(grouped).map(([cat, list]) => (
            <div key={cat} style={{ marginBottom: 18 }}>
              <h3 style={{ fontSize: 13, textTransform: 'uppercase', color: 'var(--muted)', marginBottom: 10, letterSpacing: '0.04em' }}>{cat.replace('_', ' ')}</h3>
              <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))' }}>
                {list.map(s => (
                  <button key={s.id} onClick={() => addService(s)} className="card" style={{ textAlign: 'left', padding: 14 }}>
                    <div style={{ fontWeight: 600, fontSize: 14.5 }}>{s.name}</div>
                    <div style={{ color: 'var(--rose)', fontWeight: 600, marginTop: 4 }}>Rp {Number(s.price).toLocaleString('id-ID')}</div>
                  </button>
                ))}
              </div>
            </div>
          ))}
          {services.length === 0 && (
            <p style={{ color: 'var(--muted)' }}>No services yet. Add them under <strong>Services</strong> in the sidebar.</p>
          )}
        </div>

        <div className="card" style={{ position: 'sticky', top: 0 }}>
          <h3 style={{ marginBottom: 14 }}>Current Order</h3>
          <select className="input" value={customerId} onChange={e => setCustomerId(e.target.value)} style={{ marginBottom: 12 }}>
            <option value="">Walk-in (no customer)</option>
            {customers.map(c => <option key={c.id} value={c.id}>{c.full_name}</option>)}
          </select>

          {cart.length === 0 && <p style={{ color: 'var(--muted)', fontSize: 14 }}>No items yet. Tap a service to add it.</p>}
          {cart.map((item, idx) => (
            <div key={idx} style={{ marginBottom: 12, paddingBottom: 12, borderBottom: '1px solid var(--line)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ fontSize: 14, fontWeight: 600 }}>{item.name}</span>
                <button onClick={() => removeCartItem(idx)} style={{ color: 'var(--danger)', fontSize: 13 }}>Remove</button>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 6 }}>
                <select value={item.technician_id} onChange={e => updateCartItem(idx, { technician_id: e.target.value })}
                  className="input" style={{ fontSize: 13, padding: '8px 10px', width: 160 }}>
                  {staffList.map(s => <option key={s.id} value={s.id}>{s.full_name}</option>)}
                </select>
                <span style={{ fontWeight: 600 }}>Rp {item.price.toLocaleString('id-ID')}</span>
              </div>
            </div>
          ))}

          <div style={{ marginTop: 16 }}>
            <label style={{ fontSize: 13, color: 'var(--muted)' }}>Discount (Rp)</label>
            <input type="number" className="input" value={discount} onChange={e => setDiscount(Number(e.target.value) || 0)} style={{ marginBottom: 10, marginTop: 4 }} />
            <label style={{ fontSize: 13, color: 'var(--muted)' }}>Tip (Rp)</label>
            <input type="number" className="input" value={tip} onChange={e => setTip(Number(e.target.value) || 0)} style={{ marginBottom: 10, marginTop: 4 }} />
            <label style={{ fontSize: 13, color: 'var(--muted)' }}>Payment Method</label>
            <select className="input" value={paymentMethod} onChange={e => setPaymentMethod(e.target.value)} style={{ marginTop: 4 }}>
              <option value="cash">Cash</option>
              <option value="card">Card</option>
              <option value="qris">QRIS</option>
              <option value="e_wallet">E-Wallet</option>
              <option value="split">Split</option>
            </select>
          </div>

          <div style={{ marginTop: 14, padding: 12, background: '#f7f3ee', borderRadius: 9 }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>
              <input type="checkbox" checked={isDeposit} onChange={e => setIsDeposit(e.target.checked)} />
              This is a Down Payment (DP)
            </label>
            {isDeposit && (
              <>
                <label style={{ fontSize: 13, color: 'var(--muted)', marginTop: 10, display: 'block' }}>Amount received now (Rp)</label>
                <input type="number" className="input" value={depositAmount} onChange={e => setDepositAmount(Number(e.target.value) || 0)} style={{ marginTop: 4 }} />
              </>
            )}
          </div>

          <div style={{ marginTop: 16, paddingTop: 14, borderTop: '1.5px solid var(--ink)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, marginBottom: 4 }}>
              <span>Subtotal</span><span>Rp {subtotal.toLocaleString('id-ID')}</span>
            </div>
            {discount > 0 && <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, marginBottom: 4 }}>
              <span>Discount</span><span style={{ color: 'var(--success)' }}>-Rp {discount.toLocaleString('id-ID')}</span>
            </div>}
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, marginBottom: 4 }}>
              <span>Tax ({taxRate}%)</span><span>Rp {taxAmount.toLocaleString('id-ID')}</span>
            </div>
            {tip > 0 && <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, marginBottom: 4 }}>
              <span>Tip</span><span>Rp {Number(tip).toLocaleString('id-ID')}</span>
            </div>}
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 18, fontWeight: 700, marginTop: 8 }}>
              <span>Total</span><span>Rp {total.toLocaleString('id-ID')}</span>
            </div>
            {isDeposit && <>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, marginTop: 8, color: 'var(--success)', fontWeight: 600 }}>
                <span>DP Due Now</span><span>Rp {amountDueNow.toLocaleString('id-ID')}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, color: 'var(--muted)' }}>
                <span>Balance Remaining</span><span>Rp {balanceRemaining.toLocaleString('id-ID')}</span>
              </div>
            </>}
          </div>

          <button className="btn btn-accent" style={{ width: '100%', marginTop: 16 }}
            disabled={cart.length === 0 || saving} onClick={checkout}>
            {saving ? 'Processing...' : isDeposit ? 'Record Down Payment' : 'Complete Sale'}
          </button>
        </div>
      </div>

      {receipt && <ReceiptModal receipt={receipt} settings={settings} onClose={() => setReceipt(null)} />}
    </div>
  )
}

function ReceiptModal({ receipt, settings, onClose }) {
  const subtotal = receipt.items.reduce((s, i) => s + i.price, 0)

  function buildText() {
    const L = []
    L.push(settings?.business_name || 'Nail Salon')
    if (settings?.address) L.push(settings.address)
    if (settings?.phone) L.push(settings.phone)
    L.push(''); L.push('Receipt: ' + receipt.id.slice(0,8).toUpperCase())
    L.push('Date: ' + format(receipt.createdAt, 'MMM d, yyyy h:mm a'))
    L.push('Customer: ' + receipt.customerName)
    L.push('Served by: ' + receipt.cashierName); L.push('')
    receipt.items.forEach(i => L.push(i.name + ' — Rp ' + i.price.toLocaleString('id-ID')))
    L.push('')
    L.push('Subtotal: Rp ' + subtotal.toLocaleString('id-ID'))
    if (receipt.discount_amount > 0) L.push('Discount: -Rp ' + Number(receipt.discount_amount).toLocaleString('id-ID'))
    if (receipt.tax_amount > 0) L.push('Tax: Rp ' + Number(receipt.tax_amount).toLocaleString('id-ID'))
    if (receipt.tip_amount > 0) L.push('Tip: Rp ' + Number(receipt.tip_amount).toLocaleString('id-ID'))
    L.push('Total: Rp ' + Number(receipt.total_amount).toLocaleString('id-ID'))
    if (receipt.is_deposit) {
      L.push(''); L.push('DP Received: Rp ' + Number(receipt.deposit_amount).toLocaleString('id-ID'))
      L.push('Balance Remaining: Rp ' + Number(receipt.balance_due).toLocaleString('id-ID'))
    }
    L.push(''); L.push('Payment: ' + receipt.payment_method.toUpperCase())
    if (settings?.receipt_footer) { L.push(''); L.push(settings.receipt_footer) }
    return L.join('\n')
  }

  function handlePrint() {
    const content = document.getElementById('receipt-area').innerHTML
    const w = window.open('', '', 'width=400,height=700')
    w.document.write('<html><head><title>Receipt</title><style>body{font-family:monospace;font-size:13px;padding:24px;color:#222}h2{text-align:center;font-size:16px}.row{display:flex;justify-content:space-between;margin-bottom:4px}.divider{border-top:1px dashed #999;margin:10px 0}.center{text-align:center}</style></head><body>' + content + '</body></html>')
    w.document.close(); w.focus(); w.print(); w.close()
  }

  function handleWhatsApp() {
    const text = encodeURIComponent(buildText())
    const phone = receipt.customerPhone ? receipt.customerPhone.replace(/\D/g,'') : ''
    window.open(phone ? `https://wa.me/${phone}?text=${text}` : `https://wa.me/?text=${text}`, '_blank')
  }

  function handleEmail() {
    const sub = encodeURIComponent('Receipt from ' + (settings?.business_name || 'Nail Salon'))
    const body = encodeURIComponent(buildText())
    window.open(`mailto:?subject=${sub}&body=${body}`, '_blank')
  }

  return (
    <div style={{ position:'fixed',inset:0,background:'rgba(0,0,0,0.55)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:100 }}>
      <div style={{ width:380,maxHeight:'90vh',display:'flex',flexDirection:'column',gap:12 }}>
        <div id="receipt-area" style={{ background:'white',borderRadius:12,padding:28,overflowY:'auto',fontSize:13,color:'#222',fontFamily:'monospace' }}>
          <div className="center" style={{ textAlign:'center',marginBottom:12 }}>
            <div style={{ fontFamily:'serif',fontSize:18,fontWeight:700 }}>{settings?.business_name || 'Nail Salon'}</div>
            {settings?.address && <div>{settings.address}</div>}
            {settings?.phone && <div>{settings.phone}</div>}
            {settings?.instagram_handle && <div>@{settings.instagram_handle}</div>}
          </div>
          <div style={{ borderTop:'1px dashed #999',borderBottom:'1px dashed #999',padding:'8px 0',marginBottom:10 }}>
            <div>Receipt: {receipt.id.slice(0,8).toUpperCase()}</div>
            <div>Date: {format(receipt.createdAt,'MMM d, yyyy h:mm a')}</div>
            <div>Customer: {receipt.customerName}</div>
            <div>Cashier: {receipt.cashierName}</div>
          </div>
          {receipt.items.map((i,idx) => (
            <div key={idx} style={{ display:'flex',justifyContent:'space-between',marginBottom:4 }}>
              <span>{i.name}</span><span>Rp {i.price.toLocaleString('id-ID')}</span>
            </div>
          ))}
          <div style={{ borderTop:'1px dashed #999',marginTop:8,paddingTop:8 }}>
            <div style={{ display:'flex',justifyContent:'space-between' }}><span>Subtotal</span><span>Rp {subtotal.toLocaleString('id-ID')}</span></div>
            {receipt.discount_amount > 0 && <div style={{ display:'flex',justifyContent:'space-between' }}><span>Discount</span><span>-Rp {Number(receipt.discount_amount).toLocaleString('id-ID')}</span></div>}
            {receipt.tax_amount > 0 && <div style={{ display:'flex',justifyContent:'space-between' }}><span>Tax</span><span>Rp {Number(receipt.tax_amount).toLocaleString('id-ID')}</span></div>}
            {receipt.tip_amount > 0 && <div style={{ display:'flex',justifyContent:'space-between' }}><span>Tip</span><span>Rp {Number(receipt.tip_amount).toLocaleString('id-ID')}</span></div>}
            <div style={{ display:'flex',justifyContent:'space-between',fontWeight:700,marginTop:4 }}><span>TOTAL</span><span>Rp {Number(receipt.total_amount).toLocaleString('id-ID')}</span></div>
          </div>
          {receipt.is_deposit && (
            <div style={{ borderTop:'1px dashed #999',marginTop:8,paddingTop:8 }}>
              <div style={{ display:'flex',justifyContent:'space-between',fontWeight:700 }}><span>DP Received</span><span>Rp {Number(receipt.deposit_amount).toLocaleString('id-ID')}</span></div>
              <div style={{ display:'flex',justifyContent:'space-between' }}><span>Balance Due</span><span>Rp {Number(receipt.balance_due).toLocaleString('id-ID')}</span></div>
            </div>
          )}
          <div style={{ marginTop:10,textAlign:'center' }}>Payment: {receipt.payment_method.toUpperCase()}</div>
          {settings?.receipt_footer && <div style={{ marginTop:14,textAlign:'center',fontSize:12,borderTop:'1px dashed #999',paddingTop:10 }}>{settings.receipt_footer}</div>}
        </div>
        <div style={{ display:'flex',gap:8,flexWrap:'wrap' }}>
          <button className="btn btn-accent" style={{ flex:1 }} onClick={handlePrint}>🖨 Print</button>
          <button className="btn btn-ghost" style={{ flex:1,background:'#25d366',color:'white',border:'none' }} onClick={handleWhatsApp}>WhatsApp</button>
          <button className="btn btn-ghost" style={{ flex:1,background:'white' }} onClick={handleEmail}>Email</button>
          <button className="btn btn-ghost" style={{ width:'100%',background:'white' }} onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  )
}

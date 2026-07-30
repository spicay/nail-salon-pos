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
    const existing = cart.findIndex(c => c.id === svc.id)
    if (existing >= 0) {
      setCart(c => c.map((item, i) => i === existing ? { ...item, qty: item.qty + 1 } : item))
    } else {
      setCart(c => [...c, {
        id: svc.id, name: svc.name, unitPrice: Number(svc.price),
        qty: 1, technician_id: staffList[0]?.id || ''
      }])
    }
  }

  function updateQty(idx, delta) {
    setCart(c => c.map((item, i) => {
      if (i !== idx) return item
      const newQty = item.qty + delta
      return newQty <= 0 ? null : { ...item, qty: newQty }
    }).filter(Boolean))
  }

  function updateTechnician(idx, technician_id) {
    setCart(c => c.map((item, i) => i === idx ? { ...item, technician_id } : item))
  }

  function removeCartItem(idx) {
    setCart(c => c.filter((_, i) => i !== idx))
  }

  const subtotal = cart.reduce((sum, item) => sum + item.unitPrice * item.qty, 0)
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

      const serviceRows = cart.flatMap(c =>
        Array.from({ length: c.qty }, () => ({
          transaction_id: txn.id,
          service_id: c.id,
          technician_id: c.technician_id || null,
          price: c.unitPrice,
          tip_amount: 0
        }))
      )
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
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 400px', gap: 20, alignItems: 'start' }}>
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
          {services.length === 0 && <p style={{ color: 'var(--muted)' }}>No services yet. Add them under <strong>Services</strong> in the sidebar.</p>}
        </div>

        <div className="card" style={{ position: 'sticky', top: 0 }}>
          <h3 style={{ marginBottom: 14 }}>Current Order</h3>
          <select className="input" value={customerId} onChange={e => setCustomerId(e.target.value)} style={{ marginBottom: 12 }}>
            <option value="">Walk-in (no customer)</option>
            {customers.map(c => <option key={c.id} value={c.id}>{c.full_name}</option>)}
          </select>

          {cart.length === 0 && <p style={{ color: 'var(--muted)', fontSize: 14 }}>No items yet. Tap a service to add it.</p>}

          {cart.map((item, idx) => (
            <div key={idx} style={{ marginBottom: 14, paddingBottom: 14, borderBottom: '1px solid var(--line)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
                <span style={{ fontSize: 14, fontWeight: 600 }}>{item.name}</span>
                <button onClick={() => removeCartItem(idx)} style={{ color: 'var(--danger)', fontSize: 12, marginLeft: 8 }}>Remove</button>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                <button onClick={() => updateQty(idx, -1)} style={{ width: 30, height: 30, borderRadius: 6, border: '1.5px solid var(--line)', background: 'white', fontSize: 16, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>−</button>
                <span style={{ fontWeight: 700, fontSize: 15, minWidth: 24, textAlign: 'center' }}>{item.qty}</span>
                <button onClick={() => updateQty(idx, 1)} style={{ width: 30, height: 30, borderRadius: 6, border: '1.5px solid var(--line)', background: 'white', fontSize: 16, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>+</button>
                <span style={{ fontSize: 12, color: 'var(--muted)', marginLeft: 4 }}>× Rp {item.unitPrice.toLocaleString('id-ID')}</span>
                <span style={{ fontWeight: 700, marginLeft: 'auto' }}>Rp {(item.unitPrice * item.qty).toLocaleString('id-ID')}</span>
              </div>
              <select value={item.technician_id} onChange={e => updateTechnician(idx, e.target.value)} className="input" style={{ fontSize: 13, padding: '7px 10px' }}>
                <option value="">No technician</option>
                {staffList.map(s => <option key={s.id} value={s.id}>{s.full_name}</option>)}
              </select>
            </div>
          ))}

          <div style={{ marginTop: 8 }}>
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
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, marginBottom: 4 }}><span>Subtotal</span><span>Rp {subtotal.toLocaleString('id-ID')}</span></div>
            {discount > 0 && <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, marginBottom: 4 }}><span>Discount</span><span style={{ color: 'var(--success)' }}>-Rp {discount.toLocaleString('id-ID')}</span></div>}
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, marginBottom: 4 }}><span>Tax ({taxRate}%)</span><span>Rp {taxAmount.toLocaleString('id-ID')}</span></div>
            {tip > 0 && <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, marginBottom: 4 }}><span>Tip</span><span>Rp {Number(tip).toLocaleString('id-ID')}</span></div>}
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 18, fontWeight: 700, marginTop: 8 }}><span>Total</span><span>Rp {total.toLocaleString('id-ID')}</span></div>
            {isDeposit && <>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, marginTop: 8, color: 'var(--success)', fontWeight: 600 }}><span>DP Due Now</span><span>Rp {amountDueNow.toLocaleString('id-ID')}</span></div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, color: 'var(--muted)' }}><span>Balance Remaining</span><span>Rp {balanceRemaining.toLocaleString('id-ID')}</span></div>
            </>}
          </div>

          <button className="btn btn-accent" style={{ width: '100%', marginTop: 16 }} disabled={cart.length === 0 || saving} onClick={checkout}>
            {saving ? 'Processing...' : isDeposit ? 'Record Down Payment' : 'Complete Sale'}
          </button>
        </div>
      </div>

      {receipt && <ReceiptModal receipt={receipt} settings={settings} onClose={() => setReceipt(null)} />}
    </div>
  )
}

// Loads html2canvas from CDN once, caches on window
function loadHtml2Canvas() {
  return new Promise((resolve, reject) => {
    if (window.html2canvas) { resolve(window.html2canvas); return }
    const script = document.createElement('script')
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js'
    script.onload = () => resolve(window.html2canvas)
    script.onerror = reject
    document.head.appendChild(script)
  })
}

function ReceiptModal({ receipt, settings, onClose }) {
  const subtotal = receipt.items.reduce((s, i) => s + i.unitPrice * i.qty, 0)
  const [sharing, setSharing] = useState(false)
  const RECEIPT_WIDTH = 210

  // Capture the receipt div as a PNG blob
  async function captureReceiptImage() {
    const html2canvas = await loadHtml2Canvas()
    const el = document.getElementById('thermal-receipt')
    const canvas = await html2canvas(el, {
      scale: 3,           // 3x for crisp thermal-print quality
      backgroundColor: '#ffffff',
      useCORS: true,
      logging: false,
    })
    return new Promise(resolve => canvas.toBlob(resolve, 'image/png'))
  }

  // Share receipt image via iOS share sheet (WhatsApp, Email, Save, etc.)
  async function handleShareImage() {
    setSharing(true)
    try {
      const blob = await captureReceiptImage()
      const file = new File([blob], `receipt-${receipt.id.slice(0,8)}.png`, { type: 'image/png' })

      if (navigator.share && navigator.canShare({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: `Nota ${settings?.business_name || 'Nail Salon'}`,
          text: `Nota untuk ${receipt.customerName}`,
        })
      } else {
        // Fallback for non-iOS: download the image
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `receipt-${receipt.id.slice(0,8)}.png`
        a.click()
        URL.revokeObjectURL(url)
      }
    } catch (e) {
      if (e.name !== 'AbortError') alert('Could not share: ' + e.message)
    }
    setSharing(false)
  }

  // Save to camera roll / downloads
  async function handleSaveImage() {
    setSharing(true)
    try {
      const blob = await captureReceiptImage()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `receipt-${receipt.id.slice(0,8)}.png`
      a.click()
      URL.revokeObjectURL(url)
    } catch(e) {
      alert('Could not save image: ' + e.message)
    }
    setSharing(false)
  }

  // WhatsApp with text only (quick fallback)
  function buildText() {
    const L = []
    L.push('*' + (settings?.business_name || 'Nail Salon') + '*')
    if (settings?.address) L.push(settings.address)
    if (settings?.phone) L.push(settings.phone)
    L.push(''); L.push('No: ' + receipt.id.slice(0,8).toUpperCase())
    L.push('Tgl: ' + format(receipt.createdAt, 'dd/MM/yyyy HH:mm'))
    L.push('Pelanggan: ' + receipt.customerName); L.push('')
    receipt.items.forEach(i => {
      L.push(i.name)
      L.push('  ' + i.qty + ' x Rp ' + i.unitPrice.toLocaleString('id-ID') + ' = Rp ' + (i.unitPrice * i.qty).toLocaleString('id-ID'))
    })
    L.push('')
    L.push('Subtotal: Rp ' + subtotal.toLocaleString('id-ID'))
    if (receipt.discount_amount > 0) L.push('Diskon: -Rp ' + Number(receipt.discount_amount).toLocaleString('id-ID'))
    if (receipt.tax_amount > 0) L.push('Pajak: Rp ' + Number(receipt.tax_amount).toLocaleString('id-ID'))
    if (receipt.tip_amount > 0) L.push('Tip: Rp ' + Number(receipt.tip_amount).toLocaleString('id-ID'))
    L.push('*TOTAL: Rp ' + Number(receipt.total_amount).toLocaleString('id-ID') + '*')
    if (receipt.is_deposit) {
      L.push(''); L.push('*DP Diterima: Rp ' + Number(receipt.deposit_amount).toLocaleString('id-ID') + '*')
      L.push('Sisa: Rp ' + Number(receipt.balance_due).toLocaleString('id-ID'))
    }
    L.push(''); L.push('Bayar: ' + receipt.payment_method.toUpperCase())
    if (settings?.receipt_footer) { L.push(''); L.push(settings.receipt_footer) }
    return L.join('\n')
  }

  function handleWhatsAppText() {
    const text = encodeURIComponent(buildText())
    const phone = receipt.customerPhone ? receipt.customerPhone.replace(/\D/g,'') : ''
    window.open(phone ? `https://wa.me/${phone}?text=${text}` : `https://wa.me/?text=${text}`, '_blank')
  }

  const receiptEl = (
    <div id="thermal-receipt" style={{
      width: RECEIPT_WIDTH,
      fontFamily: "'Courier New', Courier, monospace",
      fontSize: 11,
      color: '#111',
      background: 'white',
      padding: '10px 6px',
      lineHeight: 1.55,
    }}>
      <div style={{ textAlign:'center', marginBottom:6 }}>
        <div style={{ fontWeight:700, fontSize:14 }}>{settings?.business_name || 'Nail Salon'}</div>
        {settings?.address && <div style={{ fontSize:10 }}>{settings.address}</div>}
        {settings?.phone && <div style={{ fontSize:10 }}>{settings.phone}</div>}
        {settings?.instagram_handle && <div style={{ fontSize:10 }}>@{settings.instagram_handle}</div>}
        {settings?.receipt_header && <div style={{ fontSize:10, marginTop:3 }}>{settings.receipt_header}</div>}
      </div>
      <div style={{ borderTop:'1px dashed #000', margin:'4px 0' }} />
      <div style={{ fontSize:10, marginBottom:4 }}>
        <div>No : {receipt.id.slice(0,8).toUpperCase()}</div>
        <div>Tgl: {format(receipt.createdAt, 'dd/MM/yy HH:mm')}</div>
        <div>Cst: {receipt.customerName}</div>
        <div>Kas: {receipt.cashierName}</div>
      </div>
      <div style={{ borderTop:'1px dashed #000', margin:'4px 0' }} />
      {receipt.items.map((item, idx) => (
        <div key={idx} style={{ marginBottom:5 }}>
          <div style={{ fontWeight:600, fontSize:11 }}>{item.name}</div>
          <div style={{ display:'flex', justifyContent:'space-between', fontSize:11 }}>
            <span style={{ color:'#555' }}>{item.qty} x Rp {item.unitPrice.toLocaleString('id-ID')}</span>
            <span>Rp {(item.unitPrice * item.qty).toLocaleString('id-ID')}</span>
          </div>
        </div>
      ))}
      <div style={{ borderTop:'1px dashed #000', margin:'4px 0' }} />
      <div style={{ display:'flex', justifyContent:'space-between', fontSize:11, marginBottom:2 }}><span>Subtotal</span><span>Rp {subtotal.toLocaleString('id-ID')}</span></div>
      {receipt.discount_amount > 0 && <div style={{ display:'flex', justifyContent:'space-between', fontSize:11, marginBottom:2 }}><span>Diskon</span><span>-Rp {Number(receipt.discount_amount).toLocaleString('id-ID')}</span></div>}
      {receipt.tax_amount > 0 && <div style={{ display:'flex', justifyContent:'space-between', fontSize:11, marginBottom:2 }}><span>Pajak</span><span>Rp {Number(receipt.tax_amount).toLocaleString('id-ID')}</span></div>}
      {receipt.tip_amount > 0 && <div style={{ display:'flex', justifyContent:'space-between', fontSize:11, marginBottom:2 }}><span>Tip</span><span>Rp {Number(receipt.tip_amount).toLocaleString('id-ID')}</span></div>}
      <div style={{ display:'flex', justifyContent:'space-between', fontWeight:700, fontSize:13, marginTop:4, paddingTop:4, borderTop:'1px solid #000' }}>
        <span>TOTAL</span><span>Rp {Number(receipt.total_amount).toLocaleString('id-ID')}</span>
      </div>
      {receipt.is_deposit && <>
        <div style={{ borderTop:'1px dashed #000', margin:'4px 0' }} />
        <div style={{ display:'flex', justifyContent:'space-between', fontWeight:700, fontSize:11, marginBottom:2 }}><span>DP Diterima</span><span>Rp {Number(receipt.deposit_amount).toLocaleString('id-ID')}</span></div>
        <div style={{ display:'flex', justifyContent:'space-between', fontSize:11 }}><span>Sisa Bayar</span><span>Rp {Number(receipt.balance_due).toLocaleString('id-ID')}</span></div>
        {settings?.bank_account_info && <div style={{ fontSize:9, marginTop:3, color:'#444' }}>{settings.bank_account_info}</div>}
      </>}
      <div style={{ borderTop:'1px dashed #000', margin:'4px 0' }} />
      <div style={{ textAlign:'center', fontSize:10 }}>
        <div>Bayar: {receipt.payment_method.toUpperCase()}</div>
        {settings?.receipt_footer && <div style={{ marginTop:3 }}>{settings.receipt_footer}</div>}
        <div style={{ marginTop:5, fontWeight:600 }}>*** Terima Kasih ***</div>
      </div>
    </div>
  )

  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.65)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:100, padding:16 }}>
      <div style={{ display:'flex', flexDirection:'column', gap:10, alignItems:'center', maxHeight:'90vh', overflowY:'auto' }}>

        {/* Receipt preview */}
        <div style={{ background:'white', borderRadius:10, padding:8, boxShadow:'0 4px 32px rgba(0,0,0,0.4)' }}>
          {receiptEl}
        </div>

        {/* Primary action: Share as image (opens iOS share sheet → WhatsApp, Email, Save, Print) */}
        <button
          onClick={handleShareImage}
          disabled={sharing}
          style={{
            width: RECEIPT_WIDTH + 16,
            padding: '14px',
            background: 'var(--rose)',
            color: 'white',
            border: 'none',
            borderRadius: 10,
            fontWeight: 700,
            fontSize: 15,
            cursor: 'pointer',
            opacity: sharing ? 0.7 : 1,
          }}>
          {sharing ? 'Preparing...' : '📤 Share Receipt Image'}
        </button>

        <div style={{ fontSize: 11, color: '#ddd', textAlign: 'center', width: RECEIPT_WIDTH + 16 }}>
          Tap to share via WhatsApp, Email, or save to Photos
        </div>

        {/* Secondary actions */}
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8, width: RECEIPT_WIDTH + 16 }}>
          <button
            onClick={handleSaveImage}
            disabled={sharing}
            style={{ background:'white', border:'none', borderRadius:9, fontWeight:600, fontSize:13, padding:'11px 8px', cursor:'pointer' }}>
            💾 Save Image
          </button>
          <button
            onClick={handleWhatsAppText}
            style={{ background:'#25d366', color:'white', border:'none', borderRadius:9, fontWeight:600, fontSize:13, padding:'11px 8px', cursor:'pointer' }}>
            💬 WA Text Only
          </button>
        </div>

        <button
          onClick={onClose}
          style={{ width: RECEIPT_WIDTH + 16, padding:'11px', background:'rgba(255,255,255,0.15)', color:'white', border:'none', borderRadius:9, fontWeight:600, fontSize:13, cursor:'pointer' }}>
          Close
        </button>
      </div>
    </div>
  )
}

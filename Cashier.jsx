import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import { useStaff } from '../lib/StaffContext'

export default function Cashier() {
  const { staff } = useStaff()
  const [services, setServices] = useState([])
  const [products, setProducts] = useState([])
  const [staffList, setStaffList] = useState([])
  const [customers, setCustomers] = useState([])
  const [tab, setTab] = useState('services')

  const [cart, setCart] = useState([]) // {type, id, name, price, qty, technician_id}
  const [customerId, setCustomerId] = useState('')
  const [discount, setDiscount] = useState(0)
  const [taxRate, setTaxRate] = useState(0)
  const [tip, setTip] = useState(0)
  const [paymentMethod, setPaymentMethod] = useState('cash')
  const [saving, setSaving] = useState(false)
  const [doneMsg, setDoneMsg] = useState('')

  useEffect(() => {
    loadAll()
  }, [])

  async function loadAll() {
    const [s, p, st, c, settings] = await Promise.all([
      supabase.from('services').select('*').eq('active', true).order('category'),
      supabase.from('products').select('*').eq('active', true).order('name'),
      supabase.from('staff').select('*').eq('active', true).order('full_name'),
      supabase.from('customers').select('*').order('full_name'),
      supabase.from('business_settings').select('*').single(),
    ])
    setServices(s.data || [])
    setProducts(p.data || [])
    setStaffList(st.data || [])
    setCustomers(c.data || [])
    if (settings.data) setTaxRate(Number(settings.data.tax_rate) || 0)
  }

  function addService(svc) {
    setCart(c => [...c, {
      type: 'service', id: svc.id, name: svc.name, price: Number(svc.price),
      qty: 1, technician_id: staffList[0]?.id || ''
    }])
  }

  function addProduct(p) {
    const existing = cart.find(c => c.type === 'product' && c.id === p.id)
    if (existing) {
      setCart(c => c.map(x => x === existing ? { ...x, qty: x.qty + 1 } : x))
    } else {
      setCart(c => [...c, { type: 'product', id: p.id, name: p.name, price: Number(p.retail_price), qty: 1 }])
    }
  }

  function updateCartItem(idx, patch) {
    setCart(c => c.map((item, i) => i === idx ? { ...item, ...patch } : item))
  }

  function removeCartItem(idx) {
    setCart(c => c.filter((_, i) => i !== idx))
  }

  const subtotal = cart.reduce((sum, item) => sum + item.price * item.qty, 0)
  const taxAmount = (subtotal - discount) * (taxRate / 100)
  const total = subtotal - discount + taxAmount + Number(tip || 0)

  async function checkout() {
    if (cart.length === 0) return
    setSaving(true)
    try {
      const { data: txn, error: txnError } = await supabase.from('transactions').insert({
        customer_id: customerId || null,
        cashier_id: staff?.id,
        subtotal, discount_amount: discount, tax_amount: taxAmount,
        tip_amount: tip || 0, total_amount: total,
        payment_method: paymentMethod,
      }).select().single()
      if (txnError) throw txnError

      const serviceRows = cart.filter(c => c.type === 'service').map(c => ({
        transaction_id: txn.id, service_id: c.id, technician_id: c.technician_id || null,
        price: c.price, tip_amount: 0
      }))
      const productRows = cart.filter(c => c.type === 'product').map(c => ({
        transaction_id: txn.id, product_id: c.id, quantity: c.qty, price: c.price
      }))

      if (serviceRows.length) {
        const { error } = await supabase.from('transaction_services').insert(serviceRows)
        if (error) throw error
      }
      if (productRows.length) {
        const { error } = await supabase.from('transaction_products').insert(productRows)
        if (error) throw error
        // deduct stock
        for (const p of cart.filter(c => c.type === 'product')) {
          const prod = products.find(x => x.id === p.id)
          if (prod) {
            await supabase.from('products').update({
              stock_quantity: Math.max(0, Number(prod.stock_quantity) - p.qty)
            }).eq('id', p.id)
          }
        }
      }

      setDoneMsg(`Transaction complete — total Rp ${total.toLocaleString('id-ID')}`)
      setCart([]); setCustomerId(''); setDiscount(0); setTip(0)
      loadAll()
      setTimeout(() => setDoneMsg(''), 4000)
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
      <div className="page-header">
        <h1>Cashier</h1>
        {doneMsg && <span className="badge badge-completed">{doneMsg}</span>}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 380px', gap: 20, alignItems: 'start' }}>
        {/* Left: item picker */}
        <div className="card">
          <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
            <button className={tab === 'services' ? 'btn btn-primary' : 'btn btn-ghost'} onClick={() => setTab('services')}>Services</button>
            <button className={tab === 'products' ? 'btn btn-primary' : 'btn btn-ghost'} onClick={() => setTab('products')}>Products</button>
          </div>

          {tab === 'services' && Object.entries(grouped).map(([cat, list]) => (
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

          {tab === 'products' && (
            <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))' }}>
              {products.map(p => (
                <button key={p.id} onClick={() => addProduct(p)} className="card" style={{ textAlign: 'left', padding: 14 }}>
                  <div style={{ fontWeight: 600, fontSize: 14.5 }}>{p.name}</div>
                  <div style={{ color: 'var(--rose)', fontWeight: 600, marginTop: 4 }}>Rp {Number(p.retail_price).toLocaleString('id-ID')}</div>
                  <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>Stock: {p.stock_quantity}</div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Right: cart / checkout */}
        <div className="card" style={{ position: 'sticky', top: 0 }}>
          <h3 style={{ marginBottom: 14 }}>Current Order</h3>

          <select className="input" value={customerId} onChange={e => setCustomerId(e.target.value)} style={{ marginBottom: 12 }}>
            <option value="">Walk-in (no customer)</option>
            {customers.map(c => <option key={c.id} value={c.id}>{c.full_name}</option>)}
          </select>

          {cart.length === 0 && <p style={{ color: 'var(--muted)', fontSize: 14 }}>No items yet. Tap a service or product to add it.</p>}

          {cart.map((item, idx) => (
            <div key={idx} style={{ marginBottom: 12, paddingBottom: 12, borderBottom: '1px solid var(--line)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ fontSize: 14, fontWeight: 600 }}>{item.name}</span>
                <button onClick={() => removeCartItem(idx)} style={{ color: 'var(--danger)', fontSize: 13 }}>Remove</button>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 6 }}>
                {item.type === 'product' ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <button className="btn btn-ghost" style={{ minHeight: 32, padding: '4px 10px' }} onClick={() => updateCartItem(idx, { qty: Math.max(1, item.qty - 1) })}>−</button>
                    <span>{item.qty}</span>
                    <button className="btn btn-ghost" style={{ minHeight: 32, padding: '4px 10px' }} onClick={() => updateCartItem(idx, { qty: item.qty + 1 })}>+</button>
                  </div>
                ) : (
                  <select value={item.technician_id} onChange={e => updateCartItem(idx, { technician_id: e.target.value })}
                    className="input" style={{ fontSize: 13, padding: '8px 10px', width: 160 }}>
                    {staffList.map(s => <option key={s.id} value={s.id}>{s.full_name}</option>)}
                  </select>
                )}
                <span style={{ fontWeight: 600 }}>Rp {(item.price * item.qty).toLocaleString('id-ID')}</span>
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
              <option value="e_wallet">E-Wallet</option>
              <option value="split">Split</option>
            </select>
          </div>

          <div style={{ marginTop: 16, paddingTop: 14, borderTop: '1.5px solid var(--ink)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, marginBottom: 4 }}>
              <span>Subtotal</span><span>Rp {subtotal.toLocaleString('id-ID')}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, marginBottom: 4 }}>
              <span>Tax ({taxRate}%)</span><span>Rp {taxAmount.toLocaleString('id-ID')}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 18, fontWeight: 700, marginTop: 8 }}>
              <span>Total</span><span>Rp {total.toLocaleString('id-ID')}</span>
            </div>
          </div>

          <button className="btn btn-accent" style={{ width: '100%', marginTop: 16 }} disabled={cart.length === 0 || saving} onClick={checkout}>
            {saving ? 'Processing...' : 'Complete Sale'}
          </button>
        </div>
      </div>
    </div>
  )
}

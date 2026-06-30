import { useState } from 'react'
import { useStaff } from '../lib/StaffContext'

export default function Login() {
  const { loginWithPin } = useStaff()
  const [pin, setPin] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  function press(digit) {
    if (pin.length >= 6) return
    setError('')
    setPin(pin + digit)
  }

  function backspace() {
    setError('')
    setPin(pin.slice(0, -1))
  }

  async function submit() {
    if (!pin) return
    setLoading(true)
    const res = await loginWithPin(pin)
    setLoading(false)
    if (!res.success) {
      setError(res.message)
      setPin('')
    }
  }

  return (
    <div style={{
      height: '100dvh', display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center', background: 'var(--ink)', color: 'var(--paper)'
    }}>
      <h1 style={{ fontSize: 30, marginBottom: 6 }}>Nail Salon POS</h1>
      <p style={{ color: '#a89fb0', marginBottom: 32 }}>Enter your PIN to continue</p>

      <div style={{ display: 'flex', gap: 12, marginBottom: 18 }}>
        {[0,1,2,3,4,5].map(i => (
          <div key={i} style={{
            width: 16, height: 16, borderRadius: '50%',
            border: '2px solid var(--rose)',
            background: i < pin.length ? 'var(--rose)' : 'transparent'
          }} />
        ))}
      </div>

      {error && <p style={{ color: '#e08585', marginBottom: 12, fontSize: 14 }}>{error}</p>}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 76px)', gap: 14, marginTop: 8 }}>
        {[1,2,3,4,5,6,7,8,9].map(n => (
          <button key={n} onClick={() => press(String(n))} className="btn" style={{
            background: 'rgba(255,255,255,0.08)', color: 'white', fontSize: 22, height: 76, borderRadius: '50%'
          }}>{n}</button>
        ))}
        <button onClick={backspace} className="btn" style={{
          background: 'transparent', color: '#a89fb0', fontSize: 14
        }}>Clear</button>
        <button onClick={() => press('0')} className="btn" style={{
          background: 'rgba(255,255,255,0.08)', color: 'white', fontSize: 22, height: 76, borderRadius: '50%'
        }}>0</button>
        <button onClick={submit} disabled={loading} className="btn btn-accent" style={{ height: 76, borderRadius: '50%', fontSize: 14 }}>
          {loading ? '...' : 'Go'}
        </button>
      </div>
    </div>
  )
}

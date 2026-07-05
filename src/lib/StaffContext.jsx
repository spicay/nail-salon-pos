import { createContext, useContext, useEffect, useState } from 'react'
import { supabase, ensureDeviceSession } from './supabaseClient'

const StaffContext = createContext(null)

export function StaffProvider({ children }) {
  const [staff, setStaff] = useState(null)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    (async () => {
      await ensureDeviceSession()
      const saved = localStorage.getItem('active_staff')
      if (saved) {
        try { setStaff(JSON.parse(saved)) } catch (e) { /* ignore */ }
      }
      setReady(true)
    })()
  }, [])

  async function loginWithPin(pin) {
    await ensureDeviceSession()

    // Use limit(1) instead of maybeSingle() so duplicate PINs don't cause an error.
    const { data, error } = await supabase
      .from('staff')
      .select('*')
      .eq('pin_code', pin)
      .eq('active', true)
      .limit(1)

    if (error || !data || data.length === 0) {
      return { success: false, message: 'Invalid PIN. Please try again.' }
    }
    const member = data[0]
    setStaff(member)
    localStorage.setItem('active_staff', JSON.stringify(member))
    return { success: true }
  }

  function logout() {
    setStaff(null)
    localStorage.removeItem('active_staff')
  }

  return (
    <StaffContext.Provider value={{ staff, ready, loginWithPin, logout }}>
      {children}
    </StaffContext.Provider>
  )
}

export function useStaff() {
  return useContext(StaffContext)
}

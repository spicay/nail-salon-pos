import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// Ensures the iPad device has an anonymous Supabase session so RLS policies pass.
// Staff identity (who is using the app) is tracked separately via PIN login,
// stored in localStorage as the "active staff" for the session.
export async function ensureDeviceSession() {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) {
    const { error } = await supabase.auth.signInAnonymously()
    if (error) console.error('Device session error:', error)
  }
}

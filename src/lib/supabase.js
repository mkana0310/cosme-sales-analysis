import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

export function getCurrentPeriod() {
  const now = new Date()
  const year = now.getFullYear()
  const month = now.getMonth() + 1
  const week = Math.ceil(now.getDate() / 7)
  return { year, month, week }
}

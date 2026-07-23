import { createClient } from '@supabase/supabase-js'

// Vite inyecta las variables de entorno usando import.meta.env
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error("Faltan las variables de entorno de Supabase. Revisa tu archivo .env.local")
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey)
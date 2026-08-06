import { createClient } from '@supabase/supabase-js'

// Public anon client for reading the shared menu from the browser.
// The anon key is safe to ship — reads are allowed by RLS, writes are not.
// Values come from Vite env vars (set in Vercel + .env.local).
const url = import.meta.env.VITE_SUPABASE_URL
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

export const supabase = url && anonKey ? createClient(url, anonKey) : null

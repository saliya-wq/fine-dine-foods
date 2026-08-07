import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from './supabaseClient.js'
import { DEFAULT_BRAND, deriveBrand } from './brand.js'

const CACHE_KEY = 'calista_brand_cache_v1'
const ADMIN_PW_KEY = 'calista_admin_pw'
const BrandCtx = createContext(null)

async function apiSave(data) {
  const pw = (typeof sessionStorage !== 'undefined' && sessionStorage.getItem(ADMIN_PW_KEY)) || ''
  const res = await fetch('/api/settings', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-admin-password': pw },
    body: JSON.stringify({ action: 'saveBrand', data })
  })
  const d = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(d.error || `Request failed (${res.status})`)
  return d
}

export function BrandProvider({ children }) {
  const [raw, setRaw] = useState(() => {
    try {
      const c = localStorage.getItem(CACHE_KEY)
      if (c) return { ...DEFAULT_BRAND, ...JSON.parse(c) }
    } catch {}
    return DEFAULT_BRAND
  })

  useEffect(() => {
    let alive = true
    async function load() {
      if (!supabase) return
      const { data, error } = await supabase
        .from('site_settings')
        .select('data')
        .eq('id', 'brand')
        .maybeSingle()
      if (!alive || error || !data) return
      const next = { ...DEFAULT_BRAND, ...(data.data || {}) }
      setRaw(next)
      try {
        localStorage.setItem(CACHE_KEY, JSON.stringify(next))
      } catch {}
    }
    load()
    return () => {
      alive = false
    }
  }, [])

  const saveBrand = async (patch) => {
    const next = { ...raw, ...patch }
    await apiSave(next)
    setRaw(next)
    try {
      localStorage.setItem(CACHE_KEY, JSON.stringify(next))
    } catch {}
  }

  return (
    <BrandCtx.Provider value={{ brand: deriveBrand(raw), raw, saveBrand }}>
      {children}
    </BrandCtx.Provider>
  )
}

export const useBrand = () => useContext(BrandCtx).brand
export const useBrandStore = () => useContext(BrandCtx)

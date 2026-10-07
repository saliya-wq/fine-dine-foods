import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from './supabaseClient.js'
import { DEFAULT_BRAND, deriveBrand } from './brand.js'
import { staffPost } from './staffSession.jsx'

const CACHE_KEY = 'calista_brand_cache_v1'
const BrandCtx = createContext(null)

// Business details are sysadmin-only, so the save rides on the staff key.
const apiSave = (data) => staffPost('/api/settings', { action: 'saveBrand', data })

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

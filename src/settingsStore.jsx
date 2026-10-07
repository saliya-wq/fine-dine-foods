import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from './supabaseClient.js'
import { staffPost } from './staffSession.jsx'
import { DEFAULT_TIERS, DEFAULT_ORDERING as DEFAULTS } from './pricing.js'

// Existing imports of these from the store keep working.
export { DEFAULT_TIERS, getTier, computeOrderTotals, calcServiceCharge } from './pricing.js'

// Cache of the last DB read, so prices render right on a cold or offline
// start. A new key on purpose: the old calista_settings_v1 held device-local
// edits that never reached anyone else, and must not override the DB value.
const CACHE_KEY = 'calista_settings_cache_v2'

// Tolerates a missing or partial row; the server validates on save.
const clean = (d) => ({
  serviceChargePercent: Number.isFinite(Number(d?.serviceChargePercent))
    ? Number(d.serviceChargePercent)
    : DEFAULTS.serviceChargePercent,
  loyaltyTiers: Array.isArray(d?.loyaltyTiers) && d.loyaltyTiers.length ? d.loyaltyTiers : DEFAULT_TIERS
})

const SettingsCtx = createContext(null)

export function SettingsProvider({ children }) {
  const [settings, setSettings] = useState(() => {
    try {
      const raw = localStorage.getItem(CACHE_KEY)
      if (raw) return clean(JSON.parse(raw))
    } catch {}
    return DEFAULTS
  })

  const remember = (next) => {
    setSettings(next)
    try {
      localStorage.setItem(CACHE_KEY, JSON.stringify(next))
    } catch {}
  }

  useEffect(() => {
    let alive = true
    async function load() {
      if (!supabase) return
      const { data, error } = await supabase
        .from('site_settings')
        .select('data')
        .eq('id', 'ordering')
        .maybeSingle()
      if (!alive || error) return
      // No row yet means nobody has saved: the defaults are the live values.
      remember(data ? clean(data.data) : DEFAULTS)
    }
    load()
    return () => {
      alive = false
    }
  }, [])

  // Sysadmin-only; the API re-validates and returns what it stored.
  const save = async (patch) => {
    const res = await staffPost('/api/settings', {
      action: 'saveOrdering',
      data: { ...settings, ...patch }
    })
    remember(clean(res.data))
  }

  return <SettingsCtx.Provider value={{ ...settings, save }}>{children}</SettingsCtx.Provider>
}

export const useSettings = () => useContext(SettingsCtx)


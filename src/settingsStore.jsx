import { createContext, useContext, useEffect, useState } from 'react'

const STORAGE_KEY = 'calista_settings_v1'

const DEFAULT_TIERS = [
  { name: 'New', minVisits: 0, discountPercent: 0 },
  { name: 'Returning', minVisits: 1, discountPercent: 5 },
  { name: 'Regular', minVisits: 5, discountPercent: 10 },
  { name: 'VIP', minVisits: 15, discountPercent: 15 }
]

const DEFAULTS = {
  serviceChargePercent: 15,
  loyaltyTiers: DEFAULT_TIERS
}

const SettingsCtx = createContext(null)

export function SettingsProvider({ children }) {
  const [settings, setSettings] = useState(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (raw) return { ...DEFAULTS, ...JSON.parse(raw) }
    } catch {}
    return DEFAULTS
  })

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(settings))
    } catch (e) {
      console.warn('Settings: localStorage save failed', e)
    }
  }, [settings])

  const update = (patch) => setSettings((s) => ({ ...s, ...patch }))
  const reset = () => setSettings(DEFAULTS)
  const resetTiers = () => setSettings((s) => ({ ...s, loyaltyTiers: DEFAULT_TIERS }))

  return (
    <SettingsCtx.Provider value={{ ...settings, update, reset, resetTiers }}>
      {children}
    </SettingsCtx.Provider>
  )
}

export const useSettings = () => useContext(SettingsCtx)

export const calcServiceCharge = (subtotal, percent) =>
  ((Number(subtotal) || 0) * (Number(percent) || 0)) / 100

export const getTier = (visits, tiers) => {
  const sorted = [...(tiers || DEFAULT_TIERS)].sort((a, b) => b.minVisits - a.minVisits)
  for (const t of sorted) {
    if (visits >= t.minVisits) return t
  }
  return sorted[sorted.length - 1] || { name: 'New', minVisits: 0, discountPercent: 0 }
}

export const computeOrderTotals = ({
  subtotal = 0,
  serviceChargePercent = 0,
  discountPercent = 0,
  deliveryFee = 0
}) => {
  const sub = Number(subtotal) || 0
  const dp = Number(discountPercent) || 0
  const sp = Number(serviceChargePercent) || 0
  const fee = Number(deliveryFee) || 0
  const discountAmount = (sub * dp) / 100
  const discountedSubtotal = sub - discountAmount
  const serviceCharge = (discountedSubtotal * sp) / 100
  const total = discountedSubtotal + serviceCharge + fee
  return {
    subtotal: sub,
    discountAmount,
    discountPercent: dp,
    serviceCharge,
    serviceChargePercent: sp,
    deliveryFee: fee,
    total
  }
}

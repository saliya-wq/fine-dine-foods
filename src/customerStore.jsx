import { createContext, useContext, useEffect, useState } from 'react'

const DB_KEY = 'calista_customers_v1'
const SESSION_KEY = 'calista_active_customer'

export const normalizePhone = (raw) => {
  const digits = String(raw || '').replace(/\D/g, '')
  if (!digits) return null
  let local
  if (digits.startsWith('94') && digits.length === 11) local = digits.slice(2)
  else if (digits.startsWith('0') && digits.length === 10) local = digits.slice(1)
  else if (digits.length === 9) local = digits
  else return null
  return '+94' + local
}

export const greetingForNow = () => {
  const h = new Date().getHours()
  if (h < 12) return 'Good morning'
  if (h < 17) return 'Good afternoon'
  return 'Good evening'
}

const CustomerCtx = createContext(null)

export function CustomerProvider({ children }) {
  const [customers, setCustomers] = useState(() => {
    try {
      const raw = localStorage.getItem(DB_KEY)
      if (raw) return JSON.parse(raw)
    } catch {}
    return {}
  })

  const [active, setActiveState] = useState(() => {
    try {
      const raw = sessionStorage.getItem(SESSION_KEY)
      return raw ? JSON.parse(raw) : null
    } catch {
      return null
    }
  })

  useEffect(() => {
    try {
      localStorage.setItem(DB_KEY, JSON.stringify(customers))
    } catch (e) {
      console.warn('Customer DB save failed', e)
    }
  }, [customers])

  useEffect(() => {
    try {
      if (active) sessionStorage.setItem(SESSION_KEY, JSON.stringify(active))
      else sessionStorage.removeItem(SESSION_KEY)
    } catch {}
  }, [active])

  const lookup = (phone) => {
    const p = normalizePhone(phone)
    return p ? customers[p] || null : null
  }

  const create = (phone, name) => {
    const p = normalizePhone(phone)
    if (!p || !name?.trim()) return null
    const now = new Date().toISOString()
    const c = {
      phone: p,
      name: name.trim(),
      visits: 0,
      totalSpent: 0,
      firstSeen: now,
      lastSeen: now
    }
    setCustomers((prev) => ({ ...prev, [p]: c }))
    return c
  }

  const recordOrder = (phone, amountSpent) => {
    const p = normalizePhone(phone)
    if (!p) return null
    setCustomers((prev) => {
      const existing = prev[p]
      if (!existing) return prev
      return {
        ...prev,
        [p]: {
          ...existing,
          visits: existing.visits + 1,
          totalSpent: existing.totalSpent + (Number(amountSpent) || 0),
          lastSeen: new Date().toISOString()
        }
      }
    })
  }

  const remove = (phone) => {
    const p = normalizePhone(phone)
    if (!p) return
    setCustomers((prev) => {
      const next = { ...prev }
      delete next[p]
      return next
    })
  }

  const setActive = (customer) => setActiveState(customer)
  const clearActive = () => setActiveState(null)

  return (
    <CustomerCtx.Provider
      value={{
        customers,
        list: Object.values(customers),
        active,
        setActive,
        clearActive,
        lookup,
        create,
        recordOrder,
        remove
      }}
    >
      {children}
    </CustomerCtx.Provider>
  )
}

export const useCustomers = () => useContext(CustomerCtx)

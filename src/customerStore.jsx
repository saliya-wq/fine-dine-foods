import { createContext, useContext, useState } from 'react'

const SESSION_KEY = 'calista_active_customer'
const ADMIN_PW_KEY = 'calista_admin_pw'

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

// Trailing time-of-day phrase, e.g. "…glad you joined us this morning / this afternoon / tonight".
export const dayPartPhrase = () => {
  const h = new Date().getHours()
  if (h < 12) return 'this morning'
  if (h < 17) return 'this afternoon'
  return 'tonight'
}

async function api(action, payload = {}, useAdmin = false) {
  const headers = { 'Content-Type': 'application/json' }
  if (useAdmin) headers['x-admin-password'] = sessionStorage.getItem(ADMIN_PW_KEY) || ''
  const res = await fetch('/api/customers', {
    method: 'POST',
    headers,
    body: JSON.stringify({ action, ...payload })
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`)
  return data
}

const CustomerCtx = createContext(null)

export function CustomerProvider({ children }) {
  const [active, setActiveState] = useState(() => {
    try {
      const raw = sessionStorage.getItem(SESSION_KEY)
      return raw ? JSON.parse(raw) : null
    } catch {
      return null
    }
  })

  // Admin-only, loaded on demand by the admin panel.
  const [list, setList] = useState([])

  const persistActive = (customer) => {
    setActiveState(customer)
    try {
      if (customer) sessionStorage.setItem(SESSION_KEY, JSON.stringify(customer))
      else sessionStorage.removeItem(SESSION_KEY)
    } catch {}
  }

  const lookup = async (phone) => {
    const p = normalizePhone(phone)
    if (!p) return null
    const { customer } = await api('lookup', { phone: p })
    return customer || null
  }

  const create = async (phone, name) => {
    const p = normalizePhone(phone)
    if (!p || !name?.trim()) return null
    const { customer } = await api('create', { phone: p, name: name.trim() })
    return customer || null
  }

  const recordOrder = async (phone, amountSpent, extra = {}) => {
    const p = normalizePhone(phone)
    if (!p) return
    try {
      const { customer } = await api('recordOrder', {
        phone: p,
        amount: Number(amountSpent) || 0,
        address: extra.address || '',
        location: extra.location || ''
      })
      // Keep the signed-in customer fresh (visits/spend + saved address) for this session.
      if (customer && active?.phone === customer.phone) persistActive(customer)
    } catch (e) {
      console.warn('recordOrder failed', e)
    }
  }

  const refreshList = async () => {
    const { customers } = await api('list', {}, true)
    setList(customers || [])
    return customers || []
  }

  const remove = async (phone) => {
    const p = normalizePhone(phone)
    if (!p) return
    await api('remove', { phone: p }, true)
    await refreshList()
  }

  const setActive = (customer) => persistActive(customer)
  const clearActive = () => persistActive(null)

  return (
    <CustomerCtx.Provider
      value={{
        list,
        active,
        setActive,
        clearActive,
        lookup,
        create,
        recordOrder,
        remove,
        refreshList
      }}
    >
      {children}
    </CustomerCtx.Provider>
  )
}

export const useCustomers = () => useContext(CustomerCtx)

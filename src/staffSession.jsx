import { createContext, useContext, useState } from 'react'

const KEY_STORAGE = 'calista_staff_key'
const WHO_STORAGE = 'calista_staff_who'

// sessionStorage, not localStorage: staff often share a device, so signing out
// or closing the tab should end the session rather than leave a key behind.
const read = (k) => {
  try {
    return sessionStorage.getItem(k)
  } catch {
    return null
  }
}

/** POST to a staff-gated API with the current key attached. */
export async function staffPost(url, payload) {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-staff-key': read(KEY_STORAGE) || '' },
    body: JSON.stringify(payload)
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`)
  return data
}

const StaffCtx = createContext(null)

export function StaffProvider({ children }) {
  const [staff, setStaff] = useState(() => {
    try {
      const raw = read(WHO_STORAGE)
      return raw ? JSON.parse(raw) : null
    } catch {
      return null
    }
  })

  const signIn = async (key) => {
    const res = await fetch('/api/staff', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'login', key })
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) throw new Error(data.error || 'That key was not recognised.')
    try {
      sessionStorage.setItem(KEY_STORAGE, key)
      sessionStorage.setItem(WHO_STORAGE, JSON.stringify(data.staff))
    } catch {}
    setStaff(data.staff)
    return data.staff
  }

  const signOut = () => {
    try {
      sessionStorage.removeItem(KEY_STORAGE)
      sessionStorage.removeItem(WHO_STORAGE)
    } catch {}
    setStaff(null)
  }

  return <StaffCtx.Provider value={{ staff, signIn, signOut }}>{children}</StaffCtx.Provider>
}

export const useStaff = () => useContext(StaffCtx)

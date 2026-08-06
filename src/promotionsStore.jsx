import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import { supabase } from './supabaseClient.js'
import { promotionsSeed } from './promotionsSeed.js'

const STORAGE_KEY = 'calista_promotions_cache_v1'
const ADMIN_PW_KEY = 'calista_admin_pw'

const fromDb = (rows) =>
  (rows || []).map((r) => ({
    id: r.id,
    title: r.title,
    description: r.description || '',
    image: r.image_url || '',
    startDate: r.start_date || '',
    endDate: r.end_date || '',
    url: r.url || ''
  }))

async function apiWrite(action, payload = {}) {
  const pw = (typeof sessionStorage !== 'undefined' && sessionStorage.getItem(ADMIN_PW_KEY)) || ''
  const res = await fetch('/api/promotions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-admin-password': pw },
    body: JSON.stringify({ action, ...payload })
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`)
  return data
}

const Ctx = createContext(null)

export function PromotionsProvider({ children }) {
  const [items, setItems] = useState(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (raw) {
        const parsed = JSON.parse(raw)
        if (Array.isArray(parsed)) return parsed
      }
    } catch {}
    return promotionsSeed()
  })

  const refresh = useCallback(async () => {
    if (!supabase) return
    const { data, error } = await supabase
      .from('promotions')
      .select('id,title,description,image_url,start_date,end_date,url,sort_order')
      .order('sort_order')
    // Keep the seed/cache if the table is unreachable or empty.
    if (error || !data || data.length === 0) return
    const next = fromDb(data)
    setItems(next)
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
    } catch {}
  }, [])

  useEffect(() => {
    refresh()
  }, [refresh])

  const add = async (draft) => {
    const title = (draft.title || '').trim()
    if (!title) return null
    const { imageDataUrl, ...rest } = draft
    const { id } = await apiWrite('add', { draft: rest, imageDataUrl })
    await refresh()
    return id
  }

  const update = async (id, draft) => {
    const { imageDataUrl, ...patch } = draft
    await apiWrite('update', { id, patch, imageDataUrl })
    await refresh()
  }

  const remove = async (id) => {
    await apiWrite('remove', { id })
    await refresh()
  }

  const resetToDefault = async () => {
    await apiWrite('reset')
    await refresh()
  }

  return (
    <Ctx.Provider value={{ items, add, update, remove, resetToDefault }}>{children}</Ctx.Provider>
  )
}

export const usePromotions = () => useContext(Ctx)

export const statusOf = (p, todayISO) => {
  const t = todayISO || new Date().toISOString().slice(0, 10)
  if (!p.startDate || !p.endDate) return 'active'
  if (t < p.startDate) return 'upcoming'
  if (t > p.endDate) return 'past'
  return 'active'
}

export const formatDateRange = (start, end) => {
  if (!start && !end) return ''
  const fmt = (iso) => {
    if (!iso) return ''
    const [y, m, d] = iso.split('-').map(Number)
    return new Date(y, m - 1, d).toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    })
  }
  const s = fmt(start)
  const e = fmt(end)
  if (!s) return e
  if (!e) return s
  if (start === end) return s
  return `${s} – ${e}`
}

import { createContext, useContext, useEffect, useState } from 'react'
import { BRAND } from './brand.js'

const STORAGE_KEY = 'calista_promotions_v1'

const slugify = (s) =>
  s.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'promo'

const uniqueId = (existing, base) => {
  if (!existing.find((e) => e.id === base)) return base
  let n = 2
  while (existing.find((e) => e.id === `${base}-${n}`)) n++
  return `${base}-${n}`
}

const seed = () => [
  {
    id: 'aperitivo-hour',
    title: 'Aperitivo Hour',
    description:
      'Every weekday from 5 – 7pm. Aperol spritzes, negronis, and our house Sicilian aperitivo plate at 25% off. Walk-in or call ahead to reserve a bar seat.',
    image: 'https://images.unsplash.com/photo-1551538827-9c037cb4f32a?w=1000&q=80',
    startDate: '2026-05-01',
    endDate: '2026-07-31',
    url: BRAND.facebook
  },
  {
    id: 'sunday-brunch',
    title: 'Sunday Sicilian Brunch',
    description:
      'Every Sunday, 11am – 3pm. Wood-fired focaccia, frittatas, fresh tropical fruit, and bottomless mimosas at Rs. 4,500 per person. Kids under 10 dine free with two paying adults.',
    image: 'https://images.unsplash.com/photo-1533089860892-a7c6f0a88666?w=1000&q=80',
    startDate: '2026-05-15',
    endDate: '2026-08-31',
    url: ''
  },
  {
    id: 'fathers-day',
    title: "Father's Day Set Menu",
    description:
      "A four-course celebration menu for Father's Day weekend. Antipasto, hand-rolled pasta, your choice of main, and dessert at Rs. 7,800 per person. Booking essential — limited covers.",
    image: 'https://images.unsplash.com/photo-1414235077428-338989a2e8c0?w=1000&q=80',
    startDate: '2026-06-19',
    endDate: '2026-06-21',
    url: BRAND.facebook
  }
]

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
    return seed()
  })

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(items))
    } catch (e) {
      console.warn('Promotions: localStorage save failed', e)
    }
  }, [items])

  const add = (draft) => {
    const title = (draft.title || '').trim()
    if (!title) return null
    const id = uniqueId(items, slugify(title))
    const p = {
      id,
      title,
      description: (draft.description || '').trim(),
      image: (draft.image || '').trim(),
      startDate: draft.startDate || '',
      endDate: draft.endDate || '',
      url: (draft.url || '').trim()
    }
    setItems((prev) => [...prev, p])
    return id
  }

  const update = (id, patch) => {
    setItems((prev) =>
      prev.map((p) =>
        p.id === id
          ? {
              ...p,
              ...patch,
              title: patch.title !== undefined ? patch.title.trim() : p.title,
              description: patch.description !== undefined ? patch.description.trim() : p.description,
              image: patch.image !== undefined ? patch.image.trim() : p.image,
              url: patch.url !== undefined ? patch.url.trim() : p.url
            }
          : p
      )
    )
  }

  const remove = (id) => setItems((prev) => prev.filter((p) => p.id !== id))
  const resetToDefault = () => setItems(seed())

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

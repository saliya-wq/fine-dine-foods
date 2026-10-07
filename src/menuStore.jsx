import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { menu as defaultMenu } from './menu.js'
import { supabase } from './supabaseClient.js'
import { staffPost } from './staffSession.jsx'

// Cache of the last menu fetched from Supabase, so the PWA still renders offline.
const STORAGE_KEY = 'calista_menu_cache_v1'
const ADMIN_PW_KEY = 'calista_admin_pw'

const slugify = (s) =>
  s.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'item'

// Bundled fallback menu (used before the DB responds / when offline).
const seed = () => {
  const categories = defaultMenu.map((c) => ({ id: slugify(c.category), name: c.category }))
  const items = defaultMenu.flatMap((c) =>
    c.items.map((i) => ({
      id: i.id,
      categoryId: slugify(c.category),
      name: i.name,
      desc: i.desc,
      price: i.price,
      image: i.image
    }))
  )
  return { categories, items }
}

// Map Supabase rows -> the shape the app uses.
const fromDb = (categories, items) => ({
  categories: categories.map((c) => ({ id: c.id, name: c.name })),
  items: (items || []).map((i) => ({
    id: i.id,
    categoryId: i.category_id,
    name: i.name,
    desc: i.description || '',
    price: i.price || 0,
    image: i.image_url || ''
  }))
})

// POST an admin action to the write API, authorised with the stored password.
async function apiWrite(action, payload = {}) {
  const pw = (typeof sessionStorage !== 'undefined' && sessionStorage.getItem(ADMIN_PW_KEY)) || ''
  const res = await fetch('/api/menu', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-admin-password': pw },
    body: JSON.stringify({ action, ...payload })
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`)
  return data
}

const MenuCtx = createContext(null)

export function MenuProvider({ children }) {
  const [state, setState] = useState(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (raw) {
        const parsed = JSON.parse(raw)
        if (parsed?.categories && parsed?.items) return parsed
      }
    } catch {}
    return seed()
  })

  // Fetch the shared menu from Supabase and cache it.
  const refresh = useCallback(async () => {
    if (!supabase) return
    const [cats, its] = await Promise.all([
      supabase.from('categories').select('id,name,sort_order').order('sort_order'),
      supabase
        .from('menu_items')
        .select('id,category_id,name,description,price,image_url,sort_order')
        .order('sort_order')
    ])
    // If the DB is unreachable or not yet seeded, keep the current (seed/cache) menu.
    if (cats.error || its.error || !cats.data || cats.data.length === 0) return
    const next = fromDb(cats.data, its.data)
    setState(next)
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
    } catch {}
  }, [])

  useEffect(() => {
    refresh()
  }, [refresh])

  const addCategory = async (name) => {
    const trimmed = (name || '').trim()
    if (!trimmed) return null
    const { id } = await apiWrite('addCategory', { name: trimmed })
    await refresh()
    return id
  }

  const renameCategory = async (id, name) => {
    const trimmed = (name || '').trim()
    if (!trimmed) return
    await apiWrite('renameCategory', { id, name: trimmed })
    await refresh()
  }

  const deleteCategory = async (id) => {
    await apiWrite('deleteCategory', { id })
    await refresh()
  }

  const addItem = async (categoryId, draft) => {
    const name = (draft.name || '').trim()
    if (!name || !categoryId) return null
    const { imageDataUrl, ...item } = draft
    const { id } = await apiWrite('addItem', { categoryId, item, imageDataUrl })
    await refresh()
    return id
  }

  const updateItem = async (id, draft) => {
    const { imageDataUrl, ...patch } = draft
    await apiWrite('updateItem', { id, patch, imageDataUrl })
    await refresh()
  }

  const deleteItem = async (id) => {
    await apiWrite('deleteItem', { id })
    await refresh()
  }

  // Sysadmin-only, so it rides on the staff key rather than the admin password.
  const resetToDefault = async () => {
    await staffPost('/api/menu', { action: 'resetMenu' })
    await refresh()
  }

  const grouped = useMemo(
    () =>
      state.categories.map((c) => ({
        ...c,
        items: state.items.filter((i) => i.categoryId === c.id)
      })),
    [state]
  )

  const itemImageById = useMemo(
    () => Object.fromEntries(state.items.map((i) => [i.id, i.image])),
    [state.items]
  )

  return (
    <MenuCtx.Provider
      value={{
        categories: state.categories,
        items: state.items,
        grouped,
        itemImageById,
        refresh,
        addCategory,
        renameCategory,
        deleteCategory,
        addItem,
        updateItem,
        deleteItem,
        resetToDefault
      }}
    >
      {children}
    </MenuCtx.Provider>
  )
}

export const useMenu = () => useContext(MenuCtx)

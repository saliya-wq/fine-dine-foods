import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import { menu as defaultMenu } from './menu.js'

const STORAGE_KEY = 'calista_menu_v1'

const slugify = (s) =>
  s.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'item'

const uniqueId = (existing, base) => {
  if (!existing.find((e) => e.id === base)) return base
  let n = 2
  while (existing.find((e) => e.id === `${base}-${n}`)) n++
  return `${base}-${n}`
}

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

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
    } catch (err) {
      console.warn('Could not save menu to localStorage.', err)
    }
  }, [state])

  const addCategory = (name) => {
    const trimmed = (name || '').trim()
    if (!trimmed) return null
    const id = uniqueId(state.categories, slugify(trimmed))
    setState((s) => ({ ...s, categories: [...s.categories, { id, name: trimmed }] }))
    return id
  }

  const renameCategory = (id, name) => {
    const trimmed = (name || '').trim()
    if (!trimmed) return
    setState((s) => ({
      ...s,
      categories: s.categories.map((c) => (c.id === id ? { ...c, name: trimmed } : c))
    }))
  }

  const deleteCategory = (id) => {
    setState((s) => ({
      categories: s.categories.filter((c) => c.id !== id),
      items: s.items.filter((i) => i.categoryId !== id)
    }))
  }

  const addItem = (categoryId, draft) => {
    const name = (draft.name || '').trim()
    if (!name || !categoryId) return null
    const id = uniqueId(state.items, slugify(name))
    const item = {
      id,
      categoryId,
      name,
      desc: (draft.desc || '').trim(),
      price: Number(draft.price) || 0,
      image: (draft.image || '').trim()
    }
    setState((s) => ({ ...s, items: [...s.items, item] }))
    return id
  }

  const updateItem = (id, patch) => {
    setState((s) => ({
      ...s,
      items: s.items.map((i) =>
        i.id === id
          ? {
              ...i,
              ...patch,
              name: patch.name !== undefined ? patch.name.trim() : i.name,
              desc: patch.desc !== undefined ? patch.desc.trim() : i.desc,
              price: patch.price !== undefined ? Number(patch.price) || 0 : i.price,
              image: patch.image !== undefined ? patch.image.trim() : i.image
            }
          : i
      )
    }))
  }

  const deleteItem = (id) => {
    setState((s) => ({ ...s, items: s.items.filter((i) => i.id !== id) }))
  }

  const resetToDefault = () => setState(seed())

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

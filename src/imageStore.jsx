import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from './supabaseClient.js'

const CACHE_KEY = 'calista_site_images_cache_v1'
const ADMIN_PW_KEY = 'calista_admin_pw'
const ImageCtx = createContext(null)

async function apiWrite(action, payload = {}) {
  const pw = (typeof sessionStorage !== 'undefined' && sessionStorage.getItem(ADMIN_PW_KEY)) || ''
  const res = await fetch('/api/site-images', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-admin-password': pw },
    body: JSON.stringify({ action, ...payload })
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`)
  return data
}

export function ImageProvider({ children }) {
  // Map of site image id -> public URL (e.g. brand logo/hero). Shared via Supabase.
  const [overrides, setOverrides] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem(CACHE_KEY) || '{}')
    } catch {
      return {}
    }
  })

  useEffect(() => {
    let alive = true
    async function load() {
      if (!supabase) return
      const { data, error } = await supabase.from('site_images').select('id,url')
      if (!alive || error || !data) return
      const map = Object.fromEntries(data.map((r) => [r.id, r.url]))
      setOverrides(map)
      try {
        localStorage.setItem(CACHE_KEY, JSON.stringify(map))
      } catch {}
    }
    load()
    return () => {
      alive = false
    }
  }, [])

  const cache = (map) => {
    try {
      localStorage.setItem(CACHE_KEY, JSON.stringify(map))
    } catch {}
  }

  const setImage = async (id, dataUrl) => {
    const { url } = await apiWrite('set', { id, imageDataUrl: dataUrl })
    setOverrides((o) => {
      const next = { ...o, [id]: url }
      cache(next)
      return next
    })
  }

  const clearImage = async (id) => {
    await apiWrite('remove', { id })
    setOverrides((o) => {
      const next = { ...o }
      delete next[id]
      cache(next)
      return next
    })
  }

  const clearAll = async () => {
    await apiWrite('removeAll')
    setOverrides({})
    cache({})
  }

  const getImage = (id, fallback) => overrides[id] || fallback

  return (
    <ImageCtx.Provider value={{ overrides, setImage, clearImage, clearAll, getImage }}>
      {children}
    </ImageCtx.Provider>
  )
}

export const useImages = () => useContext(ImageCtx)

export async function fileToResizedDataUrl(file, maxDim = 1000, quality = 0.82) {
  const objUrl = URL.createObjectURL(file)
  try {
    const img = await new Promise((resolve, reject) => {
      const i = new Image()
      i.onload = () => resolve(i)
      i.onerror = reject
      i.src = objUrl
    })
    const scale = Math.min(1, maxDim / Math.max(img.width, img.height))
    const w = Math.round(img.width * scale)
    const h = Math.round(img.height * scale)
    const canvas = document.createElement('canvas')
    canvas.width = w
    canvas.height = h
    const ctx = canvas.getContext('2d')
    ctx.drawImage(img, 0, 0, w, h)
    return canvas.toDataURL('image/jpeg', quality)
  } finally {
    URL.revokeObjectURL(objUrl)
  }
}

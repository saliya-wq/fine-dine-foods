import { createContext, useContext, useEffect, useState } from 'react'

const STORAGE_KEY = 'calista_images_v1'
const ImageCtx = createContext(null)

export function ImageProvider({ children }) {
  const [overrides, setOverrides] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}')
    } catch {
      return {}
    }
  })

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(overrides))
    } catch (err) {
      console.warn('Could not save images to localStorage — likely over quota.', err)
    }
  }, [overrides])

  const setImage = (id, dataUrl) => setOverrides((o) => ({ ...o, [id]: dataUrl }))
  const clearImage = (id) =>
    setOverrides((o) => {
      const next = { ...o }
      delete next[id]
      return next
    })
  const clearAll = () => setOverrides({})

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

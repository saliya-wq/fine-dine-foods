import { createClient } from '@supabase/supabase-js'

const URL = process.env.SUPABASE_URL
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const BUCKET = 'menu-images'

const admin = () => createClient(URL, SERVICE_KEY, { auth: { persistSession: false } })

async function uploadImage(supabase, dataUrl, idHint) {
  const m = String(dataUrl).match(/^data:(.+?);base64,(.*)$/s)
  if (!m) throw new Error('Invalid image data.')
  const contentType = m[1] || 'image/jpeg'
  const ext = contentType.includes('png') ? 'png' : 'jpg'
  const safe = String(idHint || 'img').replace(/[^a-z0-9_-]/gi, '')
  const path = `site-${safe}-${Date.now()}.${ext}`
  const { error } = await supabase.storage.from(BUCKET).upload(path, Buffer.from(m[2], 'base64'), {
    contentType,
    upsert: true
  })
  if (error) throw new Error('Image upload failed: ' + error.message)
  return supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return res.status(405).json({ error: 'Method not allowed' })
  }
  if (!URL || !SERVICE_KEY) {
    return res.status(500).json({ error: 'Server not configured (Supabase env vars missing).' })
  }
  if (!process.env.ADMIN_PASSWORD || req.headers['x-admin-password'] !== process.env.ADMIN_PASSWORD) {
    return res.status(401).json({ error: 'Unauthorized. Sign in again.' })
  }

  const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body || {}
  const { action } = body
  const supabase = admin()

  try {
    switch (action) {
      case 'set': {
        const { id, imageDataUrl } = body
        if (!id || !imageDataUrl) return res.status(400).json({ error: 'id and image required.' })
        const url = await uploadImage(supabase, imageDataUrl, id)
        const { error } = await supabase.from('site_images').upsert({ id, url })
        if (error) throw error
        return res.status(200).json({ id, url })
      }
      case 'remove': {
        if (!body.id) return res.status(400).json({ error: 'id required.' })
        const { error } = await supabase.from('site_images').delete().eq('id', body.id)
        if (error) throw error
        return res.status(200).json({ ok: true })
      }
      case 'removeAll': {
        const { error } = await supabase.from('site_images').delete().neq('id', '')
        if (error) throw error
        return res.status(200).json({ ok: true })
      }
      default:
        return res.status(400).json({ error: 'Unknown action.' })
    }
  } catch (err) {
    console.error('site-images api error:', action, err)
    return res.status(500).json({ error: err.message || 'Server error.' })
  }
}

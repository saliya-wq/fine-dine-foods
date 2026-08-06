import { createClient } from '@supabase/supabase-js'
import { promotionsSeed } from '../src/promotionsSeed.js'

const URL = process.env.SUPABASE_URL
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const BUCKET = 'menu-images'

const slugify = (s) =>
  String(s || '').toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'promo'

const admin = () => createClient(URL, SERVICE_KEY, { auth: { persistSession: false } })

async function uniqueId(supabase, base) {
  const { data } = await supabase.from('promotions').select('id').like('id', `${base}%`)
  const taken = new Set((data || []).map((r) => r.id))
  if (!taken.has(base)) return base
  let n = 2
  while (taken.has(`${base}-${n}`)) n++
  return `${base}-${n}`
}

async function uploadImage(supabase, dataUrl, idHint) {
  const m = String(dataUrl).match(/^data:(.+?);base64,(.*)$/s)
  if (!m) throw new Error('Invalid image data.')
  const contentType = m[1] || 'image/jpeg'
  const ext = contentType.includes('png') ? 'png' : 'jpg'
  const path = `promo-${slugify(idHint) || 'img'}-${Date.now()}.${ext}`
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

  const row = (draft, image_url) => ({
    title: (draft.title || '').trim(),
    description: (draft.description || '').trim(),
    image_url: image_url !== undefined ? image_url : (draft.image || '').trim(),
    start_date: draft.startDate || null,
    end_date: draft.endDate || null,
    url: (draft.url || '').trim()
  })

  try {
    switch (action) {
      case 'add': {
        const { draft = {}, imageDataUrl } = body
        const title = (draft.title || '').trim()
        if (!title) return res.status(400).json({ error: 'Title required.' })
        const id = await uniqueId(supabase, slugify(title))
        let image_url = (draft.image || '').trim()
        if (imageDataUrl) image_url = await uploadImage(supabase, imageDataUrl, id)
        const { data: mx } = await supabase.from('promotions').select('sort_order').order('sort_order', { ascending: false }).limit(1)
        const sort_order = ((mx && mx[0]?.sort_order) || 0) + 1
        const { error } = await supabase.from('promotions').insert({ id, ...row(draft, image_url), sort_order })
        if (error) throw error
        return res.status(200).json({ id })
      }
      case 'update': {
        const { id, patch = {}, imageDataUrl } = body
        if (!id) return res.status(400).json({ error: 'id required.' })
        const update = {}
        if (patch.title !== undefined) update.title = String(patch.title).trim()
        if (patch.description !== undefined) update.description = String(patch.description).trim()
        if (patch.image !== undefined) update.image_url = String(patch.image).trim()
        if (patch.startDate !== undefined) update.start_date = patch.startDate || null
        if (patch.endDate !== undefined) update.end_date = patch.endDate || null
        if (patch.url !== undefined) update.url = String(patch.url).trim()
        if (imageDataUrl) update.image_url = await uploadImage(supabase, imageDataUrl, id)
        const { error } = await supabase.from('promotions').update(update).eq('id', id)
        if (error) throw error
        return res.status(200).json({ ok: true })
      }
      case 'remove': {
        if (!body.id) return res.status(400).json({ error: 'id required.' })
        const { error } = await supabase.from('promotions').delete().eq('id', body.id)
        if (error) throw error
        return res.status(200).json({ ok: true })
      }
      case 'reset': {
        await supabase.from('promotions').delete().neq('id', '')
        const rows = promotionsSeed().map((p, i) => ({
          id: p.id,
          title: p.title,
          description: p.description || '',
          image_url: p.image || '',
          start_date: p.startDate || null,
          end_date: p.endDate || null,
          url: p.url || '',
          sort_order: i + 1
        }))
        const { error } = await supabase.from('promotions').insert(rows)
        if (error) throw error
        return res.status(200).json({ ok: true })
      }
      default:
        return res.status(400).json({ error: 'Unknown action.' })
    }
  } catch (err) {
    console.error('promotions api error:', action, err)
    return res.status(500).json({ error: err.message || 'Server error.' })
  }
}

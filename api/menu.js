import { createClient } from '@supabase/supabase-js'
import { menu as defaultMenu } from '../src/menu.js'
import { authorize } from '../lib/staff.js'

const URL = process.env.SUPABASE_URL
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const BUCKET = 'menu-images'

const slugify = (s) =>
  String(s || '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'item'

const admin = () => createClient(URL, SERVICE_KEY, { auth: { persistSession: false } })

async function uniqueId(supabase, table, base) {
  const { data } = await supabase.from(table).select('id').like('id', `${base}%`)
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
  const buffer = Buffer.from(m[2], 'base64')
  const path = `${slugify(idHint) || 'img'}-${Date.now()}.${ext}`
  const { error } = await supabase.storage.from(BUCKET).upload(path, buffer, { contentType, upsert: true })
  if (error) throw new Error('Image upload failed: ' + error.message)
  return supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl
}

async function nextSort(supabase, table, filter) {
  let q = supabase.from(table).select('sort_order').order('sort_order', { ascending: false }).limit(1)
  if (filter) q = q.eq(filter.col, filter.val)
  const { data } = await q
  return ((data && data[0]?.sort_order) || 0) + 1
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return res.status(405).json({ error: 'Method not allowed' })
  }
  if (!URL || !SERVICE_KEY) {
    return res.status(500).json({ error: 'Server not configured (Supabase env vars missing).' })
  }
  const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body || {}
  const { action } = body
  const supabase = admin()

  // Wiping the whole menu is sysadmin-only (staff key); everyday menu
  // edits stay on the admin password.
  if (action !== 'resetMenu') {
    const expected = process.env.ADMIN_PASSWORD
    if (!expected || req.headers['x-admin-password'] !== expected) {
      return res.status(401).json({ error: 'Unauthorized. Sign in again.' })
    }
  }

  try {
    if (action === 'resetMenu' && !(await authorize(supabase, req, 'sysadmin'))) {
      return res.status(401).json({ error: 'Only a system administrator can reset the menu.' })
    }
    switch (action) {
      case 'addCategory': {
        const name = (body.name || '').trim()
        if (!name) return res.status(400).json({ error: 'Category name required.' })
        const id = await uniqueId(supabase, 'categories', slugify(name))
        const sort_order = await nextSort(supabase, 'categories')
        const { error } = await supabase.from('categories').insert({ id, name, sort_order })
        if (error) throw error
        return res.status(200).json({ id })
      }
      case 'renameCategory': {
        const name = (body.name || '').trim()
        if (!body.id || !name) return res.status(400).json({ error: 'id and name required.' })
        const { error } = await supabase.from('categories').update({ name }).eq('id', body.id)
        if (error) throw error
        return res.status(200).json({ ok: true })
      }
      case 'deleteCategory': {
        if (!body.id) return res.status(400).json({ error: 'id required.' })
        const { error } = await supabase.from('categories').delete().eq('id', body.id)
        if (error) throw error
        return res.status(200).json({ ok: true })
      }
      case 'addItem': {
        const { categoryId, item = {}, imageDataUrl } = body
        const name = (item.name || '').trim()
        if (!categoryId || !name) return res.status(400).json({ error: 'categoryId and name required.' })
        const id = await uniqueId(supabase, 'menu_items', slugify(name))
        let image_url = (item.image || '').trim()
        if (imageDataUrl) image_url = await uploadImage(supabase, imageDataUrl, id)
        const sort_order = await nextSort(supabase, 'menu_items', { col: 'category_id', val: categoryId })
        const { error } = await supabase.from('menu_items').insert({
          id,
          category_id: categoryId,
          name,
          description: (item.desc || '').trim(),
          price: Number(item.price) || 0,
          image_url,
          sort_order
        })
        if (error) throw error
        return res.status(200).json({ id })
      }
      case 'updateItem': {
        const { id, patch = {}, imageDataUrl } = body
        if (!id) return res.status(400).json({ error: 'id required.' })
        const update = {}
        if (patch.name !== undefined) update.name = String(patch.name).trim()
        if (patch.desc !== undefined) update.description = String(patch.desc).trim()
        if (patch.price !== undefined) update.price = Number(patch.price) || 0
        if (patch.image !== undefined) update.image_url = String(patch.image).trim()
        if (imageDataUrl) update.image_url = await uploadImage(supabase, imageDataUrl, id)
        const { error } = await supabase.from('menu_items').update(update).eq('id', id)
        if (error) throw error
        return res.status(200).json({ ok: true })
      }
      case 'deleteItem': {
        if (!body.id) return res.status(400).json({ error: 'id required.' })
        const { error } = await supabase.from('menu_items').delete().eq('id', body.id)
        if (error) throw error
        return res.status(200).json({ ok: true })
      }
      case 'resetMenu': {
        await supabase.from('menu_items').delete().neq('id', '')
        await supabase.from('categories').delete().neq('id', '')
        const cats = defaultMenu.map((c, i) => ({ id: slugify(c.category), name: c.category, sort_order: i + 1 }))
        const { error: e1 } = await supabase.from('categories').insert(cats)
        if (e1) throw e1
        const items = defaultMenu.flatMap((c) =>
          c.items.map((it, i) => ({
            id: it.id,
            category_id: slugify(c.category),
            name: it.name,
            description: it.desc || '',
            price: it.price || 0,
            image_url: it.image || '',
            sort_order: i + 1
          }))
        )
        const { error: e2 } = await supabase.from('menu_items').insert(items)
        if (e2) throw e2
        return res.status(200).json({ ok: true })
      }
      default:
        return res.status(400).json({ error: 'Unknown action.' })
    }
  } catch (err) {
    console.error('menu api error:', action, err)
    return res.status(500).json({ error: err.message || 'Server error.' })
  }
}

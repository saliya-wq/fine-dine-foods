import { createClient } from '@supabase/supabase-js'
import { normalizePhone } from '../lib/phone.js'

const URL = process.env.SUPABASE_URL
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

const admin = () => createClient(URL, SERVICE_KEY, { auth: { persistSession: false } })

const toCustomer = (r) =>
  r
    ? {
        phone: r.phone,
        name: r.name,
        visits: r.visits,
        totalSpent: r.total_spent,
        firstSeen: r.first_seen,
        lastSeen: r.last_seen,
        address: r.address || '',
        location: r.location || ''
      }
    : null

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

  const requireAdmin = () =>
    process.env.ADMIN_PASSWORD && req.headers['x-admin-password'] === process.env.ADMIN_PASSWORD

  try {
    switch (action) {
      // ── Public (customer-driven) ──────────────────────────────────────
      case 'lookup': {
        const phone = normalizePhone(body.phone)
        if (!phone) return res.status(400).json({ error: 'Invalid phone.' })
        const { data, error } = await supabase.from('customers').select('*').eq('phone', phone).maybeSingle()
        if (error) throw error
        return res.status(200).json({ customer: toCustomer(data) })
      }
      case 'create': {
        const phone = normalizePhone(body.phone)
        const name = (body.name || '').trim()
        if (!phone || !name) return res.status(400).json({ error: 'Phone and name required.' })
        const { data: existing } = await supabase.from('customers').select('*').eq('phone', phone).maybeSingle()
        if (existing) return res.status(200).json({ customer: toCustomer(existing) })
        const now = new Date().toISOString()
        const { data, error } = await supabase
          .from('customers')
          .insert({ phone, name, visits: 0, total_spent: 0, first_seen: now, last_seen: now })
          .select('*')
          .single()
        if (error) throw error
        return res.status(200).json({ customer: toCustomer(data) })
      }
      case 'recordOrder': {
        const phone = normalizePhone(body.phone)
        if (!phone) return res.status(400).json({ error: 'Invalid phone.' })
        const { data: existing } = await supabase.from('customers').select('*').eq('phone', phone).maybeSingle()
        if (!existing) return res.status(200).json({ customer: null })
        // Visits and spend are counted by api/orders `place` from the
        // server-priced order. This endpoint is public, so it must not move
        // them, or anyone could call it repeatedly to climb loyalty tiers.
        const update = { last_seen: new Date().toISOString() }
        // Remember delivery details for next time (only overwrite when provided).
        const address = (body.address || '').trim()
        const location = (body.location || '').trim()
        if (address) update.address = address
        if (location) update.location = location
        const { data, error } = await supabase
          .from('customers')
          .update(update)
          .eq('phone', phone)
          .select('*')
          .single()
        if (error) throw error
        return res.status(200).json({ customer: toCustomer(data) })
      }
      // ── Admin only ────────────────────────────────────────────────────
      case 'list': {
        if (!requireAdmin()) return res.status(401).json({ error: 'Unauthorized.' })
        const { data, error } = await supabase.from('customers').select('*').order('last_seen', { ascending: false })
        if (error) throw error
        return res.status(200).json({ customers: (data || []).map(toCustomer) })
      }
      case 'remove': {
        if (!requireAdmin()) return res.status(401).json({ error: 'Unauthorized.' })
        const phone = normalizePhone(body.phone)
        if (!phone) return res.status(400).json({ error: 'Invalid phone.' })
        const { error } = await supabase.from('customers').delete().eq('phone', phone)
        if (error) throw error
        return res.status(200).json({ ok: true })
      }
      default:
        return res.status(400).json({ error: 'Unknown action.' })
    }
  } catch (err) {
    console.error('customers api error:', action, err)
    return res.status(500).json({ error: err.message || 'Server error.' })
  }
}

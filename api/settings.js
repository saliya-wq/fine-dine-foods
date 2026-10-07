import { createClient } from '@supabase/supabase-js'
import { authorize } from '../lib/staff.js'

const URL = process.env.SUPABASE_URL
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

const admin = () => createClient(URL, SERVICE_KEY, { auth: { persistSession: false } })

const ALLOWED = [
  'name', 'tagline', 'address', 'addressLine2',
  'phone', 'whatsapp', 'facebook', 'instagram', 'hoursText'
]

// Service charge + loyalty tiers. Every customer's checkout prices from this
// row, so reject anything malformed rather than storing it. Returns the
// cleaned object, or an error message string.
function cleanOrdering(input) {
  const d = input || {}
  const sc = Number(d.serviceChargePercent)
  if (!Number.isFinite(sc) || sc < 0 || sc > 100) return 'Service charge must be between 0 and 100%.'

  const tiers = Array.isArray(d.loyaltyTiers) ? d.loyaltyTiers : []
  if (tiers.length < 1 || tiers.length > 10) return 'Between 1 and 10 loyalty tiers, please.'
  const loyaltyTiers = []
  for (const t of tiers) {
    const name = String(t?.name ?? '').trim().slice(0, 40) || 'Tier'
    const minVisits = Number(t?.minVisits)
    const discountPercent = Number(t?.discountPercent)
    if (!Number.isInteger(minVisits) || minVisits < 0) return `"${name}": minimum visits must be a whole number, 0 or more.`
    if (!Number.isFinite(discountPercent) || discountPercent < 0 || discountPercent > 100) {
      return `"${name}": discount must be between 0 and 100%.`
    }
    loyaltyTiers.push({ name, minVisits, discountPercent })
  }
  loyaltyTiers.sort((a, b) => a.minVisits - b.minVisits)
  // getTier() falls back to the lowest tier, but a tier at 0 makes "new
  // customer" explicit instead of accidental.
  if (loyaltyTiers[0].minVisits !== 0) return 'The first tier must start at 0 visits.'

  return { serviceChargePercent: sc, loyaltyTiers }
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
  const supabase = admin()

  try {
    // Sysadmin key only — the legacy ADMIN_PASSWORD counts as 'admin' and is refused.
    if (!(await authorize(supabase, req, 'sysadmin'))) {
      return res.status(401).json({ error: 'Only a system administrator can change settings.' })
    }
    if (body.action === 'saveBrand') {
      const incoming = body.data || {}
      const data = {}
      for (const k of ALLOWED) data[k] = typeof incoming[k] === 'string' ? incoming[k] : ''
      const { error } = await supabase.from('site_settings').upsert({ id: 'brand', data })
      if (error) throw error
      return res.status(200).json({ ok: true })
    }
    if (body.action === 'saveOrdering') {
      const data = cleanOrdering(body.data)
      if (typeof data === 'string') return res.status(400).json({ error: data })
      const { error } = await supabase.from('site_settings').upsert({ id: 'ordering', data })
      if (error) throw error
      return res.status(200).json({ ok: true, data })
    }
    return res.status(400).json({ error: 'Unknown action.' })
  } catch (err) {
    console.error('settings api error:', body.action, err)
    return res.status(500).json({ error: err.message || 'Server error.' })
  }
}

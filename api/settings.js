import { createClient } from '@supabase/supabase-js'
import { authorize } from '../lib/staff.js'

const URL = process.env.SUPABASE_URL
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

const admin = () => createClient(URL, SERVICE_KEY, { auth: { persistSession: false } })

const ALLOWED = [
  'name', 'tagline', 'address', 'addressLine2',
  'phone', 'whatsapp', 'facebook', 'instagram', 'hoursText'
]

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
    return res.status(400).json({ error: 'Unknown action.' })
  } catch (err) {
    console.error('settings api error:', body.action, err)
    return res.status(500).json({ error: err.message || 'Server error.' })
  }
}

import { admin } from '../lib/push.js'
import {
  ROLES,
  atLeast,
  authorize,
  generateKey,
  hashKey,
  keyPrefix,
  normalizeKey,
  staffFromRequest
} from '../lib/staff.js'

const publicRow = (r) => ({
  id: r.id,
  role: r.role,
  name: r.name,
  prefix: r.key_prefix,
  active: r.active,
  createdAt: r.created_at,
  lastUsedAt: r.last_used_at
})

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return res.status(405).json({ error: 'Method not allowed' })
  }
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return res.status(500).json({ error: 'Server not configured (Supabase env vars missing).' })
  }

  const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body || {}
  const { action } = body
  const supabase = admin()

  try {
    switch (action) {
      // ── Public: exchange a key for the role it carries ────────────────
      // Deliberately vague on failure — never reveal whether a key exists
      // but is revoked, versus never having existed.
      case 'login': {
        const normalized = normalizeKey(body.key)
        if (!normalized) return res.status(401).json({ error: 'That key was not recognised.' })
        const staff = await staffFromRequest(supabase, { headers: { 'x-staff-key': normalized } })
        if (!staff) return res.status(401).json({ error: 'That key was not recognised.' })
        return res.status(200).json({ staff })
      }

      // ── Any signed-in staff member: confirm their own key ─────────────
      case 'me': {
        const staff = await staffFromRequest(supabase, req)
        if (!staff) return res.status(401).json({ error: 'Unauthorized.' })
        return res.status(200).json({ staff })
      }

      // ── Manager+: who can a delivery be handed to ─────────────────────
      // Names and ids only — never anything key-related.
      case 'riders': {
        if (!(await authorize(supabase, req, 'manager'))) return res.status(401).json({ error: 'Unauthorized.' })
        const { data, error } = await supabase
          .from('staff_keys')
          .select('id, name')
          .eq('role', 'rider')
          .eq('active', true)
          .order('name', { ascending: true })
        if (error) throw error
        return res.status(200).json({ riders: data || [] })
      }

      // ── Sys Admin only: manage keys ───────────────────────────────────
      case 'list': {
        const staff = await staffFromRequest(supabase, req)
        if (!staff || !atLeast(staff.role, 'sysadmin')) return res.status(401).json({ error: 'Unauthorized.' })
        const { data, error } = await supabase
          .from('staff_keys')
          .select('*')
          .order('role', { ascending: true })
          .order('created_at', { ascending: true })
        if (error) throw error
        return res.status(200).json({ keys: (data || []).map(publicRow) })
      }

      case 'create': {
        const staff = await staffFromRequest(supabase, req)
        if (!staff || !atLeast(staff.role, 'sysadmin')) return res.status(401).json({ error: 'Unauthorized.' })
        const role = String(body.role || '').trim()
        const name = String(body.name || '').trim()
        if (!ROLES.includes(role)) return res.status(400).json({ error: `Role must be one of: ${ROLES.join(', ')}.` })
        if (!name) return res.status(400).json({ error: 'A name is required so keys can be told apart.' })

        const key = generateKey()
        const { data, error } = await supabase
          .from('staff_keys')
          .insert({
            role,
            name,
            key_hash: hashKey(key),
            key_prefix: keyPrefix(key),
            active: true,
            created_by: staff.name || staff.id
          })
          .select('*')
          .single()
        if (error) throw error

        // The only time the plaintext key is ever returned.
        return res.status(200).json({ key, staff: publicRow(data) })
      }

      case 'revoke': {
        const staff = await staffFromRequest(supabase, req)
        if (!staff || !atLeast(staff.role, 'sysadmin')) return res.status(401).json({ error: 'Unauthorized.' })
        const id = body.id
        if (!id) return res.status(400).json({ error: 'Key id required.' })
        if (id === staff.id) return res.status(400).json({ error: 'You cannot revoke the key you are signed in with.' })
        const { error } = await supabase.from('staff_keys').update({ active: false }).eq('id', id)
        if (error) throw error
        return res.status(200).json({ ok: true })
      }

      default:
        return res.status(400).json({ error: 'Unknown action.' })
    }
  } catch (err) {
    console.error('staff api error:', action, err)
    return res.status(500).json({ error: err.message || 'Server error.' })
  }
}

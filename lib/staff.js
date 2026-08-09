// Staff login keys.
//
// A key is the whole credential, so it is treated like a password: only its
// SHA-256 hash is stored, and the plaintext is shown once at generation time
// and never again. SHA-256 without a slow KDF is deliberate and safe here —
// keys are randomly generated with ~54 bits of entropy, so there is no
// low-entropy secret to grind, unlike a human-chosen password.
import crypto from 'node:crypto'

export const ROLES = ['sysadmin', 'admin', 'manager', 'rider']

// Higher wins. Used for "this endpoint needs at least manager" style checks.
const RANK = { rider: 1, manager: 2, admin: 3, sysadmin: 4 }

// No O/0, I/1, L — keys get read aloud and typed on phones.
const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'

const randomChars = (n) => {
  const bytes = crypto.randomBytes(n)
  let out = ''
  for (let i = 0; i < n; i++) out += ALPHABET[bytes[i] % ALPHABET.length]
  return out
}

/** Generate a key in XXX-XXXX-XXXX form. */
export const generateKey = () => `${randomChars(3)}-${randomChars(4)}-${randomChars(4)}`

/** Accept sloppy input: lowercase, spaces, missing dashes. */
export const normalizeKey = (raw) => {
  const clean = String(raw || '').toUpperCase().replace(/[^A-Z0-9]/g, '')
  if (clean.length !== 11) return null
  return `${clean.slice(0, 3)}-${clean.slice(3, 7)}-${clean.slice(7, 11)}`
}

export const hashKey = (key) => crypto.createHash('sha256').update(key, 'utf8').digest('hex')

/** First segment, stored in the clear so the UI can tell keys apart. */
export const keyPrefix = (key) => key.slice(0, 3)

export const atLeast = (role, minimum) => (RANK[role] || 0) >= (RANK[minimum] || 99)

/**
 * Gate an endpoint at `minRole`, accepting either a staff key or the legacy
 * admin password. The admin password counts as role `admin`, which keeps
 * /admin working unchanged while Manager and Rider come in via keys.
 * Returns the caller, or null if they may not proceed.
 */
export async function authorize(supabase, req, minRole) {
  const pw = process.env.ADMIN_PASSWORD
  if (pw && req.headers['x-admin-password'] === pw) {
    return atLeast('admin', minRole) ? { id: 'admin-password', role: 'admin', name: 'Admin' } : null
  }
  const staff = await staffFromRequest(supabase, req)
  if (!staff) return null
  return atLeast(staff.role, minRole) ? staff : null
}

/**
 * Resolve the `x-staff-key` header to a staff row.
 * Returns null for missing, malformed, unknown, or revoked keys — the caller
 * should not distinguish between these in its response.
 */
export async function staffFromRequest(supabase, req) {
  const normalized = normalizeKey(req.headers['x-staff-key'])
  if (!normalized) return null

  const { data, error } = await supabase
    .from('staff_keys')
    .select('id, role, name, active')
    .eq('key_hash', hashKey(normalized))
    .maybeSingle()

  if (error || !data || !data.active) return null

  // Fire-and-forget: last_used_at is for the audit list, not the auth decision.
  supabase
    .from('staff_keys')
    .update({ last_used_at: new Date().toISOString() })
    .eq('id', data.id)
    .then(null, (err) => console.warn('last_used_at update failed:', err?.message))

  return { id: data.id, role: data.role, name: data.name }
}

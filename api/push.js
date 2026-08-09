import { admin, pushConfigured, sendToSubscriptions } from '../lib/push.js'

// Same normaliser as the client and api/customers.js, so phones match up.
const normalizePhone = (raw) => {
  const digits = String(raw || '').replace(/\D/g, '')
  if (!digits) return null
  let local
  if (digits.startsWith('94') && digits.length === 11) local = digits.slice(2)
  else if (digits.startsWith('0') && digits.length === 10) local = digits.slice(1)
  else if (digits.length === 9) local = digits
  else return null
  return '+94' + local
}

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

  const requireAdmin = () =>
    process.env.ADMIN_PASSWORD && req.headers['x-admin-password'] === process.env.ADMIN_PASSWORD

  try {
    switch (action) {
      // ── Public: store/refresh this device's push subscription ─────────
      case 'subscribe': {
        const sub = body.subscription
        if (!sub?.endpoint || !sub?.keys?.p256dh || !sub?.keys?.auth) {
          return res.status(400).json({ error: 'A complete push subscription is required.' })
        }
        const phone = normalizePhone(body.phone)
        const now = new Date().toISOString()
        const row = {
          endpoint: sub.endpoint,
          p256dh: sub.keys.p256dh,
          auth: sub.keys.auth,
          customer_phone: phone,
          installed: !!body.installed,
          user_agent: String(req.headers['user-agent'] || '').slice(0, 300),
          last_seen: now,
          fail_count: 0
        }
        const { error } = await supabase.from('push_subscriptions').upsert(row, { onConflict: 'endpoint' })
        if (error) throw error

        if (phone) await markCustomer(supabase, phone, { push_opted_in: true, installed: !!body.installed })
        return res.status(200).json({ ok: true })
      }

      // ── Public: forget this device ────────────────────────────────────
      case 'unsubscribe': {
        const endpoint = body.endpoint || body.subscription?.endpoint
        if (!endpoint) return res.status(400).json({ error: 'Endpoint required.' })
        const { error } = await supabase.from('push_subscriptions').delete().eq('endpoint', endpoint)
        if (error) throw error
        return res.status(200).json({ ok: true })
      }

      // ── Public: record that the app is installed, even without push ───
      // Covers iOS users who add to home screen but decline notifications.
      case 'recordInstall': {
        const phone = normalizePhone(body.phone)
        if (!phone) return res.status(400).json({ error: 'Invalid phone.' })
        await markCustomer(supabase, phone, { installed: !!body.installed })
        return res.status(200).json({ ok: true })
      }

      // ── Admin: reach counts ───────────────────────────────────────────
      case 'stats': {
        if (!requireAdmin()) return res.status(401).json({ error: 'Unauthorized.' })
        const { data, error } = await supabase
          .from('push_subscriptions')
          .select('customer_phone, installed')
        if (error) throw error
        const rows = data || []
        const { count: installedCustomers } = await supabase
          .from('customers')
          .select('phone', { count: 'exact', head: true })
          .eq('installed_pwa', true)
        return res.status(200).json({
          configured: pushConfigured(),
          devices: rows.length,
          installedDevices: rows.filter((r) => r.installed).length,
          identifiedCustomers: new Set(rows.map((r) => r.customer_phone).filter(Boolean)).size,
          installedCustomers: installedCustomers || 0
        })
      }

      // ── Admin: promo broadcast to every subscribed device ─────────────
      case 'broadcast': {
        if (!requireAdmin()) return res.status(401).json({ error: 'Unauthorized.' })
        if (!pushConfigured()) return res.status(500).json({ error: 'Push is not configured (VAPID keys missing).' })
        const title = String(body.title || '').trim()
        const message = String(body.body || '').trim()
        if (!title || !message) return res.status(400).json({ error: 'Title and message are required.' })

        const { data, error } = await supabase
          .from('push_subscriptions')
          .select('endpoint, p256dh, auth')
        if (error) throw error

        const result = await sendToSubscriptions(data || [], {
          title,
          body: message,
          url: body.url || '/promotions',
          tag: 'promo'
        })
        return res.status(200).json(result)
      }

      // ── Admin: send a test push to one endpoint ───────────────────────
      case 'test': {
        if (!requireAdmin()) return res.status(401).json({ error: 'Unauthorized.' })
        const endpoint = body.endpoint
        if (!endpoint) return res.status(400).json({ error: 'Endpoint required.' })
        const { data, error } = await supabase
          .from('push_subscriptions')
          .select('endpoint, p256dh, auth')
          .eq('endpoint', endpoint)
          .maybeSingle()
        if (error) throw error
        if (!data) return res.status(404).json({ error: 'That subscription is not registered.' })
        const result = await sendToSubscriptions([data], {
          title: 'Test notification',
          body: 'Push notifications are working.',
          url: '/',
          tag: 'test'
        })
        return res.status(200).json(result)
      }

      default:
        return res.status(400).json({ error: 'Unknown action.' })
    }
  } catch (err) {
    console.error('push api error:', action, err)
    return res.status(500).json({ error: err.message || 'Server error.' })
  }
}

// Best-effort flags on the customer record. A missing customer is fine —
// people can subscribe before they've ever placed an order.
async function markCustomer(supabase, phone, { push_opted_in, installed }) {
  try {
    const patch = {}
    if (push_opted_in) patch.push_opted_in = true
    if (installed) {
      patch.installed_pwa = true
      patch.installed_at = new Date().toISOString()
    }
    if (!Object.keys(patch).length) return
    await supabase.from('customers').update(patch).eq('phone', phone)
  } catch (err) {
    console.warn('markCustomer failed:', err.message)
  }
}

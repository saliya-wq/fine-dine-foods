// Shared web-push sender. Used by api/push.js (broadcasts) and api/orders.js
// (order status updates), so the VAPID setup and dead-subscription pruning
// live in exactly one place.
import webpush from 'web-push'
import { createClient } from '@supabase/supabase-js'

const URL = process.env.SUPABASE_URL
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

export const admin = () => createClient(URL, SERVICE_KEY, { auth: { persistSession: false } })

export const pushConfigured = () =>
  !!(process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY)

let vapidReady = false
const ensureVapid = () => {
  if (vapidReady) return
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT || 'mailto:orders@example.com',
    process.env.VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY
  )
  vapidReady = true
}

const toSubscription = (r) => ({
  endpoint: r.endpoint,
  keys: { p256dh: r.p256dh, auth: r.auth }
})

/**
 * Send one payload to many stored subscriptions.
 * Subscriptions the push service reports as gone (404/410) are deleted;
 * other failures just bump fail_count so a transient outage doesn't wipe
 * the list. Never throws — returns a summary instead.
 */
export async function sendToSubscriptions(rows, payload) {
  if (!pushConfigured()) return { sent: 0, failed: 0, removed: 0, skipped: 'push not configured' }
  if (!rows?.length) return { sent: 0, failed: 0, removed: 0 }
  ensureVapid()

  const supabase = admin()
  const body = JSON.stringify(payload)
  const gone = []
  let sent = 0
  let failed = 0

  await Promise.all(
    rows.map(async (r) => {
      try {
        await webpush.sendNotification(toSubscription(r), body, { TTL: 60 * 60 * 24 })
        sent++
      } catch (err) {
        failed++
        if (err.statusCode === 404 || err.statusCode === 410) gone.push(r.endpoint)
        else console.error('push send failed:', err.statusCode, r.endpoint?.slice(0, 40))
      }
    })
  )

  if (gone.length) {
    await supabase.from('push_subscriptions').delete().in('endpoint', gone)
  }
  return { sent, failed, removed: gone.length }
}

/** Send to every device belonging to one customer. */
export async function sendToCustomer(phone, payload) {
  if (!phone || !pushConfigured()) return { sent: 0, failed: 0, removed: 0 }
  const supabase = admin()
  const { data, error } = await supabase
    .from('push_subscriptions')
    .select('endpoint, p256dh, auth')
    .eq('customer_phone', phone)
  if (error) {
    console.error('push lookup failed:', error.message)
    return { sent: 0, failed: 0, removed: 0 }
  }
  return sendToSubscriptions(data || [], payload)
}

// Web-push opt-in helpers.
//
// iOS is the awkward one: Safari only exposes PushManager when the site has
// been added to the home screen, so on iPhone the honest prompt is "install
// first, then enable notifications" rather than a permission button that
// cannot work.

const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY || ''

export const isStandalone = () =>
  window.matchMedia?.('(display-mode: standalone)').matches || window.navigator.standalone === true

export const isIOS = () =>
  /iPad|iPhone|iPod/.test(navigator.userAgent) ||
  (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)

export const pushSupported = () =>
  'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window

export const pushConfigured = () => !!VAPID_PUBLIC_KEY

export const permission = () => (('Notification' in window) ? Notification.permission : 'unsupported')

// Why the opt-in UI can't be offered right now, or null if it can.
export const blockedReason = () => {
  if (!pushConfigured()) return 'not-configured'
  if (!pushSupported()) return isIOS() && !isStandalone() ? 'ios-needs-install' : 'unsupported'
  if (permission() === 'denied') return 'denied'
  return null
}

const urlBase64ToUint8Array = (base64String) => {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw = window.atob(base64)
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)))
}

const post = async (payload) => {
  const res = await fetch('/api/push', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`)
  return data
}

export const existingSubscription = async () => {
  if (!pushSupported()) return null
  const reg = await navigator.serviceWorker.ready
  return reg.pushManager.getSubscription()
}

/**
 * Ask for permission and register this device. Must be called from a user
 * gesture — browsers reject permission prompts otherwise.
 */
export async function subscribe(phone) {
  if (!pushConfigured()) throw new Error('Notifications are not configured yet.')
  if (!pushSupported()) {
    throw new Error(
      isIOS()
        ? 'On iPhone, add this site to your home screen first — then notifications can be turned on.'
        : 'This browser does not support notifications.'
    )
  }

  const result = await Notification.requestPermission()
  if (result !== 'granted') throw new Error('Notifications were not allowed.')

  const reg = await navigator.serviceWorker.ready
  const sub =
    (await reg.pushManager.getSubscription()) ||
    (await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY)
    }))

  await post({
    action: 'subscribe',
    subscription: sub.toJSON(),
    phone: phone || null,
    installed: isStandalone()
  })
  return sub
}

export async function unsubscribe() {
  const sub = await existingSubscription()
  if (!sub) return
  await post({ action: 'unsubscribe', endpoint: sub.endpoint }).catch(() => {})
  await sub.unsubscribe().catch(() => {})
}

/**
 * Re-register an existing subscription against a customer once they identify
 * themselves, and record home-screen installs (including iOS users who never
 * enable push). Safe to call on every load; failures are ignored.
 */
export async function syncInstallState(phone) {
  if (!phone) return
  try {
    const sub = await existingSubscription()
    if (sub) {
      await post({ action: 'subscribe', subscription: sub.toJSON(), phone, installed: isStandalone() })
    } else if (isStandalone()) {
      await post({ action: 'recordInstall', phone, installed: true })
    }
  } catch {
    // Tracking only — never surface this to the customer.
  }
}

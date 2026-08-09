import { useEffect, useState } from 'react'
import { useCustomers } from './customerStore.jsx'
import { blockedReason, existingSubscription, isIOS, subscribe, unsubscribe } from './push.js'

/**
 * Opt-in card for order/promo notifications. Renders nothing when push can't
 * work at all, so it never shows a button that is guaranteed to fail — except
 * on iOS-before-install, where the useful thing to say is "add to home screen".
 */
export default function NotifyOptIn({ compact = false }) {
  const { active } = useCustomers()
  const [subscribed, setSubscribed] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    let cancelled = false
    existingSubscription()
      .then((sub) => {
        if (!cancelled) {
          setSubscribed(!!sub)
          setReady(true)
        }
      })
      .catch(() => !cancelled && setReady(true))
    return () => {
      cancelled = true
    }
  }, [])

  const reason = blockedReason()

  if (!ready) return null
  if (reason === 'not-configured' || reason === 'unsupported') return null

  if (reason === 'ios-needs-install') {
    return (
      <Shell compact={compact}>
        <p className="font-semibold mb-1">Get order updates on your iPhone</p>
        <p className="text-sm text-calista-ink/70">
          In Safari, tap <strong>Share</strong> → <strong>Add to Home Screen</strong>, then open the app from your
          home screen and turn on notifications.
        </p>
      </Shell>
    )
  }

  if (reason === 'denied') {
    return (
      <Shell compact={compact}>
        <p className="font-semibold mb-1">Notifications are blocked</p>
        <p className="text-sm text-calista-ink/70">
          You've blocked notifications for this site. Allow them in your browser settings
          {isIOS() ? '' : ' (padlock icon in the address bar)'} to get order updates.
        </p>
      </Shell>
    )
  }

  const onEnable = async () => {
    setBusy(true)
    setError(null)
    try {
      await subscribe(active?.phone)
      setSubscribed(true)
    } catch (err) {
      setError(err.message || 'Could not turn on notifications.')
    } finally {
      setBusy(false)
    }
  }

  const onDisable = async () => {
    setBusy(true)
    setError(null)
    try {
      await unsubscribe()
      setSubscribed(false)
    } catch (err) {
      setError(err.message || 'Could not turn off notifications.')
    } finally {
      setBusy(false)
    }
  }

  if (subscribed) {
    return (
      <Shell compact={compact}>
        <p className="font-semibold mb-1">🔔 Notifications are on</p>
        <p className="text-sm text-calista-ink/70 mb-2">
          We'll let you know as your order moves along, plus the occasional offer.
        </p>
        <button
          onClick={onDisable}
          disabled={busy}
          className="text-sm text-calista-ink/50 underline underline-offset-4 hover:text-calista-ink disabled:opacity-50"
        >
          {busy ? 'Turning off…' : 'Turn off'}
        </button>
        {error && <p className="text-sm text-red-600 mt-2">{error}</p>}
      </Shell>
    )
  }

  return (
    <Shell compact={compact}>
      <p className="font-semibold mb-1">Know the moment it's ready</p>
      <p className="text-sm text-calista-ink/70 mb-3">
        Turn on notifications and we'll tell you as your order moves along — no need to keep this page open.
      </p>
      <button
        onClick={onEnable}
        disabled={busy}
        className="bg-calista-ink text-calista-cream px-5 py-2.5 rounded-full text-sm font-semibold hover:bg-calista-gold hover:text-calista-ink transition disabled:opacity-50"
      >
        {busy ? 'Just a moment…' : 'Turn on notifications'}
      </button>
      {error && <p className="text-sm text-red-600 mt-2">{error}</p>}
    </Shell>
  )
}

function Shell({ compact, children }) {
  return (
    <div
      className={`bg-calista-cream/60 border border-calista-ink/10 rounded-lg ${
        compact ? 'p-4 text-left' : 'p-5 text-left'
      }`}
    >
      {children}
    </div>
  )
}

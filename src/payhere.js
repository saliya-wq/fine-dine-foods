// PayHere JavaScript SDK loader + popup checkout.
//
// The hash is never computed here — it needs the merchant secret, so the
// whole payment object comes from /api/payment, which prices the order from
// the database rather than trusting anything the browser sends.

const SDK_URL = 'https://www.payhere.lk/lib/payhere.js'

let sdkPromise = null

function loadSdk() {
  if (window.payhere) return Promise.resolve(window.payhere)
  if (sdkPromise) return sdkPromise
  sdkPromise = new Promise((resolve, reject) => {
    const script = document.createElement('script')
    script.src = SDK_URL
    script.async = true
    script.onload = () => (window.payhere ? resolve(window.payhere) : reject(new Error('PayHere SDK failed to load.')))
    script.onerror = () => {
      sdkPromise = null
      reject(new Error('Could not reach PayHere. Check your connection and try again.'))
    }
    document.head.appendChild(script)
  })
  return sdkPromise
}

/**
 * Open the PayHere popup for an order.
 * Resolves 'completed' once the customer finishes the flow, or 'dismissed' if
 * they close it. Note that 'completed' means the popup closed cleanly, NOT
 * that the money arrived — only the server-side notify callback confirms that,
 * so the caller must never treat this as proof of payment.
 */
export async function payForOrder(orderId) {
  const res = await fetch('/api/payment', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'start', orderId })
  })
  const payment = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(payment.error || 'Could not start the payment.')

  const payhere = await loadSdk()

  return new Promise((resolve, reject) => {
    payhere.onCompleted = () => resolve('completed')
    payhere.onDismissed = () => resolve('dismissed')
    payhere.onError = (msg) => reject(new Error(msg || 'The payment could not be processed.'))
    payhere.startPayment(payment)
  })
}

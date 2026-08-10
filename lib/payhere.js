// PayHere Checkout integration helpers.
//
// Formulas are PayHere's, from support.payhere.lk/api-&-mobile-sdk/checkout-api:
//   hash   = UPPER(md5( merchant_id + order_id + amount + currency + UPPER(md5(secret)) ))
//   md5sig = UPPER(md5( merchant_id + order_id + payhere_amount + payhere_currency
//                       + status_code + UPPER(md5(secret)) ))
// The amount must be formatted to exactly 2 decimals with no thousands
// separator, and the same string must be used in the hash and in the request.
import crypto from 'node:crypto'

export const CURRENCY = 'LKR'

export const isSandbox = () => process.env.PAYHERE_SANDBOX !== 'false'

export const payhereConfigured = () =>
  !!(process.env.PAYHERE_MERCHANT_ID && process.env.PAYHERE_MERCHANT_SECRET)

const md5Upper = (s) => crypto.createHash('md5').update(String(s), 'utf8').digest('hex').toUpperCase()

/** PayHere wants "1250.00", never "1,250" or "1250". */
export const formatAmount = (n) => (Number(n) || 0).toFixed(2)

export function checkoutHash({ merchantId, orderId, amount, currency = CURRENCY }) {
  const secret = process.env.PAYHERE_MERCHANT_SECRET
  return md5Upper(`${merchantId}${orderId}${amount}${currency}${md5Upper(secret)}`)
}

/**
 * Verify a payment notification actually came from PayHere.
 * Without this check anyone could POST to the notify endpoint and mark an
 * order paid, so this is the single most important line in the integration.
 */
export function verifyNotification({ merchant_id, order_id, payhere_amount, payhere_currency, status_code, md5sig }) {
  const secret = process.env.PAYHERE_MERCHANT_SECRET
  if (!secret || !md5sig) return false
  const expected = md5Upper(
    `${merchant_id}${order_id}${payhere_amount}${payhere_currency}${status_code}${md5Upper(secret)}`
  )
  // Both sides are fixed-length hex; timingSafeEqual needs equal lengths.
  const a = Buffer.from(expected)
  const b = Buffer.from(String(md5sig).toUpperCase())
  return a.length === b.length && crypto.timingSafeEqual(a, b)
}

// PayHere's status_code values.
export const paymentStatusFor = (statusCode) => {
  switch (String(statusCode)) {
    case '2':
      return 'paid'
    case '0':
      return 'pending'
    case '-1':
      return 'cancelled'
    case '-2':
      return 'failed'
    case '-3':
      return 'chargedback'
    default:
      return 'unknown'
  }
}

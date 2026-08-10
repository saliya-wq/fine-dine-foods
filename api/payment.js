import { admin } from '../lib/push.js'
import { CURRENCY, checkoutHash, formatAmount, isSandbox, payhereConfigured } from '../lib/payhere.js'

// PayHere requires a non-empty address/city/country even for pick-up.
const FALLBACK_ADDRESS = 'Collection at restaurant'
const FALLBACK_CITY = 'Colombo'

const splitName = (full) => {
  const parts = String(full || '').trim().split(/\s+/).filter(Boolean)
  if (!parts.length) return { first: 'Customer', last: '-' }
  if (parts.length === 1) return { first: parts[0], last: '-' }
  return { first: parts.slice(0, -1).join(' '), last: parts[parts.length - 1] }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body || {}
  const supabase = admin()

  try {
    // Lets the checkout hide online payment when the gateway isn't wired up,
    // rather than stranding orders at `pending` with no way to pay.
    if (body.action === 'config') {
      return res.status(200).json({ online: payhereConfigured() })
    }
    if (body.action !== 'start') return res.status(400).json({ error: 'Unknown action.' })
    if (!payhereConfigured()) {
      return res.status(503).json({ error: 'Online payment is not configured yet. Please choose cash instead.' })
    }

    const id = String(body.orderId || '').trim().toUpperCase()
    if (!id) return res.status(400).json({ error: 'Order id required.' })

    const { data: order, error } = await supabase.from('orders').select('*').eq('id', id).maybeSingle()
    if (error) throw error
    if (!order) return res.status(404).json({ error: 'Order not found.' })
    if (order.payment_type !== 'online') {
      return res.status(400).json({ error: 'That order is not an online payment.' })
    }
    if (order.payment_status === 'paid') {
      return res.status(400).json({ error: 'That order is already paid.' })
    }

    const merchantId = process.env.PAYHERE_MERCHANT_ID
    // Always price from the stored order, never from the client.
    const amount = formatAmount(order.total)
    const hash = checkoutHash({ merchantId, orderId: order.id, amount, currency: CURRENCY })

    const origin = `https://${req.headers['x-forwarded-host'] || req.headers.host}`
    const { first, last } = splitName(order.customer_name)

    return res.status(200).json({
      sandbox: isSandbox(),
      merchant_id: merchantId,
      return_url: `${origin}/track/${order.id}`,
      cancel_url: `${origin}/track/${order.id}`,
      notify_url: `${origin}/api/payhere-notify`,
      order_id: order.id,
      items: `Order ${order.id}`,
      amount,
      currency: CURRENCY,
      hash,
      first_name: first,
      last_name: last,
      email: order.customer_email || 'noreply@example.com',
      phone: order.customer_phone || '',
      address: order.address || FALLBACK_ADDRESS,
      city: FALLBACK_CITY,
      country: 'Sri Lanka'
    })
  } catch (err) {
    console.error('payment api error:', err)
    return res.status(500).json({ error: err.message || 'Server error.' })
  }
}

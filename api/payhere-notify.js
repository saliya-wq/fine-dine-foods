import { admin } from '../lib/push.js'
import { logOrderEvent } from '../lib/audit.js'
import { formatAmount, paymentStatusFor, verifyNotification } from '../lib/payhere.js'

// Server-to-server callback from PayHere. This is the only thing that can
// mark an order paid, so nothing here trusts the request until md5sig checks
// out. PayHere posts application/x-www-form-urlencoded and retries unless it
// gets a 200, so this always answers 200 once the notification is handled.
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return res.status(405).send('Method not allowed')
  }

  const body = typeof req.body === 'string' ? Object.fromEntries(new URLSearchParams(req.body)) : req.body || {}
  const {
    merchant_id,
    order_id,
    payment_id,
    payhere_amount,
    payhere_currency,
    status_code,
    md5sig,
    method,
    status_message
  } = body

  if (!verifyNotification({ merchant_id, order_id, payhere_amount, payhere_currency, status_code, md5sig })) {
    console.error('payhere notify: signature rejected for order', order_id)
    return res.status(403).send('Invalid signature')
  }
  if (merchant_id !== process.env.PAYHERE_MERCHANT_ID) {
    console.error('payhere notify: merchant mismatch', merchant_id)
    return res.status(403).send('Invalid merchant')
  }

  const supabase = admin()
  const id = String(order_id || '').trim().toUpperCase()
  const paymentStatus = paymentStatusFor(status_code)

  try {
    const { data: order, error } = await supabase
      .from('orders')
      .select('id, total, payment_status, payment_id')
      .eq('id', id)
      .maybeSingle()
    if (error) throw error
    if (!order) {
      // Nothing to attach it to; 200 so PayHere stops retrying a dead order.
      console.error('payhere notify: unknown order', id)
      return res.status(200).send('OK')
    }

    // PayHere can deliver the same notification more than once.
    if (order.payment_status === paymentStatus && order.payment_id === payment_id) {
      return res.status(200).send('OK')
    }

    const patch = {
      payment_status: paymentStatus,
      payment_id: payment_id || null,
      payment_method: method || null,
      updated_at: new Date().toISOString()
    }
    if (paymentStatus === 'paid') patch.paid_at = new Date().toISOString()

    const { error: updErr } = await supabase.from('orders').update(patch).eq('id', id)
    if (updErr) throw updErr

    // A signed notification whose amount doesn't match what we charged is not
    // something to swallow — record it so it can be reconciled by hand.
    const expected = formatAmount(order.total)
    const mismatch = paymentStatus === 'paid' && String(payhere_amount) !== expected

    await logOrderEvent(supabase, {
      orderId: id,
      actor: { id: 'payhere', role: 'gateway', name: 'PayHere' },
      event: 'payment',
      toStatus: paymentStatus,
      detail: [
        `${paymentStatus}${method ? ` via ${method}` : ''}`,
        `${payhere_currency} ${payhere_amount}`,
        mismatch ? `AMOUNT MISMATCH — expected ${expected}` : null,
        status_message || null
      ]
        .filter(Boolean)
        .join(' · ')
    })

    if (mismatch) console.error('payhere notify: amount mismatch on', id, payhere_amount, 'expected', expected)

    return res.status(200).send('OK')
  } catch (err) {
    // 500 makes PayHere retry, which is what we want for a transient DB error.
    console.error('payhere notify error:', id, err)
    return res.status(500).send('Error')
  }
}

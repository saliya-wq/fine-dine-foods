const escapeHtml = (s = '') =>
  String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]))

const formatLKR = (n) =>
  `Rs. ${Number(n || 0).toLocaleString('en-LK', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body || {}
  const {
    table,
    mode,
    name,
    phone,
    address,
    location,
    deliveryDistanceKm,
    outOfZone,
    time,
    notes,
    items = [],
    customer = null,
    subtotal = 0,
    discountAmount = 0,
    discountPercent = 0,
    serviceCharge = 0,
    serviceChargePercent = 0,
    deliveryFee = 0,
    total = 0
  } = body

  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: 'Order must contain at least one item.' })
  }

  const RECEPTION_EMAIL = process.env.RECEPTION_EMAIL
  const RESEND_API_KEY = process.env.RESEND_API_KEY
  const FROM_EMAIL = process.env.RESEND_FROM_EMAIL || 'Calista Orders <onboarding@resend.dev>'

  if (!RECEPTION_EMAIL || !RESEND_API_KEY) {
    console.error('Missing RECEPTION_EMAIL or RESEND_API_KEY env vars.')
    return res.status(500).json({ error: 'Email is not configured on the server. Contact the restaurant directly.' })
  }

  const orderId = `CAL-${Date.now().toString().slice(-6)}`

  const subject =
    mode === 'table'
      ? `[Table ${table}] New order ${orderId}`
      : `[${(mode || 'order').toUpperCase()}] New order ${orderId}`

  const itemRows = items
    .map(
      (i) => `
        <tr>
          <td style="padding: 6px 0; border-bottom: 1px solid #eee;">${i.qty}× ${escapeHtml(i.name)}</td>
          <td style="padding: 6px 0; border-bottom: 1px solid #eee; text-align: right; white-space: nowrap;">${formatLKR(
            (Number(i.price) || 0) * (Number(i.qty) || 0)
          )}</td>
        </tr>`
    )
    .join('')

  const html = `
    <div style="font-family: 'Inter', system-ui, sans-serif; background: #faf6ef; padding: 24px;">
      <div style="max-width: 600px; margin: auto; background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 24px rgba(0,0,0,0.06);">
        <div style="background: #0f172a; color: #c8a96a; padding: 24px;">
          <h1 style="margin: 0; font-size: 24px; letter-spacing: 0.05em;">Calista — New Order</h1>
          <p style="margin: 4px 0 0; color: #faf6ef; font-size: 14px;">${escapeHtml(orderId)}</p>
        </div>
        <div style="padding: 24px; color: #0f172a;">
          ${mode === 'table' ? `<div style="background: #c8a96a; color: #0f172a; padding: 12px; border-radius: 8px; text-align: center; margin-bottom: 16px;"><div style="font-size: 11px; text-transform: uppercase; letter-spacing: 0.2em;">Table</div><div style="font-size: 28px; font-weight: bold;">${escapeHtml(table)}</div></div>` : ''}
          ${mode && mode !== 'table' ? `<p><strong>Type:</strong> ${escapeHtml(mode)}</p>` : ''}
          ${
            customer
              ? `<div style="background: #faf6ef; border-left: 3px solid #c8a96a; padding: 10px 14px; margin-bottom: 16px;">
                  <p style="margin: 0;"><strong>${escapeHtml(customer.name)}</strong> · <a href="tel:${escapeHtml(customer.phone)}">${escapeHtml(customer.phone)}</a></p>
                  <p style="margin: 4px 0 0; font-size: 13px; color: #555;">Visit #${Number(customer.visits) + 1} · ${escapeHtml(customer.tier || 'Customer')} tier</p>
                </div>`
              : ''
          }
          ${!customer && name ? `<p><strong>Customer:</strong> ${escapeHtml(name)}</p>` : ''}
          ${!customer && phone ? `<p><strong>Phone:</strong> <a href="tel:${escapeHtml(phone)}">${escapeHtml(phone)}</a></p>` : ''}
          ${address ? `<p><strong>Address:</strong> ${escapeHtml(address)}</p>` : ''}
          ${location ? `<p><strong>📍 Location:</strong> <a href="${escapeHtml(location)}" style="color: #c8a96a; font-weight: 600;">Open in Google Maps</a></p>` : ''}
          ${deliveryDistanceKm != null ? `<p><strong>Distance:</strong> ~${escapeHtml(deliveryDistanceKm)} km${outOfZone ? ' <span style="color: #b45309; font-weight: 600;">(outside delivery zone — confirm before dispatch)</span>' : ''}</p>` : ''}
          ${time ? `<p><strong>Requested time:</strong> ${escapeHtml(time)}</p>` : ''}

          <h2 style="font-size: 16px; color: #c8a96a; margin: 24px 0 8px; text-transform: uppercase; letter-spacing: 0.1em;">Items</h2>
          <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
            ${itemRows}
            <tr>
              <td style="padding: 8px 0;">Subtotal</td>
              <td style="padding: 8px 0; text-align: right;">${formatLKR(subtotal)}</td>
            </tr>
            ${
              Number(discountAmount) > 0
                ? `<tr><td style="padding: 4px 0; color: #c8a96a;">Loyalty discount (${Number(discountPercent)}%)</td><td style="padding: 4px 0; text-align: right; color: #c8a96a;">− ${formatLKR(discountAmount)}</td></tr>`
                : ''
            }
            ${
              Number(serviceCharge) > 0
                ? `<tr><td style="padding: 4px 0;">Service charge (${Number(serviceChargePercent)}%)</td><td style="padding: 4px 0; text-align: right;">${formatLKR(serviceCharge)}</td></tr>`
                : ''
            }
            ${
              Number(deliveryFee) > 0
                ? `<tr><td style="padding: 4px 0;">Delivery</td><td style="padding: 4px 0; text-align: right;">${formatLKR(deliveryFee)}</td></tr>`
                : ''
            }
            <tr style="border-top: 2px solid #0f172a;">
              <td style="padding: 10px 0; font-weight: bold; font-size: 16px;">Total</td>
              <td style="padding: 10px 0; font-weight: bold; font-size: 16px; text-align: right;">${formatLKR(total)}</td>
            </tr>
          </table>

          ${
            notes
              ? `<h2 style="font-size: 16px; color: #c8a96a; margin: 24px 0 8px; text-transform: uppercase; letter-spacing: 0.1em;">Notes</h2><p style="background: #faf6ef; padding: 12px; border-radius: 6px; white-space: pre-line;">${escapeHtml(notes)}</p>`
              : ''
          }
        </div>
        <div style="background: #faf6ef; padding: 12px 24px; font-size: 12px; color: #94918d; text-align: center;">
          Order placed at ${new Date().toLocaleString('en-GB', { timeZone: 'Asia/Colombo', dateStyle: 'medium', timeStyle: 'short' })} (Colombo time)
        </div>
      </div>
    </div>
  `

  try {
    const r = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        from: FROM_EMAIL,
        to: RECEPTION_EMAIL,
        reply_to: phone ? undefined : undefined,
        subject,
        html
      })
    })

    if (!r.ok) {
      const errText = await r.text()
      console.error('Resend API error:', r.status, errText)
      return res.status(502).json({ error: 'Email service rejected the request.', detail: errText })
    }

    return res.status(200).json({ orderId })
  } catch (err) {
    console.error('Failed to call Resend:', err)
    return res.status(500).json({ error: 'Failed to send order email.' })
  }
}

import { createClient } from '@supabase/supabase-js'
import { pipelineFor, statusLabel } from '../src/orderStatus.js'
import { sendToCustomer } from '../lib/push.js'
import { authorize } from '../lib/staff.js'
import { customerActor, logOrderEvent } from '../lib/audit.js'
import { payhereConfigured } from '../lib/payhere.js'
import { priceOrder } from '../lib/pricing.js'

/**
 * Write a new status, record who did it, and notify the customer. Shared by
 * the manager path and the rider path so both produce identical side effects.
 * The push is best-effort: it must never fail the status change itself.
 */
async function applyStatus(supabase, id, status, previousStatus, actor) {
  const { data, error } = await supabase
    .from('orders')
    .update({ status, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select('*')
    .single()
  if (error) throw error

  if (status !== previousStatus) {
    await logOrderEvent(supabase, {
      orderId: id,
      actor,
      event: 'status',
      fromStatus: previousStatus,
      toStatus: status
    })
  }

  let push = null
  if (status !== previousStatus && data.customer_phone) {
    push = await sendToCustomer(data.customer_phone, {
      title: `Order ${data.id} — ${statusLabel(status)}`,
      body: customerMessage(status, data.mode),
      url: `/track/${data.id}`,
      tag: `order-${data.id}`
    }).catch((err) => {
      console.error('status push failed:', err)
      return null
    })
  }

  return { order: toAdminOrder(data), push }
}

const URL = process.env.SUPABASE_URL
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

const admin = () => createClient(URL, SERVICE_KEY, { auth: { persistSession: false } })

// Unambiguous alphabet — no O/0, I/1, L. 31^6 ≈ 887M, so ids are not guessable.
const ID_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'
const newOrderId = () => {
  let s = ''
  for (let i = 0; i < 6; i++) s += ID_ALPHABET[Math.floor(Math.random() * ID_ALPHABET.length)]
  return `CAL-${s}`
}

const int = (n) => Math.round(Number(n) || 0)

// Sri Lanka is UTC+5:30 and observes no DST, so a fixed offset is exact.
// Everything date-shaped in reporting must go through this — grouping raw UTC
// puts every order placed after 18:30 UTC on the wrong business day.
const COLOMBO_OFFSET_MS = 5.5 * 60 * 60 * 1000
const colomboDate = (iso) => new Date(new Date(iso).getTime() + COLOMBO_OFFSET_MS).toISOString().slice(0, 10)

/** The last `n` Colombo dates, oldest first, ending today. */
const recentColomboDates = (n) => {
  const todayMs = new Date(colomboDate(new Date().toISOString()) + 'T00:00:00Z').getTime()
  return Array.from({ length: n }, (_, i) => new Date(todayMs - (n - 1 - i) * 86400000).toISOString().slice(0, 10))
}

// One more visit and the order's server-priced total for a known customer.
// Unknown phones are skipped: customers are created at the menu's phone gate.
async function countVisit(supabase, phone, total) {
  const { data, error } = await supabase
    .from('customers')
    .select('visits, total_spent')
    .eq('phone', phone)
    .maybeSingle()
  if (error) throw error
  if (!data) return
  const { error: upErr } = await supabase
    .from('customers')
    .update({
      visits: data.visits + 1,
      total_spent: Number(data.total_spent) + total,
      last_seen: new Date().toISOString()
    })
    .eq('phone', phone)
  if (upErr) throw upErr
}

// What the customer sees on the tracking page. Never exposes phone or rider.
const toPublicOrder = (r) => ({
  id: r.id,
  createdAt: r.created_at,
  mode: r.mode,
  status: r.status,
  table: r.table_no,
  paymentType: r.payment_type,
  paymentStatus: r.payment_status,
  address: r.address || '',
  requestedTime: r.requested_time || '',
  notes: r.notes || '',
  items: r.items || [],
  subtotal: r.subtotal,
  discountAmount: r.discount_amount,
  serviceCharge: r.service_charge,
  deliveryFee: r.delivery_fee,
  total: r.total
})

// The manager/admin view — everything.
const toAdminOrder = (r) => ({
  ...toPublicOrder(r),
  customerName: r.customer_name || '',
  customerPhone: r.customer_phone || '',
  customerEmail: r.customer_email || '',
  paymentType: r.payment_type,
  paymentStatus: r.payment_status,
  paymentMethod: r.payment_method || '',
  paidAt: r.paid_at,
  location: r.location || '',
  deliveryDistanceKm: r.delivery_distance_km,
  outOfZone: r.out_of_zone,
  riderId: r.rider_id || null,
  updatedAt: r.updated_at
})

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return res.status(405).json({ error: 'Method not allowed' })
  }
  if (!URL || !SERVICE_KEY) {
    return res.status(500).json({ error: 'Server not configured (Supabase env vars missing).' })
  }

  const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body || {}
  const action = body.action || 'place'
  const supabase = admin()

  // Manager and above may run the order queue; the admin password still
  // counts as `admin`, so /admin keeps working.
  const requireStaff = (minRole = 'manager') => authorize(supabase, req, minRole)

  try {
    switch (action) {
      // ── Public: place an order ────────────────────────────────────────
      case 'place': {
        const items = Array.isArray(body.items) ? body.items : []
        if (items.length === 0) {
          return res.status(400).json({ error: 'Order must contain at least one item.' })
        }
        const mode = ['delivery', 'pickup', 'table'].includes(body.mode) ? body.mode : 'pickup'

        // Dine-in is always settled at the restaurant; pick-up and delivery
        // choose online or cash at checkout.
        // Fall back to cash if the gateway isn't configured — a stale client
        // must never be able to create an order nobody can pay for.
        const wantsOnline = body.paymentType === 'online' && payhereConfigured()
        const paymentType = mode === 'table' ? 'at_restaurant' : wantsOnline ? 'online' : 'cash'

        // Every amount is recomputed from the DB; the client's figures are
        // only used to catch a stale page, never stored.
        const location = mode === 'delivery' ? body.location || null : null
        const priced = await priceOrder(supabase, {
          mode,
          items,
          phone: body.customer?.phone || body.phone,
          location
        })
        if (priced.error) return res.status(priced.status).json({ error: priced.error })
        const t = priced.totals
        // The customer agreed to the total they saw. If ours differs (a price
        // or setting changed since their page loaded), stop rather than
        // charge or collect an amount they never saw.
        if (Math.abs(int(body.total) - int(t.total)) > 1) {
          return res.status(409).json({
            error: 'Prices have changed since you opened the menu. Please refresh the page and check your order.',
            total: int(t.total)
          })
        }

        const row = {
          id: newOrderId(),
          mode,
          status: 'placed',
          table_no: mode === 'table' && body.table != null ? int(body.table) : null,
          customer_name: body.customer?.name || body.name || null,
          customer_phone: body.customer?.phone || body.phone || null,
          customer_email: body.email || null,
          payment_type: paymentType,
          // Online orders stay `pending` and out of the manager queue until
          // PayHere confirms; everything else is simply due on handover.
          payment_status: paymentType === 'online' ? 'pending' : 'due',
          address: mode === 'delivery' ? body.address || null : null,
          location,
          delivery_distance_km: priced.deliveryDistanceKm,
          out_of_zone: priced.outOfZone,
          requested_time: body.time || null,
          notes: body.notes || null,
          items: priced.items,
          subtotal: int(t.subtotal),
          discount_amount: int(t.discountAmount),
          discount_percent: t.discountPercent,
          service_charge: int(t.serviceCharge),
          service_charge_percent: t.serviceChargePercent,
          delivery_fee: int(t.deliveryFee),
          total: int(t.total)
        }

        const { data, error } = await supabase.from('orders').insert(row).select('*').single()
        if (error) throw error

        // Units ordered, not distinct lines — "1 item" for 2× Funghi reads wrong.
        const itemCount = row.items.reduce((n, i) => n + i.qty, 0)
        await logOrderEvent(supabase, {
          orderId: data.id,
          actor: customerActor(data.customer_name),
          event: 'placed',
          toStatus: 'placed',
          detail: `${data.mode} · ${itemCount} item${itemCount === 1 ? '' : 's'}`
        })

        // Loyalty is counted here, from the order we just priced, so the
        // public customers API can't be used to climb tiers. Best-effort:
        // a failure here must not lose a placed order.
        if (priced.phone) {
          await countVisit(supabase, priced.phone, row.total).catch((err) =>
            console.error('visit count failed:', data.id, err)
          )
        }

        // Best-effort: keep reception's email alert alive until the manager
        // console lands. Never fails the order.
        notifyReception(data).catch((err) => console.error('reception email failed:', err))

        return res.status(200).json({ orderId: data.id })
      }

      // ── Public: fetch one order for the tracking page ─────────────────
      case 'get': {
        const id = String(body.id || '').trim().toUpperCase()
        if (!id) return res.status(400).json({ error: 'Order id required.' })
        const { data, error } = await supabase.from('orders').select('*').eq('id', id).maybeSingle()
        if (error) throw error
        if (!data) return res.status(404).json({ error: 'Order not found.' })
        return res.status(200).json({ order: toPublicOrder(data) })
      }

      // ── Admin: recent orders ──────────────────────────────────────────
      case 'list': {
        if (!(await requireStaff())) return res.status(401).json({ error: 'Unauthorized.' })
        const limit = Math.min(int(body.limit) || 100, 500)
        let q = supabase.from('orders').select('*').order('created_at', { ascending: false }).limit(limit)
        // An online order the customer never paid for is not a real order —
        // keep it out of the queue unless somebody explicitly asks for them.
        if (!body.includeUnpaid) q = q.neq('payment_status', 'pending')
        if (body.status) q = q.eq('status', body.status)
        if (body.mode) q = q.eq('mode', body.mode)
        const { data, error } = await q
        if (error) throw error
        return res.status(200).json({ orders: (data || []).map(toAdminOrder) })
      }

      // ── Admin: move an order along its pipeline ───────────────────────
      case 'updateStatus': {
        const actor = await requireStaff()
        if (!actor) return res.status(401).json({ error: 'Unauthorized.' })
        const id = String(body.id || '').trim().toUpperCase()
        const status = String(body.status || '').trim()
        if (!id || !status) return res.status(400).json({ error: 'Order id and status required.' })

        const { data: existing, error: findErr } = await supabase
          .from('orders')
          .select('mode, status, customer_phone, rider_id')
          .eq('id', id)
          .maybeSingle()
        if (findErr) throw findErr
        if (!existing) return res.status(404).json({ error: 'Order not found.' })

        const allowed = [...pipelineFor(existing.mode), 'cancelled']
        if (!allowed.includes(status)) {
          return res.status(400).json({ error: `Status "${status}" is not valid for a ${existing.mode} order.` })
        }
        // Nothing leaves the restaurant unattributed. Enforced here and not
        // only in the console, so a direct API call can't sidestep it.
        if (status === 'out_for_delivery' && existing.mode === 'delivery' && !existing.rider_id) {
          return res.status(400).json({ error: 'Assign a rider before marking this order out for delivery.' })
        }

        const result = await applyStatus(supabase, id, status, existing.status, actor)
        return res.status(200).json(result)
      }

      // ── Manager+: daily takings ───────────────────────────────────────
      // Grouped by the ORDER's Colombo date, not UTC — a 1am order otherwise
      // lands on the previous day and the till never reconciles.
      case 'takings': {
        if (!(await requireStaff())) return res.status(401).json({ error: 'Unauthorized.' })
        const days = Math.min(Math.max(int(body.days) || 7, 1), 62)
        // Reach back an extra day so the oldest Colombo day is complete.
        const since = new Date(Date.now() - (days + 1) * 86400000).toISOString()

        const { data, error } = await supabase
          .from('orders')
          .select('id, created_at, mode, status, total, payment_type, payment_status')
          .gte('created_at', since)
          .order('created_at', { ascending: true })
        if (error) throw error

        const wanted = recentColomboDates(days)
        const blank = () => ({
          orders: 0,
          cancelled: 0,
          revenue: 0,
          collected: 0,
          outstanding: 0,
          cash: 0,
          online: 0,
          atRestaurant: 0,
          delivery: 0,
          pickup: 0,
          table: 0
        })
        const byDate = Object.fromEntries(wanted.map((d) => [d, blank()]))

        for (const o of data || []) {
          const day = byDate[colomboDate(o.created_at)]
          if (!day) continue
          if (o.status === 'cancelled') {
            day.cancelled++
            continue
          }
          // Unpaid online orders were never really placed — exclude entirely.
          if (o.payment_type === 'online' && o.payment_status === 'pending') continue

          const total = Number(o.total) || 0
          day.orders++
          day.revenue += total
          day[o.mode] = (day[o.mode] || 0) + total
          if (o.payment_status === 'paid') {
            day.collected += total
            if (o.payment_type === 'online') day.online += total
            else if (o.payment_type === 'cash') day.cash += total
            else day.atRestaurant += total
          } else {
            day.outstanding += total
          }
        }

        const series = wanted.map((date) => ({ date, ...byDate[date] }))
        const totals = series.reduce((acc, d) => {
          for (const k of Object.keys(blank())) acc[k] = (acc[k] || 0) + d[k]
          return acc
        }, {})

        return res.status(200).json({ days: series, totals, today: series[series.length - 1] })
      }

      // ── Manager+: who touched this order ──────────────────────────────
      case 'history': {
        if (!(await requireStaff())) return res.status(401).json({ error: 'Unauthorized.' })
        const id = String(body.id || '').trim().toUpperCase()
        if (!id) return res.status(400).json({ error: 'Order id required.' })
        const { data, error } = await supabase
          .from('order_events')
          .select('*')
          .eq('order_id', id)
          .order('at', { ascending: true })
        if (error) throw error
        return res.status(200).json({
          events: (data || []).map((e) => ({
            at: e.at,
            event: e.event,
            actorName: e.actor_name,
            actorRole: e.actor_role,
            fromStatus: e.from_status,
            toStatus: e.to_status,
            detail: e.detail
          }))
        })
      }

      // ── Rider: only their own runs ────────────────────────────────────
      case 'myDeliveries': {
        const staff = await authorize(supabase, req, 'rider')
        if (!staff || staff.role !== 'rider') return res.status(401).json({ error: 'Unauthorized.' })
        const { data, error } = await supabase
          .from('orders')
          .select('*')
          .eq('rider_id', staff.id)
          .order('created_at', { ascending: true })
        if (error) throw error
        const rows = (data || []).map(toAdminOrder)
        return res.status(200).json({
          orders: rows.filter((o) => o.status !== 'delivered' && o.status !== 'cancelled'),
          completedToday: rows.filter(
            (o) => o.status === 'delivered' && new Date(o.updatedAt).toDateString() === new Date().toDateString()
          ).length
        })
      }

      // ── Rider: the two transitions a rider actually owns ──────────────
      // Scoped hard: only their own order, and only these two states, so a
      // rider key can never move an order through the kitchen or cancel it.
      case 'riderStatus': {
        const rider = await authorize(supabase, req, 'rider')
        if (!rider || rider.role !== 'rider') return res.status(401).json({ error: 'Unauthorized.' })
        const id = String(body.id || '').trim().toUpperCase()
        const status = String(body.status || '').trim()
        if (!['out_for_delivery', 'delivered'].includes(status)) {
          return res.status(400).json({ error: 'Riders can only mark an order picked up or delivered.' })
        }

        const { data: existing, error: findErr } = await supabase
          .from('orders')
          .select('mode, status, rider_id')
          .eq('id', id)
          .maybeSingle()
        if (findErr) throw findErr
        if (!existing || existing.rider_id !== rider.id) {
          return res.status(404).json({ error: 'That delivery is not assigned to you.' })
        }
        if (existing.status === 'cancelled') {
          return res.status(400).json({ error: 'That order was cancelled.' })
        }

        const result = await applyStatus(supabase, id, status, existing.status, rider)
        return res.status(200).json(result)
      }

      // ── Record cash changing hands ────────────────────────────────────
      // A manager can settle any order; a rider only the run they carried.
      // Reversing a mistake is manager+ only, so a rider can't quietly undo
      // money they were supposed to hand in.
      case 'markPaid': {
        const actor = await authorize(supabase, req, 'rider')
        if (!actor) return res.status(401).json({ error: 'Unauthorized.' })
        const id = String(body.id || '').trim().toUpperCase()
        if (!id) return res.status(400).json({ error: 'Order id required.' })
        const paid = body.paid !== false

        const { data: order, error: findErr } = await supabase
          .from('orders')
          .select('id, rider_id, payment_type, payment_status, total')
          .eq('id', id)
          .maybeSingle()
        if (findErr) throw findErr
        if (!order) return res.status(404).json({ error: 'Order not found.' })

        const isRider = actor.role === 'rider'
        if (isRider && order.rider_id !== actor.id) {
          return res.status(404).json({ error: 'That delivery is not assigned to you.' })
        }
        if (isRider && !paid) {
          return res.status(403).json({ error: 'Only a manager can reverse a payment.' })
        }
        if (order.payment_type === 'online') {
          return res.status(400).json({ error: 'That order is paid through the gateway, not by hand.' })
        }

        const { data, error } = await supabase
          .from('orders')
          .update({
            payment_status: paid ? 'paid' : 'due',
            payment_method: paid ? 'cash' : null,
            paid_at: paid ? new Date().toISOString() : null,
            updated_at: new Date().toISOString()
          })
          .eq('id', id)
          .select('*')
          .single()
        if (error) throw error

        await logOrderEvent(supabase, {
          orderId: id,
          actor,
          event: 'payment',
          toStatus: paid ? 'paid' : 'due',
          detail: paid ? `Cash collected · ${order.total}` : 'Payment reversed — marked unpaid'
        })

        return res.status(200).json({ order: toAdminOrder(data) })
      }

      // ── Manager+: put a delivery order in a rider's queue ─────────────
      case 'assignRider': {
        const actor = await requireStaff()
        if (!actor) return res.status(401).json({ error: 'Unauthorized.' })
        const id = String(body.id || '').trim().toUpperCase()
        if (!id) return res.status(400).json({ error: 'Order id required.' })
        const riderId = body.riderId || null

        let riderName = null
        if (riderId) {
          const { data: rider, error: riderErr } = await supabase
            .from('staff_keys')
            .select('id, role, active, name')
            .eq('id', riderId)
            .maybeSingle()
          if (riderErr) throw riderErr
          if (!rider || !rider.active || rider.role !== 'rider') {
            return res.status(400).json({ error: 'That rider is not available.' })
          }
          riderName = rider.name
        }

        const { data, error } = await supabase
          .from('orders')
          .update({ rider_id: riderId, updated_at: new Date().toISOString() })
          .eq('id', id)
          .select('*')
          .single()
        if (error) throw error

        await logOrderEvent(supabase, {
          orderId: id,
          actor,
          event: riderId ? 'assign_rider' : 'unassign_rider',
          detail: riderName ? `Assigned to ${riderName}` : 'Rider removed'
        })

        return res.status(200).json({ order: toAdminOrder(data) })
      }

      default:
        return res.status(400).json({ error: 'Unknown action.' })
    }
  } catch (err) {
    console.error('orders api error:', action, err)
    return res.status(500).json({ error: err.message || 'Server error.' })
  }
}

// Customer-facing wording for each status. Deliberately plain — this is the
// line that shows on a lock screen.
const customerMessage = (status, mode) => {
  switch (status) {
    case 'received':
      return 'We’ve got your order and it’s in the queue.'
    case 'processing':
      return 'The kitchen has started on your order.'
    case 'ready_for_delivery':
      return 'Your order is packed and waiting for a rider.'
    case 'out_for_delivery':
      return 'Your order is on its way to you.'
    case 'delivered':
      return 'Your order has been delivered. Enjoy!'
    case 'ready_for_collection':
      return 'Your order is ready — come and collect it whenever you like.'
    case 'ready':
      return 'Your order is ready.'
    case 'served':
      return 'Your order has been served. Enjoy!'
    case 'cancelled':
      return 'Your order was cancelled. Please call us if that’s unexpected.'
    default:
      return mode === 'delivery' ? 'There’s an update on your delivery.' : 'There’s an update on your order.'
  }
}

// ── Reception email (optional) ───────────────────────────────────────────
// Interim notification channel; drops out silently once the env vars are
// removed, and is replaced by the manager console in a later phase.

const escapeHtml = (s = '') =>
  String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]))

const formatLKR = (n) =>
  `Rs. ${Number(n || 0).toLocaleString('en-LK', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

async function notifyReception(o) {
  const RECEPTION_EMAIL = process.env.RECEPTION_EMAIL
  const RESEND_API_KEY = process.env.RESEND_API_KEY
  if (!RECEPTION_EMAIL || !RESEND_API_KEY) return

  const FROM_EMAIL = process.env.RESEND_FROM_EMAIL || 'Calista Orders <onboarding@resend.dev>'
  const subject =
    o.mode === 'table'
      ? `[Table ${o.table_no}] New order ${o.id}`
      : `[${String(o.mode).toUpperCase()}] New order ${o.id}`

  const itemRows = (o.items || [])
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

  const line = (label, value) => (value ? `<p><strong>${label}:</strong> ${escapeHtml(value)}</p>` : '')
  const extraRow = (label, value, color) =>
    Number(value) > 0
      ? `<tr><td style="padding: 4px 0;${color ? `color:${color};` : ''}">${label}</td><td style="padding: 4px 0; text-align: right;${
          color ? `color:${color};` : ''
        }">${formatLKR(value)}</td></tr>`
      : ''

  const html = `
    <div style="font-family: 'Inter', system-ui, sans-serif; background: #faf6ef; padding: 24px;">
      <div style="max-width: 600px; margin: auto; background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 24px rgba(0,0,0,0.06);">
        <div style="background: #0f172a; color: #c8a96a; padding: 24px;">
          <h1 style="margin: 0; font-size: 24px; letter-spacing: 0.05em;">New Order</h1>
          <p style="margin: 4px 0 0; color: #faf6ef; font-size: 14px;">${escapeHtml(o.id)}</p>
        </div>
        <div style="padding: 24px; color: #0f172a;">
          ${
            o.mode === 'table'
              ? `<div style="background: #c8a96a; color: #0f172a; padding: 12px; border-radius: 8px; text-align: center; margin-bottom: 16px;"><div style="font-size: 11px; text-transform: uppercase; letter-spacing: 0.2em;">Table</div><div style="font-size: 28px; font-weight: bold;">${escapeHtml(o.table_no)}</div></div>`
              : `<p><strong>Type:</strong> ${escapeHtml(o.mode)}</p>`
          }
          ${line('Customer', o.customer_name)}
          ${o.customer_phone ? `<p><strong>Phone:</strong> <a href="tel:${escapeHtml(o.customer_phone)}">${escapeHtml(o.customer_phone)}</a></p>` : ''}
          ${line('Address', o.address)}
          ${o.location ? `<p><strong>📍 Location:</strong> <a href="${escapeHtml(o.location)}" style="color: #c8a96a; font-weight: 600;">Open in Google Maps</a></p>` : ''}
          ${
            o.delivery_distance_km != null
              ? `<p><strong>Distance:</strong> ~${escapeHtml(o.delivery_distance_km)} km${o.out_of_zone ? ' <span style="color: #b45309; font-weight: 600;">(outside delivery zone — confirm before dispatch)</span>' : ''}</p>`
              : ''
          }
          ${line('Requested time', o.requested_time)}

          <h2 style="font-size: 16px; color: #c8a96a; margin: 24px 0 8px; text-transform: uppercase; letter-spacing: 0.1em;">Items</h2>
          <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
            ${itemRows}
            <tr>
              <td style="padding: 8px 0;">Subtotal</td>
              <td style="padding: 8px 0; text-align: right;">${formatLKR(o.subtotal)}</td>
            </tr>
            ${extraRow(`Loyalty discount (${Number(o.discount_percent)}%)`, o.discount_amount, '#c8a96a')}
            ${extraRow(`Service charge (${Number(o.service_charge_percent)}%)`, o.service_charge)}
            ${extraRow('Delivery', o.delivery_fee)}
            <tr style="border-top: 2px solid #0f172a;">
              <td style="padding: 10px 0; font-weight: bold; font-size: 16px;">Total</td>
              <td style="padding: 10px 0; font-weight: bold; font-size: 16px; text-align: right;">${formatLKR(o.total)}</td>
            </tr>
          </table>

          ${
            o.notes
              ? `<h2 style="font-size: 16px; color: #c8a96a; margin: 24px 0 8px; text-transform: uppercase; letter-spacing: 0.1em;">Notes</h2><p style="background: #faf6ef; padding: 12px; border-radius: 6px; white-space: pre-line;">${escapeHtml(o.notes)}</p>`
              : ''
          }
        </div>
        <div style="background: #faf6ef; padding: 12px 24px; font-size: 12px; color: #94918d; text-align: center;">
          Order placed at ${new Date(o.created_at).toLocaleString('en-GB', { timeZone: 'Asia/Colombo', dateStyle: 'medium', timeStyle: 'short' })} (Colombo time)
        </div>
      </div>
    </div>
  `

  const r = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: FROM_EMAIL, to: RECEPTION_EMAIL, subject, html })
  })
  if (!r.ok) throw new Error(`Resend ${r.status}: ${await r.text()}`)
}

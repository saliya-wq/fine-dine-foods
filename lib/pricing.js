import { DEFAULT_ORDERING, getTier, computeOrderTotals } from '../src/pricing.js'
import { parseLatLng, distanceKm, feeForDistance, RESTAURANT_LOCATION, DELIVERY_RADIUS_KM } from '../src/delivery.js'
import { normalizePhone } from './phone.js'

const MAX_QTY = 50

/**
 * Price an order from the database, ignoring every amount the client sent.
 * Returns { items, totals, phone, visits, deliveryDistanceKm, outOfZone },
 * or { status, error } when the order can't be priced as asked.
 */
export async function priceOrder(supabase, { mode, items, phone, location }) {
  // Merge repeated lines; the client only gets to choose ids and quantities.
  const qtyById = new Map()
  for (const i of items) {
    const id = String(i?.id ?? '')
    const qty = Math.floor(Number(i?.qty))
    if (!id || !Number.isFinite(qty) || qty < 1) return { status: 400, error: 'Every item needs a quantity of at least 1.' }
    qtyById.set(id, (qtyById.get(id) || 0) + qty)
  }
  for (const qty of qtyById.values()) {
    if (qty > MAX_QTY) return { status: 400, error: `At most ${MAX_QTY} of any one item per order — please call us for larger orders.` }
  }

  const ids = [...qtyById.keys()]
  const [menu, ordering] = await Promise.all([
    supabase.from('menu_items').select('id, name, price, available').in('id', ids),
    supabase.from('site_settings').select('data').eq('id', 'ordering').maybeSingle()
  ])
  if (menu.error) throw menu.error
  if (ordering.error) throw ordering.error

  const byId = new Map((menu.data || []).map((m) => [m.id, m]))
  const priced = []
  for (const id of ids) {
    const m = byId.get(id)
    if (!m) return { status: 409, error: 'An item in your cart is no longer on the menu. Please refresh and review your order.' }
    if (!m.available) return { status: 409, error: `${m.name} is not available right now. Please remove it from your cart.` }
    priced.push({ id: m.id, name: m.name, price: m.price, qty: qtyById.get(id) })
  }

  const settings = { ...DEFAULT_ORDERING, ...(ordering.data?.data || {}) }

  // Loyalty discount from the customer's recorded visits, never the client's claim.
  const normalized = normalizePhone(phone)
  let visits = 0
  if (normalized) {
    const { data, error } = await supabase.from('customers').select('visits').eq('phone', normalized).maybeSingle()
    if (error) throw error
    visits = data?.visits || 0
  }
  const discountPercent = normalized ? getTier(visits, settings.loyaltyTiers)?.discountPercent || 0 : 0

  let deliveryDistanceKm = null
  let outOfZone = false
  let deliveryFee = 0
  if (mode === 'delivery') {
    const coords = parseLatLng(location)
    const km = coords ? distanceKm(RESTAURANT_LOCATION, coords) : null
    deliveryDistanceKm = km != null ? Math.round(km * 10) / 10 : null
    outOfZone = km != null && km > DELIVERY_RADIUS_KM
    deliveryFee = feeForDistance(km)
  }

  const subtotal = priced.reduce((n, i) => n + i.price * i.qty, 0)
  const totals = computeOrderTotals({
    subtotal,
    serviceChargePercent: mode === 'table' ? settings.serviceChargePercent : 0,
    discountPercent,
    deliveryFee
  })

  return { items: priced, totals, phone: normalized, visits, deliveryDistanceKm, outOfZone }
}

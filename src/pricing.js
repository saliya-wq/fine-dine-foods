// Pure order-pricing rules, shared by the browser (cart/checkout preview) and
// the server (api/orders.js re-prices every order). No React, no I/O.

export const DEFAULT_TIERS = [
  { name: 'New', minVisits: 0, discountPercent: 0 },
  { name: 'Returning', minVisits: 1, discountPercent: 5 },
  { name: 'Regular', minVisits: 5, discountPercent: 10 },
  { name: 'VIP', minVisits: 15, discountPercent: 15 }
]

// What every client uses until a sysadmin saves the 'ordering' settings row.
export const DEFAULT_ORDERING = {
  serviceChargePercent: 15,
  loyaltyTiers: DEFAULT_TIERS
}

export const calcServiceCharge = (subtotal, percent) =>
  ((Number(subtotal) || 0) * (Number(percent) || 0)) / 100

export const getTier = (visits, tiers) => {
  const sorted = [...(tiers || DEFAULT_TIERS)].sort((a, b) => b.minVisits - a.minVisits)
  for (const t of sorted) {
    if (visits >= t.minVisits) return t
  }
  return sorted[sorted.length - 1] || { name: 'New', minVisits: 0, discountPercent: 0 }
}

export const computeOrderTotals = ({
  subtotal = 0,
  serviceChargePercent = 0,
  discountPercent = 0,
  deliveryFee = 0
}) => {
  const sub = Number(subtotal) || 0
  const dp = Number(discountPercent) || 0
  const sp = Number(serviceChargePercent) || 0
  const fee = Number(deliveryFee) || 0
  const discountAmount = (sub * dp) / 100
  const discountedSubtotal = sub - discountAmount
  const serviceCharge = (discountedSubtotal * sp) / 100
  const total = discountedSubtotal + serviceCharge + fee
  return {
    subtotal: sub,
    discountAmount,
    discountPercent: dp,
    serviceCharge,
    serviceChargePercent: sp,
    deliveryFee: fee,
    total
  }
}

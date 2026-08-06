// Delivery zone + distance-based fee. Edit these for your restaurant.

// Calista's coordinates, from https://maps.app.goo.gl/JdHky6AiEgBVpuZN6
export const RESTAURANT_LOCATION = { lat: 7.248039, lng: 79.851491 }

// Straight-line ("as the crow flies") delivery radius in km.
// Pins beyond this are warned, not blocked.
export const DELIVERY_RADIUS_KM = 8

// Fee tiers by straight-line distance — the first tier whose maxKm >= distance wins.
export const DELIVERY_FEE_TIERS = [
  { maxKm: 3, fee: 300 },
  { maxKm: 6, fee: 500 },
  { maxKm: 8, fee: 800 }
]

// Fee applied when the pin is beyond DELIVERY_RADIUS_KM (order still allowed).
export const OUT_OF_ZONE_FEE = 800

// Fee used when no map pin is shared and distance is unknown.
export const DEFAULT_DELIVERY_FEE = 500

// Great-circle (Haversine) distance in km between two { lat, lng } points.
export function distanceKm(a, b) {
  const R = 6371
  const toRad = (d) => (d * Math.PI) / 180
  const dLat = toRad(b.lat - a.lat)
  const dLng = toRad(b.lng - a.lng)
  const lat1 = toRad(a.lat)
  const lat2 = toRad(b.lat)
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(h))
}

// Pull { lat, lng } out of a captured or pasted Google Maps link.
// Handles our own `?q=lat,lng` links and `@lat,lng` share URLs; returns null otherwise.
export function parseLatLng(url) {
  if (!url) return null
  const m = String(url).match(/(-?\d+\.\d+)\s*,\s*\+?\s*(-?\d+\.\d+)/)
  if (!m) return null
  const lat = parseFloat(m[1])
  const lng = parseFloat(m[2])
  if (Number.isNaN(lat) || Number.isNaN(lng)) return null
  return { lat, lng }
}

// Delivery fee for a given straight-line distance (km), or null distance = unknown.
export function feeForDistance(km) {
  if (km == null) return DEFAULT_DELIVERY_FEE
  if (km > DELIVERY_RADIUS_KM) return OUT_OF_ZONE_FEE
  const tier = DELIVERY_FEE_TIERS.find((t) => km <= t.maxKm)
  return tier ? tier.fee : OUT_OF_ZONE_FEE
}

import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useCart } from '../cart.jsx'
import { useTable } from '../tableSession.jsx'
import { useCustomers } from '../customerStore.jsx'
import { useSettings, getTier, computeOrderTotals } from '../settingsStore.jsx'
import { formatLKR } from '../format.js'
import NotifyOptIn from '../NotifyOptIn.jsx'
import {
  RESTAURANT_LOCATION,
  DELIVERY_RADIUS_KM,
  distanceKm,
  parseLatLng,
  feeForDistance
} from '../delivery.js'

export default function Checkout() {
  const { items, subtotal, clear } = useCart()
  const { table, setTable } = useTable()
  const { active, recordOrder } = useCustomers()
  const { serviceChargePercent, loyaltyTiers } = useSettings()
  const navigate = useNavigate()
  const [mode, setMode] = useState(() =>
    sessionStorage.getItem('calista_fulfillment') === 'delivery' ? 'delivery' : 'pickup'
  )
  const [placed, setPlaced] = useState(null)
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState(null)
  const [warning, setWarning] = useState(null)
  const [locating, setLocating] = useState(false)
  const [locationError, setLocationError] = useState(null)
  const [form, setForm] = useState({
    name: active?.name || '',
    phone: '',
    address: active?.address || '',
    time: '',
    notes: '',
    location: active?.location || ''
  })

  const shareLocation = () => {
    if (!navigator.geolocation) {
      setLocationError('Location is not supported on this device. Paste a Google Maps link instead.')
      return
    }
    setLocating(true)
    setLocationError(null)

    const onOk = (pos) => {
      const { latitude, longitude } = pos.coords
      const link = `https://www.google.com/maps?q=${latitude.toFixed(6)},${longitude.toFixed(6)}`
      setForm((f) => ({ ...f, location: link }))
      setLocating(false)
    }

    const messageFor = (err) => {
      if (err.code === 1)
        return 'Location was blocked for this site. Allow it in your browser and retry — or paste a Google Maps link.'
      if (err.code === 2)
        return 'Your device couldn’t get a location fix. On Mac, turn on System Settings → Privacy & Security → Location Services (and enable your browser), then retry — or paste a Google Maps link.'
      if (err.code === 3)
        return 'Getting your location timed out. Retry, or paste a Google Maps link.'
      return 'Could not get your location. Paste a Google Maps link instead.'
    }

    // High-accuracy first; if that fails (common on desktop), retry at low accuracy.
    navigator.geolocation.getCurrentPosition(
      onOk,
      () =>
        navigator.geolocation.getCurrentPosition(
          onOk,
          (err) => {
            setLocationError(messageFor(err))
            setLocating(false)
          },
          { enableHighAccuracy: false, timeout: 15000, maximumAge: 60000 }
        ),
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 0 }
    )
  }

  const effectiveMode = table ? 'table' : mode
  const isTable = effectiveMode === 'table'

  const tier = active ? getTier(active.visits, loyaltyTiers) : null
  const discountPercent = tier?.discountPercent || 0

  const deliveryCoords = effectiveMode === 'delivery' ? parseLatLng(form.location) : null
  const deliveryDistance = deliveryCoords ? distanceKm(RESTAURANT_LOCATION, deliveryCoords) : null
  const outOfZone = deliveryDistance != null && deliveryDistance > DELIVERY_RADIUS_KM
  const deliveryFee = effectiveMode === 'delivery' ? feeForDistance(deliveryDistance) : 0
  const deliveryPinMissing = effectiveMode === 'delivery' && !deliveryCoords

  const totals = computeOrderTotals({
    subtotal,
    serviceChargePercent: isTable ? serviceChargePercent : 0,
    discountPercent,
    deliveryFee
  })

  const onSubmit = async (e) => {
    e.preventDefault()
    setSubmitError(null)
    setWarning(null)

    if (deliveryPinMissing) {
      setSubmitError('Please pin your delivery location so we can route the driver.')
      return
    }

    setSubmitting(true)

    const payload = {
      action: 'place',
      table: table || null,
      mode: effectiveMode,
      name: active?.name || null,
      phone: active?.phone || null,
      address: effectiveMode === 'delivery' ? form.address : null,
      location: effectiveMode === 'delivery' ? form.location || null : null,
      deliveryDistanceKm: deliveryDistance != null ? Number(deliveryDistance.toFixed(1)) : null,
      outOfZone: effectiveMode === 'delivery' ? outOfZone : false,
      time: effectiveMode === 'table' ? null : form.time || null,
      notes: form.notes || null,
      items: items.map((i) => ({ id: i.id, name: i.name, price: i.price, qty: i.qty })),
      customer: active
        ? { phone: active.phone, name: active.name, visits: active.visits, tier: tier?.name }
        : null,
      ...totals
    }

    let orderId
    try {
      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || `Server error (${res.status})`)
      }
      const data = await res.json()
      orderId = data.orderId
    } catch (err) {
      if (import.meta.env.DEV) {
        orderId = `CAL-${Date.now().toString().slice(-6)}`
        setWarning('Demo mode: the order was not saved — /api/orders is unavailable. Run `vercel dev` (or deploy) to hit the real orders endpoint. Tracking will not work for this order number.')
      } else {
        setSubmitError(err.message || 'Could not place order. Please try again or call us.')
        setSubmitting(false)
        return
      }
    }

    if (active) recordOrder(active.phone, totals.total, { address: form.address, location: form.location })
    setPlaced(orderId)
    clear()
    setSubmitting(false)
  }

  if (placed) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-20 text-center">
        <div className="w-16 h-16 mx-auto mb-6 rounded-full bg-calista-gold/20 flex items-center justify-center">
          <span className="text-calista-gold text-3xl">✓</span>
        </div>
        <h1 className="font-display text-4xl mb-4">Thank you!</h1>
        <p className="text-calista-ink/70 mb-2">
          {isTable
            ? 'Your order has been sent to the kitchen. A team member will be with you shortly.'
            : 'Your order has been received.'}
        </p>
        <p className="text-calista-gold font-semibold text-lg mb-2">Order #{placed}</p>
        {isTable && (
          <p className="text-sm text-calista-ink/60 mb-6">
            Want to order more? Browse the menu — you're still signed in at Table {table}.
          </p>
        )}
        {warning && (
          <p className="text-xs text-calista-ink/50 mb-8 max-w-md mx-auto bg-calista-cream border border-calista-ink/10 rounded-lg p-3">
            {warning}
          </p>
        )}

        {!warning && (
          <div className="max-w-md mx-auto mb-8">
            <NotifyOptIn compact />
          </div>
        )}
        <div className="flex flex-wrap gap-2 justify-center">
          {!warning && (
            <button
              onClick={() => navigate(`/track/${placed}`)}
              className="bg-calista-gold text-calista-ink px-6 py-3 rounded-full font-semibold hover:bg-calista-ink hover:text-calista-cream transition"
            >
              Track your order →
            </button>
          )}
          <button
            onClick={() => navigate(isTable ? '/menu' : '/')}
            className="px-6 py-3 rounded-full font-semibold border border-calista-ink/20 hover:border-calista-gold transition"
          >
            {isTable ? 'Add to order' : 'Back to home'}
          </button>
        </div>
      </div>
    )
  }

  if (items.length === 0) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-20 text-center">
        <p className="mb-4">Your cart is empty.</p>
        <Link to="/menu" className="text-calista-gold underline underline-offset-4">
          Browse the menu →
        </Link>
      </div>
    )
  }

  if (isTable) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-10">
        <button
          type="button"
          onClick={() => navigate('/menu')}
          className="text-sm text-calista-ink/60 hover:text-calista-gold inline-flex items-center gap-1 mb-4"
        >
          ← Edit order
        </button>

        <h1 className="font-display text-4xl mb-2">Review & confirm</h1>
        <p className="text-calista-ink/60 mb-6">
          Reception will receive your order by email immediately.
        </p>

        <div className="bg-calista-ink text-calista-cream rounded-lg p-6 mb-6 text-center">
          <p className="text-xs uppercase tracking-[0.3em] text-calista-gold mb-1">You are ordering for</p>
          <p className="font-display text-4xl">Table {table}</p>
          {active && (
            <p className="text-calista-cream/80 text-sm mt-2">
              {active.name}{tier?.discountPercent > 0 ? ` · ${tier.name} (${tier.discountPercent}% off)` : ''}
            </p>
          )}
        </div>

        <form onSubmit={onSubmit} className="space-y-4">
          <div className="bg-white border border-calista-ink/10 rounded-lg overflow-hidden">
            <div className="divide-y">
              {items.map((item) => (
                <div key={item.id} className="px-4 py-3 flex justify-between items-center text-sm">
                  <span>
                    <span className="font-semibold mr-2">{item.qty}×</span>
                    {item.name}
                  </span>
                  <span className="font-semibold">{formatLKR(item.price * item.qty)}</span>
                </div>
              ))}
            </div>
            <div className="bg-calista-cream/50 p-4 text-sm space-y-2">
              <Row label="Subtotal" value={formatLKR(subtotal)} />
              {totals.discountAmount > 0 && (
                <Row
                  label={`${tier.name} discount (${totals.discountPercent}%)`}
                  value={`− ${formatLKR(totals.discountAmount)}`}
                  highlight
                />
              )}
              <Row
                label={`Service charge (${totals.serviceChargePercent}%)`}
                value={formatLKR(totals.serviceCharge)}
              />
              <Row label="Total" value={formatLKR(totals.total)} bold />
            </div>
          </div>

          <Field
            label="Anything to tell the kitchen?"
            value={form.notes}
            onChange={(v) => setForm((f) => ({ ...f, notes: v }))}
            textarea
            placeholder="Allergies, spice level, dietary requests…"
          />

          {submitError && <p className="text-sm text-red-600">{submitError}</p>}

          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => navigate('/menu')}
              className="px-5 py-4 border border-calista-ink/20 rounded-full font-semibold text-sm hover:border-calista-gold"
            >
              Edit
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="flex-1 bg-calista-gold text-calista-ink py-4 rounded-full font-semibold hover:bg-calista-ink hover:text-calista-cream transition disabled:opacity-50"
            >
              {submitting ? 'Sending…' : `Send order to kitchen — ${formatLKR(totals.total)}`}
            </button>
          </div>
        </form>
      </div>
    )
  }

  if (!active) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-20 text-center">
        <h1 className="font-display text-3xl mb-3">Almost there</h1>
        <p className="text-calista-ink/70 mb-6">
          Please confirm your mobile number on the menu first so we can identify your order.
        </p>
        <Link
          to="/menu"
          className="inline-block bg-calista-ink text-calista-cream px-6 py-3 rounded-full font-semibold"
        >
          Go to menu
        </Link>
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-10">
      <button
        type="button"
        onClick={() => navigate('/cart')}
        className="text-sm text-calista-ink/60 hover:text-calista-gold inline-flex items-center gap-1 mb-4"
      >
        ← Edit order
      </button>

      <h1 className="font-display text-4xl mb-6">Checkout</h1>

      <div className="bg-calista-cream/60 border border-calista-ink/10 rounded-lg p-4 mb-6 flex items-center justify-between">
        <div className="min-w-0">
          <p className="font-semibold truncate">{active.name}</p>
          <p className="text-xs text-calista-ink/60">
            {active.phone}
            {tier?.discountPercent > 0 && ` · ${tier.name} (${tier.discountPercent}% off)`}
          </p>
        </div>
      </div>

      <div className="flex gap-2 mb-6">
        {['pickup', 'delivery'].map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => setMode(m)}
            className={`flex-1 py-3 rounded-full font-semibold capitalize transition ${
              mode === m
                ? 'bg-calista-ink text-calista-cream'
                : 'bg-white border border-calista-ink/20 hover:border-calista-gold'
            }`}
          >
            {m}
          </button>
        ))}
      </div>

      <form onSubmit={onSubmit} className="space-y-4">
        {mode === 'delivery' && (
          <>
            <Field
              label="Delivery address"
              placeholder="Street, area, Negombo"
              value={form.address}
              onChange={(v) => setForm((f) => ({ ...f, address: v }))}
              required
            />
            {active?.address && (
              <p className="-mt-2 text-xs text-calista-ink/50">
                Saved from your last order — edit if it's changed.
              </p>
            )}
            <div>
              <span className="text-sm font-medium block mb-1">
                Map location<span className="text-red-500"> *</span>
              </span>
              <p className="text-xs text-calista-ink/50 mb-2">
                Required for delivery — tap Share my location (or paste a Maps link with coordinates) so
                we can route the driver.
              </p>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={shareLocation}
                  disabled={locating}
                  className="px-4 py-2 rounded-full border border-calista-ink/20 text-sm font-semibold hover:border-calista-gold disabled:opacity-50"
                >
                  {locating ? 'Locating…' : form.location ? '📍 Update pin' : '📍 Share my location'}
                </button>
                {form.location && (
                  <>
                    <a
                      href={form.location}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-calista-gold font-semibold underline underline-offset-4"
                    >
                      View pin →
                    </a>
                    <button
                      type="button"
                      onClick={() => setForm((f) => ({ ...f, location: '' }))}
                      className="text-sm text-calista-ink/40 hover:text-calista-ink"
                    >
                      Clear
                    </button>
                  </>
                )}
              </div>
              {locationError && <p className="text-xs text-red-600 mt-2">{locationError}</p>}
              <input
                type="url"
                inputMode="url"
                placeholder="…or paste a Google Maps link"
                value={form.location}
                onChange={(e) => setForm((f) => ({ ...f, location: e.target.value }))}
                className="mt-2 w-full px-4 py-3 border border-calista-ink/20 rounded-lg focus:outline-none focus:border-calista-gold bg-white text-sm"
              />
              {form.location && !deliveryCoords && (
                <p className="mt-2 text-sm text-amber-700">
                  Couldn't read coordinates from that link. Tap "Share my location", or paste a link
                  that contains a lat, lng.
                </p>
              )}
              {deliveryDistance != null && (
                outOfZone ? (
                  <p className="mt-2 text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                    ⚠ You're about {deliveryDistance.toFixed(1)} km away — outside our {DELIVERY_RADIUS_KM} km
                    delivery area. We'll try, but reception may call to confirm.
                  </p>
                ) : (
                  <p className="mt-2 text-sm text-green-700">
                    ✓ Within delivery range · {deliveryDistance.toFixed(1)} km · delivery {formatLKR(deliveryFee)}
                  </p>
                )
              )}
            </div>
          </>
        )}
        <Field
          label={mode === 'pickup' ? 'Pickup time' : 'Preferred delivery time'}
          type="time"
          value={form.time}
          onChange={(v) => setForm((f) => ({ ...f, time: v }))}
          required
        />
        <Field
          label="Special instructions"
          value={form.notes}
          onChange={(v) => setForm((f) => ({ ...f, notes: v }))}
          textarea
        />

        <div className="bg-white border border-calista-ink/10 rounded-lg overflow-hidden">
          <div className="divide-y">
            {items.map((item) => (
              <div key={item.id} className="px-4 py-3 flex justify-between items-center text-sm">
                <span>
                  <span className="font-semibold mr-2">{item.qty}×</span>
                  {item.name}
                </span>
                <span className="font-semibold">{formatLKR(item.price * item.qty)}</span>
              </div>
            ))}
          </div>
          <div className="bg-calista-cream/50 p-4 text-sm space-y-2">
            <Row label="Subtotal" value={formatLKR(subtotal)} />
            {totals.discountAmount > 0 && (
              <Row
                label={`${tier.name} discount (${totals.discountPercent}%)`}
                value={`− ${formatLKR(totals.discountAmount)}`}
                highlight
              />
            )}
            {deliveryFee > 0 && (
              <Row
                label={deliveryDistance != null ? `Delivery (${deliveryDistance.toFixed(1)} km)` : 'Delivery'}
                value={formatLKR(deliveryFee)}
              />
            )}
            <Row label="Total" value={formatLKR(totals.total)} bold />
          </div>
        </div>

        {submitError && <p className="text-sm text-red-600">{submitError}</p>}

        {deliveryPinMissing && (
          <p className="text-sm text-calista-ink/50 text-center">
            📍 Pin your delivery location above to place the order.
          </p>
        )}

        <button
          type="submit"
          disabled={submitting || deliveryPinMissing}
          className="w-full bg-calista-gold text-calista-ink py-4 rounded-full font-semibold hover:bg-calista-ink hover:text-calista-cream transition disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {submitting ? 'Placing order…' : `Place order — ${formatLKR(totals.total)}`}
        </button>
      </form>
    </div>
  )
}

function Field({ label, value, onChange, type = 'text', required, textarea, placeholder }) {
  const common = {
    value,
    onChange: (e) => onChange(e.target.value),
    required,
    placeholder,
    className:
      'w-full px-4 py-3 border border-calista-ink/20 rounded-lg focus:outline-none focus:border-calista-gold bg-white'
  }
  return (
    <label className="block">
      <span className="text-sm font-medium block mb-1">
        {label}
        {required && <span className="text-red-500"> *</span>}
      </span>
      {textarea ? <textarea rows={3} {...common} /> : <input type={type} {...common} />}
    </label>
  )
}

function Row({ label, value, bold, highlight }) {
  return (
    <div
      className={`flex justify-between ${
        bold ? 'font-bold text-base pt-2 border-t border-calista-ink/10' : ''
      } ${highlight ? 'text-calista-gold' : ''}`}
    >
      <span>{label}</span>
      <span>{value}</span>
    </div>
  )
}

import { useCallback, useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { formatLKR } from '../format.js'
import { pipelineFor, statusLabel, statusIndex } from '../orderStatus.js'
import NotifyOptIn from '../NotifyOptIn.jsx'
import { payForOrder } from '../payhere.js'

const POLL_MS = 15000

export default function Track() {
  const { id } = useParams()
  const [order, setOrder] = useState(null)
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(true)
  const [paying, setPaying] = useState(false)
  const [payError, setPayError] = useState(null)

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'get', id })
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || `Server error (${res.status})`)
      setOrder(data.order)
      setError(null)
    } catch (err) {
      setError(err.message || 'Could not load this order.')
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => {
    load()
    const t = setInterval(load, POLL_MS)
    return () => clearInterval(t)
  }, [load])

  if (loading) {
    return <div className="max-w-xl mx-auto px-4 py-20 text-center text-calista-ink/50">Loading your order…</div>
  }

  if (error || !order) {
    return (
      <div className="max-w-xl mx-auto px-4 py-20 text-center">
        <h1 className="font-display text-3xl mb-3">We couldn't find that order</h1>
        <p className="text-calista-ink/70 mb-6">{error || 'Check the order number and try again.'}</p>
        <Link to="/menu" className="text-calista-gold underline underline-offset-4">
          Browse the menu →
        </Link>
      </div>
    )
  }

  const cancelled = order.status === 'cancelled'
  const awaitingPayment = order.paymentType === 'online' && order.paymentStatus !== 'paid'

  const payNow = async () => {
    setPaying(true)
    setPayError(null)
    try {
      await payForOrder(order.id)
      // Confirmation arrives server-side via PayHere's callback, so just
      // re-read the order rather than assuming it worked.
      await load()
    } catch (err) {
      setPayError(err.message || 'The payment could not be completed.')
    } finally {
      setPaying(false)
    }
  }

  const steps = pipelineFor(order.mode)
  const current = statusIndex(order.mode, order.status)
  const done = current >= steps.length - 1

  return (
    <div className="max-w-xl mx-auto px-4 py-10">
      <p className="text-xs uppercase tracking-[0.3em] text-calista-gold mb-1">
        {order.mode === 'delivery' ? 'Delivery' : order.mode === 'table' ? `Table ${order.table}` : 'Pick-up'}
      </p>
      <h1 className="font-display text-4xl mb-1">Order #{order.id}</h1>
      <p className="text-calista-ink/60 text-sm mb-8">
        Placed {new Date(order.createdAt).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' })}
        {order.requestedTime ? ` · requested for ${order.requestedTime}` : ''}
      </p>

      {awaitingPayment && !cancelled && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-4 mb-8">
          <p className="font-semibold text-amber-900 mb-1">Payment not completed</p>
          <p className="text-sm text-amber-800 mb-3">
            We've saved your order, but the kitchen won't start until it's paid.
          </p>
          <button
            onClick={payNow}
            disabled={paying}
            className="bg-calista-ink text-calista-cream px-5 py-2.5 rounded-full text-sm font-semibold disabled:opacity-50"
          >
            {paying ? 'Opening payment…' : `Pay ${formatLKR(order.total)} now`}
          </button>
          {payError && <p className="text-sm text-red-600 mt-2">{payError}</p>}
        </div>
      )}

      {cancelled ? (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 mb-8">
          This order was cancelled. Please call us if that's unexpected.
        </div>
      ) : (
        <ol className="mb-10">
          {steps.map((step, i) => {
            const state = i < current ? 'past' : i === current ? 'current' : 'future'
            return (
              <li key={step} className="flex gap-4">
                <div className="flex flex-col items-center">
                  <span
                    className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold shrink-0 transition ${
                      state === 'future'
                        ? 'bg-calista-ink/10 text-calista-ink/40'
                        : 'bg-calista-gold text-calista-ink'
                    } ${state === 'current' && !done ? 'ring-4 ring-calista-gold/25' : ''}`}
                  >
                    {state === 'past' || (state === 'current' && done) ? '✓' : i + 1}
                  </span>
                  {i < steps.length - 1 && (
                    <span className={`w-0.5 flex-1 min-h-[2rem] ${i < current ? 'bg-calista-gold' : 'bg-calista-ink/10'}`} />
                  )}
                </div>
                <div className="pb-8 pt-1">
                  <p className={`font-semibold ${state === 'future' ? 'text-calista-ink/40' : ''}`}>
                    {statusLabel(step)}
                  </p>
                  {state === 'current' && (
                    <p className="text-sm text-calista-gold">{done ? 'All done — enjoy!' : 'In progress…'}</p>
                  )}
                </div>
              </li>
            )
          })}
        </ol>
      )}

      {!cancelled && !done && (
        <div className="mb-8">
          <NotifyOptIn />
        </div>
      )}

      <div className="bg-white border border-calista-ink/10 rounded-lg overflow-hidden">
        <div className="divide-y">
          {order.items.map((item, i) => (
            <div key={`${item.id}-${i}`} className="px-4 py-3 flex justify-between items-center text-sm">
              <span>
                <span className="font-semibold mr-2">{item.qty}×</span>
                {item.name}
              </span>
              <span className="font-semibold">{formatLKR(item.price * item.qty)}</span>
            </div>
          ))}
        </div>
        <div className="bg-calista-cream/50 p-4 text-sm space-y-2">
          <Row label="Subtotal" value={formatLKR(order.subtotal)} />
          {order.discountAmount > 0 && (
            <Row label="Discount" value={`− ${formatLKR(order.discountAmount)}`} highlight />
          )}
          {order.serviceCharge > 0 && <Row label="Service charge" value={formatLKR(order.serviceCharge)} />}
          {order.deliveryFee > 0 && <Row label="Delivery" value={formatLKR(order.deliveryFee)} />}
          <Row label="Total" value={formatLKR(order.total)} bold />
          <p className="text-xs text-calista-ink/60 pt-1">
            {order.paymentStatus === 'paid'
              ? '✓ Paid'
              : order.mode === 'delivery'
                ? 'Please have the cash ready for the rider.'
                : order.mode === 'table'
                  ? 'Settle at the restaurant.'
                  : 'Pay when you collect.'}
          </p>
        </div>
      </div>

      {order.address && (
        <p className="text-sm text-calista-ink/60 mt-4">
          <span className="font-semibold">Delivering to:</span> {order.address}
        </p>
      )}
      {order.notes && (
        <p className="text-sm text-calista-ink/60 mt-2">
          <span className="font-semibold">Notes:</span> {order.notes}
        </p>
      )}

      <p className="text-xs text-calista-ink/40 mt-8 text-center">
        This page updates automatically. Bookmark it to check back any time.
      </p>
    </div>
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

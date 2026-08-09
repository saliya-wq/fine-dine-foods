import { useCallback, useEffect, useState } from 'react'
import { staffPost } from '../staffSession.jsx'
import { formatLKR } from '../format.js'

const POLL_MS = 15000

export default function RiderPortal() {
  const [orders, setOrders] = useState([])
  const [completedToday, setCompletedToday] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [busyId, setBusyId] = useState(null)

  const load = useCallback(async () => {
    try {
      const data = await staffPost('/api/orders', { action: 'myDeliveries' })
      setOrders(data.orders || [])
      setCompletedToday(data.completedToday || 0)
      setError(null)
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
    const t = setInterval(load, POLL_MS)
    return () => clearInterval(t)
  }, [load])

  const mark = async (order, status) => {
    setBusyId(order.id)
    setError(null)
    try {
      await staffPost('/api/orders', { action: 'riderStatus', id: order.id, status })
      await load()
    } catch (e) {
      setError(e.message)
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-calista-ink/60">
          {loading ? 'Loading…' : `${orders.length} run${orders.length === 1 ? '' : 's'} assigned`}
          {completedToday > 0 && <span className="text-green-700"> · {completedToday} delivered today</span>}
        </p>
        <button
          onClick={load}
          className="text-sm px-3 py-1.5 border border-calista-ink/20 rounded-full hover:border-calista-gold"
        >
          Refresh
        </button>
      </div>

      {error && (
        <p className="text-sm text-red-600 mb-4 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>
      )}

      {!loading && orders.length === 0 && (
        <div className="text-center py-16">
          <p className="font-display text-2xl mb-1">Nothing assigned</p>
          <p className="text-calista-ink/50 text-sm">
            New runs appear here as soon as the manager assigns one to you.
          </p>
        </div>
      )}

      <div className="space-y-4">
        {orders.map((o) => (
          <RunCard key={o.id} order={o} busy={busyId === o.id} onMark={mark} />
        ))}
      </div>
    </div>
  )
}

function RunCard({ order, busy, onMark }) {
  const onTheWay = order.status === 'out_for_delivery'
  const ready = order.status === 'ready_for_delivery'

  return (
    <div className={`bg-white border rounded-lg p-4 ${onTheWay ? 'border-calista-gold' : 'border-calista-ink/10'}`}>
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="min-w-0">
          <div className="font-display text-2xl">{order.id}</div>
          <div className="font-semibold">{order.customerName || 'Guest'}</div>
        </div>
        <div className="text-right shrink-0">
          <div className="font-semibold">{formatLKR(order.total)}</div>
          <div className="text-xs text-calista-ink/50">
            {onTheWay ? 'On the way' : ready ? 'Ready to collect' : 'Being prepared'}
          </div>
        </div>
      </div>

      {order.address && <p className="text-sm text-calista-ink/80 mb-1">{order.address}</p>}
      {order.deliveryDistanceKm != null && (
        <p className="text-xs text-calista-ink/50 mb-3">
          ~{order.deliveryDistanceKm} km
          {order.outOfZone && <span className="text-amber-700"> · outside the usual zone</span>}
        </p>
      )}

      {order.notes && (
        <div className="text-xs bg-calista-cream/70 rounded px-2 py-1.5 mb-3 whitespace-pre-line">{order.notes}</div>
      )}

      {/* Big targets — this gets used one-handed, often on a bike. */}
      <div className="grid grid-cols-2 gap-2 mb-3">
        {order.location ? (
          <a
            href={order.location}
            target="_blank"
            rel="noopener noreferrer"
            className="bg-calista-ink text-calista-cream py-3 rounded-full text-sm font-semibold text-center"
          >
            📍 Navigate
          </a>
        ) : (
          <span className="py-3 rounded-full text-sm text-center border border-calista-ink/10 text-calista-ink/30">
            No map pin
          </span>
        )}
        {order.customerPhone ? (
          <a
            href={`tel:${order.customerPhone}`}
            className="border border-calista-ink/20 py-3 rounded-full text-sm font-semibold text-center hover:border-calista-gold"
          >
            📞 Call
          </a>
        ) : (
          <span className="py-3 rounded-full text-sm text-center border border-calista-ink/10 text-calista-ink/30">
            No phone
          </span>
        )}
      </div>

      {onTheWay ? (
        <button
          onClick={() => onMark(order, 'delivered')}
          disabled={busy}
          className="w-full bg-calista-gold text-calista-ink py-3.5 rounded-full font-semibold disabled:opacity-50"
        >
          {busy ? 'Saving…' : 'Mark delivered ✓'}
        </button>
      ) : (
        <button
          onClick={() => onMark(order, 'out_for_delivery')}
          disabled={busy || !ready}
          title={!ready ? 'The kitchen has not finished this order yet' : undefined}
          className="w-full bg-calista-ink text-calista-cream py-3.5 rounded-full font-semibold disabled:opacity-40"
        >
          {busy ? 'Saving…' : ready ? "Picked up — I'm on my way" : 'Waiting on the kitchen'}
        </button>
      )}
    </div>
  )
}

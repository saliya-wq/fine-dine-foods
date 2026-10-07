import { useCallback, useEffect, useRef, useState } from 'react'
import { staffPost, useStaff } from '../staffSession.jsx'
import { formatLKR } from '../format.js'
import { pipelineFor, statusLabel } from '../orderStatus.js'
import Takings from './Takings.jsx'
import SiteSettings from './SiteSettings.jsx'

const POLL_MS = 15000

// Which pipeline states belong in which column of the queue.
const GROUPS = [
  { id: 'new', title: 'Needs authorising', match: (s) => s === 'placed', tone: 'urgent' },
  { id: 'kitchen', title: 'In the kitchen', match: (s) => s === 'received' || s === 'processing' },
  {
    id: 'ready',
    title: 'Ready',
    match: (s) => s === 'ready_for_delivery' || s === 'ready_for_collection' || s === 'ready'
  },
  { id: 'out', title: 'Out for delivery', match: (s) => s === 'out_for_delivery' }
]

const isFinished = (o) => {
  const steps = pipelineFor(o.mode)
  return o.status === 'cancelled' || o.status === steps[steps.length - 1]
}

// Short beep via WebAudio — avoids shipping an audio file, and a busy kitchen
// won't notice a silent 15s poll.
function ping() {
  try {
    const Ctx = window.AudioContext || window.webkitAudioContext
    if (!Ctx) return
    const ctx = new Ctx()
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.frequency.value = 880
    gain.gain.setValueAtTime(0.0001, ctx.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.25, ctx.currentTime + 0.01)
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.45)
    osc.start()
    osc.stop(ctx.currentTime + 0.5)
    setTimeout(() => ctx.close(), 800)
  } catch {
    // Audio is a nicety; never let it break the queue.
  }
}

export default function ManagerConsole() {
  const { staff } = useStaff()
  const [tab, setTab] = useState('queue')
  const tabs = [
    ['queue', 'Queue'],
    ['takings', 'Takings'],
    // Site-wide settings are sysadmin-only; the API enforces this too.
    ...(staff?.role === 'sysadmin' ? [['settings', 'Settings']] : [])
  ]
  return (
    <div>
      <div className="flex gap-1 mb-5 border-b border-calista-ink/10">
        {tabs.map(([id, label]) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={`px-4 py-2 text-sm font-semibold border-b-2 -mb-px transition ${
              tab === id
                ? 'border-calista-gold text-calista-ink'
                : 'border-transparent text-calista-ink/50 hover:text-calista-ink'
            }`}
          >
            {label}
          </button>
        ))}
      </div>
      {tab === 'queue' && <OrderQueue />}
      {tab === 'takings' && <Takings />}
      {tab === 'settings' && staff?.role === 'sysadmin' && <SiteSettings />}
    </div>
  )
}

function OrderQueue() {
  const [orders, setOrders] = useState([])
  const [riders, setRiders] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [busyId, setBusyId] = useState(null)
  const [showDone, setShowDone] = useState(false)
  const [sound, setSound] = useState(() => sessionStorage.getItem('calista_mgr_sound') !== 'off')

  // Ids seen on a previous poll, so only genuinely new orders trigger the ping.
  const seen = useRef(null)

  const load = useCallback(async () => {
    try {
      const { orders } = await staffPost('/api/orders', { action: 'list', limit: 100 })
      const list = orders || []
      const placedIds = new Set(list.filter((o) => o.status === 'placed').map((o) => o.id))
      if (seen.current && sound) {
        const fresh = [...placedIds].filter((id) => !seen.current.has(id))
        if (fresh.length) ping()
      }
      seen.current = placedIds
      setOrders(list)
      setError(null)
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [sound])

  useEffect(() => {
    load()
    const t = setInterval(load, POLL_MS)
    return () => clearInterval(t)
  }, [load])

  useEffect(() => {
    staffPost('/api/staff', { action: 'riders' })
      .then((d) => setRiders(d.riders || []))
      .catch(() => setRiders([]))
  }, [])

  const act = async (payload, optimisticId) => {
    setBusyId(optimisticId)
    setError(null)
    try {
      const { order: updated, push } = await staffPost('/api/orders', payload)
      setOrders((list) => list.map((o) => (o.id === updated.id ? { ...o, ...updated, lastPush: push } : o)))
    } catch (e) {
      setError(e.message)
    } finally {
      setBusyId(null)
    }
  }

  const setStatus = (order, status) => act({ action: 'updateStatus', id: order.id, status }, order.id)
  const assign = (order, riderId) => act({ action: 'assignRider', id: order.id, riderId: riderId || null }, order.id)
  const setPaid = (order, paid) => act({ action: 'markPaid', id: order.id, paid }, order.id)

  const toggleSound = () => {
    const next = !sound
    setSound(next)
    sessionStorage.setItem('calista_mgr_sound', next ? 'on' : 'off')
    if (next) ping()
  }

  const active = orders.filter((o) => !isFinished(o))
  const finished = orders.filter(isFinished)

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
        <p className="text-sm text-calista-ink/60">
          {loading ? 'Loading…' : `${active.length} active order${active.length === 1 ? '' : 's'}`}
          <span className="text-calista-ink/30"> · refreshes every 15s</span>
        </p>
        <div className="flex items-center gap-2">
          <button
            onClick={toggleSound}
            className={`text-sm px-3 py-1.5 rounded-full border transition ${
              sound ? 'border-calista-gold text-calista-ink' : 'border-calista-ink/20 text-calista-ink/40'
            }`}
          >
            {sound ? '🔔 Sound on' : '🔕 Sound off'}
          </button>
          <button
            onClick={load}
            className="text-sm px-3 py-1.5 border border-calista-ink/20 rounded-full hover:border-calista-gold"
          >
            Refresh
          </button>
        </div>
      </div>

      {error && (
        <p className="text-sm text-red-600 mb-4 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>
      )}

      {GROUPS.map((group) => {
        const inGroup = active.filter((o) => group.match(o.status))
        if (!inGroup.length) return null
        return (
          <section key={group.id} className="mb-8">
            <h2
              className={`font-display text-xl mb-3 pb-1.5 border-b ${
                group.tone === 'urgent'
                  ? 'text-calista-gold border-calista-gold/40'
                  : 'text-calista-ink/70 border-calista-ink/10'
              }`}
            >
              {group.title} <span className="text-calista-ink/30 text-base">· {inGroup.length}</span>
            </h2>
            <div className="space-y-3">
              {inGroup.map((o) => (
                <OrderCard
                  key={o.id}
                  order={o}
                  riders={riders}
                  busy={busyId === o.id}
                  onSetStatus={setStatus}
                  onAssign={assign}
                  onSetPaid={setPaid}
                />
              ))}
            </div>
          </section>
        )
      })}

      {!loading && active.length === 0 && (
        <p className="text-calista-ink/50 text-center py-10">Nothing in the queue right now.</p>
      )}

      {finished.length > 0 && (
        <section className="mt-10">
          <button
            onClick={() => setShowDone((v) => !v)}
            className="text-sm text-calista-ink/50 hover:text-calista-ink"
          >
            {showDone ? 'Hide' : 'Show'} completed ({finished.length})
          </button>
          {showDone && (
            <div className="space-y-3 mt-3">
              {finished.map((o) => (
                <OrderCard
                  key={o.id}
                  order={o}
                  riders={riders}
                  busy={busyId === o.id}
                  onSetStatus={setStatus}
                  onAssign={assign}
                  onSetPaid={setPaid}
                />
              ))}
            </div>
          )}
        </section>
      )}
    </div>
  )
}

function OrderCard({ order, riders, busy, onSetStatus, onAssign, onSetPaid }) {
  const steps = pipelineFor(order.mode)
  const cancelled = order.status === 'cancelled'
  const index = steps.indexOf(order.status)
  const next = index >= 0 && index < steps.length - 1 ? steps[index + 1] : null
  const isNew = order.status === 'placed'
  const isDelivery = order.mode === 'delivery'
  const assignedRider = riders.find((r) => r.id === order.riderId)

  // A delivery shouldn't leave the restaurant before someone is carrying it.
  const blockOut = isDelivery && next === 'out_for_delivery' && !order.riderId

  return (
    <div
      className={`bg-white border rounded-lg p-4 ${
        cancelled ? 'border-red-200 opacity-60' : isNew ? 'border-calista-gold shadow-sm' : 'border-calista-ink/10'
      }`}
    >
      <div className="flex flex-wrap items-start justify-between gap-2 mb-2">
        <div className="min-w-0">
          <span className="font-semibold mr-2">{order.id}</span>
          <span className="text-xs uppercase tracking-wider bg-calista-ink text-calista-cream rounded-full px-2 py-0.5">
            {order.mode === 'table' ? `Table ${order.table}` : order.mode}
          </span>
          <div className="text-sm text-calista-ink/70 mt-1">
            {order.customerName || 'Guest'}
            {order.customerPhone && (
              <>
                {' · '}
                <a href={`tel:${order.customerPhone}`} className="hover:text-calista-gold">
                  {order.customerPhone}
                </a>
              </>
            )}
          </div>
          <div className="text-xs text-calista-ink/50">
            {new Date(order.createdAt).toLocaleString('en-GB', { dateStyle: 'short', timeStyle: 'short' })}
            {order.requestedTime ? ` · wants ${order.requestedTime}` : ''}
          </div>
        </div>
        <div className="text-right shrink-0">
          <div className="font-semibold">{formatLKR(order.total)}</div>
          <PaymentBadge order={order} />
          <div className="text-xs text-calista-ink/50">{statusLabel(order.status)}</div>
          {order.outOfZone && <div className="text-xs text-amber-700">outside zone</div>}
        </div>
      </div>

      <ul className="text-sm text-calista-ink/80 mb-2">
        {order.items.map((i, n) => (
          <li key={`${i.id}-${n}`}>
            <span className="font-semibold">{i.qty}×</span> {i.name}
          </li>
        ))}
      </ul>

      {(order.address || order.location) && (
        <div className="text-xs text-calista-ink/60 mb-2">
          {order.address}
          {order.location && (
            <>
              {order.address ? ' · ' : ''}
              <a
                href={order.location}
                target="_blank"
                rel="noopener noreferrer"
                className="text-calista-gold font-semibold"
              >
                Map{order.deliveryDistanceKm != null ? ` (${order.deliveryDistanceKm} km)` : ''} →
              </a>
            </>
          )}
        </div>
      )}

      {order.notes && (
        <div className="text-xs bg-calista-cream/70 rounded px-2 py-1.5 mb-2 whitespace-pre-line">{order.notes}</div>
      )}

      {isDelivery && !cancelled && (
        <div className="flex items-center gap-2 mb-3 text-sm">
          <span className="text-calista-ink/60 text-xs">Rider</span>
          <select
            value={order.riderId || ''}
            onChange={(e) => onAssign(order, e.target.value)}
            disabled={busy}
            className="border border-calista-ink/20 rounded-lg px-2 py-1.5 text-sm bg-white disabled:opacity-50"
          >
            <option value="">Unassigned</option>
            {riders.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </select>
          {assignedRider && <span className="text-xs text-green-700">assigned to {assignedRider.name}</span>}
        </div>
      )}

      {cancelled ? (
        <p className="text-sm text-red-600 font-semibold">Cancelled</p>
      ) : (
        <div className="flex flex-wrap items-center gap-2">
          {isNew ? (
            <button
              onClick={() => onSetStatus(order, 'received')}
              disabled={busy}
              className="bg-calista-gold text-calista-ink px-5 py-2.5 rounded-full text-sm font-semibold hover:bg-calista-ink hover:text-calista-cream transition disabled:opacity-50"
            >
              {busy ? 'Saving…' : 'Authorise → send to kitchen'}
            </button>
          ) : (
            next && (
              <button
                onClick={() => onSetStatus(order, next)}
                disabled={busy || blockOut}
                title={blockOut ? 'Assign a rider first' : undefined}
                className="bg-calista-ink text-calista-cream px-5 py-2.5 rounded-full text-sm font-semibold disabled:opacity-40"
              >
                {busy ? 'Saving…' : `Mark ${statusLabel(next)} →`}
              </button>
            )
          )}

          {blockOut && <span className="text-xs text-amber-700">Assign a rider first</span>}

          {order.paymentStatus !== 'paid' && order.paymentType !== 'online' && (
            <button
              onClick={() => onSetPaid(order, true)}
              disabled={busy}
              className="px-4 py-2 rounded-full text-sm font-semibold border border-green-600/40 text-green-700 hover:bg-green-50 disabled:opacity-50"
            >
              Cash received
            </button>
          )}
          {order.paymentStatus === 'paid' && order.paymentMethod === 'cash' && (
            <button
              onClick={() => onSetPaid(order, false)}
              disabled={busy}
              className="text-xs text-calista-ink/40 hover:text-amber-700 disabled:opacity-50"
            >
              Undo payment
            </button>
          )}

          <button
            onClick={() => onSetStatus(order, 'cancelled')}
            disabled={busy}
            className="text-xs text-calista-ink/40 hover:text-red-600 disabled:opacity-50"
          >
            {isNew ? 'Decline' : 'Cancel order'}
          </button>

          {order.lastPush && (
            <span className="text-xs text-calista-ink/50">
              {order.lastPush.sent > 0
                ? `notified ${order.lastPush.sent} device${order.lastPush.sent === 1 ? '' : 's'}`
                : 'customer has no device subscribed'}
            </span>
          )}
        </div>
      )}

      <History orderId={order.id} />
    </div>
  )
}

// Whoever hands the order over needs to know if money is still owed.
function PaymentBadge({ order }) {
  if (order.paymentStatus === 'paid') {
    return (
      <div className="text-xs text-green-700 font-semibold">
        ✓ Paid{order.paymentMethod ? ` · ${order.paymentMethod}` : ''}
      </div>
    )
  }
  if (order.paymentType === 'cash') return <div className="text-xs text-amber-700 font-semibold">Cash — collect</div>
  if (order.paymentType === 'at_restaurant') return <div className="text-xs text-calista-ink/50">Pay at restaurant</div>
  return <div className="text-xs text-red-600 font-semibold">Unpaid</div>
}

// Collapsed by default — one fetch per order, only when someone asks.
function History({ orderId }) {
  const [open, setOpen] = useState(false)
  const [events, setEvents] = useState(null)
  const [error, setError] = useState(null)

  const toggle = async () => {
    const next = !open
    setOpen(next)
    if (next && !events) {
      try {
        const { events } = await staffPost('/api/orders', { action: 'history', id: orderId })
        setEvents(events || [])
      } catch (e) {
        setError(e.message)
      }
    }
  }

  return (
    <div className="mt-3 pt-2 border-t border-calista-ink/10">
      <button onClick={toggle} className="text-xs text-calista-ink/40 hover:text-calista-ink">
        {open ? 'Hide history' : 'History'}
      </button>
      {open && (
        <div className="mt-2 space-y-1">
          {error && <p className="text-xs text-red-600">{error}</p>}
          {!events && !error && <p className="text-xs text-calista-ink/40">Loading…</p>}
          {events?.length === 0 && (
            <p className="text-xs text-calista-ink/40">
              No history recorded — this order predates the audit trail.
            </p>
          )}
          {events?.map((e, i) => (
            <div key={i} className="text-xs text-calista-ink/60 flex gap-2">
              <span className="text-calista-ink/35 shrink-0 tabular-nums">
                {new Date(e.at).toLocaleString('en-GB', { dateStyle: 'short', timeStyle: 'short' })}
              </span>
              <span>
                {describeEvent(e)}
                <span className="text-calista-ink/35">
                  {' — '}
                  {e.actorName || 'unknown'}
                  {e.actorRole ? ` (${e.actorRole})` : ''}
                </span>
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

const describeEvent = (e) => {
  if (e.event === 'placed') return `Order placed${e.detail ? ` · ${e.detail}` : ''}`
  if (e.event === 'assign_rider' || e.event === 'unassign_rider') return e.detail || 'Rider changed'
  if (e.event === 'status') {
    return e.fromStatus
      ? `${statusLabel(e.fromStatus)} → ${statusLabel(e.toStatus)}`
      : statusLabel(e.toStatus)
  }
  return e.event
}

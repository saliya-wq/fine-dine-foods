import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useImages, fileToResizedDataUrl } from '../imageStore.jsx'
import { useMenu } from '../menuStore.jsx'
import { usePromotions, statusOf, formatDateRange } from '../promotionsStore.jsx'
import { useSettings, getTier } from '../settingsStore.jsx'
import { useCustomers } from '../customerStore.jsx'
import { formatLKR } from '../format.js'
import { BRAND_LOGO_ID, BRAND_HERO_ID } from '../brand.js'
import { pipelineFor, statusLabel } from '../orderStatus.js'

const SESSION_KEY = 'calista_admin_authed'
const ADMIN_PW_KEY = 'calista_admin_pw'

// Admin-gated POST. Every admin API takes the password as a header.
async function adminPost(url, payload) {
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-admin-password': sessionStorage.getItem(ADMIN_PW_KEY) || ''
    },
    body: JSON.stringify(payload)
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`)
  return data
}

export default function Admin() {
  const [authed, setAuthed] = useState(() => sessionStorage.getItem(SESSION_KEY) === '1')
  if (!authed) {
    return (
      <Login
        onAuth={(pw) => {
          sessionStorage.setItem(SESSION_KEY, '1')
          sessionStorage.setItem(ADMIN_PW_KEY, pw)
          setAuthed(true)
        }}
      />
    )
  }
  return (
    <Panel
      onLogout={() => {
        sessionStorage.removeItem(SESSION_KEY)
        sessionStorage.removeItem(ADMIN_PW_KEY)
        setAuthed(false)
      }}
    />
  )
}

function Login({ onAuth }) {
  const [pw, setPw] = useState('')
  const [err, setErr] = useState(null)
  const [busy, setBusy] = useState(false)
  const submit = async (e) => {
    e.preventDefault()
    setBusy(true)
    setErr(null)
    try {
      const res = await fetch('/api/admin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: pw })
      })
      if (res.ok) {
        onAuth(pw)
      } else if (res.status === 401) {
        setErr('Incorrect password.')
      } else {
        setErr('Could not sign in. Please try again.')
      }
    } catch {
      setErr('Could not connect. Check your connection and try again.')
    } finally {
      setBusy(false)
    }
  }
  return (
    <div className="max-w-md mx-auto px-4 py-20">
      <h1 className="font-display text-3xl mb-6 text-center">Admin sign in</h1>
      <form onSubmit={submit} className="bg-white border border-calista-ink/10 rounded-lg p-6 space-y-4">
        <label className="block">
          <span className="text-sm font-medium block mb-1">Password</span>
          <input
            type="password"
            value={pw}
            autoFocus
            onChange={(e) => { setPw(e.target.value); setErr(null) }}
            className="w-full px-4 py-3 border border-calista-ink/20 rounded-lg focus:outline-none focus:border-calista-gold"
          />
        </label>
        {err && <p className="text-sm text-red-600">{err}</p>}
        <button
          disabled={busy || !pw}
          className="w-full bg-calista-ink text-calista-cream py-3 rounded-full font-semibold disabled:opacity-50"
        >
          {busy ? 'Signing in…' : 'Sign in'}
        </button>
      </form>
    </div>
  )
}

function Panel({ onLogout }) {
  const { clearAll: clearImages, overrides } = useImages()
  const { resetToDefault } = useMenu()

  const customImageCount = Object.keys(overrides).length

  const handleResetMenu = async () => {
    if (confirm('Reset the whole menu to the default categories and items? This replaces the current menu for everyone.')) {
      try {
        await resetToDefault()
      } catch (e) {
        alert(e.message || 'Could not reset the menu.')
      }
    }
  }
  const handleClearImages = async () => {
    if (confirm('Remove the uploaded brand logo and hero image?')) {
      try {
        await clearImages()
      } catch (e) {
        alert(e.message || 'Could not clear images.')
      }
    }
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-10">
      <div className="flex flex-wrap justify-between items-center gap-3 mb-2">
        <h1 className="font-display text-4xl">Admin</h1>
        <div className="flex flex-wrap gap-2">
          <Link
            to="/admin/qr"
            className="text-sm px-4 py-2 bg-calista-gold text-calista-ink rounded-full font-semibold hover:bg-calista-ink hover:text-calista-cream transition"
          >
            Table QR codes →
          </Link>
          <button
            onClick={handleResetMenu}
            className="text-sm px-4 py-2 border border-calista-ink/20 rounded-full hover:border-calista-gold"
          >
            Reset menu to default
          </button>
          {customImageCount > 0 && (
            <button
              onClick={handleClearImages}
              className="text-sm px-4 py-2 border border-calista-ink/20 rounded-full hover:border-red-500 hover:text-red-600"
            >
              Clear uploaded images ({customImageCount})
            </button>
          )}
          <button
            onClick={onLogout}
            className="text-sm px-4 py-2 border border-calista-ink/20 rounded-full hover:border-calista-gold"
          >
            Sign out
          </button>
        </div>
      </div>
      <p className="text-calista-ink/60 mb-10">
        Menu changes are saved to the shared database and show on every device immediately. (Brand
        logo/hero images are still saved only in this browser.)
      </p>

      <OrdersSection />

      <h2 className="font-display text-2xl text-calista-gold mb-4 border-b border-calista-ink/10 pb-2">Brand</h2>
      <div className="grid sm:grid-cols-2 gap-4 mb-12">
        <BrandSlot
          id={BRAND_LOGO_ID}
          label="Logo"
          hint="Square. Shown in the top-left nav. Use the Facebook page profile photo."
          previewClassName="w-28 h-28 object-cover rounded-full bg-calista-cream"
        />
        <BrandSlot
          id={BRAND_HERO_ID}
          label="Hero image"
          hint="Wide. Shown behind the welcome text on the home page. Use the Facebook cover photo or a restaurant interior shot."
          previewClassName="w-28 h-28 object-cover rounded-md bg-calista-cream"
        />
      </div>

      <PromotionsManager />

      <MenuManager />

      <NotificationsSection />

      <CustomersSection />
    </div>
  )
}

// ── Live orders: advance status, which notifies the customer ──────────────
// Interim console until the dedicated manager view exists. Moving an order
// along here is what triggers the customer's push notification.
const ORDERS_POLL_MS = 20000

const isFinished = (o) => {
  const steps = pipelineFor(o.mode)
  return o.status === 'cancelled' || o.status === steps[steps.length - 1]
}

function OrdersSection() {
  const [orders, setOrders] = useState([])
  const [showDone, setShowDone] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [busyId, setBusyId] = useState(null)

  const load = async () => {
    try {
      const { orders } = await adminPost('/api/orders', { action: 'list', limit: 100 })
      setOrders(orders || [])
      setError(null)
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
    const t = setInterval(load, ORDERS_POLL_MS)
    return () => clearInterval(t)
  }, [])

  const setStatus = async (order, status) => {
    setBusyId(order.id)
    setError(null)
    try {
      const { order: updated, push } = await adminPost('/api/orders', {
        action: 'updateStatus',
        id: order.id,
        status
      })
      setOrders((list) => list.map((o) => (o.id === updated.id ? { ...o, ...updated, lastPush: push } : o)))
    } catch (e) {
      setError(e.message)
    } finally {
      setBusyId(null)
    }
  }

  const visible = showDone ? orders : orders.filter((o) => !isFinished(o))
  const activeCount = orders.filter((o) => !isFinished(o)).length

  return (
    <section className="mb-12">
      <div className="flex items-center justify-between border-b border-calista-ink/10 pb-2 mb-4">
        <h2 className="font-display text-2xl text-calista-gold">
          Orders {activeCount > 0 && <span className="text-calista-ink/40 text-base">· {activeCount} active</span>}
        </h2>
        <div className="flex items-center gap-3">
          <label className="text-xs text-calista-ink/60 flex items-center gap-1.5">
            <input type="checkbox" checked={showDone} onChange={(e) => setShowDone(e.target.checked)} />
            Show completed
          </label>
          <button onClick={load} className="text-sm px-3 py-1.5 border border-calista-ink/20 rounded-full hover:border-calista-gold">
            Refresh
          </button>
        </div>
      </div>

      {error && <p className="text-sm text-red-600 mb-3">{error}</p>}
      {loading && <p className="text-sm text-calista-ink/50">Loading orders…</p>}
      {!loading && visible.length === 0 && (
        <p className="text-sm text-calista-ink/50">
          {orders.length === 0 ? 'No orders yet.' : 'No active orders — tick "Show completed" to see past ones.'}
        </p>
      )}

      <div className="space-y-3">
        {visible.map((o) => (
          <OrderCard key={o.id} order={o} busy={busyId === o.id} onSetStatus={setStatus} />
        ))}
      </div>
    </section>
  )
}

function OrderCard({ order, busy, onSetStatus }) {
  const steps = pipelineFor(order.mode)
  const cancelled = order.status === 'cancelled'
  const currentIndex = steps.indexOf(order.status)
  const next = currentIndex >= 0 && currentIndex < steps.length - 1 ? steps[currentIndex + 1] : null

  return (
    <div className={`bg-white border rounded-lg p-4 ${cancelled ? 'border-red-200 opacity-70' : 'border-calista-ink/10'}`}>
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
                <a href={`tel:${order.customerPhone}`} className="hover:text-calista-gold">{order.customerPhone}</a>
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
          {order.outOfZone && <div className="text-xs text-amber-700">outside zone</div>}
        </div>
      </div>

      <div className="text-sm text-calista-ink/80 mb-2">
        {order.items.map((i) => `${i.qty}× ${i.name}`).join(', ')}
      </div>

      {(order.address || order.location) && (
        <div className="text-xs text-calista-ink/60 mb-2">
          {order.address}
          {order.location && (
            <>
              {order.address ? ' · ' : ''}
              <a href={order.location} target="_blank" rel="noopener noreferrer" className="text-calista-gold font-semibold">
                Map{order.deliveryDistanceKm != null ? ` (${order.deliveryDistanceKm} km)` : ''} →
              </a>
            </>
          )}
        </div>
      )}

      {order.notes && (
        <div className="text-xs bg-calista-cream/70 rounded px-2 py-1.5 mb-2 whitespace-pre-line">{order.notes}</div>
      )}

      {cancelled ? (
        <p className="text-sm text-red-600 font-semibold">Cancelled</p>
      ) : (
        <>
          <div className="flex flex-wrap gap-1.5 mb-2">
            {steps.map((s, i) => {
              const isCurrent = s === order.status
              const isPast = currentIndex >= 0 && i < currentIndex
              return (
                <button
                  key={s}
                  onClick={() => !isCurrent && onSetStatus(order, s)}
                  disabled={busy || isCurrent}
                  className={`text-xs px-2.5 py-1.5 rounded-full border transition disabled:opacity-100 ${
                    isCurrent
                      ? 'bg-calista-gold border-calista-gold text-calista-ink font-semibold'
                      : isPast
                        ? 'border-calista-ink/15 text-calista-ink/40 hover:border-calista-gold'
                        : 'border-calista-ink/20 hover:border-calista-gold'
                  }`}
                >
                  {statusLabel(s)}
                </button>
              )
            })}
          </div>
          <div className="flex items-center gap-3">
            {next && (
              <button
                onClick={() => onSetStatus(order, next)}
                disabled={busy}
                className="bg-calista-ink text-calista-cream px-4 py-2 rounded-full text-sm font-semibold disabled:opacity-50"
              >
                {busy ? 'Saving…' : `Mark ${statusLabel(next)} →`}
              </button>
            )}
            <button
              onClick={() => onSetStatus(order, 'cancelled')}
              disabled={busy}
              className="text-xs text-calista-ink/40 hover:text-red-600 disabled:opacity-50"
            >
              Cancel order
            </button>
            {order.lastPush && (
              <span className="text-xs text-calista-ink/50">
                {order.lastPush.sent > 0
                  ? `notified ${order.lastPush.sent} device${order.lastPush.sent === 1 ? '' : 's'}`
                  : 'no devices subscribed'}
              </span>
            )}
          </div>
        </>
      )}
    </div>
  )
}

// ── Push notifications: reach stats + promo broadcast ─────────────────────
function NotificationsSection() {
  const [stats, setStats] = useState(null)
  const [title, setTitle] = useState('')
  const [message, setMessage] = useState('')
  const [url, setUrl] = useState('/promotions')
  const [confirming, setConfirming] = useState(false)
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState(null)
  const [error, setError] = useState(null)

  const call = (payload) => adminPost('/api/push', payload)

  useEffect(() => {
    call({ action: 'stats' })
      .then(setStats)
      .catch((e) => setError(e.message))
  }, [])

  const send = async () => {
    setBusy(true)
    setError(null)
    setResult(null)
    try {
      const r = await call({ action: 'broadcast', title: title.trim(), body: message.trim(), url })
      setResult(r)
      setTitle('')
      setMessage('')
      setConfirming(false)
    } catch (e) {
      setError(e.message)
    } finally {
      setBusy(false)
    }
  }

  const ready = title.trim() && message.trim()
  const reach = stats?.devices ?? 0

  return (
    <section className="mb-12">
      <h2 className="font-display text-2xl text-calista-gold mb-4 border-b border-calista-ink/10 pb-2">
        Notifications
      </h2>

      {stats && !stats.configured && (
        <p className="mb-4 text-sm bg-amber-50 border border-amber-200 text-amber-800 rounded-lg px-3 py-2">
          Push is not configured on the server (VAPID keys missing) — broadcasts will fail.
        </p>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        <Stat label="Devices subscribed" value={stats?.devices} />
        <Stat label="Installed as app" value={stats?.installedDevices} />
        <Stat label="Known customers" value={stats?.identifiedCustomers} />
        <Stat label="Customers w/ app" value={stats?.installedCustomers} />
      </div>

      <div className="bg-white border border-calista-ink/10 rounded-lg p-4 space-y-3">
        <p className="font-semibold text-sm">Send a promotion</p>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          maxLength={60}
          placeholder="Title — e.g. Weekend special"
          className="w-full px-4 py-3 border border-calista-ink/20 rounded-lg focus:outline-none focus:border-calista-gold"
        />
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          rows={3}
          maxLength={160}
          placeholder="Message — keep it short, this shows on a lock screen."
          className="w-full px-4 py-3 border border-calista-ink/20 rounded-lg focus:outline-none focus:border-calista-gold"
        />
        <label className="block">
          <span className="text-xs text-calista-ink/60 block mb-1">Opens when tapped</span>
          <input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="/promotions"
            className="w-full px-4 py-2 border border-calista-ink/20 rounded-lg text-sm focus:outline-none focus:border-calista-gold"
          />
        </label>

        {!confirming ? (
          <button
            onClick={() => setConfirming(true)}
            disabled={!ready || busy}
            className="bg-calista-ink text-calista-cream px-5 py-2.5 rounded-full text-sm font-semibold disabled:opacity-40"
          >
            Send to {reach} device{reach === 1 ? '' : 's'}…
          </button>
        ) : (
          <div className="bg-calista-cream/70 border border-calista-ink/10 rounded-lg p-3">
            <p className="text-sm mb-3">
              This sends immediately to <strong>{reach} device{reach === 1 ? '' : 's'}</strong> and cannot be
              recalled. Send it?
            </p>
            <div className="flex gap-2">
              <button
                onClick={send}
                disabled={busy}
                className="bg-calista-gold text-calista-ink px-5 py-2.5 rounded-full text-sm font-semibold disabled:opacity-50"
              >
                {busy ? 'Sending…' : 'Yes, send now'}
              </button>
              <button
                onClick={() => setConfirming(false)}
                disabled={busy}
                className="px-5 py-2.5 rounded-full text-sm font-semibold border border-calista-ink/20"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {result && (
          <p className="text-sm text-green-700">
            Sent to {result.sent} device{result.sent === 1 ? '' : 's'}.
            {result.failed > 0 && ` ${result.failed} failed.`}
            {result.removed > 0 && ` ${result.removed} expired subscription(s) removed.`}
          </p>
        )}
        {error && <p className="text-sm text-red-600">{error}</p>}
      </div>
    </section>
  )
}

function Stat({ label, value }) {
  return (
    <div className="bg-calista-cream/60 border border-calista-ink/10 rounded-lg px-3 py-3">
      <div className="font-display text-2xl">{value ?? '—'}</div>
      <div className="text-xs text-calista-ink/60">{label}</div>
    </div>
  )
}

function BrandSlot({ id, label, hint, previewClassName }) {
  const { overrides, setImage, clearImage } = useImages()
  const fileRef = useRef(null)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState(null)
  const isCustom = !!overrides[id]
  const preview = overrides[id]

  const onFile = async (e) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    if (!file.type.startsWith('image/')) { setErr('Please choose an image file.'); return }
    setBusy(true); setErr(null)
    try {
      const dataUrl = await fileToResizedDataUrl(file)
      await setImage(id, dataUrl)
    } catch (e2) { setErr(e2.message || 'Could not save that image.') }
    finally { setBusy(false) }
  }

  return (
    <div className="bg-white border border-calista-ink/10 rounded-lg p-3 flex gap-4">
      {preview ? (
        <img src={preview} alt={label} className={previewClassName} />
      ) : (
        <div className={`${previewClassName} flex items-center justify-center text-calista-ink/30 text-xs text-center px-2`}>
          No image
        </div>
      )}
      <div className="flex-1 min-w-0">
        <div className="font-semibold">{label}</div>
        <div className="text-xs text-calista-ink/50 mb-2">{hint}</div>
        <div className="text-xs mb-3">
          {isCustom ? <span className="text-calista-gold">● Uploaded</span> : <span className="text-calista-ink/40">○ Not set</span>}
        </div>
        <div className="flex flex-wrap gap-2">
          <button onClick={() => fileRef.current?.click()} disabled={busy}
            className="text-xs px-3 py-2 bg-calista-ink text-calista-cream rounded-full hover:bg-calista-gold hover:text-calista-ink transition disabled:opacity-50">
            {busy ? 'Uploading…' : isCustom ? 'Replace' : 'Upload'}
          </button>
          {isCustom && (
            <button
              disabled={busy}
              onClick={async () => {
                setBusy(true); setErr(null)
                try { await clearImage(id) } catch (e2) { setErr(e2.message || 'Could not remove.') }
                finally { setBusy(false) }
              }}
              className="text-xs px-3 py-2 border border-calista-ink/20 rounded-full hover:border-red-500 hover:text-red-600 disabled:opacity-50">
              Revert
            </button>
          )}
          <input ref={fileRef} type="file" accept="image/*" onChange={onFile} className="hidden" />
        </div>
        {err && <p className="text-xs text-red-600 mt-2">{err}</p>}
      </div>
    </div>
  )
}

function MenuManager() {
  const { grouped, addCategory } = useMenu()
  const [newCat, setNewCat] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState(null)

  const submitCategory = async (e) => {
    e.preventDefault()
    if (!newCat.trim()) return
    setBusy(true)
    setErr(null)
    try {
      await addCategory(newCat)
      setNewCat('')
    } catch (e2) {
      setErr(e2.message || 'Could not add category.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <h2 className="font-display text-2xl text-calista-gold mb-4 border-b border-calista-ink/10 pb-2 flex items-center justify-between">
        <span>Menu</span>
      </h2>
      <form onSubmit={submitCategory} className="mb-8">
        <div className="flex gap-2">
          <input
            value={newCat}
            onChange={(e) => setNewCat(e.target.value)}
            placeholder="New category name (e.g. Salads)"
            className="flex-1 px-4 py-3 border border-calista-ink/20 rounded-lg focus:outline-none focus:border-calista-gold"
          />
          <button
            type="submit"
            disabled={busy}
            className="px-5 py-3 bg-calista-ink text-calista-cream rounded-lg font-semibold hover:bg-calista-gold hover:text-calista-ink transition disabled:opacity-50"
          >
            {busy ? 'Adding…' : '+ Add category'}
          </button>
        </div>
        {err && <p className="text-sm text-red-600 mt-2">{err}</p>}
      </form>

      {grouped.length === 0 && (
        <p className="text-calista-ink/50 mb-8">No categories yet. Add one above to get started.</p>
      )}

      {grouped.map((cat) => (
        <CategoryBlock key={cat.id} category={cat} />
      ))}
    </>
  )
}

function CategoryBlock({ category }) {
  const { renameCategory, deleteCategory } = useMenu()
  const [editing, setEditing] = useState(false)
  const [adding, setAdding] = useState(false)
  const [name, setName] = useState(category.name)

  const saveRename = async (e) => {
    e.preventDefault()
    try {
      await renameCategory(category.id, name)
      setEditing(false)
    } catch (e2) {
      alert(e2.message || 'Could not rename category.')
    }
  }
  const onDelete = async () => {
    const itemCount = category.items.length
    const msg = itemCount > 0
      ? `Delete "${category.name}" and its ${itemCount} item${itemCount === 1 ? '' : 's'}?`
      : `Delete "${category.name}"?`
    if (confirm(msg)) {
      try {
        await deleteCategory(category.id)
      } catch (e2) {
        alert(e2.message || 'Could not delete category.')
      }
    }
  }

  return (
    <section className="mb-10">
      <div className="flex items-center justify-between gap-3 mb-4 border-b border-calista-ink/10 pb-2">
        {editing ? (
          <form onSubmit={saveRename} className="flex gap-2 flex-1">
            <input
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="flex-1 px-3 py-2 border border-calista-ink/20 rounded-lg focus:outline-none focus:border-calista-gold"
            />
            <button type="submit" className="px-3 py-2 bg-calista-ink text-calista-cream rounded-lg text-sm">Save</button>
            <button type="button" onClick={() => { setName(category.name); setEditing(false) }} className="px-3 py-2 border border-calista-ink/20 rounded-lg text-sm">Cancel</button>
          </form>
        ) : (
          <h3 className="font-display text-2xl text-calista-gold">{category.name}</h3>
        )}
        {!editing && (
          <div className="flex gap-1 shrink-0">
            <button onClick={() => setEditing(true)} className="text-xs px-3 py-1.5 border border-calista-ink/20 rounded-full hover:border-calista-gold">Rename</button>
            <button onClick={onDelete} className="text-xs px-3 py-1.5 border border-calista-ink/20 rounded-full hover:border-red-500 hover:text-red-600">Delete</button>
          </div>
        )}
      </div>

      <div className="grid sm:grid-cols-2 gap-4">
        {category.items.map((item) => (
          <ItemCard key={item.id} item={item} />
        ))}
        {category.items.length === 0 && !adding && (
          <p className="text-sm text-calista-ink/40 italic sm:col-span-2">No items in this category yet.</p>
        )}
      </div>

      {adding ? (
        <div className="mt-4">
          <ItemForm
            mode="create"
            categoryId={category.id}
            onDone={() => setAdding(false)}
          />
        </div>
      ) : (
        <button
          onClick={() => setAdding(true)}
          className="mt-4 text-sm px-4 py-2 border-2 border-dashed border-calista-ink/20 rounded-lg text-calista-ink/60 hover:border-calista-gold hover:text-calista-gold w-full"
        >
          + Add item to {category.name}
        </button>
      )}
    </section>
  )
}

function ItemCard({ item }) {
  const { getImage } = useImages()
  const { deleteItem } = useMenu()
  const [editing, setEditing] = useState(false)

  if (editing) {
    return <ItemForm mode="edit" item={item} onDone={() => setEditing(false)} />
  }

  const onDelete = async () => {
    if (confirm(`Delete "${item.name}"?`)) {
      try {
        await deleteItem(item.id)
      } catch (e) {
        alert(e.message || 'Could not delete item.')
      }
    }
  }

  return (
    <div className="bg-white border border-calista-ink/10 rounded-lg p-3 flex gap-4">
      <img
        src={getImage(item.id, item.image)}
        alt={item.name}
        className="w-24 h-24 object-cover rounded-md bg-calista-cream shrink-0"
        onError={(e) => { e.currentTarget.style.visibility = 'hidden' }}
      />
      <div className="flex-1 min-w-0 flex flex-col">
        <div className="font-semibold truncate">{item.name}</div>
        <div className="text-xs text-calista-ink/60 mt-1 line-clamp-2 mb-2">{item.desc || <span className="italic">No description</span>}</div>
        <div className="font-semibold text-sm mb-3">{formatLKR(item.price)}</div>
        <div className="flex gap-2 mt-auto">
          <button onClick={() => setEditing(true)} className="text-xs px-3 py-1.5 bg-calista-ink text-calista-cream rounded-full hover:bg-calista-gold hover:text-calista-ink">Edit</button>
          <button onClick={onDelete} className="text-xs px-3 py-1.5 border border-calista-ink/20 rounded-full hover:border-red-500 hover:text-red-600">Delete</button>
        </div>
      </div>
    </div>
  )
}

function ItemForm({ mode, item, categoryId, onDone }) {
  const { addItem, updateItem, deleteItem } = useMenu()
  const fileRef = useRef(null)
  const [form, setForm] = useState(() => ({
    name: item?.name || '',
    desc: item?.desc || '',
    price: item?.price ?? '',
    image: item?.image || ''
  }))
  const [pendingImage, setPendingImage] = useState(null) // staged data URL, uploaded on save
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState(null)

  const isEdit = mode === 'edit'

  const handleField = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }))

  const onPickImage = async (e) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    if (!file.type.startsWith('image/')) { setErr('Please choose an image file.'); return }
    setErr(null)
    try {
      setPendingImage(await fileToResizedDataUrl(file))
    } catch {
      setErr('Could not read that image.')
    }
  }

  const submit = async (e) => {
    e.preventDefault()
    if (!form.name.trim()) { setErr('Name is required.'); return }
    setBusy(true); setErr(null)
    try {
      const draft = { ...form, imageDataUrl: pendingImage || undefined }
      if (isEdit) await updateItem(item.id, draft)
      else await addItem(categoryId, draft)
      onDone()
    } catch (e2) {
      setErr(e2.message || 'Could not save. Check your connection and try again.')
      setBusy(false)
    }
  }

  const onDelete = async () => {
    if (isEdit && confirm(`Delete "${item.name}"?`)) {
      setBusy(true)
      try {
        await deleteItem(item.id)
        onDone()
      } catch (e2) {
        setErr(e2.message || 'Could not delete.')
        setBusy(false)
      }
    }
  }

  const previewSrc = pendingImage || form.image || ''

  return (
    <form onSubmit={submit} className="bg-calista-cream border-2 border-calista-gold/40 rounded-lg p-4 sm:col-span-2">
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="shrink-0">
          {previewSrc ? (
            <img
              src={previewSrc}
              alt=""
              className="w-28 h-28 object-cover rounded-md bg-white"
              onError={(e) => { e.currentTarget.style.visibility = 'hidden' }}
            />
          ) : (
            <div className="w-28 h-28 rounded-md bg-white flex items-center justify-center text-calista-ink/30 text-xs text-center px-2">
              No image
            </div>
          )}
          <div className="flex flex-col gap-1 mt-2">
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              disabled={busy}
              className="text-xs px-3 py-1.5 bg-calista-ink text-calista-cream rounded-full disabled:opacity-50"
            >
              {pendingImage ? 'Change photo' : 'Upload photo'}
            </button>
            {pendingImage && (
              <button
                type="button"
                onClick={() => setPendingImage(null)}
                className="text-xs px-3 py-1.5 border border-calista-ink/20 rounded-full hover:border-red-500 hover:text-red-600"
              >
                Remove new photo
              </button>
            )}
            <input ref={fileRef} type="file" accept="image/*" onChange={onPickImage} className="hidden" />
          </div>
          {pendingImage && (
            <p className="text-[11px] text-calista-gold mt-1 w-28 leading-tight">
              Uploads when you click {isEdit ? 'Save changes' : 'Add item'}.
            </p>
          )}
        </div>

        <div className="flex-1 space-y-3">
          <Field label="Name" value={form.name} onChange={handleField('name')} required placeholder="e.g. Wood-Fired Margherita" />
          <Field label="Description" value={form.desc} onChange={handleField('desc')} textarea placeholder="Short, appetising description" />
          <div className="grid sm:grid-cols-2 gap-3">
            <Field label="Price (LKR)" type="number" min="0" step="50" value={form.price} onChange={handleField('price')} required />
            <Field label="Image URL (used if no photo uploaded)" value={form.image} onChange={handleField('image')} placeholder="https://…" />
          </div>
          {err && <p className="text-sm text-red-600">{err}</p>}
          <div className="flex flex-wrap gap-2 pt-2">
            <button type="submit" disabled={busy} className="px-4 py-2 bg-calista-ink text-calista-cream rounded-full text-sm font-semibold disabled:opacity-50">
              {busy ? 'Saving…' : isEdit ? 'Save changes' : 'Add item'}
            </button>
            <button type="button" onClick={onDone} disabled={busy} className="px-4 py-2 border border-calista-ink/20 rounded-full text-sm disabled:opacity-50">
              Cancel
            </button>
            {isEdit && (
              <button type="button" onClick={onDelete} disabled={busy} className="px-4 py-2 border border-calista-ink/20 rounded-full text-sm hover:border-red-500 hover:text-red-600 ml-auto disabled:opacity-50">
                Delete
              </button>
            )}
          </div>
        </div>
      </div>
    </form>
  )
}

function Field({ label, value, onChange, type = 'text', required, textarea, placeholder, min, step }) {
  const common = {
    value,
    onChange,
    required,
    placeholder,
    className: 'w-full px-3 py-2 border border-calista-ink/20 rounded-lg focus:outline-none focus:border-calista-gold bg-white text-sm'
  }
  return (
    <label className="block">
      <span className="text-xs font-medium block mb-1 text-calista-ink/70">
        {label}{required && <span className="text-red-500"> *</span>}
      </span>
      {textarea
        ? <textarea rows={2} {...common} />
        : <input type={type} min={min} step={step} {...common} />}
    </label>
  )
}

function PromotionsManager() {
  const { items, resetToDefault } = usePromotions()
  const [adding, setAdding] = useState(false)

  const sorted = [...items].sort((a, b) => (a.startDate || '').localeCompare(b.startDate || ''))

  const handleReset = async () => {
    if (confirm('Reset promotions back to the sample data for everyone? Current promotions will be replaced.')) {
      try {
        await resetToDefault()
      } catch (e) {
        alert(e.message || 'Could not reset promotions.')
      }
    }
  }

  return (
    <section className="mb-12">
      <div className="flex items-center justify-between gap-3 mb-4 border-b border-calista-ink/10 pb-2">
        <h2 className="font-display text-2xl text-calista-gold">Promotions</h2>
        <button
          onClick={handleReset}
          className="text-xs px-3 py-1.5 border border-calista-ink/20 rounded-full hover:border-calista-gold"
        >
          Reset to samples
        </button>
      </div>

      <div className="space-y-4">
        {sorted.map((p) => (
          <PromoCard key={p.id} promo={p} />
        ))}
        {sorted.length === 0 && !adding && (
          <p className="text-sm text-calista-ink/40 italic">No promotions yet.</p>
        )}
      </div>

      {adding ? (
        <div className="mt-4">
          <PromoForm mode="create" onDone={() => setAdding(false)} />
        </div>
      ) : (
        <button
          onClick={() => setAdding(true)}
          className="mt-4 text-sm px-4 py-2 border-2 border-dashed border-calista-ink/20 rounded-lg text-calista-ink/60 hover:border-calista-gold hover:text-calista-gold w-full"
        >
          + Add promotion
        </button>
      )}
    </section>
  )
}

function PromoCard({ promo }) {
  const { getImage } = useImages()
  const { remove } = usePromotions()
  const [editing, setEditing] = useState(false)
  const status = statusOf(promo)

  if (editing) return <PromoForm mode="edit" promo={promo} onDone={() => setEditing(false)} />

  const onDelete = async () => {
    if (confirm(`Delete promotion "${promo.title}"?`)) {
      try {
        await remove(promo.id)
      } catch (e) {
        alert(e.message || 'Could not delete promotion.')
      }
    }
  }

  const statusStyles = {
    active: 'bg-calista-gold text-calista-ink',
    upcoming: 'bg-calista-ink text-calista-cream',
    past: 'bg-calista-ink/20 text-calista-ink/60'
  }
  const statusLabel = { active: 'On now', upcoming: 'Coming soon', past: 'Ended' }

  return (
    <div className="bg-white border border-calista-ink/10 rounded-lg p-3 flex gap-4">
      <img
        src={getImage(promo.id, promo.image)}
        alt={promo.title}
        className="w-28 h-28 object-cover rounded-md bg-calista-cream shrink-0"
        onError={(e) => { e.currentTarget.style.visibility = 'hidden' }}
      />
      <div className="flex-1 min-w-0 flex flex-col">
        <div className="flex items-center gap-2 flex-wrap mb-1">
          <span className="font-semibold truncate">{promo.title}</span>
          <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full uppercase tracking-wider ${statusStyles[status]}`}>
            {statusLabel[status]}
          </span>
        </div>
        <div className="text-xs text-calista-gold font-semibold mb-1">
          {formatDateRange(promo.startDate, promo.endDate) || <span className="text-calista-ink/40 font-normal">No dates set</span>}
        </div>
        <p className="text-xs text-calista-ink/60 line-clamp-2 mb-3">{promo.description || <span className="italic">No description</span>}</p>
        <div className="flex gap-2 mt-auto flex-wrap">
          <button onClick={() => setEditing(true)} className="text-xs px-3 py-1.5 bg-calista-ink text-calista-cream rounded-full hover:bg-calista-gold hover:text-calista-ink">Edit</button>
          <button onClick={onDelete} className="text-xs px-3 py-1.5 border border-calista-ink/20 rounded-full hover:border-red-500 hover:text-red-600">Delete</button>
          {promo.url && (
            <a href={promo.url} target="_blank" rel="noopener noreferrer" className="text-xs px-3 py-1.5 border border-calista-ink/20 rounded-full hover:border-calista-gold">
              Open link ↗
            </a>
          )}
        </div>
      </div>
    </div>
  )
}

function PromoForm({ mode, promo, onDone }) {
  const { add, update, remove } = usePromotions()
  const fileRef = useRef(null)
  const [form, setForm] = useState(() => ({
    title: promo?.title || '',
    description: promo?.description || '',
    image: promo?.image || '',
    startDate: promo?.startDate || '',
    endDate: promo?.endDate || '',
    url: promo?.url || ''
  }))
  const [pendingImage, setPendingImage] = useState(null)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState(null)

  const isEdit = mode === 'edit'

  const handleField = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }))

  const onPickImage = async (e) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    if (!file.type.startsWith('image/')) { setErr('Please choose an image file.'); return }
    setErr(null)
    try {
      setPendingImage(await fileToResizedDataUrl(file))
    } catch {
      setErr('Could not read that image.')
    }
  }

  const submit = async (e) => {
    e.preventDefault()
    if (!form.title.trim()) { setErr('Title is required.'); return }
    if (form.startDate && form.endDate && form.startDate > form.endDate) {
      setErr('End date must be on or after the start date.')
      return
    }
    setBusy(true); setErr(null)
    try {
      const draft = { ...form, imageDataUrl: pendingImage || undefined }
      if (isEdit) await update(promo.id, draft)
      else await add(draft)
      onDone()
    } catch (e2) {
      setErr(e2.message || 'Could not save. Try again.')
      setBusy(false)
    }
  }

  const onDelete = async () => {
    if (isEdit && confirm(`Delete promotion "${promo.title}"?`)) {
      setBusy(true)
      try {
        await remove(promo.id)
        onDone()
      } catch (e2) {
        setErr(e2.message || 'Could not delete.')
        setBusy(false)
      }
    }
  }

  const previewSrc = pendingImage || form.image || ''

  return (
    <form onSubmit={submit} className="bg-calista-cream border-2 border-calista-gold/40 rounded-lg p-4">
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="shrink-0">
          {previewSrc ? (
            <img
              src={previewSrc}
              alt=""
              className="w-28 h-28 object-cover rounded-md bg-white"
              onError={(e) => { e.currentTarget.style.visibility = 'hidden' }}
            />
          ) : (
            <div className="w-28 h-28 rounded-md bg-white flex items-center justify-center text-calista-ink/30 text-xs text-center px-2">
              No image
            </div>
          )}
          <div className="flex flex-col gap-1 mt-2">
            <button type="button" onClick={() => fileRef.current?.click()} disabled={busy}
              className="text-xs px-3 py-1.5 bg-calista-ink text-calista-cream rounded-full disabled:opacity-50">
              {pendingImage ? 'Change photo' : 'Upload photo'}
            </button>
            {pendingImage && (
              <button type="button" onClick={() => setPendingImage(null)}
                className="text-xs px-3 py-1.5 border border-calista-ink/20 rounded-full hover:border-red-500 hover:text-red-600">
                Remove new photo
              </button>
            )}
            <input ref={fileRef} type="file" accept="image/*" onChange={onPickImage} className="hidden" />
          </div>
        </div>

        <div className="flex-1 space-y-3">
          <Field label="Title" value={form.title} onChange={handleField('title')} required placeholder="e.g. Aperitivo Hour" />
          <Field label="Description" value={form.description} onChange={handleField('description')} textarea placeholder="Short, appetising description — what, when, how much" />
          <div className="grid sm:grid-cols-2 gap-3">
            <Field label="Start date" type="date" value={form.startDate} onChange={handleField('startDate')} required />
            <Field label="End date" type="date" value={form.endDate} onChange={handleField('endDate')} required />
          </div>
          <div className="grid sm:grid-cols-2 gap-3">
            <Field label="Image URL (used if no photo uploaded)" value={form.image} onChange={handleField('image')} placeholder="https://…" />
            <Field label="Link URL (FB post, booking page)" value={form.url} onChange={handleField('url')} placeholder="https://facebook.com/…" />
          </div>
          {err && <p className="text-sm text-red-600">{err}</p>}
          <div className="flex flex-wrap gap-2 pt-2">
            <button type="submit" disabled={busy} className="px-4 py-2 bg-calista-ink text-calista-cream rounded-full text-sm font-semibold disabled:opacity-50">
              {busy ? 'Saving…' : isEdit ? 'Save changes' : 'Add promotion'}
            </button>
            <button type="button" onClick={onDone} disabled={busy} className="px-4 py-2 border border-calista-ink/20 rounded-full text-sm disabled:opacity-50">
              Cancel
            </button>
            {isEdit && (
              <button type="button" onClick={onDelete} disabled={busy} className="px-4 py-2 border border-calista-ink/20 rounded-full text-sm hover:border-red-500 hover:text-red-600 ml-auto disabled:opacity-50">
                Delete
              </button>
            )}
          </div>
        </div>
      </div>
    </form>
  )
}

function CustomersSection() {
  const { list, remove, refreshList } = useCustomers()
  const { loyaltyTiers } = useSettings()
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState(null)

  useEffect(() => {
    let alive = true
    refreshList()
      .catch((e) => { if (alive) setErr(e.message || 'Could not load customers.') })
      .finally(() => { if (alive) setLoading(false) })
    return () => { alive = false }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const sorted = [...list].sort((a, b) =>
    (b.lastSeen || '').localeCompare(a.lastSeen || '')
  )

  const onDelete = async (c) => {
    if (confirm(`Delete customer ${c.name} (${c.phone})?`)) {
      try {
        await remove(c.phone)
      } catch (e) {
        alert(e.message || 'Could not delete customer.')
      }
    }
  }

  const fmtDate = (iso) => {
    if (!iso) return ''
    return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
  }

  return (
    <section className="mb-12">
      <h2 className="font-display text-2xl text-calista-gold mb-4 border-b border-calista-ink/10 pb-2">
        Customers ({loading ? '…' : list.length})
      </h2>

      {err ? (
        <div className="bg-white border border-red-200 rounded-lg p-6 text-center text-red-600">
          {err}
        </div>
      ) : loading ? (
        <div className="bg-white border border-calista-ink/10 rounded-lg p-6 text-center text-calista-ink/50">
          Loading customers…
        </div>
      ) : list.length === 0 ? (
        <div className="bg-white border border-calista-ink/10 rounded-lg p-6 text-center text-calista-ink/60">
          No customers yet. They'll appear here when guests sign in at a table via QR code.
        </div>
      ) : (
        <div className="bg-white border border-calista-ink/10 rounded-lg overflow-hidden overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-calista-cream/50 text-xs uppercase tracking-wider text-calista-ink/60">
              <tr>
                <th className="text-left p-3">Name</th>
                <th className="text-left p-3">Phone</th>
                <th className="text-right p-3">Visits</th>
                <th className="text-right p-3">Spent</th>
                <th className="text-left p-3">Tier</th>
                <th className="text-left p-3">Last seen</th>
                <th className="p-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {sorted.map((c) => {
                const tier = getTier(c.visits, loyaltyTiers)
                return (
                  <tr key={c.phone}>
                    <td className="p-3 font-semibold">{c.name}</td>
                    <td className="p-3 text-calista-ink/70">{c.phone}</td>
                    <td className="p-3 text-right">{c.visits}</td>
                    <td className="p-3 text-right">{formatLKR(c.totalSpent || 0)}</td>
                    <td className="p-3">
                      <span className="text-xs px-2 py-1 rounded-full bg-calista-gold/10 text-calista-ink border border-calista-gold/30">
                        {tier.name} · {tier.discountPercent}%
                      </span>
                    </td>
                    <td className="p-3 text-calista-ink/70">{fmtDate(c.lastSeen)}</td>
                    <td className="p-3 text-right">
                      <button
                        onClick={() => onDelete(c)}
                        className="text-calista-ink/40 hover:text-red-600 p-1"
                        aria-label="Delete"
                      >
                        ✕
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}

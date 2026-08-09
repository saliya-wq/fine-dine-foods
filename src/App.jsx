import { useEffect } from 'react'
import { Routes, Route, Link, NavLink, useLocation, useNavigate } from 'react-router-dom'
import Home from './pages/Home.jsx'
import Menu from './pages/Menu.jsx'
import Promotions from './pages/Promotions.jsx'
import Cart from './pages/Cart.jsx'
import Checkout from './pages/Checkout.jsx'
import Track from './pages/Track.jsx'
import Admin from './pages/Admin.jsx'
import AdminQR from './pages/AdminQR.jsx'
import { useCart } from './cart.jsx'
import { useImages } from './imageStore.jsx'
import { useTable } from './tableSession.jsx'
import { useCustomers } from './customerStore.jsx'
import { useSettings, getTier, computeOrderTotals } from './settingsStore.jsx'
import { formatLKR } from './format.js'
import { BRAND_LOGO_ID } from './brand.js'
import { useBrand } from './brandStore.jsx'
import { syncInstallState } from './push.js'

function Nav() {
  const { count } = useCart()
  const { getImage } = useImages()
  const brand = useBrand()
  const logo = getImage(BRAND_LOGO_ID, null)
  const link = ({ isActive }) =>
    `px-3 py-2 text-sm font-medium transition ${
      isActive ? 'text-calista-gold' : 'text-calista-cream/80 hover:text-calista-cream'
    }`
  return (
    <header className="bg-calista-ink text-calista-cream sticky top-0 z-40 shadow no-print">
      <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-2">
          {logo ? (
            <img src={logo} alt={brand.name} className="h-9 w-9 object-cover rounded-full bg-calista-cream" />
          ) : (
            <span className="h-9 w-9 rounded-full bg-calista-gold text-calista-ink flex items-center justify-center font-display text-xl font-bold">
              {brand.name ? brand.name[0].toUpperCase() : '•'}
            </span>
          )}
          <span className="font-display text-2xl tracking-wide">{brand.name || 'Your Restaurant'}</span>
        </Link>
        <nav className="flex items-center gap-1">
          <NavLink to="/" end className={link}>Home</NavLink>
          <NavLink to="/menu" className={link}>Menu</NavLink>
          <NavLink to="/promotions" className={link}>Promotions</NavLink>
          <NavLink to="/cart" className={link}>
            Cart
            {count > 0 && (
              <span className="ml-1 inline-flex items-center justify-center bg-calista-gold text-calista-ink rounded-full text-xs font-bold w-5 h-5">
                {count}
              </span>
            )}
          </NavLink>
        </nav>
      </div>
    </header>
  )
}

function TableBanner() {
  const { table, setTable } = useTable()
  const { active, clearActive } = useCustomers()
  if (!table) return null
  const handleClear = () => {
    clearActive()
    setTable(null)
  }
  return (
    <div className="bg-calista-gold text-calista-ink text-sm py-2 px-4 text-center no-print">
      Ordering for <strong>Table {table}</strong>
      {active && <span className="mx-2">·</span>}
      {active && <span>{active.name}</span>}
      <button onClick={handleClear} className="ml-3 underline hover:no-underline">
        Clear
      </button>
    </div>
  )
}

function Footer() {
  const brand = useBrand()
  const socialCls =
    'w-9 h-9 rounded-full border border-calista-cream/30 flex items-center justify-center hover:border-calista-gold hover:text-calista-gold transition'
  return (
    <footer className="bg-calista-ink text-calista-cream/70 mt-12 no-print">
      <div className="max-w-5xl mx-auto px-4 py-10 text-sm grid sm:grid-cols-3 gap-6">
        <div>
          <h3 className="font-display text-calista-cream text-xl mb-2">{brand.name || 'Your Restaurant'}</h3>
          {brand.tagline && <p className="mb-4">{brand.tagline}</p>}
          <div className="flex gap-3">
            {brand.facebook && (
              <a href={brand.facebook} target="_blank" rel="noopener noreferrer" aria-label="Facebook" className={socialCls}>
                <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4"><path d="M13 22v-8h3l1-4h-4V7.5c0-1.1.4-2 2-2h2V2h-3c-3 0-5 1.8-5 5v3H6v4h3v8h4z"/></svg>
              </a>
            )}
            {brand.instagram && (
              <a href={brand.instagram} target="_blank" rel="noopener noreferrer" aria-label="Instagram" className={socialCls}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4"><rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none"/></svg>
              </a>
            )}
            {brand.whatsappHref && (
              <a href={brand.whatsappHref} target="_blank" rel="noopener noreferrer" aria-label="WhatsApp" className={socialCls}>
                <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4"><path d="M20.5 3.5A11 11 0 0 0 3 17l-1 5 5.2-1.4A11 11 0 1 0 20.5 3.5zM12 20a8 8 0 0 1-4.1-1.1l-.3-.2-3.1.8.8-3-.2-.3A8 8 0 1 1 12 20zm4.4-5.6c-.2-.1-1.4-.7-1.6-.8-.2-.1-.4-.1-.5.1-.2.2-.6.8-.7.9-.1.2-.3.2-.5.1-.2-.1-1-.4-1.9-1.2-.7-.6-1.2-1.4-1.3-1.6-.1-.2 0-.4.1-.5l.4-.4c.1-.1.2-.3.2-.4 0-.2 0-.3-.1-.4-.1-.1-.5-1.3-.7-1.7-.2-.5-.4-.4-.5-.4h-.5c-.2 0-.4 0-.6.3-.2.2-.8.8-.8 2s.9 2.3 1 2.5c.1.2 1.8 2.7 4.3 3.8.6.3 1.1.4 1.4.5.6.2 1.1.2 1.5.1.5-.1 1.4-.6 1.6-1.1.2-.5.2-1 .1-1.1z"/></svg>
              </a>
            )}
          </div>
        </div>
        <div>
          <h4 className="font-semibold text-calista-cream mb-2">Hours</h4>
          {brand.hoursLines.length ? brand.hoursLines.map((l) => <p key={l}>{l}</p>) : <p className="text-calista-cream/40">—</p>}
        </div>
        <div>
          <h4 className="font-semibold text-calista-cream mb-2">Contact</h4>
          {brand.address && <p>{brand.address}</p>}
          {brand.addressLine2 && <p>{brand.addressLine2}</p>}
          {brand.phone && (
            <p><a href={brand.phoneHref} className="hover:text-calista-gold">{brand.phone}</a></p>
          )}
          {brand.whatsapp && (
            <p>
              <a href={brand.whatsappHref} target="_blank" rel="noopener noreferrer" className="hover:text-calista-gold">
                WhatsApp · {brand.whatsapp}
              </a>
            </p>
          )}
        </div>
      </div>
      <div className="flex justify-between items-center max-w-5xl mx-auto px-4 pb-5 text-xs text-calista-cream/40">
        <span>© {new Date().getFullYear()} {brand.name || 'Your Restaurant'}</span>
        <Link to="/admin" className="hover:text-calista-gold">Admin</Link>
      </div>
    </footer>
  )
}

function OrderBar() {
  const { table } = useTable()
  const { items, subtotal } = useCart()
  const { active } = useCustomers()
  const { serviceChargePercent, loyaltyTiers } = useSettings()
  const location = useLocation()
  const navigate = useNavigate()

  if (items.length === 0) return null
  if (location.pathname === '/checkout') return null
  if (location.pathname.startsWith('/admin')) return null

  const isTable = !!table
  const tier = active ? getTier(active.visits, loyaltyTiers) : null
  const totals = computeOrderTotals({
    subtotal,
    serviceChargePercent: isTable ? serviceChargePercent : 0,
    discountPercent: tier?.discountPercent || 0
  })
  const count = items.reduce((s, i) => s + i.qty, 0)
  const breakdownBits = []
  if (totals.discountPercent > 0) breakdownBits.push(`${totals.discountPercent}% off`)
  if (totals.serviceChargePercent > 0) breakdownBits.push(`${totals.serviceChargePercent}% service`)
  const breakdown = breakdownBits.length ? ` · incl. ${breakdownBits.join(' & ')}` : ''
  const label = isTable
    ? `Table ${table} · ${count} item${count === 1 ? '' : 's'}${breakdown}`
    : `${count} item${count === 1 ? '' : 's'}${breakdown}`
  const buttonText = isTable ? 'Confirm order →' : 'Continue →'

  return (
    <div className="fixed bottom-0 left-0 right-0 z-40 bg-calista-ink text-calista-cream shadow-[0_-4px_24px_rgba(0,0,0,0.2)] no-print">
      <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="text-calista-cream/60 text-xs truncate">{label}</div>
          <div className="font-semibold text-xl">{formatLKR(totals.total)}</div>
        </div>
        <button
          onClick={() => navigate('/checkout')}
          className="bg-calista-gold text-calista-ink px-5 py-3 rounded-full font-semibold hover:bg-calista-cream transition shrink-0"
        >
          {buttonText}
        </button>
      </div>
    </div>
  )
}

function WhatsAppFab() {
  const location = useLocation()
  const { items } = useCart()
  const brand = useBrand()
  if (location.pathname.startsWith('/admin')) return null
  if (items.length > 0) return null
  if (!brand.whatsappHref) return null
  return (
    <a
      href={brand.whatsappHref}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Chat on WhatsApp"
      className="fixed bottom-5 right-5 z-50 w-14 h-14 rounded-full bg-[#25D366] text-white shadow-lg flex items-center justify-center hover:scale-105 transition no-print"
    >
      <svg viewBox="0 0 24 24" fill="currentColor" className="w-7 h-7">
        <path d="M20.5 3.5A11 11 0 0 0 3 17l-1 5 5.2-1.4A11 11 0 1 0 20.5 3.5zM12 20a8 8 0 0 1-4.1-1.1l-.3-.2-3.1.8.8-3-.2-.3A8 8 0 1 1 12 20zm4.4-5.6c-.2-.1-1.4-.7-1.6-.8-.2-.1-.4-.1-.5.1-.2.2-.6.8-.7.9-.1.2-.3.2-.5.1-.2-.1-1-.4-1.9-1.2-.7-.6-1.2-1.4-1.3-1.6-.1-.2 0-.4.1-.5l.4-.4c.1-.1.2-.3.2-.4 0-.2 0-.3-.1-.4-.1-.1-.5-1.3-.7-1.7-.2-.5-.4-.4-.5-.4h-.5c-.2 0-.4 0-.6.3-.2.2-.8.8-.8 2s.9 2.3 1 2.5c.1.2 1.8 2.7 4.3 3.8.6.3 1.1.4 1.4.5.6.2 1.1.2 1.5.1.5-.1 1.4-.6 1.6-1.1.2-.5.2-1 .1-1.1z"/>
      </svg>
    </a>
  )
}

export default function App() {
  const brand = useBrand()
  const { active } = useCustomers()
  useEffect(() => {
    document.title = brand.name ? `${brand.name} — Menu & Online Ordering` : 'Menu & Online Ordering'
  }, [brand.name])

  // Attach this device's push subscription / home-screen install to the
  // customer once we know who they are. Silent, best-effort.
  useEffect(() => {
    if (active?.phone) syncInstallState(active.phone)
  }, [active?.phone])
  return (
    <div className="min-h-screen flex flex-col">
      <Nav />
      <TableBanner />
      <main className="flex-1">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/menu" element={<Menu />} />
          <Route path="/promotions" element={<Promotions />} />
          <Route path="/cart" element={<Cart />} />
          <Route path="/checkout" element={<Checkout />} />
          <Route path="/track/:id" element={<Track />} />
          <Route path="/admin" element={<Admin />} />
          <Route path="/admin/qr" element={<AdminQR />} />
        </Routes>
      </main>
      <Footer />
      <WhatsAppFab />
      <OrderBar />
    </div>
  )
}

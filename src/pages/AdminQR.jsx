import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { QRCodeSVG } from 'qrcode.react'
import { useBrand } from '../brandStore.jsx'

const SESSION_KEY = 'calista_admin_authed'
const COUNT_KEY = 'calista_table_count'
const BASE_KEY = 'calista_qr_base_url'

export default function AdminQR() {
  const navigate = useNavigate()
  const brand = useBrand()
  const authed = sessionStorage.getItem(SESSION_KEY) === '1'

  useEffect(() => {
    if (!authed) navigate('/admin')
  }, [authed, navigate])

  const [count, setCount] = useState(() => {
    const v = Number(localStorage.getItem(COUNT_KEY))
    return v && v > 0 ? v : 12
  })
  const [baseUrl, setBaseUrl] = useState(
    () => localStorage.getItem(BASE_KEY) || (typeof window !== 'undefined' ? window.location.origin : '')
  )

  useEffect(() => {
    localStorage.setItem(COUNT_KEY, String(count))
  }, [count])

  useEffect(() => {
    localStorage.setItem(BASE_KEY, baseUrl)
  }, [baseUrl])

  if (!authed) return null

  const tables = Array.from({ length: count }, (_, i) => i + 1)

  return (
    <div className="max-w-5xl mx-auto px-4 py-10">
      <div className="flex flex-wrap justify-between items-center gap-3 mb-2 no-print">
        <h1 className="font-display text-4xl">Table QR codes</h1>
        <div className="flex gap-2">
          <Link to="/admin" className="text-sm px-4 py-2 border border-calista-ink/20 rounded-full hover:border-calista-gold">
            ← Back to admin
          </Link>
          <button
            onClick={() => window.print()}
            className="text-sm px-4 py-2 bg-calista-ink text-calista-cream rounded-full hover:bg-calista-gold hover:text-calista-ink transition"
          >
            Print all
          </button>
        </div>
      </div>
      <p className="text-calista-ink/60 mb-6 no-print">
        Each QR code, when scanned, opens the menu pre-tagged with that table number. Customers' orders are emailed to reception with the table on the subject line.
      </p>

      <div className="grid sm:grid-cols-2 gap-4 mb-8 no-print">
        <label className="block">
          <span className="text-sm font-medium block mb-1">Number of tables</span>
          <input
            type="number"
            min="1"
            max="100"
            value={count}
            onChange={(e) => setCount(Math.max(1, Math.min(100, Number(e.target.value) || 1)))}
            className="w-full px-4 py-3 border border-calista-ink/20 rounded-lg focus:outline-none focus:border-calista-gold bg-white"
          />
        </label>
        <label className="block">
          <span className="text-sm font-medium block mb-1">Public site URL</span>
          <input
            type="url"
            value={baseUrl}
            onChange={(e) => setBaseUrl(e.target.value)}
            placeholder="https://calista.lk"
            className="w-full px-4 py-3 border border-calista-ink/20 rounded-lg focus:outline-none focus:border-calista-gold bg-white"
          />
          <span className="text-xs text-calista-ink/50 mt-1 block">
            Defaults to the current origin. Change this to your deployed URL before printing.
          </span>
        </label>
      </div>

      <div className="qr-grid grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
        {tables.map((n) => {
          const url = `${baseUrl.replace(/\/$/, '')}/menu?table=${n}`
          return (
            <div
              key={n}
              className="qr-card border-2 border-calista-ink/20 rounded-lg p-4 text-center bg-white break-inside-avoid"
            >
              <p className="font-display text-xl mb-1">{brand.name || 'Your Restaurant'}</p>
              <p className="text-xs text-calista-ink/60 uppercase tracking-wider mb-3">
                Table {n}
              </p>
              <div className="bg-white p-2 inline-block">
                <QRCodeSVG value={url} size={160} level="M" includeMargin={false} />
              </div>
              <p className="text-xs text-calista-ink/60 mt-3">Scan to order</p>
            </div>
          )
        })}
      </div>

      <style>{`
        @media print {
          .no-print { display: none !important; }
          body { background: white !important; }
          .qr-grid { grid-template-columns: repeat(3, minmax(0, 1fr)) !important; gap: 0.5rem !important; }
          .qr-card { page-break-inside: avoid; break-inside: avoid; }
        }
      `}</style>
    </div>
  )
}

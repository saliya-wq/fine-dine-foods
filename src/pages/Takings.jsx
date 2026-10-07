import { useEffect, useState } from 'react'
import { staffPost } from '../staffSession.jsx'
import { formatLKR } from '../format.js'

// Chart mark only — a darker step of the brand gold. The brand's own #c8a96a
// sits at 2.25:1 on white, too low for a fill to read; this passes the chroma
// floor and 3:1 against both the white card and the cream surface.
const MARK = '#9c7628'

const RANGES = [
  { days: 7, label: '7 days' },
  { days: 14, label: '14 days' },
  { days: 30, label: '30 days' }
]

// 1284 -> "1,284"; keeps big money readable without a currency prefix per row.
const compact = (n) => Math.round(Number(n) || 0).toLocaleString('en-LK')

const dayLabel = (iso, todayIso) => {
  if (iso === todayIso) return 'Today'
  const d = new Date(iso + 'T00:00:00Z')
  return d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' })
}

export default function Takings() {
  const [range, setRange] = useState(7)
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    setLoading(true)
    staffPost('/api/orders', { action: 'takings', days: range })
      .then((d) => {
        setData(d)
        setError(null)
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false))
  }, [range])

  if (loading && !data) return <p className="text-calista-ink/50 py-10 text-center">Loading takings…</p>
  if (error) {
    return <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>
  }
  if (!data) return null

  const { days, totals, today } = data
  const peak = Math.max(...days.map((d) => d.revenue), 1)
  const todayIso = days[days.length - 1]?.date

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <div>
          <p className="text-sm text-calista-ink/60">Collected today</p>
          {/* Hero figure: sans, not the display face, and proportional figures. */}
          <p className="text-5xl font-semibold leading-tight">{formatLKR(today.collected)}</p>
        </div>
        <div className="flex gap-1">
          {RANGES.map((r) => (
            <button
              key={r.days}
              onClick={() => setRange(r.days)}
              className={`text-sm px-3 py-1.5 rounded-full border transition ${
                range === r.days
                  ? 'border-calista-gold bg-calista-cream/60 font-semibold'
                  : 'border-calista-ink/20 hover:border-calista-gold'
              }`}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8">
        <Tile label="Orders today" value={compact(today.orders)} />
        <Tile label="Cash today" value={formatLKR(today.cash)} />
        <Tile
          label="Still owed today"
          value={formatLKR(today.outstanding)}
          tone={today.outstanding > 0 ? 'warn' : undefined}
        />
        <Tile label={`Collected · ${range} days`} value={formatLKR(totals.collected)} />
      </div>

      <h3 className="text-sm font-semibold text-calista-ink/70 mb-1">Takings by day</h3>
      <p className="text-xs text-calista-ink/50 mb-3">
        Grouped by the day the order was placed, Sri Lanka time. Cancelled orders and unpaid online
        orders are excluded.
      </p>

      <div className="bg-white border border-calista-ink/10 rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <caption className="sr-only">Daily takings for the last {range} days</caption>
          <thead>
            <tr className="text-xs text-calista-ink/50 border-b border-calista-ink/10">
              <th scope="col" className="text-left font-medium px-3 sm:px-4 py-2">Day</th>
              <th scope="col" className="text-right font-medium px-2 py-2">Orders</th>
              <th scope="col" className="text-left font-medium px-2 py-2 w-1/2">Revenue</th>
              <th scope="col" className="text-right font-medium px-3 sm:px-4 py-2">Owed</th>
            </tr>
          </thead>
          <tbody>
            {days.map((d) => (
              <tr key={d.date} className="border-b border-calista-ink/5 last:border-0">
                <th scope="row" className="text-left font-normal px-3 sm:px-4 py-2 whitespace-nowrap">
                  {dayLabel(d.date, todayIso)}
                </th>
                <td className="text-right px-2 py-2 tabular-nums text-calista-ink/60">{d.orders || '—'}</td>
                <td className="px-2 py-2">
                  <div className="flex items-center gap-2">
                    {/* Single series, so no legend; the value rides the bar tip.
                        The bar scales within the cell minus room for that
                        label, so the peak day's figure never spills into the
                        Owed column on a phone. */}
                    <span
                      aria-hidden="true"
                      className="h-3 rounded-r-[4px] shrink-0"
                      style={{
                        width: `calc((100% - 4rem) * ${Math.max(d.revenue / peak, d.revenue > 0 ? 0.02 : 0)})`,
                        backgroundColor: MARK
                      }}
                    />
                    <span className="tabular-nums text-calista-ink/80 whitespace-nowrap">
                      {d.revenue > 0 ? compact(d.revenue) : '—'}
                    </span>
                  </div>
                </td>
                <td className="text-right px-3 sm:px-4 py-2 tabular-nums">
                  {d.outstanding > 0 ? (
                    <span className="text-amber-700">{compact(d.outstanding)}</span>
                  ) : (
                    <span className="text-calista-ink/30">—</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="grid sm:grid-cols-2 gap-3 mt-6">
        <Breakdown
          title={`How it was paid · ${range} days`}
          rows={[
            ['Cash', totals.cash],
            ['Online', totals.online],
            ['At the restaurant', totals.atRestaurant]
          ]}
        />
        <Breakdown
          title={`Where it came from · ${range} days`}
          rows={[
            ['Delivery', totals.delivery],
            ['Pick-up', totals.pickup],
            ['Dine-in', totals.table]
          ]}
        />
      </div>

      {totals.cancelled > 0 && (
        <p className="text-xs text-calista-ink/50 mt-4">
          {totals.cancelled} cancelled order{totals.cancelled === 1 ? '' : 's'} in this period, not counted above.
        </p>
      )}
    </div>
  )
}

function Tile({ label, value, tone }) {
  return (
    <div className="bg-calista-cream/60 border border-calista-ink/10 rounded-lg px-3 py-3">
      <div className={`text-lg sm:text-xl font-semibold ${tone === 'warn' ? 'text-amber-700' : ''}`}>{value}</div>
      <div className="text-xs text-calista-ink/60">{label}</div>
    </div>
  )
}

function Breakdown({ title, rows }) {
  const total = rows.reduce((n, [, v]) => n + v, 0)
  return (
    <div className="bg-white border border-calista-ink/10 rounded-lg p-4">
      <p className="text-sm font-semibold mb-2">{title}</p>
      <table className="w-full text-sm">
        <tbody>
          {rows.map(([label, value]) => (
            <tr key={label}>
              <th scope="row" className="text-left font-normal py-1 text-calista-ink/70">{label}</th>
              <td className="text-right py-1 tabular-nums">{formatLKR(value)}</td>
              <td className="text-right py-1 pl-3 tabular-nums text-calista-ink/40 w-12">
                {total > 0 ? `${Math.round((value / total) * 100)}%` : '—'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

import { useEffect, useState } from 'react'
import { useSettings } from '../settingsStore.jsx'
import { BRAND_FIELDS } from '../brand.js'
import { useBrandStore } from '../brandStore.jsx'

// Sysadmin-only: rendered as a tab in the staff console, and the save is
// re-checked server-side in api/settings.js.
export default function SiteSettings() {
  return (
    <section>
      <h3 className="font-semibold text-sm mb-2 text-calista-ink/70">Business details</h3>
      <BrandEditor />
      <ServiceChargeEditor />
      <LoyaltyTiersEditor />
    </section>
  )
}

function BrandEditor() {
  const { raw, saveBrand } = useBrandStore()
  const [form, setForm] = useState(raw)
  const [busy, setBusy] = useState(false)
  const [saved, setSaved] = useState(false)
  const [err, setErr] = useState(null)

  useEffect(() => { setForm(raw) }, [raw])

  const onSave = async (e) => {
    e.preventDefault()
    setBusy(true); setErr(null); setSaved(false)
    try {
      await saveBrand(form)
      setSaved(true)
      setTimeout(() => setSaved(false), 1500)
    } catch (e2) {
      setErr(e2.message || 'Could not save.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <form onSubmit={onSave} className="bg-white border border-calista-ink/10 rounded-lg p-4 mb-4 space-y-3">
      <p className="text-xs text-calista-ink/50">
        Shown across the site — header, footer, home page, table QR sheets. Leave a field blank to hide it.
      </p>
      {BRAND_FIELDS.map((f) => (
        <label key={f.key} className="block">
          <span className="text-xs font-medium block mb-1 text-calista-ink/70">{f.label}</span>
          {f.textarea ? (
            <textarea
              rows={2}
              value={form[f.key] || ''}
              placeholder={f.placeholder}
              onChange={(e) => setForm((s) => ({ ...s, [f.key]: e.target.value }))}
              className="w-full px-3 py-2 border border-calista-ink/20 rounded-lg focus:outline-none focus:border-calista-gold bg-white text-sm"
            />
          ) : (
            <input
              type="text"
              value={form[f.key] || ''}
              placeholder={f.placeholder}
              onChange={(e) => setForm((s) => ({ ...s, [f.key]: e.target.value }))}
              className="w-full px-3 py-2 border border-calista-ink/20 rounded-lg focus:outline-none focus:border-calista-gold bg-white text-sm"
            />
          )}
        </label>
      ))}
      {err && <p className="text-sm text-red-600">{err}</p>}
      <button
        type="submit"
        disabled={busy}
        className="px-5 py-2 bg-calista-ink text-calista-cream rounded-full text-sm font-semibold hover:bg-calista-gold hover:text-calista-ink transition disabled:opacity-50"
      >
        {busy ? 'Saving…' : saved ? 'Saved ✓' : 'Save business details'}
      </button>
    </form>
  )
}

function ServiceChargeEditor() {
  const { serviceChargePercent, update } = useSettings()
  const [value, setValue] = useState(String(serviceChargePercent))
  const [saved, setSaved] = useState(false)

  const onSave = (e) => {
    e.preventDefault()
    const n = Math.max(0, Math.min(100, Number(value) || 0))
    update({ serviceChargePercent: n })
    setValue(String(n))
    setSaved(true)
    setTimeout(() => setSaved(false), 1500)
  }

  return (
    <form
      onSubmit={onSave}
      className="bg-white border border-calista-ink/10 rounded-lg p-4 grid sm:grid-cols-[1fr_auto] gap-3 items-end mb-4"
    >
      <label className="block">
        <span className="text-sm font-medium block mb-1">
          Service charge (%)
          <span className="text-calista-ink/50 font-normal ml-2 text-xs">
            Applied to table (QR) orders only. Set 0 to disable.
          </span>
        </span>
        <input
          type="number"
          min="0"
          max="100"
          step="0.5"
          value={value}
          onChange={(e) => { setValue(e.target.value); setSaved(false) }}
          className="w-full px-4 py-3 border border-calista-ink/20 rounded-lg focus:outline-none focus:border-calista-gold bg-white"
        />
      </label>
      <button
        type="submit"
        className="px-5 py-3 bg-calista-ink text-calista-cream rounded-lg font-semibold hover:bg-calista-gold hover:text-calista-ink transition"
      >
        {saved ? "Saved ✓" : "Save"}
      </button>
    </form>
  )
}

function LoyaltyTiersEditor() {
  const { loyaltyTiers, update, resetTiers } = useSettings()
  const [tiers, setTiers] = useState(loyaltyTiers)
  const [saved, setSaved] = useState(false)

  const onChange = (idx, field, val) => {
    setTiers((prev) => prev.map((t, i) => (i === idx ? { ...t, [field]: val } : t)))
    setSaved(false)
  }

  const onSave = (e) => {
    e.preventDefault()
    const cleaned = tiers.map((t) => ({
      name: t.name.trim() || 'Tier',
      minVisits: Math.max(0, Number(t.minVisits) || 0),
      discountPercent: Math.max(0, Math.min(100, Number(t.discountPercent) || 0))
    })).sort((a, b) => a.minVisits - b.minVisits)
    update({ loyaltyTiers: cleaned })
    setTiers(cleaned)
    setSaved(true)
    setTimeout(() => setSaved(false), 1500)
  }

  const onReset = () => {
    resetTiers()
    setTiers([
      { name: 'New', minVisits: 0, discountPercent: 0 },
      { name: 'Returning', minVisits: 1, discountPercent: 5 },
      { name: 'Regular', minVisits: 5, discountPercent: 10 },
      { name: 'VIP', minVisits: 15, discountPercent: 15 }
    ])
    setSaved(true)
    setTimeout(() => setSaved(false), 1500)
  }

  return (
    <form onSubmit={onSave} className="bg-white border border-calista-ink/10 rounded-lg p-4">
      <div className="mb-3">
        <span className="text-sm font-medium block">Loyalty tiers</span>
        <span className="text-xs text-calista-ink/50">
          Discount applied to table orders based on how many times the customer has visited before.
        </span>
      </div>
      <div className="grid grid-cols-[minmax(0,1fr)_4.5rem_4.5rem] sm:grid-cols-[1fr_140px_140px] gap-2 mb-3 text-xs text-calista-ink/60 font-medium uppercase tracking-wider">
        <span>Tier name</span>
        <span>Min visits</span>
        <span>Discount %</span>
      </div>
      <div className="space-y-2">
        {tiers.map((tier, idx) => (
          <div key={idx} className="grid grid-cols-[minmax(0,1fr)_4.5rem_4.5rem] sm:grid-cols-[1fr_140px_140px] gap-2">
            <input
              type="text"
              value={tier.name}
              onChange={(e) => onChange(idx, 'name', e.target.value)}
              className="w-full min-w-0 px-3 py-2 border border-calista-ink/20 rounded-lg focus:outline-none focus:border-calista-gold bg-white text-sm"
            />
            <input
              type="number"
              min="0"
              value={tier.minVisits}
              onChange={(e) => onChange(idx, 'minVisits', e.target.value)}
              className="w-full min-w-0 px-3 py-2 border border-calista-ink/20 rounded-lg focus:outline-none focus:border-calista-gold bg-white text-sm text-right"
            />
            <input
              type="number"
              min="0"
              max="100"
              step="0.5"
              value={tier.discountPercent}
              onChange={(e) => onChange(idx, 'discountPercent', e.target.value)}
              className="w-full min-w-0 px-3 py-2 border border-calista-ink/20 rounded-lg focus:outline-none focus:border-calista-gold bg-white text-sm text-right"
            />
          </div>
        ))}
      </div>
      <div className="flex gap-2 mt-4">
        <button
          type="submit"
          className="px-5 py-2 bg-calista-ink text-calista-cream rounded-full text-sm font-semibold hover:bg-calista-gold hover:text-calista-ink transition"
        >
          {saved ? 'Saved ✓' : 'Save tiers'}
        </button>
        <button
          type="button"
          onClick={onReset}
          className="px-5 py-2 border border-calista-ink/20 rounded-full text-sm hover:border-calista-gold"
        >
          Reset to defaults
        </button>
      </div>
    </form>
  )
}

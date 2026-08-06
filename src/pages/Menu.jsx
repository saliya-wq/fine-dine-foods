import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useCart } from '../cart.jsx'
import { useImages } from '../imageStore.jsx'
import { useMenu } from '../menuStore.jsx'
import { useTable } from '../tableSession.jsx'
import { useCustomers, normalizePhone, greetingForNow } from '../customerStore.jsx'
import { useSettings, getTier } from '../settingsStore.jsx'
import { formatLKR } from '../format.js'
import { BRAND } from '../brand.js'

export default function MenuPage() {
  const { add } = useCart()
  const { getImage } = useImages()
  const { grouped } = useMenu()
  const { table, setTable } = useTable()
  const { active } = useCustomers()
  const { loyaltyTiers } = useSettings()
  const [params] = useSearchParams()
  const [toast, setToast] = useState(null)

  useEffect(() => {
    const t = params.get('table')
    if (t && /^\d+$/.test(t)) setTable(Number(t))
  }, [params, setTable])

  const needsCustomer = !active

  const handleAdd = (item) => {
    add(item)
    setToast(`${item.name} added`)
    setTimeout(() => setToast(null), 1500)
  }

  const hasAnyItems = grouped.some((c) => c.items.length > 0)

  return (
    <div className="max-w-5xl mx-auto px-4 py-10">
      {active && <CustomerGreeting customer={active} tiers={loyaltyTiers} />}

      <h1 className="font-display text-4xl mb-2">Menu</h1>
      <p className="text-calista-ink/60 mb-10">Tap any item to add it to your cart.</p>

      {!hasAnyItems && <p className="text-calista-ink/50">Menu coming soon.</p>}

      {grouped.map((cat) =>
        cat.items.length === 0 ? null : (
          <section key={cat.id} className="mb-12">
            <h2 className="font-display text-2xl text-calista-gold mb-4 border-b border-calista-ink/10 pb-2">
              {cat.name}
            </h2>
            <div className="grid sm:grid-cols-2 gap-4">
              {cat.items.map((item) => (
                <button
                  key={item.id}
                  onClick={() => handleAdd(item)}
                  className="text-left flex gap-4 p-3 rounded-lg bg-white border border-calista-ink/10 hover:border-calista-gold hover:shadow transition overflow-hidden"
                >
                  <img
                    src={getImage(item.id, item.image)}
                    alt={item.name}
                    loading="lazy"
                    className="w-24 h-24 sm:w-28 sm:h-28 object-cover rounded-md shrink-0 bg-calista-cream"
                    onError={(e) => { e.currentTarget.style.visibility = 'hidden' }}
                  />
                  <div className="flex-1 flex flex-col min-w-0">
                    <div className="font-semibold">{item.name}</div>
                    <div className="text-sm text-calista-ink/60 mt-1 line-clamp-2">{item.desc}</div>
                    <div className="mt-auto flex items-center justify-between pt-2">
                      <span className="font-semibold">{formatLKR(item.price)}</span>
                      <span className="text-xs text-calista-gold">Add +</span>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </section>
        )
      )}

      {toast && (
        <div className="fixed bottom-32 left-1/2 -translate-x-1/2 bg-calista-ink text-calista-cream px-4 py-2 rounded-full text-sm shadow-lg z-50">
          {toast}
        </div>
      )}

      {needsCustomer && <PhoneGate />}
    </div>
  )
}

function CustomerGreeting({ customer, tiers }) {
  const { clearActive } = useCustomers()
  const tier = getTier(customer.visits, tiers)
  const isNew = customer.visits === 0
  return (
    <div className="bg-calista-gold/10 border border-calista-gold/40 rounded-lg p-4 mb-6">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <p className="font-display text-xl sm:text-2xl">
            {greetingForNow()}, {customer.name}
          </p>
          {isNew ? (
            <p className="text-sm text-calista-ink/70 mt-1">
              Welcome to {BRAND.name}. Glad to have you with us.
            </p>
          ) : (
            <p className="text-sm text-calista-ink/70 mt-1">
              Lovely to see you again — this is your visit #{customer.visits + 1}.
            </p>
          )}
          {tier.discountPercent > 0 && (
            <p className="text-sm font-semibold text-calista-gold mt-2">
              {tier.name} customer · {tier.discountPercent}% off this order
            </p>
          )}
        </div>
        <button
          onClick={clearActive}
          className="text-xs text-calista-ink/50 hover:text-calista-ink underline shrink-0"
        >
          Not you?
        </button>
      </div>
    </div>
  )
}

function PhoneGate() {
  const { table } = useTable()
  const { lookup, create, setActive } = useCustomers()
  const { loyaltyTiers } = useSettings()
  const [step, setStep] = useState('phone')
  const [phone, setPhone] = useState('')
  const [name, setName] = useState('')
  const [pendingCustomer, setPendingCustomer] = useState(null)
  const [err, setErr] = useState(null)

  const onPhoneSubmit = (e) => {
    e.preventDefault()
    const normalized = normalizePhone(phone)
    if (!normalized) {
      setErr('Please enter a valid Sri Lankan mobile number.')
      return
    }
    setErr(null)
    const existing = lookup(normalized)
    if (existing) {
      setPendingCustomer(existing)
      setStep('greeting')
    } else {
      setStep('name')
    }
  }

  const onNameSubmit = (e) => {
    e.preventDefault()
    if (!name.trim()) {
      setErr('Please enter your name.')
      return
    }
    const created = create(phone, name)
    if (!created) {
      setErr('Could not save your details. Please try again.')
      return
    }
    setPendingCustomer(created)
    setStep('greeting')
    setErr(null)
  }

  const onContinue = () => setActive(pendingCustomer)

  return (
    <div className="fixed inset-0 z-50 bg-calista-ink/90 backdrop-blur-sm flex items-center justify-center p-4 no-print">
      <div className="bg-white rounded-2xl max-w-md w-full p-6 sm:p-8 shadow-2xl">
        <div className="text-center mb-6">
          <p className="text-calista-gold uppercase tracking-[0.3em] text-xs mb-1">Table {table}</p>
          <h2 className="font-display text-3xl">{BRAND.name}</h2>
        </div>

        {step === 'phone' && (
          <form onSubmit={onPhoneSubmit} className="space-y-4">
            <p className="text-calista-ink/70 text-center text-sm">
              Welcome! Please enter your mobile number to start your order.
            </p>
            <label className="block">
              <span className="text-sm font-medium block mb-1">Mobile number</span>
              <input
                type="tel"
                autoFocus
                value={phone}
                onChange={(e) => { setPhone(e.target.value); setErr(null) }}
                placeholder="077 123 4567"
                className="w-full px-4 py-3 border border-calista-ink/20 rounded-lg focus:outline-none focus:border-calista-gold text-lg"
              />
            </label>
            {err && <p className="text-sm text-red-600">{err}</p>}
            <button
              type="submit"
              className="w-full bg-calista-ink text-calista-cream py-3 rounded-full font-semibold hover:bg-calista-gold hover:text-calista-ink transition"
            >
              Continue
            </button>
            <p className="text-xs text-calista-ink/50 text-center">
              We use your number to remember you and offer loyalty rewards.
            </p>
          </form>
        )}

        {step === 'name' && (
          <form onSubmit={onNameSubmit} className="space-y-4">
            <p className="text-calista-ink/70 text-center text-sm">
              You're new here! What name shall we use?
            </p>
            <label className="block">
              <span className="text-sm font-medium block mb-1">Your name</span>
              <input
                type="text"
                autoFocus
                value={name}
                onChange={(e) => { setName(e.target.value); setErr(null) }}
                placeholder="e.g. Sarath Perera"
                className="w-full px-4 py-3 border border-calista-ink/20 rounded-lg focus:outline-none focus:border-calista-gold text-lg"
              />
            </label>
            {err && <p className="text-sm text-red-600">{err}</p>}
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => { setStep('phone'); setName('') }}
                className="px-4 py-3 border border-calista-ink/20 rounded-full text-sm"
              >
                ← Back
              </button>
              <button
                type="submit"
                className="flex-1 bg-calista-ink text-calista-cream py-3 rounded-full font-semibold hover:bg-calista-gold hover:text-calista-ink transition"
              >
                Continue
              </button>
            </div>
          </form>
        )}

        {step === 'greeting' && pendingCustomer && (
          <Greeting customer={pendingCustomer} tiers={loyaltyTiers} onContinue={onContinue} />
        )}
      </div>
    </div>
  )
}

function Greeting({ customer, tiers, onContinue }) {
  const tier = getTier(customer.visits, tiers)
  const isNew = customer.visits === 0
  return (
    <div className="text-center space-y-3">
      <p className="font-display text-3xl">
        {greetingForNow()},
        <br />
        <span className="text-calista-gold">{customer.name}!</span>
      </p>
      {isNew ? (
        <p className="text-calista-ink/70">
          Welcome to {BRAND.name}. We're glad you joined us tonight.
        </p>
      ) : (
        <p className="text-calista-ink/70">
          Lovely to see you back. This is your visit #{customer.visits + 1}.
        </p>
      )}
      {tier.discountPercent > 0 && (
        <div className="bg-calista-gold/10 border border-calista-gold/40 rounded-lg p-3">
          <p className="text-sm font-semibold text-calista-ink">
            {tier.name} customer · <span className="text-calista-gold">{tier.discountPercent}% off</span> this order
          </p>
        </div>
      )}
      {!isNew && tier.discountPercent === 0 && (
        <p className="text-sm text-calista-ink/60 italic">
          Keep coming back to unlock returning-customer rewards.
        </p>
      )}
      {isNew && (
        <p className="text-sm text-calista-ink/60 italic">
          You'll earn returning-customer rewards from your next visit.
        </p>
      )}
      <button
        onClick={onContinue}
        className="w-full bg-calista-ink text-calista-cream py-3 rounded-full font-semibold hover:bg-calista-gold hover:text-calista-ink transition mt-4"
      >
        Continue to menu →
      </button>
    </div>
  )
}

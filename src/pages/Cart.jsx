import { Link } from 'react-router-dom'
import { useCart } from '../cart.jsx'
import { useImages } from '../imageStore.jsx'
import { useMenu } from '../menuStore.jsx'
import { useTable } from '../tableSession.jsx'
import { useCustomers } from '../customerStore.jsx'
import { useSettings, getTier, computeOrderTotals } from '../settingsStore.jsx'
import { formatLKR } from '../format.js'

export default function Cart() {
  const { items, setQty, remove, subtotal } = useCart()
  const { getImage } = useImages()
  const { itemImageById } = useMenu()
  const { table } = useTable()
  const { active } = useCustomers()
  const { serviceChargePercent, loyaltyTiers } = useSettings()

  const isTable = !!table
  const tier = active ? getTier(active.visits, loyaltyTiers) : null
  const totals = computeOrderTotals({
    subtotal,
    serviceChargePercent: isTable ? serviceChargePercent : 0,
    discountPercent: tier?.discountPercent || 0
  })

  if (items.length === 0) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-20 text-center">
        <h1 className="font-display text-3xl mb-4">Your cart is empty</h1>
        <Link to="/menu" className="text-calista-gold underline underline-offset-4">
          Browse the menu →
        </Link>
      </div>
    )
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-10">
      <h1 className="font-display text-4xl mb-6">Your order</h1>
      <div className="bg-white border border-calista-ink/10 rounded-lg divide-y">
        {items.map((item) => (
          <div key={item.id} className="p-4 flex items-center gap-3 sm:gap-4">
            <img
              src={getImage(item.id, itemImageById[item.id] || '')}
              alt={item.name}
              className="w-14 h-14 object-cover rounded-md bg-calista-cream shrink-0"
              loading="lazy"
              onError={(e) => { e.currentTarget.style.visibility = 'hidden' }}
            />
            <div className="flex-1 min-w-0">
              <div className="font-semibold truncate">{item.name}</div>
              <div className="text-sm text-calista-ink/60">{formatLKR(item.price)}</div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setQty(item.id, item.qty - 1)}
                className="w-8 h-8 rounded-full border border-calista-ink/20 hover:border-calista-gold"
                aria-label="Decrease"
              >
                −
              </button>
              <span className="w-6 text-center">{item.qty}</span>
              <button
                onClick={() => setQty(item.id, item.qty + 1)}
                className="w-8 h-8 rounded-full border border-calista-ink/20 hover:border-calista-gold"
                aria-label="Increase"
              >
                +
              </button>
            </div>
            <div className="hidden sm:block w-24 text-right font-semibold">
              {formatLKR(item.price * item.qty)}
            </div>
            <button
              onClick={() => remove(item.id)}
              className="text-calista-ink/40 hover:text-red-600 p-1"
              aria-label="Remove"
            >
              ✕
            </button>
          </div>
        ))}
      </div>

      <div className="mt-6 mb-8 bg-white border border-calista-ink/10 rounded-lg p-4 space-y-2 text-sm">
        <div className="flex justify-between">
          <span className="text-calista-ink/60">Subtotal</span>
          <span className="font-semibold">{formatLKR(subtotal)}</span>
        </div>
        {totals.discountAmount > 0 && (
          <div className="flex justify-between text-calista-gold">
            <span>{tier.name} discount ({totals.discountPercent}%)</span>
            <span className="font-semibold">− {formatLKR(totals.discountAmount)}</span>
          </div>
        )}
        {isTable && (
          <div className="flex justify-between">
            <span className="text-calista-ink/60">Service charge ({totals.serviceChargePercent}%)</span>
            <span className="font-semibold">{formatLKR(totals.serviceCharge)}</span>
          </div>
        )}
        <div className="flex justify-between pt-2 border-t border-calista-ink/10">
          <span className="font-semibold">Total</span>
          <span className="text-2xl font-semibold">{formatLKR(totals.total)}</span>
        </div>
      </div>

      <Link
        to="/checkout"
        className="block text-center bg-calista-ink text-calista-cream py-4 rounded-full font-semibold hover:bg-calista-gold hover:text-calista-ink transition"
      >
        {isTable ? 'Confirm order' : 'Continue to checkout'}
      </Link>
    </div>
  )
}

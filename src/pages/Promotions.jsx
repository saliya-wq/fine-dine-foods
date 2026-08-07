import { usePromotions, statusOf, formatDateRange } from '../promotionsStore.jsx'
import { useImages } from '../imageStore.jsx'
import { useBrand } from '../brandStore.jsx'

export default function PromotionsPage() {
  const { items } = usePromotions()
  const { getImage } = useImages()
  const brand = useBrand()
  const today = new Date().toISOString().slice(0, 10)

  const visible = items
    .filter((p) => statusOf(p, today) !== 'past')
    .sort((a, b) => (a.startDate || '').localeCompare(b.startDate || ''))

  return (
    <div className="max-w-5xl mx-auto px-4 py-10">
      <h1 className="font-display text-4xl mb-2">What's on at {brand.name || 'our restaurant'}</h1>
      <p className="text-calista-ink/60 mb-10">
        Current promotions, weekly specials, and upcoming events.
      </p>

      {visible.length === 0 && (
        <div className="text-center py-12 bg-white border border-calista-ink/10 rounded-lg">
          <p className="text-calista-ink/60 mb-3">No promotions on right now.</p>
          {brand.facebook && (
            <a
              href={brand.facebook}
              target="_blank"
              rel="noopener noreferrer"
              className="text-calista-gold underline underline-offset-4"
            >
              Follow us on Facebook for updates →
            </a>
          )}
        </div>
      )}

      <div className="grid sm:grid-cols-2 gap-6">
        {visible.map((p) => {
          const status = statusOf(p, today)
          const image = getImage(p.id, p.image)
          return (
            <article
              key={p.id}
              className="bg-white border border-calista-ink/10 rounded-lg overflow-hidden flex flex-col"
            >
              <div className="relative bg-calista-cream">
                {image && (
                  <img
                    src={image}
                    alt={p.title}
                    loading="lazy"
                    className="w-full h-56 object-cover"
                    onError={(e) => {
                      e.currentTarget.style.visibility = 'hidden'
                    }}
                  />
                )}
                {status === 'upcoming' && (
                  <span className="absolute top-3 left-3 bg-calista-ink text-calista-cream text-xs font-semibold px-3 py-1 rounded-full uppercase tracking-wider">
                    Coming soon
                  </span>
                )}
                {status === 'active' && (
                  <span className="absolute top-3 left-3 bg-calista-gold text-calista-ink text-xs font-semibold px-3 py-1 rounded-full uppercase tracking-wider">
                    On now
                  </span>
                )}
              </div>
              <div className="p-5 flex flex-col flex-1">
                <h2 className="font-display text-2xl mb-1">{p.title}</h2>
                <p className="text-xs text-calista-gold font-semibold mb-3 uppercase tracking-wider">
                  {formatDateRange(p.startDate, p.endDate)}
                </p>
                <p className="text-calista-ink/70 text-sm mb-4 flex-1 whitespace-pre-line">
                  {p.description}
                </p>
                {p.url && (
                  <a
                    href={p.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-calista-gold font-semibold text-sm underline underline-offset-4 self-start"
                  >
                    More info →
                  </a>
                )}
              </div>
            </article>
          )
        })}
      </div>
    </div>
  )
}

import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useImages } from '../imageStore.jsx'
import { BRAND_HERO_ID } from '../brand.js'
import { useBrand } from '../brandStore.jsx'

const DEFAULT_HERO = 'https://images.unsplash.com/photo-1514933651103-005eec06c04b?w=1600&q=80'

const KITCHEN_SHOTS = [
  {
    src: 'https://images.unsplash.com/photo-1551183053-bf91a1d81141?w=1000&q=80',
    alt: 'Hand-rolled pasta',
    heading: 'Pasta, made by hand',
    body: 'Rolled fresh each morning from local-milled flour and farm eggs. Every shape — pappardelle, gnocchi, ravioli — finished to order.'
  },
  {
    src: 'https://images.unsplash.com/photo-1513104890138-7c749659a591?w=1000&q=80',
    alt: 'Wood-fired pizza',
    heading: 'Wood-fired in 90 seconds',
    body: 'Our stone oven runs at 450°C — the secret to that blistered, smoky crust under San Marzano tomatoes and fior di latte.'
  },
  {
    src: 'https://images.unsplash.com/photo-1414235077428-338989a2e8c0?w=1000&q=80',
    alt: 'Restaurant interior',
    heading: 'Built for an evening out',
    body: 'A warm, candlelit room a short walk from the lagoon — equally at home for a quiet dinner or a long table with friends.'
  },
  {
    src: 'https://images.unsplash.com/photo-1466637574441-749b8f19452f?w=1000&q=80',
    alt: 'Fresh ingredients',
    heading: 'Sourced from the coast',
    body: 'We buy what\'s in season from growers and fishers along Sri Lanka\'s west coast — what arrives that morning shapes the specials board.'
  },
  {
    src: 'https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?w=1000&q=80',
    alt: 'Chef plating a dish',
    heading: 'Plated to order',
    body: 'Nothing sits under a lamp. Every plate is composed when you order — sauces split, garnishes torn, finished at the pass.'
  },
  {
    src: 'https://images.unsplash.com/photo-1488477181946-6428a0291777?w=1000&q=80',
    alt: 'Dessert',
    heading: 'Sweet endings, made in-house',
    body: 'Tiramisu set in the morning, panna cotta wobbling at room temperature, gelato churned in small batches the same day.'
  }
]

const ROTATE_MS = 6000

export default function Home() {
  const { getImage } = useImages()
  const brand = useBrand()
  const hero = getImage(BRAND_HERO_ID, DEFAULT_HERO)
  const [idx, setIdx] = useState(() => Math.floor(Math.random() * KITCHEN_SHOTS.length))

  useEffect(() => {
    const id = setInterval(() => {
      setIdx((i) => (i + 1) % KITCHEN_SHOTS.length)
    }, ROTATE_MS)
    return () => clearInterval(id)
  }, [])

  const shot = KITCHEN_SHOTS[idx]

  return (
    <>
      <section className="relative text-calista-cream overflow-hidden">
        <div
          className="absolute inset-0 bg-cover bg-center"
          style={{ backgroundImage: `url(${hero})` }}
        />
        <div className="absolute inset-0 bg-calista-ink/45" />
        <div className="relative max-w-5xl mx-auto px-4 py-24 sm:py-32 text-center">
          <p className="text-calista-gold uppercase tracking-[0.3em] text-xs mb-4">
            Italian · Modern · Negombo
          </p>
          <h1 className="font-display text-5xl sm:text-7xl mb-6">
            Welcome{brand.name ? ` to ${brand.name}` : ''}
          </h1>
          <p className="max-w-xl mx-auto text-calista-cream/90 mb-8">
            Hand-rolled pasta, wood-fired pizza, and seasonal dishes from our kitchen to your table — at the restaurant, or at your door.
          </p>
          <div className="flex gap-3 justify-center flex-wrap">
            <span className="bg-calista-gold text-calista-ink px-6 py-3 rounded-full font-semibold opacity-90 cursor-default select-none">
              Order Online
            </span>
            {brand.phoneHref && (
              <a
                href={brand.phoneHref}
                className="border border-calista-cream/40 px-6 py-3 rounded-full font-semibold hover:border-calista-cream transition"
              >
                Call us
              </a>
            )}
            {brand.whatsappHref && (
              <a
                href={brand.whatsappHref}
                target="_blank"
                rel="noopener noreferrer"
                className="bg-[#25D366] text-white px-6 py-3 rounded-full font-semibold hover:opacity-90 transition"
              >
                WhatsApp
              </a>
            )}
          </div>
        </div>
      </section>

      <section className="max-w-5xl mx-auto px-4 py-16 grid sm:grid-cols-3 gap-6">
        {[
          { t: 'Pickup', d: 'Order ahead, skip the wait. Ready in 20 minutes.' },
          { t: 'Delivery', d: 'Hot food brought to your door.' },
          { t: 'Dine In', d: 'Book a table — walk-ins welcome at the bar.' }
        ].map((card) => (
          <div key={card.t} className="text-center p-6 border border-calista-ink/10 rounded-lg bg-white">
            <h3 className="font-display text-2xl mb-2">{card.t}</h3>
            <p className="text-calista-ink/70 text-sm">{card.d}</p>
          </div>
        ))}
      </section>

      <section className="bg-white border-y border-calista-ink/10">
        <div className="max-w-5xl mx-auto px-4 py-16 grid md:grid-cols-2 gap-10 items-center">
          <div key={`txt-${idx}`} className="fade-in">
            <p className="text-calista-gold uppercase tracking-[0.25em] text-xs mb-3">From our kitchen</p>
            <h2 className="font-display text-3xl sm:text-4xl mb-4">{shot.heading}</h2>
            <p className="text-calista-ink/70 mb-6">{shot.body}</p>
            <Link to="/menu" className="text-calista-gold font-semibold underline underline-offset-4">
              See the full menu →
            </Link>
            <div className="flex gap-1.5 mt-6">
              {KITCHEN_SHOTS.map((_, i) => (
                <button
                  key={i}
                  onClick={() => setIdx(i)}
                  aria-label={`Show kitchen shot ${i + 1}`}
                  className={`h-1.5 rounded-full transition-all ${
                    i === idx ? 'w-8 bg-calista-gold' : 'w-3 bg-calista-ink/20 hover:bg-calista-ink/40'
                  }`}
                />
              ))}
            </div>
          </div>
          <img
            key={`img-${idx}`}
            src={shot.src}
            alt={shot.alt}
            loading="lazy"
            className="rounded-lg shadow-lg w-full h-72 object-cover fade-in"
            onError={(e) => { e.currentTarget.style.visibility = 'hidden' }}
          />
        </div>
      </section>

      {(brand.address || brand.addressLine2 || brand.phone || brand.whatsapp) && (
        <section className="max-w-5xl mx-auto px-4 py-16 text-center">
          <h2 className="font-display text-3xl mb-4">Find us</h2>
          {(brand.address || brand.addressLine2) && (
            <p className="text-calista-ink/70">
              {brand.address}
              {brand.address && brand.addressLine2 && <br />}
              {brand.addressLine2}
            </p>
          )}
          <p className="mt-4">
            {brand.phone && (
              <a href={brand.phoneHref} className="text-calista-gold font-semibold">{brand.phone}</a>
            )}
            {brand.phone && brand.whatsapp && <span className="text-calista-ink/30 mx-3">·</span>}
            {brand.whatsapp && (
              <a href={brand.whatsappHref} target="_blank" rel="noopener noreferrer" className="text-calista-gold font-semibold">
                WhatsApp {brand.whatsapp}
              </a>
            )}
          </p>
        </section>
      )}
    </>
  )
}

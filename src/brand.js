// Brand/business details are stored in the database (site_settings) and edited
// in Admin → Settings → Business details. A fresh deployment starts blank —
// the operator fills these in, so the template is generic and reusable.

export const DEFAULT_BRAND = {
  name: '',
  tagline: '',
  address: '',
  addressLine2: '',
  phone: '',
  whatsapp: '',
  facebook: '',
  instagram: '',
  hoursText: '' // one line per row, edited as multiline text
}

// Editable field definitions, used to render the admin form.
export const BRAND_FIELDS = [
  { key: 'name', label: 'Business name', placeholder: 'e.g. Calista' },
  { key: 'tagline', label: 'Tagline', placeholder: 'e.g. Fresh, modern Italian. Dine-in, pickup or delivery.' },
  { key: 'address', label: 'Address line 1', placeholder: 'e.g. 280 Chilaw Road, Daluwakotuwa' },
  { key: 'addressLine2', label: 'Address line 2', placeholder: 'e.g. Kochchikade 11540, Sri Lanka' },
  { key: 'phone', label: 'Phone', placeholder: 'e.g. +94 31 227 4444' },
  { key: 'whatsapp', label: 'WhatsApp number', placeholder: 'e.g. +94 77 382 4824' },
  { key: 'facebook', label: 'Facebook URL', placeholder: 'https://facebook.com/…' },
  { key: 'instagram', label: 'Instagram URL', placeholder: 'https://instagram.com/…' },
  { key: 'hoursText', label: 'Opening hours (one line per row)', placeholder: 'Tue – Sun · 12pm – 10pm\nClosed Mondays', textarea: true }
]

// Merge saved values over defaults and compute derived fields (tel/wa links, hours list).
export const deriveBrand = (b = {}) => {
  const merged = { ...DEFAULT_BRAND, ...b }
  const telDigits = String(merged.phone || '').replace(/[^\d+]/g, '')
  const waDigits = String(merged.whatsapp || '').replace(/\D/g, '')
  return {
    ...merged,
    phoneHref: telDigits ? `tel:${telDigits}` : '',
    whatsappHref: waDigits ? `https://wa.me/${waDigits}` : '',
    hoursLines: String(merged.hoursText || '')
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean)
  }
}

export const BRAND_LOGO_ID = '__brand_logo'
export const BRAND_HERO_ID = '__brand_hero'

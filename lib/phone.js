// Sri Lankan mobile numbers in any common shape -> '+94XXXXXXXXX', or null.
// Customers are keyed by this, so every endpoint must normalise the same way.
export const normalizePhone = (raw) => {
  const digits = String(raw || '').replace(/\D/g, '')
  if (!digits) return null
  let local
  if (digits.startsWith('94') && digits.length === 11) local = digits.slice(2)
  else if (digits.startsWith('0') && digits.length === 10) local = digits.slice(1)
  else if (digits.length === 9) local = digits
  else return null
  return '+94' + local
}

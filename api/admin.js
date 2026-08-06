// Verifies the admin password against the server-side ADMIN_PASSWORD env var.
// The password lives ONLY in Vercel env — never in the client bundle or repo.
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return res.status(405).json({ error: 'Method not allowed' })
  }
  const expected = process.env.ADMIN_PASSWORD
  const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body || {}
  const provided = body.password || req.headers['x-admin-password'] || ''
  if (!expected || provided !== expected) {
    return res.status(401).json({ error: 'Incorrect password.' })
  }
  return res.status(200).json({ ok: true })
}

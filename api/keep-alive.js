import { admin } from '../lib/push.js'

// Twice-daily Vercel Cron (see vercel.json). Supabase pauses a free-tier project
// after about a week without "sufficient user database activity", which takes
// every order flow down while the menu still *looks* fine from cache. A single
// tiny read a day wasn't enough (we still got the warning email), so each run
// writes a heartbeat row and reads the main menu tables. The `heartbeat` row
// sits beside `brand`/`ordering` in site_settings; every reader there looks
// rows up by id, so it never surfaces in the app.
export default async function handler(req, res) {
  // Vercel Cron sends `Authorization: Bearer $CRON_SECRET` when that env var is set.
  const secret = process.env.CRON_SECRET
  if (secret && req.headers.authorization !== `Bearer ${secret}`) {
    return res.status(401).json({ error: 'Unauthorized.' })
  }

  const supabase = admin()
  const at = new Date().toISOString()
  const results = await Promise.all([
    supabase.from('site_settings').upsert({ id: 'heartbeat', data: { at } }),
    supabase.from('categories').select('id', { count: 'exact', head: true }),
    supabase.from('menu_items').select('id', { count: 'exact', head: true }),
    supabase.from('promotions').select('id', { count: 'exact', head: true })
  ])
  const error = results.find((r) => r.error)?.error
  if (error) {
    console.error('keep-alive failed:', error)
    return res.status(500).json({ ok: false, error: error.message })
  }
  return res.status(200).json({ ok: true, at })
}

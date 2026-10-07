import { admin } from '../lib/push.js'

// Daily Vercel Cron (see vercel.json). Supabase pauses a free-tier project
// after about a week with no activity, which takes every order flow down
// while the menu still *looks* fine from cache — this one tiny read keeps
// the project counted as active.
export default async function handler(req, res) {
  // Vercel Cron sends `Authorization: Bearer $CRON_SECRET` when that env var is set.
  const secret = process.env.CRON_SECRET
  if (secret && req.headers.authorization !== `Bearer ${secret}`) {
    return res.status(401).json({ error: 'Unauthorized.' })
  }

  const { error } = await admin().from('site_settings').select('id').limit(1)
  if (error) {
    console.error('keep-alive failed:', error)
    return res.status(500).json({ ok: false, error: error.message })
  }
  return res.status(200).json({ ok: true, at: new Date().toISOString() })
}

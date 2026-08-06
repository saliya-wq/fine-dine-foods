# Calista

PWA for Calista Restaurant in Negombo, Sri Lanka. Browse the menu, order online (pickup, delivery, or **scan-the-QR table ordering**), and let reception receive every order by email.

## Stack
- Vite + React + React Router
- Tailwind CSS
- vite-plugin-pwa (service worker, manifest, offline support)
- `qrcode.react` for table QR codes
- Cart, menu, promotions, and uploaded images all in `localStorage`
- Currency: LKR (`Rs.`)
- **Serverless email delivery via Resend** (Vercel function in `api/orders.js`)

## Run locally
```bash
cd calista
npm install
npm run dev          # frontend only — order emails will NOT send
```
Open http://localhost:5173.

### To test the order-email function locally
```bash
npm install -g vercel
cp .env.example .env.local
# Fill RECEPTION_EMAIL and RESEND_API_KEY in .env.local
vercel dev           # serves frontend AND /api/orders together
```

When running `npm run dev` (not `vercel dev`), checkout still works — it just shows a "demo mode" warning and skips the email.

## Build for production
```bash
npm run build
npm run preview
```

## Order flow

There are three checkout modes:

| Mode | Triggered by | Form fields | Email subject |
|---|---|---|---|
| **Pickup** | Default at `/checkout` | Name, phone, time | `[PICKUP] New order CAL-123456` |
| **Delivery** | Toggle at `/checkout` (+Rs. 500 fee) | Name, phone, address, time | `[DELIVERY] New order CAL-123456` |
| **Table** | Customer scans QR — URL is `/menu?table=N` | Name (optional), notes | `[Table N] New order CAL-123456` |

All three POST the order to `/api/orders` and the email lands at `RECEPTION_EMAIL`.

## Table QR codes

1. Go to **/admin** → password `calista2026` → click **Table QR codes →**
2. Set the **Number of tables** (default 12) and confirm the **Public site URL** (e.g. `https://calista.lk`). The URL is the base for the QR codes — make sure it matches your deployed site, not `localhost`.
3. Hit **Print all** — each QR encodes `<your-url>/menu?table=<n>`.
4. Stick the printed codes on the tables.
5. When a customer scans:
   - Their browser opens the menu pre-tagged with the table number
   - A gold banner shows "Ordering for Table N" at the top of every page
   - Checkout skips pickup/delivery and goes straight to "Send to kitchen"
   - Reception gets an email with `[Table N]` in the subject

## Setting up Resend (for real email)

1. Sign up at https://resend.com (free tier: 3,000 emails/month).
2. Create an API key in the dashboard. Copy it.
3. **For testing right now**, you can email yourself using their shared sender — set `RESEND_FROM_EMAIL=onboarding@resend.dev` and `RECEPTION_EMAIL=<your email>`. Resend's free tier only delivers to *the address that owns the account* until you verify a domain.
4. **For production**, verify your domain (e.g. `calista.lk`) in the Resend dashboard, then set `RESEND_FROM_EMAIL=Calista Orders <orders@calista.lk>`. Now mails can go to any address.

## Deploy

```bash
npm install -g vercel
vercel
# Follow prompts — link to a new Vercel project
```

Then in the Vercel dashboard → Project → Settings → Environment Variables, add:
- `RECEPTION_EMAIL`
- `RESEND_API_KEY`
- `RESEND_FROM_EMAIL` (optional)

Redeploy after setting env vars (`vercel --prod`).

After deploy, update the **Public site URL** field on `/admin/qr` to your deployed URL (e.g. `https://calista.vercel.app`) before printing QR codes.

### Other hosts

- **Netlify** — move `api/orders.js` to `netlify/functions/orders.js` and adjust the handler signature to Netlify's `(event, context) => ({ statusCode, body })` shape. Set the same env vars.
- **Cloudflare Pages** — needs a Pages Function in `functions/api/orders.js` using Cloudflare's Web-standard handler `({ request, env }) => Response`.

## Admin panel (`/admin`)

Password: **`calista2026`** — change `ADMIN_PASSWORD` in `src/pages/Admin.jsx`.

| Section | What you can do |
|---|---|
| Brand | Upload logo + hero image |
| Promotions | Create / edit / delete promotions with date ranges and FB links |
| Menu | Add categories, add items, edit name/description/price, upload item photos |
| Table QR codes | Generate and print QR codes for any number of tables |

All data is stored in **the admin's own browser** (`localStorage` and `sessionStorage`). For a multi-device admin or a shared menu source of truth, you need to swap the in-browser stores for a backend (Supabase, Firebase, or your own API). The provider pattern in `src/menuStore.jsx`, `src/promotionsStore.jsx`, etc. is structured to make that swap straightforward.

## Important demo-only limits

- **Admin auth** is a single hardcoded password in the JS bundle. Anyone who reads the bundle can find it. Before going live, replace with proper auth (Supabase Auth, Clerk, Firebase Auth).
- **Menu/promotion/image edits** are stored per-browser. Only the admin who made the change sees them on their device. To make changes live for all visitors, move data to a real backend.
- **`localStorage` is ~5MB.** With ~20 items at ~150KB JPEG each, plenty of headroom. If you exceed it, switch to IndexedDB or upload images to cloud storage.
- **Cart is per-browser session.** Different devices have different carts — by design.

## Edit defaults
- **Brand info (address, phone, WhatsApp, FB):** `src/brand.js`
- **Default menu items + prices (LKR):** `src/menu.js` (used as seed; admin edits override)
- **Default promotions:** `src/promotionsStore.jsx`
- **Brand colors:** `tailwind.config.js`
- **Hero image fallback:** `DEFAULT_HERO` in `src/pages/Home.jsx`
- **App icons:** `public/icon.svg`, `public/icon-maskable.svg`
- **Delivery fee:** `DELIVERY_FEE` constant in `src/pages/Checkout.jsx`

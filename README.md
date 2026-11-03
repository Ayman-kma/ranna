# رنّة · Ranna

**Turn your customer's phone into a pager.** A no-install customer calling system for
restaurants, cafés, clinics, banks and service centres — inspired by Bajri (بيجري).

The customer scans a QR code, watches their order status live in the browser, and gets a
loud push alert the moment their order is ready. Staff create orders and hit **Call** from a
tablet-friendly dashboard.

Arabic (RTL) is the default language, with a one-tap English toggle.

---

## What's built (v1 — core pager)

- **Staff dashboard** (`/dashboard`) — JWT login, create orders, live queue, one-tap
  Call / Complete / Cancel, QR code + shareable customer link, live ratings.
- **Customer page** (`/c/[token]`) — QR landing, live status over WebSocket, in-page chime +
  vibration on "ready", Web Push notifications (works with the tab closed on Android Chrome),
  1–5 star rating after pickup, Google-review invite.
- **Realtime backend** — REST + Socket.IO + SQLite (`node:sqlite`, zero native deps) +
  `web-push` (VAPID) notifications.
- **PWA** — manifest, service worker, generated PNG icons.

> Out of scope for this first version: marketing landing page, subscription/payment portal,
> analytics dashboards, white-label multi-tenant branding, POS integrations, and the native
> iOS App Clip (deferred — see [iOS App Clip](#ios-app-clip-deferred)).

---

## Stack

| Layer | Choice |
| --- | --- |
| Backend | Express + TypeScript, `node:sqlite`, Socket.IO, JWT, `web-push` |
| Frontend | Next.js 15 (App Router) + React 19 + Tailwind v4 |
| Push | Web Push (VAPID) via a service worker |
| Run | `tsx` (dev), `concurrently` (both apps) |

The backend uses Node's built-in SQLite (`node:sqlite`) so there is **no database server and
no native compilation** to install. Data lives in `server/data/ranna.sqlite`.

---

## Quick start

```bash
# 1. install everything
npm run install:all
npm install            # root: concurrently

# 2. run both apps (API :4000 + web :3000)
npm run dev
```

Open **http://localhost:3000** → you'll be redirected to the staff login.

**Demo staff account**

```
email:    staff@ranna.app
password: ranna12345
```

Then:

1. Type a customer name and press **طلب جديد / New order** → a QR code opens.
2. On your phone, scan the QR (or open the `/c/<token>` link) — the customer page shows
   *"being prepared"*.
3. In the dashboard press **نادِ العميل / Call customer** → the customer page flips to
   *"ready"* instantly and plays the chime.
4. Press **إتمام / Complete** → the customer is invited to rate.

The demo merchant + staff account are created automatically on first API start.

---

## Test on your Android phone (same Wi-Fi)

The phone can't reach your Mac's `localhost`, so both the URL in the QR and the API URL must
use your Mac's **LAN IP**.

1. **Same network.** Put the phone and Mac on the same Wi-Fi.
2. **Find your Mac's IP:**
   ```bash
   ipconfig getifaddr en0        # e.g. 192.168.100.39
   ```
3. **Point the app at that IP.** In `web/.env.local`:
   ```bash
   NEXT_PUBLIC_API_URL=http://192.168.100.39:4000
   NEXT_PUBLIC_PUBLIC_URL=http://192.168.100.39:3000
   ```
   and in `server/.env`:
   ```bash
   APP_BASE_URL=http://192.168.100.39:3000
   ```
   Then restart: `npm run dev`.
   *(On plain-HTTP LAN the app also auto-detects `<host>:4000` for the API, but the QR needs
   `NEXT_PUBLIC_PUBLIC_URL`.)*
4. **Open the dashboard on the Mac at the LAN URL** so the QR encodes it:
   `http://192.168.100.39:3000/dashboard`
5. Login (`staff@ranna.app` / `ranna12345`), type a name, press **طلب جديد**.
6. **Scan the QR with the phone** (Google Lens / Camera) → Chrome opens the customer page
   showing *"قيد التحضير / preparing"*.
7. **Tap the page once** (e.g. the 🔔 button) — this unlocks the phone's audio.
8. On the Mac dashboard press **نادِ العميل / Call customer** → the phone turns green,
   **"طلبك جاهز!"**, and plays the chime + vibrates.

**Troubleshooting**
- Phone can't load the page → check both are on the same Wi-Fi, and allow incoming
  connections for `node` in *System Settings → Network → Firewall*. Sanity check from the
  phone browser: `http://192.168.100.39:4000/api/health` should return JSON.
- No sound → tap the page first (browser autoplay policy); make sure the phone isn't muted.

> **Push vs. in-page chime.** Over plain `http://` the chime works **while the page is open**.
> True **Web Push while the phone is locked** requires **HTTPS** (service workers are disabled
> on insecure origins). The easiest way is a cloudflared quick tunnel:
>
> ```bash
> brew install cloudflared     # once
> ./scripts/tunnels.sh         # starts web+API tunnels, writes the URLs into the env files
> npm run dev                  # restart so the HTTPS URLs are picked up
> ```
>
> The script prints the dashboard URL and rewrites `web/.env.local` +
> `server/.env` for you. **Quick-tunnel URLs are random and change every run** — re-run the
> script and restart if the tunnels drop. On Android Chrome, push works without installing;
> on iOS you must *Add to Home Screen* first.

### Install for reliable delivery (recommended)

When a customer opens their order page, the app **immediately shows an install prompt**
("ثبّت رنّة على جوالك"). Installing matters on Android: if Chrome is force-stopped or its tab
is swiped away, an un-installed site can miss Web Push. The installed PWA (WebAPK) keeps
receiving notifications even when the browser isn't running.

- **تثبيت الآن / Install now** opens Chrome's native install dialog when available; otherwise
  it shows the exact menu steps (⋮ → *Install app* / *Add to Home screen*).
- The installed app's `start_url` is `/`; the root page redirects to the customer's
  **last order** (`localStorage: ranna_last_order`), so reopening it shows their order rather
  than the staff login.
- Installability requires HTTPS, so use the tunnel (above) when testing on a phone.

---

## Project structure

```
ranna/
├─ package.json            # run both apps with `npm run dev`
├─ server/                 # Express API + Socket.IO + web-push + SQLite
│  ├─ src/
│  │  ├─ index.ts          # app bootstrap
│  │  ├─ config.ts         # env
│  │  ├─ db.ts             # schema + queries (node:sqlite)
│  │  ├─ auth.ts           # JWT helpers + requireStaff
│  │  ├─ routes.ts         # REST endpoints
│  │  ├─ socket.ts         # realtime rooms + emit helpers
│  │  ├─ push.ts           # VAPID + web-push delivery
│  │  ├─ serialize.ts      # API shapes
│  │  └─ seed.ts           # demo merchant + staff
│  ├─ scripts/reset.mjs    # clear orders
│  └─ .env.example
└─ web/                    # Next.js dashboard + customer PWA
   ├─ src/app/
   │  ├─ login/            # staff login
   │  ├─ dashboard/        # staff board
   │  └─ c/[token]/        # customer page
   ├─ src/components/       # Brand, LanguageToggle, StatusBadge, StarRating
   ├─ src/lib/              # api, auth, socket, i18n, locale, audio, push
   ├─ public/               # manifest, sw.js, icons
   └─ scripts/              # icon generator + realtime test
```

---

## Environment

`server/.env` (copied from `.env.example` on first run):

| Key | Default | Notes |
| --- | --- | --- |
| `PORT` | `4000` | API port |
| `APP_BASE_URL` | `http://localhost:3000` | Used in push click-through URLs |
| `JWT_SECRET` | dev value | **Change in production** |
| `DB_FILE` | `./data/ranna.sqlite` | SQLite file |
| `VAPID_SUBJECT` | `mailto:admin@ranna.app` | VAPID contact |

VAPID keys are generated automatically on first start and stored in `server/.vapid.json`
(override with `VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY`).

`web/.env.local`:

| Key | Default |
| --- | --- |
| `NEXT_PUBLIC_API_URL` | `http://localhost:4000` |

---

## API

| Method | Path | Auth | Purpose |
| --- | --- | --- | --- |
| POST | `/api/auth/login` | — | Staff login → JWT |
| GET | `/api/me` | staff | Current profile |
| GET | `/api/orders` | staff | List orders |
| POST | `/api/orders` | staff | Create order (returns `customerUrl`) |
| POST | `/api/orders/:id/call` | staff | Mark ready + push + socket |
| POST | `/api/orders/:id/complete` | staff | Complete |
| POST | `/api/orders/:id/cancel` | staff | Cancel |
| GET | `/api/public/orders/:token` | — | Customer order status |
| POST | `/api/public/orders/:token/subscribe` | — | Save web-push subscription |
| POST | `/api/public/orders/:token/rating` | — | Submit rating |
| GET | `/api/push/public-key` | — | VAPID public key |
| GET | `/api/health` | — | Health check |

Realtime events (Socket.IO): staff join a merchant room and receive `order:created`,
`order:updated`, `order:rated`; customers join their order room and receive `order:status`.

---

## Notifications — what actually works where

This is the honest cross-platform picture (the question that started this project):

| Platform | Mechanism | Notes |
| --- | --- | --- |
| **Android (Chrome)** | **Web Push** (service worker + VAPID) | Works without installing — grant permission on the page. Best-effort across browsers. |
| **iOS (Safari)** | **Web Push only for installed PWAs** (iOS 16.4+) | User must *Add to Home Screen*; a normal Safari tab cannot receive push. Live in-page status + chime still work while open. |
| **Desktop** | Web Push | Fine in Chromium/Firefox. |

The in-page chime + vibration always work while the page is open (the audio context is
unlocked on first tap). Web Push covers the "phone locked / tab closed" case where supported.

### iOS App Clip (deferred)

The original uses an **iOS App Clip** + **Live Activity** for a native lock-screen
experience. App Clips are **iOS-only** (no Android equivalent), so Android is covered by the
PWA instead. Building the App Clip requires an **Apple Developer account** and a native
SwiftUI/ActivityKit target — deferred here because no Apple account is available yet. When
ready, the plan is:

1. SwiftUI app + App Clip target sharing one codebase.
2. `ActivityKit` Live Activity for the "order ready" lock-screen card.
3. APNs push from `server/push.ts` (add an APNs provider alongside web-push).
4. `apple-app-site-association` served from the API so the QR URL opens the Clip.

---

## Scripts

```bash
npm run dev          # API + web together
npm run dev:api      # API only (:4000)
npm run dev:web      # web only (:3000)
npm run build        # production build of web
npm run seed         # (re)create demo merchant + staff
npm run db:reset     # delete all orders + subscriptions

# from web/:
node scripts/test-realtime.mjs   # asserts a customer socket receives "called"
node scripts/gen-icons.mjs       # regenerate PWA icons
```

---

## Security / production notes

- Change `JWT_SECRET`; use HTTPS (required for service workers + push).
- Staff passwords are bcrypt-hashed; demo credentials are seed-only.
- Replace the demo `googleReviewUrl` with the real Google Maps review link.
- The current single-merchant seed is easy to extend to multi-tenant (`merchant_id` already
  scopes staff and orders).
- Consider rate-limiting public endpoints and rotating VAPID keys per environment.

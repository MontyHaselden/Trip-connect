# Itinerary Live

**School trip itineraries, rebuilt for phones.** Itinerary Live (operated by PayShare Limited trading as Itinerary Live) is a school trip management platform — live/offline student booklets, no GPS tracking, no per-student fees.

## Stack

- Next.js 16 (App Router), React 19
- Neon Postgres + Drizzle ORM
- IndexedDB for published trip snapshots on student devices

## Environment

Copy `.env.example` to `.env.local` and fill in values.

| Variable | Required | Notes |
|----------|----------|--------|
| `DATABASE_URL` | Yes | Neon (or Postgres) connection string |
| `SESSION_SECRET` | Yes | Long random string for host session HMAC |
| `BILLING_ENFORCEMENT_DISABLED` | No | Set `true` locally to skip billing gates on publish/student links |
| `RESEND_API_KEY` | No | Transactional email (welcome, invoice, activation) |
| `EMAIL_FROM` | No | Resend from address |
| `SUPPORT_EMAIL` | No | Shown on public contact/legal pages |
| `ADMIN_BOOTSTRAP_*` | No | One-time super-admin bootstrap (`npm run bootstrap:admin`) |
| `OPENAI_API_KEY` | No | AI itinerary import and phrase translation |
| `WEATHER_MODE` | No | `live` (default) or `mock` |
| `AERODATABOX_API_KEY` | No | Flight lookup |

## Scripts

```bash
npm install
npm run dev          # http://localhost:3000
npm run build        # production build
npm run db:apply     # apply SQL migrations (recommended)
npm run db:migrate   # drizzle-kit migrate
npm run seed:japan   # sample Japan trip + host login
npm run bootstrap:admin
```

## Launch billing (founding schools)

- **School plan:** $400 NZD + GST / year (`school_pro_plus` in DB)
- **Founding schools:** $240 NZD + GST first year (first 15 schools)
- **Trial:** 7 days on school signup — publish and student preview allowed; manual invoice to activate
- **Admin:** `/admin` — accounts, invoices, extend trial, mark active, founding flag

See `docs/PUBLISH_GOLDEN_TEST.md` for publish → student QA.

## Route map

| Audience | Routes |
|----------|--------|
| Public | `/`, `/features`, `/pricing`, `/contact`, `/terms`, `/privacy`, `/demo`, `/login`, `/signup` |
| School / personal | `/dashboard`, `/dashboard/trips/[tripId]/…` |
| Student | `/join/[inviteCode]` → `/trip/[tripId]/today`, `/trip/[tripId]/my-trip` |
| Viewer | `/view/[viewerCode]` |
| Admin | `/admin` |

## Production deploy notes

1. Run **all** migrations on production DB (`npm run db:apply`) before deploy.
2. Set `SESSION_SECRET`, `DATABASE_URL`, `RESEND_API_KEY`, `SUPPORT_EMAIL`.
3. **Do not** set `BILLING_ENFORCEMENT_DISABLED` in production.
4. Bootstrap admin with strong credentials — never use seed/demo passwords in production.
5. **Photo uploads** may use local disk — Vercel serverless needs object storage (S3/R2) for production photo hosting.

## Manual QA

See `docs/PUBLISH_GOLDEN_TEST.md` and the checklist in this repo’s marketing/signup flows.

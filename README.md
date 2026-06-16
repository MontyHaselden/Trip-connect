# Trip Connect

**School trip itineraries, rebuilt for phones.** Trip Connect is a school trip management platform that replaces paper booklets, email threads, and scattered updates with one live/offline trip hub. No student GPS tracking. No per-student fees. Students join by invite link and save the trip to their phone like a PWA.

## Stack

- Next.js 16 (App Router), React 19
- Neon Postgres + Drizzle ORM
- IndexedDB for published trip snapshots on student devices

## Environment

Create `.env.local`:

| Variable | Required | Notes |
|----------|----------|--------|
| `DATABASE_URL` | Yes | Neon (or Postgres) connection string |
| `SESSION_SECRET` | Yes | Long random string for host session HMAC |
| `OPENAI_API_KEY` | No | AI itinerary import and phrase translation |
| `OPENAI_MODEL` | No | Defaults to `gpt-4o-mini` |
| `WEATHER_MODE` | No | `live` (default) or `mock` for demos |
| `AERODATABOX_API_KEY` | No | [AeroDataBox on API.market](https://api.market/store/aedbx/aerodatabox) — your `x-api-market-key` for flight lookup |

## Scripts

```bash
npm install
npm run dev          # http://localhost:3000
npm run build        # production build
npm run db:migrate   # apply Drizzle migrations
npm run seed:japan   # sample Japan trip + host login
```

## Route map

| Audience | Routes |
|----------|--------|
| Public | `/`, `/features`, `/pricing`, `/demo`, `/payshare`, `/login`, `/signup` |
| School / personal | `/dashboard` (school or personal account), `/dashboard/trips/[tripId]/builder`, wizard, participants, photos, viewers, settings |
| Student | `/join/[inviteCode]` → `/trip/[tripId]/today`, `/trip/[tripId]/my-trip` |
| Viewer | `/view/[viewerCode]` (read-only itinerary + gallery) |

Legacy URLs redirect automatically:

- `/host` → `/dashboard`
- `/host/[inviteCode]/manage/*` → `/dashboard/trips/[tripId]/*`
- `/app/today`, `/app/my-trip`, `/app/calendar` → `/trip/[tripId]/*` (uses stored trip id)

## Host vs student

| Role | Entry | Auth |
|------|--------|------|
| Host | `/login` → `/dashboard` | Email/password (session cookie) |
| Student | `/join/[inviteCode]` | Name + phone; token in localStorage |
| Viewer | `/view/[viewerCode]` | Read-only; no personal data |

**Publishing:** Before any students join (`publishedVersion === 0` and no participants), edits auto-publish. Once the trip is live, changes are draft until the host publishes from the builder.

**AI builder:** Mock conversational editing at `/dashboard/trips/[tripId]/builder` — review proposals before applying. Optional OpenAI path behind env flag later.

## Manual QA checklist

1. **Marketing** — Landing, features, pricing, demo phone mock render correctly.
2. **Host signup** — Sign up → dashboard → create trip → builder split layout loads.
3. **Mock AI** — Chat proposes changes; Apply updates itinerary; Publish increments version.
4. **Student join** — Join link → `/trip/{id}/today`; 2-tab nav; calendar button opens month sheet.
5. **Pre-trip** — Countdown and next-meeting line on pre-trip days.
6. **Viewer** — Viewer link shows itinerary; no student phones.
7. **Photos** — Student upload compresses; host can hide from moderation page.
8. **Offline** — Load trip online, airplane mode, Today/My Trip still work from cache.
9. **Legacy redirects** — `/host`, `/app/today` still reach correct destinations.

## Project layout

- `src/app/api/auth/` — Host login/signup aliases
- `src/app/api/trips/` — Trip CRUD, publish, AI chat, snapshots
- `src/app/api/view/` — Viewer filtered snapshot
- `src/components/marketing/` — Public site
- `src/components/host/builder/` — AI split builder
- `src/lib/publish/` — Snapshot build, diff, auto-publish, viewer filter
- `src/lib/offline/` — IndexedDB sync for students
- `src/lib/ai/mock-chat.ts` — Rule-based AI proposals (MVP)

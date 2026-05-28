# Trip Connect

Mobile-first school trip booklet. Students use **Today** (daily schedule) and **My Trip** (contacts, emergency card, phrases) with offline caching after the first sync. Hosts manage content on a separate dashboard at `/host/[inviteCode]`.

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

## Scripts

```bash
npm install
npm run dev          # http://localhost:3000
npm run build        # production build
npm run db:migrate   # apply Drizzle migrations
npm run seed:japan   # sample Japan trip + host login
```

## Host vs student

| Role | Entry | Auth |
|------|--------|------|
| Host | `/host/[inviteCode]` | Email/password per trip |
| Student | `/join/[inviteCode]` → `/app/today`, `/app/my-trip` | Name + phone; token in localStorage |

**Publishing:** Before any students join (`publishedVersion === 0` and no participants), edits auto-publish. Once the trip is live, changes are draft until confirmed on the **Publish** page (with diff preview).

**AI features:** Itinerary import (`/host/.../itinerary`) and emergency phrase translation (`/host/.../phrases`) require `OPENAI_API_KEY` and a destination language in Settings.

## Manual QA checklist

1. **Host setup** — Log in, set trip dates/timezone/destination language in Settings.
2. **Content** — Add or AI-import itinerary; add contacts and phrases (try “Translate with AI” and bulk category translate).
3. **Pre-student publish** — Confirm `publishedVersion` increments automatically after edits (no manual publish).
4. **Student join** — Open join link in a private window; join with name + phone; verify Today and My Trip load after refresh.
5. **Live trip** — Add a participant or publish once; edit content; confirm students do **not** see changes until host confirms publish.
6. **Offline** — On student device: load trip online, enable airplane mode, confirm Today/My Trip still work from cache.
7. **Refresh** — Back online, tap **Refresh trip data**; confirm version line updates after host publish.
8. **Unpublished join** — Join before first publish; see “teachers are still preparing” message; publish as host; student refresh shows content.

## Project layout

- `src/app/api/host/` — Host CRUD and publish APIs
- `src/app/api/trips/` — Student published snapshot (HEAD/GET)
- `src/lib/publish/` — Snapshot build, diff, auto-publish
- `src/lib/offline/` — IndexedDB sync for students

# Publish → participant view — golden test

Manual QA checklist for founding-school launch. Run against local dev with Japan seed or your own trip.

**Prerequisites**

- `npm run db:apply` (includes migration `0025_launch_saas.sql`)
- `BILLING_ENFORCEMENT_DISABLED=true` in `.env.local` for unrestricted local testing
- Host logged in; trip with accommodation, transport, activities, and groups

## 1. Build trip in Trip OS

- [ ] Set trip name, dates, and school details
- [ ] Add accommodation stays with nights and assignments
- [ ] Add transport legs (flights / transfers)
- [ ] Add at least one activity
- [ ] Create groups / subgroups if used on the trip
- [ ] Assign participants to groups where relevant

## 2. Publish to participants

- [ ] Open Trip OS → **Update participants** (or `POST /api/trips/{tripId}/publish`)
- [ ] Publish succeeds (no 402 billing error while trial/active)
- [ ] Generate mobile / student invite links (`GET /api/trips/{tripId}/mobile-links`)

## 3. Student / participant view

- [ ] Open student invite link → join with test participant
- [ ] **Today** shows correct day schedule for that participant’s group
- [ ] Accommodation and transport match Trip OS data
- [ ] Activities visible on correct days
- [ ] Group-specific splits: participant only sees their subgroup itinerary
- [ ] Emergency card / phrases load
- [ ] **Finance** tab and admin-only cost data are **not** visible to students

## 4. Billing gate (staging / production)

- [ ] New school signup → `billing_status=trial`, `trial_ends_at` ≈ 7 days
- [ ] During trial: publish and student links work
- [ ] After trial expiry (or `past_due` / paused): publish returns 402; student snapshot returns empty / pending update
- [ ] Mark invoice paid in admin → account `active`; publish works again
- [ ] Data remains in dashboard after expiry (not deleted)

## 5. Regression smoke

- [ ] `npm test` — includes `src/lib/publish/build-participant-preview.test.ts`
- [ ] Participant preview API (`/api/trips/{tripId}/participant-preview`) matches published snapshot for host preview

## Japan seed shortcut

```bash
npm run seed:japan
# Log in as seeded host → open Japan trip → run checklist above
```

Trip id from seed script output (commonly used in dev): check `scripts/seed-japan-trip.ts`.

## Known limitations

- Photo uploads may use local filesystem — not suitable for Vercel serverless without object storage
- Email sends log to console in dev unless `RESEND_API_KEY` is set
- Xero, Stripe, PayShare checkout, and Booking.com are **not** part of Week 1

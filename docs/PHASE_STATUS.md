# Phase status & execution map

> **Read first:** [`ITINERARY_LIVE_BUILD_MEMORY.md`](./ITINERARY_LIVE_BUILD_MEMORY.md)  
> **Product vision:** [`TRIP_SYSTEM_VISION.md`](./TRIP_SYSTEM_VISION.md)  
> **Updated:** June 2026

This file tracks where we are against the 20 build phases. Update it when a phase is verified done.

---

## How we work (Cursor sessions)

1. You say: **“Do Phase N”** (one phase only).
2. Cursor reads `ITINERARY_LIVE_BUILD_MEMORY.md` + this file.
3. Cursor implements **only** that phase + acceptance tests / manual QA notes.
4. You verify in browser (especially calendar scroll for Phases 2–6).
5. Mark phase ✅ here, then next phase.

**Do not** skip ahead because something “feels related.” Phase 2 before Phase 11.

---

## Status legend

| Symbol | Meaning |
|--------|---------|
| ✅ | Verified — acceptance criteria met |
| 🟡 | Partial — started, not verified |
| ❌ | Not started |
| ⏭️ | Defer (explicitly out of scope until earlier phases done) |

---

## Phases 1–10 (core — do these first)

| Phase | Name | Status | Notes |
|-------|------|--------|-------|
| **1** | Trip Basics | 🟡 | `tripDatesAreUnset` / `2000-01-01` exists; engine path may still show calendar before real dates — **needs dedicated basics gate in dashboard1** |
| **2** | Calendar scroll stability | ❌ | **#1 pain point.** `TripCalendar` passes `highlightDate={rangeStart}`; remount after save may re-trigger first-paint scroll in `LocationStayCalendar` — **audit + fix next** |
| **3** | Interactive calendar commands | 🟡 | `TripCalendar`, `CalendarContextPanel`, `useCalendarInteraction`, `PATCH /setup/commands` — built; needs Phase 2 + manual golden verify |
| **4** | Accommodation golden flow | 🟡 | `addStay` via engine + context panel; run golden trip Patong/Bangkok manually |
| **5** | Transport golden flow | 🟡 | `addTransportLeg` + corridors in render model; verify BKK→MEL / MEL→CHC on reload |
| **6** | Activities become real | 🟡 | `activities-persistence.ts` + `addActivity`; **activity chips on calendar cells not wired**; publish/student path not verified |
| **7** | Readiness from graph | 🟡 | `computeReadiness` + `detectGraphConflicts` on engine response; verify no drift after reload |
| **8** | Groups MVP | 🟡 | Groups commands + overlay projection exist; Group B student view **not verified** |
| **9** | Booking references basic | ❌ | Bookings in graph summary only; no invoice-gap overview |
| **10** | Publish/student projection | ❌ | Publish pipeline exists elsewhere; not verified against engine graph |

---

## Phases 11–20 (after core works)

| Phase | Name | Status |
|-------|------|--------|
| **11** | Smart overview | ❌ |
| **12** | AI command proposal | ❌ |
| **13** | Map projection | ❌ |
| **14** | Student Connect polish | ❌ |
| **15** | Receipts/invoices | ❌ |
| **16** | Xero-ready fields | ❌ |
| **17** | Flight API abstraction | 🟡 (foundation exists; not productized) |
| **18** | PayShare placeholder | ❌ |
| **19** | Public site | ❌ |
| **20** | Clean repo decision | ⏭️ |

---

## Recommended order from **today**

```
Phase 2  → Calendar scroll (stop the snapping)
Phase 1  → Trip basics gate (no fake calendar)
Phase 3  → Verify interactive commands (golden G1 paint)
Phase 4  → Golden accommodation
Phase 5  → Golden transport
Phase 6  → Activities on calendar + publish check
Phase 7  → Readiness drift check
─── stop and demo golden trip ───
Phase 8–10 → Groups, bookings, student
Phase 11+  → Intelligence, AI, map
```

Phase 2 before Phase 1 is intentional: you already have dated trips; scroll pain blocks everything else.

---

## What’s already in the repo (foundation)

| Piece | Location |
|-------|----------|
| TripEntityGraph + commands | `src/lib/trip-engine/` |
| Command API | `src/app/api/trips/[tripId]/setup/commands/route.ts` |
| Calendar render model | `src/lib/trip-engine/calendar-render-model.ts` |
| New setup shell | `src/components/dashboard1/setup/SetupBoardShell.tsx` |
| Interactive calendar | `src/components/dashboard1/setup/calendar/` |
| Legacy fallback | `/dashboard-legacy` |
| Golden trip scenario | Build memory §24 |

---

## Session starter prompts (copy to Cursor)

**Phase 2:**
```
Read @docs/ITINERARY_LIVE_BUILD_MEMORY.md and @docs/PHASE_STATUS.md.
Do Phase 2 only: calendar scroll stability. Audit TripCalendar, LocationStayCalendar,
useCalendarInteraction. No scroll on click/select/save. Add a test or QA note.
```

**Phase 1:**
```
Read @docs/ITINERARY_LIVE_BUILD_MEMORY.md. Do Phase 1 only: new trip shows Trip Basics
first; no 2000-01-01 calendar until real dates saved.
```

**Golden trip verify (Phases 4–6):**
```
Read build memory §24. Manually verify golden trip via dashboard1 command path.
Fix only what blocks acceptance. Do not start Phase 11+.
```

---

## Phase completion checklist (template)

When marking a phase ✅, record:

- [ ] Acceptance criteria from build memory §22 met
- [ ] `npm test` passes
- [ ] Manual browser check done (if UI phase)
- [ ] No new source of truth introduced
- [ ] PHASE_STATUS.md updated

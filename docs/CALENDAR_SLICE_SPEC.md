# Calendar Slice Specification

Last updated: June 2026

This document defines the canonical calendar location model for Trip OS. Stored slices are the **single source of truth** for where a group is on each day.

---

## Core type

```typescript
type CalendarDaySlice = {
  date: string;       // ISO YYYY-MM-DD
  amCity: string;     // morning / checkout half
  pmCity: string;     // evening / check-in half
  dayType: DayType;
};
```

One database row per `(trip_id, group_id, date)` with `am_city` and `pm_city` columns.

---

## Half-day semantics

| UI label | Storage field | Meaning |
|----------|---------------|---------|
| Left / morning | `amCity` | Checkout morning, or first half of travel day |
| Right / evening | `pmCity` | Check-in evening, or second half of travel day |

| Scenario | amCity | pmCity |
|----------|--------|--------|
| Full day in Tokyo | Tokyo | Tokyo |
| Travel Tokyo → Kyoto | Tokyo | Kyoto |
| Hotel check-in Dec 10 | (unchanged) | Hotel city |
| Hotel check-out Dec 14 | Hotel city | (unchanged) |
| Empty day | "" | "" |

A day with only `pmCity` set is an **arrival** half-day. A day with only `amCity` set is a **departure** half-day.

---

## Range paint rules

### Full/full multi-day paint (stay-aligned)

When the user paints a location range with both edges at "full", the engine uses **stay-aligned** halves:

- **Range start date**: paint `pmCity` (evening check-in)
- **Interior dates**: paint both `amCity` and `pmCity`
- **Range end date**: paint `amCity` (morning checkout)

If the day before the range has a different city, the start date becomes a travel split: `amCity = priorCity`, `pmCity = newCity`.

If the day after the range has a different city, the end date becomes a travel split: `amCity = newCity`, `pmCity = nextCity` (or checkout-only `amCity` if no next city).

### Partial edge paint

When `startHalf` or `endHalf` is `am` or `pm`, only that half is painted on the edge date(s). Interior dates (if any) are full days.

Examples:

- Dec 6 PM → Dec 13 full: Dec 6 keeps existing AM, paints PM; Dec 7–12 full; Dec 13 paints AM only
- Dec 12 AM → Dec 13 AM only: paints morning halves on those two dates

---

## Group modes

| Mode | Storage | Projection |
|------|---------|------------|
| **inherit** | No rows for group | Read main group slices |
| **override** | Sparse or full override slices | Per half: `override.amCity ?? main.amCity`, same for PM |

Blank override halves inherit from main. Explicit empty string in override masks that half.

Party lens fans out `paintDayRange` to N group IDs; each group gets direct slice writes.

---

## Invariants

1. **Stored slices are authoritative** — projection never rewrites location storage
2. **Transport never paints calendar** — legs attach to slice transitions; pending needs read slices only
3. **Load is pure** — no silent repair or inference on load
4. **One persist path** — `PATCH /api/trips/[tripId]/setup/commands` only
5. **Commands carry scope** — every calendar command includes `groupId`

---

## Accommodation integration

`addStay` / `updateStay` write slices explicitly:

- Check-in date: set `pmCity` to stay city
- Check-out date: set `amCity` to stay city

Accommodation bands on the calendar UI are a separate read-only layer.

---

## Legacy adapter

During transition, `DayPlaceDraft` (primaryCity / secondaryCity / primaryShare) converts at the UI boundary:

- `amCity` ↔ `primaryCity` (left half)
- `pmCity` ↔ `secondaryCity` (right half)
- `primaryShare < 1` indicates split day

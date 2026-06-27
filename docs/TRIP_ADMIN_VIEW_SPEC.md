# Trip Admin View Specification

Last updated: June 2026

## Purpose

Senior setup sections (Transport, Accommodation, Activities) always show the **full trip** — whole-group data plus every personal/subgroup scope that has entities or calendar diffs. The calendar person lens controls **who you are editing locations for**, not what admin sections list.

## Two axes (never conflated)

| Axis | Role |
|------|------|
| `TripAdminProjection` | Full trip lists for sections — **no lens input** |
| `CalendarEditContext` | `{ lens, editGroupId, partyGroupIds? }` — calendar paint, default Add `groupId`, UI highlight |

## Rules

1. **Calendar lens = location edit target only** — not a filter for Transport / Accommodation / Activities.
2. **Senior sections always show the full trip** — whole-group block + every personal/subgroup scope with `differsFromMain || hasEntities`.
3. **One calendar read path** — `projectCalendar(graph, { groupId })` for calendar column, pending transport, and Locations.
4. **Personal forks are deltas** — e.g. Kaleb Tottori adds a personal scope; main Christchurch→Tokyo legs stay visible.
5. **Party lens** — calendar fans paint to N groups; sections show N personal scopes (not first alphabetically only).

## Pending transport

For each scope:

1. `projectCalendar(graph, { groupId })`
2. `pendingTransportNeedsFromCalendar(graph, groupId)`

No overlay-specific day-place shortcuts that bypass projection.

## Edit affordances

- Whole-group rows are always visible.
- Add / Edit / Hide use `isScopeEditable(scopeId, editContext)`:
  - Main group scope: always editable.
  - Personal/subgroup scope: editable when `scopeId === editGroupId`, or when party lens includes that scope in `partyGroupIds`.
- Non-editable scopes show hint: `Edit on {name}'s calendar`.

## Acceptance scenarios

| Scenario | Expected |
|----------|----------|
| Switch Kaleb ↔ Everyone | Transport / Accommodation / Activities row coverage **unchanged**; only calendar column + highlights change |
| Kaleb Tottori paint (Dec 6 PM – Dec 13) | Personal pending Tokyo→Tottori under Kaleb scope; `wholeGroup.legs` unchanged |
| Party of 4 with 4 overrides | 4 `personalScopes` entries in projection |
| Whole group main corridor | Main pending city changes present on `wholeGroup.pendingTransport` |

## Module layout

```
src/lib/trip-admin/
  types.ts
  build-admin-projection.ts
  pending-needs-by-scope.ts
  edit-affordances.ts
  fixtures/japan-kaleb.ts
```

## What we will not do

- Lens-filter hacks (pass `mainGroupId` to accommodation while calendar shows Kaleb).
- Hide whole-group transport on person lens.
- Duplicate full itineraries per personal group in DB.

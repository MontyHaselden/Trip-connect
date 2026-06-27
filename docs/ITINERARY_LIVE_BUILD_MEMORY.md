# Itinerary Live — Build Memory / North Star

Last updated: June 2026

This file is the permanent build memory for Itinerary Live.

Before starting any new phase, read this file first.
Do not guess the product direction from the current messy implementation.
The current repo is a discovery/prototype repo. The goal is to prove the right architecture and flows, not preserve every existing file.

---

# 1. What we are building

Itinerary Live is not just an itinerary viewer.

It is a **trip operating system for school groups, organisations, and later personal group trips**.

The product has one core idea:

> One structured trip graph is the source of truth.
> Calendar, student app, map, overview, bookings, and AI are all projections or editors of that same graph.

The host should be able to plan, check, correct, and publish a trip from one system.

Students and parents should only see the clean version that applies to them.

---

# 2. One-sentence product definition

Itinerary Live is a trip operating system where AI/import and manual corrections update one TripEntityGraph, which automatically projects into an interactive calendar, student app, map view, bookings/finance layer, and smart overview/checker.

---

# 3. The most important rule

## One graph. Many surfaces.

There must be one core source of truth:

```text
TripEntityGraph
```

Everything else is a view, projection, or editor of that graph:

```text
TripEntityGraph
→ CalendarRenderModel
→ Student timeline
→ Map projection
→ Smart overview/readiness
→ Bookings/finance view
→ Publish snapshot
```

Do not create separate sources of truth.

Avoid:

* wizard state being separate from setup state
* calendar state being separate from trip data
* AI import writing to a different structure
* student app reading stale/legacy data
* activities existing only in client state
* bookings disconnected from trip entities
* sessionStorage masking DB truth

---

# 4. Writes must use typed commands

All meaningful writes should go through typed commands.

```text
TripCommand[]
→ validate
→ persist
→ reload/update graph
→ project calendar
→ compute readiness/conflicts
→ update UI
```

The manual UI and AI must use the same command system.

AI must never write directly to the database.

Manual UI must never fake important trip state in local React state only.

Examples of commands:

```text
SetTripBasics
PaintDayRange
AddStay
UpdateStay
RemoveStay
AddTransportLeg
UpdateTransportLeg
RemoveTransportLeg
AddActivity
UpdateActivity
RemoveActivity
CreateGroup
UpdateGroup
DeleteGroup
AddGroupDayOverride
RemoveGroupDayOverride
UpdateBookingDetails
SetBookingStatus
SetEmergencyInfo
SetViewerSettings
```

The command itself must define the target scope.

Do not use hidden `activeGroupId` save behaviour where the same PATCH request secretly saves different tables depending on UI state.

---

# 5. Manual UI exists because AI needs reliable commands

Final product workflow:

```text
Upload itinerary / paste notes / chat with AI
→ AI proposes TripCommand[]
→ host confirms ambiguities
→ graph updates
→ calendar/student/map/overview update
```

But engineering rule:

```text
Manual command flows must work first.
```

AI can only be good if the manual command path is reliable.

Manual UI is not the main long-term workflow. It is the correction layer and fallback.

The host should be able to:

* fix wrong dates
* drag a stay boundary
* correct a city
* add missing flight details
* delete duplicate activities
* assign group-specific changes
* resolve conflicts
* add booking references

---

# 6. Senior layers vs activities

Accommodation, transport, and location are not activities.

They are senior trip layers.

## Senior layers

```text
Location
Accommodation
Transport
Groups
Bookings
Emergency
```

These form the skeleton of the trip.

## Activities

Activities are things people do on the top of the skeleton.

Examples:

* Disneyland
* school visit
* museum
* dinner
* walking tour
* free time
* meeting

Do not model flights, hotels, and city spans as normal activities unless it is purely for display compatibility.

Preferred model:

```text
Locations = where the group is
Accommodation = where they sleep
Transport = how they move
Activities = what they do
Bookings = admin/finance attached to any of the above
```

---

# 7. Calendar role

The calendar is the host hero surface.

But there is a nuance:

```text
The graph is the data truth.
The calendar is the main interactive visual editor/projection of that truth.
```

**Calendar slice model (June 2026):** Location paint is stored as explicit `am_city` / `pm_city` halves per group per day in `group_day_places`. All mutations go through `src/lib/calendar-core/` (`paintRange`, `mergeOverrides`, `clearRange`). See [`CALENDAR_SLICE_SPEC.md`](./CALENDAR_SLICE_SPEC.md). Projection reads stored slices only — no display-time repair or overlay delta merge.

The calendar must not be passive.

The host should be able to:

* click a day
* select a range
* add/fix location
* add/fix stay
* add/fix transport
* add/fix activity
* click transport corridors
* drag stay boundaries where appropriate
* open a contextual inspector
* see warnings/conflicts directly on relevant days

All those actions should dispatch typed commands.

---

# 8. Calendar scroll rule

Hard rule:

> The calendar must never snap, jump, or hijack scroll when the user clicks, selects, saves, or opens context.

Allowed:

* user scrolls manually with mouse/trackpad/touch
* user explicitly clicks a future "go to date" button, if built

Not allowed:

* scroll on day click
* scroll on range selection
* scroll on save
* scroll on command dispatch
* scroll on context panel open
* `scrollIntoView` tied to selection
* `scrollAnchorDate` changing because selection changed
* re-render resetting scroll position

If the user scrolls to September, selects a day, and saves an activity, the calendar must stay exactly where it is.

---

# 9. New trip rule

Never show a fake 2000-01-01 trip calendar.

If a trip does not have real dates, show Trip Basics first.

Required basics:

* trip name
* start date
* end date
* timezone
* optional departure city
* optional return city
* optional destination country

Only after real dates are saved should the calendar appear.

Acceptance:

```text
New trip
→ Trip Basics screen
→ user enters 23 Aug 2026 to 5 Sep 2026
→ interactive calendar appears for that range
```

---

# 10. Groups model

Use the word **Groups**, not Routes, in the UI.

Every trip has one Main Group.

```text
Main Group = base trip layer
Extra groups = overlays / group-specific differences
```

Example:

```text
Main Group:
Week 1 Tokyo
Week 2 Kagoshima
Week 3 Tokyo

Group B:
Week 1 Tokyo inherited
Week 2 Kagoshima inherited
Week 3 Oita override
```

A group should inherit the Main Group unless it has its own override/addition.

Students in Group B should only see the resolved Group B itinerary.

Do not show students:

* all hotels
* all homestays
* other group routes
* hidden admin notes
* booking invoices
* irrelevant emergency info

MVP groups:

* Main Group exists
* create extra group
* group-specific accommodation/transport/activity can exist
* group projection resolves correctly
* student view respects group

Later groups:

* explicit hide/replace UI
* propagation modal
* apply changes across selected groups
* participant-level overrides

---

# 11. Student app role

The student app is a clean projection of the graph.

Students see:

* today
* tomorrow
* itinerary
* transport relevant to them
* accommodation relevant to them
* activities relevant to them
* emergency info relevant to them
* group-specific details
* offline-ready cached version

Students do not see:

* admin booking references
* invoices
* receipts
* internal notes
* all possible group branches
* unresolved setup warnings
* unrelated accommodation
* all homestay options

Student output must be generated from the same graph/publish pipeline as the host calendar.

---

# 12. Map view role

Map view is a later projection of the same graph.

Map should eventually show:

* hotels
* activities
* airports
* transport corridors
* city movement
* group-specific paths
* distance/logistics prompts

Do not build map before the graph/calendar/manual command path works.

---

# 13. Bookings and finance layer

Bookings are attached to trip entities.

Possible linked entities:

* accommodation stay
* transport leg
* activity
* supplier
* group-level expense

Booking fields:

* booking status
* supplier
* booking reference
* invoice received
* receipt attached
* payment status
* amount
* currency
* internal notes
* future Xero fields

The smart overview should eventually surface:

```text
Kyoto hotel booked but no invoice on file.
Flight not booked.
Activity booked but payment unknown.
Receipt uploaded but not reviewed.
```

Do not build Xero yet.

Build booking/reference basics first.

---

# 14. Xero future

Xero is a future Pro/Pro+ feature.

Do not integrate Xero now.

But when adding booking/finance models, avoid blocking future fields:

```text
xero_contact_id
xero_bill_id
xero_invoice_id
xero_attachment_id
xero_sync_status
xero_last_synced_at
xero_error
```

Xero later should connect trip invoices, receipts, and bills to the school/business Xero account.

---

# 15. PayShare future

PayShare is a future optional payment rail.

Do not integrate PayShare now.

Long-term:

* personal group trips may split booking payments via PayShare
* suppliers could become PayShare-ready
* hotels/activities could be suggested later

For now, only leave conceptual space:

```text
payment_method: manual | invoice | payshare | external
payshare_session_id nullable
```

No real PayShare integration in current phases.

---

# 16. Flight lookup future

Manual flights must work first.

Do not depend on flight API lookup.

Flight lookup later should use provider abstraction:

```text
lookupFlightByNumber(flightNumber, date)
```

Rules:

* flight number + date required
* manual fallback always works
* cache API responses
* provider can be swapped
* no expensive provider dependency before paying customers

Possible providers later:

* AeroDataBox
* Aviation Edge
* other provider if affordable

Flight API is an enhancement, not the foundation.

---

# 17. Smart overview role

The overview should think.

It should surface:

* missing locations
* missing accommodation
* missing transport between cities
* impossible timing
* activity with no location
* stay overlaps
* booking status issues
* invoice missing
* receipt missing
* group-specific gaps
* unpublished changes
* emergency info missing

Overview should be based on deterministic graph rules first.

Do not use AI for core readiness logic at first.

---

# 18. Readiness statuses

Use these statuses:

```text
complete
mostly_complete
warning
question
conflict
```

UI mapping:

* complete = green tick
* mostly_complete = orange tick
* warning = orange warning
* question = orange question
* conflict = red conflict

Flexible booking status is not red by default.

Flexible means:

* decided enough to continue
* not fully locked
* should still be surfaced

Example:

* "Train or domestic flight TBD" = flexible / orange
* "No accommodation at all" = warning/conflict

---

# 19. AI ingestion path

AI/import is the final main workflow.

AI should:

1. parse PDFs/docs/emails/chat
2. propose structured TripCommand[]
3. ask clarifying questions for ambiguity
4. let host approve
5. dispatch through same command API
6. update graph/projections

Example:

```text
Host: Disney on the 17th

AI: Do you mean Disneyland Tokyo?
Host: Yes

AI proposes:
- AddActivity
- maybe PaintDayRange
- maybe AddTransportLeg suggestion
```

AI must not write directly to DB.

AI must not create a separate state model.

---

# 20. What not to build yet

Do not build these before the core engine/calendar is reliable:

* full Xero integration
* PayShare integration
* marketplace
* advanced map routing
* perfect visual polish
* full AI import pipeline
* public marketing site polish
* advanced student photo galleries
* complex group propagation UI
* flight API monitoring
* native app

---

# 21. Current repo stance

This repo is a discovery/prototype repo.

It is okay to delete/rebuild setup board internals.

Keep useful backend pieces where possible:

* auth
* DB connection
* existing schema where useful
* publish pipeline
* student filtering
* group resolver
* visibility system
* geo/flight lookup foundation
* tests/domain logic

Replace broken setup board patterns:

* monolithic local state as trip truth
* sessionStorage as source masking
* fake activities
* passive calendar
* wizard shadow item confusion
* old locations page embedded into setup
* activeGroupId save scope magic
* calendar scroll hijacking

---

# 22. Build phases

## Phase 1 — Trip Basics

Fix new trip start state.

No fake 2000 calendar.

Build:

* trip name
* start date
* end date
* timezone
* departure/return city optional
* destination country optional

Acceptance:

* new trip starts with basics form
* real dates create interactive calendar

## Phase 2 — Calendar scroll stability

Calendar never jumps unless user scrolls.

Audit:

* TripCalendar
* LocationStayCalendar
* useCalendarInteraction
* scrollIntoView
* scrollAnchorDate
* selection side effects

Acceptance:

* clicking/selecting/saving does not move calendar viewport

## Phase 3 — Interactive calendar commands

Calendar supports:

* click day
* select range
* open context panel
* dispatch commands

Commands:

* PaintDayRange
* AddStay
* AddTransportLeg
* AddActivity

Acceptance:

* selecting a range and painting a location persists and reloads

## Phase 4 — Accommodation golden flow

Accommodation works from manual entry and calendar context.

Acceptance:

* add Patong hotel 23–31 Aug
* add Bangkok hotel 31 Aug–4 Sep
* calendar updates
* reload keeps it
* readiness updates

## Phase 5 — Transport/flight golden flow

Manual transport works without API.

Acceptance:

* add BKK → MEL flight on 4 Sep
* add MEL → CHC flight on 5 Sep
* calendar shows corridors
* reload keeps data

## Phase 6 — Activities become real

Activities persist.

Acceptance:

* add TeamLab visit 26 Aug 10–12
* appears on calendar
* reload keeps it
* publish/student view includes it

## Phase 7 — Readiness from graph

Statuses and overview use same graph as calendar.

Acceptance:

* adding/removing entities updates statuses
* no UI/DB drift

## Phase 8 — Groups MVP

Main Group + extra group basics.

Acceptance:

* create Group B
* add Group B-specific stay/activity/transport
* Main Group unaffected
* Group B student sees Group B data

## Phase 9 — Booking references basic

Bookings linked to stays/transport/activities.

Acceptance:

* mark hotel booked with no invoice
* overview shows invoice gap

## Phase 10 — Publish/student projection

Student app reads correct graph projection.

Acceptance:

* publish trip
* student sees accommodation/transport/activity relevant to them
* admin-only booking details hidden

## Phase 11 — Smart overview

Add logistics prompts.

Acceptance:

* missing intercity transport prompt
* impossible timing prompt
* invoice gap prompt

## Phase 12 — AI command proposal

AI/import proposes TripCommand[].

Acceptance:

* paste "Disney on the 17th"
* confirm venue
* command creates activity
* calendar updates

## Phase 13 — Map projection

Basic map from graph.

Acceptance:

* hotel and activity show pins

## Phase 14 — Student Connect polish

Polish student app as clean personalised projection.

## Phase 15 — Receipts/invoices

File uploads for finance layer.

## Phase 16 — Xero-ready fields

Prepare fields only. No OAuth.

## Phase 17 — Flight API abstraction

Provider abstraction + cache. Manual fallback remains.

## Phase 18 — PayShare placeholder

Future field only. No integration.

## Phase 19 — Public site / updates

Only after core product works.

## Phase 20 — Clean repo decision

Once prototype proves the correct system, decide whether to rebuild fresh.

---

# 23. Cursor behaviour rules

When working on a phase:

1. Read this file first.
2. Build only the requested phase.
3. Do not build future phases early.
4. Do not polish unrelated UI.
5. Do not introduce another source of truth.
6. Do not create separate AI/write paths.
7. Do not make the calendar passive.
8. Do not reintroduce scroll jumping.
9. Do not hide failures in sessionStorage.
10. Add acceptance tests or manual verification notes.

If uncertain, prefer:

* typed commands
* server-authoritative graph
* deterministic projection
* explicit warnings
* manual fallback
* no silent overwrites

---

# 24. Golden test trip

Use this as the manual test scenario:

Trip:

* 23 Aug 2026 to 5 Sep 2026
* timezone: Asia/Bangkok or Pacific/Auckland depending scenario
* Main Group

Accommodation:

* Royal Paradise Hotel, Patong, 23 Aug–31 Aug
* Centre Point Plus Hotel, Bangkok, 31 Aug–4 Sep

Transport:

* BKK → MEL flight, 4 Sep
* MEL → CHC flight, 5 Sep

Activity:

* TeamLab visit, 26 Aug, 10:00–12:00

Expected:

* calendar shows Patong span
* calendar shows Bangkok span
* calendar shows flight corridors
* calendar shows TeamLab activity
* overview warnings make sense
* reload keeps all data
* publish sends correct student data

---

# 25. Final reminder

The product is not "forms plus a calendar."

The product is:

```text
AI/import + interactive calendar corrections
→ typed commands
→ TripEntityGraph
→ calendar, student app, map, overview, bookings
```

Build every phase with that future in mind.

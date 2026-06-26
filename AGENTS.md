<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

## Trip OS calendar

**Calendar never renders transport.** Trip calendar cells show locations, accommodation, and activities only. Transport legs, airport codes, transit bands, and overlay chips belong in the Transport section (and student itinerary views) — not on `TripOsDayCell` or `CalendarRenderModel`. Do not reintroduce `travelLayoutsByDate`, `transitByDate`, `TransportBand`, or `TransitOverlay` on the calendar.


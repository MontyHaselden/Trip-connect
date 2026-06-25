export const HERO = {
  eyebrow: "Live trip operations for schools",
  headline: "One school trip itinerary. Always up to date.",
  subheadline:
    "Itinerary Live helps schools build live trip itineraries for students, staff, and parents — with accommodation, transport, activities, groups, emergency info, and finance exports in one organised dashboard.",
  trialLine: "Start with a 7-day free trial. No payment required.",
  noGpsLine:
    "No live GPS tracking. Just clear trip information, shared with the right people.",
} as const;

export const PROBLEMS = [
  "Printed PDFs and booklets go out of date as soon as plans change",
  "Parents and students ask the same schedule questions by email and group chat",
  "Rooming lists and activity group splits are hard to keep aligned",
  "Transport and accommodation changes are messy to communicate",
  "Finance is tracked separately from the itinerary",
] as const;

export const PRODUCT_CAPABILITIES = [
  "Build the trip itinerary day by day",
  "Add accommodation, transport, and activities",
  "Create groups and subgroups",
  "Invite students, staff, and helpers",
  "Publish live updates to everyone on the trip",
  "Track costs and export finance summaries",
] as const;

export const STUDENT_VIEW_POINTS = [
  "Students get a simple mobile view — no app store download required",
  "Parents and helpers can view relevant trip information when enabled",
  "No live GPS tracking — just the latest schedule and emergency details",
  "The itinerary stays available offline once saved to the phone",
] as const;

export const STAFF_OPS_POINTS = [
  "One dashboard for trip setup, participants, and publishing",
  "Manage groups, rooming, and split itineraries",
  "Map and location context for each day",
  "Finance tracking tied to itinerary items",
  "Export-ready summaries for school admin and accounts",
] as const;

export const FINANCE_POINTS = [
  "Costs are generated from the itinerary, then organised into funding, payments, balances, and export-ready summaries",
  "Per-person cost allocation from accommodation, transport, and activities",
  "CSV and printable exports for school finance teams",
  "Xero-ready export files — no automatic accounting sync yet",
] as const;

export const BUILT_FOR_SCHOOLS = [
  "Built for school trips, overseas tours, exchanges, camps, and group travel",
  "Role-based access — students only see what they need",
  "No per-student subscription fees",
  "Teacher-controlled publishing",
  "Completed trips archive to trip history",
] as const;

export const FEATURES = [
  {
    title: "Live trip itinerary",
    description:
      "Build days with accommodation, transport, activities, and notes. Publish updates so staff, students, and parents work from the same schedule.",
  },
  {
    title: "Groups and rooming",
    description:
      "Assign students to rooms, buses, activity groups, or temporary split plans. Participants only see the parts relevant to them.",
  },
  {
    title: "Student mobile view",
    description:
      "Students open an invite link and save the trip to their phone. A compact daily run sheet — clear times, locations, and what to bring.",
  },
  {
    title: "Emergency card and phrases",
    description:
      "Emergency contacts, hotel details, and useful local phrases — accessible offline once the trip is saved.",
  },
  {
    title: "Parent and viewer access",
    description:
      "Read-only access for parents, principals, or staff back home — without exposing private student contact details.",
  },
  {
    title: "Trip finance and exports",
    description:
      "Spreadsheet-style cost splits by accommodation, transport, and activities — plus CSV exports for school finance teams.",
  },
  {
    title: "Smart setup wizard",
    description:
      "Add trip dates, transport, accommodation, cities, and structure through a guided school-trip setup flow — no AI required.",
  },
  {
    title: "Offline-ready access",
    description:
      "Once students open and save the trip, key information remains available without WiFi or mobile data overseas.",
  },
  {
    title: "Pre-trip meetings",
    description:
      "Add preparation meetings before departure so students and parents see dates, locations, and countdown to the trip.",
  },
  {
    title: "Daily weather",
    description:
      "Weather context for each day helps staff and students plan clothing and outdoor activities.",
  },
] as const;

export const HOW_IT_WORKS = [
  "Create a school account — 7-day free trial, no card required.",
  "Create your trip and enter dates, destination, and school details.",
  "Add transport, accommodation, activities, groups, and emergency info.",
  "Invite students and staff with secure links.",
  "Publish updates as plans change — everyone sees the latest version.",
] as const;

/** @deprecated Public pricing uses LaunchSchoolPricing — kept for legacy references */
export const SCHOOL_PRICING = [] as const;

/** @deprecated Personal plans hidden from school launch */
export const PERSONAL_PRICING = [] as const;

export const FAQS = [
  {
    q: "How does the free trial work?",
    a: "Create a school account and you get 7 days to build a trip, invite test participants, and preview the student view. No card is required. After the trial, we invoice manually — payment is not taken automatically.",
  },
  {
    q: "Do students need to download an app?",
    a: "No. Students join with a link and can save Itinerary Live to their phone like an app.",
  },
  {
    q: "Does Itinerary Live track student locations?",
    a: "No. Itinerary Live does not include GPS tracking or live student location monitoring.",
  },
  {
    q: "Does it work without mobile data?",
    a: "Yes. Once students open and save the trip, key trip information can be accessed offline.",
  },
  {
    q: "Do students and parents count as paid accounts?",
    a: "No. Staff account limits apply to school staff who manage trips. Students, parents, and viewers do not count as paid staff accounts.",
  },
  {
    q: "What happens after the trial?",
    a: "We contact you to confirm your school plan ($400 NZD + GST per year, or founding school pricing if approved). Invoicing is manual for now — there is no automatic card charge.",
  },
  {
    q: "Can parents see the itinerary?",
    a: "Yes. Schools can enable read-only viewer access for parents, principals, or staff back home.",
  },
  {
    q: "Can we use Itinerary Live without AI?",
    a: "Yes. The setup wizard works without AI. AI tools are optional helpers for drafting itineraries.",
  },
] as const;

export const PRICING_NOTES = [
  "School plan is $400 NZD + GST per year. Founding schools (limited places) pay $240 NZD + GST for year one.",
  "No card required to start. Build your first trip during the 7-day trial before any invoice.",
] as const;

/** @deprecated Use PROBLEMS */
export const PROBLEMS_LEGACY = PROBLEMS;
/** @deprecated Use PRODUCT_CAPABILITIES */
export const SOLUTIONS = PRODUCT_CAPABILITIES;

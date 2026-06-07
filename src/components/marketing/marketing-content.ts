export const HERO = {
  eyebrow: "School trip itineraries, rebuilt for phones.",
  headline: "School trip itineraries, rebuilt for phones.",
  altHeadline: "The live school trip booklet students can actually use.",
  subheadline:
    "Trip Connect gives teachers, students, helpers, parents, and school staff one clear place for the itinerary, emergency info, rooms, groups, weather, trip photos, and updates — even when students have no mobile data.",
  positioning:
    "Trip Connect is a school trip management platform that replaces paper booklets, messy email threads, scattered WhatsApp updates, and outdated itineraries with one simple live/offline trip hub.",
} as const;

export const PROBLEMS = [
  "Printed itineraries becoming outdated",
  "Students losing paper booklets",
  "Parents asking where the group is up to",
  "Rooming and group lists changing",
  "Students having no mobile data overseas",
  "Emergency info being buried in emails",
  "Trip photos scattered across everyone's phones",
  "Teachers needing to update everyone quickly",
] as const;

export const SOLUTIONS = [
  "Live itinerary",
  "Offline student access",
  "Smart trip setup wizard",
  "Optional AI itinerary builder",
  "Pre-trip meeting dates",
  "Countdown to departure",
  "Daily weather",
  "Rooms and groups",
  "Emergency card and phrases",
  "Parent/principal viewer access",
  "Daily photo galleries",
  "Teacher-controlled publishing",
  "Trip history archive",
] as const;

export const BUILT_FOR_SCHOOLS = [
  "No location tracking",
  "Role-based access",
  "Students only see what they need",
  "Parents/viewers have read-only access",
  "Staff accounts are limited by plan",
  "Students and parents do not count as staff accounts",
  "Completed trips move to history",
  "Active trip limits stop unused test trips creating unnecessary costs",
  "Ideal for overseas trips, exchanges, camps, sports tours, outdoor education, music trips, and field trips",
] as const;

export const FEATURES = [
  {
    title: "Offline-ready student itinerary",
    description:
      "Students open the invite link once, save the trip to their phone, and can still view the itinerary, emergency card, phrases, rooms, groups, and key contacts without WiFi or mobile data.",
  },
  {
    title: "Smart setup wizard",
    description:
      "Build the trip step by step without needing AI. Add trip dates, transport, accommodation, cities, pre-trip meetings, rooms, groups, and activities through a guided school-trip setup flow.",
  },
  {
    title: "AI itinerary builder",
    description:
      "Available on higher plans. Paste messy trip notes, documents, or changes and let AI help structure the itinerary, detect clashes, suggest categories, and generate emergency phrases.",
  },
  {
    title: "Compact daily schedule",
    description:
      "Each day appears as a simple run sheet, not a pile of boxes. Students can quickly see what is happening, when to leave, and what to bring.",
  },
  {
    title: "Rooms, groups, and split plans",
    description:
      "Assign students to rooms, buses, homestays, activity groups, or temporary split itineraries. Students only see the parts relevant to them.",
  },
  {
    title: "Parent and school viewer access",
    description:
      "Parents, principals, and school staff back home can view the itinerary and approved trip photos without accessing private student phone numbers.",
  },
  {
    title: "Daily photo gallery",
    description:
      "At the end of each day, students can upload photos from the trip. Hosts and approved helpers can remove photos before or after they appear.",
  },
  {
    title: "Emergency card and local phrases",
    description:
      "Students can access an offline emergency card with teacher contacts, hotel address, school details, and useful local-language phrases.",
  },
  {
    title: "Daily weather",
    description:
      "Each day can show local weather for the city or town the group is in, helping students prepare with jackets, umbrellas, water, or warmer clothes.",
  },
  {
    title: "Pre-trip meetings",
    description:
      "Add preparation meetings before the trip begins, so students and parents can see meeting dates, locations, notes, and the countdown to departure.",
  },
] as const;

export const HOW_IT_WORKS = [
  "Create a school account.",
  "Create a trip and enter the dates, destination, and school details.",
  "Use the smart setup wizard to add transport, accommodation, locations, and key trip structure.",
  "Add activities, pre-trip meetings, rooms, groups, and emergency info.",
  "Publish the trip.",
  "Students join by invite link and save it to their phone.",
  "Parents/viewers get read-only access if enabled.",
  "Completed trips move to history and free up an active trip slot.",
] as const;

export const SCHOOL_PRICING = [
  {
    id: "school_starter" as const,
    name: "School Starter",
    price: "$150",
    period: "/year",
    bestFor: "Small schools, one department, or a few trips per year",
    badge: null,
    includes: [
      "3 staff accounts",
      "Up to 4 active trips",
      "Smart setup wizard",
      "Offline student itinerary",
      "Student invite links",
      "Parent/viewer links",
      "Rooms and groups",
      "Emergency card and phrases",
      "Pre-trip meetings",
      "Daily weather",
      "Basic photo gallery",
      "Trip history",
      "No full AI builder",
    ],
    cta: "Start School Starter",
  },
  {
    id: "school_pro" as const,
    name: "School Pro",
    price: "$250",
    period: "/year",
    bestFor: "Most schools and international departments",
    badge: "Most popular",
    includes: [
      "6 staff accounts",
      "Up to 8 active trips",
      "Everything in School Starter",
      "AI itinerary builder",
      "AI phrase generator",
      "AI conflict checks",
      "Larger photo galleries",
      "Helper permissions",
      "Parent/principal viewer access",
      "Export/print backup",
      "Priority early support",
    ],
    cta: "Start School Pro",
  },
  {
    id: "school_pro_plus" as const,
    name: "School Pro+",
    price: "$400",
    period: "/year",
    bestFor: "Larger schools, multiple departments, and frequent trips",
    badge: null,
    includes: [
      "12 staff accounts",
      "Up to 20 active trips",
      "Everything in School Pro",
      "Higher AI usage allowance",
      "Larger photo storage allowance",
      "Custom school branding",
      "Multiple department support",
      "Priority support",
      "Extended trip history",
    ],
    cta: "Start School Pro+",
  },
] as const;

export const PERSONAL_PRICING = [
  {
    id: "personal_one_time" as const,
    name: "Personal One-Time Trip",
    price: "$18",
    period: " once",
    badge: "Pay with PayShare",
    validity: "Valid for 6 months",
    includes: [
      "One trip",
      "Valid for 6 months",
      "Up to 6 people",
      "Itinerary builder",
      "Weather",
      "Emergency phrases",
      "Basic photo gallery",
      "Viewer link",
      "No school tools",
      "No student accounts",
      "No AI builder",
    ],
    cta: "Create one-time trip",
  },
  {
    id: "personal" as const,
    name: "Personal",
    price: "$40",
    period: "/year",
    badge: null,
    validity: null,
    includes: [
      "1 account",
      "Up to 2 active trips",
      "Groups up to 6 people",
      "Standard itinerary tools",
      "Weather",
      "Emergency phrases",
      "Basic photo gallery",
      "No AI builder",
      "No school-specific tools",
    ],
    cta: "Start Personal",
  },
  {
    id: "personal_pro" as const,
    name: "Personal Pro",
    price: "$80",
    period: "/year",
    badge: null,
    validity: null,
    includes: [
      "1 account",
      "Up to 5 active trips",
      "Groups up to 15 people",
      "AI builder",
      "Photo gallery",
      "Viewer link",
      "Rooms/groups",
      "Export/print backup",
      "No school-specific tools",
    ],
    cta: "Start Personal Pro",
  },
] as const;

export const FAQS = [
  {
    q: "Do students need to download an app?",
    a: "No. Students join with a link and can save Trip Connect to their phone like an app.",
  },
  {
    q: "Does Trip Connect track student locations?",
    a: "No. Trip Connect does not include GPS tracking or live student location monitoring.",
  },
  {
    q: "Does it work without mobile data?",
    a: "Yes. Once students open and save the trip, key trip information can be accessed offline.",
  },
  {
    q: "Do students and parents count as paid accounts?",
    a: "No. Staff account limits apply to school staff/admin users who manage trips. Students, parents, and viewers do not count as paid staff accounts.",
  },
  {
    q: "What is an active trip?",
    a: "A trip is active while it is being planned, live, or open for updates/photo uploads. Completed trips move to Trip History and free up an active trip slot.",
  },
  {
    q: "Can parents see the itinerary?",
    a: "Yes. Schools can enable read-only viewer access for parents, principals, or staff back home.",
  },
  {
    q: "Can schools control photos?",
    a: "Yes. Hosts and approved helpers can hide or delete photos from the gallery.",
  },
  {
    q: "Can we use Trip Connect without AI?",
    a: "Yes. The setup wizard works without AI. AI tools are available on higher plans to speed up itinerary creation and editing.",
  },
  {
    q: "Is there a personal version?",
    a: "Yes. Personal plans are available for family and group travel, including a one-time trip option.",
  },
  {
    q: "Can a personal trip be paid with PayShare?",
    a: "Yes. The one-time personal trip package can support PayShare so the group can split the cost.",
  },
] as const;

export const PRICING_NOTES = [
  "An active trip is a trip currently being planned, live, or open for updates/photo uploads. Once a trip is completed, it moves to Trip History and no longer counts toward your active trip limit.",
  "Early school pricing shown. Pricing may change as Trip Connect grows.",
] as const;

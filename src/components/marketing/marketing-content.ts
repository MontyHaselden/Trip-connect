export const FEATURES = [
  {
    title: "Offline-ready student itinerary",
    description:
      "Students open the invite once, save the trip to their phone, and can still view the itinerary, emergency card, phrases, hotel info, and My Trip details without WiFi or mobile data.",
  },
  {
    title: "AI itinerary builder",
    description:
      "Hosts can paste messy school documents, flight notes, hotel details, room lists, and activity plans. Trip Connect's AI turns it into a clean day-by-day itinerary.",
  },
  {
    title: "AI-only itinerary editing",
    description:
      'Instead of filling out endless forms, hosts can chat with AI: "On Tuesday everyone goes to sumo, but Jack and Noah are going to samurai." The AI checks overlaps and exceptions before applying changes.',
  },
  {
    title: "Compact one-screen day view",
    description:
      "Each day is shown like a clean run sheet, not a pile of boxes. Students can quickly scan what is happening, when to leave, and what to bring.",
  },
  {
    title: "Weather by day",
    description:
      "Each trip day shows local weather for that city, helping students know when to bring jackets, umbrellas, water, or warmer clothes.",
  },
  {
    title: "Pre-trip meetings",
    description:
      'Add school meetings before the trip starts. Students can see "Class B lunch meeting — 22 May" and a live countdown to departure.',
  },
  {
    title: "Rooms and groups",
    description:
      "Hosts can assign students to rooms, buses, activity groups, host families, or temporary split itineraries. Students only see what is relevant to them.",
  },
  {
    title: "Parent and school viewer access",
    description:
      "Parents, principals, and staff back at school can view the itinerary and approved daily photo galleries without seeing private student phone numbers.",
  },
  {
    title: "Daily photo gallery",
    description:
      "At the end of each day, students upload two photos: one of themselves and one from somewhere they visited. Hosts and approved helpers can remove photos.",
  },
  {
    title: "Emergency card and phrases",
    description:
      "Students can open an offline emergency card with teacher contacts, hotel address, school info, and useful local-language phrases.",
  },
] as const;

export const PROBLEMS = [
  "Paper booklets go out of date",
  "Students lose printed itineraries",
  "Teachers make changes but not everyone sees them",
  "Parents ask for updates",
  "Students have no data overseas",
  "Emergency info is buried in emails",
  "Rooming and group lists become confusing",
  "Photos are scattered across phones",
] as const;

export const SOLUTIONS = [
  "Live itinerary",
  "Offline student access",
  "AI-built schedule",
  "Pre-trip meeting dates",
  "Countdown to departure",
  "Daily weather",
  "Emergency phrases",
  "Rooms and groups",
  "Contacts",
  "Parent/principal viewer access",
  "Daily photo gallery",
  "Host-controlled updates",
] as const;

export const HOW_IT_WORKS = [
  "Create a host account.",
  "Create a trip.",
  "Paste your rough itinerary into the AI chat.",
  "Trip Connect builds the schedule, rooms, groups, meetings, weather locations, and emergency content.",
  "Host reviews and publishes.",
  "Students join by invite link and save the trip to their phone.",
  "Parents/viewers get read-only access if enabled.",
] as const;

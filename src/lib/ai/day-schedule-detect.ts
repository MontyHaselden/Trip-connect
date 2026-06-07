/** Natural-language day schedules with multiple timed activities. */
export function looksLikeDaySchedule(message: string): boolean {
  const lower = message.toLowerCase();
  const timeHits =
    (message.match(/\b(?:at|around|by)\s+\d{1,2}(?::\d{2})?\b/gi) ?? []).length +
    (message.match(/\b\d{1,2}(?::\d{2})?\s*(?:am|pm)\b/gi) ?? []).length;
  const activityHits =
    /breakfast|lunch|dinner|train|bus|hotel|lobby|free time|wander|meet|arriv|depart|station|tower|museum|mall|sky\s*tree/i.test(
      lower,
    );
  return timeHits >= 2 && activityHits && message.trim().length >= 40;
}

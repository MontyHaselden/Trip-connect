import { DateTime } from "luxon";

import { weekStartMonday } from "@/lib/host/setup/calendar-bounds";
import { MAX_DATE_ENUMERATION_DAYS } from "@/lib/host/wizard/location-stays";

export type WeekCell = { iso: string; day: number; monthKey: string };

export function buildScrollWeeks(rangeStart: DateTime, rangeEnd: DateTime): WeekCell[][] {
  const weeks: WeekCell[][] = [];
  let cursor = weekStartMonday(rangeStart);
  const lastWeekStart = weekStartMonday(rangeEnd);
  const maxWeeks = Math.ceil(MAX_DATE_ENUMERATION_DAYS / 7) + 2;

  while (cursor <= lastWeekStart && weeks.length < maxWeeks) {
    const week: WeekCell[] = [];
    for (let i = 0; i < 7; i++) {
      const d = cursor.plus({ days: i });
      const iso = d.toISODate();
      if (!iso) continue;
      week.push({
        iso,
        day: d.day,
        monthKey: d.toFormat("yyyy-MM"),
      });
    }
    weeks.push(week);
    cursor = cursor.plus({ weeks: 1 });
  }

  return weeks;
}

function monthLabelFromCell(cell: WeekCell): string {
  return DateTime.fromISO(cell.iso).toFormat("LLLL yyyy");
}

export type CalendarWeekSection = {
  key: string;
  cells: Array<WeekCell | null>;
  contextWeek: WeekCell[];
  monthLabel: string | null;
  monthBreakBefore: boolean;
  monthKey: string;
};

/** Split weeks at month boundaries so the 1st always lands in the correct weekday column. */
export function planCalendarWeekSections(weeks: WeekCell[][]): CalendarWeekSection[] {
  const sections: CalendarWeekSection[] = [];
  const labeledMonths = new Set<string>();
  let hasPriorSection = false;

  for (let weekIndex = 0; weekIndex < weeks.length; weekIndex++) {
    const week = weeks[weekIndex]!;
    const firstOfMonthIdx = week.findIndex((c) => c.day === 1);

    if (firstOfMonthIdx > 0) {
      const tailCells = week.map((c, i) => (i < firstOfMonthIdx ? c : null));
      const tailMonthKey = week[0]!.monthKey;
      sections.push({
        key: `${week[0]!.iso}-tail`,
        cells: tailCells,
        contextWeek: week,
        monthLabel: null,
        monthBreakBefore: false,
        monthKey: tailMonthKey,
      });
      hasPriorSection = true;

      const headCell = week[firstOfMonthIdx]!;
      const headCells = week.map((c, i) => (i >= firstOfMonthIdx ? c : null));
      const headMonthKey = headCell.monthKey;
      const label = monthLabelFromCell(headCell);
      labeledMonths.add(headMonthKey);
      sections.push({
        key: `${headCell.iso}-head`,
        cells: headCells,
        contextWeek: week,
        monthLabel: label,
        monthBreakBefore: hasPriorSection,
        monthKey: headMonthKey,
      });
      hasPriorSection = true;
      continue;
    }

    let monthLabel: string | null = null;
    const mondayMonthKey = week[0]!.monthKey;

    if (firstOfMonthIdx === 0) {
      monthLabel = monthLabelFromCell(week[0]!);
      labeledMonths.add(mondayMonthKey);
    } else if (weekIndex === 0) {
      monthLabel = monthLabelFromCell(week[0]!);
      labeledMonths.add(mondayMonthKey);
    } else if (!labeledMonths.has(mondayMonthKey)) {
      monthLabel = monthLabelFromCell(week[0]!);
      labeledMonths.add(mondayMonthKey);
    }

    sections.push({
      key: week[0]!.iso,
      cells: week,
      contextWeek: week,
      monthLabel,
      monthBreakBefore: Boolean(monthLabel && hasPriorSection),
      monthKey: mondayMonthKey,
    });
    hasPriorSection = true;
  }

  return sections;
}

export function weekIndexForDate(weeks: WeekCell[][], iso: string): number {
  for (let i = 0; i < weeks.length; i++) {
    if (weeks[i]?.some((c) => c.iso === iso)) return i;
  }
  return -1;
}

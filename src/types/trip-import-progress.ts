import type { ImportGap } from "@/lib/host/wizard/analyze-import-gaps";

export type TripImportProgress =
  | {
      type: "phase";
      phase: "reading" | "planning" | "structure" | "structure_applied" | "building";
    }
  | {
      type: "trip_dates";
      startDate: string;
      endDate: string;
      dayCount: number;
      timezone: string;
    }
  | {
      type: "day_start";
      index: number;
      total: number;
      date: string;
      cityLabel: string;
    }
  | {
      type: "item_added";
      date: string;
      index: number;
      total: number;
      title: string;
      category: string | null;
    }
  | { type: "day_complete"; date: string; itemCount: number }
  | {
      type: "gaps";
      gaps: ImportGap[];
    }
  | {
      type: "done";
      stats: { daysCreated: number; daysUpdated: number; itemsCreated: number };
      trip: {
        name: string;
        schoolName: string;
        startDate: string;
        endDate: string;
        timezone: string;
      };
      gaps?: ImportGap[];
      filledDayCount?: number;
      calendarGaps?: {
        unpaintedDates: string[];
        missingTransport: Array<{ date: string; fromCity: string; toCity: string }>;
      };
      postImportMessage?: string;
      fillProposal?: {
        assistantReply: string;
        proposedCommands: import("@/lib/trip-engine/commands").TripCommand[];
        commandSummaries: string[];
      } | null;
    }
  | { type: "error"; error: string };

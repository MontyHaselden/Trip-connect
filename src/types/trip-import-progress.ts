export type TripImportProgress =
  | { type: "phase"; phase: "reading" | "planning" | "building" }
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
      type: "done";
      stats: { daysCreated: number; daysUpdated: number; itemsCreated: number };
      trip: {
        name: string;
        schoolName: string;
        startDate: string;
        endDate: string;
        timezone: string;
      };
    }
  | { type: "error"; error: string };

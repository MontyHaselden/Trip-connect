import { z } from "zod";

import { ACTIVITY_CATEGORIES } from "@/types/activity-category";

export const ImportItemSchema = z.object({
  startTime: z.string(),
  endTime: z.string().nullable().optional(),
  title: z.string().min(1),
  locationName: z.string().nullable().optional(),
  address: z.string().nullable().optional(),
  leaveByTime: z.string().nullable().optional(),
  transportNote: z.string().nullable().optional(),
  bringNote: z.string().nullable().optional(),
  category: z.enum(ACTIVITY_CATEGORIES).nullable().optional(),
});

export const ImportDaySchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  cityLabel: z.string().min(1),
  summary: z.string().nullable().optional(),
  items: z.array(ImportItemSchema),
});

export const ItineraryImportSchema = z.object({
  days: z.array(ImportDaySchema),
});

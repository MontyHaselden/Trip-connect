import { z } from "zod";

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

export const ChangeScopeSchema = z.discriminatedUnion("mode", [
  z.object({
    mode: z.literal("today"),
    date: isoDate,
  }),
  z.object({
    mode: z.literal("whole_trip"),
  }),
  z.object({
    mode: z.literal("dates"),
    dates: z.array(isoDate).min(1).max(31),
  }),
]);

export type ChangeScopeInput = z.infer<typeof ChangeScopeSchema>;

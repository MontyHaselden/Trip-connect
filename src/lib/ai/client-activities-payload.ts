import { z } from "zod";

import type { ActivityDraft } from "@/lib/host/wizard/types";

const ClientActivitySchema = z
  .object({
    id: z.string().min(1),
    title: z.string(),
    date: z.string(),
  })
  .passthrough();

export const ClientActivitiesSchema = z.array(ClientActivitySchema).max(500);

export function parseClientActivities(value: unknown): ActivityDraft[] | undefined {
  const parsed = ClientActivitiesSchema.safeParse(value);
  if (!parsed.success || !parsed.data.length) return undefined;
  return parsed.data as ActivityDraft[];
}

import { z } from "zod";

export const VisibilityTargetSchema = z.object({
  targetType: z.enum(["group", "participant", "room"]),
  targetId: z.string().uuid(),
});

export const VisibilityFieldsSchema = z.object({
  visibilityMode: z
    .enum(["everyone", "staff_only", "viewers_only", "hidden_from_students", "custom"])
    .optional(),
  targets: z.array(VisibilityTargetSchema).optional(),
});

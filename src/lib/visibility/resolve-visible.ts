import type {
  ParticipantVisibilityContext,
  PublishedVisibilityTarget,
  VisibilityEntity,
  VisibilityEntityType,
  VisibilityMode,
  VisibilityTarget,
} from "./types";
import {
  resolveVisibilityMode,
  targetsForEntity,
} from "./types";

export type { ParticipantVisibilityContext, VisibilityMode, VisibilityTarget };

function matchesCustomTarget(
  target: VisibilityTarget,
  ctx: ParticipantVisibilityContext,
): boolean {
  if (target.targetType === "participant") {
    return target.targetId === ctx.participantId;
  }
  if (target.targetType === "group") {
    return ctx.groupIds.has(target.targetId);
  }
  if (target.targetType === "room") {
    return ctx.roomId !== null && target.targetId === ctx.roomId;
  }
  return false;
}

function matchesLegacyAudience(
  entity: VisibilityEntity,
  ctx: ParticipantVisibilityContext,
): boolean {
  if (!entity.audienceType || entity.audienceType === "everyone") return true;
  if (!entity.audienceId) return false;
  if (entity.audienceType === "participant") {
    return entity.audienceId === ctx.participantId;
  }
  if (entity.audienceType === "group") {
    return ctx.groupIds.has(entity.audienceId);
  }
  if (entity.audienceType === "room") {
    return ctx.roomId !== null && entity.audienceId === ctx.roomId;
  }
  return false;
}

export function isVisibleToParticipant(
  entity: VisibilityEntity,
  ctx: ParticipantVisibilityContext,
  targets: VisibilityTarget[] = [],
): boolean {
  const mode = resolveVisibilityMode(entity);

  if (mode === "hidden_from_students") return false;
  if (mode === "viewers_only") return false;
  if (mode === "staff_only") return ctx.role !== "student";
  if (mode === "everyone") return true;

  if (mode === "custom") {
    if (targets.length > 0) {
      return targets.some((t) => matchesCustomTarget(t, ctx));
    }
    return matchesLegacyAudience(entity, ctx);
  }

  return matchesLegacyAudience(entity, ctx);
}

export function isVisibleToViewer(
  entity: VisibilityEntity,
  targets: VisibilityTarget[] = [],
): boolean {
  const mode = resolveVisibilityMode(entity);
  if (mode === "hidden_from_students") return false;
  if (mode === "viewers_only") return true;
  if (mode === "staff_only") return false;
  if (mode === "everyone") return true;
  if (mode === "custom") {
    return targets.length === 0;
  }
  return true;
}

export function filterEntitiesForParticipant<
  T extends VisibilityEntity & { id: string },
>(
  entities: T[],
  entityType: VisibilityEntityType,
  allTargets: PublishedVisibilityTarget[],
  ctx: ParticipantVisibilityContext,
): T[] {
  return entities.filter((entity) =>
    isVisibleToParticipant(
      entity,
      ctx,
      targetsForEntity(entityType, entity.id, allTargets),
    ),
  );
}

export function filterEntitiesForViewer<
  T extends VisibilityEntity & { id: string },
>(
  entities: T[],
  entityType: VisibilityEntityType,
  allTargets: PublishedVisibilityTarget[],
): T[] {
  return entities.filter((entity) =>
    isVisibleToViewer(entity, targetsForEntity(entityType, entity.id, allTargets)),
  );
}

/** Sync legacy audience_type/id from visibility mode + targets (for dual-write APIs). */
export function legacyAudienceFromVisibility(
  visibilityMode: VisibilityMode,
  targets: VisibilityTarget[],
): { audienceType: "everyone" | "group" | "room" | "participant"; audienceId: string | null } {
  if (visibilityMode === "everyone") {
    return { audienceType: "everyone", audienceId: null };
  }
  if (visibilityMode === "custom" && targets.length === 1) {
    const t = targets[0]!;
    if (t.targetType === "group") return { audienceType: "group", audienceId: t.targetId };
    if (t.targetType === "participant") {
      return { audienceType: "participant", audienceId: t.targetId };
    }
    if (t.targetType === "room") return { audienceType: "room", audienceId: t.targetId };
  }
  if (visibilityMode === "custom" && targets.length > 1) {
    const first = targets[0]!;
    if (first.targetType === "group") {
      return { audienceType: "group", audienceId: first.targetId };
    }
  }
  return { audienceType: "everyone", audienceId: null };
}

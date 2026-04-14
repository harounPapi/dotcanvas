import { TurnId } from "@t3tools/contracts";

export type ThreadViewMode = "agent" | "room";

export const DEFAULT_THREAD_VIEW_MODE: ThreadViewMode = "agent";

export interface ChatThreadRouteSearch {
  view?: ThreadViewMode | undefined;
  diff?: "1" | undefined;
  diffTurnId?: TurnId | undefined;
  diffFilePath?: string | undefined;
}

export interface ParsedChatThreadRouteSearch extends Omit<ChatThreadRouteSearch, "view"> {
  view: ThreadViewMode;
}

function isThreadViewMode(value: unknown): value is ThreadViewMode {
  return value === "agent" || value === "room";
}

function isDiffOpenValue(value: unknown): boolean {
  return value === "1" || value === 1 || value === true;
}

function normalizeSearchString(value: unknown): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }
  const normalized = value.trim();
  return normalized.length > 0 ? normalized : undefined;
}

export function stripDiffSearchParams<T extends Record<string, unknown>>(
  params: T,
): Omit<T, "diff" | "diffTurnId" | "diffFilePath"> {
  const { diff: _diff, diffTurnId: _diffTurnId, diffFilePath: _diffFilePath, ...rest } = params;
  return rest as Omit<T, "diff" | "diffTurnId" | "diffFilePath">;
}

export function pickThreadViewSearch(
  search: Record<string, unknown>,
): Partial<Pick<ChatThreadRouteSearch, "view">> {
  return isThreadViewMode(search.view) ? { view: search.view } : {};
}

export function validateChatThreadRouteSearch(
  search: Record<string, unknown>,
): ChatThreadRouteSearch {
  const view = isThreadViewMode(search.view) ? search.view : undefined;
  const diff = isDiffOpenValue(search.diff) ? "1" : undefined;
  const diffTurnIdRaw = diff ? normalizeSearchString(search.diffTurnId) : undefined;
  const diffTurnId = diffTurnIdRaw ? TurnId.makeUnsafe(diffTurnIdRaw) : undefined;
  const diffFilePath = diff && diffTurnId ? normalizeSearchString(search.diffFilePath) : undefined;

  return {
    ...(view ? { view } : {}),
    ...(diff ? { diff } : {}),
    ...(diffTurnId ? { diffTurnId } : {}),
    ...(diffFilePath ? { diffFilePath } : {}),
  };
}

export function parseChatThreadRouteSearch(
  search: Record<string, unknown>,
): ParsedChatThreadRouteSearch {
  const parsed = validateChatThreadRouteSearch(search);

  return {
    ...parsed,
    view: parsed.view ?? DEFAULT_THREAD_VIEW_MODE,
  };
}

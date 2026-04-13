import {
  EDITORS,
  PROJECT_APPS,
  type EditorId,
  type NativeApi,
  type ProjectAppId,
} from "@t3tools/contracts";
import { useCallback, useEffect, useState } from "react";

export type ProjectOpenTargetId = EditorId | ProjectAppId;

const LAST_PROJECT_OPEN_TARGET_KEY = "t3code:last-project-open-target";

function readStoredProjectOpenTarget(): ProjectOpenTargetId | null {
  if (typeof window === "undefined") {
    return null;
  }

  const rawValue = window.localStorage.getItem(LAST_PROJECT_OPEN_TARGET_KEY);
  if (!rawValue) {
    return null;
  }

  try {
    const parsed = JSON.parse(rawValue);
    return typeof parsed === "string" &&
      (EDITORS.some((editor) => editor.id === parsed) ||
        PROJECT_APPS.some((app) => app.id === parsed))
      ? (parsed as ProjectOpenTargetId)
      : null;
  } catch {
    return null;
  }
}

function writeStoredProjectOpenTarget(target: ProjectOpenTargetId | null): void {
  if (typeof window === "undefined") {
    return;
  }

  if (target === null) {
    window.localStorage.removeItem(LAST_PROJECT_OPEN_TARGET_KEY);
    return;
  }

  window.localStorage.setItem(LAST_PROJECT_OPEN_TARGET_KEY, JSON.stringify(target));
}

function resolvePreferredProjectOpenTarget(
  availableEditors: ReadonlyArray<EditorId>,
  availableProjectApps: ReadonlyArray<ProjectAppId>,
  storedTarget: ProjectOpenTargetId | null,
): ProjectOpenTargetId | null {
  const availableEditorIds = new Set(availableEditors);
  const availableProjectAppIds = new Set(availableProjectApps);

  if (
    storedTarget &&
    (availableEditorIds.has(storedTarget as EditorId) ||
      availableProjectAppIds.has(storedTarget as ProjectAppId))
  ) {
    return storedTarget;
  }

  const preferredEditor = EDITORS.find((editor) => availableEditorIds.has(editor.id))?.id ?? null;
  if (preferredEditor) {
    return preferredEditor;
  }

  return PROJECT_APPS.find((app) => availableProjectAppIds.has(app.id))?.id ?? null;
}

export function usePreferredProjectOpenTarget(
  availableEditors: ReadonlyArray<EditorId>,
  availableProjectApps: ReadonlyArray<ProjectAppId>,
) {
  const [target, setTargetState] = useState<ProjectOpenTargetId | null>(() =>
    resolveAndPersistPreferredProjectOpenTarget(availableEditors, availableProjectApps),
  );

  useEffect(() => {
    setTargetState(
      resolveAndPersistPreferredProjectOpenTarget(availableEditors, availableProjectApps),
    );
  }, [availableEditors, availableProjectApps]);

  const setTarget = useCallback(
    (
      value:
        | ProjectOpenTargetId
        | null
        | ((current: ProjectOpenTargetId | null) => ProjectOpenTargetId | null),
    ) => {
      setTargetState((current) => {
        const nextTarget = typeof value === "function" ? value(current) : value;
        writeStoredProjectOpenTarget(nextTarget);
        return nextTarget;
      });
    },
    [],
  );

  return [target, setTarget] as const;
}

export function resolveAndPersistPreferredProjectOpenTarget(
  availableEditors: ReadonlyArray<EditorId>,
  availableProjectApps: ReadonlyArray<ProjectAppId>,
): ProjectOpenTargetId | null {
  const target = resolvePreferredProjectOpenTarget(
    availableEditors,
    availableProjectApps,
    readStoredProjectOpenTarget(),
  );
  writeStoredProjectOpenTarget(target);
  return target;
}

export async function openInPreferredProjectTarget(
  api: NativeApi,
  cwd: string,
): Promise<ProjectOpenTargetId> {
  const { availableEditors, availableProjectApps } = await api.server.getConfig();
  const target = resolveAndPersistPreferredProjectOpenTarget(
    availableEditors,
    availableProjectApps,
  );
  if (!target) {
    throw new Error("No available editors or project apps found.");
  }

  if (target === "obsidian") {
    await api.shell.openInProjectApp(cwd, target);
    return target;
  }

  await api.shell.openInEditor(cwd, target);
  return target;
}

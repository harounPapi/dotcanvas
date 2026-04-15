"use client";

import type { ProjectWorkspaceChangeEvent } from "@t3tools/contracts";
import { useQueryClient } from "@tanstack/react-query";
import {
  Fragment,
  startTransition,
  useCallback,
  useEffect,
  useEffectEvent,
  useMemo,
  useRef,
  useState,
} from "react";

import { readNativeApi } from "~/nativeApi";
import { projectQueryKeys, projectReadFileQueryOptions } from "~/lib/projectReactQuery";
import { Alert, AlertAction, AlertDescription, AlertTitle } from "~/components/ui/alert";
import { Button } from "~/components/ui/button";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "~/components/ui/breadcrumb";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "~/components/ui/empty";
import {
  FileIcon,
  FolderClosedIcon,
  InfoIcon,
  Loader2Icon,
  RefreshCwIcon,
  TriangleAlertIcon,
} from "~/components/ui/icons";
import { Skeleton } from "~/components/ui/skeleton";
import { Separator } from "~/components/ui/separator";
import { cn } from "~/lib/utils";

import { RoomMarkdownSurface } from "./RoomMarkdownSurface";
import {
  isMarkdownPath,
  roomBreadcrumbSegments,
  ROOM_WRITE_CONFLICT_MESSAGE,
  resolveWorkspaceAbsolutePath,
} from "./roomFileUtils";

type LoadedFileMap = Record<
  string,
  {
    relativePath: string;
    contents: string;
    sizeBytes: number;
    mtimeMs: number;
  }
>;

type SaveState =
  | { status: "idle" }
  | { status: "saving"; path: string }
  | { status: "error"; path: string; message: string };

function statusMessage(error: unknown): string {
  if (
    typeof error === "object" &&
    error !== null &&
    "message" in error &&
    typeof error.message === "string" &&
    error.message.trim().length > 0
  ) {
    return error.message;
  }
  return error instanceof Error ? error.message : "Unable to open this file.";
}

function omitKey<T extends Record<string, unknown>>(record: T, key: string): T {
  const { [key]: _removed, ...rest } = record;
  return rest as T;
}

function isUnsupportedRoomFileMessage(message: string | undefined): boolean {
  if (!message) {
    return false;
  }

  return (
    message.includes("File is too large to open in Room") ||
    message.includes("File is not valid UTF-8 text") ||
    message.includes("File is not a supported text document")
  );
}

function unsupportedFileDescription(message: string | undefined): string {
  if (!message) {
    return "Room can edit and preview Markdown files here for now.";
  }
  if (message.includes("File is too large")) {
    return "This Markdown file is too large for the Room editor right now. Open it in Finder to continue in another app.";
  }
  if (message.includes("UTF-8") || message.includes("supported text document")) {
    return "This file isn’t plain UTF-8 Markdown, so Room can’t safely render it yet.";
  }
  return message;
}

export function RoomFilePane(props: {
  resolvedTheme: "light" | "dark";
  selectedPath: string | undefined;
  subscribeToWorkspaceChanges: (
    listener: (event: ProjectWorkspaceChangeEvent) => void,
  ) => () => void;
  visible: boolean;
  workspaceRoot: string | undefined;
}) {
  const { resolvedTheme, selectedPath, subscribeToWorkspaceChanges, visible, workspaceRoot } =
    props;
  const queryClient = useQueryClient();
  const generationRef = useRef(0);
  const [draftsByPath, setDraftsByPath] = useState<Record<string, string>>({});
  const [errorsByPath, setErrorsByPath] = useState<Record<string, string>>({});
  const [loadedByPath, setLoadedByPath] = useState<LoadedFileMap>({});
  const [loadingPath, setLoadingPath] = useState<string>();
  const [saveState, setSaveState] = useState<SaveState>({ status: "idle" });
  const [conflictPaths, setConflictPaths] = useState<Record<string, true>>({});
  const [deletedPaths, setDeletedPaths] = useState<Record<string, true>>({});
  const draftsByPathRef = useRef(draftsByPath);
  const loadedByPathRef = useRef(loadedByPath);
  const deletedPathsRef = useRef(deletedPaths);

  useEffect(() => {
    draftsByPathRef.current = draftsByPath;
  }, [draftsByPath]);

  useEffect(() => {
    loadedByPathRef.current = loadedByPath;
  }, [loadedByPath]);

  useEffect(() => {
    deletedPathsRef.current = deletedPaths;
  }, [deletedPaths]);

  useEffect(() => {
    generationRef.current += 1;
    setDraftsByPath({});
    setErrorsByPath({});
    setLoadedByPath({});
    setLoadingPath(undefined);
    setSaveState({ status: "idle" });
    setConflictPaths({});
    setDeletedPaths({});
  }, [workspaceRoot]);

  const loadFile = useEffectEvent(
    async (relativePath: string, options?: { force?: boolean; preserveDraft?: boolean }) => {
      if (!workspaceRoot) {
        return;
      }

      if (!options?.force && loadedByPathRef.current[relativePath]) {
        return;
      }

      const generation = generationRef.current;
      setLoadingPath(relativePath);
      setErrorsByPath((current) => omitKey(current, relativePath));

      try {
        await queryClient.invalidateQueries({
          queryKey: projectQueryKeys.readFile(workspaceRoot, relativePath),
        });
        const result = await queryClient.fetchQuery(
          projectReadFileQueryOptions({
            cwd: workspaceRoot,
            relativePath,
          }),
        );

        if (generationRef.current !== generation) {
          return;
        }

        startTransition(() => {
          setLoadedByPath((current) => ({
            ...current,
            [relativePath]: result,
          }));
          setDraftsByPath((current) => ({
            ...current,
            [relativePath]:
              options?.preserveDraft && current[relativePath] !== undefined
                ? current[relativePath]
                : result.contents,
          }));
          setConflictPaths((current) => omitKey(current, relativePath));
          setDeletedPaths((current) => omitKey(current, relativePath));
        });
      } catch (error) {
        if (generationRef.current !== generation) {
          return;
        }

        startTransition(() => {
          setErrorsByPath((current) => ({
            ...current,
            [relativePath]: statusMessage(error),
          }));
        });
      } finally {
        if (generationRef.current === generation) {
          setLoadingPath((current) => (current === relativePath ? undefined : current));
        }
      }
    },
  );

  const selectedFile = selectedPath ? loadedByPath[selectedPath] : undefined;
  const selectedDraft = selectedPath ? draftsByPath[selectedPath] : undefined;
  const selectedError = selectedPath ? errorsByPath[selectedPath] : undefined;
  const selectedBreadcrumbs = useMemo(
    () =>
      workspaceRoot && selectedPath ? roomBreadcrumbSegments(workspaceRoot, selectedPath) : [],
    [selectedPath, workspaceRoot],
  );
  const isMarkdownSelection = selectedPath ? isMarkdownPath(selectedPath) : false;
  const isLoadingSelectedFile = selectedPath !== undefined && loadingPath === selectedPath;
  const hasLoadedSelectedFile = selectedFile !== undefined;
  const isDirty =
    selectedFile !== undefined &&
    selectedDraft !== undefined &&
    selectedDraft !== selectedFile.contents;
  const isSaving = saveState.status === "saving" && saveState.path === selectedPath;
  const saveError =
    saveState.status === "error" && saveState.path === selectedPath ? saveState.message : undefined;
  const hasSaveConflict = selectedPath ? conflictPaths[selectedPath] === true : false;
  const wasDeletedOnDisk = selectedPath ? deletedPaths[selectedPath] === true : false;
  const hasLoadedMarkdown = Boolean(
    isMarkdownSelection && selectedFile && selectedDraft !== undefined,
  );
  const shouldShowUnsupportedState =
    selectedPath !== undefined &&
    (!isMarkdownSelection || isUnsupportedRoomFileMessage(selectedError));
  const showLoadingPlaceholder =
    isLoadingSelectedFile && !hasLoadedSelectedFile && isMarkdownSelection;

  useEffect(() => {
    if (
      !visible ||
      !workspaceRoot ||
      !selectedPath ||
      !isMarkdownSelection ||
      hasLoadedSelectedFile
    ) {
      return;
    }

    void loadFile(selectedPath, { preserveDraft: true });
  }, [hasLoadedSelectedFile, isMarkdownSelection, selectedPath, visible, workspaceRoot]);

  const handleWorkspaceChange = useEffectEvent((event: ProjectWorkspaceChangeEvent) => {
    if (!visible || !workspaceRoot || event._tag !== "pathChanged") {
      return;
    }

    const changedPath = event.relativePath;
    const currentLoaded = loadedByPathRef.current[changedPath];
    const currentDraft = draftsByPathRef.current[changedPath];
    const hasDraft = currentDraft !== undefined;
    const hasDirtyDraft =
      currentLoaded !== undefined ? hasDraft && currentDraft !== currentLoaded.contents : hasDraft;
    const isSelectedFile = changedPath === selectedPath;

    if (isSelectedFile) {
      if (!event.exists) {
        startTransition(() => {
          setDeletedPaths((current) => ({
            ...current,
            [changedPath]: true,
          }));
          setErrorsByPath((current) => omitKey(current, changedPath));
          if (hasDirtyDraft) {
            setConflictPaths((current) => ({
              ...current,
              [changedPath]: true,
            }));
          }
        });
        return;
      }

      if (hasDirtyDraft) {
        startTransition(() => {
          setConflictPaths((current) => ({
            ...current,
            [changedPath]: true,
          }));
          setDeletedPaths((current) => omitKey(current, changedPath));
          setErrorsByPath((current) => omitKey(current, changedPath));
        });
        return;
      }

      void loadFile(changedPath, { force: true, preserveDraft: false });
      return;
    }

    if (!currentLoaded && !hasDraft) {
      return;
    }

    startTransition(() => {
      setErrorsByPath((current) => omitKey(current, changedPath));

      if (hasDirtyDraft) {
        setConflictPaths((current) => ({
          ...current,
          [changedPath]: true,
        }));
        if (!event.exists) {
          setDeletedPaths((current) => ({
            ...current,
            [changedPath]: true,
          }));
        } else {
          setDeletedPaths((current) => omitKey(current, changedPath));
        }
        return;
      }

      setLoadedByPath((current) => omitKey(current, changedPath));
      setDraftsByPath((current) => omitKey(current, changedPath));
      setConflictPaths((current) => omitKey(current, changedPath));
      setDeletedPaths((current) => omitKey(current, changedPath));
    });
  });

  useEffect(() => {
    return subscribeToWorkspaceChanges((event) => {
      handleWorkspaceChange(event);
    });
  }, [subscribeToWorkspaceChanges]);

  const handleDraftChange = useCallback(
    (nextValue: string) => {
      if (!selectedPath) {
        return;
      }
      setDraftsByPath((current) => ({
        ...current,
        [selectedPath]: nextValue,
      }));
      setSaveState((current) =>
        current.status === "error" && current.path === selectedPath ? { status: "idle" } : current,
      );
    },
    [selectedPath],
  );

  const revealSelectedPath = useCallback(() => {
    if (!selectedPath || !workspaceRoot) {
      return;
    }

    const api = readNativeApi();
    if (!api) {
      return;
    }

    void api.shell.revealInFileManager({
      path: resolveWorkspaceAbsolutePath(workspaceRoot, selectedPath),
    });
  }, [selectedPath, workspaceRoot]);

  const saveSelectedFile = useEffectEvent(async (mode: "checked" | "force") => {
    if (!selectedPath || !workspaceRoot || !selectedFile || selectedDraft === undefined) {
      return;
    }

    const api = readNativeApi();
    if (!api) {
      return;
    }

    setSaveState({ status: "saving", path: selectedPath });

    try {
      await api.projects.writeFile({
        cwd: workspaceRoot,
        relativePath: selectedPath,
        contents: selectedDraft,
        ...(mode === "checked" && !deletedPathsRef.current[selectedPath]
          ? { expectedMtimeMs: selectedFile.mtimeMs }
          : {}),
      });

      const refreshed = await api.projects.readFile({
        cwd: workspaceRoot,
        relativePath: selectedPath,
      });

      startTransition(() => {
        setLoadedByPath((current) => ({
          ...current,
          [selectedPath]: refreshed,
        }));
        setDraftsByPath((current) => ({
          ...current,
          [selectedPath]: refreshed.contents,
        }));
        setErrorsByPath((current) => omitKey(current, selectedPath));
        setConflictPaths((current) => omitKey(current, selectedPath));
        setDeletedPaths((current) => omitKey(current, selectedPath));
        setSaveState({ status: "idle" });
      });
      await queryClient.invalidateQueries({
        queryKey: projectQueryKeys.readFile(workspaceRoot, selectedPath),
      });
    } catch (error) {
      const message = statusMessage(error);

      startTransition(() => {
        setSaveState({ status: "error", path: selectedPath, message });
        if (message === ROOM_WRITE_CONFLICT_MESSAGE) {
          setConflictPaths((current) => ({
            ...current,
            [selectedPath]: true,
          }));
        }
      });
    }
  });

  const saveStatusLabel = useMemo(() => {
    if (isSaving) {
      return "Saving...";
    }
    if (wasDeletedOnDisk) {
      return "Deleted on disk";
    }
    if (saveError && !hasSaveConflict) {
      return saveError;
    }
    if (isDirty) {
      return "Unsaved";
    }
    if (hasLoadedMarkdown) {
      return "Saved";
    }
    return undefined;
  }, [hasLoadedMarkdown, hasSaveConflict, isDirty, isSaving, saveError, wasDeletedOnDisk]);

  return (
    <div
      aria-label="Room file pane"
      className="flex min-h-0 min-w-0 flex-1 flex-col"
      data-room-file-pane="true"
    >
      {selectedPath ? (
        <div className="flex items-center justify-between gap-4 px-5 py-3">
          <Breadcrumb aria-label="Room file breadcrumbs" className="min-w-0 overflow-hidden">
            <BreadcrumbList className="min-w-0 flex-nowrap overflow-hidden text-[11px]">
              {selectedBreadcrumbs.map((segment, index) => {
                const isLast = index === selectedBreadcrumbs.length - 1;
                const segmentKey = selectedBreadcrumbs.slice(0, index + 1).join("/");
                return (
                  <Fragment key={segmentKey}>
                    <BreadcrumbItem className="min-w-0 shrink overflow-hidden">
                      {isLast ? (
                        <BreadcrumbPage className="min-w-0 truncate text-[11px]" title={segment}>
                          {segment}
                        </BreadcrumbPage>
                      ) : (
                        <span
                          className="block min-w-0 truncate text-[11px] text-muted-foreground"
                          title={segment}
                        >
                          {segment}
                        </span>
                      )}
                    </BreadcrumbItem>
                    {!isLast ? (
                      <BreadcrumbSeparator className="shrink-0 text-muted-foreground/40">
                        <span>/</span>
                      </BreadcrumbSeparator>
                    ) : null}
                  </Fragment>
                );
              })}
            </BreadcrumbList>
          </Breadcrumb>
          {isMarkdownSelection ? (
            <div className="flex shrink-0 items-center gap-2">
              {saveStatusLabel ? (
                <span
                  className={cn(
                    "max-w-56 truncate text-[11px] text-muted-foreground",
                    saveError && !hasSaveConflict && "text-destructive",
                  )}
                >
                  {saveStatusLabel}
                </span>
              ) : null}
              <Button
                aria-label="Save room file"
                disabled={!hasLoadedMarkdown || !isDirty || isSaving}
                onClick={() => {
                  void saveSelectedFile("checked");
                }}
                size="xs"
                variant="outline"
              >
                {isSaving ? (
                  <Loader2Icon data-icon="inline-start" className="animate-spin" />
                ) : null}
                Save
              </Button>
            </div>
          ) : null}
        </div>
      ) : null}

      {selectedPath ? <Separator /> : null}

      <div className="min-h-0 min-w-0 flex flex-1 flex-col overflow-hidden">
        {!selectedPath ? (
          <div className="flex h-full items-center justify-center px-5 text-sm text-muted-foreground">
            Select a file from the Room folder sidebar.
          </div>
        ) : null}

        {selectedPath && (hasSaveConflict || wasDeletedOnDisk) ? (
          <Alert className="m-5 mb-4" variant="warning">
            <TriangleAlertIcon />
            <AlertTitle>
              {wasDeletedOnDisk ? "File deleted on disk" : "File changed on disk"}
            </AlertTitle>
            <AlertDescription>
              {wasDeletedOnDisk
                ? isDirty
                  ? "This file was removed outside Room. Your draft is still here, and saving will recreate it."
                  : "This file was removed outside Room. You can keep reading it here, or edit and save to recreate it."
                : "This file changed outside Room. Your draft is still here until you choose how to handle it."}
            </AlertDescription>
            {!wasDeletedOnDisk ? (
              <AlertAction>
                <Button
                  onClick={() => {
                    void loadFile(selectedPath, { force: true, preserveDraft: false });
                  }}
                  size="xs"
                  variant="outline"
                >
                  <RefreshCwIcon data-icon="inline-start" />
                  Reload from disk
                </Button>
                <Button
                  onClick={() => {
                    void saveSelectedFile("force");
                  }}
                  size="xs"
                >
                  Overwrite anyway
                </Button>
              </AlertAction>
            ) : isDirty ? (
              <AlertAction>
                <Button
                  onClick={() => {
                    void saveSelectedFile("force");
                  }}
                  size="xs"
                >
                  Save to recreate
                </Button>
              </AlertAction>
            ) : null}
          </Alert>
        ) : null}

        {selectedPath && saveError && !hasSaveConflict ? (
          <Alert className="m-5 mb-4" variant="error">
            <TriangleAlertIcon />
            <AlertTitle>Unable to save this file</AlertTitle>
            <AlertDescription>{saveError}</AlertDescription>
          </Alert>
        ) : null}

        {showLoadingPlaceholder ? (
          <div className="flex flex-col gap-4 px-5 pt-4">
            <Skeleton className="h-8 w-48 rounded-lg" />
            <Skeleton className="h-24 w-full rounded-xl" />
            <Skeleton className="h-16 w-11/12 rounded-xl" />
            <Skeleton className="h-32 w-full rounded-xl" />
          </div>
        ) : null}

        {selectedPath && shouldShowUnsupportedState ? (
          <Empty className="min-h-full justify-start px-5 pt-10">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <FileIcon />
              </EmptyMedia>
              <EmptyTitle>This document isn’t supported here yet</EmptyTitle>
              <EmptyDescription>
                {unsupportedFileDescription(isMarkdownSelection ? selectedError : undefined)}
              </EmptyDescription>
            </EmptyHeader>
            <EmptyContent className="flex-row justify-center gap-2">
              <Button onClick={revealSelectedPath} size="sm" variant="outline">
                <FolderClosedIcon data-icon="inline-start" />
                Open in Finder
              </Button>
            </EmptyContent>
          </Empty>
        ) : null}

        {selectedPath &&
        isMarkdownSelection &&
        selectedError &&
        !isUnsupportedRoomFileMessage(selectedError) ? (
          <Alert className="m-5 mt-4" variant="error">
            <TriangleAlertIcon />
            <AlertTitle>Unable to open this file</AlertTitle>
            <AlertDescription>{selectedError}</AlertDescription>
            <AlertAction>
              <Button
                onClick={() => {
                  void loadFile(selectedPath, { force: true, preserveDraft: true });
                }}
                size="xs"
                variant="outline"
              >
                <RefreshCwIcon data-icon="inline-start" />
                Retry
              </Button>
            </AlertAction>
          </Alert>
        ) : null}

        {selectedPath && hasLoadedMarkdown ? (
          <div className="min-h-0 flex-1">
            <RoomMarkdownSurface
              className="h-full"
              key={selectedPath}
              onChange={handleDraftChange}
              onSave={() => {
                void saveSelectedFile("checked");
              }}
              resolvedTheme={resolvedTheme}
              value={selectedDraft ?? selectedFile?.contents ?? ""}
            />
          </div>
        ) : null}

        {selectedPath &&
        !showLoadingPlaceholder &&
        !shouldShowUnsupportedState &&
        !selectedError &&
        !hasLoadedMarkdown ? (
          <div className="flex h-full items-center justify-center gap-2 text-sm text-muted-foreground">
            <InfoIcon className="size-4" />
            Preparing this file...
          </div>
        ) : null}
      </div>
    </div>
  );
}

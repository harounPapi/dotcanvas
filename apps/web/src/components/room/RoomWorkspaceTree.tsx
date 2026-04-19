"use client";

import type { ProjectEntry, ProjectWorkspaceChangeEvent } from "@t3tools/contracts";
import { useQueryClient } from "@tanstack/react-query";
import {
  type ReactNode,
  startTransition,
  useCallback,
  useEffect,
  useEffectEvent,
  useRef,
  useState,
} from "react";

import { FileTree, FileTreeFile, FileTreeFolder } from "~/components/ai-elements/file-tree";
import { Button } from "~/components/ui/button";
import { ScrollArea } from "~/components/ui/scroll-area";
import { projectListDirectoryQueryOptions } from "~/lib/projectReactQuery";
import { cn } from "~/lib/utils";
import { basenameOfPath } from "~/vscode-icons";

import { VscodeEntryIcon } from "../chat/VscodeEntryIcon";

const ROOT_DIRECTORY_KEY = "";

type DirectoryState =
  | {
      status: "loading";
      entries: ReadonlyArray<ProjectEntry>;
      truncated: boolean;
      errorMessage?: undefined;
    }
  | {
      status: "loaded";
      entries: ReadonlyArray<ProjectEntry>;
      truncated: boolean;
      errorMessage?: undefined;
    }
  | {
      status: "error";
      entries: ReadonlyArray<ProjectEntry>;
      truncated: boolean;
      errorMessage: string;
    };

function directoryKeyOf(directoryPath?: string): string {
  return directoryPath ?? ROOT_DIRECTORY_KEY;
}

function ancestorDirectoryPathsOf(pathValue: string): ReadonlyArray<string | undefined> {
  const normalizedPath = pathValue.replaceAll("\\", "/").replace(/\/+$/, "");
  if (normalizedPath.length === 0) {
    return [undefined];
  }

  const ancestors: Array<string | undefined> = [undefined];
  const segments = normalizedPath.split("/");
  if (segments.length <= 1) {
    return ancestors;
  }

  for (let index = 0; index < segments.length - 1; index += 1) {
    ancestors.push(segments.slice(0, index + 1).join("/"));
  }

  return ancestors;
}

function omitDirectorySubtree<T>(
  record: Record<string, T>,
  directoryPath: string,
): Record<string, T> {
  const nextRecord: Record<string, T> = {};
  for (const [key, value] of Object.entries(record)) {
    if (key === directoryPath || key.startsWith(`${directoryPath}/`)) {
      continue;
    }
    nextRecord[key] = value;
  }
  return nextRecord;
}

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
  return error instanceof Error ? error.message : "Unable to load this directory.";
}

export function RoomWorkspaceTree(props: {
  onExpandedDirectoryPathsChange: (paths: ReadonlyArray<string>) => void;
  workspaceRoot: string | undefined;
  visible: boolean;
  resolvedTheme: "light" | "dark";
  selectedPath: string | undefined;
  onSelectPathChange: (path: string) => void;
  subscribeToWorkspaceChanges: (
    listener: (event: ProjectWorkspaceChangeEvent) => void,
  ) => () => void;
}) {
  const {
    onExpandedDirectoryPathsChange,
    onSelectPathChange,
    resolvedTheme,
    selectedPath,
    subscribeToWorkspaceChanges,
    visible,
    workspaceRoot,
  } = props;
  const queryClient = useQueryClient();
  const [expandedPaths, setExpandedPaths] = useState<Set<string>>(() => new Set());
  const [directoryStates, setDirectoryStates] = useState<Record<string, DirectoryState>>({});
  const directoryStatesRef = useRef(directoryStates);
  const expandedPathsRef = useRef(expandedPaths);
  const inFlightPathsRef = useRef(new Set<string>());
  const generationRef = useRef(0);

  useEffect(() => {
    directoryStatesRef.current = directoryStates;
  }, [directoryStates]);

  useEffect(() => {
    expandedPathsRef.current = expandedPaths;
    onExpandedDirectoryPathsChange(
      Array.from(expandedPaths).toSorted((left, right) => left.localeCompare(right)),
    );
  }, [expandedPaths, onExpandedDirectoryPathsChange]);

  useEffect(() => {
    generationRef.current += 1;
    inFlightPathsRef.current.clear();
    setExpandedPaths(new Set());
    setDirectoryStates({});
  }, [workspaceRoot]);

  const loadDirectory = useEffectEvent(
    async (directoryPath?: string, options?: { force?: boolean }) => {
      if (!workspaceRoot) {
        return;
      }

      const key = directoryKeyOf(directoryPath);
      const existingState = directoryStatesRef.current[key];
      if (
        (!options?.force && existingState?.status === "loaded") ||
        inFlightPathsRef.current.has(key)
      ) {
        return;
      }

      inFlightPathsRef.current.add(key);
      setDirectoryStates((current) => ({
        ...current,
        [key]: {
          status: "loading",
          entries: current[key]?.entries ?? [],
          truncated: current[key]?.truncated ?? false,
        },
      }));

      const generation = generationRef.current;

      try {
        if (options?.force) {
          await queryClient.invalidateQueries({
            queryKey: [
              ...projectListDirectoryQueryOptions({
                cwd: workspaceRoot,
                ...(directoryPath ? { directoryPath } : {}),
              }).queryKey,
            ],
          });
        }
        const result = await queryClient.fetchQuery(
          projectListDirectoryQueryOptions({
            cwd: workspaceRoot,
            ...(directoryPath ? { directoryPath } : {}),
          }),
        );

        if (generationRef.current !== generation) {
          return;
        }

        startTransition(() => {
          setDirectoryStates((current) => ({
            ...current,
            [key]: {
              status: "loaded",
              entries: result.entries,
              truncated: result.truncated,
            },
          }));
        });
      } catch (error) {
        if (generationRef.current !== generation) {
          return;
        }

        startTransition(() => {
          setDirectoryStates((current) => ({
            ...current,
            [key]: {
              status: "error",
              entries: current[key]?.entries ?? [],
              truncated: false,
              errorMessage: statusMessage(error),
            },
          }));
        });
      } finally {
        inFlightPathsRef.current.delete(key);
      }
    },
  );

  useEffect(() => {
    if (!visible || !workspaceRoot) {
      return;
    }
    void loadDirectory();
  }, [visible, workspaceRoot]);

  const handleWorkspaceChange = useEffectEvent((event: ProjectWorkspaceChangeEvent) => {
    if (!visible || !workspaceRoot) {
      return;
    }

    if (event._tag === "directoryInvalidated") {
      const key = directoryKeyOf(event.directoryPath);
      if (directoryStatesRef.current[key]) {
        void loadDirectory(event.directoryPath, { force: true });
      }
      return;
    }

    for (const ancestorDirectoryPath of ancestorDirectoryPathsOf(event.relativePath)) {
      const ancestorKey = directoryKeyOf(ancestorDirectoryPath);
      if (directoryStatesRef.current[ancestorKey]) {
        void loadDirectory(ancestorDirectoryPath, { force: true });
      }
    }

    const directoryKey = directoryKeyOf(event.relativePath);
    const hasLoadedDirectory = Boolean(directoryStatesRef.current[directoryKey]);
    if (!event.exists && hasLoadedDirectory) {
      startTransition(() => {
        setDirectoryStates((current) => omitDirectorySubtree(current, event.relativePath));
        setExpandedPaths((current) => {
          const nextExpandedPaths = new Set(
            Array.from(current).filter(
              (directoryPath) =>
                directoryPath !== event.relativePath &&
                !directoryPath.startsWith(`${event.relativePath}/`),
            ),
          );
          expandedPathsRef.current = nextExpandedPaths;
          return nextExpandedPaths;
        });
      });
      return;
    }

    if (event.entryKind === "directory" && event.exists && hasLoadedDirectory) {
      void loadDirectory(event.relativePath, { force: true });
    }
  });

  useEffect(() => {
    return subscribeToWorkspaceChanges((event) => {
      handleWorkspaceChange(event);
    });
  }, [subscribeToWorkspaceChanges]);

  const handleExpandedChange = useCallback(
    (nextExpandedPaths: Set<string>) => {
      const newlyExpandedPaths = [...nextExpandedPaths].filter((path) => !expandedPaths.has(path));
      setExpandedPaths(new Set(nextExpandedPaths));
      for (const path of newlyExpandedPaths) {
        void loadDirectory(path);
      }
    },
    [expandedPaths],
  );

  const rootState = directoryStates[ROOT_DIRECTORY_KEY];
  const rootEntries = rootState?.entries ?? [];
  const rootStatus = rootState?.status ?? null;
  const rootTruncated = rootState?.truncated ?? false;

  function renderDirectoryMeta(directoryPath: string): ReactNode {
    const state = directoryStates[directoryPath];
    if (!state) {
      return null;
    }
    if (state.status === "loading") {
      return <div className="px-2 py-1.5 text-[11px] text-muted-foreground/80">Loading…</div>;
    }
    if (state.status === "error") {
      return (
        <div className="space-y-1 px-2 py-1.5">
          <p className="text-[11px] text-rose-600 dark:text-rose-300/90">{state.errorMessage}</p>
          <Button
            size="xs"
            variant="ghost"
            className="h-6 px-2 text-[11px]"
            onClick={() => {
              void loadDirectory(directoryPath);
            }}
          >
            Retry
          </Button>
        </div>
      );
    }
    if (state.entries.length === 0) {
      return <div className="px-2 py-1.5 text-[11px] text-muted-foreground/80">Empty folder</div>;
    }
    return (
      <>
        {state.entries.map((entry) => renderEntry(entry))}
        {state.truncated ? (
          <div className="px-2 py-1.5 text-[11px] text-amber-600 dark:text-amber-300/90">
            This folder is truncated to keep the sidebar responsive.
          </div>
        ) : null}
      </>
    );
  }

  function renderEntry(entry: ProjectEntry): ReactNode {
    if (entry.kind === "directory") {
      return (
        <FileTreeFolder
          key={`directory:${entry.path}`}
          name={basenameOfPath(entry.path)}
          path={entry.path}
        >
          {renderDirectoryMeta(entry.path)}
        </FileTreeFolder>
      );
    }

    return (
      <FileTreeFile
        key={`file:${entry.path}`}
        icon={
          <VscodeEntryIcon
            className="size-4"
            kind="file"
            pathValue={entry.path}
            theme={resolvedTheme}
          />
        }
        name={basenameOfPath(entry.path)}
        path={entry.path}
      />
    );
  }

  if (!workspaceRoot) {
    return (
      <div className="flex h-full items-center justify-center px-4 py-8 text-center text-sm text-muted-foreground">
        This thread does not have a workspace root yet.
      </div>
    );
  }

  return (
    <ScrollArea className="h-full">
      <div className="flex min-h-full flex-col px-1 pt-0 pb-2">
        <FileTree
          className="h-full rounded-none border-0 bg-transparent text-sidebar-foreground"
          expanded={expandedPaths}
          onExpandedChange={handleExpandedChange}
          onSelect={onSelectPathChange}
          selectedPath={selectedPath}
        >
          {rootStatus === "error" ? (
            <div className="space-y-2 px-2 py-2">
              <p className="text-sm text-rose-600 dark:text-rose-300/90">
                {rootState?.errorMessage}
              </p>
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  void loadDirectory();
                }}
              >
                Reload tree
              </Button>
            </div>
          ) : rootStatus === "loading" && rootEntries.length === 0 ? (
            <div className="px-2 py-2 text-sm text-muted-foreground">Loading workspace…</div>
          ) : rootStatus === "loaded" && rootEntries.length === 0 ? (
            <div className="px-2 py-2 text-sm text-muted-foreground">This workspace is empty.</div>
          ) : (
            rootEntries.map((entry) => renderEntry(entry))
          )}
        </FileTree>
        {rootTruncated ? (
          <div
            className={cn(
              "border-sidebar-border border-t px-3 py-2 text-[11px] text-amber-600 dark:text-amber-300/90",
              rootStatus === "loading" && "opacity-70",
            )}
          >
            The workspace root is truncated to keep the sidebar responsive.
          </div>
        ) : null}
      </div>
    </ScrollArea>
  );
}

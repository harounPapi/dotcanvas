"use client";

import type {
  ProjectReadDocumentFileResult,
  ProjectReadFileResult,
  ProjectReadDelimitedGridFileResult,
  ProjectReadTabularFileResult,
  ProjectReadWorkbookPresentationFileResult,
  ProjectWorkspaceChangeEvent,
} from "@t3tools/contracts";
import { useQueryClient } from "@tanstack/react-query";
import {
  Fragment,
  Suspense,
  lazy,
  startTransition,
  useCallback,
  useEffect,
  useEffectEvent,
  useMemo,
  useRef,
  useState,
} from "react";

import { readNativeApi } from "~/nativeApi";
import {
  projectQueryKeys,
  projectReadDocumentFileQueryOptions,
  projectReadFileQueryOptions,
  projectReadTabularFileQueryOptions,
} from "~/lib/projectReactQuery";
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
import { Separator } from "~/components/ui/separator";
import { Skeleton } from "~/components/ui/skeleton";
import { cn } from "~/lib/utils";

import { RoomMarkdownSurface } from "./RoomMarkdownSurface";
import { documentPreviewLabel } from "./roomDocumentPreview";
import { collectTabularWritePatches, type TabularDraftPatchRecord } from "./roomTabularState";
import {
  classifyRoomFile,
  roomBreadcrumbSegments,
  ROOM_WRITE_CONFLICT_MESSAGE,
  resolveWorkspaceAbsolutePath,
} from "./roomFileUtils";

const LazyRoomTabularSurface = lazy(async () => {
  const module = await import("./RoomTabularSurface");
  return { default: module.RoomTabularSurface };
});

const LazyRoomWorkbookPresentationSurface = lazy(async () => {
  const module = await import("./RoomWorkbookPresentationSurface");
  return { default: module.RoomWorkbookPresentationSurface };
});

const LazyRoomDocumentSurface = lazy(async () => {
  const module = await import("./RoomDocumentSurface");
  return { default: module.RoomDocumentSurface };
});

type LoadedDocumentFileMap = Record<string, ProjectReadDocumentFileResult>;
type LoadedMarkdownFileMap = Record<string, ProjectReadFileResult>;
type LoadedTabularFileMap = Record<string, ProjectReadTabularFileResult>;

type SaveState =
  | { status: "idle" }
  | { status: "saving"; path: string }
  | { status: "error"; path: string; message: string };

function extractStatusMessage(error: unknown, seen = new Set<object>()): string | undefined {
  if (typeof error === "string" && error.trim().length > 0) {
    return error;
  }

  if (error instanceof Error && error.message.trim().length > 0) {
    return error.message;
  }

  if (typeof error !== "object" || error === null) {
    return undefined;
  }

  if (seen.has(error)) {
    return undefined;
  }
  seen.add(error);

  for (const key of ["message", "detail", "error", "cause", "reason"] as const) {
    if (!(key in error)) {
      continue;
    }

    const nestedMessage = extractStatusMessage((error as Record<string, unknown>)[key], seen);
    if (nestedMessage) {
      return nestedMessage;
    }
  }

  return undefined;
}

function statusMessage(error: unknown): string {
  return extractStatusMessage(error) ?? "Unable to open this file.";
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
    message.includes("Document file is too large to open in Room") ||
    message.includes("File is not valid UTF-8 text") ||
    message.includes("File is not a supported text document") ||
    message.includes("File is not a supported document preview") ||
    message.includes("File is not a supported spreadsheet document") ||
    message.includes("Spreadsheet file is too large to open in Room") ||
    message.includes("Spreadsheet has too many") ||
    message.includes("Spreadsheet exceeds the Room preview limits") ||
    message.includes("Spreadsheet workbook does not contain any worksheets") ||
    message.includes("doesn’t appear to contain tabular data") ||
    message.includes("password-protected or encrypted") ||
    message.includes("password-protected or corrupted") ||
    message.includes("Microsoft Word .doc files") ||
    message.includes("Room couldn’t render this PDF document") ||
    message.includes("Room couldn’t render this DOCX document") ||
    message.includes("not currently readable in Room")
  );
}

function isDelimitedGridPreview(
  snapshot: ProjectReadTabularFileResult | undefined,
): snapshot is ProjectReadDelimitedGridFileResult {
  return snapshot?.previewKind === "delimited-grid";
}

function isWorkbookPresentationPreview(
  snapshot: ProjectReadTabularFileResult | undefined,
): snapshot is ProjectReadWorkbookPresentationFileResult {
  return snapshot?.previewKind === "workbook-presentation";
}

function unsupportedFileDescription(input: {
  message: string | undefined;
  selectedPath: string | undefined;
  selectionKind: "markdown" | "tabular" | "document" | "unsupported";
}) {
  if (!input.message) {
    if (input.selectedPath?.toLowerCase().endsWith(".doc")) {
      return "Room supports modern .docx previews here, but legacy .doc files still need to be opened externally or saved as .docx first.";
    }

    switch (input.selectionKind) {
      case "markdown":
        return "Room can edit and preview Markdown files here.";
      case "tabular":
        return "Room can edit delimited table files here, and preview major workbook formats with the best fidelity Room can safely provide.";
      case "document":
        return "Room can preview PDF and DOCX documents here right now.";
      default:
        return "Room can preview Markdown, spreadsheets, PDF files, and DOCX documents here right now.";
    }
  }

  if (input.message.includes("too large")) {
    return "This file is too large for the Room preview right now. Open it in Finder to continue in another app.";
  }
  if (input.message.includes("UTF-8")) {
    return "This file isn’t plain UTF-8 text, so Room can’t safely render it here.";
  }
  if (input.message.includes("too many sheets")) {
    return "This workbook has more worksheets than Room supports in a single preview.";
  }
  if (input.message.includes("too many columns")) {
    return "This spreadsheet has more columns than Room can safely render right now.";
  }
  if (input.message.includes("preview limits")) {
    return "This spreadsheet is larger than Room’s current preview budget, so it falls back to opening externally.";
  }
  if (input.message.includes("doesn’t appear to contain tabular data")) {
    return "This text file doesn’t look like a real table, so Room won’t open it in the spreadsheet surface.";
  }
  if (input.message.includes("password-protected or encrypted")) {
    return "This workbook is password-protected or encrypted, so Room can’t safely preview it here.";
  }
  if (input.message.includes("password-protected or corrupted")) {
    return "This document is password-protected or corrupted, so Room can’t safely preview it here.";
  }
  if (input.message.includes("Microsoft Word .doc files")) {
    return "Legacy Word .doc files aren’t supported in Room yet. Save the file as .docx or open it externally.";
  }
  if (input.message.includes("Room couldn’t render this PDF document")) {
    return "Room couldn’t render this PDF preview reliably, so it falls back to opening externally.";
  }
  if (input.message.includes("Room couldn’t render this DOCX document")) {
    return "Room couldn’t render this DOCX preview reliably, so it falls back to opening externally.";
  }
  if (input.message.includes("not currently readable in Room")) {
    return "This workbook format can’t be parsed safely in Room right now, so it falls back to opening externally.";
  }
  if (input.message.includes("This workbook contains")) {
    return input.message;
  }

  return input.message;
}

function delimiterLabel(delimiter: ProjectReadDelimitedGridFileResult["delimiter"]) {
  switch (delimiter) {
    case "\t":
      return "Tab-delimited";
    case ";":
      return "Semicolon-delimited";
    case "|":
      return "Pipe-delimited";
    default:
      return "Comma-delimited";
  }
}

function tabularPreviewLabel(snapshot: ProjectReadTabularFileResult | undefined) {
  if (!snapshot) {
    return undefined;
  }

  if (snapshot.previewKind === "delimited-grid") {
    switch (snapshot.kind) {
      case "csv":
        return snapshot.delimiter === "," ? "CSV" : `${delimiterLabel(snapshot.delimiter)} CSV`;
      case "tsv":
        return "TSV";
      case "psv":
        return "Pipe-delimited text";
      case "tab":
        return "Tab-delimited text";
      case "txt":
        return `Detected ${delimiterLabel(snapshot.delimiter).toLowerCase()} text`;
      case "dat":
        return `Detected ${delimiterLabel(snapshot.delimiter).toLowerCase()} data`;
      default:
        return undefined;
    }
  }

  return `${snapshot.kind.toUpperCase()} workbook`;
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
  const [markdownDraftsByPath, setMarkdownDraftsByPath] = useState<Record<string, string>>({});
  const [tabularDraftsByPath, setTabularDraftsByPath] = useState<
    Record<string, TabularDraftPatchRecord>
  >({});
  const [errorsByPath, setErrorsByPath] = useState<Record<string, string>>({});
  const [loadedDocumentByPath, setLoadedDocumentByPath] = useState<LoadedDocumentFileMap>({});
  const [loadedMarkdownByPath, setLoadedMarkdownByPath] = useState<LoadedMarkdownFileMap>({});
  const [loadedTabularByPath, setLoadedTabularByPath] = useState<LoadedTabularFileMap>({});
  const [loadingPath, setLoadingPath] = useState<string>();
  const [saveState, setSaveState] = useState<SaveState>({ status: "idle" });
  const [conflictPaths, setConflictPaths] = useState<Record<string, true>>({});
  const [deletedPaths, setDeletedPaths] = useState<Record<string, true>>({});
  const markdownDraftsByPathRef = useRef(markdownDraftsByPath);
  const tabularDraftsByPathRef = useRef(tabularDraftsByPath);
  const loadedDocumentByPathRef = useRef(loadedDocumentByPath);
  const loadedMarkdownByPathRef = useRef(loadedMarkdownByPath);
  const loadedTabularByPathRef = useRef(loadedTabularByPath);
  const deletedPathsRef = useRef(deletedPaths);

  useEffect(() => {
    markdownDraftsByPathRef.current = markdownDraftsByPath;
  }, [markdownDraftsByPath]);

  useEffect(() => {
    tabularDraftsByPathRef.current = tabularDraftsByPath;
  }, [tabularDraftsByPath]);

  useEffect(() => {
    loadedDocumentByPathRef.current = loadedDocumentByPath;
  }, [loadedDocumentByPath]);

  useEffect(() => {
    loadedMarkdownByPathRef.current = loadedMarkdownByPath;
  }, [loadedMarkdownByPath]);

  useEffect(() => {
    loadedTabularByPathRef.current = loadedTabularByPath;
  }, [loadedTabularByPath]);

  useEffect(() => {
    deletedPathsRef.current = deletedPaths;
  }, [deletedPaths]);

  useEffect(() => {
    generationRef.current += 1;
    setMarkdownDraftsByPath({});
    setTabularDraftsByPath({});
    setErrorsByPath({});
    setLoadedDocumentByPath({});
    setLoadedMarkdownByPath({});
    setLoadedTabularByPath({});
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

      if (
        !options?.force &&
        (loadedDocumentByPathRef.current[relativePath] ||
          loadedMarkdownByPathRef.current[relativePath] ||
          loadedTabularByPathRef.current[relativePath])
      ) {
        return;
      }

      const generation = generationRef.current;
      const selectionKind = classifyRoomFile(relativePath);
      setLoadingPath(relativePath);
      setErrorsByPath((current) => omitKey(current, relativePath));

      try {
        if (selectionKind.kind === "document") {
          await queryClient.invalidateQueries({
            queryKey: projectQueryKeys.readDocumentFile(workspaceRoot, relativePath),
          });
          const result = await queryClient.fetchQuery(
            projectReadDocumentFileQueryOptions({
              cwd: workspaceRoot,
              relativePath,
            }),
          );

          if (generationRef.current !== generation) {
            return;
          }

          startTransition(() => {
            setLoadedDocumentByPath((current) => ({
              ...current,
              [relativePath]: result,
            }));
            setLoadedMarkdownByPath((current) => omitKey(current, relativePath));
            setLoadedTabularByPath((current) => omitKey(current, relativePath));
            setMarkdownDraftsByPath((current) => omitKey(current, relativePath));
            setTabularDraftsByPath((current) => omitKey(current, relativePath));
            setConflictPaths((current) => omitKey(current, relativePath));
            setDeletedPaths((current) => omitKey(current, relativePath));
          });
          return;
        }

        if (selectionKind.kind === "markdown") {
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
            setLoadedMarkdownByPath((current) => ({
              ...current,
              [relativePath]: result,
            }));
            setLoadedDocumentByPath((current) => omitKey(current, relativePath));
            setLoadedTabularByPath((current) => omitKey(current, relativePath));
            setMarkdownDraftsByPath((current) => ({
              ...current,
              [relativePath]:
                options?.preserveDraft && current[relativePath] !== undefined
                  ? current[relativePath]
                  : result.contents,
            }));
            setTabularDraftsByPath((current) => omitKey(current, relativePath));
            setConflictPaths((current) => omitKey(current, relativePath));
            setDeletedPaths((current) => omitKey(current, relativePath));
          });
          return;
        }

        if (selectionKind.kind === "tabular") {
          await queryClient.invalidateQueries({
            queryKey: projectQueryKeys.readTabularFile(workspaceRoot, relativePath),
          });
          const result = await queryClient.fetchQuery(
            projectReadTabularFileQueryOptions({
              cwd: workspaceRoot,
              relativePath,
            }),
          );

          if (generationRef.current !== generation) {
            return;
          }

          startTransition(() => {
            setLoadedDocumentByPath((current) => omitKey(current, relativePath));
            setLoadedTabularByPath((current) => ({
              ...current,
              [relativePath]: result,
            }));
            setLoadedMarkdownByPath((current) => omitKey(current, relativePath));
            setTabularDraftsByPath((current) => ({
              ...current,
              [relativePath]:
                result.previewKind === "delimited-grid" &&
                options?.preserveDraft &&
                current[relativePath] !== undefined
                  ? current[relativePath]
                  : {},
            }));
            setMarkdownDraftsByPath((current) => omitKey(current, relativePath));
            setConflictPaths((current) => omitKey(current, relativePath));
            setDeletedPaths((current) => omitKey(current, relativePath));
          });
        }
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

  const selectedRoomFile = useMemo(
    () => (selectedPath ? classifyRoomFile(selectedPath) : { kind: "unsupported" as const }),
    [selectedPath],
  );
  const selectedDocumentFile = selectedPath ? loadedDocumentByPath[selectedPath] : undefined;
  const selectedMarkdownFile = selectedPath ? loadedMarkdownByPath[selectedPath] : undefined;
  const selectedTabularFile = selectedPath ? loadedTabularByPath[selectedPath] : undefined;
  const selectedMarkdownDraft = selectedPath ? markdownDraftsByPath[selectedPath] : undefined;
  const selectedTabularDrafts = selectedPath ? (tabularDraftsByPath[selectedPath] ?? {}) : {};
  const selectedDelimitedGridFile = isDelimitedGridPreview(selectedTabularFile)
    ? selectedTabularFile
    : undefined;
  const selectedWorkbookPreview = isWorkbookPresentationPreview(selectedTabularFile)
    ? selectedTabularFile
    : undefined;
  const selectedDocumentFormatLabel = selectedDocumentFile
    ? documentPreviewLabel(selectedDocumentFile.kind)
    : undefined;
  const selectedTabularFormatLabel = useMemo(
    () => tabularPreviewLabel(selectedTabularFile),
    [selectedTabularFile],
  );
  const selectedError = selectedPath ? errorsByPath[selectedPath] : undefined;
  const selectedBreadcrumbs = useMemo(
    () =>
      workspaceRoot && selectedPath ? roomBreadcrumbSegments(workspaceRoot, selectedPath) : [],
    [selectedPath, workspaceRoot],
  );
  const isMarkdownSelection = selectedRoomFile.kind === "markdown";
  const isDocumentSelection = selectedRoomFile.kind === "document";
  const isTabularSelection = selectedRoomFile.kind === "tabular";
  const isLoadingSelectedFile = selectedPath !== undefined && loadingPath === selectedPath;
  const hasLoadedMarkdown = Boolean(
    isMarkdownSelection && selectedMarkdownFile && selectedMarkdownDraft !== undefined,
  );
  const hasLoadedDocument = Boolean(isDocumentSelection && selectedDocumentFile);
  const hasLoadedTabular = Boolean(isTabularSelection && selectedTabularFile);
  const isEditableTabularSelection = Boolean(selectedDelimitedGridFile?.capabilities.canEditInRoom);
  const hasLoadedSelectedFile = hasLoadedDocument || hasLoadedMarkdown || hasLoadedTabular;
  const isDirty = isMarkdownSelection
    ? selectedMarkdownFile !== undefined &&
      selectedMarkdownDraft !== undefined &&
      selectedMarkdownDraft !== selectedMarkdownFile.contents
    : isTabularSelection
      ? isEditableTabularSelection && Object.keys(selectedTabularDrafts).length > 0
      : false;
  const isSaving = saveState.status === "saving" && saveState.path === selectedPath;
  const saveError =
    saveState.status === "error" && saveState.path === selectedPath ? saveState.message : undefined;
  const hasSaveConflict = selectedPath ? conflictPaths[selectedPath] === true : false;
  const wasDeletedOnDisk = selectedPath ? deletedPaths[selectedPath] === true : false;
  const selectedPreviewLabel = selectedDocumentFormatLabel ?? selectedTabularFormatLabel;
  const shouldShowUnsupportedState =
    selectedPath !== undefined &&
    (selectedRoomFile.kind === "unsupported" ||
      isUnsupportedRoomFileMessage(selectedError) ||
      selectedWorkbookPreview?.unsupportedVisualReason !== undefined);
  const showLoadingPlaceholder = isLoadingSelectedFile && !hasLoadedSelectedFile;

  useEffect(() => {
    if (
      !visible ||
      !workspaceRoot ||
      !selectedPath ||
      selectedRoomFile.kind === "unsupported" ||
      hasLoadedSelectedFile
    ) {
      return;
    }

    void loadFile(selectedPath, { preserveDraft: true });
  }, [hasLoadedSelectedFile, selectedPath, selectedRoomFile.kind, visible, workspaceRoot]);

  const handleWorkspaceChange = useEffectEvent((event: ProjectWorkspaceChangeEvent) => {
    if (!visible || !workspaceRoot || event._tag !== "pathChanged") {
      return;
    }

    const changedPath = event.relativePath;
    const currentLoadedDocument = loadedDocumentByPathRef.current[changedPath];
    const currentLoadedMarkdown = loadedMarkdownByPathRef.current[changedPath];
    const currentLoadedTabular = loadedTabularByPathRef.current[changedPath];
    const currentMarkdownDraft = markdownDraftsByPathRef.current[changedPath];
    const currentTabularDrafts = tabularDraftsByPathRef.current[changedPath];
    const hasDirtyMarkdownDraft =
      currentLoadedMarkdown !== undefined &&
      currentMarkdownDraft !== undefined &&
      currentMarkdownDraft !== currentLoadedMarkdown.contents;
    const hasDirtyTabularDraft =
      isDelimitedGridPreview(currentLoadedTabular) &&
      currentTabularDrafts !== undefined &&
      Object.keys(currentTabularDrafts).length > 0;
    const hasDirtyDraft = hasDirtyMarkdownDraft || hasDirtyTabularDraft;
    const isSelectedFile = changedPath === selectedPath;

    if (isSelectedFile) {
      if (currentLoadedDocument) {
        if (!event.exists) {
          startTransition(() => {
            setLoadedDocumentByPath((current) => omitKey(current, changedPath));
            setErrorsByPath((current) => ({
              ...omitKey(current, changedPath),
              [changedPath]: `File does not exist: ${changedPath}`,
            }));
            setConflictPaths((current) => omitKey(current, changedPath));
            setDeletedPaths((current) => omitKey(current, changedPath));
          });
          return;
        }

        void loadFile(changedPath, { force: true, preserveDraft: false });
        return;
      }

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

    if (
      !currentLoadedDocument &&
      !currentLoadedMarkdown &&
      !currentLoadedTabular &&
      currentMarkdownDraft === undefined &&
      currentTabularDrafts === undefined
    ) {
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

      setLoadedDocumentByPath((current) => omitKey(current, changedPath));
      setLoadedMarkdownByPath((current) => omitKey(current, changedPath));
      setLoadedTabularByPath((current) => omitKey(current, changedPath));
      setMarkdownDraftsByPath((current) => omitKey(current, changedPath));
      setTabularDraftsByPath((current) => omitKey(current, changedPath));
      setConflictPaths((current) => omitKey(current, changedPath));
      setDeletedPaths((current) => omitKey(current, changedPath));
    });
  });

  useEffect(() => {
    return subscribeToWorkspaceChanges((event) => {
      handleWorkspaceChange(event);
    });
  }, [subscribeToWorkspaceChanges]);

  const handleMarkdownDraftChange = useCallback(
    (nextValue: string) => {
      if (!selectedPath) {
        return;
      }
      setMarkdownDraftsByPath((current) => ({
        ...current,
        [selectedPath]: nextValue,
      }));
      setSaveState((current) =>
        current.status === "error" && current.path === selectedPath ? { status: "idle" } : current,
      );
    },
    [selectedPath],
  );

  const handleDocumentPreviewError = useCallback(
    (message: string) => {
      if (!selectedPath) {
        return;
      }

      setErrorsByPath((current) => ({
        ...current,
        [selectedPath]: message,
      }));
    },
    [selectedPath],
  );

  const handleTabularDraftEdits = useCallback(
    (updater: (current: TabularDraftPatchRecord) => TabularDraftPatchRecord) => {
      if (!selectedPath) {
        return;
      }

      setTabularDraftsByPath((current) => ({
        ...current,
        [selectedPath]: updater(current[selectedPath] ?? {}),
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
    if (!selectedPath || !workspaceRoot) {
      return;
    }

    const api = readNativeApi();
    if (!api) {
      return;
    }

    setSaveState({ status: "saving", path: selectedPath });

    try {
      if (selectedRoomFile.kind === "markdown") {
        if (!selectedMarkdownFile || selectedMarkdownDraft === undefined) {
          return;
        }

        await api.projects.writeFile({
          cwd: workspaceRoot,
          relativePath: selectedPath,
          contents: selectedMarkdownDraft,
          ...(mode === "checked" && !deletedPathsRef.current[selectedPath]
            ? { expectedMtimeMs: selectedMarkdownFile.mtimeMs }
            : {}),
        });

        const refreshed = await api.projects.readFile({
          cwd: workspaceRoot,
          relativePath: selectedPath,
        });

        startTransition(() => {
          setLoadedMarkdownByPath((current) => ({
            ...current,
            [selectedPath]: refreshed,
          }));
          setMarkdownDraftsByPath((current) => ({
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
        return;
      }

      if (selectedRoomFile.kind === "tabular") {
        if (!selectedDelimitedGridFile) {
          return;
        }

        await api.projects.writeTabularFile({
          cwd: workspaceRoot,
          relativePath: selectedPath,
          patches: collectTabularWritePatches({
            snapshot: selectedDelimitedGridFile,
            draftPatches: selectedTabularDrafts,
            includeFullSnapshot: mode === "force" && deletedPathsRef.current[selectedPath] === true,
          }),
          ...(mode === "checked" && !deletedPathsRef.current[selectedPath]
            ? { expectedMtimeMs: selectedDelimitedGridFile.mtimeMs }
            : {}),
        });

        const refreshed = await api.projects.readTabularFile({
          cwd: workspaceRoot,
          relativePath: selectedPath,
        });

        startTransition(() => {
          setLoadedTabularByPath((current) => ({
            ...current,
            [selectedPath]: refreshed,
          }));
          setTabularDraftsByPath((current) => ({
            ...current,
            [selectedPath]: {},
          }));
          setErrorsByPath((current) => omitKey(current, selectedPath));
          setConflictPaths((current) => omitKey(current, selectedPath));
          setDeletedPaths((current) => omitKey(current, selectedPath));
          setSaveState({ status: "idle" });
        });
        await queryClient.invalidateQueries({
          queryKey: projectQueryKeys.readTabularFile(workspaceRoot, selectedPath),
        });
      }
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
    if (selectedDocumentFile || selectedWorkbookPreview) {
      return undefined;
    }
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
    if (hasLoadedMarkdown || hasLoadedTabular) {
      return "Saved";
    }
    return undefined;
  }, [
    hasLoadedMarkdown,
    hasLoadedTabular,
    hasSaveConflict,
    isDirty,
    isSaving,
    saveError,
    selectedDocumentFile,
    selectedWorkbookPreview,
    wasDeletedOnDisk,
  ]);

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
          {selectedRoomFile.kind !== "unsupported" && selectedPreviewLabel ? (
            <div className="flex shrink-0 items-center gap-2">
              <span className="max-w-56 truncate text-[11px] text-muted-foreground">
                {selectedPreviewLabel}
              </span>
              {selectedRoomFile.kind === "markdown" ||
              (selectedRoomFile.kind === "tabular" && !selectedWorkbookPreview) ? (
                <>
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
                    disabled={!hasLoadedSelectedFile || !isDirty || isSaving}
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
                </>
              ) : null}
            </div>
          ) : selectedRoomFile.kind === "markdown" ? (
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
                disabled={!hasLoadedSelectedFile || !isDirty || isSaving}
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
                  ? "This file was removed outside Room. Your draft is still here, and saving will recreate it from the visible data."
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

        {selectedPath &&
        selectedWorkbookPreview &&
        selectedWorkbookPreview.presentationFidelity === "partial" &&
        selectedWorkbookPreview.previewNotices.length > 0 ? (
          <Alert className="m-5 mb-4" variant="warning">
            <InfoIcon />
            <AlertTitle>Simplified Workbook Preview</AlertTitle>
            <AlertDescription>{selectedWorkbookPreview.previewNotices.join(" ")}</AlertDescription>
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
                {unsupportedFileDescription({
                  message: selectedError ?? selectedWorkbookPreview?.unsupportedVisualReason,
                  selectedPath,
                  selectionKind: selectedRoomFile.kind,
                })}
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
        selectedError &&
        !isUnsupportedRoomFileMessage(selectedError) &&
        selectedRoomFile.kind !== "unsupported" ? (
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
              onChange={handleMarkdownDraftChange}
              onSave={() => {
                void saveSelectedFile("checked");
              }}
              resolvedTheme={resolvedTheme}
              value={selectedMarkdownDraft ?? selectedMarkdownFile?.contents ?? ""}
            />
          </div>
        ) : null}

        {selectedPath && hasLoadedTabular && selectedDelimitedGridFile ? (
          <div className="min-h-0 flex-1">
            <Suspense
              fallback={
                <div className="flex h-full items-center justify-center gap-2 text-sm text-muted-foreground">
                  <Loader2Icon className="size-4 animate-spin" />
                  Preparing spreadsheet preview...
                </div>
              }
            >
              <LazyRoomTabularSurface
                draftPatches={selectedTabularDrafts}
                key={selectedPath}
                onDraftEdits={handleTabularDraftEdits}
                resolvedTheme={resolvedTheme}
                snapshot={selectedDelimitedGridFile}
              />
            </Suspense>
          </div>
        ) : null}

        {selectedPath && hasLoadedTabular && selectedWorkbookPreview ? (
          <div className="min-h-0 flex-1">
            <Suspense
              fallback={
                <div className="flex h-full items-center justify-center gap-2 text-sm text-muted-foreground">
                  <Loader2Icon className="size-4 animate-spin" />
                  Preparing workbook preview...
                </div>
              }
            >
              <LazyRoomWorkbookPresentationSurface
                key={selectedPath}
                resolvedTheme={resolvedTheme}
                snapshot={selectedWorkbookPreview}
                workspaceRoot={workspaceRoot ?? ""}
              />
            </Suspense>
          </div>
        ) : null}

        {selectedPath &&
        hasLoadedDocument &&
        selectedDocumentFile &&
        !selectedError &&
        !shouldShowUnsupportedState ? (
          <div className="min-h-0 flex-1">
            <Suspense
              fallback={
                <div className="flex h-full items-center justify-center gap-2 text-sm text-muted-foreground">
                  <Loader2Icon className="size-4 animate-spin" />
                  Preparing document preview...
                </div>
              }
            >
              <LazyRoomDocumentSurface
                key={`${selectedPath}:${selectedDocumentFile.mtimeMs}`}
                onPreviewError={handleDocumentPreviewError}
                snapshot={selectedDocumentFile}
              />
            </Suspense>
          </div>
        ) : null}

        {selectedPath &&
        !showLoadingPlaceholder &&
        !shouldShowUnsupportedState &&
        !selectedError &&
        !hasLoadedSelectedFile ? (
          <div className="flex h-full items-center justify-center gap-2 text-sm text-muted-foreground">
            <InfoIcon className="size-4" />
            Preparing this file...
          </div>
        ) : null}
      </div>
    </div>
  );
}

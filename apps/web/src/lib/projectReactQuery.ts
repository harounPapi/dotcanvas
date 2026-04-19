import type {
  ProjectListDirectoryResult,
  ProjectReadDocumentFileResult,
  ProjectReadFileResult,
  ProjectReadTabularFileResult,
  ProjectSearchEntriesResult,
} from "@t3tools/contracts";
import { queryOptions } from "@tanstack/react-query";
import { ensureNativeApi } from "~/nativeApi";

export const projectQueryKeys = {
  all: ["projects"] as const,
  listDirectory: (cwd: string | null, directoryPath: string | null) =>
    ["projects", "list-directory", cwd, directoryPath ?? "__root__"] as const,
  readDocumentFile: (cwd: string | null, relativePath: string | null) =>
    ["projects", "read-document-file", cwd, relativePath] as const,
  readFile: (cwd: string | null, relativePath: string | null) =>
    ["projects", "read-file", cwd, relativePath] as const,
  readTabularFile: (cwd: string | null, relativePath: string | null) =>
    ["projects", "read-tabular-file", cwd, relativePath] as const,
  searchEntries: (cwd: string | null, query: string, limit: number) =>
    ["projects", "search-entries", cwd, query, limit] as const,
};

const DEFAULT_LIST_DIRECTORY_STALE_TIME = 15_000;
const DEFAULT_READ_FILE_STALE_TIME = 0;
const DEFAULT_SEARCH_ENTRIES_LIMIT = 80;
const DEFAULT_SEARCH_ENTRIES_STALE_TIME = 15_000;
const EMPTY_LIST_DIRECTORY_RESULT: ProjectListDirectoryResult = {
  entries: [],
  truncated: false,
};
const EMPTY_READ_FILE_RESULT: ProjectReadFileResult = {
  relativePath: "",
  contents: "",
  sizeBytes: 0,
  mtimeMs: 0,
};
const EMPTY_READ_DOCUMENT_FILE_RESULT: ProjectReadDocumentFileResult = {
  relativePath: "",
  kind: "pdf",
  sizeBytes: 0,
  mtimeMs: 0,
  mimeType: "application/pdf",
  capabilities: { canEditInRoom: false },
  contentBase64: "AA==",
};
const EMPTY_READ_TABULAR_FILE_RESULT: ProjectReadTabularFileResult = {
  relativePath: "",
  previewKind: "delimited-grid",
  kind: "csv",
  delimiter: ",",
  sizeBytes: 0,
  mtimeMs: 0,
  capabilities: { canEditInRoom: true },
  sheets: [],
};
const EMPTY_SEARCH_ENTRIES_RESULT: ProjectSearchEntriesResult = {
  entries: [],
  truncated: false,
};

export function projectListDirectoryQueryOptions(input: {
  cwd: string | null;
  directoryPath?: string;
  staleTime?: number;
}) {
  return queryOptions({
    queryKey: projectQueryKeys.listDirectory(input.cwd, input.directoryPath ?? null),
    queryFn: async () => {
      const api = ensureNativeApi();
      if (!input.cwd) {
        throw new Error("Workspace directory listing is unavailable.");
      }
      return api.projects.listDirectory({
        cwd: input.cwd,
        ...(input.directoryPath ? { directoryPath: input.directoryPath } : {}),
      });
    },
    staleTime: input.staleTime ?? DEFAULT_LIST_DIRECTORY_STALE_TIME,
    placeholderData: (previous) => previous ?? EMPTY_LIST_DIRECTORY_RESULT,
  });
}

export function projectReadFileQueryOptions(input: {
  cwd: string | null;
  relativePath: string | null;
  staleTime?: number;
}) {
  return queryOptions({
    queryKey: projectQueryKeys.readFile(input.cwd, input.relativePath),
    queryFn: async () => {
      const api = ensureNativeApi();
      if (!input.cwd || !input.relativePath) {
        throw new Error("Workspace file reading is unavailable.");
      }
      return api.projects.readFile({
        cwd: input.cwd,
        relativePath: input.relativePath,
      });
    },
    staleTime: input.staleTime ?? DEFAULT_READ_FILE_STALE_TIME,
    placeholderData: (previous) => previous ?? EMPTY_READ_FILE_RESULT,
  });
}

export function projectReadDocumentFileQueryOptions(input: {
  cwd: string | null;
  relativePath: string | null;
  staleTime?: number;
}) {
  return queryOptions({
    queryKey: projectQueryKeys.readDocumentFile(input.cwd, input.relativePath),
    queryFn: async () => {
      const api = ensureNativeApi();
      if (!input.cwd || !input.relativePath) {
        throw new Error("Workspace document reading is unavailable.");
      }
      return api.projects.readDocumentFile({
        cwd: input.cwd,
        relativePath: input.relativePath,
      });
    },
    staleTime: input.staleTime ?? DEFAULT_READ_FILE_STALE_TIME,
    placeholderData: (previous) => previous ?? EMPTY_READ_DOCUMENT_FILE_RESULT,
  });
}

export function projectReadTabularFileQueryOptions(input: {
  cwd: string | null;
  relativePath: string | null;
  staleTime?: number;
}) {
  return queryOptions({
    queryKey: projectQueryKeys.readTabularFile(input.cwd, input.relativePath),
    queryFn: async () => {
      const api = ensureNativeApi();
      if (!input.cwd || !input.relativePath) {
        throw new Error("Workspace spreadsheet reading is unavailable.");
      }
      return api.projects.readTabularFile({
        cwd: input.cwd,
        relativePath: input.relativePath,
      });
    },
    staleTime: input.staleTime ?? DEFAULT_READ_FILE_STALE_TIME,
    placeholderData: (previous) => previous ?? EMPTY_READ_TABULAR_FILE_RESULT,
  });
}

export function projectSearchEntriesQueryOptions(input: {
  cwd: string | null;
  query: string;
  enabled?: boolean;
  limit?: number;
  staleTime?: number;
}) {
  const limit = input.limit ?? DEFAULT_SEARCH_ENTRIES_LIMIT;
  return queryOptions({
    queryKey: projectQueryKeys.searchEntries(input.cwd, input.query, limit),
    queryFn: async () => {
      const api = ensureNativeApi();
      if (!input.cwd) {
        throw new Error("Workspace entry search is unavailable.");
      }
      return api.projects.searchEntries({
        cwd: input.cwd,
        query: input.query,
        limit,
      });
    },
    enabled: (input.enabled ?? true) && input.cwd !== null && input.query.length > 0,
    staleTime: input.staleTime ?? DEFAULT_SEARCH_ENTRIES_STALE_TIME,
    placeholderData: (previous) => previous ?? EMPTY_SEARCH_ENTRIES_RESULT,
  });
}

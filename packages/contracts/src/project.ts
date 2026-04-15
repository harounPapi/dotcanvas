import { Schema } from "effect";
import {
  NonNegativeInt,
  PositiveInt,
  ProjectId,
  ThreadId,
  TrimmedNonEmptyString,
} from "./baseSchemas";

const PROJECT_SEARCH_ENTRIES_MAX_LIMIT = 200;
const PROJECT_WRITE_FILE_PATH_MAX_LENGTH = 512;
const PROJECT_DIRECTORY_NAME_MAX_LENGTH = 255;
export const PROJECT_READ_FILE_MAX_BYTES = 512 * 1024;

export const ProjectSearchEntriesInput = Schema.Struct({
  cwd: TrimmedNonEmptyString,
  query: TrimmedNonEmptyString.check(Schema.isMaxLength(256)),
  limit: PositiveInt.check(Schema.isLessThanOrEqualTo(PROJECT_SEARCH_ENTRIES_MAX_LIMIT)),
});
export type ProjectSearchEntriesInput = typeof ProjectSearchEntriesInput.Type;

export const ProjectEntryKind = Schema.Literals(["file", "directory"]);
export type ProjectEntryKind = typeof ProjectEntryKind.Type;

export const ProjectEntry = Schema.Struct({
  path: TrimmedNonEmptyString,
  kind: ProjectEntryKind,
  parentPath: Schema.optional(TrimmedNonEmptyString),
});
export type ProjectEntry = typeof ProjectEntry.Type;

export const ProjectListDirectoryInput = Schema.Struct({
  cwd: TrimmedNonEmptyString,
  directoryPath: Schema.optional(
    TrimmedNonEmptyString.check(Schema.isMaxLength(PROJECT_WRITE_FILE_PATH_MAX_LENGTH)),
  ),
});
export type ProjectListDirectoryInput = typeof ProjectListDirectoryInput.Type;

export const ProjectListDirectoryResult = Schema.Struct({
  entries: Schema.Array(ProjectEntry),
  truncated: Schema.Boolean,
});
export type ProjectListDirectoryResult = typeof ProjectListDirectoryResult.Type;

export class ProjectListDirectoryError extends Schema.TaggedErrorClass<ProjectListDirectoryError>()(
  "ProjectListDirectoryError",
  {
    message: TrimmedNonEmptyString,
    cause: Schema.optional(Schema.Defect),
  },
) {}

export const ProjectSearchEntriesResult = Schema.Struct({
  entries: Schema.Array(ProjectEntry),
  truncated: Schema.Boolean,
});
export type ProjectSearchEntriesResult = typeof ProjectSearchEntriesResult.Type;

export class ProjectSearchEntriesError extends Schema.TaggedErrorClass<ProjectSearchEntriesError>()(
  "ProjectSearchEntriesError",
  {
    message: TrimmedNonEmptyString,
    cause: Schema.optional(Schema.Defect),
  },
) {}

export const ProjectWriteFileInput = Schema.Struct({
  cwd: TrimmedNonEmptyString,
  relativePath: TrimmedNonEmptyString.check(Schema.isMaxLength(PROJECT_WRITE_FILE_PATH_MAX_LENGTH)),
  contents: Schema.String,
  expectedMtimeMs: Schema.optional(NonNegativeInt),
});
export type ProjectWriteFileInput = typeof ProjectWriteFileInput.Type;

export const ProjectWriteFileResult = Schema.Struct({
  relativePath: TrimmedNonEmptyString,
});
export type ProjectWriteFileResult = typeof ProjectWriteFileResult.Type;

export class ProjectWriteFileError extends Schema.TaggedErrorClass<ProjectWriteFileError>()(
  "ProjectWriteFileError",
  {
    message: TrimmedNonEmptyString,
    cause: Schema.optional(Schema.Defect),
  },
) {}

export const ProjectReadFileInput = Schema.Struct({
  cwd: TrimmedNonEmptyString,
  relativePath: TrimmedNonEmptyString.check(Schema.isMaxLength(PROJECT_WRITE_FILE_PATH_MAX_LENGTH)),
});
export type ProjectReadFileInput = typeof ProjectReadFileInput.Type;

export const ProjectReadFileResult = Schema.Struct({
  relativePath: TrimmedNonEmptyString,
  contents: Schema.String,
  sizeBytes: NonNegativeInt,
  mtimeMs: NonNegativeInt,
});
export type ProjectReadFileResult = typeof ProjectReadFileResult.Type;

export class ProjectReadFileError extends Schema.TaggedErrorClass<ProjectReadFileError>()(
  "ProjectReadFileError",
  {
    message: TrimmedNonEmptyString,
    cause: Schema.optional(Schema.Defect),
  },
) {}

export const ProjectWorkspaceWatchInput = Schema.Struct({
  cwd: TrimmedNonEmptyString,
  directoryPaths: Schema.optional(
    Schema.Array(
      TrimmedNonEmptyString.check(Schema.isMaxLength(PROJECT_WRITE_FILE_PATH_MAX_LENGTH)),
    ),
  ),
  selectedFilePath: Schema.optional(
    TrimmedNonEmptyString.check(Schema.isMaxLength(PROJECT_WRITE_FILE_PATH_MAX_LENGTH)),
  ),
});
export type ProjectWorkspaceWatchInput = typeof ProjectWorkspaceWatchInput.Type;

export const ProjectWorkspacePathChangedEvent = Schema.Struct({
  _tag: Schema.Literal("pathChanged"),
  relativePath: TrimmedNonEmptyString,
  exists: Schema.Boolean,
  entryKind: Schema.optional(ProjectEntryKind),
});
export type ProjectWorkspacePathChangedEvent = typeof ProjectWorkspacePathChangedEvent.Type;

export const ProjectWorkspaceDirectoryInvalidatedEvent = Schema.Struct({
  _tag: Schema.Literal("directoryInvalidated"),
  directoryPath: Schema.optional(TrimmedNonEmptyString),
});
export type ProjectWorkspaceDirectoryInvalidatedEvent =
  typeof ProjectWorkspaceDirectoryInvalidatedEvent.Type;

export const ProjectWorkspaceChangeEvent = Schema.Union([
  ProjectWorkspacePathChangedEvent,
  ProjectWorkspaceDirectoryInvalidatedEvent,
]);
export type ProjectWorkspaceChangeEvent = typeof ProjectWorkspaceChangeEvent.Type;

export class ProjectWorkspaceWatchError extends Schema.TaggedErrorClass<ProjectWorkspaceWatchError>()(
  "ProjectWorkspaceWatchError",
  {
    message: TrimmedNonEmptyString,
    cause: Schema.optional(Schema.Defect),
  },
) {}

export const ProjectStatPathInput = Schema.Struct({
  cwd: TrimmedNonEmptyString,
  relativePath: TrimmedNonEmptyString.check(Schema.isMaxLength(PROJECT_WRITE_FILE_PATH_MAX_LENGTH)),
});
export type ProjectStatPathInput = typeof ProjectStatPathInput.Type;

export const ProjectStatPathResult = Schema.Struct({
  relativePath: TrimmedNonEmptyString,
  exists: Schema.Boolean,
  kind: Schema.optional(ProjectEntryKind),
});
export type ProjectStatPathResult = typeof ProjectStatPathResult.Type;

export class ProjectStatPathError extends Schema.TaggedErrorClass<ProjectStatPathError>()(
  "ProjectStatPathError",
  {
    message: TrimmedNonEmptyString,
    cause: Schema.optional(Schema.Defect),
  },
) {}

export const ProjectCreateDirectoryInput = Schema.Struct({
  parentPath: TrimmedNonEmptyString,
  directoryName: TrimmedNonEmptyString.check(
    Schema.isMaxLength(PROJECT_DIRECTORY_NAME_MAX_LENGTH),
    Schema.isPattern(/^[^/\\]+$/),
  ),
});
export type ProjectCreateDirectoryInput = typeof ProjectCreateDirectoryInput.Type;

export const ProjectCreateDirectoryResult = Schema.Struct({
  workspaceRoot: TrimmedNonEmptyString,
});
export type ProjectCreateDirectoryResult = typeof ProjectCreateDirectoryResult.Type;

export class ProjectCreateDirectoryError extends Schema.TaggedErrorClass<ProjectCreateDirectoryError>()(
  "ProjectCreateDirectoryError",
  {
    message: TrimmedNonEmptyString,
    cause: Schema.optional(Schema.Defect),
  },
) {}

export const ProjectBootstrapStartInput = Schema.Struct({
  parentPath: TrimmedNonEmptyString,
  projectName: TrimmedNonEmptyString.check(
    Schema.isMaxLength(PROJECT_DIRECTORY_NAME_MAX_LENGTH),
    Schema.isPattern(/^[^/\\]+$/),
  ),
});
export type ProjectBootstrapStartInput = typeof ProjectBootstrapStartInput.Type;

export const ProjectBootstrapStartResult = Schema.Struct({
  projectId: ProjectId,
  threadId: ThreadId,
  workspaceRoot: TrimmedNonEmptyString,
});
export type ProjectBootstrapStartResult = typeof ProjectBootstrapStartResult.Type;

export class ProjectBootstrapStartError extends Schema.TaggedErrorClass<ProjectBootstrapStartError>()(
  "ProjectBootstrapStartError",
  {
    message: TrimmedNonEmptyString,
    cause: Schema.optional(Schema.Defect),
  },
) {}

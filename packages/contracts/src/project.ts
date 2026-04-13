import { Schema } from "effect";
import { PositiveInt, ProjectId, ThreadId, TrimmedNonEmptyString } from "./baseSchemas";

const PROJECT_SEARCH_ENTRIES_MAX_LIMIT = 200;
const PROJECT_WRITE_FILE_PATH_MAX_LENGTH = 512;
const PROJECT_DIRECTORY_NAME_MAX_LENGTH = 255;

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

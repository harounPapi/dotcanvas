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
export const PROJECT_TABULAR_READ_FILE_MAX_BYTES = 8 * 1024 * 1024;
export const PROJECT_DOCUMENT_READ_FILE_MAX_BYTES = 16 * 1024 * 1024;
export const PROJECT_TABULAR_MAX_SHEETS = 32;
export const PROJECT_TABULAR_MAX_COLUMNS = 256;
export const PROJECT_TABULAR_MAX_TOTAL_CELLS = 200_000;

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

export const ProjectDocumentFileKind = Schema.Literals(["pdf", "docx"]);
export type ProjectDocumentFileKind = typeof ProjectDocumentFileKind.Type;

export const ProjectReadDocumentFileInput = Schema.Struct({
  cwd: TrimmedNonEmptyString,
  relativePath: TrimmedNonEmptyString.check(Schema.isMaxLength(PROJECT_WRITE_FILE_PATH_MAX_LENGTH)),
});
export type ProjectReadDocumentFileInput = typeof ProjectReadDocumentFileInput.Type;

export const ProjectDocumentPreviewCapabilities = Schema.Struct({
  canEditInRoom: Schema.Literal(false),
});
export type ProjectDocumentPreviewCapabilities = typeof ProjectDocumentPreviewCapabilities.Type;

export const ProjectReadDocumentFileResult = Schema.Struct({
  relativePath: TrimmedNonEmptyString,
  kind: ProjectDocumentFileKind,
  sizeBytes: NonNegativeInt,
  mtimeMs: NonNegativeInt,
  mimeType: TrimmedNonEmptyString,
  capabilities: ProjectDocumentPreviewCapabilities,
  contentBase64: TrimmedNonEmptyString,
});
export type ProjectReadDocumentFileResult = typeof ProjectReadDocumentFileResult.Type;

export class ProjectReadDocumentFileError extends Schema.TaggedErrorClass<ProjectReadDocumentFileError>()(
  "ProjectReadDocumentFileError",
  {
    message: TrimmedNonEmptyString,
    cause: Schema.optional(Schema.Defect),
  },
) {}

export const ProjectDelimitedTabularFileKind = Schema.Literals([
  "csv",
  "tsv",
  "psv",
  "tab",
  "txt",
  "dat",
]);
export type ProjectDelimitedTabularFileKind = typeof ProjectDelimitedTabularFileKind.Type;

export const ProjectWorkbookTabularFileKind = Schema.Literals([
  "xlsx",
  "xlsm",
  "xlsb",
  "xls",
  "ods",
  "fods",
]);
export type ProjectWorkbookTabularFileKind = typeof ProjectWorkbookTabularFileKind.Type;

export const ProjectTabularFileKind = Schema.Union([
  ProjectDelimitedTabularFileKind,
  ProjectWorkbookTabularFileKind,
]);
export type ProjectTabularFileKind = typeof ProjectTabularFileKind.Type;

export const ProjectTabularDelimiter = Schema.Literals([",", "\t", ";", "|"]);
export type ProjectTabularDelimiter = typeof ProjectTabularDelimiter.Type;

export const ProjectTabularCellValueKind = Schema.Literals([
  "empty",
  "text",
  "number",
  "boolean",
  "date",
]);
export type ProjectTabularCellValueKind = typeof ProjectTabularCellValueKind.Type;

export const ProjectTabularCellReadOnlyReason = Schema.Literals([
  "formula",
  "merged-child",
  "unsupported",
]);
export type ProjectTabularCellReadOnlyReason = typeof ProjectTabularCellReadOnlyReason.Type;

export const ProjectTabularCellValue = Schema.NullOr(
  Schema.Union([Schema.String, Schema.Finite, Schema.Boolean]),
);
export type ProjectTabularCellValue = typeof ProjectTabularCellValue.Type;

export const ProjectTabularSheetMerge = Schema.Struct({
  row: NonNegativeInt,
  col: NonNegativeInt,
  rowspan: PositiveInt,
  colspan: PositiveInt,
});
export type ProjectTabularSheetMerge = typeof ProjectTabularSheetMerge.Type;

export const ProjectTabularSheetFrozenPane = Schema.Struct({
  rowCount: NonNegativeInt,
  columnCount: NonNegativeInt,
});
export type ProjectTabularSheetFrozenPane = typeof ProjectTabularSheetFrozenPane.Type;

export const ProjectTabularSheetCellMeta = Schema.Struct({
  row: NonNegativeInt,
  col: NonNegativeInt,
  valueKind: ProjectTabularCellValueKind,
  readOnlyReason: Schema.optional(ProjectTabularCellReadOnlyReason),
});
export type ProjectTabularSheetCellMeta = typeof ProjectTabularSheetCellMeta.Type;

export const ProjectDelimitedGridSheet = Schema.Struct({
  name: TrimmedNonEmptyString.check(Schema.isMaxLength(PROJECT_DIRECTORY_NAME_MAX_LENGTH)),
  rowCount: NonNegativeInt,
  columnCount: NonNegativeInt,
  data: Schema.Array(Schema.Array(ProjectTabularCellValue)),
  merges: Schema.Array(ProjectTabularSheetMerge),
  hiddenRows: Schema.Array(NonNegativeInt),
  hiddenColumns: Schema.Array(NonNegativeInt),
  frozenPane: Schema.optional(ProjectTabularSheetFrozenPane),
  cellMeta: Schema.Array(ProjectTabularSheetCellMeta),
});
export type ProjectDelimitedGridSheet = typeof ProjectDelimitedGridSheet.Type;

export const ProjectTabularSheet = ProjectDelimitedGridSheet;
export type ProjectTabularSheet = ProjectDelimitedGridSheet;

export const ProjectTabularPreviewKind = Schema.Literals([
  "delimited-grid",
  "workbook-presentation",
]);
export type ProjectTabularPreviewKind = typeof ProjectTabularPreviewKind.Type;

export const ProjectPreviewCapabilities = Schema.Struct({
  canEditInRoom: Schema.Boolean,
});
export type ProjectPreviewCapabilities = typeof ProjectPreviewCapabilities.Type;

export const ProjectDelimitedGridPreviewCapabilities = Schema.Struct({
  canEditInRoom: Schema.Literal(true),
});
export type ProjectDelimitedGridPreviewCapabilities =
  typeof ProjectDelimitedGridPreviewCapabilities.Type;

export const ProjectWorkbookPresentationPreviewCapabilities = Schema.Struct({
  canEditInRoom: Schema.Literal(false),
});
export type ProjectWorkbookPresentationPreviewCapabilities =
  typeof ProjectWorkbookPresentationPreviewCapabilities.Type;

export const ProjectWorkbookPresentationFidelity = Schema.Literals(["full", "partial"]);
export type ProjectWorkbookPresentationFidelity = typeof ProjectWorkbookPresentationFidelity.Type;

export const ProjectWorkbookDateSystem = Schema.Literals(["1900", "1904"]);
export type ProjectWorkbookDateSystem = typeof ProjectWorkbookDateSystem.Type;

export const ProjectWorkbookTheme = Schema.Struct({
  name: Schema.optional(TrimmedNonEmptyString),
  colors: Schema.Record(Schema.String, Schema.String),
  majorLatinFont: Schema.optional(TrimmedNonEmptyString),
  minorLatinFont: Schema.optional(TrimmedNonEmptyString),
});
export type ProjectWorkbookTheme = typeof ProjectWorkbookTheme.Type;

export const ProjectWorkbookStyleAtlasEntry = Schema.Struct({
  declarations: Schema.Record(Schema.String, Schema.String),
});
export type ProjectWorkbookStyleAtlasEntry = typeof ProjectWorkbookStyleAtlasEntry.Type;

export const ProjectWorkbookSheetState = Schema.Literals(["visible", "hidden", "veryHidden"]);
export type ProjectWorkbookSheetState = typeof ProjectWorkbookSheetState.Type;

export const ProjectWorkbookComment = Schema.Struct({
  row: NonNegativeInt,
  col: NonNegativeInt,
  text: Schema.String,
});
export type ProjectWorkbookComment = typeof ProjectWorkbookComment.Type;

export const ProjectWorkbookEmbeddedImage = Schema.Struct({
  mediaId: TrimmedNonEmptyString,
  leftPx: Schema.Finite,
  topPx: Schema.Finite,
  widthPx: Schema.Finite,
  heightPx: Schema.Finite,
});
export type ProjectWorkbookEmbeddedImage = typeof ProjectWorkbookEmbeddedImage.Type;

export const ProjectWorkbookConditionalOverlay = Schema.Struct({
  row: NonNegativeInt,
  col: NonNegativeInt,
  styleId: Schema.optional(NonNegativeInt),
  dataBarFillPercent: Schema.optional(Schema.Finite),
  dataBarColor: Schema.optional(TrimmedNonEmptyString),
  dataBarDirection: Schema.optional(Schema.Literals(["leftToRight", "rightToLeft"])),
  iconKey: Schema.optional(TrimmedNonEmptyString),
  iconColor: Schema.optional(TrimmedNonEmptyString),
});
export type ProjectWorkbookConditionalOverlay = typeof ProjectWorkbookConditionalOverlay.Type;

export const ProjectWorkbookPresentationSheet = Schema.Struct({
  name: TrimmedNonEmptyString.check(Schema.isMaxLength(PROJECT_DIRECTORY_NAME_MAX_LENGTH)),
  state: ProjectWorkbookSheetState,
  tabColor: Schema.optional(TrimmedNonEmptyString),
  showGridLines: Schema.Boolean,
  rowCount: NonNegativeInt,
  columnCount: NonNegativeInt,
  rawValues: Schema.Array(Schema.Array(ProjectTabularCellValue)),
  displayText: Schema.Array(Schema.Array(Schema.String)),
  valueKinds: Schema.Array(Schema.Array(ProjectTabularCellValueKind)),
  styleIds: Schema.Array(Schema.Array(Schema.NullOr(NonNegativeInt))),
  merges: Schema.Array(ProjectTabularSheetMerge),
  hiddenRows: Schema.Array(NonNegativeInt),
  hiddenColumns: Schema.Array(NonNegativeInt),
  frozenPane: Schema.optional(ProjectTabularSheetFrozenPane),
  rowHeights: Schema.Array(Schema.NullOr(Schema.Finite)),
  columnWidths: Schema.Array(Schema.NullOr(Schema.Finite)),
  comments: Schema.Array(ProjectWorkbookComment),
  images: Schema.Array(ProjectWorkbookEmbeddedImage),
  backgroundMediaId: Schema.optional(TrimmedNonEmptyString),
  conditionalOverlays: Schema.Array(ProjectWorkbookConditionalOverlay),
});
export type ProjectWorkbookPresentationSheet = typeof ProjectWorkbookPresentationSheet.Type;

export const ProjectReadTabularFileInput = Schema.Struct({
  cwd: TrimmedNonEmptyString,
  relativePath: TrimmedNonEmptyString.check(Schema.isMaxLength(PROJECT_WRITE_FILE_PATH_MAX_LENGTH)),
});
export type ProjectReadTabularFileInput = typeof ProjectReadTabularFileInput.Type;

export const ProjectReadDelimitedGridFileResult = Schema.Struct({
  relativePath: TrimmedNonEmptyString,
  previewKind: Schema.Literal("delimited-grid"),
  kind: ProjectDelimitedTabularFileKind,
  sizeBytes: NonNegativeInt,
  mtimeMs: NonNegativeInt,
  delimiter: ProjectTabularDelimiter,
  capabilities: ProjectDelimitedGridPreviewCapabilities,
  sheets: Schema.Array(ProjectDelimitedGridSheet),
});
export type ProjectReadDelimitedGridFileResult = typeof ProjectReadDelimitedGridFileResult.Type;

export const ProjectReadWorkbookPresentationFileResult = Schema.Struct({
  relativePath: TrimmedNonEmptyString,
  previewKind: Schema.Literal("workbook-presentation"),
  kind: ProjectWorkbookTabularFileKind,
  sizeBytes: NonNegativeInt,
  mtimeMs: NonNegativeInt,
  capabilities: ProjectWorkbookPresentationPreviewCapabilities,
  presentationFidelity: ProjectWorkbookPresentationFidelity,
  previewNotices: Schema.Array(TrimmedNonEmptyString),
  dateSystem: ProjectWorkbookDateSystem,
  theme: ProjectWorkbookTheme,
  styles: Schema.Array(ProjectWorkbookStyleAtlasEntry),
  sheets: Schema.Array(ProjectWorkbookPresentationSheet),
  unsupportedVisualReason: Schema.optional(TrimmedNonEmptyString),
});
export type ProjectReadWorkbookPresentationFileResult =
  typeof ProjectReadWorkbookPresentationFileResult.Type;

export const ProjectReadTabularFileResult = Schema.Union([
  ProjectReadDelimitedGridFileResult,
  ProjectReadWorkbookPresentationFileResult,
]);
export type ProjectReadTabularFileResult = typeof ProjectReadTabularFileResult.Type;

export class ProjectReadTabularFileError extends Schema.TaggedErrorClass<ProjectReadTabularFileError>()(
  "ProjectReadTabularFileError",
  {
    message: TrimmedNonEmptyString,
    cause: Schema.optional(Schema.Defect),
  },
) {}

export const ProjectTabularCellPatch = Schema.Struct({
  sheetName: TrimmedNonEmptyString.check(Schema.isMaxLength(PROJECT_DIRECTORY_NAME_MAX_LENGTH)),
  row: NonNegativeInt,
  col: NonNegativeInt,
  value: ProjectTabularCellValue,
  valueKind: ProjectTabularCellValueKind,
});
export type ProjectTabularCellPatch = typeof ProjectTabularCellPatch.Type;

export const ProjectWriteTabularFileInput = Schema.Struct({
  cwd: TrimmedNonEmptyString,
  relativePath: TrimmedNonEmptyString.check(Schema.isMaxLength(PROJECT_WRITE_FILE_PATH_MAX_LENGTH)),
  patches: Schema.Array(ProjectTabularCellPatch),
  expectedMtimeMs: Schema.optional(NonNegativeInt),
});
export type ProjectWriteTabularFileInput = typeof ProjectWriteTabularFileInput.Type;

export const ProjectWriteTabularFileResult = Schema.Struct({
  relativePath: TrimmedNonEmptyString,
});
export type ProjectWriteTabularFileResult = typeof ProjectWriteTabularFileResult.Type;

export class ProjectWriteTabularFileError extends Schema.TaggedErrorClass<ProjectWriteTabularFileError>()(
  "ProjectWriteTabularFileError",
  {
    message: TrimmedNonEmptyString,
    cause: Schema.optional(Schema.Defect),
  },
) {}

export const ProjectReadTabularMediaInput = Schema.Struct({
  cwd: TrimmedNonEmptyString,
  relativePath: TrimmedNonEmptyString.check(Schema.isMaxLength(PROJECT_WRITE_FILE_PATH_MAX_LENGTH)),
  mtimeMs: NonNegativeInt,
  mediaId: TrimmedNonEmptyString,
});
export type ProjectReadTabularMediaInput = typeof ProjectReadTabularMediaInput.Type;

export const ProjectReadTabularMediaResult = Schema.Struct({
  mediaId: TrimmedNonEmptyString,
  mimeType: TrimmedNonEmptyString,
  contentBase64: TrimmedNonEmptyString,
});
export type ProjectReadTabularMediaResult = typeof ProjectReadTabularMediaResult.Type;

export class ProjectReadTabularMediaError extends Schema.TaggedErrorClass<ProjectReadTabularMediaError>()(
  "ProjectReadTabularMediaError",
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

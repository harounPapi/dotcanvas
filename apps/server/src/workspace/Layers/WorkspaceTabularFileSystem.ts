import { parse as parseDelimited } from "csv-parse/sync";
import { stringify as stringifyDelimited } from "csv-stringify/sync";
import { Effect, FileSystem, Layer, Option, Path } from "effect";

import {
  type ProjectDelimitedTabularFileKind,
  PROJECT_TABULAR_MAX_COLUMNS,
  PROJECT_TABULAR_MAX_TOTAL_CELLS,
  PROJECT_TABULAR_READ_FILE_MAX_BYTES,
  type ProjectReadDelimitedGridFileResult,
  type ProjectTabularCellPatch,
  type ProjectTabularCellValue,
  type ProjectTabularDelimiter,
} from "@t3tools/contracts";
import {
  classifyFilePreview,
  defaultDelimiterForTabularKind,
  detectLikelyDelimitedTextFormat,
  isDelimitedTabularFileKind,
} from "@t3tools/shared/filePreviews";

import { WorkspaceFileSystemWriteConflictError } from "../Services/WorkspaceFileSystem.ts";
import { WorkspaceEntries } from "../Services/WorkspaceEntries.ts";
import { WorkspacePaths } from "../Services/WorkspacePaths.ts";
import {
  WorkspaceTabularFileSystem,
  WorkspaceTabularFileSystemError,
  type WorkspaceTabularFileSystemShape,
} from "../Services/WorkspaceTabularFileSystem.ts";
import { installExcelJsDrawingTolerancePatch } from "./installExcelJsDrawingTolerancePatch.ts";
import { readSheetJsWorkbookPresentationSnapshot } from "./sheetJsWorkbookPresentation.ts";
import {
  readWorkbookPresentationMedia,
  readWorkbookPresentationSnapshot,
} from "./xlsxPresentation.ts";

installExcelJsDrawingTolerancePatch();

function mtimeMsOf(mtime: Option.Option<Date>) {
  const date = Option.getOrUndefined(mtime);
  return date ? Math.max(0, Math.trunc(date.getTime())) : 0;
}

function ensureMatrixSize(rows: string[][], rowCount: number, columnCount: number): string[][] {
  while (rows.length < rowCount) {
    rows.push(Array.from({ length: columnCount }, () => ""));
  }

  for (const row of rows) {
    while (row.length < columnCount) {
      row.push("");
    }
  }

  return rows;
}

function trimTrailingEmptyStrings(rows: string[][]): string[][] {
  let maxColumnWithData = 0;
  let lastRowWithData = 0;

  for (let rowIndex = 0; rowIndex < rows.length; rowIndex += 1) {
    const row = rows[rowIndex]!;
    let rowHasData = false;

    for (let colIndex = 0; colIndex < row.length; colIndex += 1) {
      if ((row[colIndex] ?? "").length > 0) {
        rowHasData = true;
        maxColumnWithData = Math.max(maxColumnWithData, colIndex + 1);
      }
    }

    if (rowHasData) {
      lastRowWithData = rowIndex + 1;
    }
  }

  if (lastRowWithData === 0 || maxColumnWithData === 0) {
    return [];
  }

  return rows.slice(0, lastRowWithData).map((row) => row.slice(0, maxColumnWithData));
}

function decodeDelimitedText(bytes: Uint8Array, absolutePath: string) {
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch (cause) {
    const decodeError = cause instanceof Error ? cause : new Error(String(cause));
    throw new Error(`Spreadsheet file is not valid UTF-8 text: ${absolutePath}`, {
      cause: decodeError,
    });
  }
}

function serializeDelimitedValue(value: ProjectTabularCellValue): string {
  if (value === null) {
    return "";
  }

  if (typeof value === "boolean") {
    return value ? "true" : "false";
  }

  return String(value);
}

function detectDelimitedPreview(input: {
  absolutePath: string;
  bytes: Uint8Array;
  kind: ProjectDelimitedTabularFileKind;
  relativePath: string;
}) {
  const text = decodeDelimitedText(input.bytes, input.absolutePath);
  const detectedFormat = detectLikelyDelimitedTextFormat({
    kind: input.kind,
    text,
  });

  if (!detectedFormat) {
    throw new Error(`This text file doesn’t appear to contain tabular data: ${input.relativePath}`);
  }

  const rows = parseDelimited(text, {
    bom: true,
    delimiter: detectedFormat.delimiter,
    relax_column_count: true,
  }) as string[][];

  return {
    delimiter: detectedFormat.delimiter as ProjectTabularDelimiter,
    lineEnding: detectedFormat.lineEnding,
    rows,
    text,
  };
}

function readDelimitedSnapshot(input: {
  absolutePath: string;
  bytes: Uint8Array;
  kind: ProjectDelimitedTabularFileKind;
  relativePath: string;
  mtimeMs: number;
  sizeBytes: number;
}): ProjectReadDelimitedGridFileResult {
  const preview = detectDelimitedPreview(input);

  let columnCount = 0;
  for (const row of preview.rows) {
    columnCount = Math.max(columnCount, row.length);
  }

  if (columnCount > PROJECT_TABULAR_MAX_COLUMNS) {
    throw new Error(
      `Spreadsheet has too many columns for Room (${PROJECT_TABULAR_MAX_COLUMNS} max): ${input.relativePath}`,
    );
  }

  const totalCellCount = preview.rows.length * columnCount;
  if (totalCellCount > PROJECT_TABULAR_MAX_TOTAL_CELLS) {
    throw new Error(
      `Spreadsheet exceeds the Room preview limits (${PROJECT_TABULAR_MAX_TOTAL_CELLS.toLocaleString()} cells max): ${input.relativePath}`,
    );
  }

  const data = ensureMatrixSize(
    preview.rows.map((row) => [...row]),
    preview.rows.length,
    columnCount,
  );

  return {
    relativePath: input.relativePath,
    previewKind: "delimited-grid",
    kind: input.kind,
    delimiter: preview.delimiter,
    sizeBytes: input.sizeBytes,
    mtimeMs: input.mtimeMs,
    capabilities: { canEditInRoom: true },
    sheets: [
      {
        name: "Sheet1",
        rowCount: data.length,
        columnCount,
        data,
        merges: [],
        hiddenRows: [],
        hiddenColumns: [],
        cellMeta: [],
      },
    ],
  };
}

async function readCurrentDelimitedRows(
  fileSystem: FileSystem.FileSystem,
  absolutePath: string,
  kind: ProjectDelimitedTabularFileKind,
) {
  const existingBytes = await Effect.runPromise(fileSystem.readFile(absolutePath));
  const preview = detectDelimitedPreview({
    absolutePath,
    bytes: existingBytes,
    kind,
    relativePath: absolutePath,
  });
  return {
    delimiter: preview.delimiter,
    lineEnding: preview.lineEnding,
    rows: preview.rows.map((row) => row.slice()),
  };
}

async function writeDelimitedFile(input: {
  fileSystem: FileSystem.FileSystem;
  absolutePath: string;
  existing: { type: string } | null;
  kind: ProjectDelimitedTabularFileKind;
  patches: ReadonlyArray<ProjectTabularCellPatch>;
}) {
  const existingState =
    input.existing && input.existing.type === "File"
      ? await readCurrentDelimitedRows(input.fileSystem, input.absolutePath, input.kind)
      : {
          delimiter: defaultDelimiterForTabularKind(input.kind) as ProjectTabularDelimiter,
          lineEnding: "\n",
          rows: [],
        };
  const { delimiter, lineEnding, rows } = existingState;

  let rowCount = rows.length;
  let columnCount = rows.reduce((max, row) => Math.max(max, row.length), 0);

  for (const patch of input.patches) {
    if (patch.sheetName !== "Sheet1") {
      throw new Error("Delimited files only support a single sheet named Sheet1.");
    }
    rowCount = Math.max(rowCount, patch.row + 1);
    columnCount = Math.max(columnCount, patch.col + 1);
  }

  if (columnCount > PROJECT_TABULAR_MAX_COLUMNS) {
    throw new Error(
      `Spreadsheet has too many columns for Room (${PROJECT_TABULAR_MAX_COLUMNS} max).`,
    );
  }

  if (rowCount * columnCount > PROJECT_TABULAR_MAX_TOTAL_CELLS) {
    throw new Error(
      `Spreadsheet exceeds the Room preview limits (${PROJECT_TABULAR_MAX_TOTAL_CELLS.toLocaleString()} cells max).`,
    );
  }

  ensureMatrixSize(rows, rowCount, columnCount);

  for (const patch of input.patches) {
    rows[patch.row]![patch.col] = serializeDelimitedValue(patch.value);
  }

  const serialized = stringifyDelimited(trimTrailingEmptyStrings(rows), {
    delimiter,
    record_delimiter: lineEnding,
  });
  await Effect.runPromise(input.fileSystem.writeFileString(input.absolutePath, serialized));
}

export const makeWorkspaceTabularFileSystem = Effect.gen(function* () {
  const fileSystem = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const workspacePaths = yield* WorkspacePaths;
  const workspaceEntries = yield* WorkspaceEntries;

  const statOrNull = (absolutePath: string) =>
    fileSystem.stat(absolutePath).pipe(Effect.catch(() => Effect.succeed(null)));

  const toTabularError = (input: {
    cwd: string;
    relativePath?: string;
    operation: string;
    detail: string;
    cause?: unknown;
  }) =>
    new WorkspaceTabularFileSystemError({
      cwd: input.cwd,
      ...(input.relativePath ? { relativePath: input.relativePath } : {}),
      operation: input.operation,
      detail: input.detail,
      ...(input.cause !== undefined ? { cause: input.cause } : {}),
    });

  const normalizeWorkspaceInput = (input: { cwd: string; relativePath: string }) =>
    workspacePaths.normalizeWorkspaceRoot(input.cwd).pipe(
      Effect.map((cwd) => ({ cwd })),
      Effect.mapError((cause) =>
        toTabularError({
          cwd: input.cwd,
          relativePath: input.relativePath,
          operation: "workspaceTabularFileSystem.normalizeWorkspaceRoot",
          detail: cause.message,
          cause,
        }),
      ),
    );

  const readTabularFile: WorkspaceTabularFileSystemShape["readTabularFile"] = Effect.fn(
    "WorkspaceTabularFileSystem.readTabularFile",
  )(function* (input) {
    const { cwd } = yield* normalizeWorkspaceInput(input);
    const target = yield* workspacePaths.resolveRelativePathWithinRoot({
      workspaceRoot: cwd,
      relativePath: input.relativePath,
    });
    const existing = yield* statOrNull(target.absolutePath);

    if (!existing) {
      return yield* toTabularError({
        cwd,
        relativePath: input.relativePath,
        operation: "workspaceTabularFileSystem.readTabularFile",
        detail: `File does not exist: ${target.relativePath}`,
      });
    }

    if (existing.type !== "File") {
      return yield* toTabularError({
        cwd,
        relativePath: input.relativePath,
        operation: "workspaceTabularFileSystem.readTabularFile",
        detail: `Path is not a file: ${target.relativePath}`,
      });
    }

    const preview = classifyFilePreview(target.relativePath);
    if (preview.kind !== "tabular") {
      return yield* toTabularError({
        cwd,
        relativePath: input.relativePath,
        operation: "workspaceTabularFileSystem.readTabularFile",
        detail: `File is not a supported spreadsheet document: ${target.relativePath}`,
      });
    }

    if (existing.size > PROJECT_TABULAR_READ_FILE_MAX_BYTES) {
      return yield* toTabularError({
        cwd,
        relativePath: input.relativePath,
        operation: "workspaceTabularFileSystem.readTabularFile",
        detail: `Spreadsheet file is too large to open in Room: ${target.relativePath}`,
      });
    }

    const bytes = yield* fileSystem.readFile(target.absolutePath).pipe(
      Effect.mapError((cause) =>
        toTabularError({
          cwd,
          relativePath: input.relativePath,
          operation: "workspaceTabularFileSystem.readTabularFile",
          detail: cause.message,
          cause,
        }),
      ),
    );

    return yield* Effect.tryPromise({
      try: async () => {
        if (isDelimitedTabularFileKind(preview.tabularKind)) {
          return readDelimitedSnapshot({
            absolutePath: target.absolutePath,
            bytes,
            kind: preview.tabularKind,
            relativePath: target.relativePath,
            mtimeMs: mtimeMsOf(existing.mtime),
            sizeBytes: Number(existing.size),
          });
        }

        if (preview.tabularKind === "xlsx") {
          return readWorkbookPresentationSnapshot({
            bytes,
            relativePath: target.relativePath,
            mtimeMs: mtimeMsOf(existing.mtime),
            sizeBytes: Number(existing.size),
          });
        }

        return readSheetJsWorkbookPresentationSnapshot({
          bytes,
          kind: preview.tabularKind,
          relativePath: target.relativePath,
          mtimeMs: mtimeMsOf(existing.mtime),
          sizeBytes: Number(existing.size),
        });
      },
      catch: (cause) =>
        toTabularError({
          cwd,
          relativePath: input.relativePath,
          operation: "workspaceTabularFileSystem.readTabularFile",
          detail: cause instanceof Error ? cause.message : "Unable to read spreadsheet file.",
          cause,
        }),
    });
  });

  const readTabularMedia: WorkspaceTabularFileSystemShape["readTabularMedia"] = Effect.fn(
    "WorkspaceTabularFileSystem.readTabularMedia",
  )(function* (input) {
    const { cwd } = yield* normalizeWorkspaceInput(input);
    const target = yield* workspacePaths.resolveRelativePathWithinRoot({
      workspaceRoot: cwd,
      relativePath: input.relativePath,
    });
    const existing = yield* statOrNull(target.absolutePath);

    if (!existing || existing.type !== "File") {
      return yield* toTabularError({
        cwd,
        relativePath: input.relativePath,
        operation: "workspaceTabularFileSystem.readTabularMedia",
        detail: `File does not exist: ${target.relativePath}`,
      });
    }

    if (mtimeMsOf(existing.mtime) !== input.mtimeMs) {
      return yield* toTabularError({
        cwd,
        relativePath: input.relativePath,
        operation: "workspaceTabularFileSystem.readTabularMedia",
        detail: "Spreadsheet preview is out of date. Reload the workbook and try again.",
      });
    }

    const preview = classifyFilePreview(target.relativePath);
    if (preview.kind !== "tabular" || preview.tabularKind !== "xlsx") {
      return yield* toTabularError({
        cwd,
        relativePath: input.relativePath,
        operation: "workspaceTabularFileSystem.readTabularMedia",
        detail: `Workbook media is only available for XLSX previews: ${target.relativePath}`,
      });
    }

    const bytes = yield* fileSystem.readFile(target.absolutePath).pipe(
      Effect.mapError((cause) =>
        toTabularError({
          cwd,
          relativePath: input.relativePath,
          operation: "workspaceTabularFileSystem.readTabularMedia",
          detail: cause.message,
          cause,
        }),
      ),
    );

    return yield* Effect.tryPromise({
      try: () =>
        readWorkbookPresentationMedia({
          bytes,
          mediaId: input.mediaId,
        }),
      catch: (cause) =>
        toTabularError({
          cwd,
          relativePath: input.relativePath,
          operation: "workspaceTabularFileSystem.readTabularMedia",
          detail: cause instanceof Error ? cause.message : "Unable to read workbook media.",
          cause,
        }),
    });
  });

  const writeTabularFile: WorkspaceTabularFileSystemShape["writeTabularFile"] = Effect.fn(
    "WorkspaceTabularFileSystem.writeTabularFile",
  )(function* (input) {
    const { cwd } = yield* normalizeWorkspaceInput(input);
    const target = yield* workspacePaths.resolveRelativePathWithinRoot({
      workspaceRoot: cwd,
      relativePath: input.relativePath,
    });

    const existing =
      input.expectedMtimeMs === undefined ? null : yield* statOrNull(target.absolutePath);

    if (existing && existing.type !== "File") {
      return yield* toTabularError({
        cwd,
        relativePath: input.relativePath,
        operation: "workspaceTabularFileSystem.writeTabularFile",
        detail: `Path is not a file: ${target.relativePath}`,
      });
    }

    if (input.expectedMtimeMs !== undefined) {
      const actualMtimeMs = existing ? mtimeMsOf(existing.mtime) : undefined;
      if (!existing || actualMtimeMs !== input.expectedMtimeMs) {
        return yield* new WorkspaceFileSystemWriteConflictError({
          cwd,
          relativePath: target.relativePath,
          expectedMtimeMs: input.expectedMtimeMs,
          ...(actualMtimeMs === undefined ? {} : { actualMtimeMs }),
        });
      }
    }

    const preview = classifyFilePreview(target.relativePath);
    if (preview.kind !== "tabular") {
      return yield* toTabularError({
        cwd,
        relativePath: input.relativePath,
        operation: "workspaceTabularFileSystem.writeTabularFile",
        detail: `File is not a supported spreadsheet document: ${target.relativePath}`,
      });
    }

    const previewKind = preview.tabularKind;

    if (!isDelimitedTabularFileKind(previewKind)) {
      return yield* toTabularError({
        cwd,
        relativePath: input.relativePath,
        operation: "workspaceTabularFileSystem.writeTabularFile",
        detail: `${previewKind.toUpperCase()} files are preview-only in Room.`,
      });
    }

    yield* fileSystem.makeDirectory(path.dirname(target.absolutePath), { recursive: true }).pipe(
      Effect.mapError((cause) =>
        toTabularError({
          cwd,
          relativePath: input.relativePath,
          operation: "workspaceTabularFileSystem.makeDirectory",
          detail: cause.message,
          cause,
        }),
      ),
    );

    const currentFile = yield* statOrNull(target.absolutePath);

    yield* Effect.tryPromise({
      try: async () => {
        return writeDelimitedFile({
          fileSystem,
          absolutePath: target.absolutePath,
          existing: currentFile,
          kind: previewKind,
          patches: input.patches,
        });
      },
      catch: (cause) =>
        toTabularError({
          cwd,
          relativePath: input.relativePath,
          operation: "workspaceTabularFileSystem.writeTabularFile",
          detail: cause instanceof Error ? cause.message : "Unable to write spreadsheet file.",
          cause,
        }),
    });

    yield* workspaceEntries.invalidate(cwd);
    return { relativePath: target.relativePath };
  });

  return {
    readTabularFile,
    readTabularMedia,
    writeTabularFile,
  } satisfies WorkspaceTabularFileSystemShape;
});

export const WorkspaceTabularFileSystemLive = Layer.effect(
  WorkspaceTabularFileSystem,
  makeWorkspaceTabularFileSystem,
);

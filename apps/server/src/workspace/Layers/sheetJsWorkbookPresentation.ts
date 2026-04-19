import XLSX from "xlsx";

import type {
  ProjectReadWorkbookPresentationFileResult,
  ProjectTabularCellValue,
  ProjectTabularCellValueKind,
  ProjectWorkbookPresentationSheet,
  ProjectWorkbookStyleAtlasEntry,
} from "@t3tools/contracts";
import {
  PROJECT_TABULAR_MAX_COLUMNS,
  PROJECT_TABULAR_MAX_SHEETS,
  PROJECT_TABULAR_MAX_TOTAL_CELLS,
  type ProjectWorkbookTabularFileKind,
} from "@t3tools/contracts";
import {
  hashCssDeclarations,
  normalizeCellValueForContracts,
} from "@t3tools/shared/xlsxPresentation";

const DEFAULT_COLUMN_WIDTH = 8.43;
const DEFAULT_ROW_HEIGHT_PT = 15;
const PARTIAL_PREVIEW_NOTICE =
  "Simplified preview: some workbook visuals are not available in Room for this file format.";
const XLSM_PREVIEW_NOTICE = "Macros and VBA are not executed or exposed in Room.";

type SheetJsSheetState = {
  Hidden?: number;
  name?: string;
};

type SheetJsWorkbookWithMetadata = XLSX.WorkBook & {
  Workbook?: {
    Sheets?: SheetJsSheetState[];
    WBProps?: {
      date1904?: boolean;
    };
  };
};

type SheetJsWorksheetWithMetadata = XLSX.WorkSheet & {
  "!cols"?: Array<{
    hidden?: boolean;
    width?: number;
    wpx?: number;
    wch?: number;
  }>;
  "!freeze"?: {
    xSplit?: number;
    ySplit?: number;
  };
  "!merges"?: Array<{
    e: { c: number; r: number };
    s: { c: number; r: number };
  }>;
  "!ref"?: string;
  "!rows"?: Array<{
    hidden?: boolean;
    hpt?: number;
    hpx?: number;
  }>;
};

type SheetJsCellComment = {
  a?: string;
  t?: string;
};

type SheetJsCellStyle = {
  alignment?: {
    horizontal?: string;
    textRotation?: number;
    vertical?: string;
    wrapText?: boolean;
  };
  border?: Record<
    string,
    {
      color?: { rgb?: string };
      style?: string;
    }
  >;
  fgColor?: { rgb?: string };
  fill?: {
    fgColor?: { rgb?: string };
    patternType?: string;
  };
  font?: {
    bold?: boolean;
    color?: { rgb?: string };
    italic?: boolean;
    name?: string;
    sz?: number;
    underline?: boolean;
  };
  patternType?: string;
};

function mediaFreeWorkbookPreviewNotices(kind: ProjectWorkbookTabularFileKind) {
  return kind === "xlsm" ? [PARTIAL_PREVIEW_NOTICE, XLSM_PREVIEW_NOTICE] : [PARTIAL_PREVIEW_NOTICE];
}

function rowHeightToPx(rowHeightPt: number | undefined) {
  return Math.round((rowHeightPt ?? DEFAULT_ROW_HEIGHT_PT) * (96 / 72));
}

function columnWidthToPx(columnWidth: number | undefined) {
  const width = columnWidth ?? DEFAULT_COLUMN_WIDTH;
  return Math.max(0, Math.round(width * 7 + 5));
}

function sheetStateFromHidden(hidden: number | undefined) {
  switch (hidden) {
    case 1:
      return "hidden" as const;
    case 2:
      return "veryHidden" as const;
    default:
      return "visible" as const;
  }
}

function colorToCss(color: { rgb?: string } | undefined) {
  const rgb = color?.rgb?.replace(/^FF/i, "").replace(/^#/, "");
  if (!rgb || !/^[0-9A-Fa-f]{6}$/.test(rgb)) {
    return undefined;
  }
  return `#${rgb.toUpperCase()}`;
}

function borderWidthForStyle(style: string | undefined) {
  switch (style) {
    case "hair":
      return "1px";
    case "medium":
    case "mediumDashDot":
    case "mediumDashDotDot":
    case "mediumDashed":
      return "2px";
    case "thick":
      return "3px";
    default:
      return "1px";
  }
}

function resolveSheetJsStyleDeclarations(style: SheetJsCellStyle | undefined) {
  const declarations: Record<string, string> = {};
  if (!style || typeof style !== "object") {
    return declarations;
  }

  const fillColor = colorToCss(style.fill?.fgColor ?? style.fgColor);
  if (
    fillColor &&
    ((style.fill?.patternType ?? style.patternType ?? "").toLowerCase() === "solid" ||
      style.fill?.fgColor ||
      style.fgColor)
  ) {
    declarations["background-color"] = fillColor;
  }

  if (style.font?.bold) {
    declarations["font-weight"] = "700";
  }
  if (style.font?.italic) {
    declarations["font-style"] = "italic";
  }
  if (style.font?.underline) {
    declarations["text-decoration"] = "underline";
  }
  if (style.font?.name) {
    declarations["font-family"] = `"${style.font.name}"`;
  }
  if (style.font?.sz) {
    declarations["font-size"] = `${style.font.sz}px`;
  }

  const fontColor = colorToCss(style.font?.color);
  if (fontColor) {
    declarations.color = fontColor;
  }

  if (style.alignment?.horizontal) {
    declarations["justify-content"] =
      style.alignment.horizontal === "center"
        ? "center"
        : style.alignment.horizontal === "right"
          ? "flex-end"
          : "flex-start";
    declarations["text-align"] = style.alignment.horizontal;
  }
  if (style.alignment?.vertical) {
    declarations["align-items"] =
      style.alignment.vertical === "center"
        ? "center"
        : style.alignment.vertical === "bottom"
          ? "flex-end"
          : "flex-start";
  }
  if (style.alignment?.wrapText) {
    declarations["white-space"] = "pre-wrap";
  }
  if (typeof style.alignment?.textRotation === "number") {
    declarations["--room-xlsx-text-rotation"] = `${style.alignment.textRotation}deg`;
  }

  for (const [edge, border] of Object.entries(style.border ?? {})) {
    const borderColor = colorToCss(border.color) ?? "#D5D7DA";
    declarations[`border-${edge}`] = `${borderWidthForStyle(border.style)} solid ${borderColor}`;
  }

  return declarations;
}

function registerStyle(
  styles: ProjectWorkbookStyleAtlasEntry[],
  styleIdByHash: Map<string, number>,
  declarations: Record<string, string>,
) {
  const filteredDeclarations = Object.fromEntries(
    Object.entries(declarations).filter(([, value]) => value.trim().length > 0),
  );
  if (Object.keys(filteredDeclarations).length === 0) {
    return null;
  }

  const styleHash = hashCssDeclarations(filteredDeclarations);
  const existingStyleId = styleIdByHash.get(styleHash);
  if (existingStyleId !== undefined) {
    return existingStyleId;
  }

  const nextStyleId = styles.length;
  styles.push({ declarations: filteredDeclarations });
  styleIdByHash.set(styleHash, nextStyleId);
  return nextStyleId;
}

function toSheetJsDate(value: number, dateSystem: "1900" | "1904") {
  const parsed = XLSX.SSF.parse_date_code(value, {
    date1904: dateSystem === "1904",
  });
  if (!parsed) {
    return null;
  }

  const wholeSeconds = Math.trunc(parsed.S ?? 0);
  const milliseconds = Math.round(((parsed.S ?? 0) - wholeSeconds) * 1_000);
  return new Date(
    Date.UTC(
      parsed.y ?? 1970,
      (parsed.m ?? 1) - 1,
      parsed.d ?? 1,
      parsed.H ?? 0,
      parsed.M ?? 0,
      wholeSeconds,
      milliseconds,
    ),
  );
}

function normalizeSheetJsCellValue(
  cell: XLSX.CellObject | undefined,
  dateSystem: "1900" | "1904",
): { value: ProjectTabularCellValue; valueKind: ProjectTabularCellValueKind } {
  if (!cell || cell.t === "z" || cell.v === undefined || cell.v === null) {
    return { value: null, valueKind: "empty" };
  }

  if (cell.t === "d" && cell.v instanceof Date) {
    return normalizeCellValueForContracts(cell.v);
  }

  if (
    cell.t === "n" &&
    typeof cell.v === "number" &&
    typeof cell.z === "string" &&
    XLSX.SSF.is_date(cell.z)
  ) {
    const parsedDate = toSheetJsDate(cell.v, dateSystem);
    if (parsedDate) {
      return normalizeCellValueForContracts(parsedDate);
    }
  }

  return normalizeCellValueForContracts(cell.v);
}

function commentTextFromCell(cell: XLSX.CellObject | undefined) {
  const comments = (cell as (XLSX.CellObject & { c?: SheetJsCellComment[] }) | undefined)?.c;
  if (!Array.isArray(comments) || comments.length === 0) {
    return undefined;
  }

  const text = comments
    .map((comment) => comment.t?.trim() ?? "")
    .filter((entry) => entry.length > 0)
    .join("\n");
  return text.length > 0 ? text : undefined;
}

function normalizedErrorMessage(
  kind: ProjectWorkbookTabularFileKind,
  relativePath: string,
  error: unknown,
) {
  const message = error instanceof Error ? error.message : String(error);
  if (/password|encrypt/i.test(message)) {
    return `Spreadsheet workbook is password-protected or encrypted: ${relativePath}`;
  }
  return `Unable to read ${kind.toUpperCase()} workbook in Room: ${relativePath}`;
}

export async function readSheetJsWorkbookPresentationSnapshot(input: {
  bytes: Uint8Array;
  kind: ProjectWorkbookTabularFileKind;
  mtimeMs: number;
  relativePath: string;
  sizeBytes: number;
}): Promise<ProjectReadWorkbookPresentationFileResult> {
  let workbook: SheetJsWorkbookWithMetadata;

  try {
    workbook = XLSX.read(input.bytes, {
      type: "buffer",
      cellFormula: true,
      cellNF: true,
      cellStyles: true,
      cellText: true,
    }) as SheetJsWorkbookWithMetadata;
  } catch (error) {
    const workbookReadError = error instanceof Error ? error : new Error(String(error));
    throw new Error(normalizedErrorMessage(input.kind, input.relativePath, error), {
      cause: workbookReadError,
    });
  }

  if (workbook.SheetNames.length === 0) {
    throw new Error(`Spreadsheet workbook does not contain any worksheets: ${input.relativePath}`);
  }

  if (workbook.SheetNames.length > PROJECT_TABULAR_MAX_SHEETS) {
    throw new Error(
      `Spreadsheet has too many sheets for Room (${PROJECT_TABULAR_MAX_SHEETS} max): ${input.relativePath}`,
    );
  }

  const dateSystem = workbook.Workbook?.WBProps?.date1904 ? "1904" : "1900";
  const styles: ProjectWorkbookStyleAtlasEntry[] = [];
  const styleIdByHash = new Map<string, number>();
  const sheets: ProjectWorkbookPresentationSheet[] = [];
  let totalCellCount = 0;

  for (const [sheetIndex, sheetName] of workbook.SheetNames.entries()) {
    const worksheet = workbook.Sheets[sheetName] as SheetJsWorksheetWithMetadata | undefined;
    if (!worksheet) {
      continue;
    }

    const reference = worksheet["!ref"] ? XLSX.utils.decode_range(worksheet["!ref"]) : null;
    const merges =
      worksheet["!merges"]?.map((merge) => ({
        row: merge.s.r,
        col: merge.s.c,
        rowspan: merge.e.r - merge.s.r + 1,
        colspan: merge.e.c - merge.s.c + 1,
      })) ?? [];

    let rowCount = reference ? reference.e.r + 1 : 0;
    let columnCount = reference ? reference.e.c + 1 : 0;
    for (const merge of merges) {
      rowCount = Math.max(rowCount, merge.row + merge.rowspan);
      columnCount = Math.max(columnCount, merge.col + merge.colspan);
    }

    if (columnCount > PROJECT_TABULAR_MAX_COLUMNS) {
      throw new Error(
        `Spreadsheet has too many columns for Room (${PROJECT_TABULAR_MAX_COLUMNS} max): ${input.relativePath}`,
      );
    }

    totalCellCount += rowCount * columnCount;
    if (totalCellCount > PROJECT_TABULAR_MAX_TOTAL_CELLS) {
      throw new Error(
        `Spreadsheet exceeds the Room preview limits (${PROJECT_TABULAR_MAX_TOTAL_CELLS.toLocaleString()} cells max): ${input.relativePath}`,
      );
    }

    const rawValues = Array.from({ length: rowCount }, () =>
      Array.from({ length: columnCount }, (): ProjectTabularCellValue => null),
    );
    const displayText = Array.from({ length: rowCount }, () =>
      Array.from({ length: columnCount }, () => ""),
    );
    const valueKinds = Array.from({ length: rowCount }, () =>
      Array.from({ length: columnCount }, (): ProjectTabularCellValueKind => "empty"),
    );
    const styleIds = Array.from({ length: rowCount }, () =>
      Array.from({ length: columnCount }, (): number | null => null),
    );
    const comments: Array<ProjectWorkbookPresentationSheet["comments"][number]> = [];

    for (let rowIndex = 0; rowIndex < rowCount; rowIndex += 1) {
      for (let colIndex = 0; colIndex < columnCount; colIndex += 1) {
        const cellAddress = XLSX.utils.encode_cell({ c: colIndex, r: rowIndex });
        const cell = worksheet[cellAddress];
        const normalized = normalizeSheetJsCellValue(cell, dateSystem);
        rawValues[rowIndex]![colIndex] = normalized.value;
        valueKinds[rowIndex]![colIndex] = normalized.valueKind;
        displayText[rowIndex]![colIndex] =
          cell?.w ?? (normalized.value === null ? "" : String(normalized.value));
        styleIds[rowIndex]![colIndex] = registerStyle(
          styles,
          styleIdByHash,
          resolveSheetJsStyleDeclarations(cell?.s as SheetJsCellStyle | undefined),
        );

        const commentText = commentTextFromCell(cell);
        if (commentText) {
          comments.push({
            row: rowIndex,
            col: colIndex,
            text: commentText,
          });
        }
      }
    }

    const hiddenRows = (worksheet["!rows"] ?? [])
      .flatMap((row, index) => (row?.hidden ? [index] : []))
      .toSorted((left, right) => left - right);
    const hiddenColumns = (worksheet["!cols"] ?? [])
      .flatMap((column, index) => (column?.hidden ? [index] : []))
      .toSorted((left, right) => left - right);
    const rowHeights = Array.from({ length: rowCount }, (_, rowIndex) => {
      const rowMetadata = worksheet["!rows"]?.[rowIndex];
      if (rowMetadata?.hidden) {
        return null;
      }
      if (typeof rowMetadata?.hpx === "number") {
        return rowMetadata.hpx;
      }
      if (typeof rowMetadata?.hpt === "number") {
        return rowHeightToPx(rowMetadata.hpt);
      }
      return null;
    });
    const columnWidths = Array.from({ length: columnCount }, (_, columnIndex) => {
      const columnMetadata = worksheet["!cols"]?.[columnIndex];
      if (columnMetadata?.hidden) {
        return null;
      }
      if (typeof columnMetadata?.wpx === "number") {
        return columnMetadata.wpx;
      }
      if (typeof columnMetadata?.width === "number") {
        return columnWidthToPx(columnMetadata.width);
      }
      if (typeof columnMetadata?.wch === "number") {
        return columnWidthToPx(columnMetadata.wch);
      }
      return null;
    });

    const freeze = worksheet["!freeze"];
    const workbookSheet = workbook.Workbook?.Sheets?.[sheetIndex];
    sheets.push({
      name: sheetName,
      state: sheetStateFromHidden(workbookSheet?.Hidden),
      showGridLines: true,
      rowCount,
      columnCount,
      rawValues,
      displayText,
      valueKinds,
      styleIds,
      merges,
      hiddenRows,
      hiddenColumns,
      ...(freeze && (freeze.xSplit || freeze.ySplit)
        ? {
            frozenPane: {
              rowCount: Math.max(0, freeze.ySplit ?? 0),
              columnCount: Math.max(0, freeze.xSplit ?? 0),
            },
          }
        : {}),
      rowHeights,
      columnWidths,
      comments,
      images: [],
      conditionalOverlays: [],
    });
  }

  return {
    relativePath: input.relativePath,
    previewKind: "workbook-presentation",
    kind: input.kind,
    sizeBytes: input.sizeBytes,
    mtimeMs: input.mtimeMs,
    capabilities: { canEditInRoom: false },
    presentationFidelity: "partial",
    previewNotices: mediaFreeWorkbookPreviewNotices(input.kind),
    dateSystem,
    theme: {
      colors: {},
    },
    styles,
    sheets,
  };
}

import path from "node:path";
import ExcelJS from "exceljs";
import { XMLParser } from "fast-xml-parser";
import JSZip from "jszip";

import type {
  ProjectReadTabularMediaResult,
  ProjectReadWorkbookPresentationFileResult,
  ProjectTabularCellValue,
  ProjectTabularCellValueKind,
  ProjectWorkbookConditionalOverlay,
  ProjectWorkbookEmbeddedImage,
  ProjectWorkbookPresentationSheet,
  ProjectWorkbookStyleAtlasEntry,
} from "@t3tools/contracts";
import {
  PROJECT_TABULAR_MAX_COLUMNS,
  PROJECT_TABULAR_MAX_SHEETS,
  PROJECT_TABULAR_MAX_TOTAL_CELLS,
} from "@t3tools/contracts";
import {
  buildDisplayMatrix,
  clampUnitInterval,
  findUnsupportedDrawingVisualReason,
  formatExcelDisplayText,
  hashCssDeclarations,
  hasCrossSheetReference,
  isBuiltInExcelTableTheme,
  normalizeCellValueForContracts,
  parseWorkbookThemeXml,
  resolveWorkbookColorToCss,
  type ResolvedWorkbookTheme,
} from "@t3tools/shared/xlsxPresentation";

const DEFAULT_COLUMN_WIDTH = 8.43;
const DEFAULT_ROW_HEIGHT_PT = 15;
const EMU_PER_PIXEL = 9525;
const BORDER_DEFAULT_COLOR = "#D5D7DA";
const XML_PARSER = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "",
  parseTagValue: false,
  trimValues: false,
});

type WorksheetModelRow = {
  number?: number;
  hidden?: boolean;
};

type WorksheetModelColumn = {
  min?: number;
  max?: number;
  hidden?: boolean;
  width?: number;
};

type WorksheetTableModel = {
  name?: string;
  style?: {
    theme?: string | null;
  } | null;
};

type WorksheetConditionalFormattingModel = {
  ref?: string;
  rules?: Array<Record<string, unknown>>;
};

type WorksheetModelWithPresentation = ExcelJS.WorksheetModel & {
  rows?: WorksheetModelRow[];
  cols?: WorksheetModelColumn[];
  tables?: WorksheetTableModel[];
  conditionalFormattings?: WorksheetConditionalFormattingModel[];
};

type PresentationCellSnapshot = {
  contractValue: ProjectTabularCellValue;
  valueKind: ProjectTabularCellValueKind;
  displaySource: unknown;
  style: Partial<ExcelJS.Style> | undefined;
};

type ZipCommentsBySheetName = Map<string, Array<{ row: number; col: number; text: string }>>;

type MeasuredWorksheetLayout = {
  rowCount: number;
  columnCount: number;
  merges: Array<{
    row: number;
    col: number;
    rowspan: number;
    colspan: number;
  }>;
};

function asArray<T>(value: T | T[] | undefined): T[] {
  if (value === undefined) {
    return [];
  }
  return Array.isArray(value) ? value : [value];
}

function columnNumberFromLetters(letters: string): number {
  let value = 0;
  for (const letter of letters.toUpperCase()) {
    value = value * 26 + (letter.charCodeAt(0) - 64);
  }
  return value;
}

function decodeA1Address(address: string): { row: number; col: number } {
  const match = /^([A-Za-z]+)(\d+)$/.exec(address.trim());
  if (!match?.[1] || !match[2]) {
    throw new Error(`Unsupported spreadsheet address: ${address}`);
  }

  return {
    col: columnNumberFromLetters(match[1]) - 1,
    row: Number.parseInt(match[2], 10) - 1,
  };
}

function parseRangeA1(rangeText: string) {
  const [startAddressRaw, endAddressRaw] = rangeText.split(":");
  const start = decodeA1Address(startAddressRaw ?? "");
  const end = decodeA1Address(endAddressRaw ?? startAddressRaw ?? "");
  return {
    top: Math.min(start.row, end.row),
    bottom: Math.max(start.row, end.row),
    left: Math.min(start.col, end.col),
    right: Math.max(start.col, end.col),
  };
}

function measureWorksheetLayout(
  worksheet: ExcelJS.Worksheet,
  worksheetModel: WorksheetModelWithPresentation,
): MeasuredWorksheetLayout {
  const merges = (worksheetModel.merges ?? []).map((rangeText) => {
    const range = parseRangeA1(rangeText);
    return {
      row: range.top,
      col: range.left,
      rowspan: range.bottom - range.top + 1,
      colspan: range.right - range.left + 1,
    };
  });

  let rowCount = Math.max(worksheet.rowCount, 0);
  let columnCount = Math.max(worksheet.columnCount, 0);

  worksheet.eachRow((row, rowNumber) => {
    rowCount = Math.max(rowCount, rowNumber);
    columnCount = Math.max(columnCount, row.cellCount);
  });

  for (const row of worksheetModel.rows ?? []) {
    rowCount = Math.max(rowCount, row.number ?? 0);
  }

  for (const column of worksheetModel.cols ?? []) {
    columnCount = Math.max(columnCount, column.max ?? column.min ?? 0);
  }

  for (const merge of merges) {
    rowCount = Math.max(rowCount, merge.row + merge.rowspan);
    columnCount = Math.max(columnCount, merge.col + merge.colspan);
  }

  return {
    rowCount,
    columnCount,
    merges,
  };
}

function splitRefs(refText: string | undefined) {
  return (refText ?? "")
    .split(/\s+/)
    .map((segment) => segment.trim())
    .filter((segment) => segment.length > 0);
}

function rowHeightToPx(rowHeightPt: number | undefined) {
  return Math.round((rowHeightPt ?? DEFAULT_ROW_HEIGHT_PT) * (96 / 72));
}

function columnWidthToPx(columnWidth: number | undefined) {
  const width = columnWidth ?? DEFAULT_COLUMN_WIDTH;
  return Math.max(0, Math.round(width * 7 + 5));
}

function resolveZipPath(baseFilePath: string, targetPath: string) {
  return path.posix.normalize(path.posix.join(path.posix.dirname(baseFilePath), targetPath));
}

function textFromXmlValue(node: unknown): string {
  if (typeof node === "string") {
    return node;
  }
  if (Array.isArray(node)) {
    return node.map((entry) => textFromXmlValue(entry)).join("");
  }
  if (node && typeof node === "object") {
    if ("#text" in node && typeof node["#text"] === "string") {
      return node["#text"];
    }
    return Object.values(node)
      .map((entry) => textFromXmlValue(entry))
      .join("");
  }
  return "";
}

async function readWorkbookZip(bytes: Uint8Array) {
  return JSZip.loadAsync(bytes);
}

async function readTextEntry(zip: JSZip, entryPath: string) {
  const file = zip.file(entryPath);
  if (!file) {
    return undefined;
  }
  return file.async("text");
}

async function readCommentsBySheetName(input: {
  zip: JSZip;
  workbook: ExcelJS.Workbook;
}): Promise<ZipCommentsBySheetName> {
  const commentsBySheetName: ZipCommentsBySheetName = new Map();

  for (const worksheet of input.workbook.worksheets) {
    const sheetXmlPath = `xl/worksheets/sheet${worksheet.id}.xml`;
    const relsXmlPath = `xl/worksheets/_rels/sheet${worksheet.id}.xml.rels`;
    const relationshipsXml = await readTextEntry(input.zip, relsXmlPath);
    if (!relationshipsXml) {
      continue;
    }

    const parsedRelationships = XML_PARSER.parse(relationshipsXml) as {
      Relationships?: {
        Relationship?:
          | { Target?: string; Type?: string }
          | Array<{ Target?: string; Type?: string }>;
      };
    };
    const commentRelationship = asArray(parsedRelationships.Relationships?.Relationship).find(
      (relationship) =>
        typeof relationship?.Type === "string" && relationship.Type.includes("/comments"),
    );
    if (!commentRelationship?.Target) {
      continue;
    }

    const commentXmlPath = resolveZipPath(sheetXmlPath, commentRelationship.Target);
    const commentsXml = await readTextEntry(input.zip, commentXmlPath);
    if (!commentsXml) {
      continue;
    }

    const parsedComments = XML_PARSER.parse(commentsXml) as {
      comments?: {
        commentList?: {
          comment?:
            | {
                ref?: string;
                text?: unknown;
              }
            | Array<{
                ref?: string;
                text?: unknown;
              }>;
        };
      };
    };

    const worksheetComments = asArray(parsedComments.comments?.commentList?.comment).flatMap(
      (comment) => {
        if (!comment?.ref) {
          return [];
        }

        const { row, col } = decodeA1Address(comment.ref);
        const commentText = textFromXmlValue(comment.text).trim();
        return commentText.length > 0 ? [{ row, col, text: commentText }] : [];
      },
    );

    if (worksheetComments.length > 0) {
      commentsBySheetName.set(worksheet.name, worksheetComments);
    }
  }

  return commentsBySheetName;
}

async function detectUnsupportedWorkbookVisualReason(input: {
  zip: JSZip;
  workbook: ExcelJS.Workbook;
}) {
  const zipEntryPaths = Object.keys(input.zip.files);

  if (zipEntryPaths.some((entryPath) => entryPath.endsWith("/vbaProject.bin"))) {
    return "This workbook contains VBA macros that Room can’t preview safely.";
  }

  if (
    zipEntryPaths.some(
      (entryPath) =>
        entryPath.startsWith("xl/charts/") ||
        entryPath.startsWith("xl/pivotTables/") ||
        entryPath.startsWith("xl/slicers/") ||
        entryPath.startsWith("xl/slicerCaches/"),
    )
  ) {
    return "This workbook contains advanced Excel visuals that Room can’t render yet.";
  }

  if (
    (input.workbook.model.sheets?.length ?? input.workbook.worksheets.length) !==
    input.workbook.worksheets.length
  ) {
    return "This workbook contains non-worksheet sheets that Room can’t render yet.";
  }

  for (const worksheet of input.workbook.worksheets) {
    const worksheetModel = worksheet.model as WorksheetModelWithPresentation;
    if ((worksheetModel.tables?.length ?? 0) > 0) {
      const themedTable = worksheetModel.tables?.find((table) =>
        isBuiltInExcelTableTheme(table.style?.theme),
      );
      if (themedTable) {
        return "This workbook uses Excel table themes that Room can’t render faithfully yet.";
      }
      return "This workbook uses Excel tables that Room can’t render faithfully yet.";
    }

    for (const conditionalFormatting of worksheetModel.conditionalFormattings ?? []) {
      for (const rule of conditionalFormatting.rules ?? []) {
        const ruleType = typeof rule.type === "string" ? rule.type : undefined;
        if (ruleType === "expression" || ruleType === "timePeriod") {
          return "This workbook contains advanced conditional formatting that Room can’t render yet.";
        }

        const formulae = Array.isArray(rule.formulae)
          ? rule.formulae.filter((value): value is string => typeof value === "string")
          : [];
        if (formulae.some((formulaText) => hasCrossSheetReference(formulaText))) {
          return "This workbook contains cross-sheet conditional formatting that Room can’t render yet.";
        }
      }
    }
  }

  for (const entryPath of zipEntryPaths.filter((candidate) =>
    /^xl\/drawings\/drawing\d+[.]xml$/i.test(candidate),
  )) {
    const drawingXml = await readTextEntry(input.zip, entryPath);
    if (!drawingXml) {
      continue;
    }
    const unsupportedReason = findUnsupportedDrawingVisualReason(drawingXml);
    if (unsupportedReason) {
      return unsupportedReason;
    }
  }

  return undefined;
}

function resolveFontFamily(font: Partial<ExcelJS.Font> | undefined, theme: ResolvedWorkbookTheme) {
  if (!font) {
    return undefined;
  }
  if (typeof font.name === "string" && font.name.trim().length > 0) {
    return font.name;
  }
  if (font.scheme === "major") {
    return theme.majorLatinFont;
  }
  if (font.scheme === "minor") {
    return theme.minorLatinFont;
  }
  return undefined;
}

function resolveBorderValue(
  border: Partial<ExcelJS.Borders> | undefined,
  side: "top" | "right" | "bottom" | "left",
  theme: ResolvedWorkbookTheme,
) {
  const borderSide = border?.[side];
  if (!borderSide?.style) {
    return undefined;
  }

  const width =
    borderSide.style === "double"
      ? "3px"
      : borderSide.style === "thick"
        ? "2px"
        : borderSide.style.startsWith("medium")
          ? "2px"
          : borderSide.style === "hair"
            ? "1px"
            : "1px";

  const style =
    borderSide.style === "dashDot" || borderSide.style === "dashDotDot"
      ? "dashed"
      : borderSide.style === "dotted"
        ? "dotted"
        : borderSide.style === "double"
          ? "double"
          : "solid";

  const color = resolveWorkbookColorToCss(borderSide.color, theme) ?? BORDER_DEFAULT_COLOR;
  return `${width} ${style} ${color}`;
}

function resolveStyleDeclarations(input: {
  style: Partial<ExcelJS.Style> | undefined;
  theme: ResolvedWorkbookTheme;
}) {
  const declarations: Record<string, string> = {};
  const font = input.style?.font;
  const fill = input.style?.fill;
  const alignment = input.style?.alignment;
  const border = input.style?.border;

  const fontFamily = resolveFontFamily(font, input.theme);
  if (fontFamily) {
    declarations["font-family"] = `"${fontFamily}"`;
  }
  if (font?.size) {
    declarations["font-size"] = `${font.size}pt`;
  }
  if (font?.bold) {
    declarations["font-weight"] = "700";
  }
  if (font?.italic) {
    declarations["font-style"] = "italic";
  }
  const fontColor = resolveWorkbookColorToCss(font?.color, input.theme);
  if (fontColor) {
    declarations.color = fontColor;
  }
  if (font?.underline || font?.strike) {
    declarations["text-decoration"] = [
      font.underline ? "underline" : "",
      font.strike ? "line-through" : "",
    ]
      .filter(Boolean)
      .join(" ");
  }

  if (fill?.type === "pattern" && fill.pattern === "solid") {
    const fillColor =
      resolveWorkbookColorToCss(fill.fgColor, input.theme) ??
      resolveWorkbookColorToCss(fill.bgColor, input.theme);
    if (fillColor) {
      declarations["background-color"] = fillColor;
    }
  }

  if (alignment?.horizontal) {
    const horizontal =
      alignment.horizontal === "centerContinuous"
        ? "center"
        : alignment.horizontal === "distributed" || alignment.horizontal === "fill"
          ? "left"
          : alignment.horizontal;
    declarations["text-align"] = horizontal;
  }
  if (alignment?.vertical) {
    declarations["vertical-align"] = alignment.vertical;
  }
  declarations["white-space"] = alignment?.wrapText ? "pre-wrap" : "pre";
  declarations["overflow-wrap"] = alignment?.wrapText ? "anywhere" : "normal";
  if (alignment?.indent) {
    declarations["padding-left"] = `${alignment.indent * 0.75}rem`;
  }
  if (alignment?.textRotation === "vertical") {
    declarations["writing-mode"] = "vertical-rl";
    declarations["text-orientation"] = "mixed";
  } else if (typeof alignment?.textRotation === "number" && alignment.textRotation !== 0) {
    declarations["--room-xlsx-text-rotation"] = `${alignment.textRotation}deg`;
  }

  const topBorder = resolveBorderValue(border, "top", input.theme);
  const rightBorder = resolveBorderValue(border, "right", input.theme);
  const bottomBorder = resolveBorderValue(border, "bottom", input.theme);
  const leftBorder = resolveBorderValue(border, "left", input.theme);
  if (topBorder) {
    declarations["border-top"] = topBorder;
  }
  if (rightBorder) {
    declarations["border-right"] = rightBorder;
  }
  if (bottomBorder) {
    declarations["border-bottom"] = bottomBorder;
  }
  if (leftBorder) {
    declarations["border-left"] = leftBorder;
  }

  return declarations;
}

function resolvePresentationCellSnapshot(cell: ExcelJS.Cell): PresentationCellSnapshot {
  const sourceValue = cell.formula ? cell.result : cell.value;
  if (
    sourceValue &&
    typeof sourceValue === "object" &&
    !Array.isArray(sourceValue) &&
    !(sourceValue instanceof Date)
  ) {
    if ("text" in sourceValue && typeof sourceValue.text === "string") {
      return {
        contractValue: sourceValue.text,
        valueKind: "text",
        displaySource: sourceValue.text,
        style: cell.style,
      };
    }
    if ("richText" in sourceValue && Array.isArray(sourceValue.richText)) {
      const joinedText = sourceValue.richText.map((entry) => entry.text ?? "").join("");
      return {
        contractValue: joinedText,
        valueKind: "text",
        displaySource: joinedText,
        style: cell.style,
      };
    }
    if ("hyperlink" in sourceValue && typeof sourceValue.hyperlink === "string") {
      const hyperlinkText =
        typeof sourceValue.text === "string" && sourceValue.text.length > 0
          ? sourceValue.text
          : sourceValue.hyperlink;
      return {
        contractValue: hyperlinkText,
        valueKind: "text",
        displaySource: hyperlinkText,
        style: cell.style,
      };
    }
    if ("error" in sourceValue && typeof sourceValue.error === "string") {
      return {
        contractValue: sourceValue.error,
        valueKind: "text",
        displaySource: sourceValue.error,
        style: cell.style,
      };
    }
  }

  const normalized = normalizeCellValueForContracts(sourceValue);
  return {
    contractValue: normalized.value,
    valueKind: normalized.valueKind,
    displaySource: sourceValue,
    style: cell.style,
  };
}

function buildPrefixSums(values: readonly number[]) {
  const prefix: number[] = [0];
  for (const value of values) {
    prefix.push(prefix[prefix.length - 1]! + value);
  }
  return prefix;
}

function positionToPixels(position: number, prefix: readonly number[], sizes: readonly number[]) {
  const baseIndex = Math.floor(position);
  const fraction = position - baseIndex;
  const base = prefix[Math.max(0, Math.min(baseIndex, prefix.length - 1))] ?? 0;
  if (fraction <= 0) {
    return base;
  }
  const size = sizes[baseIndex] ?? sizes[sizes.length - 1] ?? 0;
  return base + size * fraction;
}

function buildSheetImages(input: {
  worksheet: ExcelJS.Worksheet;
  columnWidthsPx: readonly number[];
  rowHeightsPx: readonly number[];
}): {
  images: ProjectWorkbookEmbeddedImage[];
  backgroundMediaId?: string;
} {
  const columnPrefix = buildPrefixSums(input.columnWidthsPx);
  const rowPrefix = buildPrefixSums(input.rowHeightsPx);

  const images = input.worksheet.getImages().map((image) => {
    const range = image.range as {
      tl: { col: number; row: number };
      br?: { col: number; row: number };
      ext?: { width?: number; height?: number };
    };
    const leftPx = positionToPixels(range.tl.col, columnPrefix, input.columnWidthsPx);
    const topPx = positionToPixels(range.tl.row, rowPrefix, input.rowHeightsPx);
    const rightPx = range.br
      ? positionToPixels(range.br.col, columnPrefix, input.columnWidthsPx)
      : leftPx + (range.ext?.width ?? 0) / EMU_PER_PIXEL;
    const bottomPx = range.br
      ? positionToPixels(range.br.row, rowPrefix, input.rowHeightsPx)
      : topPx + (range.ext?.height ?? 0) / EMU_PER_PIXEL;

    return {
      mediaId: String(image.imageId),
      leftPx,
      topPx,
      widthPx: Math.max(0, rightPx - leftPx),
      heightPx: Math.max(0, bottomPx - topPx),
    } satisfies ProjectWorkbookEmbeddedImage;
  });

  const backgroundImageId = input.worksheet.getBackgroundImageId?.();
  return {
    images,
    ...(backgroundImageId !== undefined && backgroundImageId !== null
      ? { backgroundMediaId: String(backgroundImageId) }
      : {}),
  };
}

function iconKeyForSet(iconSet: string | undefined, bucketIndex: number) {
  const setName = iconSet ?? "3TrafficLights";
  if (setName.includes("TrafficLights")) {
    return (
      ["traffic-red", "traffic-yellow", "traffic-green", "traffic-green", "traffic-green"][
        bucketIndex
      ] ?? "traffic-green"
    );
  }
  if (setName.includes("Triangles")) {
    return (
      ["triangle-red", "triangle-yellow", "triangle-green", "triangle-green", "triangle-green"][
        bucketIndex
      ] ?? "triangle-green"
    );
  }
  if (setName.includes("Stars")) {
    return (
      ["star-low", "star-mid", "star-high", "star-high", "star-high"][bucketIndex] ?? "star-high"
    );
  }
  if (setName.includes("Boxes")) {
    return ["box-low", "box-mid", "box-high", "box-high", "box-high"][bucketIndex] ?? "box-high";
  }
  return (
    ["marker-low", "marker-mid", "marker-high", "marker-high", "marker-high"][bucketIndex] ??
    "marker-high"
  );
}

function parseHexColor(hexColor: string) {
  return {
    red: Number.parseInt(hexColor.slice(1, 3), 16),
    green: Number.parseInt(hexColor.slice(3, 5), 16),
    blue: Number.parseInt(hexColor.slice(5, 7), 16),
  };
}

function interpolateHexColor(startHex: string, endHex: string, progress: number) {
  const start = parseHexColor(startHex);
  const end = parseHexColor(endHex);
  const mix = (left: number, right: number) => Math.round(left + (right - left) * progress);
  return `#${[mix(start.red, end.red), mix(start.green, end.green), mix(start.blue, end.blue)]
    .map((channel) => channel.toString(16).padStart(2, "0"))
    .join("")
    .toUpperCase()}`;
}

function numericValuesForRange(input: {
  rawValues: ProjectTabularCellValue[][];
  valueKinds: ProjectTabularCellValueKind[][];
  range: ReturnType<typeof parseRangeA1>;
}) {
  const values: number[] = [];
  for (let row = input.range.top; row <= input.range.bottom; row += 1) {
    for (let col = input.range.left; col <= input.range.right; col += 1) {
      if (input.valueKinds[row]?.[col] === "number") {
        const numericValue = input.rawValues[row]?.[col];
        if (typeof numericValue === "number" && Number.isFinite(numericValue)) {
          values.push(numericValue);
        }
      }
    }
  }
  return values;
}

function resolveThresholdValue(input: {
  threshold: Record<string, unknown>;
  values: readonly number[];
}) {
  if (input.values.length === 0) {
    return undefined;
  }

  const sortedValues = [...input.values].toSorted((left, right) => left - right);
  const thresholdType = input.threshold.type;
  const numericValue =
    typeof input.threshold.value === "number"
      ? input.threshold.value
      : typeof input.threshold.value === "string"
        ? Number(input.threshold.value)
        : undefined;

  switch (thresholdType) {
    case "min":
    case "autoMin":
      return sortedValues[0];
    case "max":
    case "autoMax":
      return sortedValues[sortedValues.length - 1];
    case "num":
      return numericValue;
    case "percent":
      if (numericValue === undefined) {
        return undefined;
      }
      return (
        sortedValues[0]! +
        (sortedValues[sortedValues.length - 1]! - sortedValues[0]!) * (numericValue / 100)
      );
    case "percentile": {
      if (numericValue === undefined) {
        return undefined;
      }
      const index = Math.max(
        0,
        Math.min(
          sortedValues.length - 1,
          Math.round(((sortedValues.length - 1) * numericValue) / 100),
        ),
      );
      return sortedValues[index];
    }
    default:
      return undefined;
  }
}

function parseLiteralFormulaValue(formulaText: string) {
  const trimmed = formulaText.trim();
  if (/^".*"$/.test(trimmed)) {
    return trimmed.slice(1, -1);
  }
  const numeric = Number(trimmed);
  return Number.isFinite(numeric) ? numeric : undefined;
}

function mergeOverlayStyle(
  declarationsByCell: Map<string, Record<string, string>>,
  row: number,
  col: number,
  declarations: Record<string, string>,
) {
  const key = `${row}:${col}`;
  const existing = declarationsByCell.get(key) ?? {};
  declarationsByCell.set(key, { ...existing, ...declarations });
}

function buildConditionalOverlays(input: {
  worksheetModel: WorksheetModelWithPresentation;
  rawValues: ProjectTabularCellValue[][];
  valueKinds: ProjectTabularCellValueKind[][];
  theme: ResolvedWorkbookTheme;
  registerStyle: (declarations: Record<string, string>) => number | undefined;
}): ProjectWorkbookConditionalOverlay[] {
  const declarationsByCell = new Map<string, Record<string, string>>();
  const overlaysByCell = new Map<
    string,
    Omit<ProjectWorkbookConditionalOverlay, "row" | "col" | "styleId">
  >();

  for (const conditionalFormatting of input.worksheetModel.conditionalFormattings ?? []) {
    const ranges = splitRefs(conditionalFormatting.ref).map(parseRangeA1);
    const rules = [...(conditionalFormatting.rules ?? [])]
      .filter((rule) => typeof rule.type === "string")
      .toSorted((left, right) => {
        const leftPriority =
          typeof left.priority === "number" ? left.priority : Number.MAX_SAFE_INTEGER;
        const rightPriority =
          typeof right.priority === "number" ? right.priority : Number.MAX_SAFE_INTEGER;
        return leftPriority - rightPriority;
      });

    for (const rule of rules) {
      const ruleType = rule.type as string;
      for (const range of ranges) {
        const numericValues = numericValuesForRange({
          rawValues: input.rawValues,
          valueKinds: input.valueKinds,
          range,
        });

        if (ruleType === "colorScale" && numericValues.length > 0 && Array.isArray(rule.color)) {
          const min = resolveThresholdValue({
            threshold: (rule.cfvo as Array<Record<string, unknown>>)?.[0] ?? {},
            values: numericValues,
          });
          const max = resolveThresholdValue({
            threshold:
              (rule.cfvo as Array<Record<string, unknown>>)?.[
                Math.max(0, ((rule.cfvo as Array<Record<string, unknown>>) ?? []).length - 1)
              ] ?? {},
            values: numericValues,
          });
          const startColor = resolveWorkbookColorToCss(
            rule.color[0] as Record<string, unknown>,
            input.theme,
          );
          const endColor = resolveWorkbookColorToCss(
            rule.color[Math.max(0, rule.color.length - 1)] as Record<string, unknown>,
            input.theme,
          );
          if (!startColor || !endColor || min === undefined || max === undefined || min === max) {
            continue;
          }

          for (let row = range.top; row <= range.bottom; row += 1) {
            for (let col = range.left; col <= range.right; col += 1) {
              const numericValue = input.rawValues[row]?.[col];
              if (typeof numericValue !== "number" || !Number.isFinite(numericValue)) {
                continue;
              }
              const progress = clampUnitInterval((numericValue - min) / (max - min));
              mergeOverlayStyle(declarationsByCell, row, col, {
                "background-color": interpolateHexColor(startColor, endColor, progress),
              });
            }
          }
          continue;
        }

        if (ruleType === "dataBar" && numericValues.length > 0) {
          const min = resolveThresholdValue({
            threshold: (rule.cfvo as Array<Record<string, unknown>>)?.[0] ?? {},
            values: numericValues,
          });
          const max = resolveThresholdValue({
            threshold:
              (rule.cfvo as Array<Record<string, unknown>>)?.[
                Math.max(0, ((rule.cfvo as Array<Record<string, unknown>>) ?? []).length - 1)
              ] ?? {},
            values: numericValues,
          });
          const color = resolveWorkbookColorToCss(
            (rule.color ?? { argb: "FF638EC6" }) as Record<string, unknown>,
            input.theme,
          );
          if (!color || min === undefined || max === undefined || min === max) {
            continue;
          }

          for (let row = range.top; row <= range.bottom; row += 1) {
            for (let col = range.left; col <= range.right; col += 1) {
              const numericValue = input.rawValues[row]?.[col];
              if (typeof numericValue !== "number" || !Number.isFinite(numericValue)) {
                continue;
              }
              const key = `${row}:${col}`;
              overlaysByCell.set(key, {
                ...overlaysByCell.get(key),
                dataBarFillPercent: clampUnitInterval((numericValue - min) / (max - min)),
                dataBarColor: color,
                dataBarDirection: rule.direction === "rightToLeft" ? "rightToLeft" : "leftToRight",
              });
            }
          }
          continue;
        }

        if (ruleType === "iconSet" && numericValues.length > 0) {
          const thresholds = asArray(rule.cfvo as Array<Record<string, unknown>>)
            .map((threshold) => resolveThresholdValue({ threshold, values: numericValues }))
            .filter((value): value is number => typeof value === "number");
          if (thresholds.length === 0) {
            continue;
          }

          for (let row = range.top; row <= range.bottom; row += 1) {
            for (let col = range.left; col <= range.right; col += 1) {
              const numericValue = input.rawValues[row]?.[col];
              if (typeof numericValue !== "number" || !Number.isFinite(numericValue)) {
                continue;
              }
              let bucketIndex = 0;
              for (let index = 1; index < thresholds.length; index += 1) {
                if (numericValue >= thresholds[index]!) {
                  bucketIndex = index;
                }
              }

              const key = `${row}:${col}`;
              overlaysByCell.set(key, {
                ...overlaysByCell.get(key),
                iconKey: iconKeyForSet(rule.iconSet as string | undefined, bucketIndex),
              });
            }
          }
          continue;
        }

        if (ruleType === "containsText" && typeof rule.text === "string" && rule.style) {
          for (let row = range.top; row <= range.bottom; row += 1) {
            for (let col = range.left; col <= range.right; col += 1) {
              const rawValue = input.rawValues[row]?.[col];
              if (typeof rawValue !== "string" || !rawValue.includes(rule.text)) {
                continue;
              }
              mergeOverlayStyle(
                declarationsByCell,
                row,
                col,
                resolveStyleDeclarations({
                  style: rule.style as Partial<ExcelJS.Style>,
                  theme: input.theme,
                }),
              );
            }
          }
          continue;
        }

        if (ruleType === "cellIs" && Array.isArray(rule.formulae) && rule.style) {
          const thresholds = rule.formulae.map((formulaText) =>
            typeof formulaText === "string" ? parseLiteralFormulaValue(formulaText) : undefined,
          );
          if (thresholds.some((value) => value === undefined)) {
            continue;
          }

          const [leftThreshold, rightThreshold] = thresholds;
          for (let row = range.top; row <= range.bottom; row += 1) {
            for (let col = range.left; col <= range.right; col += 1) {
              const rawValue = input.rawValues[row]?.[col];
              let matches = false;
              switch (rule.operator) {
                case "between":
                  matches =
                    typeof rawValue === "number" &&
                    leftThreshold !== undefined &&
                    rightThreshold !== undefined &&
                    rawValue >= Number(leftThreshold) &&
                    rawValue <= Number(rightThreshold);
                  break;
                case "greaterThan":
                  matches =
                    typeof rawValue === "number" &&
                    leftThreshold !== undefined &&
                    rawValue > Number(leftThreshold);
                  break;
                case "lessThan":
                  matches =
                    typeof rawValue === "number" &&
                    leftThreshold !== undefined &&
                    rawValue < Number(leftThreshold);
                  break;
                case "equal":
                  matches = rawValue === leftThreshold;
                  break;
                default:
                  matches = false;
              }

              if (!matches) {
                continue;
              }
              mergeOverlayStyle(
                declarationsByCell,
                row,
                col,
                resolveStyleDeclarations({
                  style: rule.style as Partial<ExcelJS.Style>,
                  theme: input.theme,
                }),
              );
            }
          }
          continue;
        }

        if (ruleType === "top10" && rule.style && numericValues.length > 0) {
          const sortedValues = [...numericValues].toSorted((left, right) => left - right);
          const rank =
            typeof rule.rank === "number" && Number.isFinite(rule.rank)
              ? Math.max(1, rule.rank)
              : 10;
          const count = rule.percent
            ? Math.max(1, Math.ceil((sortedValues.length * rank) / 100))
            : Math.min(sortedValues.length, rank);
          const thresholdIndex = rule.bottom ? count - 1 : sortedValues.length - count;
          const threshold = sortedValues[Math.max(0, thresholdIndex)]!;

          for (let row = range.top; row <= range.bottom; row += 1) {
            for (let col = range.left; col <= range.right; col += 1) {
              const numericValue = input.rawValues[row]?.[col];
              if (typeof numericValue !== "number" || !Number.isFinite(numericValue)) {
                continue;
              }
              const matches = rule.bottom ? numericValue <= threshold : numericValue >= threshold;
              if (!matches) {
                continue;
              }
              mergeOverlayStyle(
                declarationsByCell,
                row,
                col,
                resolveStyleDeclarations({
                  style: rule.style as Partial<ExcelJS.Style>,
                  theme: input.theme,
                }),
              );
            }
          }
          continue;
        }

        if (ruleType === "aboveAverage" && rule.style && numericValues.length > 0) {
          const average =
            numericValues.reduce((sum, numericValue) => sum + numericValue, 0) /
            numericValues.length;
          const shouldMatchAbove = rule.aboveAverage !== false;
          for (let row = range.top; row <= range.bottom; row += 1) {
            for (let col = range.left; col <= range.right; col += 1) {
              const numericValue = input.rawValues[row]?.[col];
              if (typeof numericValue !== "number" || !Number.isFinite(numericValue)) {
                continue;
              }
              const matches = shouldMatchAbove ? numericValue > average : numericValue < average;
              if (!matches) {
                continue;
              }
              mergeOverlayStyle(
                declarationsByCell,
                row,
                col,
                resolveStyleDeclarations({
                  style: rule.style as Partial<ExcelJS.Style>,
                  theme: input.theme,
                }),
              );
            }
          }
        }
      }
    }
  }

  const overlays: ProjectWorkbookConditionalOverlay[] = [];
  for (const [cellKey, overlay] of overlaysByCell) {
    const [rowText, colText] = cellKey.split(":");
    const row = Number.parseInt(rowText ?? "0", 10);
    const col = Number.parseInt(colText ?? "0", 10);
    const styleId = input.registerStyle(declarationsByCell.get(cellKey) ?? {});
    overlays.push({
      row,
      col,
      ...(styleId === undefined ? {} : { styleId }),
      ...(overlay.dataBarFillPercent === undefined
        ? {}
        : { dataBarFillPercent: overlay.dataBarFillPercent }),
      ...(overlay.dataBarColor ? { dataBarColor: overlay.dataBarColor } : {}),
      ...(overlay.dataBarDirection ? { dataBarDirection: overlay.dataBarDirection } : {}),
      ...(overlay.iconKey ? { iconKey: overlay.iconKey } : {}),
      ...(overlay.iconColor ? { iconColor: overlay.iconColor } : {}),
    });
  }

  for (const [cellKey, declarations] of declarationsByCell) {
    if (overlaysByCell.has(cellKey)) {
      continue;
    }
    const [rowText, colText] = cellKey.split(":");
    const styleId = input.registerStyle(declarations);
    if (styleId === undefined) {
      continue;
    }
    overlays.push({
      row: Number.parseInt(rowText ?? "0", 10),
      col: Number.parseInt(colText ?? "0", 10),
      styleId,
    });
  }

  return overlays;
}

function mediaMimeTypeForExtension(extension: string | undefined) {
  switch ((extension ?? "").toLowerCase()) {
    case "png":
      return "image/png";
    case "gif":
      return "image/gif";
    case "jpg":
    case "jpeg":
      return "image/jpeg";
    default:
      return "application/octet-stream";
  }
}

export async function readWorkbookPresentationSnapshot(input: {
  bytes: Uint8Array;
  relativePath: string;
  mtimeMs: number;
  sizeBytes: number;
}): Promise<ProjectReadWorkbookPresentationFileResult> {
  const workbook = new ExcelJS.Workbook();
  await (workbook.xlsx.load as unknown as (buffer: Uint8Array) => Promise<unknown>)(input.bytes);

  if (workbook.worksheets.length === 0) {
    throw new Error(`Spreadsheet workbook does not contain any worksheets: ${input.relativePath}`);
  }

  if (workbook.worksheets.length > PROJECT_TABULAR_MAX_SHEETS) {
    throw new Error(
      `Spreadsheet has too many sheets for Room (${PROJECT_TABULAR_MAX_SHEETS} max): ${input.relativePath}`,
    );
  }

  const measuredLayouts = new Map<number, MeasuredWorksheetLayout>();
  let totalCellCount = 0;
  for (const worksheet of workbook.worksheets) {
    const worksheetModel = worksheet.model as WorksheetModelWithPresentation;
    const measuredLayout = measureWorksheetLayout(worksheet, worksheetModel);
    if (measuredLayout.columnCount > PROJECT_TABULAR_MAX_COLUMNS) {
      throw new Error(
        `Spreadsheet has too many columns for Room (${PROJECT_TABULAR_MAX_COLUMNS} max): ${input.relativePath}`,
      );
    }
    totalCellCount += measuredLayout.rowCount * measuredLayout.columnCount;
    measuredLayouts.set(worksheet.id, measuredLayout);
  }

  if (totalCellCount > PROJECT_TABULAR_MAX_TOTAL_CELLS) {
    throw new Error(
      `Spreadsheet exceeds the Room preview limits (${PROJECT_TABULAR_MAX_TOTAL_CELLS.toLocaleString()} cells max): ${input.relativePath}`,
    );
  }

  const zip = await readWorkbookZip(input.bytes);
  const unsupportedVisualReason = await detectUnsupportedWorkbookVisualReason({
    zip,
    workbook,
  });
  const theme = parseWorkbookThemeXml(workbook.model.themes?.[0]);
  const dateSystem = workbook.properties.date1904 ? "1904" : "1900";

  if (unsupportedVisualReason) {
    return {
      relativePath: input.relativePath,
      previewKind: "workbook-presentation",
      kind: "xlsx",
      sizeBytes: input.sizeBytes,
      mtimeMs: input.mtimeMs,
      capabilities: { canEditInRoom: false },
      presentationFidelity: "full",
      previewNotices: [],
      dateSystem,
      theme,
      styles: [],
      sheets: [],
      unsupportedVisualReason,
    };
  }

  const zipCommentsBySheetName = await readCommentsBySheetName({ zip, workbook });
  const styles: ProjectWorkbookStyleAtlasEntry[] = [];
  const styleIdByHash = new Map<string, number>();
  const registerStyle = (declarations: Record<string, string>) => {
    const filteredDeclarations = Object.fromEntries(
      Object.entries(declarations).filter(([, value]) => value.trim().length > 0),
    );
    if (Object.keys(filteredDeclarations).length === 0) {
      return undefined;
    }
    const styleHash = hashCssDeclarations(filteredDeclarations);
    const existing = styleIdByHash.get(styleHash);
    if (existing !== undefined) {
      return existing;
    }
    const nextId = styles.length;
    styles.push({ declarations: filteredDeclarations });
    styleIdByHash.set(styleHash, nextId);
    return nextId;
  };

  const sheets: ProjectWorkbookPresentationSheet[] = workbook.worksheets.map((worksheet) => {
    const worksheetModel = worksheet.model as WorksheetModelWithPresentation;
    const measuredLayout = measuredLayouts.get(worksheet.id);
    if (!measuredLayout) {
      throw new Error(`Unable to resolve worksheet layout for ${worksheet.name}.`);
    }
    const { rowCount, columnCount, merges } = measuredLayout;

    const hiddenRowsSet = new Set<number>(
      (worksheetModel.rows ?? []).flatMap((row) =>
        row.hidden === true && typeof row.number === "number" ? [row.number - 1] : [],
      ),
    );
    const hiddenColumnsSet = new Set<number>();
    for (const column of worksheetModel.cols ?? []) {
      if (column.hidden !== true) {
        continue;
      }
      const start = column.min ?? column.max;
      const end = column.max ?? column.min;
      if (start === undefined || end === undefined) {
        continue;
      }
      for (let current = start; current <= end; current += 1) {
        hiddenColumnsSet.add(current - 1);
      }
    }

    const rowHeightsPx = Array.from({ length: rowCount }, (_, rowIndex) =>
      hiddenRowsSet.has(rowIndex)
        ? 0
        : rowHeightToPx(
            worksheet.getRow(rowIndex + 1).height ?? worksheet.properties.defaultRowHeight,
          ),
    );
    const columnWidthsPx = Array.from({ length: columnCount }, (_, columnIndex) =>
      hiddenColumnsSet.has(columnIndex)
        ? 0
        : columnWidthToPx(
            worksheet.getColumn(columnIndex + 1).width ?? worksheet.properties.defaultColWidth,
          ),
    );

    const rawValues = buildDisplayMatrix<ProjectTabularCellValue>(rowCount, columnCount, null);
    const displayText = buildDisplayMatrix<string>(rowCount, columnCount, "");
    const valueKinds = buildDisplayMatrix<ProjectTabularCellValueKind>(
      rowCount,
      columnCount,
      "empty",
    );
    const styleIds = buildDisplayMatrix<number | null>(rowCount, columnCount, null);

    for (let rowIndex = 0; rowIndex < rowCount; rowIndex += 1) {
      for (let colIndex = 0; colIndex < columnCount; colIndex += 1) {
        const cell = worksheet.getCell(rowIndex + 1, colIndex + 1);
        const snapshot = resolvePresentationCellSnapshot(cell);
        rawValues[rowIndex]![colIndex] = snapshot.contractValue;
        valueKinds[rowIndex]![colIndex] = snapshot.valueKind;
        displayText[rowIndex]![colIndex] = formatExcelDisplayText({
          value: snapshot.displaySource,
          valueKind: snapshot.valueKind,
          formatCode: cell.numFmt,
          dateSystem,
        });
        styleIds[rowIndex]![colIndex] =
          registerStyle(
            resolveStyleDeclarations({
              style: snapshot.style,
              theme,
            }),
          ) ?? null;
      }
    }

    const images = buildSheetImages({
      worksheet,
      columnWidthsPx,
      rowHeightsPx,
    });

    const conditionalOverlays = buildConditionalOverlays({
      worksheetModel,
      rawValues,
      valueKinds,
      theme,
      registerStyle,
    });

    const frozenView = (worksheet.views ?? []).find((view) => view?.state === "frozen") as
      | Partial<ExcelJS.WorksheetViewFrozen>
      | undefined;
    const frozenPane =
      frozenView && (frozenView.xSplit || frozenView.ySplit)
        ? {
            rowCount: Math.max(0, frozenView.ySplit ?? 0),
            columnCount: Math.max(0, frozenView.xSplit ?? 0),
          }
        : undefined;

    return {
      name: worksheet.name,
      state: worksheet.state ?? "visible",
      ...(resolveWorkbookColorToCss(
        worksheet.properties.tabColor as Parameters<typeof resolveWorkbookColorToCss>[0],
        theme,
      )
        ? {
            tabColor: resolveWorkbookColorToCss(
              worksheet.properties.tabColor as Parameters<typeof resolveWorkbookColorToCss>[0],
              theme,
            ),
          }
        : {}),
      showGridLines:
        (
          (worksheet.views ?? []).find((view) => view?.showGridLines === false) as
            | { showGridLines?: boolean }
            | undefined
        )?.showGridLines !== false,
      rowCount,
      columnCount,
      rawValues,
      displayText,
      valueKinds,
      styleIds,
      merges,
      hiddenRows: [...hiddenRowsSet].toSorted((left, right) => left - right),
      hiddenColumns: [...hiddenColumnsSet].toSorted((left, right) => left - right),
      ...(frozenPane ? { frozenPane } : {}),
      rowHeights: rowHeightsPx.map((height) => height || null),
      columnWidths: columnWidthsPx.map((width) => width || null),
      comments: zipCommentsBySheetName.get(worksheet.name) ?? [],
      images: images.images,
      ...(images.backgroundMediaId ? { backgroundMediaId: images.backgroundMediaId } : {}),
      conditionalOverlays,
    } satisfies ProjectWorkbookPresentationSheet;
  });

  return {
    relativePath: input.relativePath,
    previewKind: "workbook-presentation",
    kind: "xlsx",
    sizeBytes: input.sizeBytes,
    mtimeMs: input.mtimeMs,
    capabilities: { canEditInRoom: false },
    presentationFidelity: "full",
    previewNotices: [],
    dateSystem,
    theme,
    styles,
    sheets,
  };
}

export async function readWorkbookPresentationMedia(input: {
  bytes: Uint8Array;
  mediaId: string;
}): Promise<ProjectReadTabularMediaResult> {
  const workbook = new ExcelJS.Workbook();
  await (workbook.xlsx.load as unknown as (buffer: Uint8Array) => Promise<unknown>)(input.bytes);

  const mediaIndex = Number.parseInt(input.mediaId, 10);
  if (!Number.isInteger(mediaIndex) || mediaIndex < 0) {
    throw new Error(`Unknown workbook media asset: ${input.mediaId}`);
  }

  const medium = workbook.model.media?.[mediaIndex];
  if (!medium || medium.type !== "image" || !medium.buffer) {
    throw new Error(`Unknown workbook media asset: ${input.mediaId}`);
  }

  return {
    mediaId: input.mediaId,
    mimeType: mediaMimeTypeForExtension(medium.extension),
    contentBase64: Buffer.from(medium.buffer).toString("base64"),
  };
}

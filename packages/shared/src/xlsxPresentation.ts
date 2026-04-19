import type { ProjectTabularCellValue, ProjectTabularCellValueKind } from "@t3tools/contracts";
import SSF from "ssf";

const DEFAULT_THEME = {
  name: "Office Theme",
  colors: {
    dk1: "#000000",
    lt1: "#FFFFFF",
    dk2: "#1F497D",
    lt2: "#EEECE1",
    accent1: "#4F81BD",
    accent2: "#C0504D",
    accent3: "#9BBB59",
    accent4: "#8064A2",
    accent5: "#4BACC6",
    accent6: "#F79646",
    hlink: "#0000FF",
    folHlink: "#800080",
  },
  majorLatinFont: "Cambria",
  minorLatinFont: "Calibri",
} as const;

const THEME_COLOR_KEYS = [
  "dk1",
  "lt1",
  "dk2",
  "lt2",
  "accent1",
  "accent2",
  "accent3",
  "accent4",
  "accent5",
  "accent6",
  "hlink",
  "folHlink",
] as const;

const THEME_COLOR_INDEX_TO_KEY = [
  "dk1",
  "lt1",
  "dk2",
  "lt2",
  "accent1",
  "accent2",
  "accent3",
  "accent4",
  "accent5",
  "accent6",
  "hlink",
  "folHlink",
] as const;

type ThemeColorKey = (typeof THEME_COLOR_KEYS)[number];

type ExcelColorLike = {
  argb?: string | null;
  theme?: number | null;
  tint?: number | null;
  indexed?: number | null;
};

export type ResolvedWorkbookTheme = {
  name?: string;
  colors: Record<string, string>;
  majorLatinFont?: string;
  minorLatinFont?: string;
};

function colorTagRegex(tagName: ThemeColorKey) {
  return new RegExp(`<(?:\\w+:)?${tagName}[^>]*>([\\s\\S]*?)<\\/(?:\\w+:)?${tagName}>`, "i");
}

function matchTagContents(xml: string, tagName: string) {
  return new RegExp(`<${tagName}[^>]*>([\\s\\S]*?)<\\/${tagName}>`, "i").exec(xml)?.[1];
}

function normalizeHex(hexValue: string) {
  const sanitized = hexValue.replace(/[^0-9a-f]/gi, "").toUpperCase();
  if (sanitized.length === 8) {
    return sanitized;
  }
  if (sanitized.length === 6) {
    return `FF${sanitized}`;
  }
  return undefined;
}

export function argbToCssColor(argb: string | null | undefined) {
  const normalized = argb ? normalizeHex(argb) : undefined;
  if (!normalized) {
    return undefined;
  }

  const alpha = Number.parseInt(normalized.slice(0, 2), 16) / 255;
  const red = Number.parseInt(normalized.slice(2, 4), 16);
  const green = Number.parseInt(normalized.slice(4, 6), 16);
  const blue = Number.parseInt(normalized.slice(6, 8), 16);

  if (alpha >= 0.999) {
    return `#${normalized.slice(2)}`;
  }

  return `rgba(${red}, ${green}, ${blue}, ${alpha.toFixed(3).replace(/0+$/, "").replace(/[.]$/, "")})`;
}

function parseHexRgbToChannels(hexColor: string) {
  const normalized = hexColor.replace("#", "");
  return {
    red: Number.parseInt(normalized.slice(0, 2), 16),
    green: Number.parseInt(normalized.slice(2, 4), 16),
    blue: Number.parseInt(normalized.slice(4, 6), 16),
  };
}

function clampChannel(value: number) {
  return Math.max(0, Math.min(255, Math.round(value)));
}

function channelsToHex(input: { red: number; green: number; blue: number }) {
  return `#${[input.red, input.green, input.blue]
    .map((channel) => clampChannel(channel).toString(16).padStart(2, "0"))
    .join("")
    .toUpperCase()}`;
}

export function applyExcelTint(hexColor: string, tint: number) {
  if (!Number.isFinite(tint) || tint === 0) {
    return hexColor;
  }

  const channels = parseHexRgbToChannels(hexColor);
  const transform = (channel: number) => {
    if (tint < 0) {
      return channel * (1 + tint);
    }
    return channel * (1 - tint) + 255 * tint;
  };

  return channelsToHex({
    red: transform(channels.red),
    green: transform(channels.green),
    blue: transform(channels.blue),
  });
}

export function parseWorkbookThemeXml(themeXml: string | undefined): ResolvedWorkbookTheme {
  if (!themeXml || themeXml.trim().length === 0) {
    return {
      name: DEFAULT_THEME.name,
      colors: { ...DEFAULT_THEME.colors },
      majorLatinFont: DEFAULT_THEME.majorLatinFont,
      minorLatinFont: DEFAULT_THEME.minorLatinFont,
    };
  }

  const colors = { ...DEFAULT_THEME.colors } as Record<string, string>;
  for (const themeKey of THEME_COLOR_KEYS) {
    const contents = colorTagRegex(themeKey).exec(themeXml)?.[1];
    if (!contents) {
      continue;
    }

    const srgb = /<(?:\w+:)?srgbClr[^>]*val="([0-9A-Fa-f]{6})"/.exec(contents)?.[1];
    if (srgb) {
      colors[themeKey] = `#${srgb.toUpperCase()}`;
      continue;
    }

    const systemColor = /<(?:\w+:)?sysClr[^>]*lastClr="([0-9A-Fa-f]{6})"/.exec(contents)?.[1];
    if (systemColor) {
      colors[themeKey] = `#${systemColor.toUpperCase()}`;
    }
  }

  const majorFontContents = matchTagContents(themeXml, "(?:\\w+:)?majorFont");
  const minorFontContents = matchTagContents(themeXml, "(?:\\w+:)?minorFont");
  const majorLatinFont =
    /<(?:\w+:)?latin[^>]*typeface="([^"]+)"/.exec(majorFontContents ?? "")?.[1] ??
    DEFAULT_THEME.majorLatinFont;
  const minorLatinFont =
    /<(?:\w+:)?latin[^>]*typeface="([^"]+)"/.exec(minorFontContents ?? "")?.[1] ??
    DEFAULT_THEME.minorLatinFont;
  const themeName = /<(?:\w+:)?theme[^>]*name="([^"]+)"/.exec(themeXml)?.[1] ?? DEFAULT_THEME.name;

  return {
    name: themeName,
    colors,
    majorLatinFont,
    minorLatinFont,
  };
}

export function resolveWorkbookColorToCss(
  color: ExcelColorLike | null | undefined,
  theme: ResolvedWorkbookTheme,
) {
  if (!color) {
    return undefined;
  }

  if (color.argb) {
    return argbToCssColor(color.argb);
  }

  if (typeof color.theme === "number") {
    const themeKey = THEME_COLOR_INDEX_TO_KEY[color.theme];
    const baseColor = themeKey ? theme.colors[themeKey] : undefined;
    if (!baseColor) {
      return undefined;
    }
    return typeof color.tint === "number" ? applyExcelTint(baseColor, color.tint) : baseColor;
  }

  return undefined;
}

export function hashCssDeclarations(declarations: Readonly<Record<string, string>>) {
  const normalizedEntries = Object.entries(declarations)
    .filter(([, value]) => value.trim().length > 0)
    .toSorted(([left], [right]) => left.localeCompare(right));

  let hash = 2166136261;
  const serialized = normalizedEntries.map(([key, value]) => `${key}:${value};`).join("");
  for (let index = 0; index < serialized.length; index += 1) {
    hash ^= serialized.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }

  return `xlsx-${(hash >>> 0).toString(36)}`;
}

function excelDateSerialFromDate(dateValue: Date, dateSystem: "1900" | "1904") {
  const utcValue = Date.UTC(
    dateValue.getUTCFullYear(),
    dateValue.getUTCMonth(),
    dateValue.getUTCDate(),
    dateValue.getUTCHours(),
    dateValue.getUTCMinutes(),
    dateValue.getUTCSeconds(),
    dateValue.getUTCMilliseconds(),
  );
  const epoch = dateSystem === "1904" ? Date.UTC(1904, 0, 1) : Date.UTC(1899, 11, 30);
  return (utcValue - epoch) / 86_400_000;
}

export function formatExcelDisplayText(input: {
  value: unknown;
  valueKind?: ProjectTabularCellValueKind;
  formatCode?: string | null | undefined;
  dateSystem: "1900" | "1904";
}) {
  const { formatCode } = input;
  if (input.value === null || input.value === undefined) {
    return "";
  }

  if (typeof input.value === "string") {
    return input.value;
  }

  if (typeof input.value === "boolean") {
    return input.value ? "TRUE" : "FALSE";
  }

  if (!formatCode || formatCode.trim().length === 0) {
    if (input.value instanceof Date) {
      return input.value.toISOString();
    }
    return String(input.value);
  }

  try {
    if (typeof input.value === "number") {
      return SSF.format(formatCode, input.value);
    }
    if (input.value instanceof Date) {
      return SSF.format(formatCode, excelDateSerialFromDate(input.value, input.dateSystem));
    }
  } catch {
    // Fall through to a simpler display value when SSF can't interpret the format code.
  }

  if (input.value instanceof Date) {
    return input.value.toISOString();
  }

  return String(input.value);
}

export function isBuiltInExcelTableTheme(themeName: string | null | undefined) {
  if (!themeName) {
    return false;
  }
  return /^TableStyle(?:Light|Medium|Dark)\d+$/i.test(themeName);
}

export function hasCrossSheetReference(formulaText: string | null | undefined) {
  if (!formulaText) {
    return false;
  }
  return /(?:'[^']+'|[A-Za-z0-9_]+)!/.test(formulaText);
}

export function findUnsupportedDrawingVisualReason(drawingXml: string) {
  if (/<(?:\w+:)?chart\b/i.test(drawingXml)) {
    return "This workbook contains chart visuals that Room can’t render yet.";
  }
  if (/<(?:\w+:)?sp\b/i.test(drawingXml) || /<(?:\w+:)?cxnSp\b/i.test(drawingXml)) {
    return "This workbook contains drawing shapes that Room can’t render yet.";
  }
  if (/<(?:\w+:)?graphicFrame\b/i.test(drawingXml)) {
    return "This workbook contains embedded workbook graphics that Room can’t render yet.";
  }
  if (/<(?:\w+:)?grpSp\b/i.test(drawingXml) || /<(?:\w+:)?contentPart\b/i.test(drawingXml)) {
    return "This workbook contains grouped drawing content that Room can’t render yet.";
  }
  return undefined;
}

export function buildDisplayMatrix<T>(
  rowCount: number,
  columnCount: number,
  initialValue: T,
): T[][] {
  return Array.from({ length: rowCount }, () =>
    Array.from({ length: columnCount }, () => initialValue),
  );
}

export function clampUnitInterval(value: number) {
  return Math.max(0, Math.min(1, value));
}

export function normalizeCellValueForContracts(value: unknown): {
  value: ProjectTabularCellValue;
  valueKind: ProjectTabularCellValueKind;
} {
  if (value === null || value === undefined) {
    return { value: null, valueKind: "empty" };
  }
  if (value instanceof Date) {
    return { value: value.toISOString(), valueKind: "date" };
  }
  if (typeof value === "number" && Number.isFinite(value)) {
    return { value, valueKind: "number" };
  }
  if (typeof value === "boolean") {
    return { value, valueKind: "boolean" };
  }
  return { value: String(value), valueKind: "text" };
}

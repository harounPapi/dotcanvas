const MARKDOWN_FILE_EXTENSIONS = [".md", ".mdx", ".markdown"] as const;
const DELIMITED_TABULAR_FILE_KIND_BY_EXTENSION = {
  ".csv": "csv",
  ".tsv": "tsv",
  ".psv": "psv",
  ".tab": "tab",
  ".txt": "txt",
  ".dat": "dat",
} as const;
const WORKBOOK_TABULAR_FILE_KIND_BY_EXTENSION = {
  ".xlsx": "xlsx",
  ".xlsm": "xlsm",
  ".xlsb": "xlsb",
  ".xls": "xls",
  ".ods": "ods",
  ".fods": "fods",
} as const;
const DOCUMENT_FILE_KIND_BY_EXTENSION = {
  ".pdf": "pdf",
  ".docx": "docx",
} as const;
const TABULAR_FILE_KIND_BY_EXTENSION = {
  ...DELIMITED_TABULAR_FILE_KIND_BY_EXTENSION,
  ...WORKBOOK_TABULAR_FILE_KIND_BY_EXTENSION,
} as const;
const DELIMITED_TABULAR_DELIMITERS = [",", "\t", ";", "|"] as const;
const DEFAULT_DELIMITER_BY_DELIMITED_KIND = {
  csv: ",",
  tsv: "\t",
  psv: "|",
  tab: "\t",
  txt: ",",
  dat: ",",
} as const;
const DELIMITER_CANDIDATES_BY_KIND = {
  csv: [",", ";", "|", "\t"],
  tsv: ["\t", ",", ";", "|"],
  psv: ["|", ",", ";", "\t"],
  tab: ["\t", "|", ",", ";"],
  txt: [",", "\t", ";", "|"],
  dat: [",", "\t", ";", "|"],
} as const;

export type SupportedDelimitedTabularFileKind =
  (typeof DELIMITED_TABULAR_FILE_KIND_BY_EXTENSION)[keyof typeof DELIMITED_TABULAR_FILE_KIND_BY_EXTENSION];
export type SupportedWorkbookTabularFileKind =
  (typeof WORKBOOK_TABULAR_FILE_KIND_BY_EXTENSION)[keyof typeof WORKBOOK_TABULAR_FILE_KIND_BY_EXTENSION];
export type SupportedTabularFileKind =
  | SupportedDelimitedTabularFileKind
  | SupportedWorkbookTabularFileKind;
export type SupportedDocumentFileKind =
  (typeof DOCUMENT_FILE_KIND_BY_EXTENSION)[keyof typeof DOCUMENT_FILE_KIND_BY_EXTENSION];
export type SupportedDelimitedTabularDelimiter = (typeof DELIMITED_TABULAR_DELIMITERS)[number];
export type SupportedTabularLineEnding = "\n" | "\r\n" | "\r";

export type FilePreviewDescriptor =
  | { kind: "markdown" }
  | { kind: "tabular"; tabularKind: SupportedTabularFileKind }
  | { kind: "document"; documentKind: SupportedDocumentFileKind }
  | { kind: "unsupported" };

type DelimiterScore = {
  consistency: number;
  delimiter: SupportedDelimitedTabularDelimiter;
  matchingLineCount: number;
  modeFieldCount: number;
};

function normalizePreviewPath(pathValue: string): string {
  return pathValue.replaceAll("\\", "/").toLowerCase();
}

function isNonEmptyLine(line: string) {
  return line.trim().length > 0;
}

function splitPreviewLines(text: string) {
  return text
    .replace(/^\uFEFF/, "")
    .split(/\r\n|\n|\r/)
    .filter(isNonEmptyLine)
    .slice(0, 32);
}

function countDelimitedFields(line: string, delimiter: SupportedDelimitedTabularDelimiter) {
  let fieldCount = 1;
  let inQuotes = false;

  for (let index = 0; index < line.length; index += 1) {
    const currentCharacter = line[index];

    if (currentCharacter === '"') {
      const nextCharacter = line[index + 1];
      if (inQuotes && nextCharacter === '"') {
        index += 1;
        continue;
      }

      inQuotes = !inQuotes;
      continue;
    }

    if (!inQuotes && currentCharacter === delimiter) {
      fieldCount += 1;
    }
  }

  return fieldCount;
}

function delimiterScore(
  lines: ReadonlyArray<string>,
  delimiter: SupportedDelimitedTabularDelimiter,
): DelimiterScore | null {
  const fieldCounts = lines
    .map((line) => countDelimitedFields(line, delimiter))
    .filter((fieldCount) => fieldCount > 1);

  if (fieldCounts.length < 2) {
    return null;
  }

  const frequencyByFieldCount = new Map<number, number>();
  for (const fieldCount of fieldCounts) {
    frequencyByFieldCount.set(fieldCount, (frequencyByFieldCount.get(fieldCount) ?? 0) + 1);
  }

  let matchingLineCount = 0;
  let modeFieldCount = 0;
  for (const [fieldCount, frequency] of frequencyByFieldCount) {
    if (
      frequency > matchingLineCount ||
      (frequency === matchingLineCount && fieldCount > modeFieldCount)
    ) {
      matchingLineCount = frequency;
      modeFieldCount = fieldCount;
    }
  }

  return {
    delimiter,
    consistency: matchingLineCount / fieldCounts.length,
    matchingLineCount,
    modeFieldCount,
  };
}

function preferredDelimitersForKind(kind: SupportedDelimitedTabularFileKind) {
  return [...DELIMITER_CANDIDATES_BY_KIND[kind]];
}

export function classifyFilePreview(pathValue: string): FilePreviewDescriptor {
  const normalizedPath = normalizePreviewPath(pathValue);

  for (const extension of MARKDOWN_FILE_EXTENSIONS) {
    if (normalizedPath.endsWith(extension)) {
      return { kind: "markdown" };
    }
  }

  for (const [extension, tabularKind] of Object.entries(TABULAR_FILE_KIND_BY_EXTENSION)) {
    if (normalizedPath.endsWith(extension)) {
      return { kind: "tabular", tabularKind };
    }
  }

  for (const [extension, documentKind] of Object.entries(DOCUMENT_FILE_KIND_BY_EXTENSION)) {
    if (normalizedPath.endsWith(extension)) {
      return { kind: "document", documentKind };
    }
  }

  return { kind: "unsupported" };
}

export function isMarkdownPreviewPath(pathValue: string): boolean {
  return classifyFilePreview(pathValue).kind === "markdown";
}

export function isTabularPreviewPath(pathValue: string): boolean {
  return classifyFilePreview(pathValue).kind === "tabular";
}

export function isDocumentPreviewPath(pathValue: string): boolean {
  return classifyFilePreview(pathValue).kind === "document";
}

export function isDelimitedTabularFileKind(
  kind: SupportedTabularFileKind,
): kind is SupportedDelimitedTabularFileKind {
  return kind in DEFAULT_DELIMITER_BY_DELIMITED_KIND;
}

export function isWorkbookTabularFileKind(
  kind: SupportedTabularFileKind,
): kind is SupportedWorkbookTabularFileKind {
  return kind in WORKBOOK_TABULAR_FILE_KIND_BY_EXTENSION;
}

export function isSniffedTextTabularFileKind(
  kind: SupportedDelimitedTabularFileKind,
): kind is "txt" | "tab" | "psv" | "dat" {
  return kind === "txt" || kind === "tab" || kind === "psv" || kind === "dat";
}

export function defaultDelimiterForTabularKind(
  kind: SupportedDelimitedTabularFileKind,
): SupportedDelimitedTabularDelimiter {
  return DEFAULT_DELIMITER_BY_DELIMITED_KIND[kind];
}

export function detectDominantLineEnding(text: string): SupportedTabularLineEnding {
  const carriageReturnLineFeedCount = text.match(/\r\n/g)?.length ?? 0;
  const loneCarriageReturnCount = text.match(/\r(?!\n)/g)?.length ?? 0;
  const loneLineFeedCount = text.match(/(?<!\r)\n/g)?.length ?? 0;

  if (
    carriageReturnLineFeedCount >= loneCarriageReturnCount &&
    carriageReturnLineFeedCount >= loneLineFeedCount
  ) {
    return carriageReturnLineFeedCount > 0 ? "\r\n" : "\n";
  }
  if (loneCarriageReturnCount >= loneLineFeedCount) {
    return "\r";
  }
  return "\n";
}

export function detectLikelyDelimitedTextFormat(input: {
  kind: SupportedDelimitedTabularFileKind;
  text: string;
}): {
  delimiter: SupportedDelimitedTabularDelimiter;
  lineEnding: SupportedTabularLineEnding;
} | null {
  const lineEnding = detectDominantLineEnding(input.text);
  const lines = splitPreviewLines(input.text);
  const defaultDelimiter = defaultDelimiterForTabularKind(input.kind);

  if (lines.length === 0) {
    return isSniffedTextTabularFileKind(input.kind)
      ? null
      : { delimiter: defaultDelimiter, lineEnding };
  }

  const bestScore = preferredDelimitersForKind(input.kind)
    .map((delimiter) => delimiterScore(lines, delimiter))
    .filter((score): score is DelimiterScore => score !== null)
    .toSorted((left, right) => {
      if (right.matchingLineCount !== left.matchingLineCount) {
        return right.matchingLineCount - left.matchingLineCount;
      }
      if (right.consistency !== left.consistency) {
        return right.consistency - left.consistency;
      }
      return right.modeFieldCount - left.modeFieldCount;
    })[0];

  if (!bestScore) {
    return isSniffedTextTabularFileKind(input.kind)
      ? null
      : { delimiter: defaultDelimiter, lineEnding };
  }

  const requiresStrictSniffing = input.kind === "txt" || input.kind === "dat";
  const hasEnoughEvidence = requiresStrictSniffing
    ? bestScore.matchingLineCount >= 3 ||
      (bestScore.matchingLineCount >= 2 && bestScore.modeFieldCount >= 3)
    : bestScore.matchingLineCount >= 2;

  if (
    isSniffedTextTabularFileKind(input.kind) &&
    (!hasEnoughEvidence || bestScore.consistency < 0.8)
  ) {
    return null;
  }

  if (bestScore.consistency < 0.6) {
    return { delimiter: defaultDelimiter, lineEnding };
  }

  return {
    delimiter: bestScore.delimiter,
    lineEnding,
  };
}

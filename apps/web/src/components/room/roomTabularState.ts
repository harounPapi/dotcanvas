import type {
  ProjectReadDelimitedGridFileResult,
  ProjectTabularCellPatch,
  ProjectTabularCellValue,
  ProjectTabularCellValueKind,
  ProjectTabularSheet,
  ProjectTabularSheetCellMeta,
} from "@t3tools/contracts";

export type TabularDraftPatchRecord = Record<string, ProjectTabularCellPatch>;

function sheetCellKey(row: number, col: number) {
  return `${row}:${col}`;
}

export function tabularDraftPatchKey(sheetName: string, row: number, col: number) {
  return `${sheetName}\u0000${sheetCellKey(row, col)}`;
}

export function createTabularSheetCellMetaLookup(sheet: ProjectTabularSheet) {
  const entries: Record<string, ProjectTabularSheetCellMeta> = {};
  for (const meta of sheet.cellMeta) {
    entries[sheetCellKey(meta.row, meta.col)] = meta;
  }
  return entries;
}

export function readTabularSheetCellValue(
  sheet: ProjectTabularSheet,
  row: number,
  col: number,
): ProjectTabularCellValue {
  return sheet.data[row]?.[col] ?? null;
}

function inferDefaultValueKind(value: ProjectTabularCellValue): ProjectTabularCellValueKind {
  if (value === null) {
    return "empty";
  }
  if (typeof value === "number") {
    return "number";
  }
  if (typeof value === "boolean") {
    return "boolean";
  }
  return "text";
}

export function readTabularSheetCellKind(
  sheet: ProjectTabularSheet,
  metaLookup: Record<string, ProjectTabularSheetCellMeta>,
  row: number,
  col: number,
): ProjectTabularCellValueKind {
  const meta = metaLookup[sheetCellKey(row, col)];
  if (meta) {
    return meta.valueKind;
  }

  return inferDefaultValueKind(readTabularSheetCellValue(sheet, row, col));
}

function patchRecordForSheet(
  draftPatches: TabularDraftPatchRecord,
  sheetName: string,
): ReadonlyArray<ProjectTabularCellPatch> {
  return Object.values(draftPatches).filter((patch) => patch.sheetName === sheetName);
}

export function buildTabularSheetDisplayData(
  sheet: ProjectTabularSheet,
  draftPatches: TabularDraftPatchRecord,
): Array<Array<ProjectTabularCellValue>> {
  const rows = sheet.data.map((row) => [...row]);
  const rowCount = Math.max(sheet.rowCount, rows.length);
  const columnCount = sheet.columnCount;

  while (rows.length < rowCount) {
    rows.push(Array.from({ length: columnCount }, () => null));
  }

  for (const patch of patchRecordForSheet(draftPatches, sheet.name)) {
    while (rows.length <= patch.row) {
      rows.push(Array.from({ length: columnCount }, () => null));
    }
    const targetRow = rows[patch.row]!;
    while (targetRow.length <= patch.col) {
      targetRow.push(null);
    }
    targetRow[patch.col] = patch.value;
  }

  return rows;
}

function inferPatchedCellKind(input: {
  baseKind: ProjectTabularCellValueKind;
  nextValue: unknown;
}): { value: ProjectTabularCellValue; valueKind: ProjectTabularCellValueKind } {
  if (input.nextValue === null || input.nextValue === undefined || input.nextValue === "") {
    return { value: null, valueKind: "empty" };
  }

  if (typeof input.nextValue === "boolean") {
    return { value: input.nextValue, valueKind: "boolean" };
  }

  if (typeof input.nextValue === "number" && Number.isFinite(input.nextValue)) {
    return { value: input.nextValue, valueKind: "number" };
  }

  const nextText = String(input.nextValue);
  if (
    input.baseKind === "date" &&
    nextText.trim().length > 0 &&
    !Number.isNaN(Date.parse(nextText))
  ) {
    return { value: nextText, valueKind: "date" };
  }

  return { value: nextText, valueKind: "text" };
}

function areTabularCellValuesEqual(
  left: ProjectTabularCellValue,
  right: ProjectTabularCellValue,
): boolean {
  return left === right;
}

export function applyTabularDraftEdits(input: {
  sheet: ProjectTabularSheet;
  metaLookup: Record<string, ProjectTabularSheetCellMeta>;
  draftPatches: TabularDraftPatchRecord;
  edits: ReadonlyArray<{
    row: number;
    col: number;
    nextValue: unknown;
  }>;
}): TabularDraftPatchRecord {
  const nextDraftPatches = { ...input.draftPatches };

  for (const edit of input.edits) {
    const baseValue = readTabularSheetCellValue(input.sheet, edit.row, edit.col);
    const baseKind = readTabularSheetCellKind(input.sheet, input.metaLookup, edit.row, edit.col);
    const normalizedPatch = inferPatchedCellKind({
      baseKind,
      nextValue: edit.nextValue,
    });
    const patchKey = tabularDraftPatchKey(input.sheet.name, edit.row, edit.col);

    if (
      normalizedPatch.valueKind === baseKind &&
      areTabularCellValuesEqual(normalizedPatch.value, baseValue)
    ) {
      delete nextDraftPatches[patchKey];
      continue;
    }

    nextDraftPatches[patchKey] = {
      sheetName: input.sheet.name,
      row: edit.row,
      col: edit.col,
      value: normalizedPatch.value,
      valueKind: normalizedPatch.valueKind,
    };
  }

  return nextDraftPatches;
}

export function collectTabularWritePatches(input: {
  snapshot: ProjectReadDelimitedGridFileResult;
  draftPatches: TabularDraftPatchRecord;
  includeFullSnapshot?: boolean;
}): ReadonlyArray<ProjectTabularCellPatch> {
  if (!input.includeFullSnapshot) {
    return Object.values(input.draftPatches);
  }

  const patches: ProjectTabularCellPatch[] = [];

  for (const sheet of input.snapshot.sheets) {
    const metaLookup = createTabularSheetCellMetaLookup(sheet);
    const displayData = buildTabularSheetDisplayData(sheet, input.draftPatches);
    const draftPatchEntries = new Map<string, ProjectTabularCellPatch>();

    for (const patch of patchRecordForSheet(input.draftPatches, sheet.name)) {
      draftPatchEntries.set(sheetCellKey(patch.row, patch.col), patch);
    }

    for (let row = 0; row < displayData.length; row += 1) {
      const rowValues = displayData[row]!;
      for (let col = 0; col < rowValues.length; col += 1) {
        const value = rowValues[col] ?? null;
        const draftPatch = draftPatchEntries.get(sheetCellKey(row, col));
        const valueKind =
          draftPatch?.valueKind ?? readTabularSheetCellKind(sheet, metaLookup, row, col);

        if (value === null || value === "") {
          continue;
        }

        patches.push({
          sheetName: sheet.name,
          row,
          col,
          value,
          valueKind,
        });
      }
    }
  }

  return patches;
}

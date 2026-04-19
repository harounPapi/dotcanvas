"use client";

import type {
  ProjectReadDelimitedGridFileResult,
  ProjectTabularCellValue,
  ProjectTabularCellValueKind,
} from "@t3tools/contracts";
import { HotTable, type HotTableRef } from "@handsontable/react-wrapper";
import type Handsontable from "handsontable/base";
import { Tabs, TabsList, TabsTrigger } from "~/components/ui/tabs";
import { useEffect, useEffectEvent, useMemo, useRef, useState } from "react";

import {
  applyTabularDraftEdits,
  buildTabularSheetDisplayData,
  createTabularSheetCellMetaLookup,
  type TabularDraftPatchRecord,
} from "./roomTabularState";
import {
  ensureHandsontableModulesRegistered,
  HANDSONTABLE_LICENSE_KEY,
  roomHandsontableThemeName,
  spreadsheetColumnLabel,
} from "./roomHandsontable";

ensureHandsontableModulesRegistered();

function inferCellKind(
  value: ProjectTabularCellValue,
  explicitKind: ProjectTabularCellValueKind | undefined,
): ProjectTabularCellValueKind {
  if (explicitKind) {
    return explicitKind;
  }
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

function sheetCellKey(row: number, col: number) {
  return `${row}:${col}`;
}

type RoomSpreadsheetGridElement = HTMLDivElement & {
  __roomHotInstance?: Handsontable | undefined;
};

const HANDSONTABLE_SYNC_SOURCES = new Set(["loadData", "updateData", "room:sheet-sync"]);

export function RoomTabularSurface(props: {
  draftPatches: TabularDraftPatchRecord;
  onDraftEdits: (updater: (current: TabularDraftPatchRecord) => TabularDraftPatchRecord) => void;
  resolvedTheme: "light" | "dark";
  snapshot: ProjectReadDelimitedGridFileResult;
}) {
  const { draftPatches, onDraftEdits, resolvedTheme, snapshot } = props;
  const hotRef = useRef<HotTableRef>(null);
  const containerRef = useRef<RoomSpreadsheetGridElement>(null);
  const [activeSheetName, setActiveSheetName] = useState(snapshot.sheets[0]?.name ?? "");
  const [displayData, setDisplayData] = useState(() =>
    snapshot.sheets[0] ? buildTabularSheetDisplayData(snapshot.sheets[0], draftPatches) : [],
  );

  const activeSheet = useMemo(
    () => snapshot.sheets.find((sheet) => sheet.name === activeSheetName) ?? snapshot.sheets[0],
    [activeSheetName, snapshot.sheets],
  );
  const activeSheetMetaLookup = useMemo(
    () => (activeSheet ? createTabularSheetCellMetaLookup(activeSheet) : {}),
    [activeSheet],
  );

  useEffect(() => {
    if (snapshot.sheets.some((sheet) => sheet.name === activeSheetName)) {
      return;
    }

    setActiveSheetName(snapshot.sheets[0]?.name ?? "");
  }, [activeSheetName, snapshot.sheets]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) {
      return;
    }

    container.__roomHotInstance = hotRef.current?.hotInstance ?? undefined;
    return () => {
      delete container.__roomHotInstance;
    };
  });

  useEffect(() => {
    if (!activeSheet) {
      setDisplayData([]);
      return;
    }

    const nextData = buildTabularSheetDisplayData(activeSheet, draftPatches);
    setDisplayData(nextData);
    hotRef.current?.hotInstance?.updateData(nextData, "room:sheet-sync");
  }, [activeSheet, draftPatches]);

  const handleAfterChange = useEffectEvent(
    (changes: Handsontable.CellChange[] | null, source: Handsontable.ChangeSource | undefined) => {
      if (!activeSheet || !changes || (source && HANDSONTABLE_SYNC_SOURCES.has(source))) {
        return;
      }

      const edits = changes
        .map(([row, prop, _previousValue, nextValue]) => {
          const col = typeof prop === "number" ? prop : Number.parseInt(String(prop), 10);
          if (!Number.isInteger(col) || row < 0) {
            return null;
          }
          return {
            row,
            col,
            nextValue,
          };
        })
        .filter((edit): edit is { row: number; col: number; nextValue: unknown } => edit !== null);

      if (edits.length === 0) {
        return;
      }

      onDraftEdits((current) =>
        applyTabularDraftEdits({
          sheet: activeSheet,
          metaLookup: activeSheetMetaLookup,
          draftPatches: current,
          edits,
        }),
      );
    },
  );

  if (!activeSheet) {
    return null;
  }

  return (
    <div className="flex h-full min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
      {snapshot.sheets.length <= 1 ? null : (
        <div className="border-b px-5 py-3">
          <Tabs
            value={activeSheet.name}
            onValueChange={(value) => {
              setActiveSheetName(value);
            }}
          >
            <TabsList
              aria-label="Spreadsheet worksheets"
              className="h-auto max-w-full gap-1 overflow-x-auto rounded-lg border border-border/70 bg-muted/55 p-1"
            >
              {snapshot.sheets.map((sheet) => (
                <TabsTrigger
                  aria-label={`Show worksheet ${sheet.name}`}
                  className="min-w-fit px-2 py-1 text-xs"
                  key={sheet.name}
                  value={sheet.name}
                >
                  {sheet.name}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
        </div>
      )}

      <div
        aria-label="Room spreadsheet grid"
        className="min-h-0 min-w-0 flex-1 overflow-hidden px-5 py-4"
        ref={containerRef}
      >
        <HotTable
          ref={hotRef}
          autoColumnSize={false}
          autoRowSize={false}
          className="h-full w-full"
          colHeaders={(column) => spreadsheetColumnLabel(column)}
          copyPaste={true}
          data={displayData}
          fixedColumnsLeft={activeSheet.frozenPane?.columnCount ?? 0}
          fixedRowsTop={activeSheet.frozenPane?.rowCount ?? 0}
          height="100%"
          hiddenColumns={{
            columns: [...activeSheet.hiddenColumns],
            indicators: true,
          }}
          hiddenRows={{
            rows: [...activeSheet.hiddenRows],
            indicators: true,
          }}
          licenseKey={HANDSONTABLE_LICENSE_KEY}
          manualColumnResize={true}
          manualRowResize={true}
          mergeCells={activeSheet.merges.map((merge) => ({
            row: merge.row,
            col: merge.col,
            rowspan: merge.rowspan,
            colspan: merge.colspan,
          }))}
          rowHeaders={true}
          tabNavigation={true}
          themeName={roomHandsontableThemeName(resolvedTheme)}
          undo={true}
          width="100%"
          afterChange={handleAfterChange}
          cells={(row, col) => {
            const key = sheetCellKey(row, col);
            const meta = activeSheetMetaLookup[key];
            const value = displayData[row]?.[col] ?? null;
            const kind = inferCellKind(value, meta?.valueKind);
            return {
              type: kind === "boolean" ? "checkbox" : kind === "number" ? "numeric" : "text",
              readOnly: meta?.readOnlyReason !== undefined,
            } as Handsontable.CellProperties;
          }}
        />
      </div>
    </div>
  );
}

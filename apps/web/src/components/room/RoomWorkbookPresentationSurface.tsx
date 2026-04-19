"use client";

import type {
  ProjectReadTabularMediaResult,
  ProjectReadWorkbookPresentationFileResult,
  ProjectWorkbookConditionalOverlay,
} from "@t3tools/contracts";
import { HotTable, type HotTableRef } from "@handsontable/react-wrapper";
import type Handsontable from "handsontable/base";
import { Tabs, TabsList, TabsTrigger } from "~/components/ui/tabs";
import { readNativeApi } from "~/nativeApi";
import { useEffect, useEffectEvent, useMemo, useRef, useState, type RefObject } from "react";

import {
  ensureHandsontableModulesRegistered,
  HANDSONTABLE_LICENSE_KEY,
  roomHandsontableThemeName,
  spreadsheetColumnLabel,
} from "./roomHandsontable";

ensureHandsontableModulesRegistered();

type WorkbookCellProperties = Handsontable.CellProperties & {
  roomHasRotation?: boolean;
  roomOverlay?: ProjectWorkbookConditionalOverlay | undefined;
};

type WorkbookCommentObject = {
  value?: string;
  readOnly?: boolean;
  style?: {
    height?: number;
    width?: number;
  };
};

type OverlayOrigin = {
  leftPx: number;
  topPx: number;
};

type WorkbookGridElement = HTMLDivElement & {
  __roomHotInstance?: Handsontable.Core | undefined;
};

function cellKey(row: number, col: number) {
  return `${row}:${col}`;
}

function sanitizeCssIdentifier(value: string) {
  return value.replace(/[^A-Za-z0-9_-]+/g, "-");
}

function serializeCssDeclarations(declarations: Record<string, string>) {
  return Object.entries(declarations)
    .map(([property, value]) => `${property}:${value};`)
    .join("");
}

function buildWorkbookStylesheet(input: {
  scopeClassName: string;
  styles: ProjectReadWorkbookPresentationFileResult["styles"];
}) {
  const genericStyles = `
    .${input.scopeClassName} .room-xlsx-cell {
      position: relative;
      padding: 0 !important;
    }
    .${input.scopeClassName} .room-xlsx-cell-content {
      position: relative;
      z-index: 2;
      display: flex;
      min-height: 100%;
      width: 100%;
      align-items: center;
      gap: 0.35rem;
      padding: 0.3rem 0.5rem;
      box-sizing: border-box;
    }
    .${input.scopeClassName} .room-xlsx-cell-content[data-rotated="true"] {
      display: inline-flex;
      width: auto;
      min-height: auto;
      transform: rotate(var(--room-xlsx-text-rotation));
      transform-origin: left center;
    }
    .${input.scopeClassName} .room-xlsx-cell-text {
      display: inline-block;
      min-width: 0;
    }
    .${input.scopeClassName} .room-xlsx-cell-bar {
      position: absolute;
      inset-block: 3px;
      left: 3px;
      z-index: 1;
      border-radius: 3px;
      opacity: 0.32;
    }
    .${input.scopeClassName} .room-xlsx-cell-bar[data-direction="rightToLeft"] {
      left: auto;
      right: 3px;
    }
    .${input.scopeClassName} .room-xlsx-cell-icon {
      font-size: 0.9em;
      line-height: 1;
      flex: 0 0 auto;
    }
  `;

  const atlasStyles = input.styles
    .map(
      (style, index) =>
        `.${input.scopeClassName} .room-xlsx-style-${index}{${serializeCssDeclarations(style.declarations)}}`,
    )
    .join("");

  return `${genericStyles}\n${atlasStyles}`;
}

function iconSymbol(iconKey: string | undefined) {
  switch (iconKey) {
    case "traffic-red":
      return "🔴";
    case "traffic-yellow":
      return "🟡";
    case "traffic-green":
      return "🟢";
    case "triangle-red":
      return "🔻";
    case "triangle-yellow":
      return "🔸";
    case "triangle-green":
      return "🔺";
    case "star-low":
      return "☆";
    case "star-mid":
      return "✦";
    case "star-high":
      return "★";
    case "box-low":
      return "◻";
    case "box-mid":
      return "◼";
    case "box-high":
      return "⬛";
    case "marker-low":
      return "▾";
    case "marker-mid":
      return "•";
    case "marker-high":
      return "▴";
    default:
      return undefined;
  }
}

function workbookCellRenderer(
  _instance: Handsontable.Core,
  td: HTMLTableCellElement,
  _row: number,
  _col: number,
  _prop: string | number,
  value: unknown,
  cellProperties: Handsontable.CellProperties,
) {
  const workbookCellProperties = cellProperties as WorkbookCellProperties;
  const overlay = workbookCellProperties.roomOverlay;
  const hasRotation = workbookCellProperties.roomHasRotation === true;
  const textValue = value === null || value === undefined ? "" : String(value);

  for (const className of td.classList) {
    if (className === "room-xlsx-cell" || className.startsWith("room-xlsx-style-")) {
      td.classList.remove(className);
    }
  }
  td.classList.add("room-xlsx-cell");
  for (const className of String(workbookCellProperties.className ?? "")
    .split(/\s+/)
    .filter((entry) => entry.length > 0)) {
    td.classList.add(className);
  }
  td.replaceChildren();

  if (overlay?.dataBarFillPercent !== undefined && overlay.dataBarFillPercent > 0) {
    const dataBar = document.createElement("div");
    dataBar.className = "room-xlsx-cell-bar";
    dataBar.dataset.direction = overlay.dataBarDirection ?? "leftToRight";
    dataBar.style.width = `${Math.max(0, Math.min(1, overlay.dataBarFillPercent)) * 100}%`;
    dataBar.style.backgroundColor = overlay.dataBarColor ?? "#7FA4D9";
    td.append(dataBar);
  }

  const content = document.createElement("div");
  content.className = "room-xlsx-cell-content";
  for (const className of String(workbookCellProperties.className ?? "")
    .split(/\s+/)
    .filter((entry) => entry.length > 0)) {
    content.classList.add(className);
  }
  if (hasRotation) {
    content.dataset.rotated = "true";
  }

  const icon = iconSymbol(overlay?.iconKey);
  if (icon) {
    const iconElement = document.createElement("span");
    iconElement.className = "room-xlsx-cell-icon";
    if (overlay?.iconColor) {
      iconElement.style.color = overlay.iconColor;
    }
    iconElement.textContent = icon;
    content.append(iconElement);
  }

  const text = document.createElement("span");
  text.className = "room-xlsx-cell-text";
  text.textContent = textValue;
  content.append(text);
  td.append(content);
}

function useOverlayOrigin(input: {
  hotRef: RefObject<HotTableRef | null>;
  viewportRef: RefObject<HTMLDivElement | null>;
  activeSheetKey: string;
}) {
  const [overlayOrigin, setOverlayOrigin] = useState<OverlayOrigin>({ leftPx: 0, topPx: 0 });

  const syncOverlayOrigin = useEffectEvent(() => {
    const hotRoot = input.hotRef.current?.hotInstance?.rootElement as HTMLElement | undefined;
    const viewport = input.viewportRef.current;
    const masterTable = hotRoot?.querySelector(".ht_master table") as HTMLElement | null;
    if (!viewport || !masterTable) {
      return;
    }

    const viewportRect = viewport.getBoundingClientRect();
    const masterTableRect = masterTable.getBoundingClientRect();
    const nextOrigin = {
      leftPx: masterTableRect.left - viewportRect.left,
      topPx: masterTableRect.top - viewportRect.top,
    };

    setOverlayOrigin((current) =>
      Math.abs(current.leftPx - nextOrigin.leftPx) < 0.5 &&
      Math.abs(current.topPx - nextOrigin.topPx) < 0.5
        ? current
        : nextOrigin,
    );
  });

  useEffect(() => {
    const hotRoot = input.hotRef.current?.hotInstance?.rootElement as HTMLElement | undefined;
    const viewport = input.viewportRef.current;
    const holder = hotRoot?.querySelector(".ht_master .wtHolder") as HTMLElement | null;
    const masterTable = hotRoot?.querySelector(".ht_master table") as HTMLElement | null;

    syncOverlayOrigin();

    const resizeObserver =
      typeof ResizeObserver === "undefined"
        ? null
        : new ResizeObserver(() => {
            syncOverlayOrigin();
          });
    if (viewport) {
      resizeObserver?.observe(viewport);
    }
    if (masterTable) {
      resizeObserver?.observe(masterTable);
    }

    holder?.addEventListener("scroll", syncOverlayOrigin, { passive: true });
    window.addEventListener("resize", syncOverlayOrigin);

    return () => {
      resizeObserver?.disconnect();
      holder?.removeEventListener("scroll", syncOverlayOrigin);
      window.removeEventListener("resize", syncOverlayOrigin);
    };
  }, [input.activeSheetKey, input.hotRef, input.viewportRef]);

  return {
    overlayOrigin,
    syncOverlayOrigin,
  };
}

export function RoomWorkbookPresentationSurface(props: {
  resolvedTheme: "light" | "dark";
  snapshot: ProjectReadWorkbookPresentationFileResult;
  workspaceRoot: string;
}) {
  const { resolvedTheme, snapshot, workspaceRoot } = props;
  const hotRef = useRef<HotTableRef>(null);
  const viewportRef = useRef<WorkbookGridElement>(null);
  const visibleSheets = useMemo(
    () => snapshot.sheets.filter((sheet) => sheet.state === "visible"),
    [snapshot.sheets],
  );
  const fallbackSheets = visibleSheets.length > 0 ? visibleSheets : snapshot.sheets;
  const [activeSheetName, setActiveSheetName] = useState(fallbackSheets[0]?.name ?? "");
  const [mediaById, setMediaById] = useState<Record<string, ProjectReadTabularMediaResult>>({});
  const pendingMediaIdsRef = useRef(new Set<string>());
  const scopeClassName = useMemo(
    () =>
      `room-xlsx-scope-${sanitizeCssIdentifier(snapshot.relativePath)}-${sanitizeCssIdentifier(
        String(snapshot.mtimeMs),
      )}`,
    [snapshot.mtimeMs, snapshot.relativePath],
  );

  const activeSheet = useMemo(
    () => fallbackSheets.find((sheet) => sheet.name === activeSheetName) ?? fallbackSheets[0],
    [activeSheetName, fallbackSheets],
  );
  const commentsByCell = useMemo(() => {
    const entries: Record<string, string> = {};
    for (const comment of activeSheet?.comments ?? []) {
      entries[cellKey(comment.row, comment.col)] = comment.text;
    }
    return entries;
  }, [activeSheet]);
  const overlaysByCell = useMemo(() => {
    const entries: Record<string, ProjectWorkbookConditionalOverlay> = {};
    for (const overlay of activeSheet?.conditionalOverlays ?? []) {
      entries[cellKey(overlay.row, overlay.col)] = overlay;
    }
    return entries;
  }, [activeSheet]);
  const rotatedStyleIds = useMemo(
    () =>
      new Set(
        snapshot.styles.flatMap((style, index) =>
          style.declarations["--room-xlsx-text-rotation"] ? [index] : [],
        ),
      ),
    [snapshot.styles],
  );
  const stylesheetText = useMemo(
    () =>
      buildWorkbookStylesheet({
        scopeClassName,
        styles: snapshot.styles,
      }),
    [scopeClassName, snapshot.styles],
  );
  const sheetWidthPx = useMemo(
    () => (activeSheet?.columnWidths ?? []).reduce<number>((sum, width) => sum + (width ?? 0), 0),
    [activeSheet],
  );
  const sheetHeightPx = useMemo(
    () => (activeSheet?.rowHeights ?? []).reduce<number>((sum, height) => sum + (height ?? 0), 0),
    [activeSheet],
  );
  const displayData = useMemo(
    () => (activeSheet ? activeSheet.displayText.map((row) => [...row]) : []),
    [activeSheet],
  );
  const activeMediaIds = useMemo(() => {
    if (!activeSheet) {
      return [];
    }

    return Array.from(
      new Set([
        ...activeSheet.images.map((image) => image.mediaId),
        ...(activeSheet.backgroundMediaId ? [activeSheet.backgroundMediaId] : []),
      ]),
    );
  }, [activeSheet]);

  const { overlayOrigin, syncOverlayOrigin } = useOverlayOrigin({
    hotRef,
    viewportRef,
    activeSheetKey: `${snapshot.relativePath}:${snapshot.mtimeMs}:${activeSheet?.name ?? "sheet"}`,
  });

  const loadMedia = useEffectEvent(async (mediaId: string) => {
    if (pendingMediaIdsRef.current.has(mediaId) || mediaById[mediaId]) {
      return;
    }

    const api = readNativeApi();
    if (!api) {
      return;
    }

    pendingMediaIdsRef.current.add(mediaId);
    try {
      const result = await api.projects.readTabularMedia({
        cwd: workspaceRoot,
        relativePath: snapshot.relativePath,
        mtimeMs: snapshot.mtimeMs,
        mediaId,
      });
      setMediaById((current) => ({
        ...current,
        [mediaId]: result,
      }));
    } finally {
      pendingMediaIdsRef.current.delete(mediaId);
    }
  });

  useEffect(() => {
    setMediaById({});
    pendingMediaIdsRef.current.clear();
  }, [snapshot.mtimeMs, snapshot.relativePath]);

  useEffect(() => {
    for (const mediaId of activeMediaIds) {
      if (!mediaById[mediaId]) {
        void loadMedia(mediaId);
      }
    }
  }, [activeMediaIds, mediaById]);

  useEffect(() => {
    if (fallbackSheets.some((sheet) => sheet.name === activeSheetName)) {
      return;
    }

    setActiveSheetName(fallbackSheets[0]?.name ?? "");
  }, [activeSheetName, fallbackSheets]);

  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) {
      return;
    }

    viewport.__roomHotInstance = hotRef.current?.hotInstance ?? undefined;
    return () => {
      delete viewport.__roomHotInstance;
    };
  });

  if (!activeSheet) {
    return null;
  }

  const backgroundMedia = activeSheet.backgroundMediaId
    ? mediaById[activeSheet.backgroundMediaId]
    : undefined;

  return (
    <div className="flex h-full min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
      {fallbackSheets.length > 1 ? (
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
              {fallbackSheets.map((sheet) => (
                <TabsTrigger
                  aria-label={`Show worksheet ${sheet.name}`}
                  className="min-w-fit px-2 py-1 text-xs"
                  key={sheet.name}
                  style={sheet.tabColor ? { borderColor: sheet.tabColor } : undefined}
                  value={sheet.name}
                >
                  {sheet.name}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
        </div>
      ) : null}

      <div className="min-h-0 min-w-0 flex-1 overflow-hidden px-5 py-4">
        <style>{stylesheetText}</style>
        <div
          aria-label="Room spreadsheet grid"
          className={`relative h-full w-full overflow-hidden ${scopeClassName}`}
          data-room-workbook-presentation="true"
          ref={viewportRef}
        >
          {backgroundMedia ? (
            <div
              className="pointer-events-none absolute z-0 opacity-25"
              style={{
                left: `${overlayOrigin.leftPx}px`,
                top: `${overlayOrigin.topPx}px`,
                width: `${sheetWidthPx}px`,
                height: `${sheetHeightPx}px`,
                backgroundImage: `url(data:${backgroundMedia.mimeType};base64,${backgroundMedia.contentBase64})`,
                backgroundRepeat: "repeat",
                backgroundSize: "auto",
              }}
            />
          ) : null}

          <HotTable
            ref={hotRef}
            autoColumnSize={false}
            autoRowSize={false}
            className="h-full w-full"
            colHeaders={(column) => spreadsheetColumnLabel(column)}
            comments={true}
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
            readOnly={true}
            rowHeaders={true}
            rowHeights={activeSheet.rowHeights.map((height) => height ?? undefined)}
            stretchH="none"
            tabNavigation={true}
            themeName={roomHandsontableThemeName(resolvedTheme)}
            width="100%"
            afterRender={() => {
              syncOverlayOrigin();
            }}
            cells={(row, col) => {
              const baseStyleId = activeSheet.styleIds[row]?.[col] ?? null;
              const overlay = overlaysByCell[cellKey(row, col)];
              const classNames = [
                baseStyleId === null ? null : `room-xlsx-style-${baseStyleId}`,
                overlay?.styleId === undefined ? null : `room-xlsx-style-${overlay.styleId}`,
              ].filter((value): value is string => value !== null);
              const comment = commentsByCell[cellKey(row, col)];
              const hasRotation =
                (baseStyleId !== null && rotatedStyleIds.has(baseStyleId)) ||
                (overlay?.styleId !== undefined && rotatedStyleIds.has(overlay.styleId));

              const cellMeta = {
                className: classNames.join(" "),
                readOnly: true,
                renderer: workbookCellRenderer,
                roomHasRotation: hasRotation,
                roomOverlay: overlay,
              } as WorkbookCellProperties;
              if (comment) {
                cellMeta.comment = {
                  value: comment,
                  readOnly: true,
                } satisfies WorkbookCommentObject;
              }
              return cellMeta as Handsontable.CellMeta;
            }}
            colWidths={activeSheet.columnWidths.map((width) => width ?? undefined)}
          />

          <div className="pointer-events-none absolute inset-0 z-20 overflow-hidden">
            {activeSheet.images.map((image) => {
              const medium = mediaById[image.mediaId];
              if (!medium) {
                return null;
              }

              return (
                <img
                  alt=""
                  className="absolute select-none"
                  key={`${activeSheet.name}:${image.mediaId}:${image.leftPx}:${image.topPx}`}
                  src={`data:${medium.mimeType};base64,${medium.contentBase64}`}
                  style={{
                    left: `${overlayOrigin.leftPx + image.leftPx}px`,
                    top: `${overlayOrigin.topPx + image.topPx}px`,
                    width: `${image.widthPx}px`,
                    height: `${image.heightPx}px`,
                  }}
                />
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

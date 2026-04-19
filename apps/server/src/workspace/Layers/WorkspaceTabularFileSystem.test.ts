import JSZip from "jszip";
import * as NodeServices from "@effect/platform-node/NodeServices";
import ExcelJS from "exceljs";
import { describe, expect, it } from "@effect/vitest";
import XLSX from "xlsx";
import { Effect, FileSystem, Layer, Option, Path } from "effect";
import { vi } from "vitest";

import { PROJECT_TABULAR_READ_FILE_MAX_BYTES } from "@t3tools/contracts";

import { ServerConfig } from "../../config.ts";
import { GitCoreLive } from "../../git/Layers/GitCore.ts";
import { WorkspaceEntriesLive } from "./WorkspaceEntries.ts";
import { WorkspacePathsLive } from "./WorkspacePaths.ts";
import { WorkspaceFileSystemWriteConflictError } from "../Services/WorkspaceFileSystem.ts";
import {
  WorkspaceTabularFileSystem,
  WorkspaceTabularFileSystemError,
} from "../Services/WorkspaceTabularFileSystem.ts";
import { WorkspacePathOutsideRootError } from "../Services/WorkspacePaths.ts";
import { readSheetJsWorkbookPresentationSnapshot } from "./sheetJsWorkbookPresentation.ts";
import { WorkspaceTabularFileSystemLive } from "./WorkspaceTabularFileSystem.ts";

const ProjectLayer = WorkspaceTabularFileSystemLive.pipe(
  Layer.provide(WorkspacePathsLive),
  Layer.provide(WorkspaceEntriesLive.pipe(Layer.provide(WorkspacePathsLive))),
);

const TestLayer = Layer.empty.pipe(
  Layer.provideMerge(ProjectLayer),
  Layer.provideMerge(WorkspaceEntriesLive.pipe(Layer.provide(WorkspacePathsLive))),
  Layer.provideMerge(WorkspacePathsLive),
  Layer.provideMerge(GitCoreLive),
  Layer.provide(
    ServerConfig.layerTest(process.cwd(), {
      prefix: "t3-workspace-tabular-test-",
    }),
  ),
  Layer.provideMerge(NodeServices.layer),
);

const makeTempDir = Effect.gen(function* () {
  const fileSystem = yield* FileSystem.FileSystem;
  return yield* fileSystem.makeTempDirectoryScoped({
    prefix: "t3code-workspace-tabular-",
  });
});

const writeTextFile = Effect.fn("writeTextFile")(function* (
  cwd: string,
  relativePath: string,
  contents: string,
) {
  const fileSystem = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const absolutePath = path.join(cwd, relativePath);
  yield* fileSystem
    .makeDirectory(path.dirname(absolutePath), { recursive: true })
    .pipe(Effect.orDie);
  yield* fileSystem.writeFileString(absolutePath, contents).pipe(Effect.orDie);
  return absolutePath;
});

const writeWorkbookFile = Effect.fn("writeWorkbookFile")(function* (
  cwd: string,
  relativePath: string,
  configure: (workbook: ExcelJS.Workbook) => void,
) {
  const fileSystem = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const absolutePath = path.join(cwd, relativePath);
  const workbook = new ExcelJS.Workbook();
  configure(workbook);
  const bytes = yield* awaitWorkbookBuffer(workbook);

  yield* fileSystem
    .makeDirectory(path.dirname(absolutePath), { recursive: true })
    .pipe(Effect.orDie);
  yield* fileSystem.writeFile(absolutePath, bytes).pipe(Effect.orDie);
  return absolutePath;
});

function awaitWorkbookBuffer(workbook: ExcelJS.Workbook) {
  return Effect.promise(async () => {
    const output = await workbook.xlsx.writeBuffer();
    return output instanceof Uint8Array ? output : new Uint8Array(output);
  });
}

type SheetJsWorkbookFormat = "xlsm" | "xlsb" | "xls" | "ods" | "fods";

const writeSheetJsWorkbookFile = Effect.fn("writeSheetJsWorkbookFile")(function* (
  cwd: string,
  relativePath: string,
  format: SheetJsWorkbookFormat,
  configure: (workbook: XLSX.WorkBook) => void,
) {
  const fileSystem = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const absolutePath = path.join(cwd, relativePath);
  const workbook = XLSX.utils.book_new();
  configure(workbook);
  const output = XLSX.write(workbook, {
    type: "buffer",
    bookType: format,
  });
  const bytes = output instanceof Uint8Array ? output : new Uint8Array(output);

  yield* fileSystem
    .makeDirectory(path.dirname(absolutePath), { recursive: true })
    .pipe(Effect.orDie);
  yield* fileSystem.writeFile(absolutePath, bytes).pipe(Effect.orDie);
  return absolutePath;
});

function configureSheetJsWorkbookFixture(workbook: XLSX.WorkBook) {
  const summary = XLSX.utils.aoa_to_sheet([
    ["Milestone", "Owner", "Notes", "Merged", ""],
    ["Alpha", "Ada", "Styled", "", ""],
    ["Beta", 0.5, "", "", ""],
  ]);
  summary.B3 = {
    t: "n",
    v: 0.5,
    z: "0%",
    w: "50%",
  };
  summary.C2 = {
    t: "s",
    v: "Styled",
    s: {
      fill: {
        patternType: "solid",
        fgColor: { rgb: "FFFCE4D6" },
      },
      font: {
        bold: true,
        color: { rgb: "FF112233" },
      },
    },
  };
  summary["!cols"] = [{ width: 16 }, { hidden: true }, { width: 12 }, { width: 14 }, { width: 10 }];
  summary["!rows"] = [{ hpt: 22 }, { hidden: true }, { hpx: 28 }];
  summary["!merges"] = [XLSX.utils.decode_range("D1:E1")];
  summary["!freeze"] = { xSplit: 1, ySplit: 1 };

  const backlog = XLSX.utils.aoa_to_sheet([["Task"], ["P1"]]);

  XLSX.utils.book_append_sheet(workbook, summary, "Summary");
  XLSX.utils.book_append_sheet(workbook, backlog, "Backlog");
  workbook.Workbook = {
    Sheets: [
      { name: "Summary", Hidden: 0 },
      { name: "Backlog", Hidden: 1 },
    ],
    WBProps: {
      date1904: false,
    },
  };
}

const ONE_PIXEL_PNG_BASE64 =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jx7sAAAAASUVORK5CYII=";

const writeWorkbookFileWithBrokenDrawingReference = Effect.fn(
  "writeWorkbookFileWithBrokenDrawingReference",
)(function* (cwd: string, relativePath: string) {
  const fileSystem = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const absolutePath = path.join(cwd, relativePath);
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Sheet1");
  sheet.getCell("A1").value = "hello";

  const imageId = workbook.addImage({
    base64: ONE_PIXEL_PNG_BASE64,
    extension: "png",
  });
  sheet.addImage(imageId, "B2:C3");

  const bytes = yield* awaitWorkbookBuffer(workbook);
  const brokenBytes = yield* Effect.promise(async () => {
    const zip = await JSZip.loadAsync(bytes);
    const drawingPath = Object.keys(zip.files).find((filePath) =>
      /^xl\/drawings\/drawing\d+[.]xml$/.test(filePath),
    );
    if (!drawingPath) {
      throw new Error("Expected workbook to contain a worksheet drawing.");
    }

    zip.remove(drawingPath);
    return zip.generateAsync({ type: "uint8array" });
  });

  yield* fileSystem
    .makeDirectory(path.dirname(absolutePath), { recursive: true })
    .pipe(Effect.orDie);
  yield* fileSystem.writeFile(absolutePath, brokenBytes).pipe(Effect.orDie);
  return absolutePath;
});

function detailOf(
  error:
    | WorkspaceFileSystemWriteConflictError
    | WorkspacePathOutsideRootError
    | WorkspaceTabularFileSystemError,
) {
  return "detail" in error ? error.detail : error.message;
}

it.layer(TestLayer)("WorkspaceTabularFileSystemLive", (it) => {
  describe("readTabularFile", () => {
    it.effect(
      "reads delimited formats including psv and sniffed txt into the editable preview shape",
      () =>
        Effect.gen(function* () {
          const workspaceTabularFileSystem = yield* WorkspaceTabularFileSystem;
          const cwd = yield* makeTempDir;

          yield* writeTextFile(cwd, "planning.csv", "name,owner\nAPI,Ada\n");
          yield* writeTextFile(cwd, "planning.tsv", "name\towner\nUI\tSam\n");
          yield* writeTextFile(cwd, "planning.psv", "name|owner\nDocs|Kai\n");
          yield* writeTextFile(cwd, "planning.txt", "name|owner\nAPI|Ada\nUI|Sam\n");

          const csv = yield* workspaceTabularFileSystem.readTabularFile({
            cwd,
            relativePath: "planning.csv",
          });
          const tsv = yield* workspaceTabularFileSystem.readTabularFile({
            cwd,
            relativePath: "planning.tsv",
          });
          const psv = yield* workspaceTabularFileSystem.readTabularFile({
            cwd,
            relativePath: "planning.psv",
          });
          const txt = yield* workspaceTabularFileSystem.readTabularFile({
            cwd,
            relativePath: "planning.txt",
          });

          if (
            csv.previewKind !== "delimited-grid" ||
            tsv.previewKind !== "delimited-grid" ||
            psv.previewKind !== "delimited-grid" ||
            txt.previewKind !== "delimited-grid"
          ) {
            throw new Error("Expected delimited previews for delimited text formats.");
          }

          expect(csv.kind).toBe("csv");
          expect(csv.delimiter).toBe(",");
          expect(csv.capabilities.canEditInRoom).toBe(true);
          expect(csv.sheets).toEqual([
            {
              name: "Sheet1",
              rowCount: 2,
              columnCount: 2,
              data: [
                ["name", "owner"],
                ["API", "Ada"],
              ],
              merges: [],
              hiddenRows: [],
              hiddenColumns: [],
              cellMeta: [],
            },
          ]);

          expect(tsv.kind).toBe("tsv");
          expect(tsv.delimiter).toBe("\t");
          expect(tsv.capabilities.canEditInRoom).toBe(true);
          expect(tsv.sheets[0]?.data).toEqual([
            ["name", "owner"],
            ["UI", "Sam"],
          ]);

          expect(psv.kind).toBe("psv");
          expect(psv.delimiter).toBe("|");
          expect(psv.sheets[0]?.data).toEqual([
            ["name", "owner"],
            ["Docs", "Kai"],
          ]);

          expect(txt.kind).toBe("txt");
          expect(txt.delimiter).toBe("|");
          expect(txt.sheets[0]?.data).toEqual([
            ["name", "owner"],
            ["API", "Ada"],
            ["UI", "Sam"],
          ]);
        }),
    );

    it.effect("rejects prose txt files that are not actually tabular", () =>
      Effect.gen(function* () {
        const workspaceTabularFileSystem = yield* WorkspaceTabularFileSystem;
        const cwd = yield* makeTempDir;

        yield* writeTextFile(
          cwd,
          "notes.txt",
          "This is a regular note.\nIt has sentences, not columns.\nNothing tabular here.\n",
        );

        const error = yield* workspaceTabularFileSystem
          .readTabularFile({
            cwd,
            relativePath: "notes.txt",
          })
          .pipe(Effect.flip);

        expect(detailOf(error)).toContain("doesn’t appear to contain tabular data");
      }),
    );

    it.effect("reads styled xlsx files into the presentation preview shape", () =>
      Effect.gen(function* () {
        const workspaceTabularFileSystem = yield* WorkspaceTabularFileSystem;
        const cwd = yield* makeTempDir;

        yield* writeWorkbookFile(cwd, "roadmap.xlsx", (workbook) => {
          const summary = workbook.addWorksheet("Summary", {
            views: [{ state: "frozen", xSplit: 1, ySplit: 1, showGridLines: false }],
          });
          summary.properties.tabColor = { argb: "FFFF0000" };
          summary.getColumn(1).width = 14;
          summary.getRow(2).height = 30;
          summary.getCell("A1").value = "Milestone";
          summary.getCell("B1").value = 0.42;
          summary.getCell("B1").numFmt = "0%";
          summary.getCell("A2").value = new Date(Date.UTC(2026, 0, 2));
          summary.getCell("A2").numFmt = "m/d/yyyy";
          summary.getCell("B2").value = 10;
          summary.getCell("B3").value = 20;
          summary.getCell("C2").value = "Styled";
          summary.getCell("C2").font = {
            bold: true,
            color: { argb: "FF112233" },
            name: "Arial",
          };
          summary.getCell("C2").fill = {
            type: "pattern",
            pattern: "solid",
            fgColor: { argb: "FFFCE4D6" },
          };
          summary.getCell("C2").alignment = {
            horizontal: "center",
            vertical: "middle",
            wrapText: true,
          };
          summary.getCell("C2").border = {
            top: { style: "thin", color: { argb: "FF000000" } },
            right: { style: "thin", color: { argb: "FF000000" } },
            bottom: { style: "thin", color: { argb: "FF000000" } },
            left: { style: "thin", color: { argb: "FF000000" } },
          };
          summary.getCell("A3").note = "Remember this";
          summary.getCell("A4").value = "Hidden";
          summary.getRow(4).hidden = true;
          summary.getColumn(5).hidden = true;
          summary.mergeCells("D1:E1");
          summary.getCell("D1").value = "Merged";
          summary.addConditionalFormatting({
            ref: "B2:B3",
            rules: [
              {
                type: "dataBar",
                cfvo: [{ type: "min" }, { type: "max" }],
                color: "FF638EC6",
              } as ExcelJS.ConditionalFormattingRule & { color: string },
            ],
          });

          const imageId = workbook.addImage({
            base64: ONE_PIXEL_PNG_BASE64,
            extension: "png",
          });
          summary.addImage(imageId, {
            tl: { col: 1, row: 1 },
            ext: { width: 24, height: 24 },
          });
          summary.addBackgroundImage(imageId);

          const backlog = workbook.addWorksheet("Backlog");
          backlog.state = "hidden";
          backlog.getCell("A1").value = "Task";
        });

        const result = yield* workspaceTabularFileSystem.readTabularFile({
          cwd,
          relativePath: "roadmap.xlsx",
        });

        if (result.previewKind !== "workbook-presentation") {
          throw new Error("Expected workbook presentation preview for xlsx.");
        }

        expect(result.kind).toBe("xlsx");
        expect(result.capabilities.canEditInRoom).toBe(false);
        expect(result.presentationFidelity).toBe("full");
        expect(result.previewNotices).toEqual([]);
        expect(result.sheets.map((sheet) => sheet.name)).toEqual(["Summary", "Backlog"]);
        expect(result.theme.colors.accent1).toBeTruthy();
        expect(result.sheets[0]?.showGridLines).toBe(false);
        expect(result.sheets[0]?.state).toBe("visible");
        expect(result.sheets[0]?.tabColor).toBe("#FF0000");
        expect(result.sheets[0]?.frozenPane).toEqual({
          rowCount: 1,
          columnCount: 1,
        });
        expect(result.sheets[0]?.rowHeights[1]).toBeTruthy();
        expect(result.sheets[0]?.columnWidths[0]).toBeTruthy();
        expect(result.sheets[0]?.displayText[0]?.[1]).toBe("42%");
        expect(result.sheets[0]?.valueKinds[1]?.[0]).toBe("date");
        expect(result.sheets[0]?.displayText[1]?.[0]).toContain("2026");
        expect(result.sheets[0]?.styleIds[1]?.[2]).not.toBeNull();
        expect(result.styles.length).toBeGreaterThan(0);
        expect(result.sheets[0]?.merges).toEqual([
          {
            row: 0,
            col: 3,
            rowspan: 1,
            colspan: 2,
          },
        ]);
        expect(result.sheets[0]?.hiddenRows).toContain(3);
        expect(result.sheets[0]?.hiddenColumns).toContain(4);
        expect(result.sheets[0]?.comments).toEqual([
          {
            row: 2,
            col: 0,
            text: "Remember this",
          },
        ]);
        expect(result.sheets[0]?.images).toHaveLength(1);
        expect(result.sheets[0]?.backgroundMediaId).toBeTruthy();
        expect(
          result.sheets[0]?.conditionalOverlays.some(
            (overlay) => overlay.dataBarFillPercent !== undefined,
          ),
        ).toBe(true);
        expect(result.sheets[1]?.state).toBe("hidden");
      }),
    );

    it.effect("rejects oversized and over-budget spreadsheet previews", () =>
      Effect.gen(function* () {
        const workspaceTabularFileSystem = yield* WorkspaceTabularFileSystem;
        const cwd = yield* makeTempDir;

        yield* writeTextFile(
          cwd,
          "too-big.csv",
          "a".repeat(PROJECT_TABULAR_READ_FILE_MAX_BYTES + 1),
        );
        yield* writeTextFile(
          cwd,
          "too-wide.csv",
          `${Array.from({ length: 257 }, (_, index) => `c${index}`).join(",")}\n`,
        );
        yield* writeWorkbookFile(cwd, "too-many-sheets.xlsx", (workbook) => {
          for (let index = 0; index < 33; index += 1) {
            workbook.addWorksheet(`Sheet${index + 1}`).getCell("A1").value = "x";
          }
        });

        const tooBigError = yield* workspaceTabularFileSystem
          .readTabularFile({
            cwd,
            relativePath: "too-big.csv",
          })
          .pipe(Effect.flip);
        expect(detailOf(tooBigError)).toContain("Spreadsheet file is too large to open in Room");

        const tooWideError = yield* workspaceTabularFileSystem
          .readTabularFile({
            cwd,
            relativePath: "too-wide.csv",
          })
          .pipe(Effect.flip);
        expect(detailOf(tooWideError)).toContain("Spreadsheet has too many columns for Room");

        const tooManySheetsError = yield* workspaceTabularFileSystem
          .readTabularFile({
            cwd,
            relativePath: "too-many-sheets.xlsx",
          })
          .pipe(Effect.flip);
        expect(detailOf(tooManySheetsError)).toContain("Spreadsheet has too many sheets for Room");
      }),
    );

    it.effect(
      "reads legacy and open document workbook formats as partial presentation previews",
      () =>
        Effect.gen(function* () {
          const workspaceTabularFileSystem = yield* WorkspaceTabularFileSystem;
          const cwd = yield* makeTempDir;
          const workbookFormats = [
            "xlsm",
            "xlsb",
            "xls",
            "ods",
            "fods",
          ] as const satisfies ReadonlyArray<SheetJsWorkbookFormat>;

          for (const format of workbookFormats) {
            yield* writeSheetJsWorkbookFile(
              cwd,
              `planning.${format}`,
              format,
              configureSheetJsWorkbookFixture,
            );

            const result = yield* workspaceTabularFileSystem.readTabularFile({
              cwd,
              relativePath: `planning.${format}`,
            });

            if (result.previewKind !== "workbook-presentation") {
              throw new Error(`Expected workbook presentation preview for ${format}.`);
            }

            expect(result.kind).toBe(format);
            expect(result.capabilities.canEditInRoom).toBe(false);
            expect(result.presentationFidelity).toBe("partial");
            expect(result.previewNotices.join(" ")).toContain("Simplified preview");
            if (format === "xlsm") {
              expect(result.previewNotices.join(" ")).toContain("Macros and VBA");
            }
            expect(result.sheets.map((sheet) => sheet.name)).toEqual(["Summary", "Backlog"]);
            expect(result.sheets[0]?.rawValues[1]?.[1]).toBe("Ada");
            expect(result.sheets[0]?.displayText[2]?.[1]).not.toBe("");
            expect(result.sheets[0]?.valueKinds[2]?.[1]).toBe("number");
            expect(result.sheets[0]?.merges).toEqual([
              {
                row: 0,
                col: 3,
                rowspan: 1,
                colspan: 2,
              },
            ]);
            expect(Array.isArray(result.sheets[0]?.hiddenRows)).toBe(true);
            expect(Array.isArray(result.sheets[0]?.hiddenColumns)).toBe(true);
            expect(result.sheets[0]?.rowHeights).toHaveLength(result.sheets[0]?.rowCount ?? 0);
            expect(result.sheets[0]?.columnWidths).toHaveLength(result.sheets[0]?.columnCount ?? 0);
            expect(result.sheets[0]?.comments).toEqual([]);
            expect(result.sheets[0]?.images).toEqual([]);
            expect(result.sheets[0]?.conditionalOverlays).toEqual([]);
          }
        }),
    );

    it.effect(
      "falls back to unsupported preview state for workbook visuals Room cannot reproduce",
      () =>
        Effect.gen(function* () {
          const workspaceTabularFileSystem = yield* WorkspaceTabularFileSystem;
          const cwd = yield* makeTempDir;

          yield* writeWorkbookFile(cwd, "table-theme.xlsx", (workbook) => {
            const sheet = workbook.addWorksheet("Sheet1");
            sheet.addTable({
              name: "StyledTable",
              ref: "A1",
              headerRow: true,
              style: {
                theme: "TableStyleMedium2",
                showRowStripes: true,
              },
              columns: [{ name: "Owner" }],
              rows: [["Ada"]],
            });
          });

          const result = yield* workspaceTabularFileSystem.readTabularFile({
            cwd,
            relativePath: "table-theme.xlsx",
          });

          if (result.previewKind !== "workbook-presentation") {
            throw new Error("Expected workbook presentation preview for xlsx.");
          }

          expect(result.unsupportedVisualReason).toContain("Excel table themes");
          expect(result.presentationFidelity).toBe("full");
          expect(result.previewNotices).toEqual([]);
          expect(result.sheets).toEqual([]);
        }),
    );

    it.effect("keeps reading xlsx files when worksheet drawing XML is missing", () =>
      Effect.gen(function* () {
        const workspaceTabularFileSystem = yield* WorkspaceTabularFileSystem;
        const cwd = yield* makeTempDir;

        yield* writeWorkbookFileWithBrokenDrawingReference(cwd, "illustrated.xlsx");

        const result = yield* workspaceTabularFileSystem.readTabularFile({
          cwd,
          relativePath: "illustrated.xlsx",
        });

        if (result.previewKind !== "workbook-presentation") {
          throw new Error("Expected workbook presentation preview for xlsx.");
        }

        expect(result.sheets[0]?.displayText).toEqual([["hello"]]);
      }),
    );
  });

  describe("readTabularMedia", () => {
    it.effect("loads workbook image media for presentation previews", () =>
      Effect.gen(function* () {
        const workspaceTabularFileSystem = yield* WorkspaceTabularFileSystem;
        const cwd = yield* makeTempDir;

        yield* writeWorkbookFile(cwd, "media.xlsx", (workbook) => {
          const sheet = workbook.addWorksheet("Sheet1");
          sheet.getCell("A1").value = "Hello";
          const imageId = workbook.addImage({
            base64: ONE_PIXEL_PNG_BASE64,
            extension: "png",
          });
          sheet.addImage(imageId, {
            tl: { col: 0, row: 0 },
            ext: { width: 20, height: 20 },
          });
        });

        const preview = yield* workspaceTabularFileSystem.readTabularFile({
          cwd,
          relativePath: "media.xlsx",
        });

        if (preview.previewKind !== "workbook-presentation") {
          throw new Error("Expected workbook presentation preview for xlsx.");
        }

        const mediaId = preview.sheets[0]?.images[0]?.mediaId;
        if (!mediaId) {
          throw new Error("Expected workbook preview to include an image media id.");
        }

        const media = yield* workspaceTabularFileSystem.readTabularMedia({
          cwd,
          relativePath: "media.xlsx",
          mtimeMs: preview.mtimeMs,
          mediaId,
        });

        expect(media.mediaId).toBe(mediaId);
        expect(media.mimeType).toBe("image/png");
        expect(media.contentBase64.length).toBeGreaterThan(0);
      }),
    );
  });

  describe("writeTabularFile", () => {
    it.effect(
      "writes editable delimited previews beyond csv and rejects stale mtime conflicts",
      () =>
        Effect.gen(function* () {
          const workspaceTabularFileSystem = yield* WorkspaceTabularFileSystem;
          const fileSystem = yield* FileSystem.FileSystem;
          const cwd = yield* makeTempDir;
          const absolutePath = yield* writeTextFile(cwd, "planning.csv", "name,owner\nAPI,Ada\n");
          const psvAbsolutePath = yield* writeTextFile(
            cwd,
            "planning.psv",
            "name|owner\nDocs|Kai\n",
          );
          const txtAbsolutePath = yield* writeTextFile(
            cwd,
            "planning.txt",
            "name|owner\nAPI|Ada\nUI|Sam\n",
          );

          const initialStat = yield* fileSystem.stat(absolutePath).pipe(Effect.orDie);
          const initialMtimeMs = Math.trunc(
            Option.getOrElse(initialStat.mtime, () => new Date(0)).getTime(),
          );

          yield* workspaceTabularFileSystem.writeTabularFile({
            cwd,
            relativePath: "planning.csv",
            expectedMtimeMs: initialMtimeMs,
            patches: [
              {
                sheetName: "Sheet1",
                row: 1,
                col: 1,
                value: "Sam",
                valueKind: "text",
              },
            ],
          });

          const contents = yield* fileSystem.readFileString(absolutePath).pipe(Effect.orDie);
          expect(contents).toContain("API,Sam");

          const psvInitialStat = yield* fileSystem.stat(psvAbsolutePath).pipe(Effect.orDie);
          const psvInitialMtimeMs = Math.trunc(
            Option.getOrElse(psvInitialStat.mtime, () => new Date(0)).getTime(),
          );

          yield* workspaceTabularFileSystem.writeTabularFile({
            cwd,
            relativePath: "planning.psv",
            expectedMtimeMs: psvInitialMtimeMs,
            patches: [
              {
                sheetName: "Sheet1",
                row: 1,
                col: 1,
                value: "Mia",
                valueKind: "text",
              },
            ],
          });

          const psvContents = yield* fileSystem.readFileString(psvAbsolutePath).pipe(Effect.orDie);
          expect(psvContents).toContain("Docs|Mia");

          const txtInitialStat = yield* fileSystem.stat(txtAbsolutePath).pipe(Effect.orDie);
          const txtInitialMtimeMs = Math.trunc(
            Option.getOrElse(txtInitialStat.mtime, () => new Date(0)).getTime(),
          );

          yield* workspaceTabularFileSystem.writeTabularFile({
            cwd,
            relativePath: "planning.txt",
            expectedMtimeMs: txtInitialMtimeMs,
            patches: [
              {
                sheetName: "Sheet1",
                row: 2,
                col: 1,
                value: "Zoe",
                valueKind: "text",
              },
            ],
          });

          const txtContents = yield* fileSystem.readFileString(txtAbsolutePath).pipe(Effect.orDie);
          expect(txtContents).toContain("UI|Zoe");

          const staleExpectedMtimeMs = initialMtimeMs > 0 ? initialMtimeMs - 1 : initialMtimeMs + 1;
          const conflict = yield* workspaceTabularFileSystem
            .writeTabularFile({
              cwd,
              relativePath: "planning.csv",
              expectedMtimeMs: staleExpectedMtimeMs,
              patches: [],
            })
            .pipe(Effect.flip);

          expect(conflict.message).toBe("Workspace file was modified on disk.");
        }),
    );

    it.effect("rejects workbook writes because workbook previews are read-only in Room", () =>
      Effect.gen(function* () {
        const workspaceTabularFileSystem = yield* WorkspaceTabularFileSystem;
        const cwd = yield* makeTempDir;

        yield* writeWorkbookFile(cwd, "planning.xlsx", (workbook) => {
          workbook.addWorksheet("Summary").getCell("A1").value = "Owner";
        });
        yield* writeSheetJsWorkbookFile(cwd, "planning.xlsb", "xlsb", (workbook) => {
          configureSheetJsWorkbookFixture(workbook);
        });

        const xlsxError = yield* workspaceTabularFileSystem
          .writeTabularFile({
            cwd,
            relativePath: "planning.xlsx",
            patches: [
              {
                sheetName: "Summary",
                row: 0,
                col: 0,
                value: "Ada",
                valueKind: "text",
              },
            ],
          })
          .pipe(Effect.flip);

        expect(detailOf(xlsxError)).toContain("XLSX files are preview-only in Room");

        const xlsbError = yield* workspaceTabularFileSystem
          .writeTabularFile({
            cwd,
            relativePath: "planning.xlsb",
            patches: [
              {
                sheetName: "Summary",
                row: 0,
                col: 0,
                value: "Ada",
                valueKind: "text",
              },
            ],
          })
          .pipe(Effect.flip);

        expect(detailOf(xlsbError)).toContain("XLSB files are preview-only in Room");
      }),
    );
  });
});

describe("readSheetJsWorkbookPresentationSnapshot", () => {
  it("maps password-protected workbook errors into a user-facing unsupported message", async () => {
    const readSpy = vi.spyOn(XLSX, "read").mockImplementation(() => {
      throw new Error("Unsupported ZIP encryption");
    });

    try {
      await expect(
        readSheetJsWorkbookPresentationSnapshot({
          bytes: new Uint8Array([1, 2, 3]),
          kind: "xlsb",
          mtimeMs: 1,
          relativePath: "secure.xlsb",
          sizeBytes: 3,
        }),
      ).rejects.toThrow("Spreadsheet workbook is password-protected or encrypted: secure.xlsb");
    } finally {
      readSpy.mockRestore();
    }
  });

  it("maps parser failures into format-specific unsupported messages", async () => {
    const readSpy = vi.spyOn(XLSX, "read").mockImplementation(() => {
      throw new Error("Unexpected workbook structure");
    });

    try {
      await expect(
        readSheetJsWorkbookPresentationSnapshot({
          bytes: new Uint8Array([1, 2, 3]),
          kind: "ods",
          mtimeMs: 1,
          relativePath: "broken.ods",
          sizeBytes: 3,
        }),
      ).rejects.toThrow("Unable to read ODS workbook in Room: broken.ods");
    } finally {
      readSpy.mockRestore();
    }
  });
});

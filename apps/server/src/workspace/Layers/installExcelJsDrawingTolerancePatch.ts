import { createRequire } from "node:module";

type DrawingModel = {
  anchors: unknown[];
};

type LooseDrawingModel = {
  anchors?: unknown[];
};

type DrawingMap = Record<string, LooseDrawingModel | undefined>;

type XlsxModel = {
  drawingRels?: Record<string, unknown>;
  drawings?: DrawingMap;
};

type WorksheetReconcileOptions = {
  drawings?: DrawingMap;
  [key: string]: unknown;
};

type XlsxPrototype = {
  reconcile(model: XlsxModel, options: unknown): unknown;
};

type WorksheetXformPrototype = {
  reconcile(model: unknown, options: WorksheetReconcileOptions): unknown;
};

const EMPTY_DRAWING_MODEL = Object.freeze({
  anchors: [],
}) satisfies DrawingModel;

const require = createRequire(import.meta.url);

let didInstallPatch = false;

function normalizeDrawingModel(drawing: LooseDrawingModel | undefined): DrawingModel {
  if (!drawing) {
    return EMPTY_DRAWING_MODEL;
  }

  if (Array.isArray(drawing.anchors)) {
    return drawing as DrawingModel;
  }

  return Object.assign(drawing, {
    anchors: [],
  });
}

export function installExcelJsDrawingTolerancePatch() {
  if (didInstallPatch) {
    return;
  }

  const xlsxModule = require("exceljs/lib/xlsx/xlsx") as {
    prototype: XlsxPrototype;
  };
  const worksheetXformModule = require("exceljs/lib/xlsx/xform/sheet/worksheet-xform") as {
    prototype: WorksheetXformPrototype;
  };

  const originalXlsxReconcile = xlsxModule.prototype.reconcile;
  xlsxModule.prototype.reconcile = function reconcileXlsxModel(model, options) {
    const drawings = model.drawings ?? {};
    model.drawings = drawings;

    for (const drawingName of Object.keys(drawings)) {
      drawings[drawingName] = normalizeDrawingModel(drawings[drawingName]);
    }

    for (const drawingName of Object.keys(model.drawingRels ?? {})) {
      drawings[drawingName] = normalizeDrawingModel(drawings[drawingName]);
    }

    return originalXlsxReconcile.call(this, model, options);
  };

  const originalWorksheetReconcile = worksheetXformModule.prototype.reconcile;
  worksheetXformModule.prototype.reconcile = function reconcileWorksheetModel(model, options) {
    if (!options || typeof options !== "object") {
      return originalWorksheetReconcile.call(this, model, options);
    }

    const safeOptions = Object.assign({}, options, {
      drawings: new Proxy(options.drawings ?? {}, {
        get(target, property, receiver) {
          if (typeof property !== "string") {
            return Reflect.get(target, property, receiver);
          }

          return normalizeDrawingModel(
            Reflect.get(target, property, receiver) as LooseDrawingModel | undefined,
          );
        },
      }),
    }) satisfies WorksheetReconcileOptions;

    return originalWorksheetReconcile.call(this, model, safeOptions);
  };

  didInstallPatch = true;
}

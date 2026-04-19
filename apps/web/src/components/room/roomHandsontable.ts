"use client";

import "handsontable/styles/ht-icons-main.css";
import "handsontable/styles/ht-theme-main.css";

import { CheckboxCellType, NumericCellType, registerCellType } from "handsontable/cellTypes";
import {
  Comments,
  CopyPaste,
  HiddenColumns,
  HiddenRows,
  ManualColumnResize,
  ManualRowResize,
  MergeCells,
  UndoRedo,
  registerPlugin,
} from "handsontable/plugins";

let handsontableModulesRegistered = false;

export const HANDSONTABLE_LICENSE_KEY =
  import.meta.env.VITE_HANDSONTABLE_LICENSE_KEY ||
  (import.meta.env.DEV ? "non-commercial-and-evaluation" : undefined);

export function roomHandsontableThemeName(resolvedTheme: "light" | "dark") {
  return resolvedTheme === "dark" ? "ht-theme-main-dark" : "ht-theme-main";
}

export function ensureHandsontableModulesRegistered() {
  if (handsontableModulesRegistered) {
    return;
  }

  registerPlugin(Comments);
  registerPlugin(CopyPaste);
  registerPlugin(HiddenColumns);
  registerPlugin(HiddenRows);
  registerPlugin(ManualColumnResize);
  registerPlugin(ManualRowResize);
  registerPlugin(MergeCells);
  registerPlugin(UndoRedo);
  registerCellType(CheckboxCellType);
  registerCellType(NumericCellType);
  handsontableModulesRegistered = true;
}

export function spreadsheetColumnLabel(columnIndex: number): string {
  let label = "";
  let current = columnIndex + 1;

  while (current > 0) {
    const remainder = (current - 1) % 26;
    label = String.fromCharCode(65 + remainder) + label;
    current = Math.floor((current - 1) / 26);
  }

  return label;
}

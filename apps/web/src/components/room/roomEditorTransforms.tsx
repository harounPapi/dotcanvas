"use client";

import { insertCodeBlock, toggleCodeBlock } from "@platejs/code-block";
import { insertEquation, insertInlineEquation } from "@platejs/math";
import { toggleList } from "@platejs/list";
import { insertTable } from "@platejs/table";
import { KEYS, PathApi } from "platejs";
import type { PlateEditor } from "platejs/react";

import { assignMissingRoomElementIds, cloneRoomElementWithFreshIds } from "./roomElementIds";

export const ROOM_MERMAID_BLOCK = "room_mermaid";

export function insertRoomBlock(editor: PlateEditor, type: string) {
  switch (type) {
    case KEYS.ul: {
      toggleList(editor, { listStyleType: KEYS.ul });
      break;
    }
    case KEYS.ol: {
      toggleList(editor, { listStyleType: KEYS.ol });
      break;
    }
    case KEYS.listTodo: {
      toggleList(editor, { listStyleType: KEYS.listTodo });
      editor.tf.setNodes({ checked: false, listStyleType: KEYS.listTodo });
      break;
    }
    case KEYS.codeBlock: {
      insertCodeBlock(editor, { select: true });
      break;
    }
    case ROOM_MERMAID_BLOCK: {
      insertCodeBlock(editor, { select: true });
      editor.tf.setNodes({ lang: "mermaid" });
      break;
    }
    case KEYS.equation: {
      insertEquation(editor, { select: true });
      break;
    }
    case KEYS.hr: {
      editor.tf.setNodes({ type: KEYS.hr });
      editor.tf.insertNodes(editor.api.create.block({ type: KEYS.p }), { select: true });
      break;
    }
    case KEYS.table: {
      insertTable(
        editor,
        {
          colCount: 3,
          header: true,
          rowCount: 3,
        },
        { select: true },
      );
      break;
    }
    default: {
      const currentBlock = editor.api.block();
      const currentPath = currentBlock?.[1];
      editor.tf.insertNodes(editor.api.create.block({ type }), {
        ...(currentPath ? { at: PathApi.next(currentPath) } : {}),
        select: true,
      });
    }
  }

  assignMissingRoomElementIds(editor as any);
}

export function insertRoomInlineElement(editor: PlateEditor, type: string) {
  if (type === KEYS.inlineEquation) {
    insertInlineEquation(editor, "", { select: true });
  }
}

export function setRoomBlockType(editor: PlateEditor, type: string, at?: number[]) {
  const entry = at ? editor.api.node(at) : undefined;
  const entries = entry ? [entry] : editor.api.blocks({ mode: "lowest" });

  editor.tf.withoutNormalizing(() => {
    entries.forEach(([node, path]) => {
      if (node[KEYS.listType]) {
        editor.tf.unsetNodes([KEYS.listType, "indent"], { at: path });
      }

      switch (type) {
        case KEYS.ul:
          toggleList(editor, { listStyleType: KEYS.ul });
          break;
        case KEYS.ol:
          toggleList(editor, { listStyleType: KEYS.ol });
          break;
        case KEYS.listTodo:
          toggleList(editor, { listStyleType: KEYS.listTodo });
          editor.tf.setNodes({ checked: false, listStyleType: KEYS.listTodo }, { at: path });
          break;
        case KEYS.codeBlock:
          toggleCodeBlock(editor);
          break;
        case ROOM_MERMAID_BLOCK:
          if (node.type !== KEYS.codeBlock) {
            toggleCodeBlock(editor);
          }
          editor.tf.setNodes({ lang: "mermaid", type: KEYS.codeBlock }, { at: path });
          break;
        default:
          if (node.type !== type) {
            editor.tf.setNodes({ type }, { at: path });
          }
      }
    });
  });

  assignMissingRoomElementIds(editor as any);
}

export function duplicateRoomBlock(editor: PlateEditor, path: number[]) {
  const entry = editor.api.node(path);
  if (!entry) {
    return;
  }

  const [node] = entry;
  editor.tf.insertNodes(cloneRoomElementWithFreshIds(node), {
    at: PathApi.next(path),
    select: true,
  });
  assignMissingRoomElementIds(editor as any);
}

"use client";

import {
  CopyIcon,
  Heading1Icon,
  Heading2Icon,
  Heading3Icon,
  PilcrowIcon,
  QuoteIcon,
  SquareCodeIcon,
  Trash2Icon,
  type LucideIcon,
} from "lucide-react";
import { KEYS } from "platejs";
import type { PlateEditor } from "platejs/react";

import { duplicateRoomBlock, setRoomBlockType } from "./roomEditorTransforms";

export type RoomBlockActionItem = {
  icon: LucideIcon;
  label: string;
  onSelect: () => void;
  variant?: "default" | "destructive";
};

export function getRoomBlockActionGroups(
  editor: PlateEditor,
  path: number[],
): RoomBlockActionItem[][] {
  return [
    [
      {
        icon: CopyIcon,
        label: "Duplicate",
        onSelect: () => {
          duplicateRoomBlock(editor, path);
        },
      },
      {
        icon: Trash2Icon,
        label: "Delete",
        onSelect: () => {
          editor.tf.removeNodes({ at: path });
        },
        variant: "destructive",
      },
    ],
    [
      {
        icon: PilcrowIcon,
        label: "Paragraph",
        onSelect: () => {
          setRoomBlockType(editor, KEYS.p, path);
        },
      },
      {
        icon: Heading1Icon,
        label: "Heading 1",
        onSelect: () => {
          setRoomBlockType(editor, KEYS.h1, path);
        },
      },
      {
        icon: Heading2Icon,
        label: "Heading 2",
        onSelect: () => {
          setRoomBlockType(editor, KEYS.h2, path);
        },
      },
      {
        icon: Heading3Icon,
        label: "Heading 3",
        onSelect: () => {
          setRoomBlockType(editor, KEYS.h3, path);
        },
      },
      {
        icon: QuoteIcon,
        label: "Blockquote",
        onSelect: () => {
          setRoomBlockType(editor, KEYS.blockquote, path);
        },
      },
      {
        icon: SquareCodeIcon,
        label: "Code block",
        onSelect: () => {
          setRoomBlockType(editor, KEYS.codeBlock, path);
        },
      },
    ],
  ];
}

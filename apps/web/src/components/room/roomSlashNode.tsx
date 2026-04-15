"use client";

import {
  ChevronRightIcon,
  Code2,
  Heading1Icon,
  Heading2Icon,
  Heading3Icon,
  ListIcon,
  ListOrdered,
  MinusIcon,
  PilcrowIcon,
  Quote,
  RadicalIcon,
  Square,
  Table,
} from "lucide-react";
import { KEYS, type TComboboxInputElement } from "platejs";
import { PlateElement, type PlateElementProps } from "platejs/react";

import {
  ROOM_MERMAID_BLOCK,
  insertRoomBlock,
  insertRoomInlineElement,
} from "./roomEditorTransforms";
import {
  InlineCombobox,
  InlineComboboxContent,
  InlineComboboxEmpty,
  InlineComboboxGroup,
  InlineComboboxGroupLabel,
  InlineComboboxInput,
  InlineComboboxItem,
} from "./roomInlineCombobox";

type SlashGroup = {
  group: string;
  items: Array<{
    icon: React.ReactNode;
    keywords?: string[];
    label: string;
    onSelect: (value: string, focusEditor: boolean | undefined) => void;
    value: string;
    focusEditor?: boolean;
  }>;
};

export function RoomSlashInputElement(props: PlateElementProps<TComboboxInputElement>) {
  const { editor, element } = props;

  const groups: SlashGroup[] = [
    {
      group: "Basic blocks",
      items: [
        {
          icon: <PilcrowIcon />,
          keywords: ["paragraph", "text"],
          label: "Text",
          onSelect: (value) => insertRoomBlock(editor as any, value),
          value: KEYS.p,
        },
        {
          icon: <Heading1Icon />,
          keywords: ["title", "h1"],
          label: "Heading 1",
          onSelect: (value) => insertRoomBlock(editor as any, value),
          value: KEYS.h1,
        },
        {
          icon: <Heading2Icon />,
          keywords: ["subtitle", "h2"],
          label: "Heading 2",
          onSelect: (value) => insertRoomBlock(editor as any, value),
          value: KEYS.h2,
        },
        {
          icon: <Heading3Icon />,
          keywords: ["subtitle", "h3"],
          label: "Heading 3",
          onSelect: (value) => insertRoomBlock(editor as any, value),
          value: KEYS.h3,
        },
        {
          icon: <ListIcon />,
          keywords: ["unordered", "ul", "-"],
          label: "Bulleted list",
          onSelect: (value) => insertRoomBlock(editor as any, value),
          value: KEYS.ul,
        },
        {
          icon: <ListOrdered />,
          keywords: ["ordered", "ol", "1"],
          label: "Numbered list",
          onSelect: (value) => insertRoomBlock(editor as any, value),
          value: KEYS.ol,
        },
        {
          icon: <Square />,
          keywords: ["checklist", "task", "todo", "[]"],
          label: "To-do list",
          onSelect: (value) => insertRoomBlock(editor as any, value),
          value: KEYS.listTodo,
        },
        {
          icon: <Code2 />,
          keywords: ["```", "code", "snippet"],
          label: "Code block",
          onSelect: (value) => insertRoomBlock(editor as any, value),
          value: KEYS.codeBlock,
        },
        {
          icon: <Table />,
          keywords: ["grid"],
          label: "Table",
          onSelect: (value) => insertRoomBlock(editor as any, value),
          value: KEYS.table,
        },
        {
          icon: <Quote />,
          keywords: ["blockquote", "citation", ">"],
          label: "Blockquote",
          onSelect: (value) => insertRoomBlock(editor as any, value),
          value: KEYS.blockquote,
        },
        {
          icon: <MinusIcon />,
          keywords: ["divider", "---", "rule"],
          label: "Divider",
          onSelect: (value) => insertRoomBlock(editor as any, value),
          value: KEYS.hr,
        },
      ],
    },
    {
      group: "Advanced blocks",
      items: [
        {
          icon: <RadicalIcon />,
          label: "Equation",
          onSelect: (value) => insertRoomBlock(editor as any, value),
          value: KEYS.equation,
        },
        {
          icon: <Code2 />,
          keywords: ["diagram", "mermaid", "flowchart"],
          label: "Mermaid diagram",
          onSelect: (value) => insertRoomBlock(editor as any, value),
          value: ROOM_MERMAID_BLOCK,
        },
      ],
    },
    {
      group: "Inline",
      items: [
        {
          focusEditor: false,
          icon: <RadicalIcon />,
          label: "Inline equation",
          onSelect: (value) => insertRoomInlineElement(editor as any, value),
          value: KEYS.inlineEquation,
        },
      ],
    },
  ];

  return (
    <PlateElement {...props} as="span" data-room-slash-input="true">
      <InlineCombobox element={element} trigger="/">
        <InlineComboboxInput />
        <InlineComboboxContent data-room-slash-menu="true">
          <InlineComboboxEmpty>No results</InlineComboboxEmpty>
          {groups.map(({ group, items }) => (
            <InlineComboboxGroup key={group}>
              <InlineComboboxGroupLabel>{group}</InlineComboboxGroupLabel>
              {items.map(({ focusEditor, icon, keywords, label, onSelect, value }) => (
                <InlineComboboxItem
                  {...(focusEditor !== undefined ? { focusEditor } : {})}
                  group={group}
                  key={value}
                  {...(keywords ? { keywords } : {})}
                  label={label}
                  onClick={() => {
                    onSelect(value, focusEditor);
                  }}
                  value={value}
                >
                  <span className="mr-2 text-muted-foreground">{icon}</span>
                  <span className="flex-1">{label}</span>
                  <ChevronRightIcon className="ml-2 size-3.5 text-muted-foreground/50" />
                </InlineComboboxItem>
              ))}
            </InlineComboboxGroup>
          ))}
        </InlineComboboxContent>
      </InlineCombobox>
    </PlateElement>
  );
}

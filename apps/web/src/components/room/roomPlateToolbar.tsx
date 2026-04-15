"use client";

import type * as React from "react";

import { toggleCodeBlock } from "@platejs/code-block";
import { flip, offset, useFloatingToolbar, useFloatingToolbarState } from "@platejs/floating";
import { upsertLink } from "@platejs/link";
import { ListStyleType, someList, toggleList } from "@platejs/list";
import { useIndentTodoToolBarButton, useIndentTodoToolBarButtonState } from "@platejs/list/react";
import { insertEquation, insertInlineEquation } from "@platejs/math";
import { insertTable } from "@platejs/table";
import {
  BoldIcon,
  ChevronDownIcon,
  Code2Icon,
  FileCode2Icon,
  Heading1Icon,
  Heading2Icon,
  Heading3Icon,
  ItalicIcon,
  Link2Icon,
  ListIcon,
  ListOrderedIcon,
  MinusIcon,
  MoreHorizontalIcon,
  PilcrowIcon,
  PlusIcon,
  QuoteIcon,
  RadicalIcon,
  Redo2Icon,
  SquareIcon,
  StrikethroughIcon,
  Table2Icon,
  Undo2Icon,
} from "lucide-react";
import { KEYS } from "platejs";
import {
  useEditorId,
  useEditorReadOnly,
  useEditorRef,
  useEditorSelector,
  useEventEditorValue,
  useMarkToolbarButton,
  useMarkToolbarButtonState,
} from "platejs/react";
import { useMemo, useState } from "react";

import {
  insertRoomBlock,
  insertRoomInlineElement,
  ROOM_MERMAID_BLOCK,
  setRoomBlockType,
} from "./roomEditorTransforms";
import {
  RoomDropdownMenu,
  RoomDropdownMenuContent,
  RoomDropdownMenuGroup,
  RoomDropdownMenuItem,
  RoomDropdownMenuRadioItem,
  RoomDropdownMenuTrigger,
} from "./roomRadixMenu";
import {
  roomDropdownArrowVariants,
  roomToolbarButtonVariants,
  RoomToolbar,
  RoomToolbarButton,
  RoomToolbarGroup,
  RoomToolbarMenuGroup,
  RoomToolbarSplitButton,
  RoomToolbarSplitButtonPrimary,
} from "./roomToolbar";
import { cn } from "~/lib/utils";

function preventToolbarMouseDown(event: React.MouseEvent) {
  event.preventDefault();
}

const TURN_INTO_ITEMS = [
  { icon: <FileCode2Icon />, label: "Code block", value: KEYS.codeBlock },
  { icon: <Heading1Icon />, label: "Heading 1", value: KEYS.h1 },
  { icon: <Heading2Icon />, label: "Heading 2", value: KEYS.h2 },
  { icon: <Heading3Icon />, label: "Heading 3", value: KEYS.h3 },
  { icon: <ListIcon />, label: "Bulleted list", value: KEYS.ul },
  { icon: <ListOrderedIcon />, label: "Numbered list", value: KEYS.ol },
  { icon: <SquareIcon />, label: "To-do list", value: KEYS.listTodo },
  { icon: <QuoteIcon />, label: "Quote", value: KEYS.blockquote },
  { icon: <Code2Icon />, label: "Mermaid", value: ROOM_MERMAID_BLOCK },
  { icon: <MinusIcon />, label: "Divider", value: KEYS.hr },
  { icon: <RadicalIcon />, label: "Equation", value: KEYS.equation },
  { icon: <Table2Icon />, label: "Table", value: KEYS.table },
  { icon: <PilcrowIcon />, label: "Text", value: KEYS.p },
] as const;

const INSERT_GROUPS = [
  {
    group: "Basic blocks",
    items: [
      { icon: <PilcrowIcon />, label: "Paragraph", value: KEYS.p },
      { icon: <Heading1Icon />, label: "Heading 1", value: KEYS.h1 },
      { icon: <Heading2Icon />, label: "Heading 2", value: KEYS.h2 },
      { icon: <Heading3Icon />, label: "Heading 3", value: KEYS.h3 },
      { icon: <FileCode2Icon />, label: "Code block", value: KEYS.codeBlock },
      { icon: <Table2Icon />, label: "Table", value: KEYS.table },
      { icon: <QuoteIcon />, label: "Blockquote", value: KEYS.blockquote },
      { icon: <MinusIcon />, label: "Divider", value: KEYS.hr },
    ],
  },
  {
    group: "Lists",
    items: [
      { icon: <ListIcon />, label: "Bulleted list", value: KEYS.ul },
      { icon: <ListOrderedIcon />, label: "Numbered list", value: KEYS.ol },
      { icon: <SquareIcon />, label: "To-do list", value: KEYS.listTodo },
    ],
  },
  {
    group: "Advanced blocks",
    items: [
      { icon: <RadicalIcon />, label: "Equation", value: KEYS.equation },
      { icon: <Code2Icon />, label: "Mermaid diagram", value: ROOM_MERMAID_BLOCK },
    ],
  },
  {
    group: "Inline",
    items: [
      { icon: <Link2Icon />, label: "Link", value: KEYS.link },
      { icon: <RadicalIcon />, label: "Inline equation", value: KEYS.inlineEquation },
    ],
  },
] as const;

function selectionBlockType(editor: any): string {
  const blockEntry = editor.api.block();
  const node = blockEntry?.[0] as
    | {
        checked?: boolean;
        lang?: string;
        listStyleType?: string;
        type?: string;
      }
    | undefined;

  if (!node) {
    return KEYS.p;
  }

  if (node.type === KEYS.codeBlock && node.lang === "mermaid") {
    return ROOM_MERMAID_BLOCK;
  }

  if (node.listStyleType === KEYS.listTodo || typeof node.checked === "boolean") {
    return KEYS.listTodo;
  }

  if (
    node.listStyleType === ListStyleType.Decimal ||
    node.listStyleType === ListStyleType.LowerAlpha ||
    node.listStyleType === ListStyleType.UpperAlpha ||
    node.listStyleType === ListStyleType.LowerRoman ||
    node.listStyleType === ListStyleType.UpperRoman
  ) {
    return KEYS.ol;
  }

  if (
    node.listStyleType === ListStyleType.Disc ||
    node.listStyleType === ListStyleType.Circle ||
    node.listStyleType === ListStyleType.Square
  ) {
    return KEYS.ul;
  }

  return node.type ?? KEYS.p;
}

function RoomUndoToolbarButton() {
  const editor = useEditorRef();
  const disabled = useEditorSelector((nextEditor) => nextEditor.history.undos.length === 0, []);

  return (
    <RoomToolbarButton
      disabled={disabled}
      onClick={() => {
        editor.undo();
      }}
      onMouseDown={preventToolbarMouseDown}
      tooltip="Undo"
    >
      <Undo2Icon />
    </RoomToolbarButton>
  );
}

function RoomRedoToolbarButton() {
  const editor = useEditorRef();
  const disabled = useEditorSelector((nextEditor) => nextEditor.history.redos.length === 0, []);

  return (
    <RoomToolbarButton
      disabled={disabled}
      onClick={() => {
        editor.redo();
      }}
      onMouseDown={preventToolbarMouseDown}
      tooltip="Redo"
    >
      <Redo2Icon />
    </RoomToolbarButton>
  );
}

function RoomMarkToolbarButton(props: {
  children: React.ReactNode;
  nodeType: string;
  tooltip: string;
}) {
  const state = useMarkToolbarButtonState({ nodeType: props.nodeType });
  const { props: buttonProps } = useMarkToolbarButton(state);

  return (
    <RoomToolbarButton
      onClick={buttonProps.onClick}
      onMouseDown={buttonProps.onMouseDown}
      pressed={Boolean(buttonProps.pressed)}
      tooltip={props.tooltip}
    >
      {props.children}
    </RoomToolbarButton>
  );
}

function RoomTodoToolbarButton() {
  const state = useIndentTodoToolBarButtonState({ nodeType: "todo" });
  const { props: buttonProps } = useIndentTodoToolBarButton(state);

  return (
    <RoomToolbarButton
      onClick={buttonProps.onClick}
      onMouseDown={buttonProps.onMouseDown}
      pressed={Boolean(buttonProps.pressed)}
      tooltip="Todo list"
    >
      <SquareIcon />
    </RoomToolbarButton>
  );
}

function RoomTurnIntoToolbarButton() {
  const editor = useEditorRef() as any;
  const [open, setOpen] = useState(false);
  const value = useEditorSelector((nextEditor) => selectionBlockType(nextEditor), []);
  const selectedItem = useMemo(
    () => TURN_INTO_ITEMS.find((item) => item.value === value) ?? TURN_INTO_ITEMS.at(-1)!,
    [value],
  );

  return (
    <RoomDropdownMenu onOpenChange={setOpen} open={open}>
      <RoomDropdownMenuTrigger
        className={cn(
          roomToolbarButtonVariants({
            size: "sm",
            variant: "default",
          }),
          "min-w-[132px] justify-between gap-1 pr-1",
          open ? "bg-accent text-accent-foreground" : undefined,
        )}
      >
        <span className="truncate">{selectedItem.label}</span>
        <span className="flex shrink-0 items-center">
          <ChevronDownIcon className="size-3.5 text-muted-foreground" data-icon />
        </span>
        <span className="sr-only">Open turn into menu</span>
      </RoomDropdownMenuTrigger>
      <RoomDropdownMenuContent
        align="start"
        className="ignore-click-outside/toolbar min-w-0"
        sideOffset={8}
      >
        <RoomToolbarMenuGroup
          label="Turn into"
          onValueChange={(nextValue) => {
            setRoomBlockType(editor, nextValue);
            editor.tf.focus();
          }}
          value={value}
        >
          {TURN_INTO_ITEMS.map((item) => (
            <RoomDropdownMenuRadioItem
              className="min-w-[190px]"
              key={item.value}
              value={item.value}
            >
              {item.icon}
              {item.label}
            </RoomDropdownMenuRadioItem>
          ))}
        </RoomToolbarMenuGroup>
      </RoomDropdownMenuContent>
    </RoomDropdownMenu>
  );
}

function RoomInsertToolbarButton() {
  const editor = useEditorRef() as any;
  const [open, setOpen] = useState(false);

  return (
    <RoomDropdownMenu onOpenChange={setOpen} open={open}>
      <RoomDropdownMenuTrigger
        className={cn(
          roomToolbarButtonVariants({
            size: "sm",
            variant: "default",
          }),
          open ? "bg-accent text-accent-foreground" : undefined,
        )}
      >
        <PlusIcon />
      </RoomDropdownMenuTrigger>
      <RoomDropdownMenuContent
        align="start"
        className="ignore-click-outside/toolbar flex max-h-[500px] min-w-0 flex-col overflow-y-auto"
        sideOffset={8}
      >
        {INSERT_GROUPS.map(({ group, items }) => (
          <RoomToolbarMenuGroup key={group} label={group}>
            {items.map((item) => (
              <RoomDropdownMenuItem
                className="min-w-[190px]"
                key={item.value}
                onClick={() => {
                  if (item.value === KEYS.inlineEquation || item.value === KEYS.link) {
                    if (item.value === KEYS.link) {
                      const url = window.prompt("Link URL", "https://");
                      if (!url || url.trim().length === 0) {
                        return;
                      }
                      upsertLink(
                        editor,
                        editor?.api?.isCollapsed?.() ? { text: url, url } : { url },
                      );
                    } else {
                      insertRoomInlineElement(editor, item.value);
                    }
                  } else {
                    insertRoomBlock(editor, item.value);
                  }
                  editor.tf.focus();
                }}
              >
                {item.icon}
                {item.label}
              </RoomDropdownMenuItem>
            ))}
          </RoomToolbarMenuGroup>
        ))}
      </RoomDropdownMenuContent>
    </RoomDropdownMenu>
  );
}

function RoomBulletedListToolbarButton() {
  const editor = useEditorRef();
  const [open, setOpen] = useState(false);
  const pressed = useEditorSelector(
    (nextEditor) =>
      someList(nextEditor, [ListStyleType.Disc, ListStyleType.Circle, ListStyleType.Square]),
    [],
  );

  return (
    <RoomToolbarSplitButton pressed={open}>
      <RoomToolbarSplitButtonPrimary
        className={pressed ? "bg-accent text-accent-foreground" : undefined}
        onClick={() => {
          toggleList(editor, { listStyleType: ListStyleType.Disc });
        }}
      >
        <ListIcon />
      </RoomToolbarSplitButtonPrimary>
      <RoomDropdownMenu onOpenChange={setOpen} open={open}>
        <RoomDropdownMenuTrigger
          className={cn(
            roomDropdownArrowVariants({
              size: "sm",
              variant: "default",
            }),
            open ? "bg-accent text-accent-foreground" : undefined,
          )}
        >
          <ChevronDownIcon className="size-3.5 text-muted-foreground" data-icon />
          <span className="sr-only">Bulleted list options</span>
        </RoomDropdownMenuTrigger>
        <RoomDropdownMenuContent align="start" sideOffset={8}>
          <RoomDropdownMenuGroup>
            <RoomDropdownMenuItem
              onClick={() => {
                toggleList(editor, { listStyleType: ListStyleType.Disc });
                editor.tf.focus();
              }}
            >
              <div className="size-2 rounded-full border border-current bg-current" />
              Default
            </RoomDropdownMenuItem>
            <RoomDropdownMenuItem
              onClick={() => {
                toggleList(editor, { listStyleType: ListStyleType.Circle });
                editor.tf.focus();
              }}
            >
              <div className="size-2 rounded-full border border-current" />
              Circle
            </RoomDropdownMenuItem>
            <RoomDropdownMenuItem
              onClick={() => {
                toggleList(editor, { listStyleType: ListStyleType.Square });
                editor.tf.focus();
              }}
            >
              <div className="size-2 border border-current bg-current" />
              Square
            </RoomDropdownMenuItem>
          </RoomDropdownMenuGroup>
        </RoomDropdownMenuContent>
      </RoomDropdownMenu>
    </RoomToolbarSplitButton>
  );
}

function RoomNumberedListToolbarButton() {
  const editor = useEditorRef();
  const [open, setOpen] = useState(false);
  const pressed = useEditorSelector(
    (nextEditor) =>
      someList(nextEditor, [
        ListStyleType.Decimal,
        ListStyleType.LowerAlpha,
        ListStyleType.UpperAlpha,
        ListStyleType.LowerRoman,
        ListStyleType.UpperRoman,
      ]),
    [],
  );

  return (
    <RoomToolbarSplitButton pressed={open}>
      <RoomToolbarSplitButtonPrimary
        className={pressed ? "bg-accent text-accent-foreground" : undefined}
        onClick={() => {
          toggleList(editor, { listStyleType: ListStyleType.Decimal });
        }}
      >
        <ListOrderedIcon />
      </RoomToolbarSplitButtonPrimary>
      <RoomDropdownMenu onOpenChange={setOpen} open={open}>
        <RoomDropdownMenuTrigger
          className={cn(
            roomDropdownArrowVariants({
              size: "sm",
              variant: "default",
            }),
            open ? "bg-accent text-accent-foreground" : undefined,
          )}
        >
          <ChevronDownIcon className="size-3.5 text-muted-foreground" data-icon />
          <span className="sr-only">Numbered list options</span>
        </RoomDropdownMenuTrigger>
        <RoomDropdownMenuContent align="start" sideOffset={8}>
          <RoomDropdownMenuGroup>
            <RoomDropdownMenuItem
              onClick={() => {
                toggleList(editor, { listStyleType: ListStyleType.Decimal });
                editor.tf.focus();
              }}
            >
              Decimal (1, 2, 3)
            </RoomDropdownMenuItem>
            <RoomDropdownMenuItem
              onClick={() => {
                toggleList(editor, { listStyleType: ListStyleType.LowerAlpha });
                editor.tf.focus();
              }}
            >
              Lower Alpha (a, b, c)
            </RoomDropdownMenuItem>
            <RoomDropdownMenuItem
              onClick={() => {
                toggleList(editor, { listStyleType: ListStyleType.UpperAlpha });
                editor.tf.focus();
              }}
            >
              Upper Alpha (A, B, C)
            </RoomDropdownMenuItem>
            <RoomDropdownMenuItem
              onClick={() => {
                toggleList(editor, { listStyleType: ListStyleType.LowerRoman });
                editor.tf.focus();
              }}
            >
              Lower Roman (i, ii, iii)
            </RoomDropdownMenuItem>
            <RoomDropdownMenuItem
              onClick={() => {
                toggleList(editor, { listStyleType: ListStyleType.UpperRoman });
                editor.tf.focus();
              }}
            >
              Upper Roman (I, II, III)
            </RoomDropdownMenuItem>
          </RoomDropdownMenuGroup>
        </RoomDropdownMenuContent>
      </RoomDropdownMenu>
    </RoomToolbarSplitButton>
  );
}

function RoomLinkToolbarButton() {
  const editor = useEditorRef() as any;

  return (
    <RoomToolbarButton
      onClick={() => {
        const url = window.prompt("Link URL", "https://");
        if (!url || url.trim().length === 0) {
          return;
        }

        upsertLink(editor, editor?.api?.isCollapsed?.() ? { text: url, url } : { url });
      }}
      onMouseDown={preventToolbarMouseDown}
      tooltip="Link"
    >
      <Link2Icon />
    </RoomToolbarButton>
  );
}

function RoomTableToolbarButton() {
  const editor = useEditorRef();

  return (
    <RoomToolbarButton
      onClick={() => {
        insertTable(
          editor,
          {
            colCount: 3,
            header: true,
            rowCount: 3,
          },
          { select: true },
        );
      }}
      onMouseDown={preventToolbarMouseDown}
      tooltip="Table"
    >
      <Table2Icon />
    </RoomToolbarButton>
  );
}

function RoomCodeBlockToolbarButton() {
  const editor = useEditorRef();

  return (
    <RoomToolbarButton
      onClick={() => {
        toggleCodeBlock(editor);
      }}
      onMouseDown={preventToolbarMouseDown}
      tooltip="Code"
    >
      <FileCode2Icon />
    </RoomToolbarButton>
  );
}

function RoomBlockEquationToolbarButton() {
  const editor = useEditorRef();

  return (
    <RoomToolbarButton
      onClick={() => {
        insertEquation(editor);
      }}
      onMouseDown={preventToolbarMouseDown}
      tooltip="Block equation"
    >
      <RadicalIcon />
    </RoomToolbarButton>
  );
}

function RoomInlineEquationToolbarButton() {
  const editor = useEditorRef();

  return (
    <RoomToolbarButton
      onClick={() => {
        insertInlineEquation(editor);
      }}
      onMouseDown={preventToolbarMouseDown}
      tooltip="Inline equation"
    >
      <RadicalIcon />
    </RoomToolbarButton>
  );
}

function RoomMoreToolbarButton() {
  const editor = useEditorRef() as any;
  const [open, setOpen] = useState(false);

  return (
    <RoomDropdownMenu onOpenChange={setOpen} open={open}>
      <RoomDropdownMenuTrigger
        className={cn(
          roomToolbarButtonVariants({
            size: "sm",
            variant: "default",
          }),
          open ? "bg-accent text-accent-foreground" : undefined,
        )}
      >
        <MoreHorizontalIcon />
      </RoomDropdownMenuTrigger>
      <RoomDropdownMenuContent
        align="start"
        className="ignore-click-outside/toolbar flex min-w-[180px] flex-col"
        sideOffset={8}
      >
        <RoomDropdownMenuGroup>
          <RoomDropdownMenuItem
            onClick={() => {
              insertRoomBlock(editor, ROOM_MERMAID_BLOCK);
              editor.tf.focus();
            }}
          >
            <Code2Icon />
            Mermaid diagram
          </RoomDropdownMenuItem>
          <RoomDropdownMenuItem
            onClick={() => {
              insertEquation(editor);
              editor.tf.focus();
            }}
          >
            <RadicalIcon />
            Block equation
          </RoomDropdownMenuItem>
          <RoomDropdownMenuItem
            onClick={() => {
              insertInlineEquation(editor);
              editor.tf.focus();
            }}
          >
            <RadicalIcon />
            Inline equation
          </RoomDropdownMenuItem>
          <RoomDropdownMenuItem
            onClick={() => {
              const url = window.prompt("Link URL", "https://");
              if (!url || url.trim().length === 0) {
                return;
              }
              upsertLink(editor, editor?.api?.isCollapsed?.() ? { text: url, url } : { url });
              editor.tf.focus();
            }}
          >
            <Link2Icon />
            Link
          </RoomDropdownMenuItem>
        </RoomDropdownMenuGroup>
      </RoomDropdownMenuContent>
    </RoomDropdownMenu>
  );
}

export function RoomFixedToolbar(props: React.ComponentPropsWithoutRef<typeof RoomToolbar>) {
  const { className, ...rest } = props;

  return (
    <RoomToolbar
      className={cn(
        "scrollbar-hide sticky top-0 left-0 z-20 w-full justify-between overflow-x-auto border-b border-b-border bg-background/95 p-1 backdrop-blur-sm supports-backdrop-blur:bg-background/60",
        className,
      )}
      data-room-plate-toolbar="fixed"
      {...rest}
    />
  );
}

export function RoomFixedToolbarButtons() {
  const readOnly = useEditorReadOnly();

  if (readOnly) {
    return null;
  }

  return (
    <div className="flex w-full">
      <RoomToolbarGroup>
        <RoomUndoToolbarButton />
        <RoomRedoToolbarButton />
      </RoomToolbarGroup>

      <RoomToolbarGroup>
        <RoomInsertToolbarButton />
        <RoomTurnIntoToolbarButton />
      </RoomToolbarGroup>

      <RoomToolbarGroup>
        <RoomMarkToolbarButton nodeType={KEYS.bold} tooltip="Bold">
          <BoldIcon />
        </RoomMarkToolbarButton>
        <RoomMarkToolbarButton nodeType={KEYS.italic} tooltip="Italic">
          <ItalicIcon />
        </RoomMarkToolbarButton>
        <RoomMarkToolbarButton nodeType={KEYS.strikethrough} tooltip="Strikethrough">
          <StrikethroughIcon />
        </RoomMarkToolbarButton>
        <RoomMarkToolbarButton nodeType={KEYS.code} tooltip="Code">
          <Code2Icon />
        </RoomMarkToolbarButton>
      </RoomToolbarGroup>

      <RoomToolbarGroup>
        <RoomBulletedListToolbarButton />
        <RoomNumberedListToolbarButton />
        <RoomTodoToolbarButton />
      </RoomToolbarGroup>

      <RoomToolbarGroup>
        <RoomCodeBlockToolbarButton />
        <RoomTableToolbarButton />
        <RoomLinkToolbarButton />
      </RoomToolbarGroup>

      <RoomToolbarGroup>
        <RoomMoreToolbarButton />
      </RoomToolbarGroup>
    </div>
  );
}

export function RoomFloatingToolbar(props: React.ComponentPropsWithoutRef<typeof RoomToolbar>) {
  const { children, className, ...rest } = props;
  const editorId = useEditorId();
  const focusedEditorId = useEventEditorValue("focus");
  const floatingToolbarState = useFloatingToolbarState({
    editorId,
    focusedEditorId,
    floatingOptions: {
      middleware: [
        offset(12),
        flip({
          fallbackPlacements: ["top-start", "top-end", "bottom-start", "bottom-end"],
          padding: 12,
        }),
      ],
      placement: "top",
    },
  });
  const {
    clickOutsideRef,
    hidden,
    props: rootProps,
    ref: floatingRef,
  } = useFloatingToolbar(floatingToolbarState);

  if (hidden) {
    return null;
  }

  return (
    <div ref={clickOutsideRef}>
      <RoomToolbar
        {...rootProps}
        {...rest}
        className={cn(
          "scrollbar-hide absolute z-50 max-w-[80vw] overflow-x-auto whitespace-nowrap rounded-md border bg-popover p-1 shadow-md print:hidden",
          className,
        )}
        data-room-plate-toolbar="floating"
        ref={floatingRef}
      >
        {children}
      </RoomToolbar>
    </div>
  );
}

export function RoomFloatingToolbarButtons() {
  const readOnly = useEditorReadOnly();

  if (readOnly) {
    return null;
  }

  return (
    <>
      <RoomToolbarGroup>
        <RoomTurnIntoToolbarButton />
        <RoomMarkToolbarButton nodeType={KEYS.bold} tooltip="Bold">
          <BoldIcon />
        </RoomMarkToolbarButton>
        <RoomMarkToolbarButton nodeType={KEYS.italic} tooltip="Italic">
          <ItalicIcon />
        </RoomMarkToolbarButton>
        <RoomMarkToolbarButton nodeType={KEYS.strikethrough} tooltip="Strikethrough">
          <StrikethroughIcon />
        </RoomMarkToolbarButton>
        <RoomMarkToolbarButton nodeType={KEYS.code} tooltip="Code">
          <Code2Icon />
        </RoomMarkToolbarButton>
        <RoomInlineEquationToolbarButton />
        <RoomLinkToolbarButton />
      </RoomToolbarGroup>

      <RoomToolbarGroup>
        <RoomBlockEquationToolbarButton />
        <RoomMoreToolbarButton />
      </RoomToolbarGroup>
    </>
  );
}

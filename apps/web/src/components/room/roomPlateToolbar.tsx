"use client";

import type * as React from "react";

import { flip, offset, useFloatingToolbar, useFloatingToolbarState } from "@platejs/floating";
import { toggleCodeBlock } from "@platejs/code-block";
import { upsertLink } from "@platejs/link";
import { ListStyleType } from "@platejs/list";
import {
  useIndentTodoToolBarButton,
  useIndentTodoToolBarButtonState,
  useListToolbarButton,
  useListToolbarButtonState,
} from "@platejs/list/react";
import { insertEquation, insertInlineEquation } from "@platejs/math";
import { insertTable } from "@platejs/table";
import {
  Bold,
  Code2,
  Heading1,
  Heading2,
  Heading3,
  Italic,
  Link,
  List,
  ListOrdered,
  ListTodo,
  Quote,
  Radical,
  SquareCode,
  Strikethrough,
  Table2,
} from "lucide-react";
import { KEYS } from "platejs";
import {
  useEditorId,
  useEditorReadOnly,
  useEditorRef,
  useEventEditorValue,
  useMarkToolbarButton,
  useMarkToolbarButtonState,
} from "platejs/react";

import { Button } from "~/components/ui/button";
import { Separator } from "~/components/ui/separator";
import { Tooltip, TooltipPopup, TooltipProvider, TooltipTrigger } from "~/components/ui/tooltip";
import { cn } from "~/lib/utils";

function preventToolbarMouseDown(event: React.MouseEvent) {
  event.preventDefault();
}

function RoomToolbarButton(props: {
  children: React.ReactNode;
  className?: string;
  onClick?: React.MouseEventHandler<HTMLButtonElement>;
  onMouseDown?: React.MouseEventHandler<HTMLButtonElement>;
  pressed?: boolean;
  tooltip: string;
}) {
  const { children, className, onClick, onMouseDown, pressed = false, tooltip } = props;
  const buttonElement = (
    <Button
      className={cn(
        "rounded-md text-muted-foreground hover:text-foreground data-[pressed=true]:bg-accent data-[pressed=true]:text-foreground",
        className,
      )}
      data-pressed={pressed ? "true" : undefined}
      onClick={onClick}
      onMouseDown={onMouseDown}
      size="icon-xs"
      type="button"
      variant="ghost"
    >
      {children}
    </Button>
  );

  return (
    <Tooltip>
      <TooltipTrigger render={buttonElement as React.ReactElement<Record<string, unknown>>} />
      <TooltipPopup side="top" sideOffset={6}>
        {tooltip}
      </TooltipPopup>
    </Tooltip>
  );
}

function RoomToolbarGroup(props: React.ComponentProps<"div">) {
  const { className, ...rest } = props;
  return <div className={cn("flex items-center gap-0.5", className)} {...rest} />;
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

function RoomListToolbarButton(props: {
  children: React.ReactNode;
  nodeType: ListStyleType;
  tooltip: string;
}) {
  const state = useListToolbarButtonState({ nodeType: props.nodeType });
  const { props: buttonProps } = useListToolbarButton(state);

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
      <ListTodo />
    </RoomToolbarButton>
  );
}

function RoomToggleBlockButton(props: {
  children: React.ReactNode;
  tooltip: string;
  type: "blockquote" | "h1" | "h2" | "h3";
}) {
  const editor = useEditorRef() as any;

  return (
    <RoomToolbarButton
      onClick={() => {
        editor?.tf?.[props.type]?.toggle?.();
      }}
      onMouseDown={preventToolbarMouseDown}
      tooltip={props.tooltip}
    >
      {props.children}
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
      tooltip="Code block"
    >
      <SquareCode />
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
      <Radical />
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
      <Radical />
    </RoomToolbarButton>
  );
}

function RoomTableToolbarButton() {
  const editor = useEditorRef();

  return (
    <RoomToolbarButton
      onClick={() => {
        insertTable(editor, {
          colCount: 3,
          header: true,
          rowCount: 3,
        });
      }}
      onMouseDown={preventToolbarMouseDown}
      tooltip="Insert table"
    >
      <Table2 />
    </RoomToolbarButton>
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
      tooltip="Insert link"
    >
      <Link />
    </RoomToolbarButton>
  );
}

export function RoomFixedToolbar(props: React.ComponentProps<"div">) {
  const { className, ...rest } = props;

  return (
    <TooltipProvider>
      <div
        className={cn(
          "sticky top-0 z-20 flex items-center gap-2 border-b border-border/70 bg-background/95 px-2 py-1.5 backdrop-blur supports-backdrop-blur:bg-background/80",
          className,
        )}
        data-room-plate-toolbar="fixed"
        {...rest}
      />
    </TooltipProvider>
  );
}

export function RoomFixedToolbarButtons() {
  const readOnly = useEditorReadOnly();

  if (readOnly) {
    return null;
  }

  return (
    <div className="flex w-full items-center gap-2 overflow-x-auto">
      <RoomToolbarGroup>
        <RoomToggleBlockButton tooltip="Heading 1" type="h1">
          <Heading1 />
        </RoomToggleBlockButton>
        <RoomToggleBlockButton tooltip="Heading 2" type="h2">
          <Heading2 />
        </RoomToggleBlockButton>
        <RoomToggleBlockButton tooltip="Heading 3" type="h3">
          <Heading3 />
        </RoomToggleBlockButton>
        <RoomToggleBlockButton tooltip="Quote" type="blockquote">
          <Quote />
        </RoomToggleBlockButton>
      </RoomToolbarGroup>

      <Separator className="h-5" orientation="vertical" />

      <RoomToolbarGroup>
        <RoomMarkToolbarButton nodeType={KEYS.bold} tooltip="Bold">
          <Bold />
        </RoomMarkToolbarButton>
        <RoomMarkToolbarButton nodeType={KEYS.italic} tooltip="Italic">
          <Italic />
        </RoomMarkToolbarButton>
        <RoomMarkToolbarButton nodeType={KEYS.strikethrough} tooltip="Strikethrough">
          <Strikethrough />
        </RoomMarkToolbarButton>
        <RoomMarkToolbarButton nodeType={KEYS.code} tooltip="Inline code">
          <Code2 />
        </RoomMarkToolbarButton>
      </RoomToolbarGroup>

      <Separator className="h-5" orientation="vertical" />

      <RoomToolbarGroup>
        <RoomListToolbarButton nodeType={ListStyleType.Disc} tooltip="Bulleted list">
          <List />
        </RoomListToolbarButton>
        <RoomListToolbarButton nodeType={ListStyleType.Decimal} tooltip="Numbered list">
          <ListOrdered />
        </RoomListToolbarButton>
        <RoomTodoToolbarButton />
      </RoomToolbarGroup>

      <Separator className="h-5" orientation="vertical" />

      <RoomToolbarGroup>
        <RoomCodeBlockToolbarButton />
        <RoomBlockEquationToolbarButton />
        <RoomTableToolbarButton />
        <RoomLinkToolbarButton />
      </RoomToolbarGroup>
    </div>
  );
}

export function RoomFloatingToolbar(props: React.ComponentProps<"div">) {
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
    <TooltipProvider>
      <div ref={clickOutsideRef}>
        <div
          {...rootProps}
          {...rest}
          ref={floatingRef}
          className={cn(
            "absolute z-50 flex max-w-[80vw] items-center gap-2 rounded-lg border border-border/70 bg-background/96 px-2 py-1.5 shadow-lg backdrop-blur supports-backdrop-blur:bg-background/88",
            className,
          )}
          data-room-plate-toolbar="floating"
        >
          {children}
        </div>
      </div>
    </TooltipProvider>
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
        <RoomMarkToolbarButton nodeType={KEYS.bold} tooltip="Bold">
          <Bold />
        </RoomMarkToolbarButton>
        <RoomMarkToolbarButton nodeType={KEYS.italic} tooltip="Italic">
          <Italic />
        </RoomMarkToolbarButton>
        <RoomMarkToolbarButton nodeType={KEYS.strikethrough} tooltip="Strikethrough">
          <Strikethrough />
        </RoomMarkToolbarButton>
        <RoomMarkToolbarButton nodeType={KEYS.code} tooltip="Inline code">
          <Code2 />
        </RoomMarkToolbarButton>
      </RoomToolbarGroup>

      <Separator className="h-5" orientation="vertical" />

      <RoomToolbarGroup>
        <RoomInlineEquationToolbarButton />
        <RoomLinkToolbarButton />
      </RoomToolbarGroup>
    </>
  );
}

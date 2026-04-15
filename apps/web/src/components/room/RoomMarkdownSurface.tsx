"use client";

import { defaultKeymap, history, historyKeymap } from "@codemirror/commands";
import { markdown } from "@codemirror/lang-markdown";
import { EditorState } from "@codemirror/state";
import { EditorView, keymap } from "@codemirror/view";
import {
  autoformatArrow,
  AutoformatPlugin,
  autoformatLegal,
  autoformatLegalHtml,
  autoformatMath,
  autoformatPunctuation,
  autoformatSmartQuotes,
} from "@platejs/autoformat";
import { insertEmptyCodeBlock } from "@platejs/code-block";
import { DndPlugin } from "@platejs/dnd";
import { toggleList } from "@platejs/list";
import { useTodoListElement, useTodoListElementState } from "@platejs/list/react";
import { useEquationElement, useEquationInput } from "@platejs/math/react";
import { SlashInputPlugin, SlashPlugin } from "@platejs/slash-command/react";
import mermaid from "mermaid";
import { DndProvider } from "react-dnd";
import { HTML5Backend } from "react-dnd-html5-backend";
import { ExitBreakPlugin, KEYS, TrailingBlockPlugin } from "platejs";
import {
  BlockPlaceholderPlugin,
  Plate,
  PlateElement,
  PlateLeaf,
  useEditorRef,
  useFocused,
  usePath,
  usePlateEditor,
  useSelected,
  type PlateElementProps,
  type PlateLeafProps,
} from "platejs/react";
import {
  createContext,
  useContext,
  useEffect,
  useEffectEvent,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

import { Button } from "~/components/ui/button";
import { CheckIcon, CopyIcon } from "~/components/ui/icons";
import { Popover, PopoverContent, PopoverTrigger } from "~/components/ui/popover";
import { Textarea } from "~/components/ui/textarea";
import { cn } from "~/lib/utils";
import { Editor, EditorContainer } from "~/components/ui/editor";

import {
  ROOM_HTML_BLOCK_ELEMENT_TYPE,
  ROOM_MARKDOWN_PLUGINS,
  auditRoomMarkdownDocument,
  deserializeRoomMarkdown,
  roomMarkdownFallbackMessage,
  serializeRoomMarkdown,
} from "./roomMarkdownDocument";
import { RoomBlockContextMenu } from "./roomBlockContextMenu";
import { RoomBlockDraggable } from "./roomBlockDraggable";
import { assignMissingRoomElementIds } from "./roomElementIds";
import {
  getRoomListIndentLevel,
  getRoomListMarkerLabel,
  isRoomTodoListItem,
  type RoomListMarkerNode,
} from "./roomListMarkers";
import { RoomSlashInputElement } from "./roomSlashNode";
import {
  RoomFixedToolbar,
  RoomFixedToolbarButtons,
  RoomFloatingToolbar,
  RoomFloatingToolbarButtons,
} from "./roomPlateToolbar";

type RoomMarkdownEditorContextValue = {
  resolvedTheme: "light" | "dark";
};

const RoomMarkdownEditorContext = createContext<RoomMarkdownEditorContextValue | null>(null);

function useRoomMarkdownEditorContext(): RoomMarkdownEditorContextValue {
  const value = useContext(RoomMarkdownEditorContext);
  if (!value) {
    throw new Error("RoomMarkdownSurface components must be used within RoomMarkdownSurface.");
  }
  return value;
}

function RoomHeadingElement(props: PlateElementProps & { level: 1 | 2 | 3 | 4 | 5 | 6 }) {
  const { children, level } = props;
  const tagName = `h${level}` as const;
  const classNameByLevel: Record<typeof level, string> = {
    1: "mb-4 mt-8 text-3xl font-semibold tracking-tight text-foreground",
    2: "mb-3 mt-7 text-2xl font-semibold tracking-tight text-foreground",
    3: "mb-3 mt-6 text-xl font-semibold tracking-tight text-foreground",
    4: "mb-2 mt-5 text-lg font-semibold tracking-tight text-foreground",
    5: "mb-2 mt-4 text-base font-semibold tracking-tight text-foreground",
    6: "mb-2 mt-4 text-sm font-semibold tracking-tight text-foreground/85 uppercase",
  };

  return (
    <PlateElement {...props} as={tagName} className={classNameByLevel[level]}>
      {children}
    </PlateElement>
  );
}

function RoomParagraphElement(props: PlateElementProps) {
  const { element } = props;
  const listStyleType =
    typeof (element as { listStyleType?: string }).listStyleType === "string"
      ? (element as { listStyleType?: string }).listStyleType
      : undefined;
  const isTodoItem = isRoomTodoListItem(element as RoomListMarkerNode);

  if (!listStyleType) {
    return (
      <PlateElement {...props} as="p" className="my-0 leading-7 text-[15px] text-foreground/88">
        {props.children}
      </PlateElement>
    );
  }

  if (isTodoItem) {
    return <RoomTodoListParagraphElement {...props} />;
  }

  return <RoomStandardListParagraphElement {...props} />;
}

function RoomTodoListParagraphElement(props: PlateElementProps) {
  const { children, element } = props;
  const todoState = useTodoListElement(useTodoListElementState({ element }));
  const indentLevel = getRoomListIndentLevel(element as RoomListMarkerNode);
  const indentStyle = indentLevel > 0 ? { paddingInlineStart: `${indentLevel * 1.6}rem` } : null;

  return (
    <PlateElement
      {...props}
      as="div"
      className="room-plate-todo-item my-0 flex items-start gap-3 leading-7 text-[15px] text-foreground/88"
      {...(indentStyle ? { style: indentStyle } : {})}
    >
      <span
        className="mt-[0.22rem] flex shrink-0 items-center justify-center"
        contentEditable={false}
      >
        <button
          aria-label={
            todoState.checkboxProps.checked ? "Mark task incomplete" : "Mark task complete"
          }
          className={cn(
            "flex size-4 items-center justify-center rounded border text-[10px] transition-colors",
            todoState.checkboxProps.checked
              ? "border-primary bg-primary text-primary-foreground"
              : "border-border bg-background text-transparent hover:border-primary/50",
          )}
          type="button"
          {...todoState.checkboxProps}
        >
          {todoState.checkboxProps.checked ? "✓" : "·"}
        </button>
      </span>
      <div className="min-w-0 flex-1">{children}</div>
    </PlateElement>
  );
}

function RoomStandardListParagraphElement(props: PlateElementProps) {
  const { children, element } = props;
  const editor = useEditorRef() as { children?: RoomListMarkerNode[] };
  const path = usePath();
  const indentLevel = getRoomListIndentLevel(element as RoomListMarkerNode);
  const indentStyle = indentLevel > 0 ? { paddingInlineStart: `${indentLevel * 1.6}rem` } : null;
  const marker = getRoomListMarkerLabel(
    element as RoomListMarkerNode,
    editor.children ?? [],
    typeof path[0] === "number" ? path[0] : -1,
  );

  return (
    <PlateElement
      {...props}
      as="div"
      className="room-plate-list-item my-0 grid min-w-0 grid-cols-[minmax(1.2rem,max-content)_minmax(0,1fr)] gap-x-2 leading-7 text-[15px] text-foreground/88"
      {...(indentStyle ? { style: indentStyle } : {})}
    >
      <span
        aria-hidden="true"
        className="room-plate-list-marker"
        contentEditable={false}
        data-room-list-marker={marker ?? ""}
      />
      <div className="min-w-0">{children}</div>
    </PlateElement>
  );
}

function RoomBlockquoteElement(props: PlateElementProps) {
  return (
    <PlateElement
      {...props}
      as="blockquote"
      className="my-4 border-l border-border/80 pl-4 italic text-foreground/72"
    />
  );
}

function RoomHorizontalRuleElement(props: PlateElementProps) {
  const { children } = props;
  return (
    <PlateElement {...props} as="div" className="my-6">
      <div contentEditable={false}>
        <hr className="border-border/70" />
      </div>
      <span className="hidden">{children}</span>
    </PlateElement>
  );
}

function RoomBoldLeaf(props: PlateLeafProps) {
  return <PlateLeaf as="strong" className="font-semibold text-foreground" {...props} />;
}

function RoomItalicLeaf(props: PlateLeafProps) {
  return <PlateLeaf as="em" className="italic" {...props} />;
}

function RoomStrikethroughLeaf(props: PlateLeafProps) {
  return <PlateLeaf as="s" className="text-foreground/75" {...props} />;
}

function RoomInlineCodeLeaf(props: PlateLeafProps) {
  return (
    <PlateLeaf
      as="code"
      className="rounded bg-muted px-1.5 py-0.5 font-mono text-[0.92em] text-foreground"
      {...props}
    />
  );
}

function RoomLinkElement(props: PlateElementProps) {
  const { children, element } = props;
  const href =
    typeof (element as { url?: string }).url === "string"
      ? (element as { url?: string }).url
      : undefined;

  return (
    <PlateElement
      {...props}
      as="a"
      className="cursor-text text-primary underline decoration-primary/35 underline-offset-4"
      {...(href ? { href } : {})}
    >
      {children}
    </PlateElement>
  );
}

function readCodeBlockText(element: { children?: Array<{ children?: Array<{ text?: string }> }> }) {
  return (element.children ?? [])
    .map((line) => (line.children ?? []).map((leaf) => leaf.text ?? "").join(""))
    .join("\n");
}

function RoomCodeLineElement(props: PlateElementProps) {
  return <PlateElement {...props} as="span" className="block min-h-6" />;
}

function RoomCodeSyntaxLeaf(props: PlateLeafProps) {
  return <PlateLeaf as="span" {...props} />;
}

function RoomCopyButton(props: { value: string }) {
  const { value } = props;
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) {
      return;
    }

    const timeout = window.setTimeout(() => {
      setCopied(false);
    }, 2_000);

    return () => {
      window.clearTimeout(timeout);
    };
  }, [copied]);

  return (
    <Button
      className="text-muted-foreground hover:text-foreground"
      contentEditable={false}
      onClick={() => {
        void navigator.clipboard.writeText(value);
        setCopied(true);
      }}
      size="icon-xs"
      type="button"
      variant="ghost"
    >
      <span className="sr-only">Copy code</span>
      {copied ? <CheckIcon /> : <CopyIcon />}
    </Button>
  );
}

function RoomMermaidPreview(props: { code: string; resolvedTheme: "light" | "dark" }) {
  const { code, resolvedTheme } = props;
  const mountRef = useRef<HTMLDivElement>(null);
  const mermaidId = useId().replaceAll(":", "-");
  const [error, setError] = useState<string>();

  useEffect(() => {
    let disposed = false;

    mermaid.initialize({
      securityLevel: "loose",
      startOnLoad: false,
      theme: resolvedTheme === "dark" ? "dark" : "default",
    });

    void mermaid
      .render(`room-mermaid-${mermaidId}`, code)
      .then(({ bindFunctions, svg }) => {
        if (disposed || !mountRef.current) {
          return;
        }

        mountRef.current.innerHTML = svg;
        bindFunctions?.(mountRef.current);
        setError(undefined);
      })
      .catch((nextError) => {
        if (disposed) {
          return;
        }

        setError(nextError instanceof Error ? nextError.message : "Unable to render Mermaid.");
      });

    return () => {
      disposed = true;
    };
  }, [code, mermaidId, resolvedTheme]);

  if (error) {
    return <pre className="overflow-x-auto font-mono text-xs text-muted-foreground">{code}</pre>;
  }

  return <div ref={mountRef} className="room-plate-mermaid-preview min-h-8" />;
}

function RoomCodeBlockElement(props: PlateElementProps) {
  const { children, element } = props;
  const { resolvedTheme } = useRoomMarkdownEditorContext();
  const editor = useEditorRef() as any;
  const path = usePath();
  const isFocused = useFocused();
  const isSelected = useSelected();
  const codeText = readCodeBlockText(
    element as { children?: Array<{ children?: Array<{ text?: string }> }> },
  );
  const language = ((element as { lang?: string }).lang ?? "") as string;
  const showMermaidPreview = language === "mermaid" && !(isFocused && isSelected);

  return (
    <PlateElement {...props} as="div" className="my-5">
      <div
        className={cn(
          "room-plate-code-block relative overflow-hidden rounded-xl transition-colors",
          showMermaidPreview
            ? "border border-transparent bg-transparent hover:border-border/70 focus-within:border-border/70"
            : "border border-border/70 bg-muted/45",
        )}
      >
        <div
          className="pointer-events-none absolute top-2 right-2 z-10 flex items-center gap-1.5"
          contentEditable={false}
        >
          {language.length > 0 ? (
            <span className="rounded-full border border-border/70 bg-background/88 px-2 py-0.5 font-mono text-[10px] tracking-[0.18em] text-muted-foreground uppercase backdrop-blur">
              {language}
            </span>
          ) : null}
          <div className="pointer-events-auto">
            <RoomCopyButton value={codeText} />
          </div>
        </div>

        {showMermaidPreview ? (
          <button
            className="block w-full cursor-text px-4 py-4 text-left"
            contentEditable={false}
            onMouseDown={(event) => {
              event.preventDefault();
              editor?.tf?.select?.(path, { focus: true });
            }}
            type="button"
          >
            <RoomMermaidPreview code={codeText} resolvedTheme={resolvedTheme} />
          </button>
        ) : (
          <pre className="overflow-x-auto px-4 py-4 pr-16 font-mono text-[13px] leading-6">
            <code>{children}</code>
          </pre>
        )}
      </div>
    </PlateElement>
  );
}

function htmlPreviewText(value: string): string {
  if (typeof window === "undefined") {
    return value
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  const parser = new DOMParser();
  const document = parser.parseFromString(value, "text/html");
  return document.body.textContent?.replace(/\s+/g, " ").trim() ?? "";
}

function RoomHtmlBlockElement(props: PlateElementProps) {
  const { children, element } = props;
  const editor = useEditorRef();
  const path = usePath();
  const [editing, setEditing] = useState(false);
  const rawValue = (element as { value?: string }).value;
  const value = typeof rawValue === "string" ? rawValue : "";
  const previewText = useMemo(() => {
    const nextValue = value.trim();
    if (nextValue.length === 0) {
      return "";
    }

    return htmlPreviewText(nextValue);
  }, [value]);

  return (
    <PlateElement {...props} as="div" className="my-5">
      <div
        className="rounded-xl border border-border/70 bg-muted/35 px-4 py-3"
        contentEditable={false}
        data-room-html-block="true"
      >
        {editing ? (
          <Textarea
            aria-label="Room HTML block source"
            className="min-h-32 resize-y font-mono text-sm"
            onBlur={() => {
              setEditing(false);
            }}
            onChange={(event) => {
              editor.tf.setNodes({ value: event.target.value }, { at: path });
            }}
            onKeyDown={(event) => {
              if (event.key === "Escape") {
                event.preventDefault();
                setEditing(false);
              }
            }}
            value={value}
          />
        ) : (
          <button
            aria-label="Edit HTML block"
            className="block w-full cursor-text text-left"
            onMouseDown={(event) => {
              event.preventDefault();
              setEditing(true);
              editor.tf.select(path);
            }}
            type="button"
          >
            <div className="mb-3 text-[11px] font-medium tracking-[0.18em] text-muted-foreground/70 uppercase">
              HTML
            </div>
            {previewText.length > 0 ? (
              <div className="room-plate-html-preview text-sm text-foreground/88">
                {previewText}
              </div>
            ) : (
              <div className="text-sm text-muted-foreground">This HTML block is preserved.</div>
            )}
          </button>
        )}
      </div>
      <span className="hidden">{children}</span>
    </PlateElement>
  );
}

function RoomTableElement(props: PlateElementProps) {
  const { children } = props;
  return (
    <div className="my-5 overflow-x-auto">
      <PlateElement
        {...props}
        as="table"
        className="min-w-full border-collapse overflow-hidden rounded-xl border border-border/70 text-sm"
      >
        <tbody>{children}</tbody>
      </PlateElement>
    </div>
  );
}

function RoomTableRowElement(props: PlateElementProps) {
  return <PlateElement as="tr" className="border-b border-border/60 last:border-b-0" {...props} />;
}

function RoomTableCellElement(props: PlateElementProps) {
  return (
    <PlateElement
      as="td"
      className="min-w-24 border-r border-border/60 px-3 py-2 last:border-r-0"
      {...props}
    />
  );
}

function RoomTableHeaderCellElement(props: PlateElementProps) {
  return (
    <PlateElement
      as="th"
      className="min-w-24 border-r border-border/60 bg-muted/60 px-3 py-2 text-left font-semibold last:border-r-0"
      {...props}
    />
  );
}

function RoomEquationPopover(props: {
  className?: string;
  isInline?: boolean;
  onClose: () => void;
  open: boolean;
  placeholder: string;
}) {
  const { className, isInline = false, onClose, open, placeholder } = props;
  const equationInput = useEquationInput({
    onClose,
    open,
  });

  return (
    <PopoverContent className="w-[min(34rem,calc(100vw-2rem))] p-0">
      <div className="flex flex-col gap-3 p-4">
        <Textarea
          {...equationInput.props}
          className={cn(
            "min-h-28 resize-y font-mono text-sm leading-6",
            isInline ? "min-h-20" : undefined,
            className,
          )}
          autoFocus
          placeholder={placeholder}
        />
        <div className="flex justify-end">
          <Button onClick={onClose} size="sm" variant="secondary">
            Done
          </Button>
        </div>
      </div>
    </PopoverContent>
  );
}

function RoomEquationElement(props: PlateElementProps) {
  const { children, element } = props;
  const [open, setOpen] = useState(false);
  const katexRef = useRef<HTMLDivElement | null>(null);

  useEquationElement({
    element: props.element as any,
    katexRef,
    options: {
      displayMode: true,
      errorColor: "#cc0000",
      output: "htmlAndMathml",
      strict: "warn",
      throwOnError: false,
      trust: false,
    },
  });

  return (
    <PlateElement {...props} as="div" className="my-5">
      <Popover modal={false} onOpenChange={setOpen} open={open}>
        <PopoverTrigger
          render={
            <button
              aria-label="Edit equation"
              className="block w-full cursor-text rounded-xl border border-transparent bg-transparent px-4 py-3 text-left transition-colors hover:border-border/70 focus-visible:border-border/70"
              type="button"
            />
          }
        >
          <div className="room-plate-equation-trigger" contentEditable={false}>
            <div
              className="room-plate-equation-preview text-center text-base text-foreground"
              ref={katexRef}
            />
            {typeof (element as { texExpression?: string }).texExpression === "string" &&
            (element as { texExpression?: string }).texExpression?.length ? null : (
              <div className="text-sm text-muted-foreground">Add a block equation</div>
            )}
          </div>
        </PopoverTrigger>
        <RoomEquationPopover
          onClose={() => {
            setOpen(false);
          }}
          open={open}
          placeholder="\\sum_{i=1}^{n} i = \\frac{n(n+1)}{2}"
        />
      </Popover>
      <span className="hidden">{children}</span>
    </PlateElement>
  );
}

function RoomInlineEquationElement(props: PlateElementProps) {
  const { children } = props;
  const [open, setOpen] = useState(false);
  const katexRef = useRef<HTMLDivElement | null>(null);

  useEquationElement({
    element: props.element as any,
    katexRef,
    options: {
      displayMode: false,
      errorColor: "#cc0000",
      output: "htmlAndMathml",
      strict: "warn",
      throwOnError: false,
      trust: false,
    },
  });

  return (
    <PlateElement {...props} as="span" className="mx-1 inline-flex align-baseline">
      <Popover modal={false} onOpenChange={setOpen} open={open}>
        <PopoverTrigger
          render={
            <button
              aria-label="Edit inline equation"
              className="inline-flex cursor-text rounded bg-muted px-1.5 py-0.5 text-sm"
              type="button"
            />
          }
        >
          <div className="font-mono" contentEditable={false} ref={katexRef} />
        </PopoverTrigger>
        <RoomEquationPopover
          className="min-h-16"
          isInline
          onClose={() => {
            setOpen(false);
          }}
          open={open}
          placeholder="E = mc^2"
        />
      </Popover>
      <span className="hidden">{children}</span>
    </PlateElement>
  );
}

const ROOM_MARKDOWN_COMPONENTS = {
  [ROOM_HTML_BLOCK_ELEMENT_TYPE]: RoomHtmlBlockElement,
  a: RoomLinkElement,
  blockquote: RoomBlockquoteElement,
  bold: RoomBoldLeaf,
  code: RoomInlineCodeLeaf,
  code_block: RoomCodeBlockElement,
  code_line: RoomCodeLineElement,
  code_syntax: RoomCodeSyntaxLeaf,
  equation: RoomEquationElement,
  h1: (props: PlateElementProps) => <RoomHeadingElement level={1} {...props} />,
  h2: (props: PlateElementProps) => <RoomHeadingElement level={2} {...props} />,
  h3: (props: PlateElementProps) => <RoomHeadingElement level={3} {...props} />,
  h4: (props: PlateElementProps) => <RoomHeadingElement level={4} {...props} />,
  h5: (props: PlateElementProps) => <RoomHeadingElement level={5} {...props} />,
  h6: (props: PlateElementProps) => <RoomHeadingElement level={6} {...props} />,
  hr: RoomHorizontalRuleElement,
  inline_equation: RoomInlineEquationElement,
  italic: RoomItalicLeaf,
  p: RoomParagraphElement,
  strikethrough: RoomStrikethroughLeaf,
  table: RoomTableElement,
  td: RoomTableCellElement,
  th: RoomTableHeaderCellElement,
  tr: RoomTableRowElement,
} as const;

const ROOM_AUTOFORMAT_MARK_RULES = [
  { match: "***", mode: "mark", type: [KEYS.bold, KEYS.italic] },
  { match: "**", mode: "mark", type: KEYS.bold },
  { match: "__", mode: "mark", type: KEYS.underline },
  { match: "*", mode: "mark", type: KEYS.italic },
  { match: "_", mode: "mark", type: KEYS.italic },
  { match: "~~", mode: "mark", type: KEYS.strikethrough },
  { match: "`", mode: "mark", type: KEYS.code },
] as const;

const ROOM_AUTOFORMAT_BLOCK_RULES = [
  { match: "# ", mode: "block", type: KEYS.h1 },
  { match: "## ", mode: "block", type: KEYS.h2 },
  { match: "### ", mode: "block", type: KEYS.h3 },
  { match: "#### ", mode: "block", type: KEYS.h4 },
  { match: "> ", mode: "block", type: KEYS.blockquote },
  {
    match: "```",
    mode: "block",
    type: KEYS.codeBlock,
    format: (editor: any) => {
      insertEmptyCodeBlock(editor, {
        defaultType: KEYS.p,
        insertNodesOptions: { select: true },
      });
    },
  },
  {
    match: ["---", "___"],
    mode: "block",
    type: KEYS.hr,
    format: (editor: any) => {
      editor.tf.setNodes({ type: KEYS.hr });
      editor.tf.insertNodes({ children: [{ text: "" }], type: KEYS.p });
    },
  },
] as const;

const ROOM_AUTOFORMAT_LIST_RULES = [
  {
    match: ["* ", "- "],
    mode: "block",
    type: "list",
    format: (editor: any) => {
      toggleList(editor, { listStyleType: KEYS.ul });
    },
  },
  {
    match: [String.raw`^\d+\.$ `, String.raw`^\d+\)$ `],
    matchByRegex: true,
    mode: "block",
    type: "list",
    format: (editor: any, { matchString }: { matchString: string }) => {
      toggleList(editor, {
        listRestartPolite: Number(matchString) || 1,
        listStyleType: KEYS.ol,
      });
    },
  },
  {
    match: ["[] "],
    mode: "block",
    type: "list",
    format: (editor: any) => {
      toggleList(editor, { listStyleType: KEYS.listTodo });
      editor.tf.setNodes({ checked: false, listStyleType: KEYS.listTodo });
    },
  },
  {
    match: ["[x] "],
    mode: "block",
    type: "list",
    format: (editor: any) => {
      toggleList(editor, { listStyleType: KEYS.listTodo });
      editor.tf.setNodes({ checked: true, listStyleType: KEYS.listTodo });
    },
  },
] as const;

const ROOM_EDITOR_PLUGINS = [
  ...ROOM_MARKDOWN_PLUGINS,
  AutoformatPlugin.configure({
    options: {
      enableUndoOnDelete: true,
      rules: [
        ...ROOM_AUTOFORMAT_BLOCK_RULES,
        ...ROOM_AUTOFORMAT_MARK_RULES,
        ...ROOM_AUTOFORMAT_LIST_RULES,
        ...autoformatSmartQuotes,
        ...autoformatPunctuation,
        ...autoformatLegal,
        ...autoformatLegalHtml,
        ...autoformatArrow,
        ...autoformatMath,
      ],
    },
  }),
  SlashPlugin.configure({
    options: {
      triggerQuery: (editor: any) =>
        !editor.api.some({
          match: { type: editor.getType(KEYS.codeBlock) },
        }),
    },
  }),
  SlashInputPlugin.withComponent(RoomSlashInputElement),
  DndPlugin.configure({
    options: {
      enableScroller: true,
    },
    render: {
      aboveNodes: RoomBlockDraggable,
      aboveSlate: ({ children }: { children: ReactNode }) => (
        <DndProvider backend={HTML5Backend}>{children}</DndProvider>
      ),
    },
  }),
  BlockPlaceholderPlugin.configure({
    options: {
      className:
        "before:absolute before:cursor-text before:text-muted-foreground/70 before:content-[attr(placeholder)]",
      placeholders: {
        [KEYS.p]: "Type something...",
      },
      query: ({ path }: { path: number[] }) => path.length === 1,
    },
  }),
  ExitBreakPlugin.configure({
    shortcuts: {
      insert: { keys: "mod+enter" },
      insertBefore: { keys: "mod+shift+enter" },
    },
  }),
  TrailingBlockPlugin,
] as const;

function RoomRichMarkdownEditor(props: {
  onChange: (nextValue: string) => void;
  onSave: () => void;
  resolvedTheme: "light" | "dark";
  value: string;
}) {
  const { onChange, onSave, resolvedTheme, value } = props;
  const syncedValueRef = useRef(value);
  const applyingExternalValueRef = useRef(false);
  const assigningIdsRef = useRef(false);
  const lastAppliedPropValueRef = useRef<string | null>(null);
  const editor = usePlateEditor(
    {
      components: ROOM_MARKDOWN_COMPONENTS,
      plugins: [...ROOM_EDITOR_PLUGINS],
      value: [{ children: [{ text: "" }], type: "p" }],
    },
    [],
  );
  const handleSave = useEffectEvent(() => {
    onSave();
  });
  const handleChange = useEffectEvent((nextValue: string) => {
    onChange(nextValue);
  });
  const [contextState, setContextState] = useState<{
    blockId: string;
    x: number;
    y: number;
  } | null>(null);

  useEffect(() => {
    if (!editor) {
      return;
    }

    if (value === lastAppliedPropValueRef.current) {
      return;
    }

    lastAppliedPropValueRef.current = value;
    applyingExternalValueRef.current = true;
    editor.tf.setValue(deserializeRoomMarkdown(value));
  }, [editor, value]);

  const contextValue = useMemo<RoomMarkdownEditorContextValue>(
    () => ({
      resolvedTheme,
    }),
    [resolvedTheme],
  );

  return (
    <RoomMarkdownEditorContext.Provider value={contextValue}>
      <Plate
        editor={editor}
        onValueChange={({ editor: nextEditor }) => {
          if (assigningIdsRef.current) {
            assigningIdsRef.current = false;
            return;
          }

          if (assignMissingRoomElementIds(nextEditor as any)) {
            assigningIdsRef.current = true;
            return;
          }

          const nextValue = serializeRoomMarkdown(nextEditor);
          if (applyingExternalValueRef.current) {
            applyingExternalValueRef.current = false;
            syncedValueRef.current = nextValue;
            return;
          }

          if (nextValue === syncedValueRef.current) {
            return;
          }

          lastAppliedPropValueRef.current = nextValue;
          syncedValueRef.current = nextValue;
          handleChange(nextValue);
        }}
      >
        <EditorContainer className="ignore-click-outside/toolbar room-plate-shell" variant="room">
          <RoomFixedToolbar>
            <RoomFixedToolbarButtons />
          </RoomFixedToolbar>

          <Editor
            aria-label="Room rich markdown editor"
            className={cn(
              "room-plate-content min-h-full outline-none",
              resolvedTheme === "dark" ? "dark" : undefined,
            )}
            data-room-markdown-editor="rich"
            onContextMenu={(event) => {
              const target = event.target as HTMLElement | null;
              const block = target?.closest<HTMLElement>("[data-room-block-id]");
              const blockId = block?.dataset.roomBlockId;

              if (!blockId) {
                setContextState(null);
                return;
              }

              event.preventDefault();
              setContextState({
                blockId,
                x: event.clientX,
                y: event.clientY,
              });
            }}
            onKeyDown={(event) => {
              if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "s") {
                event.preventDefault();
                handleSave();
              }
            }}
            spellCheck={false}
            variant="default"
          />

          <RoomFloatingToolbar>
            <RoomFloatingToolbarButtons />
          </RoomFloatingToolbar>

          <RoomBlockContextMenu
            contextState={contextState}
            onClose={() => {
              setContextState(null);
            }}
          />
        </EditorContainer>
      </Plate>
    </RoomMarkdownEditorContext.Provider>
  );
}

function createRawMarkdownExtensions(options: {
  onChange: (nextValue: string) => void;
  onSave: () => void;
  resolvedTheme: "light" | "dark";
}) {
  const { onChange, onSave, resolvedTheme } = options;

  return [
    markdown(),
    history(),
    keymap.of([
      ...defaultKeymap,
      ...historyKeymap,
      {
        key: "Mod-s",
        run: () => {
          onSave();
          return true;
        },
      },
    ]),
    EditorView.contentAttributes.of({
      "aria-label": "Room raw markdown editor",
      "data-room-markdown-editor": "raw",
      spellcheck: "false",
    }),
    EditorView.updateListener.of((update) => {
      if (!update.docChanged) {
        return;
      }
      onChange(update.state.doc.toString());
    }),
    EditorView.theme(
      {
        "&": {
          backgroundColor: "transparent",
          color: "var(--foreground)",
          fontSize: "14px",
        },
        ".cm-content": {
          minHeight: "100%",
          padding: "0",
        },
        ".cm-focused": {
          outline: "none",
        },
        ".cm-gutters": {
          display: "none",
        },
        ".cm-scroller": {
          fontFamily: '"SF Mono", "SFMono-Regular", Consolas, monospace',
        },
        ".cm-selectionBackground": {
          backgroundColor: resolvedTheme === "dark" ? "rgba(255,255,255,0.12)" : "rgba(0,0,0,0.12)",
        },
      },
      { dark: resolvedTheme === "dark" },
    ),
  ];
}

function RoomRawMarkdownEditor(props: {
  onChange: (nextValue: string) => void;
  onSave: () => void;
  resolvedTheme: "light" | "dark";
  value: string;
}) {
  const { onChange, onSave, resolvedTheme, value } = props;
  const initialValueRef = useRef(value);
  const mountRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const syncedValueRef = useRef(value);
  const handleChange = useEffectEvent((nextValue: string) => {
    syncedValueRef.current = nextValue;
    onChange(nextValue);
  });
  const handleSave = useEffectEvent(() => {
    onSave();
  });

  useLayoutEffect(() => {
    if (!mountRef.current) {
      return;
    }

    const view = new EditorView({
      parent: mountRef.current,
      state: EditorState.create({
        doc: initialValueRef.current,
        extensions: createRawMarkdownExtensions({
          onChange: handleChange,
          onSave: handleSave,
          resolvedTheme,
        }),
      }),
    });

    viewRef.current = view;
    return () => {
      view.destroy();
      viewRef.current = null;
    };
  }, [resolvedTheme]);

  useEffect(() => {
    const view = viewRef.current;
    if (!view || value === syncedValueRef.current) {
      return;
    }

    syncedValueRef.current = value;
    const currentValue = view.state.doc.toString();
    if (currentValue === value) {
      return;
    }

    view.dispatch({
      changes: {
        from: 0,
        insert: value,
        to: currentValue.length,
      },
    });
  }, [value]);

  return <div ref={mountRef} className="room-raw-markdown-editor h-full min-h-0" />;
}

export function RoomMarkdownSurface(props: {
  className?: string;
  onChange: (nextValue: string) => void;
  onSave: () => void;
  resolvedTheme: "light" | "dark";
  value: string;
}) {
  const { className, onChange, onSave, resolvedTheme, value } = props;
  const mode = useMemo(() => auditRoomMarkdownDocument(value), [value]);

  return (
    <div
      className={cn("room-markdown-surface h-full min-h-0", className)}
      data-room-markdown-mode={mode.mode}
      data-room-markdown-surface="true"
    >
      {mode.mode === "raw" ? (
        <div className="mb-3 text-[11px] text-muted-foreground" data-room-markdown-fallback="true">
          {roomMarkdownFallbackMessage(mode.reason)}
        </div>
      ) : null}

      {mode.mode === "rich" ? (
        <RoomRichMarkdownEditor
          onChange={onChange}
          onSave={onSave}
          resolvedTheme={resolvedTheme}
          value={value}
        />
      ) : (
        <RoomRawMarkdownEditor
          onChange={onChange}
          onSave={onSave}
          resolvedTheme={resolvedTheme}
          value={value}
        />
      )}
    </div>
  );
}

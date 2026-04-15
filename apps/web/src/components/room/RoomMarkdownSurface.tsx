"use client";

import { defaultKeymap, history, historyKeymap } from "@codemirror/commands";
import { markdown } from "@codemirror/lang-markdown";
import { EditorState } from "@codemirror/state";
import { EditorView, keymap } from "@codemirror/view";
import { useTodoListElement, useTodoListElementState } from "@platejs/list/react";
import { useEquationInput } from "@platejs/math/react";
import katex from "katex";
import mermaid from "mermaid";
import {
  Plate,
  PlateContent,
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
} from "react";

import { cn } from "~/lib/utils";

import {
  ROOM_MARKDOWN_PLUGINS,
  ROOM_HTML_BLOCK_ELEMENT_TYPE,
  ROOM_MERMAID_ELEMENT_TYPE,
  auditRoomMarkdownDocument,
  deserializeRoomMarkdown,
  roomMarkdownFallbackMessage,
  serializeRoomMarkdown,
} from "./roomMarkdownDocument";

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

function renderKatexPreview(expression: string, displayMode: boolean): string {
  try {
    return katex.renderToString(expression, {
      displayMode,
      throwOnError: false,
    });
  } catch {
    return expression;
  }
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
  const { children, element } = props;
  const listStyleType =
    typeof (element as { listStyleType?: string }).listStyleType === "string"
      ? (element as { listStyleType?: string }).listStyleType
      : undefined;
  const isTodoItem =
    listStyleType === "todo" || typeof (element as { checked?: boolean }).checked === "boolean";

  if (!listStyleType) {
    return (
      <PlateElement {...props} as="p" className="my-0 leading-7 text-[15px] text-foreground/88">
        {children}
      </PlateElement>
    );
  }

  if (!isTodoItem) {
    return (
      <PlateElement {...props} as="div" className="my-0 leading-7 text-[15px] text-foreground/88">
        {children}
      </PlateElement>
    );
  }

  const todoState = useTodoListElement(useTodoListElementState({ element }));

  return (
    <PlateElement
      {...props}
      as="div"
      className="room-plate-todo-item my-0 flex items-start gap-3 leading-7 text-[15px] text-foreground/88"
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

function RoomBlockquoteElement(props: PlateElementProps) {
  const { children } = props;
  return (
    <PlateElement
      {...props}
      as="blockquote"
      className="my-4 border-l border-border/80 pl-4 italic text-foreground/72"
    >
      {children}
    </PlateElement>
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
      className="rounded bg-muted px-1.5 py-0.5 text-[0.92em] text-foreground"
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
  const linkAttributes = href ? { href } : {};
  return (
    <PlateElement
      {...props}
      as="a"
      className="cursor-text text-primary underline decoration-primary/35 underline-offset-4"
      {...linkAttributes}
    >
      {children}
    </PlateElement>
  );
}

function readCodeBlockText(element: {
  children?: Array<{ children?: Array<{ text?: string }> }>;
}): string {
  return (element.children ?? [])
    .map((line) => (line.children ?? []).map((leaf) => leaf.text ?? "").join(""))
    .join("\n");
}

function RoomCodeBlockElement(props: PlateElementProps) {
  const { children, element } = props;
  const { resolvedTheme } = useRoomMarkdownEditorContext();
  const editor = useEditorRef();
  const path = usePath();
  const isFocused = useFocused();
  const isSelected = useSelected();
  const language =
    typeof (element as { lang?: string }).lang === "string"
      ? (element as { lang?: string }).lang
      : "";
  const isMermaidBlock = language === "mermaid";

  if (isMermaidBlock && !(isFocused && isSelected)) {
    return (
      <PlateElement {...props} as="div" className="my-5">
        <div
          className="rounded-xl border border-border/70 bg-muted/40 px-4 py-3"
          contentEditable={false}
        >
          <button
            aria-label="Edit mermaid source"
            className="block w-full cursor-text text-left"
            onMouseDown={(event) => {
              event.preventDefault();
              editor.tf.select(path);
            }}
            type="button"
          >
            <RoomMermaidPreview
              code={readCodeBlockText(
                element as { children?: Array<{ children?: Array<{ text?: string }> }> },
              )}
              resolvedTheme={resolvedTheme}
            />
          </button>
        </div>
        <span className="hidden">{children}</span>
      </PlateElement>
    );
  }

  return (
    <PlateElement
      {...props}
      as="pre"
      className="my-4 overflow-x-auto rounded-xl border border-border/70 bg-muted/55 px-4 py-3 font-mono text-[13px] leading-6 text-foreground"
    >
      <code>{children}</code>
    </PlateElement>
  );
}

function RoomCodeLineElement(props: PlateElementProps) {
  const { children } = props;
  return (
    <PlateElement {...props} as="span" className="block min-h-6">
      {children}
    </PlateElement>
  );
}

function RoomCodeSyntaxLeaf(props: PlateLeafProps) {
  return <PlateLeaf as="span" {...props} />;
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
  const isFocused = useFocused();
  const isSelected = useSelected();
  const [editing, setEditing] = useState(false);
  const rawValue = (element as { value?: string }).value;
  const value = typeof rawValue === "string" ? rawValue : "";
  const shouldEdit = editing || (isFocused && isSelected);
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
        {shouldEdit ? (
          <textarea
            aria-label="Room HTML block source"
            className="min-h-32 w-full resize-y rounded-lg border border-border bg-background px-3 py-2 font-mono text-sm outline-none"
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

function RoomEquationElement(props: PlateElementProps) {
  const { children, element } = props;
  const [open, setOpen] = useState(false);
  const equationInput = useEquationInput({
    onClose: () => {
      setOpen(false);
    },
    open,
  });
  const isFocused = useFocused();
  const isSelected = useSelected();
  const expression =
    typeof (element as { texExpression?: string }).texExpression === "string"
      ? (element as { texExpression?: string }).texExpression
      : "";
  const shouldEdit = open || (isFocused && isSelected);

  return (
    <PlateElement {...props} as="div" className="my-5">
      <div
        className="rounded-xl border border-border/70 bg-muted/45 px-4 py-3"
        contentEditable={false}
      >
        {shouldEdit ? (
          <textarea
            aria-label="Room equation source"
            className="min-h-28 w-full resize-y rounded-lg border border-border bg-background px-3 py-2 font-mono text-sm outline-none"
            {...equationInput.props}
          />
        ) : (
          <button
            aria-label="Edit equation source"
            className="block w-full cursor-text text-left"
            onMouseDown={(event) => {
              event.preventDefault();
              setOpen(true);
            }}
            type="button"
          >
            <div
              className="room-plate-equation-preview text-center text-base text-foreground"
              dangerouslySetInnerHTML={{
                __html: renderKatexPreview(expression ?? "", true),
              }}
            />
          </button>
        )}
      </div>
      <span className="hidden">{children}</span>
    </PlateElement>
  );
}

function RoomInlineEquationElement(props: PlateElementProps) {
  const { children, element } = props;
  const [open, setOpen] = useState(false);
  const inlineInput = useEquationInput({
    isInline: true,
    onClose: () => {
      setOpen(false);
    },
    open,
  });
  const expression =
    typeof (element as { texExpression?: string }).texExpression === "string"
      ? (element as { texExpression?: string }).texExpression
      : "";

  return (
    <PlateElement {...props} as="span" className="inline-flex align-baseline">
      <span className="inline-flex" contentEditable={false}>
        {open ? (
          <textarea
            aria-label="Room inline equation source"
            className="min-h-9 min-w-36 resize-none rounded-md border border-border bg-background px-2 py-1 font-mono text-xs outline-none"
            rows={1}
            {...inlineInput.props}
          />
        ) : (
          <button
            aria-label="Edit inline equation source"
            className="inline-flex cursor-text rounded bg-muted px-1.5 py-0.5 text-sm"
            onMouseDown={(event) => {
              event.preventDefault();
              setOpen(true);
            }}
            type="button"
          >
            <span
              dangerouslySetInnerHTML={{
                __html: renderKatexPreview(expression ?? "", false),
              }}
            />
          </button>
        )}
      </span>
      <span className="hidden">{children}</span>
    </PlateElement>
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

function RoomMermaidElement(props: PlateElementProps) {
  const { children, element } = props;
  const { resolvedTheme } = useRoomMarkdownEditorContext();
  const editor = useEditorRef();
  const path = usePath();
  const isFocused = useFocused();
  const isSelected = useSelected();
  const [editing, setEditing] = useState(false);
  const value =
    typeof (element as { value?: string }).value === "string"
      ? (element as { value?: string }).value
      : "";
  const shouldEdit = editing || (isFocused && isSelected);

  return (
    <PlateElement {...props} as="div" className="my-5">
      <div
        className="rounded-xl border border-border/70 bg-muted/40 px-4 py-3"
        contentEditable={false}
      >
        {shouldEdit ? (
          <textarea
            aria-label="Room mermaid source"
            className="min-h-40 w-full resize-y rounded-lg border border-border bg-background px-3 py-2 font-mono text-sm outline-none"
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
            aria-label="Edit mermaid source"
            className="block w-full cursor-text text-left"
            onMouseDown={(event) => {
              event.preventDefault();
              setEditing(true);
              editor.tf.select(path);
            }}
            type="button"
          >
            <RoomMermaidPreview code={value ?? ""} resolvedTheme={resolvedTheme} />
          </button>
        )}
      </div>
      <span className="hidden">{children}</span>
    </PlateElement>
  );
}

const ROOM_MARKDOWN_COMPONENTS = {
  [ROOM_HTML_BLOCK_ELEMENT_TYPE]: RoomHtmlBlockElement,
  [ROOM_MERMAID_ELEMENT_TYPE]: RoomMermaidElement,
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

function RoomRichMarkdownEditor(props: {
  onChange: (nextValue: string) => void;
  onSave: () => void;
  resolvedTheme: "light" | "dark";
  value: string;
}) {
  const { onChange, onSave, resolvedTheme, value } = props;
  const syncedValueRef = useRef(value);
  const applyingExternalValueRef = useRef(false);
  const lastAppliedPropValueRef = useRef<string | null>(null);
  const editor = usePlateEditor(
    {
      components: ROOM_MARKDOWN_COMPONENTS,
      plugins: [...ROOM_MARKDOWN_PLUGINS],
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
        <div>
          <PlateContent
            aria-label="Room rich markdown editor"
            className={cn(
              "room-plate-content min-h-full pb-24 outline-none",
              resolvedTheme === "dark" ? "dark" : undefined,
            )}
            data-room-markdown-editor="rich"
            onKeyDown={(event) => {
              if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "s") {
                event.preventDefault();
                handleSave();
              }
            }}
            spellCheck={false}
          />
        </div>
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
          padding: "0.2rem 0 10rem",
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

  return <div ref={mountRef} className="room-raw-markdown-editor min-h-full" />;
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
      className={cn("room-markdown-surface min-h-full", className)}
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

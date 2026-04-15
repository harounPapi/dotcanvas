"use client";

import { MarkdownPlugin, defaultRules } from "@platejs/markdown";
import {
  H1Plugin,
  H2Plugin,
  H3Plugin,
  H4Plugin,
  H5Plugin,
  H6Plugin,
} from "@platejs/basic-nodes/react";
import {
  BlockquotePlugin,
  BoldPlugin,
  CodePlugin,
  HorizontalRulePlugin,
  ItalicPlugin,
  StrikethroughPlugin,
} from "@platejs/basic-nodes/react";
import { CodeBlockPlugin, CodeLinePlugin, CodeSyntaxPlugin } from "@platejs/code-block/react";
import { LinkPlugin } from "@platejs/link/react";
import { ListPlugin } from "@platejs/list/react";
import {
  TableCellHeaderPlugin,
  TableCellPlugin,
  TablePlugin,
  TableRowPlugin,
} from "@platejs/table/react";
import { KEYS } from "platejs";
import { createPlateEditor, createPlatePlugin, ParagraphPlugin } from "platejs/react";
import { common, createLowlight } from "lowlight";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import remarkParse from "remark-parse";
import { unified } from "unified";

import { withRoomElementIds } from "./roomElementIds";

export const ROOM_HTML_BLOCK_ELEMENT_TYPE = "room_html_block";

type MarkdownNode = {
  children?: MarkdownNode[];
  identifier?: string;
  label?: string;
  position?: {
    end?: { offset?: number };
    start?: { offset?: number };
  };
  referenceType?: string;
  title?: string | null;
  url?: string;
  value?: string;
  type?: string;
  [key: string]: unknown;
};

type RoomMarkdownAuditResult = { mode: "rich" } | { mode: "raw"; reason: string };
type MarkdownDefinition = {
  identifier: string;
  position?: MarkdownNode["position"];
  title?: string | null;
  url: string;
};

const ROOM_LOWLIGHT = createLowlight(common);
const ROOM_SUPPORTED_MARKDOWN_NODE_TYPES = new Set([
  "blockquote",
  "break",
  "code",
  "delete",
  "emphasis",
  "heading",
  "inlineCode",
  "inlineMath",
  "link",
  "list",
  "listItem",
  "math",
  "paragraph",
  ROOM_HTML_BLOCK_ELEMENT_TYPE,
  "root",
  "strong",
  "table",
  "tableCell",
  "tableRow",
  "text",
  "thematicBreak",
]);
const ROOM_UNSUPPORTED_MARKDOWN_NODE_REASONS: Record<string, string> = {
  definition: "reference-style links",
  footnoteDefinition: "footnotes",
  footnoteReference: "footnotes",
  image: "images",
  imageReference: "images",
  mdxFlowExpression: "MDX",
  mdxJsxFlowElement: "MDX",
  mdxJsxTextElement: "MDX",
  mdxTextExpression: "MDX",
  toml: "frontmatter",
  yaml: "frontmatter",
};

const RoomHtmlBlockPlugin = createPlatePlugin({
  key: ROOM_HTML_BLOCK_ELEMENT_TYPE,
  node: {
    isElement: true,
    type: ROOM_HTML_BLOCK_ELEMENT_TYPE,
  },
});
const RoomEquationPlugin = createPlatePlugin({
  key: KEYS.equation,
  node: {
    isElement: true,
    type: KEYS.equation,
  },
});
const RoomInlineEquationPlugin = createPlatePlugin({
  key: KEYS.inlineEquation,
  node: {
    isElement: true,
    isInline: true,
    type: KEYS.inlineEquation,
  },
});

export const ROOM_MARKDOWN_PLUGINS: readonly any[] = [
  ParagraphPlugin,
  H1Plugin,
  H2Plugin,
  H3Plugin,
  H4Plugin,
  H5Plugin,
  H6Plugin,
  BlockquotePlugin,
  HorizontalRulePlugin,
  BoldPlugin,
  CodePlugin,
  ItalicPlugin,
  StrikethroughPlugin,
  LinkPlugin,
  ListPlugin,
  CodeBlockPlugin.configure({
    options: {
      lowlight: ROOM_LOWLIGHT,
    },
  }),
  CodeLinePlugin,
  CodeSyntaxPlugin,
  TablePlugin,
  TableRowPlugin,
  TableCellPlugin,
  TableCellHeaderPlugin,
  RoomHtmlBlockPlugin,
  RoomEquationPlugin,
  RoomInlineEquationPlugin,
  MarkdownPlugin.configure({
    options: {
      remarkPlugins: [remarkMath, remarkGfm],
      rules: {
        [ROOM_HTML_BLOCK_ELEMENT_TYPE]: {
          deserialize: ((mdastNode: any) => ({
            children: [{ text: "" }],
            type: ROOM_HTML_BLOCK_ELEMENT_TYPE,
            value: mdastNode.value ?? "",
          })) as any,
          serialize: ((slateNode: any) => ({
            type: "html",
            value:
              typeof slateNode.value === "string"
                ? normalizeSerializedHtmlBlock(slateNode.value)
                : "",
          })) as any,
        },
        html: {
          deserialize: ((mdastNode: any, deco: any, options: any) => {
            if (isStandaloneHtmlBlock(mdastNode.value)) {
              return {
                children: [{ text: "" }],
                type: ROOM_HTML_BLOCK_ELEMENT_TYPE,
                value: mdastNode.value ?? "",
              };
            }

            return defaultRules.html?.deserialize?.(mdastNode, deco, options);
          }) as any,
        },
        inlineMath: {
          deserialize: ((mdastNode: any) => ({
            children: [{ text: "" }],
            texExpression: mdastNode.value ?? "",
            type: KEYS.inlineEquation,
          })) as any,
        },
        [KEYS.inlineEquation]: {
          serialize: ((slateNode: any) => ({
            type: "inlineMath",
            value: typeof slateNode.texExpression === "string" ? slateNode.texExpression : "",
          })) as any,
        },
        equation: {
          deserialize: ((mdastNode: any) => ({
            children: [{ text: "" }],
            texExpression: mdastNode.value ?? "",
            type: KEYS.equation,
          })) as any,
          serialize: ((slateNode: any) => ({
            type: "math",
            value: typeof slateNode.texExpression === "string" ? slateNode.texExpression : "",
          })) as any,
        },
      } as any,
    },
  }),
] as const;

function isStandaloneHtmlBlock(value: unknown): boolean {
  if (typeof value !== "string") {
    return false;
  }

  const trimmed = value.trim();
  if (trimmed.length === 0) {
    return false;
  }

  if (/^<!--[\s\S]*-->$/.test(trimmed)) {
    return true;
  }

  if (/^<([A-Za-z][\w:-]*)(\s[^>]*)?>[\s\S]*<\/\1>$/.test(trimmed)) {
    return true;
  }

  return /^<([A-Za-z][\w:-]*)(\s[^>]*)?\/>$/.test(trimmed);
}

function normalizeSerializedHtmlBlock(value: string): string {
  return value.replace(/\bclassName=/g, "class=");
}

function stripEditorArtifacts(markdown: string): string {
  return markdown.replace(/\u200B/g, "");
}

function unsupportedMarkdownReason(
  node: MarkdownNode,
  parent: MarkdownNode | undefined,
): string | undefined {
  const type = typeof node.type === "string" ? node.type : "";

  if (type === "html") {
    if (parent?.type !== "paragraph" && isStandaloneHtmlBlock(node.value)) {
      return undefined;
    }

    return "inline HTML";
  }

  if (Object.hasOwn(ROOM_UNSUPPORTED_MARKDOWN_NODE_REASONS, type)) {
    return ROOM_UNSUPPORTED_MARKDOWN_NODE_REASONS[type];
  }

  if (!ROOM_SUPPORTED_MARKDOWN_NODE_TYPES.has(type)) {
    return `unsupported "${type}" blocks`;
  }

  return undefined;
}

function visitMarkdownTree(
  node: MarkdownNode,
  visit: (entry: MarkdownNode, parent: MarkdownNode | undefined) => string | null,
  parent?: MarkdownNode,
): string | null {
  const reason = visit(node, parent);
  if (reason) {
    return reason;
  }

  for (const child of node.children ?? []) {
    const childReason = visitMarkdownTree(child, visit, node);
    if (childReason) {
      return childReason;
    }
  }

  return null;
}

function parseRoomMarkdownTree(markdown: string): MarkdownNode {
  return unified()
    .use(remarkParse)
    .use(remarkMath)
    .use(remarkGfm)
    .parse(markdown) as unknown as MarkdownNode;
}

function normalizeMarkdownIdentifier(value: string | undefined): string | undefined {
  return typeof value === "string" && value.length > 0 ? value.trim().toLowerCase() : undefined;
}

function getMarkdownNodeOffsets(node: MarkdownNode): { end: number; start: number } | null {
  const start = node.position?.start?.offset;
  const end = node.position?.end?.offset;
  return typeof start === "number" && typeof end === "number" ? { end, start } : null;
}

function collectMarkdownDefinitions(root: MarkdownNode): Map<string, MarkdownDefinition> {
  const definitions = new Map<string, MarkdownDefinition>();

  for (const child of root.children ?? []) {
    if (child.type !== "definition" || typeof child.url !== "string") {
      continue;
    }

    const identifier = normalizeMarkdownIdentifier(child.identifier);
    if (!identifier) {
      continue;
    }

    definitions.set(identifier, {
      ...(typeof child.title === "string" || child.title === null ? { title: child.title } : {}),
      identifier,
      position: child.position,
      url: child.url,
    });
  }

  return definitions;
}

function readMarkdownNodeSource(markdown: string, node: MarkdownNode): string {
  const offsets = getMarkdownNodeOffsets(node);
  return offsets ? markdown.slice(offsets.start, offsets.end) : "";
}

function createInlineMarkdownLink(
  markdown: string,
  node: MarkdownNode,
  definition: MarkdownDefinition,
): string {
  const firstChild = node.children?.[0];
  const lastChild = node.children?.[node.children.length - 1];
  const firstChildOffsets = firstChild ? getMarkdownNodeOffsets(firstChild) : null;
  const lastChildOffsets = lastChild ? getMarkdownNodeOffsets(lastChild) : null;
  const label =
    firstChildOffsets && lastChildOffsets
      ? markdown.slice(firstChildOffsets.start, lastChildOffsets.end)
      : typeof node.label === "string"
        ? node.label
        : readMarkdownNodeSource(markdown, node);
  const escapedTitle =
    typeof definition.title === "string"
      ? ` "${definition.title.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`
      : "";

  return `[${label}](${definition.url}${escapedTitle})`;
}

function normalizeRoomMarkdownSource(markdown: string): string {
  const root = parseRoomMarkdownTree(markdown);
  const definitions = collectMarkdownDefinitions(root);
  const replacements: Array<{ end: number; start: number; text: string }> = [];

  function visit(node: MarkdownNode) {
    if (node.type === "linkReference") {
      const definition = definitions.get(normalizeMarkdownIdentifier(node.identifier) ?? "");
      const offsets = getMarkdownNodeOffsets(node);
      if (definition && offsets) {
        replacements.push({
          ...offsets,
          text: createInlineMarkdownLink(markdown, node, definition),
        });
      }
    }

    if (node.type === "definition") {
      const offsets = getMarkdownNodeOffsets(node);
      if (offsets) {
        let end = offsets.end;
        if (markdown[end] === "\n") {
          end += 1;
        }
        replacements.push({ end, start: offsets.start, text: "" });
      }
    }

    for (const child of node.children ?? []) {
      visit(child);
    }
  }

  visit(root);

  return replacements
    .toSorted((left, right) => right.start - left.start)
    .reduce(
      (nextMarkdown, replacement) =>
        `${nextMarkdown.slice(0, replacement.start)}${replacement.text}${nextMarkdown.slice(replacement.end)}`,
      markdown,
    );
}

export function createRoomMarkdownConversionEditor(): ReturnType<typeof createPlateEditor> {
  return createPlateEditor({
    plugins: [...ROOM_MARKDOWN_PLUGINS],
    value: [{ children: [{ text: "" }], type: KEYS.p }],
  });
}

export function deserializeRoomMarkdown(markdown: string) {
  const editor = createRoomMarkdownConversionEditor();
  return withRoomElementIds(editor.api.markdown.deserialize(normalizeRoomMarkdownSource(markdown)));
}

export function serializeRoomMarkdown(editor: {
  api: { markdown: { serialize: () => string } };
}): string {
  return stripEditorArtifacts(editor.api.markdown.serialize());
}

export function roundTripRoomMarkdown(markdown: string): string {
  const editor = createRoomMarkdownConversionEditor();
  editor.tf.setValue(deserializeRoomMarkdown(markdown));
  return serializeRoomMarkdown(editor);
}

export function auditRoomMarkdownDocument(markdown: string): RoomMarkdownAuditResult {
  try {
    const tree = parseRoomMarkdownTree(normalizeRoomMarkdownSource(markdown));
    const reason = visitMarkdownTree(tree, (node, parent) => {
      const type = typeof node.type === "string" ? node.type : "";
      return type.length > 0 ? (unsupportedMarkdownReason(node, parent) ?? null) : null;
    });

    if (reason) {
      return {
        mode: "raw",
        reason,
      };
    }
  } catch (error) {
    return {
      mode: "raw",
      reason: error instanceof Error ? error.message : "unsupported markdown",
    };
  }

  return { mode: "rich" };
}

export function roomMarkdownFallbackMessage(reason: string): string {
  return `Editing raw Markdown to preserve ${reason}.`;
}

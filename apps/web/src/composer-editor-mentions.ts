import type { ComposerCapabilityMention } from "@t3tools/contracts";
import {
  INLINE_TERMINAL_CONTEXT_PLACEHOLDER,
  type TerminalContextDraft,
} from "./lib/terminalContext";

export type ComposerPromptSegment =
  | {
      type: "text";
      text: string;
    }
  | {
      type: "mention";
      path: string;
    }
  | {
      type: "capability-mention";
      mention: Extract<ComposerCapabilityMention, { kind: "skill" }>;
    }
  | {
      type: "terminal-context";
      context: TerminalContextDraft | null;
    };

const MENTION_TOKEN_REGEX = /(^|\s)@([^\s@]+)(?=\s)/g;

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

type InlinePromptMatch =
  | {
      start: number;
      end: number;
      segment: Extract<ComposerPromptSegment, { type: "mention" }>;
    }
  | {
      start: number;
      end: number;
      segment: Extract<ComposerPromptSegment, { type: "capability-mention" }>;
    };

function pushTextSegment(segments: ComposerPromptSegment[], text: string): void {
  if (!text) return;
  const last = segments[segments.length - 1];
  if (last && last.type === "text") {
    last.text += text;
    return;
  }
  segments.push({ type: "text", text });
}

function collectInlinePromptMatches(
  text: string,
  capabilityMentions: ReadonlyArray<ComposerCapabilityMention>,
): InlinePromptMatch[] {
  const matches: InlinePromptMatch[] = [];

  for (const match of text.matchAll(MENTION_TOKEN_REGEX)) {
    const fullMatch = match[0];
    const prefix = match[1] ?? "";
    const path = match[2] ?? "";
    const matchIndex = match.index ?? 0;
    const start = matchIndex + prefix.length;
    const end = start + fullMatch.length - prefix.length;

    if (path.length === 0) {
      continue;
    }

    matches.push({
      start,
      end,
      segment: { type: "mention", path },
    });
  }

  const skillMentions = capabilityMentions.filter(
    (mention): mention is Extract<ComposerCapabilityMention, { kind: "skill" }> =>
      mention.kind === "skill" && mention.token.startsWith("$") && mention.path.length > 0,
  );

  for (const mention of skillMentions) {
    const tokenPattern = new RegExp(`(^|\\s)(${escapeRegExp(mention.token)})(?=\\s)`, "g");
    for (const match of text.matchAll(tokenPattern)) {
      const prefix = match[1] ?? "";
      const token = match[2] ?? "";
      const matchIndex = match.index ?? 0;
      const start = matchIndex + prefix.length;
      const end = start + token.length;

      if (token.length === 0) {
        continue;
      }

      matches.push({
        start,
        end,
        segment: { type: "capability-mention", mention },
      });
    }
  }

  matches.sort((left, right) => {
    if (left.start !== right.start) {
      return left.start - right.start;
    }
    return right.end - left.end;
  });

  return matches;
}

function splitPromptTextIntoComposerSegments(
  text: string,
  capabilityMentions: ReadonlyArray<ComposerCapabilityMention>,
): ComposerPromptSegment[] {
  const segments: ComposerPromptSegment[] = [];
  if (!text) {
    return segments;
  }

  let cursor = 0;
  for (const match of collectInlinePromptMatches(text, capabilityMentions)) {
    if (match.start < cursor) {
      continue;
    }

    if (match.start > cursor) {
      pushTextSegment(segments, text.slice(cursor, match.start));
    }

    segments.push(match.segment);
    cursor = match.end;
  }

  if (cursor < text.length) {
    pushTextSegment(segments, text.slice(cursor));
  }

  return segments;
}

export function splitPromptIntoComposerSegments(
  prompt: string,
  terminalContexts: ReadonlyArray<TerminalContextDraft> = [],
  capabilityMentions: ReadonlyArray<ComposerCapabilityMention> = [],
): ComposerPromptSegment[] {
  if (!prompt) {
    return [];
  }

  const segments: ComposerPromptSegment[] = [];
  let textCursor = 0;
  let terminalContextIndex = 0;

  for (let index = 0; index < prompt.length; index += 1) {
    if (prompt[index] !== INLINE_TERMINAL_CONTEXT_PLACEHOLDER) {
      continue;
    }

    if (index > textCursor) {
      segments.push(
        ...splitPromptTextIntoComposerSegments(prompt.slice(textCursor, index), capabilityMentions),
      );
    }
    segments.push({
      type: "terminal-context",
      context: terminalContexts[terminalContextIndex] ?? null,
    });
    terminalContextIndex += 1;
    textCursor = index + 1;
  }

  if (textCursor < prompt.length) {
    segments.push(
      ...splitPromptTextIntoComposerSegments(prompt.slice(textCursor), capabilityMentions),
    );
  }

  return segments;
}

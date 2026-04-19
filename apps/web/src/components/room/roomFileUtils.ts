"use client";

import {
  classifyFilePreview,
  isMarkdownPreviewPath,
  isWorkbookTabularFileKind,
} from "@t3tools/shared/filePreviews";

import { resolveMarkdownFileLinkTarget } from "~/markdown-links";
import { resolvePathLinkTarget } from "~/terminal-links";
import { basenameOfPath } from "~/vscode-icons";

const LINE_COLUMN_SUFFIX_PATTERN = /:\d+(?::\d+)?$/;
const WINDOWS_ABSOLUTE_PATH_PATTERN = /^[A-Za-z]:\//;

export const ROOM_WRITE_CONFLICT_MESSAGE = "Workspace file was modified on disk.";

function normalizePathSeparators(pathValue: string): string {
  return pathValue.replaceAll("\\", "/");
}

function directoryOfRelativePath(relativePath: string): string {
  const normalizedPath = normalizePathSeparators(relativePath).replace(/\/+$/, "");
  const lastSeparatorIndex = normalizedPath.lastIndexOf("/");
  return lastSeparatorIndex === -1 ? "" : normalizedPath.slice(0, lastSeparatorIndex);
}

export function isMarkdownPath(pathValue: string): boolean {
  return isMarkdownPreviewPath(pathValue);
}

export function classifyRoomFile(pathValue: string) {
  return classifyFilePreview(pathValue);
}

export function isWorkbookPresentationPreview(pathValue: string): boolean {
  const preview = classifyFilePreview(pathValue);
  return preview.kind === "tabular" && isWorkbookTabularFileKind(preview.tabularKind);
}

export function resolveWorkspaceAbsolutePath(workspaceRoot: string, relativePath: string): string {
  return resolvePathLinkTarget(relativePath, workspaceRoot).replace(LINE_COLUMN_SUFFIX_PATTERN, "");
}

export function workspaceRootLabel(workspaceRoot: string): string {
  return basenameOfPath(normalizePathSeparators(workspaceRoot));
}

export function roomBreadcrumbSegments(workspaceRoot: string, relativePath: string): string[] {
  return [workspaceRootLabel(workspaceRoot), ...relativePath.split(/[\\/]+/).filter(Boolean)];
}

export function resolveRoomRelativeLinkTarget(
  href: string | undefined,
  workspaceRoot: string,
  currentRelativePath?: string,
): string | null {
  const linkCwd =
    currentRelativePath && currentRelativePath.length > 0
      ? resolvePathLinkTarget(directoryOfRelativePath(currentRelativePath), workspaceRoot)
      : workspaceRoot;
  const absoluteTarget = resolveMarkdownFileLinkTarget(href, linkCwd);
  if (!absoluteTarget) {
    return null;
  }

  const normalizedRoot = normalizePathSeparators(workspaceRoot).replace(/\/+$/, "");
  const normalizedAbsoluteTarget = normalizePathSeparators(absoluteTarget).replace(
    LINE_COLUMN_SUFFIX_PATTERN,
    "",
  );
  const caseInsensitive = WINDOWS_ABSOLUTE_PATH_PATTERN.test(normalizedRoot);
  const comparableRoot = caseInsensitive ? normalizedRoot.toLowerCase() : normalizedRoot;
  const comparableAbsolute = caseInsensitive
    ? normalizedAbsoluteTarget.toLowerCase()
    : normalizedAbsoluteTarget;

  if (
    comparableAbsolute === comparableRoot ||
    !comparableAbsolute.startsWith(`${comparableRoot}/`)
  ) {
    return null;
  }

  return normalizedAbsoluteTarget.slice(normalizedRoot.length + 1);
}

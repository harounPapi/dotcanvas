import { Effect, FileSystem, Layer, Option } from "effect";
import JSZip from "jszip";
import { EncryptedPDFError, PDFDocument } from "pdf-lib";

import { PROJECT_DOCUMENT_READ_FILE_MAX_BYTES } from "@t3tools/contracts";
import { classifyFilePreview } from "@t3tools/shared/filePreviews";

import { WorkspacePaths } from "../Services/WorkspacePaths.ts";
import {
  WorkspaceDocumentFileSystem,
  WorkspaceDocumentFileSystemError,
  type WorkspaceDocumentFileSystemShape,
} from "../Services/WorkspaceDocumentFileSystem.ts";

function mtimeMsOf(mtime: Option.Option<Date>) {
  const date = Option.getOrUndefined(mtime);
  return date ? Math.max(0, Math.trunc(date.getTime())) : 0;
}

function normalizePreviewPath(pathValue: string) {
  return pathValue.replaceAll("\\", "/").toLowerCase();
}

function documentMimeType(kind: "pdf" | "docx") {
  return kind === "pdf"
    ? "application/pdf"
    : "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
}

function isLegacyWordDocument(pathValue: string) {
  return normalizePreviewPath(pathValue).endsWith(".doc");
}

function documentValidationError(input: {
  cwd: string;
  relativePath?: string;
  detail: string;
  operation: string;
  cause?: unknown;
}) {
  return new WorkspaceDocumentFileSystemError({
    cwd: input.cwd,
    ...(input.relativePath ? { relativePath: input.relativePath } : {}),
    operation: input.operation,
    detail: input.detail,
    ...(input.cause === undefined ? {} : { cause: input.cause }),
  });
}

async function validatePdfDocument(bytes: Uint8Array) {
  await PDFDocument.load(bytes, {
    ignoreEncryption: false,
    updateMetadata: false,
  });
}

async function validateDocxDocument(bytes: Uint8Array) {
  const archive = await JSZip.loadAsync(bytes);
  const contentTypes = archive.file("[Content_Types].xml");
  const documentXml = archive.file("word/document.xml");

  if (!contentTypes || !documentXml) {
    throw new Error("DOCX archive is missing required WordprocessingML parts.");
  }

  await Promise.all([contentTypes.async("string"), documentXml.async("string")]);
}

export const makeWorkspaceDocumentFileSystem = Effect.gen(function* () {
  const fileSystem = yield* FileSystem.FileSystem;
  const workspacePaths = yield* WorkspacePaths;

  const statOrNull = (absolutePath: string) =>
    fileSystem.stat(absolutePath).pipe(Effect.catch(() => Effect.succeed(null)));

  const readDocumentFile: WorkspaceDocumentFileSystemShape["readDocumentFile"] = Effect.fn(
    "WorkspaceDocumentFileSystem.readDocumentFile",
  )(function* (input) {
    const cwd = yield* workspacePaths.normalizeWorkspaceRoot(input.cwd).pipe(
      Effect.mapError((cause) =>
        documentValidationError({
          cwd: input.cwd,
          relativePath: input.relativePath,
          operation: "workspaceDocumentFileSystem.normalizeWorkspaceRoot",
          detail: cause.message,
          cause,
        }),
      ),
    );
    const target = yield* workspacePaths.resolveRelativePathWithinRoot({
      workspaceRoot: cwd,
      relativePath: input.relativePath,
    });
    const existing = yield* statOrNull(target.absolutePath);

    if (!existing) {
      return yield* documentValidationError({
        cwd,
        relativePath: input.relativePath,
        operation: "workspaceDocumentFileSystem.readDocumentFile",
        detail: `File does not exist: ${target.relativePath}`,
      });
    }

    if (existing.type !== "File") {
      return yield* documentValidationError({
        cwd,
        relativePath: input.relativePath,
        operation: "workspaceDocumentFileSystem.readDocumentFile",
        detail: `Path is not a file: ${target.relativePath}`,
      });
    }

    const preview = classifyFilePreview(target.relativePath);
    if (preview.kind !== "document") {
      return yield* documentValidationError({
        cwd,
        relativePath: input.relativePath,
        operation: "workspaceDocumentFileSystem.readDocumentFile",
        detail: isLegacyWordDocument(target.relativePath)
          ? `Microsoft Word .doc files aren’t supported in Room yet. Save as .docx or open externally: ${target.relativePath}`
          : `File is not a supported document preview: ${target.relativePath}`,
      });
    }

    if (existing.size > PROJECT_DOCUMENT_READ_FILE_MAX_BYTES) {
      return yield* documentValidationError({
        cwd,
        relativePath: input.relativePath,
        operation: "workspaceDocumentFileSystem.readDocumentFile",
        detail: `Document file is too large to open in Room: ${target.relativePath}`,
      });
    }

    const bytes = yield* fileSystem.readFile(target.absolutePath).pipe(
      Effect.mapError((cause) =>
        documentValidationError({
          cwd,
          relativePath: input.relativePath,
          operation: "workspaceDocumentFileSystem.readDocumentFile",
          detail: cause.message,
          cause,
        }),
      ),
    );

    yield* Effect.tryPromise({
      try: () =>
        preview.documentKind === "pdf" ? validatePdfDocument(bytes) : validateDocxDocument(bytes),
      catch: (cause) =>
        documentValidationError({
          cwd,
          relativePath: input.relativePath,
          operation: "workspaceDocumentFileSystem.validateDocument",
          detail:
            cause instanceof EncryptedPDFError
              ? `Document is password-protected or encrypted and can’t be previewed in Room: ${target.relativePath}`
              : `Document is password-protected or corrupted and can’t be previewed in Room: ${target.relativePath}`,
          cause,
        }),
    });

    return {
      relativePath: target.relativePath,
      kind: preview.documentKind,
      sizeBytes: Number(existing.size),
      mtimeMs: mtimeMsOf(existing.mtime),
      mimeType: documentMimeType(preview.documentKind),
      capabilities: {
        canEditInRoom: false as const,
      },
      contentBase64: Buffer.from(bytes).toString("base64"),
    };
  });

  return {
    readDocumentFile,
  } satisfies WorkspaceDocumentFileSystemShape;
});

export const WorkspaceDocumentFileSystemLive = Layer.effect(
  WorkspaceDocumentFileSystem,
  makeWorkspaceDocumentFileSystem,
);

import * as NodeServices from "@effect/platform-node/NodeServices";
import { describe, expect, it } from "@effect/vitest";
import { Effect, FileSystem, Layer, Path } from "effect";
import JSZip from "jszip";
import { PDFDocument, StandardFonts } from "pdf-lib";

import { PROJECT_DOCUMENT_READ_FILE_MAX_BYTES } from "@t3tools/contracts";

import { ServerConfig } from "../../config.ts";
import { WorkspacePathsLive } from "./WorkspacePaths.ts";
import { WorkspaceDocumentFileSystemLive } from "./WorkspaceDocumentFileSystem.ts";
import {
  WorkspaceDocumentFileSystem,
  WorkspaceDocumentFileSystemError,
} from "../Services/WorkspaceDocumentFileSystem.ts";
import { WorkspacePathOutsideRootError } from "../Services/WorkspacePaths.ts";

const ProjectLayer = WorkspaceDocumentFileSystemLive.pipe(Layer.provide(WorkspacePathsLive));

const TestLayer = Layer.empty.pipe(
  Layer.provideMerge(ProjectLayer),
  Layer.provideMerge(WorkspacePathsLive),
  Layer.provide(
    ServerConfig.layerTest(process.cwd(), {
      prefix: "t3-workspace-document-test-",
    }),
  ),
  Layer.provideMerge(NodeServices.layer),
);

const makeTempDir = Effect.gen(function* () {
  const fileSystem = yield* FileSystem.FileSystem;
  return yield* fileSystem.makeTempDirectoryScoped({
    prefix: "assist-workspace-document-",
  });
});

const writeBinaryFile = Effect.fn("writeBinaryFile")(function* (
  cwd: string,
  relativePath: string,
  contents: Uint8Array,
) {
  const fileSystem = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const absolutePath = path.join(cwd, relativePath);
  yield* fileSystem
    .makeDirectory(path.dirname(absolutePath), { recursive: true })
    .pipe(Effect.orDie);
  yield* fileSystem.writeFile(absolutePath, contents).pipe(Effect.orDie);
  return absolutePath;
});

function detailOf(error: WorkspaceDocumentFileSystemError | WorkspacePathOutsideRootError): string {
  return "detail" in error ? error.detail : error.message;
}

async function buildPdfBytes() {
  const document = await PDFDocument.create();
  const page = document.addPage([320, 240]);
  const font = await document.embedFont(StandardFonts.Helvetica);
  page.drawText("Room PDF Preview", {
    font,
    size: 18,
    x: 40,
    y: 160,
  });
  const output = await document.save();
  return output instanceof Uint8Array ? output : new Uint8Array(output);
}

async function buildDocxBytes() {
  const archive = new JSZip();
  archive.file(
    "[Content_Types].xml",
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
  <Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>
</Types>`,
  );
  archive.folder("_rels")?.file(
    ".rels",
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`,
  );
  archive.folder("word")?.file(
    "document.xml",
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>
    <w:p><w:r><w:t>Room DOCX Preview</w:t></w:r></w:p>
    <w:p><w:r><w:t>Second paragraph</w:t></w:r></w:p>
    <w:sectPr>
      <w:pgSz w:w="12240" w:h="15840"/>
      <w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440" w:header="720" w:footer="720" w:gutter="0"/>
    </w:sectPr>
  </w:body>
</w:document>`,
  );
  archive.folder("word")?.file(
    "styles.xml",
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:style w:type="paragraph" w:default="1" w:styleId="Normal">
    <w:name w:val="Normal"/>
    <w:qFormat/>
  </w:style>
</w:styles>`,
  );

  const output = await archive.generateAsync({
    type: "uint8array",
    compression: "DEFLATE",
  });
  return output instanceof Uint8Array ? output : new Uint8Array(output);
}

it.layer(TestLayer)("WorkspaceDocumentFileSystemLive", (it) => {
  describe("readDocumentFile", () => {
    it.effect("reads valid PDF files into the Room document preview shape", () =>
      Effect.gen(function* () {
        const workspaceDocumentFileSystem = yield* WorkspaceDocumentFileSystem;
        const cwd = yield* makeTempDir;
        yield* Effect.promise(buildPdfBytes).pipe(
          Effect.flatMap((bytes) => writeBinaryFile(cwd, "brief.pdf", bytes)),
        );

        const result = yield* workspaceDocumentFileSystem.readDocumentFile({
          cwd,
          relativePath: "brief.pdf",
        });

        expect(result.kind).toBe("pdf");
        expect(result.mimeType).toBe("application/pdf");
        expect(result.capabilities.canEditInRoom).toBe(false);
        expect(result.contentBase64.length).toBeGreaterThan(0);
      }),
    );

    it.effect("reads valid DOCX files into the Room document preview shape", () =>
      Effect.gen(function* () {
        const workspaceDocumentFileSystem = yield* WorkspaceDocumentFileSystem;
        const cwd = yield* makeTempDir;
        yield* Effect.promise(buildDocxBytes).pipe(
          Effect.flatMap((bytes) => writeBinaryFile(cwd, "brief.docx", bytes)),
        );

        const result = yield* workspaceDocumentFileSystem.readDocumentFile({
          cwd,
          relativePath: "brief.docx",
        });

        expect(result.kind).toBe("docx");
        expect(result.mimeType).toBe(
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        );
        expect(result.capabilities.canEditInRoom).toBe(false);
        expect(result.contentBase64.length).toBeGreaterThan(0);
      }),
    );

    it.effect("rejects oversized documents", () =>
      Effect.gen(function* () {
        const workspaceDocumentFileSystem = yield* WorkspaceDocumentFileSystem;
        const cwd = yield* makeTempDir;
        const bytes = new Uint8Array(PROJECT_DOCUMENT_READ_FILE_MAX_BYTES + 1);
        yield* writeBinaryFile(cwd, "massive.pdf", bytes);

        const error = yield* workspaceDocumentFileSystem
          .readDocumentFile({
            cwd,
            relativePath: "massive.pdf",
          })
          .pipe(Effect.flip);

        expect(detailOf(error)).toContain("Document file is too large to open in Room");
      }),
    );

    it.effect(
      "rejects corrupt or password-protected-looking documents with a user-facing error",
      () =>
        Effect.gen(function* () {
          const workspaceDocumentFileSystem = yield* WorkspaceDocumentFileSystem;
          const cwd = yield* makeTempDir;
          yield* writeBinaryFile(cwd, "broken.pdf", Uint8Array.from([1, 2, 3, 4]));
          yield* writeBinaryFile(cwd, "broken.docx", Uint8Array.from([5, 6, 7, 8]));

          const pdfError = yield* workspaceDocumentFileSystem
            .readDocumentFile({
              cwd,
              relativePath: "broken.pdf",
            })
            .pipe(Effect.flip);
          const docxError = yield* workspaceDocumentFileSystem
            .readDocumentFile({
              cwd,
              relativePath: "broken.docx",
            })
            .pipe(Effect.flip);

          expect(detailOf(pdfError)).toContain("password-protected or corrupted");
          expect(detailOf(docxError)).toContain("password-protected or corrupted");
        }),
    );

    it.effect("keeps legacy .doc files unsupported with explicit guidance", () =>
      Effect.gen(function* () {
        const workspaceDocumentFileSystem = yield* WorkspaceDocumentFileSystem;
        const cwd = yield* makeTempDir;
        yield* writeBinaryFile(cwd, "legacy.doc", Uint8Array.from([0, 1, 2, 3]));

        const error = yield* workspaceDocumentFileSystem
          .readDocumentFile({
            cwd,
            relativePath: "legacy.doc",
          })
          .pipe(Effect.flip);

        expect(detailOf(error)).toContain("Save as .docx or open externally");
      }),
    );
  });
});

"use client";

import type { ProjectReadDocumentFileResult } from "@t3tools/contracts";

import { RoomDocxSurface } from "./RoomDocxSurface";
import { RoomPdfSurface } from "./RoomPdfSurface";

export function RoomDocumentSurface(props: {
  onPreviewError: (message: string) => void;
  snapshot: ProjectReadDocumentFileResult;
}) {
  const { onPreviewError, snapshot } = props;

  if (snapshot.kind === "pdf") {
    return (
      <RoomPdfSurface
        onPreviewError={onPreviewError}
        snapshot={snapshot as ProjectReadDocumentFileResult & { kind: "pdf" }}
      />
    );
  }

  return (
    <RoomDocxSurface
      onPreviewError={onPreviewError}
      snapshot={snapshot as ProjectReadDocumentFileResult & { kind: "docx" }}
    />
  );
}

"use client";

import type { ProjectReadDocumentFileResult } from "@t3tools/contracts";

export function decodeBase64ToUint8Array(input: string): Uint8Array {
  const binary = window.atob(input);
  const bytes = new Uint8Array(binary.length);

  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }

  return bytes;
}

export function blobFromDocumentSnapshot(snapshot: ProjectReadDocumentFileResult): Blob {
  const bytes = decodeBase64ToUint8Array(snapshot.contentBase64);
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);

  return new Blob([copy], {
    type: snapshot.mimeType,
  });
}

export function documentPreviewLabel(kind: ProjectReadDocumentFileResult["kind"]) {
  return kind === "pdf" ? "PDF document" : "DOCX document";
}

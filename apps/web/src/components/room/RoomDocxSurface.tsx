"use client";

import type { ProjectReadDocumentFileResult } from "@t3tools/contracts";
import { renderAsync } from "docx-preview";
import { Loader2Icon } from "~/components/ui/icons";
import { useEffect, useRef, useState } from "react";

import { blobFromDocumentSnapshot } from "./roomDocumentPreview";
import "./roomDocumentPreview.css";

function docxPreviewErrorMessage(error: unknown) {
  if (error instanceof Error && error.message.trim().length > 0) {
    if (
      error.message.includes("central directory") ||
      error.message.includes("corrupted zip") ||
      error.message.includes("End of data reached") ||
      error.message.includes("unexpected signature")
    ) {
      return "Document is password-protected or corrupted and can’t be previewed in Room.";
    }
    return `Room couldn’t render this DOCX document: ${error.message}`;
  }

  return "Room couldn’t render this DOCX document.";
}

export function RoomDocxSurface(props: {
  onPreviewError: (message: string) => void;
  snapshot: ProjectReadDocumentFileResult & { kind: "docx" };
}) {
  const { onPreviewError, snapshot } = props;
  const bodyRef = useRef<HTMLDivElement | null>(null);
  const styleRef = useRef<HTMLDivElement | null>(null);
  const [renderState, setRenderState] = useState<"loading" | "ready">("loading");

  useEffect(() => {
    let cancelled = false;
    const bodyContainer = bodyRef.current;
    const styleContainer = styleRef.current;
    if (!bodyContainer || !styleContainer) {
      return;
    }

    setRenderState("loading");
    bodyContainer.replaceChildren();
    styleContainer.replaceChildren();

    const renderPreview = async () => {
      try {
        await renderAsync(blobFromDocumentSnapshot(snapshot), bodyContainer, styleContainer, {
          breakPages: true,
          className: "room-docx",
          inWrapper: true,
          renderChanges: false,
          renderComments: false,
          renderEndnotes: true,
          renderFooters: true,
          renderFootnotes: true,
          renderHeaders: true,
          trimXmlDeclaration: true,
          useBase64URL: true,
        });
        if (!cancelled) {
          setRenderState("ready");
        }
      } catch (error) {
        if (!cancelled) {
          onPreviewError(docxPreviewErrorMessage(error));
        }
      }
    };

    void renderPreview();

    return () => {
      cancelled = true;
      bodyContainer.replaceChildren();
      styleContainer.replaceChildren();
    };
  }, [onPreviewError, snapshot]);

  return (
    <div aria-label="Room DOCX preview" className="room-document-surface" data-room-docx-preview>
      {renderState === "loading" ? (
        <div className="flex items-center justify-center gap-2 px-5 py-8 text-sm text-muted-foreground">
          <Loader2Icon className="size-4 animate-spin" />
          Preparing DOCX preview...
        </div>
      ) : null}

      <div className="room-document-scroll">
        <div className="room-docx-canvas">
          <div className="room-docx-host min-w-0 max-w-full">
            <div ref={styleRef} />
            <div ref={bodyRef} />
          </div>
        </div>
      </div>
    </div>
  );
}

"use client";

import type { ProjectReadDocumentFileResult } from "@t3tools/contracts";
import {
  AnnotationLayer,
  GlobalWorkerOptions,
  getDocument,
  PasswordResponses,
  TextLayer,
  type PDFDocumentLoadingTask,
  type PDFDocumentProxy,
  type PDFPageProxy,
} from "pdfjs-dist";
import PdfWorker from "pdfjs-dist/build/pdf.worker.min.mjs?worker";
import { SimpleLinkService } from "pdfjs-dist/web/pdf_viewer.mjs";
import "pdfjs-dist/web/pdf_viewer.css";
import { Button } from "~/components/ui/button";
import { Loader2Icon } from "~/components/ui/icons";
import { useEffect, useEffectEvent, useMemo, useRef, useState } from "react";

import { blobFromDocumentSnapshot } from "./roomDocumentPreview";
import "./roomDocumentPreview.css";

let pdfWorkerConfigured = false;

function ensurePdfWorkerConfigured() {
  if (pdfWorkerConfigured) {
    return;
  }

  GlobalWorkerOptions.workerPort = new PdfWorker();
  pdfWorkerConfigured = true;
}

function clampScale(scale: number) {
  return Math.max(0.5, Math.min(3, Number(scale.toFixed(2))));
}

function layerSizeStyle(width: number, height: number) {
  return {
    height: `${height}px`,
    width: `${width}px`,
  };
}

function pdfPreviewErrorMessage(error: unknown) {
  if (error instanceof Error) {
    if (error.message.includes("password")) {
      return "Document is password-protected or corrupted and can’t be previewed in Room.";
    }
    if (error.message.trim().length > 0) {
      return `Room couldn’t render this PDF document: ${error.message}`;
    }
  }

  return "Room couldn’t render this PDF document.";
}

function RoomPdfPage(props: {
  onRenderComplete: () => void;
  onRenderError: (message: string) => void;
  pageNumber: number;
  pdfDocument: PDFDocumentProxy;
  scale: number;
}) {
  const { onRenderComplete, onRenderError, pageNumber, pdfDocument, scale } = props;
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const pageRef = useRef<HTMLDivElement | null>(null);
  const textLayerRef = useRef<HTMLDivElement | null>(null);
  const annotationLayerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    let cancelled = false;
    let renderTask: ReturnType<PDFPageProxy["render"]> | null = null;
    let textLayer: TextLayer | null = null;
    let annotationLayer: AnnotationLayer | null = null;
    const annotationLayerElement = annotationLayerRef.current;
    const textLayerElement = textLayerRef.current;

    const renderPage = async () => {
      const canvas = canvasRef.current;
      const pageElement = pageRef.current;
      if (!canvas || !pageElement || !textLayerElement || !annotationLayerElement) {
        return;
      }

      const page = await pdfDocument.getPage(pageNumber);
      if (cancelled) {
        return;
      }

      const viewport = page.getViewport({ scale });
      const devicePixelRatio = window.devicePixelRatio || 1;
      const renderViewport = page.getViewport({ scale: scale * devicePixelRatio });
      const context = canvas.getContext("2d");
      if (!context) {
        throw new Error("Unable to create a canvas context for the PDF preview.");
      }

      canvas.width = Math.ceil(renderViewport.width);
      canvas.height = Math.ceil(renderViewport.height);
      canvas.style.width = `${Math.ceil(viewport.width)}px`;
      canvas.style.height = `${Math.ceil(viewport.height)}px`;
      pageElement.style.width = `${Math.ceil(viewport.width)}px`;
      pageElement.style.height = `${Math.ceil(viewport.height)}px`;
      Object.assign(textLayerElement.style, layerSizeStyle(viewport.width, viewport.height));
      Object.assign(annotationLayerElement.style, layerSizeStyle(viewport.width, viewport.height));
      textLayerElement.replaceChildren();
      annotationLayerElement.replaceChildren();

      renderTask = page.render({
        canvas,
        canvasContext: context,
        viewport: renderViewport,
      });
      await renderTask.promise;
      if (cancelled) {
        return;
      }

      textLayer = new TextLayer({
        container: textLayerElement,
        textContentSource: page.streamTextContent(),
        viewport,
      });
      await textLayer.render();
      if (cancelled) {
        return;
      }

      annotationLayer = new AnnotationLayer({
        accessibilityManager: null,
        annotationCanvasMap: null,
        annotationEditorUIManager: null,
        annotationStorage: null,
        commentManager: null,
        div: annotationLayerElement,
        linkService: new SimpleLinkService(),
        page,
        structTreeLayer: null,
        viewport,
      });
      await annotationLayer.render({
        annotations: await page.getAnnotations({ intent: "display" }),
        div: annotationLayerElement,
        linkService: new SimpleLinkService(),
        page,
        renderForms: false,
        viewport,
      });
      for (const anchor of annotationLayerElement.querySelectorAll<HTMLAnchorElement>("a")) {
        anchor.target = "_blank";
        anchor.rel = "noopener noreferrer";
      }
      onRenderComplete();
    };

    void renderPage().catch((error) => {
      if (!cancelled) {
        onRenderError(pdfPreviewErrorMessage(error));
      }
    });

    return () => {
      cancelled = true;
      renderTask?.cancel();
      textLayer?.cancel();
      annotationLayerElement?.replaceChildren();
      textLayerElement?.replaceChildren();
    };
  }, [onRenderComplete, onRenderError, pageNumber, pdfDocument, scale]);

  return (
    <div
      aria-label={`PDF page ${pageNumber}`}
      className="room-pdf-page"
      data-room-pdf-page={pageNumber}
      ref={pageRef}
    >
      <canvas ref={canvasRef} />
      <div className="textLayer" ref={textLayerRef} />
      <div className="annotationLayer" ref={annotationLayerRef} />
    </div>
  );
}

export function RoomPdfSurface(props: {
  onPreviewError: (message: string) => void;
  snapshot: ProjectReadDocumentFileResult & { kind: "pdf" };
}) {
  const { onPreviewError, snapshot } = props;
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const pageRefs = useRef<Array<HTMLDivElement | null>>([]);
  const [pdfDocument, setPdfDocument] = useState<PDFDocumentProxy | null>(null);
  const [basePageWidth, setBasePageWidth] = useState<number>(816);
  const [currentPage, setCurrentPage] = useState(1);
  const [documentText, setDocumentText] = useState("");
  const [renderState, setRenderState] = useState<"loading" | "ready">("loading");
  const [zoomMode, setZoomMode] = useState<"fit" | "custom">("fit");
  const [customScale, setCustomScale] = useState(1);
  const [fitScale, setFitScale] = useState(1);

  ensurePdfWorkerConfigured();

  const effectiveScale = useMemo(
    () => clampScale(zoomMode === "fit" ? fitScale : customScale),
    [customScale, fitScale, zoomMode],
  );

  const syncFitScale = useEffectEvent(() => {
    const container = scrollRef.current;
    if (!container || basePageWidth <= 0) {
      return;
    }

    const nextFitScale = clampScale((container.clientWidth - 32) / basePageWidth);
    setFitScale((current) => (Math.abs(current - nextFitScale) < 0.01 ? current : nextFitScale));
  });

  const syncCurrentPage = useEffectEvent(() => {
    const container = scrollRef.current;
    if (!container || !pdfDocument) {
      return;
    }

    const containerRect = container.getBoundingClientRect();
    const probeY = containerRect.top + Math.min(containerRect.height * 0.35, 240);
    let bestPage = 1;
    let bestDistance = Number.POSITIVE_INFINITY;

    for (let index = 0; index < pageRefs.current.length; index += 1) {
      const pageElement = pageRefs.current[index];
      if (!pageElement) {
        continue;
      }

      const rect = pageElement.getBoundingClientRect();
      const pageMidpoint = rect.top + rect.height / 2;
      const distance = Math.abs(pageMidpoint - probeY);
      if (distance < bestDistance) {
        bestDistance = distance;
        bestPage = index + 1;
      }
    }

    setCurrentPage(bestPage);
  });

  useEffect(() => {
    const container = scrollRef.current;
    if (!container) {
      return;
    }

    syncFitScale();
    syncCurrentPage();

    const resizeObserver = new ResizeObserver(() => {
      syncFitScale();
      syncCurrentPage();
    });
    resizeObserver.observe(container);
    container.addEventListener("scroll", syncCurrentPage, { passive: true });

    return () => {
      resizeObserver.disconnect();
      container.removeEventListener("scroll", syncCurrentPage);
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    let loadingTask: PDFDocumentLoadingTask | null = null;
    let activeDocument: PDFDocumentProxy | null = null;

    setRenderState("loading");
    setPdfDocument(null);
    setCurrentPage(1);
    setDocumentText("");
    pageRefs.current = [];

    const loadPreview = async () => {
      try {
        const bytes = await blobFromDocumentSnapshot(snapshot).arrayBuffer();
        loadingTask = getDocument({ data: bytes });
        loadingTask.onPassword = (_setPassword: (password: string) => void, reason: number) => {
          throw new Error(
            reason === PasswordResponses.NEED_PASSWORD
              ? "Document is password-protected."
              : "Document password was rejected.",
          );
        };

        const documentProxy = await loadingTask.promise;
        if (cancelled) {
          await documentProxy.destroy();
          return;
        }

        activeDocument = documentProxy;
        const [firstPage, extractedPageText] = await Promise.all([
          documentProxy.getPage(1),
          Promise.all(
            Array.from({ length: documentProxy.numPages }, async (_value, index) => {
              const page = await documentProxy.getPage(index + 1);
              const textContent = await page.getTextContent();
              return textContent.items
                .map((item) => ("str" in item ? item.str : ""))
                .join(" ")
                .trim();
            }),
          ),
        ]);
        if (!cancelled) {
          setBasePageWidth(firstPage.getViewport({ scale: 1 }).width);
          setDocumentText(extractedPageText.filter((value) => value.length > 0).join(" "));
          setPdfDocument(documentProxy);
          setRenderState("ready");
        }
      } catch (error) {
        if (!cancelled) {
          onPreviewError(pdfPreviewErrorMessage(error));
        }
      }
    };

    void loadPreview();

    return () => {
      cancelled = true;
      void loadingTask?.destroy().catch(() => undefined);
      void activeDocument?.destroy().catch(() => undefined);
    };
  }, [onPreviewError, snapshot]);

  if (!pdfDocument) {
    return (
      <div className="room-document-surface">
        <div className="flex items-center justify-center gap-2 px-5 py-8 text-sm text-muted-foreground">
          <Loader2Icon className="size-4 animate-spin" />
          Preparing PDF preview...
        </div>
      </div>
    );
  }

  return (
    <div aria-label="Room PDF preview" className="room-document-surface" data-room-pdf-preview>
      {documentText.length > 0 ? <p className="sr-only">{documentText}</p> : null}
      <div className="flex items-center justify-between gap-3 border-b px-5 py-3">
        <div className="text-xs text-muted-foreground">
          Page {currentPage} of {pdfDocument.numPages}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">{Math.round(effectiveScale * 100)}%</span>
          <Button
            disabled={renderState === "loading"}
            onClick={() => {
              setZoomMode("custom");
              setCustomScale((current) =>
                clampScale((zoomMode === "fit" ? effectiveScale : current) - 0.1),
              );
            }}
            size="xs"
            variant="outline"
          >
            Zoom out
          </Button>
          <Button
            disabled={renderState === "loading"}
            onClick={() => {
              setZoomMode("custom");
              setCustomScale((current) =>
                clampScale((zoomMode === "fit" ? effectiveScale : current) + 0.1),
              );
            }}
            size="xs"
            variant="outline"
          >
            Zoom in
          </Button>
          <Button
            onClick={() => {
              setZoomMode("fit");
            }}
            size="xs"
            variant={zoomMode === "fit" ? "secondary" : "outline"}
          >
            Fit width
          </Button>
          <Button
            onClick={() => {
              setZoomMode("custom");
              setCustomScale(1);
            }}
            size="xs"
            variant="outline"
          >
            Reset zoom
          </Button>
        </div>
      </div>

      <div className="room-document-scroll" ref={scrollRef}>
        <div className="room-pdf-stack">
          {Array.from({ length: pdfDocument.numPages }, (_, index) => (
            <div
              key={`${snapshot.relativePath}:${snapshot.mtimeMs}:${index + 1}:${effectiveScale}`}
              ref={(element) => {
                pageRefs.current[index] = element;
              }}
            >
              <RoomPdfPage
                onRenderComplete={() => {
                  syncCurrentPage();
                }}
                onRenderError={onPreviewError}
                pageNumber={index + 1}
                pdfDocument={pdfDocument}
                scale={effectiveScale}
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

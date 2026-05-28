// Production CSS is part of the behavior under test because row height depends on it.
import "../index.css";

import {
  DEFAULT_PROJECT_KIND,
  DEFAULT_PROJECT_BOOTSTRAP_STATE,
  EventId,
  ORCHESTRATION_WS_METHODS,
  type MessageId,
  type OrchestrationEvent,
  type OrchestrationReadModel,
  type ProjectId,
  type ServerConfig,
  type ServerLifecycleWelcomePayload,
  type ThreadId,
  type TurnId,
  WS_METHODS,
  OrchestrationSessionStatus,
  DEFAULT_SERVER_SETTINGS,
} from "@t3tools/contracts";
import { RouterProvider, createMemoryHistory } from "@tanstack/react-router";
import { HttpResponse, http, ws } from "msw";
import { setupWorker } from "msw/browser";
import { page } from "vitest/browser";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { render } from "vitest-browser-react";

import { useComposerDraftStore } from "../composerDraftStore";
import {
  INLINE_TERMINAL_CONTEXT_PLACEHOLDER,
  type TerminalContextDraft,
  removeInlineTerminalContextPlaceholder,
} from "../lib/terminalContext";
import { isMacPlatform } from "../lib/utils";
import { __resetNativeApiForTests } from "../nativeApi";
import { AppAtomRegistryProvider } from "../rpc/atomRegistry";
import { getServerConfig } from "../rpc/serverState";
import { getRouter } from "../router";
import { useStore } from "../store";
import { useTerminalStateStore } from "../terminalStateStore";
import { BrowserWsRpcHarness, type NormalizedWsRpcRequestBody } from "../../test/wsRpcHarness";
import { estimateTimelineMessageHeight } from "./timelineHeight";
import { DEFAULT_CLIENT_SETTINGS } from "@t3tools/contracts/settings";

vi.mock("../lib/gitStatusState", () => ({
  useGitStatus: () => ({ data: null, error: null, cause: null, isPending: false }),
  useGitStatuses: () => new Map(),
  refreshGitStatus: () => Promise.resolve(null),
  resetGitStatusStateForTests: () => undefined,
}));

const THREAD_ID = "thread-browser-test" as ThreadId;
const UUID_ROUTE_RE = /^\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const PROJECT_ID = "project-1" as ProjectId;
const NOW_ISO = "2026-03-04T12:00:00.000Z";
const BASE_TIME_MS = Date.parse(NOW_ISO);
const ATTACHMENT_SVG = "<svg xmlns='http://www.w3.org/2000/svg' width='120' height='120'></svg>";
const ONE_PIXEL_PNG_BASE64 =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jx7sAAAAASUVORK5CYII=";
const ROOM_PDF_BASE64 =
  "JVBERi0xLjcKJYGBgYEKCjYgMCBvYmoKPDwKL0ZpbHRlciAvRmxhdGVEZWNvZGUKL0xlbmd0aCAxMDYKPj4Kc3RyZWFtCnicK+RyCuEyUADBonQufY/UnLLUkszkRF1zA0sLEwsDcwtLBUMLhZA0LiMThRAfLkOwUkMFEyABxCG5XDamRmZuQOhiZGBqYGJiYgaizY3MTM3NzCyBpLmdQkgWV4gWl2sIVyAXAKbEGIkKZW5kc3RyZWFtCmVuZG9iagoKNyAwIG9iago8PAovRmlsdGVyIC9GbGF0ZURlY29kZQovVHlwZSAvT2JqU3RtCi9OIDUKL0ZpcnN0IDI2Ci9MZW5ndGggMzYwCj4+CnN0cmVhbQp4nNVSTUvDQBC976+Yox5kP5JmEymFtkkUpCitoCge0mQpkbIryUbqv3cmSS09iGcJj92ZebP7NvMkCFAQhhCAjiGESaBgAlpKmE4Zf/z6MMAfip1pGb+rqxZekSNgDW+ML11nPUg2m7ETd1n4Yu92bGgCSeQj46FxVVeaBqZ5ludCaCFEFCIiIVSK6xKRIBTGWFMx7hE6HIE5HQgRzLGWD4j00EP1njsZ+zNckRsRJx24YTzEP/fSXdlwhvpLTzJjfOWqtPAGLtJrJVQkQplIqRAvl/g7GlN4938f1+uvnf31hWdzpvHSkBtDHuinzNemdV1T4tiJlzus0ObW7D+Nr8viSoskRp06TtBjozH48/323ZQ9lcLs4G82njQMCcqtTFUXC3dA9wn88OWAqsmDc2udJ1f2frQe1VAUjR49k0yCGN90W9+HlJSML4rW9FJPOlGELV1V2x3wp9rObVsfE3TiNxhwxdgKZW5kc3RyZWFtCmVuZG9iagoKOCAwIG9iago8PAovU2l6ZSA5Ci9Sb290IDIgMCBSCi9JbmZvIDMgMCBSCi9GaWx0ZXIgL0ZsYXRlRGVjb2RlCi9UeXBlIC9YUmVmCi9MZW5ndGggNDAKL1cgWyAxIDIgMiBdCi9JbmRleCBbIDAgOSBdCj4+CnN0cmVhbQp4nBXEsREAIAwDsbfDHS2rMxODJViFgG6zISk5VVrigHg/XxhhbQOfCmVuZHN0cmVhbQplbmRvYmoKCnN0YXJ0eHJlZgo2NTcKJSVFT0Y=";
const UPDATED_ROOM_PDF_BASE64 =
  "JVBERi0xLjcKJYGBgYEKCjYgMCBvYmoKPDwKL0ZpbHRlciAvRmxhdGVEZWNvZGUKL0xlbmd0aCAxMDkKPj4Kc3RyZWFtCnicHYoxCkJBDET7OUVqQcwuk2QXxEIQLGyEXEDkK4oWinh+98tj3jTvhW1CZeZ9xWo/Pb7T53Y+LUN7Y9NoXUqTvKBS8oDyT4twaCyfWJuFOr0E3ZxVTUn6/FHdwr0Px0byjlxglzjiBzVXGZIKZW5kc3RyZWFtCmVuZG9iagoKNyAwIG9iago8PAovRmlsdGVyIC9GbGF0ZURlY29kZQovVHlwZSAvT2JqU3RtCi9OIDUKL0ZpcnN0IDI2Ci9MZW5ndGggMzYwCj4+CnN0cmVhbQp4nNVSTUvDQBC976+Yox5kP5JmEymFtkkUpCitoCge0mQpkbIryUbqv3cmSS09iGcJj92ZebP7NvMkCFAQhhCAjiGESaBgAlpKmE4Zf/z6MMAfip1pGb+rqxZekSNgDW+ML11nPUg2m7ETd1n4Yu92bGgCSeQj46FxVVeaBqZ5ludCaCFEFCIiIVSK6xKRIBTGWFMx7hE6HIE5HQgRzLGWD4j00EP1njsZ+zNckRsRJx24YTzEP/fSXdlwhvpLTzJjfOWqtPAGLtJrJVQkQplIqRAvl/g7GlN4938f1+uvnf31hWdzpvHSkBtDHuinzNemdV1T4tiJlzus0ObW7D+Nr8viSoskRp06TtBjozH48/323ZQ9lcLs4G82njQMCcqtTFUXC3dA9wn88OWAqsmDc2udJ1f2frQe1VAUjR49k0yCGN90W9+HlJSML4rW9FJPOlGELV1V2x3wp9rObVsfE3TiNxhwxdgKZW5kc3RyZWFtCmVuZG9iagoKOCAwIG9iago8PAovU2l6ZSA5Ci9Sb290IDIgMCBSCi9JbmZvIDMgMCBSCi9GaWx0ZXIgL0ZsYXRlRGVjb2RlCi9UeXBlIC9YUmVmCi9MZW5ndGggNDAKL1cgWyAxIDIgMiBdCi9JbmRleCBbIDAgOSBdCj4+CnN0cmVhbQp4nBXEsREAIAwDsbfDHS3DMxNrJViFgG6zISk5VVrigHg/XxhhjgOlCmVuZHN0cmVhbQplbmRvYmoKCnN0YXJ0eHJlZgo2NjAKJSVFT0Y=";
const ROOM_DOCX_BASE64 =
  "UEsDBAoAAAAIAKBbk1wxpqS4/gAAADoCAAATAAAAW0NvbnRlbnRfVHlwZXNdLnhtbK2RzU7DMBCE730Ky9cqceCAEIrTAz9H4FAeYGVvEgv/yeuW5u1xGigSoogDR2vmmxmt283BWbbHRCZ4yS/qhjP0KmjjB8lftg/VNWeUwWuwwaPkExLfdKt2O0UkVmBPko85xxshSI3ogOoQ0RelD8lBLs80iAjqFQYUl01zJVTwGX2u8pzBuxVj7R32sLOZ3R+KsmxJaImz28U710kOMVqjIBdd7L3+VlR9lNSFPHpoNJHWxcDFuZJZPN/xhT6VEyWjkT1Dyo/gilG8haSFDmrnClz/nvTD2tD3RuGJn9NiCgqJyu2drU+KA+PXf5hCebJI/z9kyf1c0Irj13fvUEsDBAoAAAAAAKBbk1wAAAAAAAAAAAAAAAAGAAAAX3JlbHMvUEsDBAoAAAAIAKBbk1wgG4bqsgAAAC4BAAALAAAAX3JlbHMvLnJlbHONz7sOgjAUBuCdp2jOLgUHYwyFxZiwGnyApj2URnpJWy+8vR0cxDg4ntt38jfd08zkjiFqZxnUZQUErXBSW8XgMpw2eyAxcSv57CwyWDBC1xbNGWee8k2ctI8kIzYymFLyB0qjmNDwWDqPNk9GFwxPuQyKei6uXCHdVtWOhk8D2oKQFUt6ySD0sgYyLB7/4d04aoFHJ24Gbfrx5WsjyzwoTAweLkgq3+0ys0BzSrqK2b4AUEsDBAoAAAAAAKBbk1wAAAAAAAAAAAAAAAAFAAAAd29yZC9QSwMECgAAAAgAoFuTXGG/+wojAQAARAIAABEAAAB3b3JkL2RvY3VtZW50LnhtbI2RTW/CMAyG7/yKKPcRqNiGKloOm3abhvYh7Rpak1Zq4sgJdOzXz2m1wSQOXCw/sfO+Trxaf9lOHIBCi66Q8+lMCnAV1q0zhfx4f7pZShGidrXu0EEhjxDkupys+rzGam/BRcEKLuR9IZsYfa5UqBqwOkzRg+PaDsnqyEhG9Ui1J6wgBDawncpmsztldetkORGCVbdYH1M6gC85UAqxfEW04vHl4VNsCA4t9CuVjlOkIfqL1zbagODJhdekDWnfXHNvS4Kbjp4f7FlAqut8Yo/X+ASo4oZGHIXM2zcb8hfOs2zBK+jzhvPbJefqX9+zHiZDz+XF2EmtaeIJtxgj2hN3sDurNqBroELeZwPuEOMZmn0c8M81zX2aNtG4n5T97r/8AVBLAwQKAAAACACgW5Ncd+L25b8AAAAQAQAADwAAAHdvcmQvc3R5bGVzLnhtbD2PMW7DMAxF95xC4N7I7RAUhuVsAbJ0ag5AWIxtQKJUUYnj20cWmmzk//yPZHd8eKfulGQObOBz34AiHoKdeTRw+T19fIOSjGzRBSYDKwkc+123tJJXR6JKnqVdDEw5x1ZrGSbyKPsQiYt3DcljLm0a9RKSjSkMJFLw3umvpjlojzNDv1PqxVRLm9dYdkVMOCaMExTJ0hVvLpcbt64Onq2Bn43var4SGP0GuKN7e/pt/p3qNVXo9D+lPPMqpX8CUEsBAhQACgAAAAgAoFuTXDGmpLj+AAAAOgIAABMAAAAAAAAAAAAAAAAAAAAAAFtDb250ZW50X1R5cGVzXS54bWxQSwECFAAKAAAAAACgW5NcAAAAAAAAAAAAAAAABgAAAAAAAAAAABAAAAAvAQAAX3JlbHMvUEsBAhQACgAAAAgAoFuTXCAbhuqyAAAALgEAAAsAAAAAAAAAAAAAAAAAUwEAAF9yZWxzLy5yZWxzUEsBAhQACgAAAAAAoFuTXAAAAAAAAAAAAAAAAAUAAAAAAAAAAAAQAAAALgIAAHdvcmQvUEsBAhQACgAAAAgAoFuTXGG/+wojAQAARAIAABEAAAAAAAAAAAAAAAAAUQIAAHdvcmQvZG9jdW1lbnQueG1sUEsBAhQACgAAAAgAoFuTXHfi9uW/AAAAEAEAAA8AAAAAAAAAAAAAAAAAowMAAHdvcmQvc3R5bGVzLnhtbFBLBQYAAAAABgAGAF0BAACPBAAAAAA=";

interface TestFixture {
  snapshot: OrchestrationReadModel;
  serverConfig: ServerConfig;
  welcome: ServerLifecycleWelcomePayload;
}

let fixture: TestFixture;
const rpcHarness = new BrowserWsRpcHarness();
const wsRequests = rpcHarness.requests;
let customWsRpcResolver: ((body: NormalizedWsRpcRequestBody) => unknown | undefined) | null = null;
const wsLink = ws.link(/ws(s)?:\/\/.*/);

interface ViewportSpec {
  name: string;
  width: number;
  height: number;
  textTolerancePx: number;
  attachmentTolerancePx: number;
}

const DEFAULT_VIEWPORT: ViewportSpec = {
  name: "desktop",
  width: 960,
  height: 1_100,
  textTolerancePx: 44,
  attachmentTolerancePx: 56,
};
const WIDE_FOOTER_VIEWPORT: ViewportSpec = {
  name: "wide-footer",
  width: 1_400,
  height: 1_100,
  textTolerancePx: 44,
  attachmentTolerancePx: 56,
};
const COMPACT_FOOTER_VIEWPORT: ViewportSpec = {
  name: "compact-footer",
  width: 430,
  height: 932,
  textTolerancePx: 56,
  attachmentTolerancePx: 56,
};
const TEXT_VIEWPORT_MATRIX = [
  DEFAULT_VIEWPORT,
  { name: "tablet", width: 720, height: 1_024, textTolerancePx: 44, attachmentTolerancePx: 56 },
  { name: "mobile", width: 430, height: 932, textTolerancePx: 56, attachmentTolerancePx: 56 },
  { name: "narrow", width: 320, height: 700, textTolerancePx: 84, attachmentTolerancePx: 56 },
] as const satisfies readonly ViewportSpec[];
const ATTACHMENT_VIEWPORT_MATRIX = [
  { ...DEFAULT_VIEWPORT, attachmentTolerancePx: 120 },
  { name: "mobile", width: 430, height: 932, textTolerancePx: 56, attachmentTolerancePx: 120 },
  { name: "narrow", width: 320, height: 700, textTolerancePx: 84, attachmentTolerancePx: 120 },
] as const satisfies readonly ViewportSpec[];

interface UserRowMeasurement {
  measuredRowHeightPx: number;
  timelineWidthMeasuredPx: number;
  renderedInVirtualizedRegion: boolean;
}

interface MountedChatView {
  [Symbol.asyncDispose]: () => Promise<void>;
  cleanup: () => Promise<void>;
  measureUserRow: (targetMessageId: MessageId) => Promise<UserRowMeasurement>;
  setViewport: (viewport: ViewportSpec) => Promise<void>;
  setContainerSize: (viewport: Pick<ViewportSpec, "width" | "height">) => Promise<void>;
  router: ReturnType<typeof getRouter>;
}

function isoAt(offsetSeconds: number): string {
  return new Date(BASE_TIME_MS + offsetSeconds * 1_000).toISOString();
}

function createBaseServerConfig(): ServerConfig {
  return {
    cwd: "/repo/project",
    keybindingsConfigPath: "/repo/project/.assist-keybindings.json",
    keybindings: [],
    issues: [],
    providers: [
      {
        provider: "codex",
        enabled: true,
        installed: true,
        version: "0.116.0",
        status: "ready",
        auth: { status: "authenticated" },
        checkedAt: NOW_ISO,
        models: [],
      },
    ],
    availableEditors: [],
    availableProjectApps: [],
    observability: {
      logsDirectoryPath: "/repo/project/.assist/logs",
      localTracingEnabled: true,
      otlpTracesEnabled: false,
      otlpMetricsEnabled: false,
    },
    settings: {
      ...DEFAULT_SERVER_SETTINGS,
      ...DEFAULT_CLIENT_SETTINGS,
    },
  };
}

function createUserMessage(options: {
  id: MessageId;
  text: string;
  offsetSeconds: number;
  attachments?: Array<{
    type: "image";
    id: string;
    name: string;
    mimeType: string;
    sizeBytes: number;
  }>;
}) {
  return {
    id: options.id,
    role: "user" as const,
    text: options.text,
    ...(options.attachments ? { attachments: options.attachments } : {}),
    turnId: null,
    streaming: false,
    createdAt: isoAt(options.offsetSeconds),
    updatedAt: isoAt(options.offsetSeconds + 1),
  };
}

function createAssistantMessage(options: { id: MessageId; text: string; offsetSeconds: number }) {
  return {
    id: options.id,
    role: "assistant" as const,
    text: options.text,
    turnId: null,
    streaming: false,
    createdAt: isoAt(options.offsetSeconds),
    updatedAt: isoAt(options.offsetSeconds + 1),
  };
}

function createTerminalContext(input: {
  id: string;
  terminalLabel: string;
  lineStart: number;
  lineEnd: number;
  text: string;
}): TerminalContextDraft {
  return {
    id: input.id,
    threadId: THREAD_ID,
    terminalId: `terminal-${input.id}`,
    terminalLabel: input.terminalLabel,
    lineStart: input.lineStart,
    lineEnd: input.lineEnd,
    text: input.text,
    createdAt: NOW_ISO,
  };
}

function createSnapshotForTargetUser(options: {
  targetMessageId: MessageId;
  targetText: string;
  targetAttachmentCount?: number;
  sessionStatus?: OrchestrationSessionStatus;
}): OrchestrationReadModel {
  const messages: Array<OrchestrationReadModel["threads"][number]["messages"][number]> = [];

  for (let index = 0; index < 22; index += 1) {
    const isTarget = index === 3;
    const userId = `msg-user-${index}` as MessageId;
    const assistantId = `msg-assistant-${index}` as MessageId;
    const attachments =
      isTarget && (options.targetAttachmentCount ?? 0) > 0
        ? Array.from({ length: options.targetAttachmentCount ?? 0 }, (_, attachmentIndex) => ({
            type: "image" as const,
            id: `attachment-${attachmentIndex + 1}`,
            name: `attachment-${attachmentIndex + 1}.png`,
            mimeType: "image/png",
            sizeBytes: 128,
            previewUrl: `/attachments/attachment-${attachmentIndex + 1}`,
          }))
        : undefined;

    messages.push(
      createUserMessage({
        id: isTarget ? options.targetMessageId : userId,
        text: isTarget ? options.targetText : `filler user message ${index}`,
        offsetSeconds: messages.length * 3,
        ...(attachments ? { attachments } : {}),
      }),
    );
    messages.push(
      createAssistantMessage({
        id: assistantId,
        text: `assistant filler ${index}`,
        offsetSeconds: messages.length * 3,
      }),
    );
  }

  return {
    snapshotSequence: 1,
    projects: [
      {
        id: PROJECT_ID,
        title: "Project",
        workspaceRoot: "/repo/project",
        kind: DEFAULT_PROJECT_KIND,
        bootstrapState: DEFAULT_PROJECT_BOOTSTRAP_STATE,
        bootstrapThreadId: null,
        defaultModelSelection: {
          provider: "codex",
          model: "gpt-5",
        },
        scripts: [],
        createdAt: NOW_ISO,
        updatedAt: NOW_ISO,
        deletedAt: null,
      },
    ],
    threads: [
      {
        id: THREAD_ID,
        projectId: PROJECT_ID,
        title: "Browser test thread",
        modelSelection: {
          provider: "codex",
          model: "gpt-5",
        },
        interactionMode: "default",
        runtimeMode: "full-access",
        branch: "main",
        worktreePath: null,
        latestTurn: null,
        createdAt: NOW_ISO,
        updatedAt: NOW_ISO,
        archivedAt: null,
        deletedAt: null,
        messages,
        activities: [],
        proposedPlans: [],
        checkpoints: [],
        session: {
          threadId: THREAD_ID,
          status: options.sessionStatus ?? "ready",
          providerName: "codex",
          runtimeMode: "full-access",
          activeTurnId: null,
          lastError: null,
          updatedAt: NOW_ISO,
        },
      },
    ],
    updatedAt: NOW_ISO,
  };
}

function buildFixture(snapshot: OrchestrationReadModel): TestFixture {
  return {
    snapshot,
    serverConfig: createBaseServerConfig(),
    welcome: {
      cwd: "/repo/project",
      projectName: "Project",
      bootstrapProjectId: PROJECT_ID,
      bootstrapThreadId: THREAD_ID,
    },
  };
}

function addThreadToSnapshot(
  snapshot: OrchestrationReadModel,
  threadId: ThreadId,
): OrchestrationReadModel {
  return {
    ...snapshot,
    snapshotSequence: snapshot.snapshotSequence + 1,
    threads: [
      ...snapshot.threads,
      {
        id: threadId,
        projectId: PROJECT_ID,
        title: "New thread",
        modelSelection: {
          provider: "codex",
          model: "gpt-5",
        },
        interactionMode: "default",
        runtimeMode: "full-access",
        branch: "main",
        worktreePath: null,
        latestTurn: null,
        createdAt: NOW_ISO,
        updatedAt: NOW_ISO,
        archivedAt: null,
        deletedAt: null,
        messages: [],
        activities: [],
        proposedPlans: [],
        checkpoints: [],
        session: {
          threadId,
          status: "ready",
          providerName: "codex",
          runtimeMode: "full-access",
          activeTurnId: null,
          lastError: null,
          updatedAt: NOW_ISO,
        },
      },
    ],
  };
}

function createThreadCreatedEvent(threadId: ThreadId, sequence: number): OrchestrationEvent {
  return {
    sequence,
    eventId: EventId.makeUnsafe(`event-thread-created-${sequence}`),
    aggregateKind: "thread",
    aggregateId: threadId,
    occurredAt: NOW_ISO,
    commandId: null,
    causationEventId: null,
    correlationId: null,
    metadata: {},
    type: "thread.created",
    payload: {
      threadId,
      projectId: PROJECT_ID,
      title: "New thread",
      modelSelection: {
        provider: "codex",
        model: "gpt-5",
      },
      runtimeMode: "full-access",
      interactionMode: "default",
      branch: "main",
      worktreePath: null,
      createdAt: NOW_ISO,
      updatedAt: NOW_ISO,
    },
  };
}

function createProjectBootstrapStateSetEvent(
  bootstrapState: "bootstrapping" | "ready",
  sequence: number,
): OrchestrationEvent {
  return {
    sequence,
    eventId: EventId.makeUnsafe(`event-project-bootstrap-state-${sequence}`),
    aggregateKind: "project",
    aggregateId: PROJECT_ID,
    occurredAt: NOW_ISO,
    commandId: null,
    causationEventId: null,
    correlationId: null,
    metadata: {},
    type: "project.bootstrap-state-set",
    payload: {
      projectId: PROJECT_ID,
      bootstrapState,
      updatedAt: NOW_ISO,
    },
  };
}

function sendOrchestrationDomainEvent(event: OrchestrationEvent): void {
  rpcHarness.emitStreamValue(WS_METHODS.subscribeOrchestrationDomainEvents, event);
}

async function waitForWsClient(): Promise<void> {
  await vi.waitFor(
    () => {
      expect(
        wsRequests.some(
          (request) => request._tag === WS_METHODS.subscribeOrchestrationDomainEvents,
        ),
      ).toBe(true);
      expect(
        wsRequests.some((request) => request._tag === WS_METHODS.subscribeServerLifecycle),
      ).toBe(true);
      expect(wsRequests.some((request) => request._tag === WS_METHODS.subscribeServerConfig)).toBe(
        true,
      );
    },
    { timeout: 8_000, interval: 16 },
  );
}

async function waitForAppBootstrap(): Promise<void> {
  await vi.waitFor(
    () => {
      expect(getServerConfig()).not.toBeNull();
      expect(useStore.getState().bootstrapComplete).toBe(true);
    },
    { timeout: 8_000, interval: 16 },
  );
}

async function promoteDraftThreadViaDomainEvent(threadId: ThreadId): Promise<void> {
  await waitForWsClient();
  fixture.snapshot = addThreadToSnapshot(fixture.snapshot, threadId);
  sendOrchestrationDomainEvent(
    createThreadCreatedEvent(threadId, fixture.snapshot.snapshotSequence),
  );
  await vi.waitFor(
    () => {
      expect(useComposerDraftStore.getState().draftThreadsByThreadId[threadId]).toBeUndefined();
    },
    { timeout: 8_000, interval: 16 },
  );
}

function createDraftOnlySnapshot(): OrchestrationReadModel {
  const snapshot = createSnapshotForTargetUser({
    targetMessageId: "msg-user-draft-target" as MessageId,
    targetText: "draft thread",
  });
  return {
    ...snapshot,
    threads: [],
  };
}

function withProjectScripts(
  snapshot: OrchestrationReadModel,
  scripts: OrchestrationReadModel["projects"][number]["scripts"],
): OrchestrationReadModel {
  return {
    ...snapshot,
    projects: snapshot.projects.map((project) =>
      project.id === PROJECT_ID ? { ...project, scripts: Array.from(scripts) } : project,
    ),
  };
}

function createSnapshotWithLongProposedPlan(): OrchestrationReadModel {
  const snapshot = createSnapshotForTargetUser({
    targetMessageId: "msg-user-plan-target" as MessageId,
    targetText: "plan thread",
  });
  const planMarkdown = [
    "# Ship plan mode follow-up",
    "",
    "- Step 1: capture the thread-open trace",
    "- Step 2: identify the main-thread bottleneck",
    "- Step 3: keep collapsed cards cheap",
    "- Step 4: render the full markdown only on demand",
    "- Step 5: preserve export and save actions",
    "- Step 6: add regression coverage",
    "- Step 7: verify route transitions stay responsive",
    "- Step 8: confirm no server-side work changed",
    "- Step 9: confirm short plans still render normally",
    "- Step 10: confirm long plans stay collapsed by default",
    "- Step 11: confirm preview text is still useful",
    "- Step 12: confirm plan follow-up flow still works",
    "- Step 13: confirm timeline virtualization still behaves",
    "- Step 14: confirm theme styling still looks correct",
    "- Step 15: confirm save dialog behavior is unchanged",
    "- Step 16: confirm download behavior is unchanged",
    "- Step 17: confirm code fences do not parse until expand",
    "- Step 18: confirm preview truncation ends cleanly",
    "- Step 19: confirm markdown links still open in editor after expand",
    "- Step 20: confirm deep hidden detail only appears after expand",
    "",
    "```ts",
    "export const hiddenPlanImplementationDetail = 'deep hidden detail only after expand';",
    "```",
  ].join("\n");

  return {
    ...snapshot,
    threads: snapshot.threads.map((thread) =>
      thread.id === THREAD_ID
        ? Object.assign({}, thread, {
            proposedPlans: [
              {
                id: "plan-browser-test",
                turnId: null,
                planMarkdown,
                implementedAt: null,
                implementationThreadId: null,
                createdAt: isoAt(1_000),
                updatedAt: isoAt(1_001),
              },
            ],
            updatedAt: isoAt(1_001),
          })
        : thread,
    ),
  };
}

function createSnapshotWithPendingUserInput(): OrchestrationReadModel {
  const snapshot = createSnapshotForTargetUser({
    targetMessageId: "msg-user-pending-input-target" as MessageId,
    targetText: "question thread",
  });

  return {
    ...snapshot,
    threads: snapshot.threads.map((thread) =>
      thread.id === THREAD_ID
        ? Object.assign({}, thread, {
            interactionMode: "plan",
            activities: [
              {
                id: EventId.makeUnsafe("activity-user-input-requested"),
                tone: "info",
                kind: "user-input.requested",
                summary: "User input requested",
                payload: {
                  requestId: "req-browser-user-input",
                  questions: [
                    {
                      id: "scope",
                      header: "Scope",
                      question: "What should this change cover?",
                      options: [
                        {
                          label: "Tight",
                          description: "Touch only the footer layout logic.",
                        },
                        {
                          label: "Broad",
                          description: "Also adjust the related composer controls.",
                        },
                      ],
                    },
                    {
                      id: "risk",
                      header: "Risk",
                      question: "How aggressive should the imaginary plan be?",
                      options: [
                        {
                          label: "Conservative",
                          description: "Favor reliability and low-risk changes.",
                        },
                        {
                          label: "Balanced",
                          description: "Mix quick wins with one structural improvement.",
                        },
                      ],
                    },
                  ],
                },
                turnId: null,
                sequence: 1,
                createdAt: isoAt(1_000),
              },
            ],
            updatedAt: isoAt(1_000),
          })
        : thread,
    ),
  };
}

function createSnapshotWithPlanFollowUpPrompt(): OrchestrationReadModel {
  const snapshot = createSnapshotForTargetUser({
    targetMessageId: "msg-user-plan-follow-up-target" as MessageId,
    targetText: "plan follow-up thread",
  });

  return {
    ...snapshot,
    threads: snapshot.threads.map((thread) =>
      thread.id === THREAD_ID
        ? Object.assign({}, thread, {
            interactionMode: "plan",
            latestTurn: {
              turnId: "turn-plan-follow-up" as TurnId,
              state: "completed",
              requestedAt: isoAt(1_000),
              startedAt: isoAt(1_001),
              completedAt: isoAt(1_010),
              assistantMessageId: null,
            },
            proposedPlans: [
              {
                id: "plan-follow-up-browser-test",
                turnId: "turn-plan-follow-up" as TurnId,
                planMarkdown: "# Follow-up plan\n\n- Keep the composer footer stable on resize.",
                implementedAt: null,
                implementationThreadId: null,
                createdAt: isoAt(1_002),
                updatedAt: isoAt(1_003),
              },
            ],
            session: {
              ...thread.session,
              status: "ready",
              updatedAt: isoAt(1_010),
            },
            updatedAt: isoAt(1_010),
          })
        : thread,
    ),
  };
}

function resolveWsRpc(body: NormalizedWsRpcRequestBody): unknown {
  const customResult = customWsRpcResolver?.(body);
  if (customResult !== undefined) {
    return customResult;
  }
  const tag = body._tag;
  if (tag === ORCHESTRATION_WS_METHODS.getSnapshot) {
    return fixture.snapshot;
  }
  if (tag === WS_METHODS.serverGetConfig) {
    return fixture.serverConfig;
  }
  if (tag === WS_METHODS.gitListBranches) {
    return {
      isRepo: true,
      hasOriginRemote: true,
      nextCursor: null,
      totalCount: 1,
      branches: [
        {
          name: "main",
          current: true,
          isDefault: true,
          worktreePath: null,
        },
      ],
    };
  }
  if (tag === WS_METHODS.projectsSearchEntries) {
    return {
      entries: [],
      truncated: false,
    };
  }
  if (tag === WS_METHODS.projectsListDirectory) {
    return {
      entries: [],
      truncated: false,
    };
  }
  if (tag === WS_METHODS.projectsReadFile) {
    return {
      relativePath: typeof body.relativePath === "string" ? body.relativePath : "",
      contents: "# Room File\n",
      sizeBytes: 12,
      mtimeMs: 1,
    };
  }
  if (tag === WS_METHODS.projectsReadTabularFile) {
    return {
      relativePath: typeof body.relativePath === "string" ? body.relativePath : "",
      previewKind: "delimited-grid",
      kind: "csv",
      delimiter: ",",
      sizeBytes: 12,
      mtimeMs: 1,
      capabilities: { canEditInRoom: true },
      sheets: [
        {
          name: "Sheet1",
          rowCount: 1,
          columnCount: 2,
          data: [["name", "owner"]],
          merges: [],
          hiddenRows: [],
          hiddenColumns: [],
          cellMeta: [],
        },
      ],
    };
  }
  if (tag === WS_METHODS.projectsReadTabularMedia) {
    return {
      mediaId: typeof body.mediaId === "string" ? body.mediaId : "0",
      mimeType: "image/png",
      contentBase64: ONE_PIXEL_PNG_BASE64,
    };
  }
  if (tag === WS_METHODS.projectsWriteFile) {
    return {
      relativePath: typeof body.relativePath === "string" ? body.relativePath : "",
    };
  }
  if (tag === WS_METHODS.projectsWriteTabularFile) {
    return {
      relativePath: typeof body.relativePath === "string" ? body.relativePath : "",
    };
  }
  if (tag === WS_METHODS.shellOpenInEditor) {
    return null;
  }
  if (tag === WS_METHODS.shellOpenInProjectApp) {
    return null;
  }
  if (tag === WS_METHODS.shellRevealInFileManager) {
    return null;
  }
  if (tag === WS_METHODS.terminalOpen) {
    return {
      threadId: typeof body.threadId === "string" ? body.threadId : THREAD_ID,
      terminalId: typeof body.terminalId === "string" ? body.terminalId : "default",
      cwd: typeof body.cwd === "string" ? body.cwd : "/repo/project",
      worktreePath:
        typeof body.worktreePath === "string"
          ? body.worktreePath
          : body.worktreePath === null
            ? null
            : null,
      status: "running",
      pid: 123,
      history: "",
      exitCode: null,
      exitSignal: null,
      updatedAt: NOW_ISO,
    };
  }
  return {};
}

const worker = setupWorker(
  wsLink.addEventListener("connection", ({ client }) => {
    void rpcHarness.connect(client);
    client.addEventListener("message", (event) => {
      const rawData = event.data;
      if (typeof rawData !== "string") return;
      void rpcHarness.onMessage(rawData);
    });
  }),
  http.get("*/attachments/:attachmentId", () =>
    HttpResponse.text(ATTACHMENT_SVG, {
      headers: {
        "Content-Type": "image/svg+xml",
      },
    }),
  ),
  http.get("*/api/project-favicon", () => new HttpResponse(null, { status: 204 })),
);

async function nextFrame(): Promise<void> {
  await new Promise<void>((resolve) => {
    window.requestAnimationFrame(() => resolve());
  });
}

async function waitForLayout(): Promise<void> {
  await nextFrame();
  await nextFrame();
  await nextFrame();
}

async function setViewport(viewport: ViewportSpec): Promise<void> {
  await page.viewport(viewport.width, viewport.height);
  await waitForLayout();
}

async function waitForProductionStyles(): Promise<void> {
  await vi.waitFor(
    () => {
      expect(
        getComputedStyle(document.documentElement).getPropertyValue("--background").trim(),
      ).not.toBe("");
      expect(getComputedStyle(document.body).marginTop).toBe("0px");
    },
    {
      timeout: 4_000,
      interval: 16,
    },
  );
}

async function waitForElement<T extends Element>(
  query: () => T | null,
  errorMessage: string,
): Promise<T> {
  let element: T | null = null;
  await vi.waitFor(
    () => {
      element = query();
      expect(element, errorMessage).toBeTruthy();
    },
    {
      timeout: 8_000,
      interval: 16,
    },
  );
  if (!element) {
    throw new Error(errorMessage);
  }
  return element;
}

async function waitForURL(
  router: ReturnType<typeof getRouter>,
  predicate: (pathname: string) => boolean,
  errorMessage: string,
): Promise<string> {
  let pathname = "";
  await vi.waitFor(
    () => {
      pathname = router.state.location.pathname;
      expect(predicate(pathname), errorMessage).toBe(true);
    },
    { timeout: 8_000, interval: 16 },
  );
  return pathname;
}

async function waitForComposerEditor(): Promise<HTMLElement> {
  return waitForElement(
    () => document.querySelector<HTMLElement>('[contenteditable="true"]'),
    "Unable to find composer editor.",
  );
}

function roomSpreadsheetGridText(): string {
  return (
    document.querySelector<HTMLElement>('[aria-label="Room spreadsheet grid"]')?.textContent ?? ""
  );
}

type TestSpreadsheetGridElement = HTMLElement & {
  __roomHotInstance?: {
    getData: () => unknown[][];
    getCellMeta?: (row: number, col: number) => { comment?: { value?: string } | undefined };
    render: () => void;
    selectCell?: (row: number, col: number) => void;
    setDataAtCell: (row: number, col: number, value: unknown, source?: string) => void;
  };
};

async function waitForSpreadsheetCell(text: string): Promise<HTMLElement> {
  return waitForElement(
    () =>
      Array.from(
        document.querySelectorAll<HTMLElement>('[aria-label="Room spreadsheet grid"] td'),
      ).find((element) => element.textContent?.trim() === text) ?? null,
    `Unable to find spreadsheet cell with text "${text}".`,
  );
}

async function editSpreadsheetCell(currentText: string, nextText: string): Promise<void> {
  await waitForSpreadsheetCell(currentText);
  const grid = await waitForElement(
    () =>
      document.querySelector<TestSpreadsheetGridElement>('[aria-label="Room spreadsheet grid"]'),
    "Unable to find the Room spreadsheet grid.",
  );

  await vi.waitFor(
    () => {
      expect(grid.__roomHotInstance).toBeTruthy();
    },
    { timeout: 8_000, interval: 16 },
  );

  const hotInstance = grid.__roomHotInstance;
  if (!hotInstance) {
    throw new Error("Unable to access the Room spreadsheet instance.");
  }

  const coordinates = hotInstance.getData().reduce<{ row: number; col: number } | null>(
    (found, row, rowIndex) =>
      found ??
      row.reduce<{ row: number; col: number } | null>((cellFound, value, colIndex) => {
        if (cellFound) {
          return cellFound;
        }
        return String(value ?? "").trim() === currentText ? { row: rowIndex, col: colIndex } : null;
      }, null),
    null,
  );

  expect(coordinates).toBeTruthy();
  if (!coordinates) {
    throw new Error(`Unable to find spreadsheet cell "${currentText}" in grid data.`);
  }

  hotInstance.selectCell?.(coordinates.row, coordinates.col);
  hotInstance.setDataAtCell(coordinates.row, coordinates.col, nextText, "edit");
  hotInstance.render();

  await vi.waitFor(
    () => {
      expect(roomSpreadsheetGridText()).toContain(nextText);
      expect(document.body.textContent).toContain("Unsaved");
    },
    { timeout: 8_000, interval: 16 },
  );
}

async function waitForComposerMenuItem(itemId: string): Promise<HTMLElement> {
  return waitForElement(
    () => document.querySelector<HTMLElement>(`[data-composer-item-id="${itemId}"]`),
    `Unable to find composer menu item "${itemId}".`,
  );
}

async function waitForSendButton(): Promise<HTMLButtonElement> {
  return waitForElement(
    () => document.querySelector<HTMLButtonElement>('button[aria-label="Send message"]'),
    "Unable to find send button.",
  );
}

function findComposerProviderModelPicker(): HTMLButtonElement | null {
  return document.querySelector<HTMLButtonElement>('[data-chat-provider-model-picker="true"]');
}

function findButtonByText(text: string): HTMLButtonElement | null {
  return (Array.from(document.querySelectorAll("button")).find(
    (button) => button.textContent?.trim() === text,
  ) ?? null) as HTMLButtonElement | null;
}

async function waitForButtonByText(text: string): Promise<HTMLButtonElement> {
  return waitForElement(() => findButtonByText(text), `Unable to find "${text}" button.`);
}

function findButtonContainingText(text: string): HTMLButtonElement | null {
  return (Array.from(document.querySelectorAll("button")).find((button) =>
    button.textContent?.includes(text),
  ) ?? null) as HTMLButtonElement | null;
}

async function waitForButtonContainingText(text: string): Promise<HTMLButtonElement> {
  return waitForElement(
    () => findButtonContainingText(text),
    `Unable to find button containing "${text}".`,
  );
}

async function waitForSurfaceToggleButton(label: "Agent" | "Room"): Promise<HTMLButtonElement> {
  return waitForButtonByText(label);
}

async function waitForAgentViewSection(): Promise<HTMLElement> {
  return waitForElement(
    () => document.querySelector<HTMLElement>('[aria-label="Agent view"]'),
    "Unable to find Agent view section.",
  );
}

async function waitForRoomViewSection(): Promise<HTMLElement> {
  return waitForElement(
    () => document.querySelector<HTMLElement>('[aria-label="Room view"]'),
    "Unable to find Room view section.",
  );
}

async function expectComposerActionsContained(): Promise<void> {
  const footer = await waitForElement(
    () => document.querySelector<HTMLElement>('[data-chat-composer-footer="true"]'),
    "Unable to find composer footer.",
  );
  const actions = await waitForElement(
    () => document.querySelector<HTMLElement>('[data-chat-composer-actions="right"]'),
    "Unable to find composer actions container.",
  );

  await vi.waitFor(
    () => {
      const footerRect = footer.getBoundingClientRect();
      const actionButtons = Array.from(actions.querySelectorAll<HTMLButtonElement>("button"));
      expect(actionButtons.length).toBeGreaterThanOrEqual(1);

      const buttonRects = actionButtons.map((button) => button.getBoundingClientRect());
      const firstTop = buttonRects[0]?.top ?? 0;

      for (const rect of buttonRects) {
        expect(rect.right).toBeLessThanOrEqual(footerRect.right + 0.5);
        expect(rect.bottom).toBeLessThanOrEqual(footerRect.bottom + 0.5);
        expect(Math.abs(rect.top - firstTop)).toBeLessThanOrEqual(1.5);
      }
    },
    { timeout: 8_000, interval: 16 },
  );
}

async function waitForInteractionModeButton(
  expectedLabel: "Build" | "Plan",
): Promise<HTMLButtonElement> {
  return waitForElement(
    () =>
      Array.from(document.querySelectorAll("button")).find(
        (button) => button.textContent?.trim() === expectedLabel,
      ) as HTMLButtonElement | null,
    `Unable to find ${expectedLabel} interaction mode button.`,
  );
}

async function waitForServerConfigToApply(): Promise<void> {
  await vi.waitFor(
    () => {
      expect(wsRequests.some((request) => request._tag === WS_METHODS.subscribeServerConfig)).toBe(
        true,
      );
    },
    { timeout: 8_000, interval: 16 },
  );
  await waitForLayout();
}

function dispatchChatNewShortcut(): void {
  const useMetaForMod = isMacPlatform(navigator.platform);
  window.dispatchEvent(
    new KeyboardEvent("keydown", {
      key: "o",
      shiftKey: true,
      metaKey: useMetaForMod,
      ctrlKey: !useMetaForMod,
      bubbles: true,
      cancelable: true,
    }),
  );
}

async function triggerChatNewShortcutUntilPath(
  router: ReturnType<typeof getRouter>,
  predicate: (pathname: string) => boolean,
  errorMessage: string,
): Promise<string> {
  let pathname = router.state.location.pathname;
  const deadline = Date.now() + 8_000;
  while (Date.now() < deadline) {
    dispatchChatNewShortcut();
    await waitForLayout();
    pathname = router.state.location.pathname;
    if (predicate(pathname)) {
      return pathname;
    }
  }
  throw new Error(`${errorMessage} Last path: ${pathname}`);
}

async function waitForNewThreadShortcutLabel(): Promise<void> {
  const newThreadButton = page.getByTestId("new-thread-button");
  await expect.element(newThreadButton).toBeInTheDocument();
  await newThreadButton.hover();
  const shortcutLabel = isMacPlatform(navigator.platform)
    ? "New thread (⇧⌘O)"
    : "New thread (Ctrl+Shift+O)";
  await expect.element(page.getByText(shortcutLabel)).toBeInTheDocument();
}

async function waitForImagesToLoad(scope: ParentNode): Promise<void> {
  const images = Array.from(scope.querySelectorAll("img"));
  if (images.length === 0) {
    return;
  }
  await Promise.all(
    images.map(
      (image) =>
        new Promise<void>((resolve) => {
          if (image.complete) {
            resolve();
            return;
          }
          image.addEventListener("load", () => resolve(), { once: true });
          image.addEventListener("error", () => resolve(), { once: true });
        }),
    ),
  );
  await waitForLayout();
}

async function measureUserRow(options: {
  host: HTMLElement;
  targetMessageId: MessageId;
}): Promise<UserRowMeasurement> {
  const { host, targetMessageId } = options;
  const rowSelector = `[data-message-id="${targetMessageId}"][data-message-role="user"]`;

  const scrollContainer = await waitForElement(
    () => host.querySelector<HTMLDivElement>("div.overflow-y-auto.overscroll-y-contain"),
    "Unable to find ChatView message scroll container.",
  );

  let row: HTMLElement | null = null;
  await vi.waitFor(
    async () => {
      scrollContainer.scrollTop = 0;
      scrollContainer.dispatchEvent(new Event("scroll"));
      await waitForLayout();
      row = host.querySelector<HTMLElement>(rowSelector);
      expect(row, "Unable to locate targeted user message row.").toBeTruthy();
    },
    {
      timeout: 8_000,
      interval: 16,
    },
  );

  await waitForImagesToLoad(row!);
  scrollContainer.scrollTop = 0;
  scrollContainer.dispatchEvent(new Event("scroll"));
  await nextFrame();

  const timelineRoot =
    row!.closest<HTMLElement>('[data-timeline-root="true"]') ??
    host.querySelector<HTMLElement>('[data-timeline-root="true"]');
  if (!(timelineRoot instanceof HTMLElement)) {
    throw new Error("Unable to locate timeline root container.");
  }

  let timelineWidthMeasuredPx = 0;
  let measuredRowHeightPx = 0;
  let renderedInVirtualizedRegion = false;
  await vi.waitFor(
    async () => {
      scrollContainer.scrollTop = 0;
      scrollContainer.dispatchEvent(new Event("scroll"));
      await nextFrame();
      const measuredRow = host.querySelector<HTMLElement>(rowSelector);
      expect(measuredRow, "Unable to measure targeted user row height.").toBeTruthy();
      timelineWidthMeasuredPx = timelineRoot.getBoundingClientRect().width;
      measuredRowHeightPx = measuredRow!.getBoundingClientRect().height;
      renderedInVirtualizedRegion = measuredRow!.closest("[data-index]") instanceof HTMLElement;
      expect(timelineWidthMeasuredPx, "Unable to measure timeline width.").toBeGreaterThan(0);
      expect(measuredRowHeightPx, "Unable to measure targeted user row height.").toBeGreaterThan(0);
    },
    {
      timeout: 4_000,
      interval: 16,
    },
  );

  return { measuredRowHeightPx, timelineWidthMeasuredPx, renderedInVirtualizedRegion };
}

async function mountChatView(options: {
  viewport: ViewportSpec;
  snapshot: OrchestrationReadModel;
  initialEntry?: string;
  configureFixture?: (fixture: TestFixture) => void;
  resolveRpc?: (body: NormalizedWsRpcRequestBody) => unknown | undefined;
}): Promise<MountedChatView> {
  fixture = buildFixture(options.snapshot);
  options.configureFixture?.(fixture);
  customWsRpcResolver = options.resolveRpc ?? null;
  await setViewport(options.viewport);
  await waitForProductionStyles();

  const host = document.createElement("div");
  host.style.position = "fixed";
  host.style.top = "0";
  host.style.left = "0";
  host.style.width = "100vw";
  host.style.height = "100vh";
  host.style.display = "grid";
  host.style.overflow = "hidden";
  document.body.append(host);

  const router = getRouter(
    createMemoryHistory({
      initialEntries: [options.initialEntry ?? `/${THREAD_ID}`],
    }),
  );

  const screen = await render(
    <AppAtomRegistryProvider>
      <RouterProvider router={router} />
    </AppAtomRegistryProvider>,
    {
      container: host,
    },
  );

  await waitForWsClient();
  await waitForAppBootstrap();
  await waitForLayout();

  const cleanup = async () => {
    customWsRpcResolver = null;
    await screen.unmount();
    host.remove();
  };

  return {
    [Symbol.asyncDispose]: cleanup,
    cleanup,
    measureUserRow: async (targetMessageId: MessageId) => measureUserRow({ host, targetMessageId }),
    setViewport: async (viewport: ViewportSpec) => {
      await setViewport(viewport);
      await waitForProductionStyles();
    },
    setContainerSize: async (viewport) => {
      host.style.width = `${viewport.width}px`;
      host.style.height = `${viewport.height}px`;
      await waitForLayout();
    },
    router,
  };
}

async function measureUserRowAtViewport(options: {
  snapshot: OrchestrationReadModel;
  targetMessageId: MessageId;
  viewport: ViewportSpec;
}): Promise<UserRowMeasurement> {
  const mounted = await mountChatView({
    viewport: options.viewport,
    snapshot: options.snapshot,
  });

  try {
    return await mounted.measureUserRow(options.targetMessageId);
  } finally {
    await mounted.cleanup();
  }
}

describe("ChatView timeline estimator parity (full app)", () => {
  beforeAll(async () => {
    fixture = buildFixture(
      createSnapshotForTargetUser({
        targetMessageId: "msg-user-bootstrap" as MessageId,
        targetText: "bootstrap",
      }),
    );
    await worker.start({
      onUnhandledRequest: "bypass",
      quiet: true,
      serviceWorker: {
        url: "/mockServiceWorker.js",
      },
    });
  });

  afterAll(async () => {
    await rpcHarness.disconnect();
    await worker.stop();
  });

  beforeEach(async () => {
    await rpcHarness.reset({
      resolveUnary: resolveWsRpc,
      getInitialStreamValues: (request) => {
        if (request._tag === WS_METHODS.subscribeServerLifecycle) {
          return [
            {
              version: 1,
              sequence: 1,
              type: "welcome",
              payload: fixture.welcome,
            },
          ];
        }
        if (request._tag === WS_METHODS.subscribeServerConfig) {
          return [
            {
              version: 1,
              type: "snapshot",
              config: fixture.serverConfig,
            },
          ];
        }
        return [];
      },
    });
    await __resetNativeApiForTests();
    await setViewport(DEFAULT_VIEWPORT);
    localStorage.clear();
    document.body.innerHTML = "";
    wsRequests.length = 0;
    customWsRpcResolver = null;
    useComposerDraftStore.setState({
      draftsByThreadId: {},
      draftThreadsByThreadId: {},
      projectDraftThreadIdByProjectId: {},
      stickyModelSelectionByProvider: {},
      stickyActiveProvider: null,
    });
    useStore.setState({
      projects: [],
      threads: [],
      bootstrapComplete: false,
    });
    useTerminalStateStore.persist.clearStorage();
    useTerminalStateStore.setState({
      terminalStateByThreadId: {},
      terminalLaunchContextByThreadId: {},
      terminalEventEntriesByKey: {},
      nextTerminalEventId: 1,
    });
  });

  afterEach(() => {
    customWsRpcResolver = null;
    document.body.innerHTML = "";
  });

  it.each(TEXT_VIEWPORT_MATRIX)(
    "keeps long user message estimate close at the $name viewport",
    async (viewport) => {
      const userText = "x".repeat(3_200);
      const targetMessageId = `msg-user-target-long-${viewport.name}` as MessageId;
      const mounted = await mountChatView({
        viewport,
        snapshot: createSnapshotForTargetUser({
          targetMessageId,
          targetText: userText,
        }),
      });

      try {
        const { measuredRowHeightPx, timelineWidthMeasuredPx, renderedInVirtualizedRegion } =
          await mounted.measureUserRow(targetMessageId);

        expect(renderedInVirtualizedRegion).toBe(true);

        const estimatedHeightPx = estimateTimelineMessageHeight(
          { role: "user", text: userText, attachments: [] },
          { timelineWidthPx: timelineWidthMeasuredPx },
        );

        expect(Math.abs(measuredRowHeightPx - estimatedHeightPx)).toBeLessThanOrEqual(
          viewport.textTolerancePx,
        );
      } finally {
        await mounted.cleanup();
      }
    },
  );

  it("tracks wrapping parity while resizing an existing ChatView across the viewport matrix", async () => {
    const userText = "x".repeat(3_200);
    const targetMessageId = "msg-user-target-resize" as MessageId;
    const mounted = await mountChatView({
      viewport: TEXT_VIEWPORT_MATRIX[0],
      snapshot: createSnapshotForTargetUser({
        targetMessageId,
        targetText: userText,
      }),
    });

    try {
      const measurements: Array<
        UserRowMeasurement & { viewport: ViewportSpec; estimatedHeightPx: number }
      > = [];

      for (const viewport of TEXT_VIEWPORT_MATRIX) {
        await mounted.setViewport(viewport);
        const measurement = await mounted.measureUserRow(targetMessageId);
        const estimatedHeightPx = estimateTimelineMessageHeight(
          { role: "user", text: userText, attachments: [] },
          { timelineWidthPx: measurement.timelineWidthMeasuredPx },
        );

        expect(measurement.renderedInVirtualizedRegion).toBe(true);
        expect(Math.abs(measurement.measuredRowHeightPx - estimatedHeightPx)).toBeLessThanOrEqual(
          viewport.textTolerancePx,
        );
        measurements.push({ ...measurement, viewport, estimatedHeightPx });
      }

      expect(
        new Set(measurements.map((measurement) => Math.round(measurement.timelineWidthMeasuredPx)))
          .size,
      ).toBeGreaterThanOrEqual(3);

      const byMeasuredWidth = measurements.toSorted(
        (left, right) => left.timelineWidthMeasuredPx - right.timelineWidthMeasuredPx,
      );
      const narrowest = byMeasuredWidth[0]!;
      const widest = byMeasuredWidth.at(-1)!;
      expect(narrowest.timelineWidthMeasuredPx).toBeLessThan(widest.timelineWidthMeasuredPx);
      expect(narrowest.measuredRowHeightPx).toBeGreaterThan(widest.measuredRowHeightPx);
      expect(narrowest.estimatedHeightPx).toBeGreaterThan(widest.estimatedHeightPx);
    } finally {
      await mounted.cleanup();
    }
  });

  it("tracks additional rendered wrapping when ChatView width narrows between desktop and mobile viewports", async () => {
    const userText = "x".repeat(2_400);
    const targetMessageId = "msg-user-target-wrap" as MessageId;
    const snapshot = createSnapshotForTargetUser({
      targetMessageId,
      targetText: userText,
    });
    const desktopMeasurement = await measureUserRowAtViewport({
      viewport: TEXT_VIEWPORT_MATRIX[0],
      snapshot,
      targetMessageId,
    });
    const mobileMeasurement = await measureUserRowAtViewport({
      viewport: TEXT_VIEWPORT_MATRIX[2],
      snapshot,
      targetMessageId,
    });

    const estimatedDesktopPx = estimateTimelineMessageHeight(
      { role: "user", text: userText, attachments: [] },
      { timelineWidthPx: desktopMeasurement.timelineWidthMeasuredPx },
    );
    const estimatedMobilePx = estimateTimelineMessageHeight(
      { role: "user", text: userText, attachments: [] },
      { timelineWidthPx: mobileMeasurement.timelineWidthMeasuredPx },
    );

    const measuredDeltaPx =
      mobileMeasurement.measuredRowHeightPx - desktopMeasurement.measuredRowHeightPx;
    const estimatedDeltaPx = estimatedMobilePx - estimatedDesktopPx;
    expect(measuredDeltaPx).toBeGreaterThan(0);
    expect(estimatedDeltaPx).toBeGreaterThan(0);
    const ratio = estimatedDeltaPx / measuredDeltaPx;
    expect(ratio).toBeGreaterThan(0.65);
    expect(ratio).toBeLessThan(1.35);
  });

  it.each(ATTACHMENT_VIEWPORT_MATRIX)(
    "keeps user attachment estimate close at the $name viewport",
    async (viewport) => {
      const targetMessageId = `msg-user-target-attachments-${viewport.name}` as MessageId;
      const userText = "message with image attachments";
      const mounted = await mountChatView({
        viewport,
        snapshot: createSnapshotForTargetUser({
          targetMessageId,
          targetText: userText,
          targetAttachmentCount: 2,
        }),
      });

      try {
        const { measuredRowHeightPx, timelineWidthMeasuredPx, renderedInVirtualizedRegion } =
          await mounted.measureUserRow(targetMessageId);

        expect(renderedInVirtualizedRegion).toBe(true);

        const estimatedHeightPx = estimateTimelineMessageHeight(
          {
            role: "user",
            text: userText,
            attachments: [{ id: "attachment-1" }, { id: "attachment-2" }],
          },
          { timelineWidthPx: timelineWidthMeasuredPx },
        );

        expect(Math.abs(measuredRowHeightPx - estimatedHeightPx)).toBeLessThanOrEqual(
          viewport.attachmentTolerancePx,
        );
      } finally {
        await mounted.cleanup();
      }
    },
  );

  it("shows an explicit empty state for projects without threads in the sidebar", async () => {
    const mounted = await mountChatView({
      viewport: DEFAULT_VIEWPORT,
      snapshot: createDraftOnlySnapshot(),
    });

    try {
      await expect.element(page.getByText("No threads yet")).toBeInTheDocument();
    } finally {
      await mounted.cleanup();
    }
  });

  it("renders the agent surface by default with breadcrumb header and no legacy header actions", async () => {
    const mounted = await mountChatView({
      viewport: DEFAULT_VIEWPORT,
      snapshot: createSnapshotForTargetUser({
        targetMessageId: "msg-user-agent-view-target" as MessageId,
        targetText: "agent view target",
      }),
    });

    try {
      const agentView = await waitForAgentViewSection();
      const roomView = await waitForRoomViewSection();
      const breadcrumbRoot = await waitForElement(
        () => document.querySelector<HTMLElement>('[data-thread-breadcrumbs="true"]'),
        "Unable to find thread breadcrumbs.",
      );
      const switcher = await waitForElement(
        () => document.querySelector<HTMLElement>('[data-thread-surface-switcher="true"]'),
        "Unable to find thread surface switcher.",
      );

      await vi.waitFor(
        () => {
          expect(agentView.hidden).toBe(false);
          expect(roomView.hidden).toBe(true);
          expect(breadcrumbRoot.textContent).toContain("Project");
          expect(breadcrumbRoot.textContent).toContain("Browser test thread");
          expect(switcher.textContent).toContain("Agent");
          expect(switcher.textContent).toContain("Room");
          expect(document.querySelector('button[aria-label="Toggle terminal drawer"]')).toBeNull();
          expect(document.querySelector('button[aria-label="Toggle diff panel"]')).toBeNull();
          expect(document.querySelector('button[aria-label="Copy options"]')).toBeNull();
        },
        { timeout: 8_000, interval: 16 },
      );
    } finally {
      await mounted.cleanup();
    }
  });

  it("renders the room surface when view=room is set on first load", async () => {
    const mounted = await mountChatView({
      viewport: DEFAULT_VIEWPORT,
      snapshot: createSnapshotForTargetUser({
        targetMessageId: "msg-user-room-view-target" as MessageId,
        targetText: "room view target",
      }),
      initialEntry: `/${THREAD_ID}?view=room`,
    });

    try {
      const agentView = await waitForAgentViewSection();
      const roomView = await waitForRoomViewSection();

      await vi.waitFor(
        () => {
          expect(agentView.hidden).toBe(true);
          expect(roomView.hidden).toBe(false);
          expect(document.body.textContent).toContain("ROOM FOLDER");
          expect(
            document.querySelector('button[aria-label="Resize room folder sidebar"]'),
          ).not.toBeNull();
        },
        { timeout: 8_000, interval: 16 },
      );
    } finally {
      await mounted.cleanup();
    }
  });

  it("renders workspace root entries in the room sidebar", async () => {
    const mounted = await mountChatView({
      viewport: DEFAULT_VIEWPORT,
      snapshot: createSnapshotForTargetUser({
        targetMessageId: "msg-user-room-tree-root" as MessageId,
        targetText: "room tree root",
      }),
      initialEntry: `/${THREAD_ID}?view=room`,
      resolveRpc: (body) => {
        if (body._tag !== WS_METHODS.projectsListDirectory) {
          return undefined;
        }
        if (body.directoryPath !== undefined) {
          return {
            entries: [],
            truncated: false,
          };
        }
        return {
          entries: [
            { path: "src", kind: "directory" as const },
            { path: "README.md", kind: "file" as const },
          ],
          truncated: false,
        };
      },
    });

    try {
      await vi.waitFor(
        () => {
          const roomView = document.querySelector<HTMLElement>('[aria-label="Room view"]');
          expect(roomView?.hidden).toBe(false);
          expect(document.body.textContent).toContain("src");
          expect(document.body.textContent).toContain("README.md");
        },
        { timeout: 8_000, interval: 16 },
      );
    } finally {
      await mounted.cleanup();
    }
  });

  it("loads nested room tree entries when a folder is expanded", async () => {
    const mounted = await mountChatView({
      viewport: DEFAULT_VIEWPORT,
      snapshot: createSnapshotForTargetUser({
        targetMessageId: "msg-user-room-tree-expand" as MessageId,
        targetText: "room tree expand",
      }),
      initialEntry: `/${THREAD_ID}?view=room`,
      resolveRpc: (body) => {
        if (body._tag !== WS_METHODS.projectsListDirectory) {
          return undefined;
        }
        if (body.directoryPath === "src") {
          return {
            entries: [
              { path: "src/components", kind: "directory" as const, parentPath: "src" },
              { path: "src/index.ts", kind: "file" as const, parentPath: "src" },
            ],
            truncated: false,
          };
        }
        return {
          entries: [
            { path: "src", kind: "directory" as const },
            { path: "package.json", kind: "file" as const },
          ],
          truncated: false,
        };
      },
    });

    try {
      await vi.waitFor(
        () => {
          expect(document.body.textContent).toContain("src");
        },
        { timeout: 8_000, interval: 16 },
      );

      const srcFolderItem = Array.from(
        document.querySelectorAll<HTMLElement>('[role="treeitem"][aria-expanded]'),
      ).find((element) => element.textContent?.includes("src"));
      expect(srcFolderItem).not.toBeNull();
      srcFolderItem?.click();

      await vi.waitFor(
        () => {
          expect(srcFolderItem?.getAttribute("aria-expanded")).toBe("true");
          expect(document.body.textContent).toContain("components");
          expect(document.body.textContent).toContain("index.ts");
        },
        { timeout: 8_000, interval: 16 },
      );

      srcFolderItem?.click();

      await vi.waitFor(
        () => {
          expect(srcFolderItem?.getAttribute("aria-expanded")).toBe("false");
        },
        { timeout: 8_000, interval: 16 },
      );
    } finally {
      await mounted.cleanup();
    }
  });

  it("uses the worktree root as the room tree root when a worktree is present", async () => {
    const listDirectoryCalls: Array<{ cwd: string; directoryPath?: string }> = [];
    const snapshot = createSnapshotForTargetUser({
      targetMessageId: "msg-user-room-tree-worktree" as MessageId,
      targetText: "room tree worktree",
    });

    const mounted = await mountChatView({
      viewport: DEFAULT_VIEWPORT,
      snapshot: {
        ...snapshot,
        threads: snapshot.threads.map((thread) =>
          thread.id === THREAD_ID
            ? Object.assign({}, thread, {
                worktreePath: "/repo/worktrees/feature-room",
              })
            : thread,
        ),
      },
      initialEntry: `/${THREAD_ID}?view=room`,
      resolveRpc: (body) => {
        if (body._tag !== WS_METHODS.projectsListDirectory) {
          return undefined;
        }
        listDirectoryCalls.push({
          cwd: typeof body.cwd === "string" ? body.cwd : "",
          ...(typeof body.directoryPath === "string" ? { directoryPath: body.directoryPath } : {}),
        });
        return {
          entries: [{ path: "src", kind: "directory" as const }],
          truncated: false,
        };
      },
    });

    try {
      await vi.waitFor(
        () => {
          expect(listDirectoryCalls).toContainEqual({
            cwd: "/repo/worktrees/feature-room",
          });
          expect(
            wsRequests.find(
              (request) =>
                request._tag === WS_METHODS.subscribeProjectWorkspaceChanges &&
                request.cwd === "/repo/worktrees/feature-room",
            ),
          ).toBeTruthy();
          expect(document.body.textContent).toContain("src");
        },
        { timeout: 8_000, interval: 16 },
      );
    } finally {
      await mounted.cleanup();
    }
  });

  it("preserves unsent composer draft text when switching between agent and room", async () => {
    const mounted = await mountChatView({
      viewport: DEFAULT_VIEWPORT,
      snapshot: createSnapshotForTargetUser({
        targetMessageId: "msg-user-draft-preserve-target" as MessageId,
        targetText: "draft preserve target",
      }),
    });

    try {
      await waitForComposerEditor();
      await page.getByTestId("composer-editor").fill("keep this draft");

      const roomButton = await waitForSurfaceToggleButton("Room");
      roomButton.click();

      const roomView = await waitForRoomViewSection();
      await vi.waitFor(
        () => {
          expect(roomView.hidden).toBe(false);
        },
        { timeout: 8_000, interval: 16 },
      );

      const agentButton = await waitForSurfaceToggleButton("Agent");
      agentButton.click();

      const agentView = await waitForAgentViewSection();
      await vi.waitFor(
        () => {
          const composerEditor = document.querySelector<HTMLElement>(
            '[data-testid="composer-editor"]',
          );
          expect(agentView.hidden).toBe(false);
          expect(composerEditor?.textContent).toContain("keep this draft");
        },
        { timeout: 8_000, interval: 16 },
      );
    } finally {
      await mounted.cleanup();
    }
  });

  it("hides the diff surface in room view and restores it when returning to agent", async () => {
    const mounted = await mountChatView({
      viewport: WIDE_FOOTER_VIEWPORT,
      snapshot: createSnapshotForTargetUser({
        targetMessageId: "msg-user-diff-restore-target" as MessageId,
        targetText: "diff restore target",
      }),
      initialEntry: `/${THREAD_ID}?diff=1`,
    });

    try {
      await waitForElement(
        () => document.querySelector('button[aria-label="Stacked diff view"]'),
        "Unable to find diff view toggle.",
      );

      const roomButton = await waitForSurfaceToggleButton("Room");
      roomButton.click();

      await vi.waitFor(
        () => {
          expect(document.querySelector('button[aria-label="Stacked diff view"]')).toBeNull();
        },
        { timeout: 8_000, interval: 16 },
      );

      const agentButton = await waitForSurfaceToggleButton("Agent");
      agentButton.click();

      await waitForElement(
        () => document.querySelector('button[aria-label="Stacked diff view"]'),
        "Unable to find restored diff view toggle.",
      );
    } finally {
      await mounted.cleanup();
    }
  });

  it("renders supported room markdown in the rich room editor without raw markdown markers", async () => {
    const mounted = await mountChatView({
      viewport: DEFAULT_VIEWPORT,
      snapshot: createSnapshotForTargetUser({
        targetMessageId: "msg-user-room-file-pane-markdown" as MessageId,
        targetText: "room markdown file",
      }),
      initialEntry: `/${THREAD_ID}?view=room`,
      resolveRpc: (body) => {
        if (body._tag === WS_METHODS.projectsListDirectory) {
          return {
            entries: [{ path: "README.md", kind: "file" as const }],
            truncated: false,
          };
        }
        if (body._tag === WS_METHODS.projectsReadFile) {
          return {
            relativePath: "README.md",
            contents:
              "# Project README\n\nThis note powers the Room editor.\n\n```js\nconsole.log('preview');\n```\n\n$$\nx+1\n$$\n\n```mermaid\ngraph TD\n  Room-->Editor\n```\n",
            sizeBytes: 144,
            mtimeMs: 10,
          };
        }
        return undefined;
      },
    });

    try {
      const fileTreeItem = await waitForElement(
        () =>
          Array.from(document.querySelectorAll<HTMLElement>('[role="treeitem"]')).find((element) =>
            element.textContent?.includes("README.md"),
          ) ?? null,
        "Unable to find README.md in the Room tree.",
      );
      fileTreeItem.click();

      await vi.waitFor(
        () => {
          const breadcrumbs = document.querySelector<HTMLElement>(
            '[aria-label="Room file breadcrumbs"]',
          );
          expect(breadcrumbs?.textContent).toContain("project");
          expect(breadcrumbs?.textContent).toContain("README.md");
          expect(document.querySelector('[data-room-markdown-surface="true"]')).toBeTruthy();
          expect(document.querySelector('[data-room-markdown-mode="rich"]')).toBeTruthy();
          expect(document.querySelector('[data-room-markdown-editor="rich"]')).toBeTruthy();
          expect(document.body.textContent).not.toContain("# Project README");
          expect(document.body.textContent).toContain("Project README");
          expect(document.body.textContent).toContain("This note powers the Room editor.");
          expect(document.body.textContent).not.toContain("```js");
          expect(document.body.textContent).toContain("console.log('preview');");
          expect(document.body.textContent).not.toContain("$$");
          expect(document.body.textContent).toContain("x+1");
          expect(document.querySelector('[data-room-plate-toolbar="fixed"]')).toBeTruthy();
          expect(document.querySelector('button[aria-label="Edit equation"]')).toBeTruthy();
          expect(document.querySelector(".room-plate-mermaid-preview")).toBeTruthy();
        },
        { timeout: 8_000, interval: 16 },
      );
    } finally {
      await mounted.cleanup();
    }
  });

  it("renders math and code blocks through the plate room block UI", async () => {
    const mounted = await mountChatView({
      viewport: DEFAULT_VIEWPORT,
      snapshot: createSnapshotForTargetUser({
        targetMessageId: "msg-user-room-file-pane-block-source" as MessageId,
        targetText: "room block source markers",
      }),
      initialEntry: `/${THREAD_ID}?view=room`,
      resolveRpc: (body) => {
        if (body._tag === WS_METHODS.projectsListDirectory) {
          return {
            entries: [{ path: "README.md", kind: "file" as const }],
            truncated: false,
          };
        }
        if (body._tag === WS_METHODS.projectsReadFile) {
          return {
            relativePath: "README.md",
            contents:
              '# Project README\n\nInline $room$ math.\n\n```javascript\nconsole.log("hello");\n```\n\n$$\n\\\\sum_{i=1}^{n} i = \\\\frac{n(n+1)}{2}\n$$\n',
            sizeBytes: 140,
            mtimeMs: 14,
          };
        }
        return undefined;
      },
    });

    try {
      const fileTreeItem = await waitForElement(
        () =>
          Array.from(document.querySelectorAll<HTMLElement>('[role="treeitem"]')).find((element) =>
            element.textContent?.includes("README.md"),
          ) ?? null,
        "Unable to find README.md in the Room tree.",
      );
      fileTreeItem.click();

      await vi.waitFor(
        () => {
          expect(document.body.textContent).toContain('console.log("hello");');
          expect(document.body.textContent).not.toContain("```javascript");
          expect(document.body.textContent).not.toContain("$$");
          expect(document.querySelector(".room-plate-code-block")).toBeTruthy();
          expect(document.querySelector('button[aria-label="Edit equation"]')).toBeTruthy();
          expect(
            document.querySelector('button[aria-label="Reveal display math source"]'),
          ).toBeFalsy();
          expect(document.querySelector('[aria-label="Room code block source"]')).toBeFalsy();
        },
        { timeout: 8_000, interval: 16 },
      );
    } finally {
      await mounted.cleanup();
    }
  });

  it("renders room markdown lists with internal markers inside the editor body", async () => {
    const mounted = await mountChatView({
      viewport: DEFAULT_VIEWPORT,
      snapshot: createSnapshotForTargetUser({
        targetMessageId: "msg-user-room-file-pane-lists" as MessageId,
        targetText: "room list rendering",
      }),
      initialEntry: `/${THREAD_ID}?view=room`,
      resolveRpc: (body) => {
        if (body._tag === WS_METHODS.projectsListDirectory) {
          return {
            entries: [{ path: "README.md", kind: "file" as const }],
            truncated: false,
          };
        }
        if (body._tag === WS_METHODS.projectsReadFile) {
          const contents = `# Lists

1. First ordered item
2. Second ordered item

- First bullet item that is deliberately long so it wraps inside the document body instead of hanging from an outside browser marker gutter.
- Second bullet item
`;

          return {
            relativePath: "README.md",
            contents,
            sizeBytes: contents.length,
            mtimeMs: 12,
          };
        }
        return undefined;
      },
    });

    try {
      const fileTreeItem = await waitForElement(
        () =>
          Array.from(document.querySelectorAll<HTMLElement>('[role="treeitem"]')).find((element) =>
            element.textContent?.includes("README.md"),
          ) ?? null,
        "Unable to find README.md in the Room tree.",
      );
      fileTreeItem.click();

      await vi.waitFor(
        () => {
          const roomPane = document.querySelector<HTMLElement>('[data-room-file-pane="true"]');
          const editorSurface = roomPane?.querySelector<HTMLElement>(
            '[data-room-markdown-editor="rich"]',
          );
          const editorRect = editorSurface?.getBoundingClientRect();
          const standardListItems = Array.from(
            editorSurface?.querySelectorAll<HTMLElement>(".room-plate-list-item") ?? [],
          ).map((element) => {
            const marker = element.querySelector<HTMLElement>(".room-plate-list-marker");
            const content = element.lastElementChild as HTMLElement | null;

            return {
              contentLeft: content?.getBoundingClientRect().left ?? 0,
              marker: marker?.getAttribute("data-room-list-marker") ?? null,
              markerLeft: marker?.getBoundingClientRect().left ?? 0,
              text: content?.textContent?.trim() ?? "",
            };
          });
          const firstStandardListItem =
            editorSurface?.querySelector<HTMLElement>(".room-plate-list-item");

          expect(standardListItems).toEqual([
            {
              contentLeft: expect.any(Number),
              marker: "1.",
              markerLeft: expect.any(Number),
              text: "First ordered item",
            },
            {
              contentLeft: expect.any(Number),
              marker: "2.",
              markerLeft: expect.any(Number),
              text: "Second ordered item",
            },
            {
              contentLeft: expect.any(Number),
              marker: "•",
              markerLeft: expect.any(Number),
              text: "First bullet item that is deliberately long so it wraps inside the document body instead of hanging from an outside browser marker gutter.",
            },
            {
              contentLeft: expect.any(Number),
              marker: "•",
              markerLeft: expect.any(Number),
              text: "Second bullet item",
            },
          ]);
          expect(editorRect).not.toBeNull();
          expect(firstStandardListItem && getComputedStyle(firstStandardListItem).display).toBe(
            "grid",
          );
          expect(
            standardListItems.every(
              (item) =>
                item.markerLeft >= (editorRect?.left ?? 0) &&
                item.markerLeft < item.contentLeft &&
                item.contentLeft > (editorRect?.left ?? 0),
            ),
          ).toBe(true);
        },
        { timeout: 8_000, interval: 16 },
      );
    } finally {
      await mounted.cleanup();
    }
  });

  it("keeps nested room lists indented inside the editor body and todo rows marker-free", async () => {
    const mounted = await mountChatView({
      viewport: DEFAULT_VIEWPORT,
      snapshot: createSnapshotForTargetUser({
        targetMessageId: "msg-user-room-file-pane-nested-lists" as MessageId,
        targetText: "room nested list rendering",
      }),
      initialEntry: `/${THREAD_ID}?view=room`,
      resolveRpc: (body) => {
        if (body._tag === WS_METHODS.projectsListDirectory) {
          return {
            entries: [{ path: "README.md", kind: "file" as const }],
            truncated: false,
          };
        }
        if (body._tag === WS_METHODS.projectsReadFile) {
          const contents = `# Nested Lists

- Parent bullet item
  - Nested bullet item
- [ ] Todo item
`;

          return {
            relativePath: "README.md",
            contents,
            sizeBytes: contents.length,
            mtimeMs: 12,
          };
        }
        return undefined;
      },
    });

    try {
      const fileTreeItem = await waitForElement(
        () =>
          Array.from(document.querySelectorAll<HTMLElement>('[role="treeitem"]')).find((element) =>
            element.textContent?.includes("README.md"),
          ) ?? null,
        "Unable to find README.md in the Room tree.",
      );
      fileTreeItem.click();

      await vi.waitFor(
        () => {
          const roomPane = document.querySelector<HTMLElement>('[data-room-file-pane="true"]');
          const editorSurface = roomPane?.querySelector<HTMLElement>(
            '[data-room-markdown-editor="rich"]',
          );
          const todoItem = editorSurface?.querySelector<HTMLElement>(".room-plate-todo-item");
          const standardListItems = Array.from(
            editorSurface?.querySelectorAll<HTMLElement>(".room-plate-list-item") ?? [],
          ).map((element) => ({
            marker: element.querySelector<HTMLElement>(".room-plate-list-marker"),
            text: element.lastElementChild?.textContent?.trim() ?? "",
          }));
          const parentMarker = standardListItems.find(
            (item) => item.text === "Parent bullet item",
          )?.marker;
          const nestedMarker = standardListItems.find(
            (item) => item.text === "Nested bullet item",
          )?.marker;
          const todoMarker = todoItem?.querySelector(".room-plate-list-marker");

          expect(parentMarker).not.toBeNull();
          expect(nestedMarker).not.toBeNull();
          expect(nestedMarker!.getBoundingClientRect().left).toBeGreaterThan(
            parentMarker!.getBoundingClientRect().left,
          );
          expect(todoItem).not.toBeNull();
          expect(todoMarker).toBeNull();
        },
        { timeout: 8_000, interval: 16 },
      );
    } finally {
      await mounted.cleanup();
    }
  });

  it("keeps markdown files with standalone HTML blocks in the rich room editor", async () => {
    const mounted = await mountChatView({
      viewport: DEFAULT_VIEWPORT,
      snapshot: createSnapshotForTargetUser({
        targetMessageId: "msg-user-room-file-pane-html-blocks" as MessageId,
        targetText: "room html blocks",
      }),
      initialEntry: `/${THREAD_ID}?view=room`,
      resolveRpc: (body) => {
        if (body._tag === WS_METHODS.projectsListDirectory) {
          return {
            entries: [{ path: "README.md", kind: "file" as const }],
            truncated: false,
          };
        }
        if (body._tag === WS_METHODS.projectsReadFile) {
          const contents = `# HTML note

<div class="callout"><strong>Preserved HTML</strong></div>
`;

          return {
            relativePath: "README.md",
            contents,
            sizeBytes: contents.length,
            mtimeMs: 13,
          };
        }
        return undefined;
      },
    });

    try {
      const fileTreeItem = await waitForElement(
        () =>
          Array.from(document.querySelectorAll<HTMLElement>('[role="treeitem"]')).find((element) =>
            element.textContent?.includes("README.md"),
          ) ?? null,
        "Unable to find README.md in the Room tree.",
      );
      fileTreeItem.click();

      await vi.waitFor(
        () => {
          expect(document.querySelector('[data-room-markdown-mode="rich"]')).toBeTruthy();
          expect(document.body.textContent).not.toContain(
            "Editing raw Markdown to preserve HTML blocks.",
          );
          expect(document.querySelector('[data-room-html-block="true"]')).toBeTruthy();
          expect(document.body.textContent).toContain("Preserved HTML");
        },
        { timeout: 8_000, interval: 16 },
      );
    } finally {
      await mounted.cleanup();
    }
  });

  it("keeps reference-style markdown links in the rich room editor", async () => {
    const mounted = await mountChatView({
      viewport: DEFAULT_VIEWPORT,
      snapshot: createSnapshotForTargetUser({
        targetMessageId: "msg-user-room-file-pane-link-reference" as MessageId,
        targetText: "room link reference",
      }),
      initialEntry: `/${THREAD_ID}?view=room`,
      resolveRpc: (body) => {
        if (body._tag === WS_METHODS.projectsListDirectory) {
          return {
            entries: [{ path: "README.md", kind: "file" as const }],
            truncated: false,
          };
        }
        if (body._tag === WS_METHODS.projectsReadFile) {
          const contents = `# Reference Links

[Guide][guide]

[guide]: docs/guide.md
`;

          return {
            relativePath: "README.md",
            contents,
            sizeBytes: contents.length,
            mtimeMs: 14,
          };
        }
        return undefined;
      },
    });

    try {
      const fileTreeItem = await waitForElement(
        () =>
          Array.from(document.querySelectorAll<HTMLElement>('[role="treeitem"]')).find((element) =>
            element.textContent?.includes("README.md"),
          ) ?? null,
        "Unable to find README.md in the Room tree.",
      );
      fileTreeItem.click();

      await vi.waitFor(
        () => {
          expect(document.querySelector('[data-room-markdown-mode="rich"]')).toBeTruthy();
          expect(document.body.textContent).not.toContain("Editing raw Markdown to preserve");
          expect(document.body.textContent).toContain("Guide");
        },
        { timeout: 8_000, interval: 16 },
      );
    } finally {
      await mounted.cleanup();
    }
  });

  it("falls back to raw markdown mode for unsupported markdown files", async () => {
    const mounted = await mountChatView({
      viewport: DEFAULT_VIEWPORT,
      snapshot: createSnapshotForTargetUser({
        targetMessageId: "msg-user-room-file-pane-raw-fallback" as MessageId,
        targetText: "room raw fallback",
      }),
      initialEntry: `/${THREAD_ID}?view=room`,
      resolveRpc: (body) => {
        if (body._tag === WS_METHODS.projectsListDirectory) {
          return {
            entries: [{ path: "README.md", kind: "file" as const }],
            truncated: false,
          };
        }
        if (body._tag === WS_METHODS.projectsReadFile) {
          const contents = "# README\n\n![diagram](diagram.png)\n";
          return {
            relativePath: "README.md",
            contents,
            sizeBytes: contents.length,
            mtimeMs: 4,
          };
        }
        return undefined;
      },
    });

    try {
      const fileTreeItem = await waitForElement(
        () =>
          Array.from(document.querySelectorAll<HTMLElement>('[role="treeitem"]')).find((element) =>
            element.textContent?.includes("README.md"),
          ) ?? null,
        "Unable to find README.md in the Room tree.",
      );
      fileTreeItem.click();

      await vi.waitFor(
        () => {
          expect(document.querySelector('[data-room-markdown-mode="raw"]')).toBeTruthy();
          expect(document.querySelector('[data-room-markdown-editor="raw"]')).toBeTruthy();
          expect(document.body.textContent).toContain("Editing raw Markdown to preserve images.");
        },
        { timeout: 8_000, interval: 16 },
      );
    } finally {
      await mounted.cleanup();
    }
  });

  it("shows the unsupported empty state and reveals non-markdown files in Finder", async () => {
    const mounted = await mountChatView({
      viewport: DEFAULT_VIEWPORT,
      snapshot: createSnapshotForTargetUser({
        targetMessageId: "msg-user-room-file-pane-unsupported" as MessageId,
        targetText: "room unsupported file",
      }),
      initialEntry: `/${THREAD_ID}?view=room`,
      resolveRpc: (body) => {
        if (body._tag === WS_METHODS.projectsListDirectory) {
          return {
            entries: [{ path: "package.json", kind: "file" as const }],
            truncated: false,
          };
        }
        return undefined;
      },
    });

    try {
      const fileTreeItem = await waitForElement(
        () =>
          Array.from(document.querySelectorAll<HTMLElement>('[role="treeitem"]')).find((element) =>
            element.textContent?.includes("package.json"),
          ) ?? null,
        "Unable to find package.json in the Room tree.",
      );
      fileTreeItem.click();

      const openInFinderButton = await waitForButtonByText("Open in Finder");
      openInFinderButton.click();

      await vi.waitFor(
        () => {
          expect(document.body.textContent).toContain("This document isn’t supported here yet");
          expect(wsRequests).toContainEqual({
            _tag: WS_METHODS.shellRevealInFileManager,
            path: "/repo/project/package.json",
          });
        },
        { timeout: 8_000, interval: 16 },
      );
    } finally {
      await mounted.cleanup();
    }
  });

  it("saves markdown edits from the rich Room surface and keeps folder clicks from replacing the file pane", async () => {
    let fileContents = "# README\n\nInitial note.\n";
    let fileMtimeMs = 1;

    const mounted = await mountChatView({
      viewport: DEFAULT_VIEWPORT,
      snapshot: createSnapshotForTargetUser({
        targetMessageId: "msg-user-room-file-pane-save" as MessageId,
        targetText: "room save file",
      }),
      initialEntry: `/${THREAD_ID}?view=room`,
      resolveRpc: (body) => {
        if (body._tag === WS_METHODS.projectsListDirectory) {
          if (body.directoryPath === "docs") {
            return {
              entries: [{ path: "docs/guide.md", kind: "file" as const, parentPath: "docs" }],
              truncated: false,
            };
          }

          return {
            entries: [
              { path: "README.md", kind: "file" as const },
              { path: "docs", kind: "directory" as const },
            ],
            truncated: false,
          };
        }
        if (body._tag === WS_METHODS.projectsReadFile && body.relativePath === "README.md") {
          return {
            relativePath: "README.md",
            contents: fileContents,
            sizeBytes: fileContents.length,
            mtimeMs: fileMtimeMs,
          };
        }
        if (body._tag === WS_METHODS.projectsWriteFile && body.relativePath === "README.md") {
          fileContents = typeof body.contents === "string" ? body.contents : fileContents;
          fileMtimeMs += 1;
          return {
            relativePath: "README.md",
          };
        }
        return undefined;
      },
    });

    try {
      const readmeTreeItem = await waitForElement(
        () =>
          Array.from(document.querySelectorAll<HTMLElement>('[role="treeitem"]')).find((element) =>
            element.textContent?.includes("README.md"),
          ) ?? null,
        "Unable to find README.md in the Room tree.",
      );
      readmeTreeItem.click();

      await vi.waitFor(
        () => {
          expect(document.body.textContent).toContain("Initial note.");
        },
        { timeout: 8_000, interval: 16 },
      );

      const richEditor = page.getByRole("textbox", { name: "Room rich markdown editor" });
      await richEditor.fill("Project README\n\nInitial note. Updated");

      const docsFolderItem = await waitForElement(
        () =>
          Array.from(
            document.querySelectorAll<HTMLElement>('[role="treeitem"][aria-expanded]'),
          ).find((element) => element.textContent?.includes("docs")) ?? null,
        "Unable to find docs in the Room tree.",
      );
      docsFolderItem.click();

      await vi.waitFor(
        () => {
          expect(docsFolderItem.getAttribute("aria-expanded")).toBe("true");
          const breadcrumbs = document.querySelector<HTMLElement>(
            '[aria-label="Room file breadcrumbs"]',
          );
          expect(breadcrumbs?.textContent).toContain("README.md");
        },
        { timeout: 8_000, interval: 16 },
      );

      const saveButton = await waitForElement(
        () => document.querySelector<HTMLButtonElement>('button[aria-label="Save room file"]'),
        "Unable to find the Room save button.",
      );
      saveButton.click();

      await vi.waitFor(
        () => {
          const writeRequest = wsRequests.findLast(
            (request) => request._tag === WS_METHODS.projectsWriteFile,
          ) as
            | {
                _tag: string;
                relativePath?: string;
                contents?: string;
                expectedMtimeMs?: number;
              }
            | undefined;
          expect(writeRequest?.relativePath).toBe("README.md");
          expect(writeRequest?.expectedMtimeMs).toBe(1);
          expect(writeRequest?.contents).toContain("Initial note. Updated");
          expect(document.body.textContent).toContain("Saved");
        },
        { timeout: 8_000, interval: 16 },
      );
    } finally {
      await mounted.cleanup();
    }
  });

  it("auto-refreshes a clean selected markdown file after an external workspace change", async () => {
    let fileContents = "# README\n\nInitial note.\n";
    let fileMtimeMs = 1;

    const mounted = await mountChatView({
      viewport: DEFAULT_VIEWPORT,
      snapshot: createSnapshotForTargetUser({
        targetMessageId: "msg-user-room-file-pane-external-refresh" as MessageId,
        targetText: "room external refresh",
      }),
      initialEntry: `/${THREAD_ID}?view=room`,
      resolveRpc: (body) => {
        if (body._tag === WS_METHODS.projectsListDirectory) {
          return {
            entries: [{ path: "README.md", kind: "file" as const }],
            truncated: false,
          };
        }
        if (body._tag === WS_METHODS.projectsReadFile && body.relativePath === "README.md") {
          return {
            relativePath: "README.md",
            contents: fileContents,
            sizeBytes: fileContents.length,
            mtimeMs: fileMtimeMs,
          };
        }
        return undefined;
      },
    });

    try {
      const readmeTreeItem = await waitForElement(
        () =>
          Array.from(document.querySelectorAll<HTMLElement>('[role="treeitem"]')).find((element) =>
            element.textContent?.includes("README.md"),
          ) ?? null,
        "Unable to find README.md in the Room tree.",
      );
      readmeTreeItem.click();

      await vi.waitFor(
        () => {
          expect(document.body.textContent).toContain("Initial note.");
          expect(
            wsRequests.find(
              (request) =>
                request._tag === WS_METHODS.subscribeProjectWorkspaceChanges &&
                request.cwd === "/repo/project",
            ),
          ).toBeTruthy();
        },
        { timeout: 8_000, interval: 16 },
      );

      fileContents = "# README\n\nChanged outside Room.\n";
      fileMtimeMs = 2;
      rpcHarness.emitStreamValue(WS_METHODS.subscribeProjectWorkspaceChanges, {
        _tag: "pathChanged",
        relativePath: "README.md",
        exists: true,
        entryKind: "file",
      });

      await vi.waitFor(
        () => {
          expect(document.body.textContent).toContain("Changed outside Room.");
          expect(document.body.textContent).not.toContain("Initial note.");
        },
        { timeout: 8_000, interval: 16 },
      );
    } finally {
      await mounted.cleanup();
    }
  });

  it("keeps a dirty draft and shows a conflict banner after an external workspace change", async () => {
    let fileContents = "# README\n\nInitial note.\n";
    let fileMtimeMs = 1;

    const mounted = await mountChatView({
      viewport: DEFAULT_VIEWPORT,
      snapshot: createSnapshotForTargetUser({
        targetMessageId: "msg-user-room-file-pane-external-conflict" as MessageId,
        targetText: "room external conflict",
      }),
      initialEntry: `/${THREAD_ID}?view=room`,
      resolveRpc: (body) => {
        if (body._tag === WS_METHODS.projectsListDirectory) {
          return {
            entries: [{ path: "README.md", kind: "file" as const }],
            truncated: false,
          };
        }
        if (body._tag === WS_METHODS.projectsReadFile && body.relativePath === "README.md") {
          return {
            relativePath: "README.md",
            contents: fileContents,
            sizeBytes: fileContents.length,
            mtimeMs: fileMtimeMs,
          };
        }
        return undefined;
      },
    });

    try {
      const readmeTreeItem = await waitForElement(
        () =>
          Array.from(document.querySelectorAll<HTMLElement>('[role="treeitem"]')).find((element) =>
            element.textContent?.includes("README.md"),
          ) ?? null,
        "Unable to find README.md in the Room tree.",
      );
      readmeTreeItem.click();

      await vi.waitFor(
        () => {
          expect(document.body.textContent).toContain("Initial note.");
        },
        { timeout: 8_000, interval: 16 },
      );

      const richEditor = page.getByRole("textbox", { name: "Room rich markdown editor" });
      await richEditor.fill("Project README\n\nMy local draft");

      fileContents = "# README\n\nChanged outside Room.\n";
      fileMtimeMs = 2;
      rpcHarness.emitStreamValue(WS_METHODS.subscribeProjectWorkspaceChanges, {
        _tag: "pathChanged",
        relativePath: "README.md",
        exists: true,
        entryKind: "file",
      });

      await vi.waitFor(
        () => {
          expect(document.body.textContent).toContain("File changed on disk");
          expect(document.body.textContent).toContain("My local draft");
          expect(document.body.textContent).not.toContain("Changed outside Room.");
        },
        { timeout: 8_000, interval: 16 },
      );
    } finally {
      await mounted.cleanup();
    }
  });

  it("renders csv previews and saves spreadsheet edits through the tabular RPC", async () => {
    let csvRows = [
      ["name", "owner"],
      ["API", "Ada"],
    ];
    let fileMtimeMs = 1;

    const mounted = await mountChatView({
      viewport: DEFAULT_VIEWPORT,
      snapshot: createSnapshotForTargetUser({
        targetMessageId: "msg-user-room-file-pane-csv" as MessageId,
        targetText: "room csv preview",
      }),
      initialEntry: `/${THREAD_ID}?view=room`,
      resolveRpc: (body) => {
        if (body._tag === WS_METHODS.projectsListDirectory) {
          return {
            entries: [{ path: "planning.csv", kind: "file" as const }],
            truncated: false,
          };
        }
        if (
          body._tag === WS_METHODS.projectsReadTabularFile &&
          body.relativePath === "planning.csv"
        ) {
          return {
            relativePath: "planning.csv",
            previewKind: "delimited-grid" as const,
            kind: "csv" as const,
            delimiter: "," as const,
            sizeBytes: 32,
            mtimeMs: fileMtimeMs,
            capabilities: { canEditInRoom: true as const },
            sheets: [
              {
                name: "Sheet1",
                rowCount: csvRows.length,
                columnCount: csvRows[0]?.length ?? 0,
                data: csvRows,
                merges: [],
                hiddenRows: [],
                hiddenColumns: [],
                cellMeta: [],
              },
            ],
          };
        }
        if (
          body._tag === WS_METHODS.projectsWriteTabularFile &&
          body.relativePath === "planning.csv"
        ) {
          for (const patch of body.patches as Array<{
            row: number;
            col: number;
            value: string | number | boolean | null;
          }>) {
            while (csvRows.length <= patch.row) {
              csvRows.push([]);
            }
            while ((csvRows[patch.row]?.length ?? 0) <= patch.col) {
              csvRows[patch.row]?.push("");
            }
            csvRows[patch.row]![patch.col] = patch.value === null ? "" : String(patch.value);
          }
          fileMtimeMs += 1;
          return { relativePath: "planning.csv" };
        }
        return undefined;
      },
    });

    try {
      const csvTreeItem = await waitForElement(
        () =>
          Array.from(document.querySelectorAll<HTMLElement>('[role="treeitem"]')).find((element) =>
            element.textContent?.includes("planning.csv"),
          ) ?? null,
        "Unable to find planning.csv in the Room tree.",
      );
      csvTreeItem.click();

      await vi.waitFor(
        () => {
          expect(roomSpreadsheetGridText()).toContain("Ada");
        },
        { timeout: 8_000, interval: 16 },
      );

      await editSpreadsheetCell("Ada", "Sam");

      const saveButton = await waitForElement(
        () => document.querySelector<HTMLButtonElement>('button[aria-label="Save room file"]'),
        "Unable to find the Room save button.",
      );
      saveButton.click();

      await vi.waitFor(
        () => {
          const writeRequest = wsRequests.findLast(
            (request) => request._tag === WS_METHODS.projectsWriteTabularFile,
          ) as
            | {
                _tag: string;
                relativePath?: string;
                patches?: Array<{
                  sheetName: string;
                  row: number;
                  col: number;
                  value: unknown;
                  valueKind: string;
                }>;
              }
            | undefined;

          expect(writeRequest?.relativePath).toBe("planning.csv");
          expect(writeRequest?.patches).toEqual([
            {
              sheetName: "Sheet1",
              row: 1,
              col: 1,
              value: "Sam",
              valueKind: "text",
            },
          ]);
          expect(roomSpreadsheetGridText()).toContain("Sam");
          expect(document.body.textContent).toContain("Saved");
        },
        { timeout: 8_000, interval: 16 },
      );
    } finally {
      await mounted.cleanup();
    }
  });

  it("renders styled xlsx previews with worksheet tabs, comments, and images", async () => {
    const mounted = await mountChatView({
      viewport: DEFAULT_VIEWPORT,
      snapshot: createSnapshotForTargetUser({
        targetMessageId: "msg-user-room-file-pane-xlsx-preview" as MessageId,
        targetText: "room xlsx styled preview",
      }),
      initialEntry: `/${THREAD_ID}?view=room`,
      resolveRpc: (body) => {
        if (body._tag === WS_METHODS.projectsListDirectory) {
          return {
            entries: [{ path: "planning.xlsx", kind: "file" as const }],
            truncated: false,
          };
        }
        if (
          body._tag === WS_METHODS.projectsReadTabularFile &&
          body.relativePath === "planning.xlsx"
        ) {
          return {
            relativePath: "planning.xlsx",
            previewKind: "workbook-presentation" as const,
            kind: "xlsx" as const,
            sizeBytes: 96,
            mtimeMs: 1,
            capabilities: { canEditInRoom: false as const },
            presentationFidelity: "full" as const,
            previewNotices: [],
            dateSystem: "1900" as const,
            theme: {
              colors: {
                accent1: "#4F81BD",
              },
            },
            styles: [
              {
                declarations: {
                  "background-color": "#FCE4D6",
                  color: "#112233",
                  "font-weight": "700",
                },
              },
            ],
            sheets: [
              {
                name: "Summary",
                state: "visible" as const,
                tabColor: "#FF0000",
                showGridLines: false,
                rowCount: 3,
                columnCount: 3,
                rawValues: [
                  ["Milestone", "Owner", "Notes"],
                  ["Alpha", "Ada", "Styled"],
                  ["Beta", 0.5, ""],
                ],
                displayText: [
                  ["Milestone", "Owner", "Notes"],
                  ["Alpha", "Ada", "Styled"],
                  ["Beta", "50%", ""],
                ],
                valueKinds: [
                  ["text", "text", "text"],
                  ["text", "text", "text"],
                  ["text", "number", "empty"],
                ],
                styleIds: [
                  [null, null, null],
                  [null, null, 0],
                  [null, null, null],
                ],
                merges: [],
                hiddenRows: [],
                hiddenColumns: [],
                frozenPane: {
                  rowCount: 1,
                  columnCount: 1,
                },
                rowHeights: [28, 28, 28],
                columnWidths: [120, 120, 120],
                comments: [
                  {
                    row: 1,
                    col: 0,
                    text: "Remember this",
                  },
                ],
                images: [
                  {
                    mediaId: "0",
                    leftPx: 90,
                    topPx: 44,
                    widthPx: 24,
                    heightPx: 24,
                  },
                ],
                backgroundMediaId: "0",
                conditionalOverlays: [],
              },
              {
                name: "Backlog",
                state: "visible" as const,
                showGridLines: true,
                rowCount: 2,
                columnCount: 1,
                rawValues: [["Task"], ["P1"]],
                displayText: [["Task"], ["P1"]],
                valueKinds: [["text"], ["text"]],
                styleIds: [[null], [null]],
                merges: [],
                hiddenRows: [],
                hiddenColumns: [],
                rowHeights: [28, 28],
                columnWidths: [160],
                comments: [],
                images: [],
                conditionalOverlays: [],
              },
            ],
          };
        }
        if (
          body._tag === WS_METHODS.projectsReadTabularMedia &&
          body.relativePath === "planning.xlsx"
        ) {
          return {
            mediaId: "0",
            mimeType: "image/png",
            contentBase64: ONE_PIXEL_PNG_BASE64,
          };
        }
        return undefined;
      },
    });

    try {
      const workbookTreeItem = await waitForElement(
        () =>
          Array.from(document.querySelectorAll<HTMLElement>('[role="treeitem"]')).find((element) =>
            element.textContent?.includes("planning.xlsx"),
          ) ?? null,
        "Unable to find planning.xlsx in the Room tree.",
      );
      workbookTreeItem.click();

      await vi.waitFor(
        () => {
          expect(roomSpreadsheetGridText()).toContain("Styled");
        },
        { timeout: 8_000, interval: 16 },
      );

      const styledCell = await waitForSpreadsheetCell("Styled");
      await vi.waitFor(
        () => {
          const styledContent = styledCell.querySelector<HTMLElement>(".room-xlsx-cell-content");
          expect(styledContent).toBeTruthy();
          expect(getComputedStyle(styledContent!).backgroundColor).toBe("rgb(252, 228, 214)");
          expect(["700", "bold"]).toContain(getComputedStyle(styledContent!).fontWeight);
          expect(
            document.querySelector<HTMLButtonElement>('button[aria-label="Save room file"]'),
          ).toBeNull();
          expect(
            document.querySelectorAll('[data-room-workbook-presentation="true"] img').length,
          ).toBeGreaterThan(0);
          expect(
            wsRequests.some((request) => request._tag === WS_METHODS.projectsReadTabularMedia),
          ).toBe(true);
        },
        { timeout: 8_000, interval: 16 },
      );

      const grid = document.querySelector<TestSpreadsheetGridElement>(
        '[aria-label="Room spreadsheet grid"]',
      );
      expect(grid?.__roomHotInstance?.getCellMeta?.(1, 0)?.comment?.value).toBe("Remember this");

      const backlogTab = await waitForElement(
        () => document.querySelector<HTMLElement>('[aria-label="Show worksheet Backlog"]'),
        "Unable to find the Backlog worksheet tab.",
      );
      backlogTab.click();

      await vi.waitFor(
        () => {
          expect(roomSpreadsheetGridText()).toContain("P1");
          expect(roomSpreadsheetGridText()).not.toContain("Styled");
        },
        { timeout: 8_000, interval: 16 },
      );
    } finally {
      await mounted.cleanup();
    }
  });

  it("renders and saves pipe-delimited previews beyond csv and tsv", async () => {
    let psvRows = [
      ["Milestone", "Owner"],
      ["Alpha", "Ada"],
    ];
    let fileMtimeMs = 1;

    const mounted = await mountChatView({
      viewport: DEFAULT_VIEWPORT,
      snapshot: createSnapshotForTargetUser({
        targetMessageId: "msg-user-room-file-pane-psv-save" as MessageId,
        targetText: "room psv save",
      }),
      initialEntry: `/${THREAD_ID}?view=room`,
      resolveRpc: (body) => {
        if (body._tag === WS_METHODS.projectsListDirectory) {
          return {
            entries: [{ path: "planning.psv", kind: "file" as const }],
            truncated: false,
          };
        }
        if (
          body._tag === WS_METHODS.projectsReadTabularFile &&
          body.relativePath === "planning.psv"
        ) {
          return {
            relativePath: "planning.psv",
            previewKind: "delimited-grid" as const,
            kind: "psv" as const,
            delimiter: "|" as const,
            sizeBytes: 96,
            mtimeMs: fileMtimeMs,
            capabilities: { canEditInRoom: true as const },
            sheets: [
              {
                name: "Sheet1",
                rowCount: psvRows.length,
                columnCount: psvRows[0]?.length ?? 0,
                data: psvRows,
                merges: [],
                hiddenRows: [],
                hiddenColumns: [],
                cellMeta: [],
              },
            ],
          };
        }
        if (
          body._tag === WS_METHODS.projectsWriteTabularFile &&
          body.relativePath === "planning.psv"
        ) {
          for (const patch of body.patches as Array<{
            row: number;
            col: number;
            value: string | number | boolean | null;
          }>) {
            while (psvRows.length <= patch.row) {
              psvRows.push([]);
            }
            while ((psvRows[patch.row]?.length ?? 0) <= patch.col) {
              psvRows[patch.row]?.push("");
            }
            psvRows[patch.row]![patch.col] = patch.value === null ? "" : String(patch.value);
          }
          fileMtimeMs += 1;
          return { relativePath: "planning.psv" };
        }
        return undefined;
      },
    });

    try {
      const psvTreeItem = await waitForElement(
        () =>
          Array.from(document.querySelectorAll<HTMLElement>('[role="treeitem"]')).find((element) =>
            element.textContent?.includes("planning.psv"),
          ) ?? null,
        "Unable to find planning.psv in the Room tree.",
      );
      psvTreeItem.click();

      await vi.waitFor(
        () => {
          expect(roomSpreadsheetGridText()).toContain("Ada");
          expect(document.body.textContent).toContain("Pipe-delimited text");
        },
        { timeout: 8_000, interval: 16 },
      );

      await editSpreadsheetCell("Ada", "Sam");

      const saveButton = await waitForElement(
        () => document.querySelector<HTMLButtonElement>('button[aria-label="Save room file"]'),
        "Unable to find the Room save button.",
      );
      saveButton.click();

      await vi.waitFor(
        () => {
          const writeRequest = wsRequests.findLast(
            (request) => request._tag === WS_METHODS.projectsWriteTabularFile,
          ) as
            | {
                _tag: string;
                relativePath?: string;
                patches?: Array<{
                  sheetName: string;
                  row: number;
                  col: number;
                  value: unknown;
                  valueKind: string;
                }>;
              }
            | undefined;

          expect(writeRequest?.relativePath).toBe("planning.psv");
          expect(writeRequest?.patches).toEqual([
            {
              sheetName: "Sheet1",
              row: 1,
              col: 1,
              value: "Sam",
              valueKind: "text",
            },
          ]);
          expect(roomSpreadsheetGridText()).toContain("Sam");
          expect(document.body.textContent).toContain("Saved");
        },
        { timeout: 8_000, interval: 16 },
      );
    } finally {
      await mounted.cleanup();
    }
  });

  it("renders partial workbook previews for legacy container formats without edit controls", async () => {
    const mounted = await mountChatView({
      viewport: DEFAULT_VIEWPORT,
      snapshot: createSnapshotForTargetUser({
        targetMessageId: "msg-user-room-file-pane-xlsb-preview" as MessageId,
        targetText: "room xlsb preview",
      }),
      initialEntry: `/${THREAD_ID}?view=room`,
      resolveRpc: (body) => {
        if (body._tag === WS_METHODS.projectsListDirectory) {
          return {
            entries: [{ path: "planning.xlsb", kind: "file" as const }],
            truncated: false,
          };
        }
        if (
          body._tag === WS_METHODS.projectsReadTabularFile &&
          body.relativePath === "planning.xlsb"
        ) {
          return {
            relativePath: "planning.xlsb",
            previewKind: "workbook-presentation" as const,
            kind: "xlsb" as const,
            sizeBytes: 96,
            mtimeMs: 1,
            capabilities: { canEditInRoom: false as const },
            presentationFidelity: "partial" as const,
            previewNotices: [
              "Simplified preview: some workbook visuals are not available in Room for this file format.",
            ],
            dateSystem: "1900" as const,
            theme: {
              colors: {},
            },
            styles: [],
            sheets: [
              {
                name: "Summary",
                state: "visible" as const,
                showGridLines: true,
                rowCount: 2,
                columnCount: 2,
                rawValues: [
                  ["Milestone", "Owner"],
                  ["Alpha", "Ada"],
                ],
                displayText: [
                  ["Milestone", "Owner"],
                  ["Alpha", "Ada"],
                ],
                valueKinds: [
                  ["text", "text"],
                  ["text", "text"],
                ],
                styleIds: [
                  [null, null],
                  [null, null],
                ],
                merges: [],
                hiddenRows: [],
                hiddenColumns: [],
                rowHeights: [28, 28],
                columnWidths: [120, 120],
                comments: [],
                images: [],
                conditionalOverlays: [],
              },
              {
                name: "Backlog",
                state: "visible" as const,
                showGridLines: true,
                rowCount: 2,
                columnCount: 1,
                rawValues: [["Task"], ["P1"]],
                displayText: [["Task"], ["P1"]],
                valueKinds: [["text"], ["text"]],
                styleIds: [[null], [null]],
                merges: [],
                hiddenRows: [],
                hiddenColumns: [],
                rowHeights: [28, 28],
                columnWidths: [120],
                comments: [],
                images: [],
                conditionalOverlays: [],
              },
            ],
          };
        }
        return undefined;
      },
    });

    try {
      const workbookTreeItem = await waitForElement(
        () =>
          Array.from(document.querySelectorAll<HTMLElement>('[role="treeitem"]')).find((element) =>
            element.textContent?.includes("planning.xlsb"),
          ) ?? null,
        "Unable to find planning.xlsb in the Room tree.",
      );
      workbookTreeItem.click();

      await vi.waitFor(
        () => {
          expect(roomSpreadsheetGridText()).toContain("Ada");
          expect(document.body.textContent).toContain("Simplified Workbook Preview");
          expect(document.body.textContent).toContain("XLSB workbook");
          expect(
            document.querySelector<HTMLButtonElement>('button[aria-label="Save room file"]'),
          ).toBeNull();
          expect(document.body.textContent).not.toContain("Unsaved");
          expect(document.body.textContent).not.toContain("File changed on disk");
          expect(
            wsRequests.some((request) => request._tag === WS_METHODS.projectsReadTabularMedia),
          ).toBe(false);
        },
        { timeout: 8_000, interval: 16 },
      );

      const backlogTab = await waitForElement(
        () => document.querySelector<HTMLElement>('[aria-label="Show worksheet Backlog"]'),
        "Unable to find the Backlog worksheet tab.",
      );
      backlogTab.click();

      await vi.waitFor(
        () => {
          expect(roomSpreadsheetGridText()).toContain("P1");
          expect(roomSpreadsheetGridText()).not.toContain("Ada");
        },
        { timeout: 8_000, interval: 16 },
      );
    } finally {
      await mounted.cleanup();
    }
  });

  it("auto-refreshes a clean selected xlsx preview after an external workspace change", async () => {
    let activeRows = [
      ["Milestone", "Owner"],
      ["Alpha", "Ada"],
    ];
    let fileMtimeMs = 1;

    const mounted = await mountChatView({
      viewport: DEFAULT_VIEWPORT,
      snapshot: createSnapshotForTargetUser({
        targetMessageId: "msg-user-room-file-pane-workbook-refresh" as MessageId,
        targetText: "room workbook refresh",
      }),
      initialEntry: `/${THREAD_ID}?view=room`,
      resolveRpc: (body) => {
        if (body._tag === WS_METHODS.projectsListDirectory) {
          return {
            entries: [{ path: "planning.xlsx", kind: "file" as const }],
            truncated: false,
          };
        }
        if (
          body._tag === WS_METHODS.projectsReadTabularFile &&
          body.relativePath === "planning.xlsx"
        ) {
          return {
            relativePath: "planning.xlsx",
            previewKind: "workbook-presentation" as const,
            kind: "xlsx" as const,
            sizeBytes: 96,
            mtimeMs: fileMtimeMs,
            capabilities: { canEditInRoom: false as const },
            presentationFidelity: "full" as const,
            previewNotices: [],
            dateSystem: "1900" as const,
            theme: {
              colors: {},
            },
            styles: [],
            sheets: [
              {
                name: "Summary",
                state: "visible" as const,
                showGridLines: true,
                rowCount: activeRows.length,
                columnCount: activeRows[0]?.length ?? 0,
                rawValues: activeRows,
                displayText: activeRows,
                valueKinds: activeRows.map((row) => row.map(() => "text" as const)),
                styleIds: activeRows.map((row) => row.map(() => null)),
                merges: [],
                hiddenRows: [],
                hiddenColumns: [],
                rowHeights: activeRows.map(() => 28),
                columnWidths: (activeRows[0] ?? []).map(() => 120),
                comments: [],
                images: [],
                conditionalOverlays: [],
              },
            ],
          };
        }
        return undefined;
      },
    });

    try {
      const workbookTreeItem = await waitForElement(
        () =>
          Array.from(document.querySelectorAll<HTMLElement>('[role="treeitem"]')).find((element) =>
            element.textContent?.includes("planning.xlsx"),
          ) ?? null,
        "Unable to find planning.xlsx in the Room tree.",
      );
      workbookTreeItem.click();

      await vi.waitFor(
        () => {
          expect(roomSpreadsheetGridText()).toContain("Alpha");
        },
        { timeout: 8_000, interval: 16 },
      );

      activeRows = [
        ["Milestone", "Owner"],
        ["Beta", "Sam"],
      ];
      fileMtimeMs = 2;
      rpcHarness.emitStreamValue(WS_METHODS.subscribeProjectWorkspaceChanges, {
        _tag: "pathChanged",
        relativePath: "planning.xlsx",
        exists: true,
        entryKind: "file",
      });

      await vi.waitFor(
        () => {
          expect(roomSpreadsheetGridText()).toContain("Beta");
          expect(roomSpreadsheetGridText()).not.toContain("Alpha");
          expect(document.body.textContent).not.toContain("File changed on disk");
          expect(
            document.querySelector<HTMLButtonElement>('button[aria-label="Save room file"]'),
          ).toBeNull();
        },
        { timeout: 8_000, interval: 16 },
      );
    } finally {
      await mounted.cleanup();
    }
  });

  it("keeps a dirty csv draft and shows a conflict banner after an external workspace change", async () => {
    let activeRows = [
      ["Milestone", "Owner"],
      ["Alpha", "Ada"],
    ];
    let fileMtimeMs = 1;

    const mounted = await mountChatView({
      viewport: DEFAULT_VIEWPORT,
      snapshot: createSnapshotForTargetUser({
        targetMessageId: "msg-user-room-file-pane-csv-conflict" as MessageId,
        targetText: "room csv conflict",
      }),
      initialEntry: `/${THREAD_ID}?view=room`,
      resolveRpc: (body) => {
        if (body._tag === WS_METHODS.projectsListDirectory) {
          return {
            entries: [{ path: "planning.csv", kind: "file" as const }],
            truncated: false,
          };
        }
        if (
          body._tag === WS_METHODS.projectsReadTabularFile &&
          body.relativePath === "planning.csv"
        ) {
          return {
            relativePath: "planning.csv",
            previewKind: "delimited-grid" as const,
            kind: "csv" as const,
            delimiter: "," as const,
            sizeBytes: 96,
            mtimeMs: fileMtimeMs,
            capabilities: { canEditInRoom: true as const },
            sheets: [
              {
                name: "Summary",
                rowCount: activeRows.length,
                columnCount: activeRows[0]?.length ?? 0,
                data: activeRows,
                merges: [],
                hiddenRows: [],
                hiddenColumns: [],
                cellMeta: [],
              },
            ],
          };
        }
        return undefined;
      },
    });

    try {
      const workbookTreeItem = await waitForElement(
        () =>
          Array.from(document.querySelectorAll<HTMLElement>('[role="treeitem"]')).find((element) =>
            element.textContent?.includes("planning.csv"),
          ) ?? null,
        "Unable to find planning.csv in the Room tree.",
      );
      workbookTreeItem.click();

      await vi.waitFor(
        () => {
          expect(roomSpreadsheetGridText()).toContain("Ada");
        },
        { timeout: 8_000, interval: 16 },
      );

      await editSpreadsheetCell("Ada", "Sam");

      activeRows = [
        ["Milestone", "Owner"],
        ["Beta", "Zoe"],
      ];
      fileMtimeMs = 2;
      rpcHarness.emitStreamValue(WS_METHODS.subscribeProjectWorkspaceChanges, {
        _tag: "pathChanged",
        relativePath: "planning.csv",
        exists: true,
        entryKind: "file",
      });

      await vi.waitFor(
        () => {
          expect(document.body.textContent).toContain("File changed on disk");
          expect(roomSpreadsheetGridText()).toContain("Sam");
          expect(roomSpreadsheetGridText()).not.toContain("Zoe");
        },
        { timeout: 8_000, interval: 16 },
      );
    } finally {
      await mounted.cleanup();
    }
  });

  it("falls back to the unsupported document state for unsupported workbook visuals", async () => {
    const mounted = await mountChatView({
      viewport: DEFAULT_VIEWPORT,
      snapshot: createSnapshotForTargetUser({
        targetMessageId: "msg-user-room-file-pane-workbook-unsupported" as MessageId,
        targetText: "room workbook unsupported",
      }),
      initialEntry: `/${THREAD_ID}?view=room`,
      resolveRpc: (body) => {
        if (body._tag === WS_METHODS.projectsListDirectory) {
          return {
            entries: [{ path: "massive.xlsx", kind: "file" as const }],
            truncated: false,
          };
        }
        if (
          body._tag === WS_METHODS.projectsReadTabularFile &&
          body.relativePath === "massive.xlsx"
        ) {
          return {
            relativePath: "massive.xlsx",
            previewKind: "workbook-presentation" as const,
            kind: "xlsx" as const,
            sizeBytes: 96,
            mtimeMs: 1,
            capabilities: { canEditInRoom: false as const },
            presentationFidelity: "full" as const,
            previewNotices: [],
            dateSystem: "1900" as const,
            theme: {
              colors: {},
            },
            styles: [],
            sheets: [],
            unsupportedVisualReason:
              "This workbook contains Excel table themes that Room can’t render faithfully yet.",
          };
        }
        return undefined;
      },
    });

    try {
      const workbookTreeItem = await waitForElement(
        () =>
          Array.from(document.querySelectorAll<HTMLElement>('[role="treeitem"]')).find((element) =>
            element.textContent?.includes("massive.xlsx"),
          ) ?? null,
        "Unable to find massive.xlsx in the Room tree.",
      );
      workbookTreeItem.click();

      await vi.waitFor(
        () => {
          expect(document.body.textContent).toContain("This document isn’t supported here yet");
          expect(document.body.textContent).toContain("Excel table themes");
        },
        { timeout: 8_000, interval: 16 },
      );
    } finally {
      await mounted.cleanup();
    }
  });

  it("renders PDF previews with toolbar controls and no save button", async () => {
    const mounted = await mountChatView({
      viewport: DEFAULT_VIEWPORT,
      snapshot: createSnapshotForTargetUser({
        targetMessageId: "msg-user-room-file-pane-pdf-preview" as MessageId,
        targetText: "room pdf preview",
      }),
      initialEntry: `/${THREAD_ID}?view=room`,
      resolveRpc: (body) => {
        if (body._tag === WS_METHODS.projectsListDirectory) {
          return {
            entries: [{ path: "brief.pdf", kind: "file" as const }],
            truncated: false,
          };
        }
        if (
          body._tag === WS_METHODS.projectsReadDocumentFile &&
          body.relativePath === "brief.pdf"
        ) {
          return {
            relativePath: "brief.pdf",
            kind: "pdf" as const,
            sizeBytes: 512,
            mtimeMs: 1,
            mimeType: "application/pdf",
            capabilities: { canEditInRoom: false as const },
            contentBase64: ROOM_PDF_BASE64,
          };
        }
        return undefined;
      },
    });

    try {
      const pdfTreeItem = await waitForElement(
        () =>
          Array.from(document.querySelectorAll<HTMLElement>('[role="treeitem"]')).find((element) =>
            element.textContent?.includes("brief.pdf"),
          ) ?? null,
        "Unable to find brief.pdf in the Room tree.",
      );
      pdfTreeItem.click();

      await vi.waitFor(
        () => {
          expect(document.body.textContent).toContain("Room PDF Preview");
          expect(document.body.textContent).toContain("Page 1 of 1");
          expect(document.body.textContent).toContain("Fit width");
          expect(document.querySelector("[data-room-pdf-preview]")).toBeTruthy();
          expect(
            document.querySelector<HTMLButtonElement>('button[aria-label="Save room file"]'),
          ).toBeNull();
        },
        { timeout: 8_000, interval: 16 },
      );
    } finally {
      await mounted.cleanup();
    }
  });

  it("renders paged DOCX previews with no save button", async () => {
    const mounted = await mountChatView({
      viewport: DEFAULT_VIEWPORT,
      snapshot: createSnapshotForTargetUser({
        targetMessageId: "msg-user-room-file-pane-docx-preview" as MessageId,
        targetText: "room docx preview",
      }),
      initialEntry: `/${THREAD_ID}?view=room`,
      resolveRpc: (body) => {
        if (body._tag === WS_METHODS.projectsListDirectory) {
          return {
            entries: [{ path: "brief.docx", kind: "file" as const }],
            truncated: false,
          };
        }
        if (
          body._tag === WS_METHODS.projectsReadDocumentFile &&
          body.relativePath === "brief.docx"
        ) {
          return {
            relativePath: "brief.docx",
            kind: "docx" as const,
            sizeBytes: 1024,
            mtimeMs: 1,
            mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            capabilities: { canEditInRoom: false as const },
            contentBase64: ROOM_DOCX_BASE64,
          };
        }
        return undefined;
      },
    });

    try {
      const docxTreeItem = await waitForElement(
        () =>
          Array.from(document.querySelectorAll<HTMLElement>('[role="treeitem"]')).find((element) =>
            element.textContent?.includes("brief.docx"),
          ) ?? null,
        "Unable to find brief.docx in the Room tree.",
      );
      docxTreeItem.click();

      await vi.waitFor(
        () => {
          expect(document.body.textContent).toContain("Room DOCX Preview");
          expect(document.body.textContent).toContain("Page two paragraph");
          expect(document.querySelector("[data-room-docx-preview]")).toBeTruthy();
          expect(document.querySelectorAll("section.room-docx").length).toBeGreaterThanOrEqual(2);
          expect(
            document.querySelector<HTMLButtonElement>('button[aria-label="Save room file"]'),
          ).toBeNull();
        },
        { timeout: 8_000, interval: 16 },
      );
    } finally {
      await mounted.cleanup();
    }
  });

  it("auto-refreshes a clean selected PDF preview after an external workspace change", async () => {
    let currentPdfBase64 = ROOM_PDF_BASE64;
    let currentMtimeMs = 1;

    const mounted = await mountChatView({
      viewport: DEFAULT_VIEWPORT,
      snapshot: createSnapshotForTargetUser({
        targetMessageId: "msg-user-room-file-pane-pdf-refresh" as MessageId,
        targetText: "room pdf refresh",
      }),
      initialEntry: `/${THREAD_ID}?view=room`,
      resolveRpc: (body) => {
        if (body._tag === WS_METHODS.projectsListDirectory) {
          return {
            entries: [{ path: "brief.pdf", kind: "file" as const }],
            truncated: false,
          };
        }
        if (
          body._tag === WS_METHODS.projectsReadDocumentFile &&
          body.relativePath === "brief.pdf"
        ) {
          return {
            relativePath: "brief.pdf",
            kind: "pdf" as const,
            sizeBytes: 512,
            mtimeMs: currentMtimeMs,
            mimeType: "application/pdf",
            capabilities: { canEditInRoom: false as const },
            contentBase64: currentPdfBase64,
          };
        }
        return undefined;
      },
    });

    try {
      const pdfTreeItem = await waitForElement(
        () =>
          Array.from(document.querySelectorAll<HTMLElement>('[role="treeitem"]')).find((element) =>
            element.textContent?.includes("brief.pdf"),
          ) ?? null,
        "Unable to find brief.pdf in the Room tree.",
      );
      pdfTreeItem.click();

      await vi.waitFor(
        () => {
          expect(document.body.textContent).toContain("Room PDF Preview");
        },
        { timeout: 8_000, interval: 16 },
      );

      currentPdfBase64 = UPDATED_ROOM_PDF_BASE64;
      currentMtimeMs = 2;
      rpcHarness.emitStreamValue(WS_METHODS.subscribeProjectWorkspaceChanges, {
        _tag: "pathChanged",
        relativePath: "brief.pdf",
        exists: true,
        entryKind: "file",
      });

      await vi.waitFor(
        () => {
          expect(document.body.textContent).toContain("Updated PDF Preview");
          expect(document.body.textContent).not.toContain("File changed on disk");
          expect(
            document.querySelector<HTMLButtonElement>('button[aria-label="Save room file"]'),
          ).toBeNull();
        },
        { timeout: 8_000, interval: 16 },
      );
    } finally {
      await mounted.cleanup();
    }
  });

  it("falls back to the unsupported document state for corrupt document previews", async () => {
    const mounted = await mountChatView({
      viewport: DEFAULT_VIEWPORT,
      snapshot: createSnapshotForTargetUser({
        targetMessageId: "msg-user-room-file-pane-document-unsupported" as MessageId,
        targetText: "room document unsupported",
      }),
      initialEntry: `/${THREAD_ID}?view=room`,
      resolveRpc: (body) => {
        if (body._tag === WS_METHODS.projectsListDirectory) {
          return {
            entries: [{ path: "locked.docx", kind: "file" as const }],
            truncated: false,
          };
        }
        if (
          body._tag === WS_METHODS.projectsReadDocumentFile &&
          body.relativePath === "locked.docx"
        ) {
          return {
            relativePath: "locked.docx",
            kind: "docx" as const,
            sizeBytes: 16,
            mtimeMs: 1,
            mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            capabilities: { canEditInRoom: false as const },
            contentBase64: "bm90LWEtdmFsaWQtZG9jeA==",
          };
        }
        return undefined;
      },
    });

    try {
      const docxTreeItem = await waitForElement(
        () =>
          Array.from(document.querySelectorAll<HTMLElement>('[role="treeitem"]')).find((element) =>
            element.textContent?.includes("locked.docx"),
          ) ?? null,
        "Unable to find locked.docx in the Room tree.",
      );
      docxTreeItem.click();

      await vi.waitFor(
        () => {
          expect(document.body.textContent).toContain("This document isn’t supported here yet");
          expect(document.body.textContent).toContain("password-protected or corrupted");
        },
        { timeout: 8_000, interval: 16 },
      );
    } finally {
      await mounted.cleanup();
    }
  });

  it("shows deleted selected files as recreatable drafts after an external delete", async () => {
    let fileContents = "# README\n\nInitial note.\n";
    let fileMtimeMs = 1;
    let fileExists = true;

    const mounted = await mountChatView({
      viewport: DEFAULT_VIEWPORT,
      snapshot: createSnapshotForTargetUser({
        targetMessageId: "msg-user-room-file-pane-external-delete" as MessageId,
        targetText: "room external delete",
      }),
      initialEntry: `/${THREAD_ID}?view=room`,
      resolveRpc: (body) => {
        if (body._tag === WS_METHODS.projectsListDirectory) {
          return {
            entries: [{ path: "README.md", kind: "file" as const }],
            truncated: false,
          };
        }
        if (body._tag === WS_METHODS.projectsReadFile && body.relativePath === "README.md") {
          if (!fileExists) {
            return Promise.reject(new Error("File does not exist: README.md"));
          }
          return {
            relativePath: "README.md",
            contents: fileContents,
            sizeBytes: fileContents.length,
            mtimeMs: fileMtimeMs,
          };
        }
        if (body._tag === WS_METHODS.projectsWriteFile && body.relativePath === "README.md") {
          fileContents = typeof body.contents === "string" ? body.contents : fileContents;
          fileMtimeMs += 1;
          fileExists = true;
          return {
            relativePath: "README.md",
          };
        }
        return undefined;
      },
    });

    try {
      const readmeTreeItem = await waitForElement(
        () =>
          Array.from(document.querySelectorAll<HTMLElement>('[role="treeitem"]')).find((element) =>
            element.textContent?.includes("README.md"),
          ) ?? null,
        "Unable to find README.md in the Room tree.",
      );
      readmeTreeItem.click();

      await vi.waitFor(
        () => {
          expect(document.body.textContent).toContain("Initial note.");
        },
        { timeout: 8_000, interval: 16 },
      );

      const richEditor = page.getByRole("textbox", { name: "Room rich markdown editor" });
      await richEditor.fill("Project README\n\nRecreated from Room");

      fileExists = false;
      rpcHarness.emitStreamValue(WS_METHODS.subscribeProjectWorkspaceChanges, {
        _tag: "pathChanged",
        relativePath: "README.md",
        exists: false,
        entryKind: "file",
      });

      await vi.waitFor(
        () => {
          expect(document.body.textContent).toContain("File deleted on disk");
          expect(document.body.textContent).toContain("Save to recreate");
        },
        { timeout: 8_000, interval: 16 },
      );

      const saveToRecreateButton = await waitForButtonByText("Save to recreate");
      saveToRecreateButton.click();

      await vi.waitFor(
        () => {
          const writeRequest = wsRequests.findLast(
            (request) => request._tag === WS_METHODS.projectsWriteFile,
          ) as
            | {
                _tag: string;
                relativePath?: string;
                contents?: string;
                expectedMtimeMs?: number;
              }
            | undefined;
          expect(writeRequest?.relativePath).toBe("README.md");
          expect(writeRequest?.expectedMtimeMs).toBeUndefined();
          expect(writeRequest?.contents).toContain("Recreated from Room");
          expect(document.body.textContent).toContain("Saved");
        },
        { timeout: 8_000, interval: 16 },
      );
    } finally {
      await mounted.cleanup();
    }
  });

  it("refreshes loaded room tree directories after external changes without eagerly loading unopened folders", async () => {
    const rootEntries: Array<{ path: string; kind: "file" | "directory"; parentPath?: string }> = [
      { path: "README.md", kind: "file" },
      { path: "docs", kind: "directory" },
      { path: "src", kind: "directory" },
    ];
    const docsEntries: Array<{ path: string; kind: "file" | "directory"; parentPath?: string }> = [
      { path: "docs/guide.md", kind: "file", parentPath: "docs" },
    ];
    const srcEntries: Array<{ path: string; kind: "file" | "directory"; parentPath?: string }> = [
      { path: "src/index.ts", kind: "file", parentPath: "src" },
    ];

    const mounted = await mountChatView({
      viewport: DEFAULT_VIEWPORT,
      snapshot: createSnapshotForTargetUser({
        targetMessageId: "msg-user-room-tree-external-sync" as MessageId,
        targetText: "room tree external sync",
      }),
      initialEntry: `/${THREAD_ID}?view=room`,
      resolveRpc: (body) => {
        if (body._tag !== WS_METHODS.projectsListDirectory) {
          return undefined;
        }
        if (body.directoryPath === "src") {
          return {
            entries: srcEntries,
            truncated: false,
          };
        }
        if (body.directoryPath === "docs") {
          return {
            entries: docsEntries,
            truncated: false,
          };
        }
        return {
          entries: rootEntries,
          truncated: false,
        };
      },
    });

    try {
      await vi.waitFor(
        () => {
          expect(document.body.textContent).toContain("src");
        },
        { timeout: 8_000, interval: 16 },
      );

      const srcFolderItem = await waitForElement(
        () =>
          Array.from(
            document.querySelectorAll<HTMLElement>('[role="treeitem"][aria-expanded]'),
          ).find((element) => element.textContent?.includes("src")) ?? null,
        "Unable to find src in the Room tree.",
      );
      srcFolderItem.click();

      await vi.waitFor(
        () => {
          expect(srcFolderItem.getAttribute("aria-expanded")).toBe("true");
          expect(document.body.textContent).toContain("index.ts");
        },
        { timeout: 8_000, interval: 16 },
      );

      const docsRequestCountBefore = wsRequests.filter(
        (request) =>
          request._tag === WS_METHODS.projectsListDirectory && request.directoryPath === "docs",
      ).length;

      rootEntries.splice(1, 0, { path: "CHANGELOG.md", kind: "file" });
      docsEntries.push({ path: "docs/new.md", kind: "file", parentPath: "docs" });
      srcEntries.push({ path: "src/new.ts", kind: "file", parentPath: "src" });

      rpcHarness.emitStreamValue(WS_METHODS.subscribeProjectWorkspaceChanges, {
        _tag: "pathChanged",
        relativePath: "CHANGELOG.md",
        exists: true,
        entryKind: "file",
      });
      rpcHarness.emitStreamValue(WS_METHODS.subscribeProjectWorkspaceChanges, {
        _tag: "pathChanged",
        relativePath: "src/new.ts",
        exists: true,
        entryKind: "file",
      });
      rpcHarness.emitStreamValue(WS_METHODS.subscribeProjectWorkspaceChanges, {
        _tag: "pathChanged",
        relativePath: "docs/new.md",
        exists: true,
        entryKind: "file",
      });

      await vi.waitFor(
        () => {
          expect(document.body.textContent).toContain("CHANGELOG.md");
          expect(document.body.textContent).toContain("new.ts");
        },
        { timeout: 8_000, interval: 16 },
      );

      expect(
        wsRequests.filter(
          (request) =>
            request._tag === WS_METHODS.projectsListDirectory && request.directoryPath === "docs",
        ).length,
      ).toBe(docsRequestCountBefore);

      const docsFolderItem = await waitForElement(
        () =>
          Array.from(
            document.querySelectorAll<HTMLElement>('[role="treeitem"][aria-expanded]'),
          ).find((element) => element.textContent?.includes("docs")) ?? null,
        "Unable to find docs in the Room tree.",
      );
      docsFolderItem.click();

      await vi.waitFor(
        () => {
          expect(docsFolderItem.getAttribute("aria-expanded")).toBe("true");
          expect(document.body.textContent).toContain("new.md");
        },
        { timeout: 8_000, interval: 16 },
      );
    } finally {
      await mounted.cleanup();
    }
  });

  it("does not leak a server worktree path into drawer runtime env when launch context clears it", async () => {
    const snapshot = createSnapshotForTargetUser({
      targetMessageId: "msg-user-launch-context-target" as MessageId,
      targetText: "launch context worktree override",
    });
    const targetThread = snapshot.threads.find((thread) => thread.id === THREAD_ID);
    if (targetThread) {
      Object.assign(targetThread, {
        branch: "feature/branch",
        worktreePath: "/repo/worktrees/feature-branch",
      });
    }

    useTerminalStateStore.setState({
      terminalStateByThreadId: {
        [THREAD_ID]: {
          terminalOpen: true,
          terminalHeight: 280,
          terminalIds: ["default"],
          runningTerminalIds: [],
          activeTerminalId: "default",
          terminalGroups: [{ id: "group-default", terminalIds: ["default"] }],
          activeTerminalGroupId: "group-default",
        },
      },
      terminalLaunchContextByThreadId: {
        [THREAD_ID]: {
          cwd: "/repo/project",
          worktreePath: null,
        },
      },
    });

    const mounted = await mountChatView({
      viewport: DEFAULT_VIEWPORT,
      snapshot,
    });

    try {
      await vi.waitFor(
        () => {
          const openRequest = wsRequests.find(
            (request) => request._tag === WS_METHODS.terminalOpen,
          ) as
            | {
                _tag: string;
                cwd?: string;
                worktreePath?: string | null;
                env?: Record<string, string>;
              }
            | undefined;
          expect(openRequest).toMatchObject({
            _tag: WS_METHODS.terminalOpen,
            cwd: "/repo/project",
            worktreePath: null,
            env: {
              ASSIST_PROJECT_ROOT: "/repo/project",
            },
          });
          expect(openRequest?.env?.ASSIST_WORKTREE_PATH).toBeUndefined();
        },
        { timeout: 8_000, interval: 16 },
      );
    } finally {
      await mounted.cleanup();
    }
  });

  it("lets the server own setup after preparing a pull request worktree thread", async () => {
    useComposerDraftStore.setState({
      draftThreadsByThreadId: {
        [THREAD_ID]: {
          projectId: PROJECT_ID,
          createdAt: NOW_ISO,
          runtimeMode: "full-access",
          interactionMode: "default",
          branch: null,
          worktreePath: null,
          envMode: "local",
        },
      },
      projectDraftThreadIdByProjectId: {
        [PROJECT_ID]: THREAD_ID,
      },
    });

    const mounted = await mountChatView({
      viewport: DEFAULT_VIEWPORT,
      snapshot: withProjectScripts(createDraftOnlySnapshot(), [
        {
          id: "setup",
          name: "Setup",
          command: "bun install",
          icon: "configure",
          runOnWorktreeCreate: true,
        },
      ]),
      resolveRpc: (body) => {
        if (body._tag === WS_METHODS.gitResolvePullRequest) {
          return {
            pullRequest: {
              number: 1359,
              title: "Add thread archiving and settings navigation",
              url: "https://github.com/harounPapi/.assist/pull/1359",
              baseBranch: "main",
              headBranch: "archive-settings-overhaul",
              state: "open",
            },
          };
        }
        if (body._tag === WS_METHODS.gitPreparePullRequestThread) {
          return {
            pullRequest: {
              number: 1359,
              title: "Add thread archiving and settings navigation",
              url: "https://github.com/harounPapi/.assist/pull/1359",
              baseBranch: "main",
              headBranch: "archive-settings-overhaul",
              state: "open",
            },
            branch: "archive-settings-overhaul",
            worktreePath: "/repo/worktrees/pr-1359",
          };
        }
        return undefined;
      },
    });

    try {
      const branchButton = await waitForElement(
        () =>
          Array.from(document.querySelectorAll("button")).find(
            (button) => button.textContent?.trim() === "main",
          ) as HTMLButtonElement | null,
        "Unable to find branch selector button.",
      );
      branchButton.click();

      const branchInput = await waitForElement(
        () => document.querySelector<HTMLInputElement>('input[placeholder="Search branches..."]'),
        "Unable to find branch search input.",
      );
      branchInput.focus();
      await page.getByPlaceholder("Search branches...").fill("1359");

      const checkoutItem = await waitForElement(
        () =>
          Array.from(document.querySelectorAll("span")).find(
            (element) => element.textContent?.trim() === "Checkout Pull Request",
          ) as HTMLSpanElement | null,
        "Unable to find checkout pull request option.",
      );
      checkoutItem.click();

      const worktreeButton = await waitForElement(
        () =>
          Array.from(document.querySelectorAll("button")).find(
            (button) => button.textContent?.trim() === "Worktree",
          ) as HTMLButtonElement | null,
        "Unable to find Worktree button.",
      );
      worktreeButton.click();

      await vi.waitFor(
        () => {
          const prepareRequest = wsRequests.find(
            (request) => request._tag === WS_METHODS.gitPreparePullRequestThread,
          );
          expect(prepareRequest).toMatchObject({
            _tag: WS_METHODS.gitPreparePullRequestThread,
            cwd: "/repo/project",
            reference: "1359",
            mode: "worktree",
            threadId: THREAD_ID,
          });
        },
        { timeout: 8_000, interval: 16 },
      );

      expect(
        wsRequests.some(
          (request) =>
            request._tag === WS_METHODS.terminalWrite && request.data === "bun install\r",
        ),
      ).toBe(false);
    } finally {
      await mounted.cleanup();
    }
  });

  it("sends bootstrap turn-starts and waits for server setup on first-send worktree drafts", async () => {
    useTerminalStateStore.setState({
      terminalStateByThreadId: {},
    });
    useComposerDraftStore.setState({
      draftThreadsByThreadId: {
        [THREAD_ID]: {
          projectId: PROJECT_ID,
          createdAt: NOW_ISO,
          runtimeMode: "full-access",
          interactionMode: "default",
          branch: "main",
          worktreePath: null,
          envMode: "worktree",
        },
      },
      projectDraftThreadIdByProjectId: {
        [PROJECT_ID]: THREAD_ID,
      },
    });

    const mounted = await mountChatView({
      viewport: DEFAULT_VIEWPORT,
      snapshot: withProjectScripts(createDraftOnlySnapshot(), [
        {
          id: "setup",
          name: "Setup",
          command: "bun install",
          icon: "configure",
          runOnWorktreeCreate: true,
        },
      ]),
      resolveRpc: (body) => {
        if (body._tag === ORCHESTRATION_WS_METHODS.dispatchCommand) {
          return {
            sequence: fixture.snapshot.snapshotSequence + 1,
          };
        }
        return undefined;
      },
    });

    try {
      useComposerDraftStore.getState().setPrompt(THREAD_ID, "Ship it");
      await waitForLayout();

      const sendButton = await waitForSendButton();
      expect(sendButton.disabled).toBe(false);
      sendButton.click();

      await vi.waitFor(
        () => {
          const dispatchRequest = wsRequests.find(
            (request) => request._tag === ORCHESTRATION_WS_METHODS.dispatchCommand,
          ) as
            | {
                _tag: string;
                type?: string;
                bootstrap?: {
                  createThread?: { projectId?: string };
                  prepareWorktree?: { projectCwd?: string; baseBranch?: string; branch?: string };
                  runSetupScript?: boolean;
                };
              }
            | undefined;
          expect(dispatchRequest).toMatchObject({
            _tag: ORCHESTRATION_WS_METHODS.dispatchCommand,
            type: "thread.turn.start",
            bootstrap: {
              createThread: {
                projectId: PROJECT_ID,
              },
              prepareWorktree: {
                projectCwd: "/repo/project",
                baseBranch: "main",
                branch: expect.stringMatching(/^assist\/[0-9a-f]{8}$/),
              },
              runSetupScript: true,
            },
          });
        },
        { timeout: 8_000, interval: 16 },
      );

      expect(wsRequests.some((request) => request._tag === WS_METHODS.gitCreateWorktree)).toBe(
        false,
      );
      expect(
        wsRequests.some(
          (request) =>
            request._tag === WS_METHODS.terminalWrite &&
            request.threadId === THREAD_ID &&
            request.data === "bun install\r",
        ),
      ).toBe(false);
    } finally {
      await mounted.cleanup();
    }
  });

  it("shows the send state once bootstrap dispatch is in flight", async () => {
    useTerminalStateStore.setState({
      terminalStateByThreadId: {},
    });
    useComposerDraftStore.setState({
      draftThreadsByThreadId: {
        [THREAD_ID]: {
          projectId: PROJECT_ID,
          createdAt: NOW_ISO,
          runtimeMode: "full-access",
          interactionMode: "default",
          branch: "main",
          worktreePath: null,
          envMode: "worktree",
        },
      },
      projectDraftThreadIdByProjectId: {
        [PROJECT_ID]: THREAD_ID,
      },
    });

    let resolveDispatch!: (value: { sequence: number }) => void;
    const dispatchPromise = new Promise<{ sequence: number }>((resolve) => {
      resolveDispatch = resolve;
    });

    const mounted = await mountChatView({
      viewport: DEFAULT_VIEWPORT,
      snapshot: withProjectScripts(createDraftOnlySnapshot(), [
        {
          id: "setup",
          name: "Setup",
          command: "bun install",
          icon: "configure",
          runOnWorktreeCreate: true,
        },
      ]),
      resolveRpc: (body) => {
        if (body._tag === ORCHESTRATION_WS_METHODS.dispatchCommand) {
          return dispatchPromise;
        }
        return undefined;
      },
    });

    try {
      useComposerDraftStore.getState().setPrompt(THREAD_ID, "Ship it");
      await waitForLayout();

      const sendButton = await waitForSendButton();
      expect(sendButton.disabled).toBe(false);
      sendButton.click();

      await vi.waitFor(
        () => {
          expect(
            wsRequests.some((request) => request._tag === ORCHESTRATION_WS_METHODS.dispatchCommand),
          ).toBe(true);
          expect(document.querySelector('button[aria-label="Sending"]')).toBeTruthy();
          expect(document.querySelector('button[aria-label="Preparing worktree"]')).toBeNull();
        },
        { timeout: 8_000, interval: 16 },
      );
    } finally {
      resolveDispatch({ sequence: fixture.snapshot.snapshotSequence + 1 });
      await mounted.cleanup();
    }
  });

  it("toggles plan mode with Shift+Tab only while the composer is focused", async () => {
    const mounted = await mountChatView({
      viewport: DEFAULT_VIEWPORT,
      snapshot: createSnapshotForTargetUser({
        targetMessageId: "msg-user-target-hotkey" as MessageId,
        targetText: "hotkey target",
      }),
    });

    try {
      const initialModeButton = await waitForInteractionModeButton("Build");
      expect(initialModeButton.title).toContain("enter plan mode");

      window.dispatchEvent(
        new KeyboardEvent("keydown", {
          key: "Tab",
          shiftKey: true,
          bubbles: true,
          cancelable: true,
        }),
      );
      await waitForLayout();

      expect((await waitForInteractionModeButton("Build")).title).toContain("enter plan mode");

      const composerEditor = await waitForComposerEditor();
      composerEditor.focus();
      composerEditor.dispatchEvent(
        new KeyboardEvent("keydown", {
          key: "Tab",
          shiftKey: true,
          bubbles: true,
          cancelable: true,
        }),
      );

      await vi.waitFor(
        async () => {
          expect((await waitForInteractionModeButton("Plan")).title).toContain(
            "return to normal build mode",
          );
        },
        { timeout: 8_000, interval: 16 },
      );

      composerEditor.dispatchEvent(
        new KeyboardEvent("keydown", {
          key: "Tab",
          shiftKey: true,
          bubbles: true,
          cancelable: true,
        }),
      );

      await vi.waitFor(
        async () => {
          expect((await waitForInteractionModeButton("Build")).title).toContain("enter plan mode");
        },
        { timeout: 8_000, interval: 16 },
      );
    } finally {
      await mounted.cleanup();
    }
  });

  it("keeps removed terminal context pills removed when a new one is added", async () => {
    const removedLabel = "Terminal 1 lines 1-2";
    const addedLabel = "Terminal 2 lines 9-10";
    useComposerDraftStore.getState().addTerminalContext(
      THREAD_ID,
      createTerminalContext({
        id: "ctx-removed",
        terminalLabel: "Terminal 1",
        lineStart: 1,
        lineEnd: 2,
        text: "bun i\nno changes",
      }),
    );

    const mounted = await mountChatView({
      viewport: DEFAULT_VIEWPORT,
      snapshot: createSnapshotForTargetUser({
        targetMessageId: "msg-user-terminal-pill-backspace" as MessageId,
        targetText: "terminal pill backspace target",
      }),
    });

    try {
      await vi.waitFor(
        () => {
          expect(document.body.textContent).toContain(removedLabel);
        },
        { timeout: 8_000, interval: 16 },
      );

      const store = useComposerDraftStore.getState();
      const currentPrompt = store.draftsByThreadId[THREAD_ID]?.prompt ?? "";
      const nextPrompt = removeInlineTerminalContextPlaceholder(currentPrompt, 0);
      store.setPrompt(THREAD_ID, nextPrompt.prompt);
      store.removeTerminalContext(THREAD_ID, "ctx-removed");

      await vi.waitFor(
        () => {
          expect(useComposerDraftStore.getState().draftsByThreadId[THREAD_ID]).toBeUndefined();
          expect(document.body.textContent).not.toContain(removedLabel);
        },
        { timeout: 8_000, interval: 16 },
      );

      useComposerDraftStore.getState().addTerminalContext(
        THREAD_ID,
        createTerminalContext({
          id: "ctx-added",
          terminalLabel: "Terminal 2",
          lineStart: 9,
          lineEnd: 10,
          text: "git status\nOn branch main",
        }),
      );

      await vi.waitFor(
        () => {
          const draft = useComposerDraftStore.getState().draftsByThreadId[THREAD_ID];
          expect(draft?.terminalContexts.map((context) => context.id)).toEqual(["ctx-added"]);
          expect(document.body.textContent).toContain(addedLabel);
          expect(document.body.textContent).not.toContain(removedLabel);
        },
        { timeout: 8_000, interval: 16 },
      );
    } finally {
      await mounted.cleanup();
    }
  });

  it("disables send when the composer only contains an expired terminal pill", async () => {
    const expiredLabel = "Terminal 1 line 4";
    useComposerDraftStore.getState().addTerminalContext(
      THREAD_ID,
      createTerminalContext({
        id: "ctx-expired-only",
        terminalLabel: "Terminal 1",
        lineStart: 4,
        lineEnd: 4,
        text: "",
      }),
    );

    const mounted = await mountChatView({
      viewport: DEFAULT_VIEWPORT,
      snapshot: createSnapshotForTargetUser({
        targetMessageId: "msg-user-expired-pill-disabled" as MessageId,
        targetText: "expired pill disabled target",
      }),
    });

    try {
      await vi.waitFor(
        () => {
          expect(document.body.textContent).toContain(expiredLabel);
        },
        { timeout: 8_000, interval: 16 },
      );

      const sendButton = await waitForSendButton();
      expect(sendButton.disabled).toBe(true);
    } finally {
      await mounted.cleanup();
    }
  });

  it("warns when sending text while omitting expired terminal pills", async () => {
    const expiredLabel = "Terminal 1 line 4";
    useComposerDraftStore.getState().addTerminalContext(
      THREAD_ID,
      createTerminalContext({
        id: "ctx-expired-send-warning",
        terminalLabel: "Terminal 1",
        lineStart: 4,
        lineEnd: 4,
        text: "",
      }),
    );
    useComposerDraftStore
      .getState()
      .setPrompt(THREAD_ID, `yoo${INLINE_TERMINAL_CONTEXT_PLACEHOLDER}waddup`);

    const mounted = await mountChatView({
      viewport: DEFAULT_VIEWPORT,
      snapshot: createSnapshotForTargetUser({
        targetMessageId: "msg-user-expired-pill-warning" as MessageId,
        targetText: "expired pill warning target",
      }),
    });

    try {
      await vi.waitFor(
        () => {
          expect(document.body.textContent).toContain(expiredLabel);
        },
        { timeout: 8_000, interval: 16 },
      );

      const sendButton = await waitForSendButton();
      expect(sendButton.disabled).toBe(false);
      sendButton.click();

      await vi.waitFor(
        () => {
          expect(document.body.textContent).toContain(
            "Expired terminal context omitted from message",
          );
          expect(document.body.textContent).not.toContain(expiredLabel);
          expect(document.body.textContent).toContain("yoowaddup");
        },
        { timeout: 8_000, interval: 16 },
      );
    } finally {
      await mounted.cleanup();
    }
  });

  it("shows a pointer cursor for the running stop button", async () => {
    const mounted = await mountChatView({
      viewport: DEFAULT_VIEWPORT,
      snapshot: createSnapshotForTargetUser({
        targetMessageId: "msg-user-stop-button-cursor" as MessageId,
        targetText: "stop button cursor target",
        sessionStatus: "running",
      }),
    });

    try {
      const stopButton = await waitForElement(
        () => document.querySelector<HTMLButtonElement>('button[aria-label="Stop generation"]'),
        "Unable to find stop generation button.",
      );

      expect(getComputedStyle(stopButton).cursor).toBe("pointer");
    } finally {
      await mounted.cleanup();
    }
  });

  it("hides the archive action when the pointer leaves a thread row", async () => {
    const mounted = await mountChatView({
      viewport: DEFAULT_VIEWPORT,
      snapshot: createSnapshotForTargetUser({
        targetMessageId: "msg-user-archive-hover-test" as MessageId,
        targetText: "archive hover target",
      }),
    });

    try {
      const threadRow = page.getByTestId(`thread-row-${THREAD_ID}`);

      await expect.element(threadRow).toBeInTheDocument();
      const archiveButton = await waitForElement(
        () =>
          document.querySelector<HTMLButtonElement>(`[data-testid="thread-archive-${THREAD_ID}"]`),
        "Unable to find archive button.",
      );
      const archiveAction = archiveButton.parentElement;
      expect(
        archiveAction,
        "Archive button should render inside a visibility wrapper.",
      ).not.toBeNull();
      expect(getComputedStyle(archiveAction!).opacity).toBe("0");

      await threadRow.hover();
      await vi.waitFor(
        () => {
          expect(getComputedStyle(archiveAction!).opacity).toBe("1");
        },
        { timeout: 4_000, interval: 16 },
      );

      await page.getByTestId("composer-editor").hover();
      await vi.waitFor(
        () => {
          expect(getComputedStyle(archiveAction!).opacity).toBe("0");
        },
        { timeout: 4_000, interval: 16 },
      );
    } finally {
      await mounted.cleanup();
    }
  });

  it("shows the confirm archive action after clicking the archive button", async () => {
    localStorage.setItem(
      "assist:client-settings:v1",
      JSON.stringify({
        ...DEFAULT_CLIENT_SETTINGS,
        confirmThreadArchive: true,
      }),
    );

    const mounted = await mountChatView({
      viewport: DEFAULT_VIEWPORT,
      snapshot: createSnapshotForTargetUser({
        targetMessageId: "msg-user-archive-confirm-test" as MessageId,
        targetText: "archive confirm target",
      }),
    });

    try {
      const threadRow = page.getByTestId(`thread-row-${THREAD_ID}`);

      await expect.element(threadRow).toBeInTheDocument();
      await threadRow.hover();

      const archiveButton = page.getByTestId(`thread-archive-${THREAD_ID}`);
      await expect.element(archiveButton).toBeInTheDocument();
      await archiveButton.click();

      const confirmButton = page.getByTestId(`thread-archive-confirm-${THREAD_ID}`);
      await expect.element(confirmButton).toBeInTheDocument();
      await expect.element(confirmButton).toBeVisible();
    } finally {
      localStorage.removeItem("assist:client-settings:v1");
      await mounted.cleanup();
    }
  });

  it("keeps the new thread selected after clicking the new-thread button", async () => {
    const mounted = await mountChatView({
      viewport: DEFAULT_VIEWPORT,
      snapshot: createSnapshotForTargetUser({
        targetMessageId: "msg-user-new-thread-test" as MessageId,
        targetText: "new thread selection test",
      }),
    });

    try {
      // Wait for the sidebar to render with the project.
      const newThreadButton = page.getByTestId("new-thread-button");
      await expect.element(newThreadButton).toBeInTheDocument();

      await newThreadButton.click();

      // The route should change to a new draft thread ID.
      const newThreadPath = await waitForURL(
        mounted.router,
        (path) => UUID_ROUTE_RE.test(path),
        "Route should have changed to a new draft thread UUID.",
      );
      const newThreadId = newThreadPath.slice(1) as ThreadId;

      // The composer editor should be present for the new draft thread.
      await waitForComposerEditor();

      // Simulate the steady-state promotion path: the server emits
      // `thread.created`, the client materializes the thread incrementally,
      // and the draft is cleared by live batch effects.
      await promoteDraftThreadViaDomainEvent(newThreadId);

      // The route should still be on the new thread — not redirected away.
      await waitForURL(
        mounted.router,
        (path) => path === newThreadPath,
        "New thread should remain selected after server thread promotion clears the draft.",
      );

      // The empty thread view and composer should still be visible.
      await expect
        .element(page.getByText("Send a message to start the conversation."))
        .toBeInTheDocument();
      await expect.element(page.getByTestId("composer-editor")).toBeInTheDocument();
    } finally {
      await mounted.cleanup();
    }
  });

  it("removes bootstrap UI and re-enables new threads once bootstrap completes", async () => {
    const mounted = await mountChatView({
      viewport: DEFAULT_VIEWPORT,
      snapshot: createSnapshotForTargetUser({
        targetMessageId: "msg-user-bootstrap-exit" as MessageId,
        targetText: "bootstrap exit",
      }),
      configureFixture: (nextFixture) => {
        nextFixture.snapshot = {
          ...nextFixture.snapshot,
          projects: nextFixture.snapshot.projects.map((project) =>
            project.id === PROJECT_ID
              ? {
                  ...project,
                  kind: "assist",
                  bootstrapState: "bootstrapping",
                  bootstrapThreadId: THREAD_ID,
                }
              : project,
          ),
        };
      },
    });

    try {
      await vi.waitFor(
        () => {
          expect(document.body.textContent).toContain(
            ".assist is shaping the project room before normal work opens up.",
          );
        },
        { timeout: 8_000, interval: 16 },
      );

      const newThreadButton = await waitForElement(
        () => document.querySelector<HTMLButtonElement>('[data-testid="new-thread-button"]'),
        "Unable to find new-thread button.",
      );
      expect(newThreadButton.disabled).toBe(true);

      fixture.snapshot = {
        ...fixture.snapshot,
        snapshotSequence: fixture.snapshot.snapshotSequence + 1,
        projects: fixture.snapshot.projects.map((project) =>
          project.id === PROJECT_ID ? { ...project, bootstrapState: "ready" } : project,
        ),
      };
      sendOrchestrationDomainEvent(
        createProjectBootstrapStateSetEvent("ready", fixture.snapshot.snapshotSequence),
      );

      await vi.waitFor(
        () => {
          expect(document.body.textContent).not.toContain(
            ".assist is shaping the project room before normal work opens up.",
          );
          const updatedButton = document.querySelector<HTMLButtonElement>(
            '[data-testid="new-thread-button"]',
          );
          expect(updatedButton).toBeTruthy();
          expect(updatedButton?.disabled).toBe(false);
        },
        { timeout: 8_000, interval: 16 },
      );

      const unlockedNewThreadButton = await waitForElement(
        () => document.querySelector<HTMLButtonElement>('[data-testid="new-thread-button"]'),
        "Unable to find unlocked new-thread button.",
      );
      unlockedNewThreadButton.click();

      await waitForURL(
        mounted.router,
        (path) => UUID_ROUTE_RE.test(path),
        "Route should change to a fresh draft thread once bootstrap is ready.",
      );
    } finally {
      await mounted.cleanup();
    }
  });

  it("snapshots sticky codex settings into a new draft thread", async () => {
    useComposerDraftStore.setState({
      stickyModelSelectionByProvider: {
        codex: {
          provider: "codex",
          model: "gpt-5.3-codex",
          options: {
            reasoningEffort: "medium",
            fastMode: true,
          },
        },
      },
      stickyActiveProvider: "codex",
    });

    const mounted = await mountChatView({
      viewport: DEFAULT_VIEWPORT,
      snapshot: createSnapshotForTargetUser({
        targetMessageId: "msg-user-sticky-codex-traits-test" as MessageId,
        targetText: "sticky codex traits test",
      }),
    });

    try {
      const newThreadButton = page.getByTestId("new-thread-button");
      await expect.element(newThreadButton).toBeInTheDocument();

      await newThreadButton.click();

      const newThreadPath = await waitForURL(
        mounted.router,
        (path) => UUID_ROUTE_RE.test(path),
        "Route should have changed to a new draft thread UUID.",
      );
      const newThreadId = newThreadPath.slice(1) as ThreadId;

      expect(useComposerDraftStore.getState().draftsByThreadId[newThreadId]).toMatchObject({
        modelSelectionByProvider: {
          codex: {
            provider: "codex",
            model: "gpt-5.3-codex",
            options: {
              fastMode: true,
            },
          },
        },
        activeProvider: "codex",
      });
    } finally {
      await mounted.cleanup();
    }
  });

  it("hydrates the provider alongside a sticky claude model", async () => {
    useComposerDraftStore.setState({
      stickyModelSelectionByProvider: {
        claudeAgent: {
          provider: "claudeAgent",
          model: "claude-opus-4-6",
          options: {
            effort: "max",
            fastMode: true,
          },
        },
      },
      stickyActiveProvider: "claudeAgent",
    });

    const mounted = await mountChatView({
      viewport: DEFAULT_VIEWPORT,
      snapshot: createSnapshotForTargetUser({
        targetMessageId: "msg-user-sticky-claude-model-test" as MessageId,
        targetText: "sticky claude model test",
      }),
    });

    try {
      const newThreadButton = page.getByTestId("new-thread-button");
      await expect.element(newThreadButton).toBeInTheDocument();

      await newThreadButton.click();

      const newThreadPath = await waitForURL(
        mounted.router,
        (path) => UUID_ROUTE_RE.test(path),
        "Route should have changed to a new sticky claude draft thread UUID.",
      );
      const newThreadId = newThreadPath.slice(1) as ThreadId;

      expect(useComposerDraftStore.getState().draftsByThreadId[newThreadId]).toMatchObject({
        modelSelectionByProvider: {
          claudeAgent: {
            provider: "claudeAgent",
            model: "claude-opus-4-6",
            options: {
              effort: "max",
              fastMode: true,
            },
          },
        },
        activeProvider: "claudeAgent",
      });
    } finally {
      await mounted.cleanup();
    }
  });

  it("falls back to defaults when no sticky composer settings exist", async () => {
    const mounted = await mountChatView({
      viewport: DEFAULT_VIEWPORT,
      snapshot: createSnapshotForTargetUser({
        targetMessageId: "msg-user-default-codex-traits-test" as MessageId,
        targetText: "default codex traits test",
      }),
    });

    try {
      const newThreadButton = page.getByTestId("new-thread-button");
      await expect.element(newThreadButton).toBeInTheDocument();

      await newThreadButton.click();

      const newThreadPath = await waitForURL(
        mounted.router,
        (path) => UUID_ROUTE_RE.test(path),
        "Route should have changed to a new draft thread UUID.",
      );
      const newThreadId = newThreadPath.slice(1) as ThreadId;

      expect(useComposerDraftStore.getState().draftsByThreadId[newThreadId]).toBeUndefined();
    } finally {
      await mounted.cleanup();
    }
  });

  it("prefers draft state over sticky composer settings and defaults", async () => {
    useComposerDraftStore.setState({
      stickyModelSelectionByProvider: {
        codex: {
          provider: "codex",
          model: "gpt-5.3-codex",
          options: {
            reasoningEffort: "medium",
            fastMode: true,
          },
        },
      },
      stickyActiveProvider: "codex",
    });

    const mounted = await mountChatView({
      viewport: DEFAULT_VIEWPORT,
      snapshot: createSnapshotForTargetUser({
        targetMessageId: "msg-user-draft-codex-traits-precedence-test" as MessageId,
        targetText: "draft codex traits precedence test",
      }),
    });

    try {
      const newThreadButton = page.getByTestId("new-thread-button");
      await expect.element(newThreadButton).toBeInTheDocument();

      await newThreadButton.click();

      const threadPath = await waitForURL(
        mounted.router,
        (path) => UUID_ROUTE_RE.test(path),
        "Route should have changed to a sticky draft thread UUID.",
      );
      const threadId = threadPath.slice(1) as ThreadId;

      expect(useComposerDraftStore.getState().draftsByThreadId[threadId]).toMatchObject({
        modelSelectionByProvider: {
          codex: {
            provider: "codex",
            model: "gpt-5.3-codex",
            options: {
              fastMode: true,
            },
          },
        },
        activeProvider: "codex",
      });

      useComposerDraftStore.getState().setModelSelection(threadId, {
        provider: "codex",
        model: "gpt-5.4",
        options: {
          reasoningEffort: "low",
          fastMode: true,
        },
      });

      await newThreadButton.click();

      await waitForURL(
        mounted.router,
        (path) => path === threadPath,
        "New-thread should reuse the existing project draft thread.",
      );
      expect(useComposerDraftStore.getState().draftsByThreadId[threadId]).toMatchObject({
        modelSelectionByProvider: {
          codex: {
            provider: "codex",
            model: "gpt-5.4",
            options: {
              reasoningEffort: "low",
              fastMode: true,
            },
          },
        },
        activeProvider: "codex",
      });
    } finally {
      await mounted.cleanup();
    }
  });

  it("creates a new thread from the global chat.new shortcut", async () => {
    const mounted = await mountChatView({
      viewport: DEFAULT_VIEWPORT,
      snapshot: createSnapshotForTargetUser({
        targetMessageId: "msg-user-chat-shortcut-test" as MessageId,
        targetText: "chat shortcut test",
      }),
      configureFixture: (nextFixture) => {
        nextFixture.serverConfig = {
          ...nextFixture.serverConfig,
          keybindings: [
            {
              command: "chat.new",
              shortcut: {
                key: "o",
                metaKey: false,
                ctrlKey: false,
                shiftKey: true,
                altKey: false,
                modKey: true,
              },
              whenAst: {
                type: "not",
                node: { type: "identifier", name: "terminalFocus" },
              },
            },
          ],
        };
      },
    });

    try {
      await waitForNewThreadShortcutLabel();
      await waitForServerConfigToApply();
      const composerEditor = await waitForComposerEditor();
      composerEditor.focus();
      await waitForLayout();
      await triggerChatNewShortcutUntilPath(
        mounted.router,
        (path) => UUID_ROUTE_RE.test(path),
        "Route should have changed to a new draft thread UUID from the shortcut.",
      );
    } finally {
      await mounted.cleanup();
    }
  });
  it("creates a fresh draft after the previous draft thread is promoted", async () => {
    const mounted = await mountChatView({
      viewport: DEFAULT_VIEWPORT,
      snapshot: createSnapshotForTargetUser({
        targetMessageId: "msg-user-promoted-draft-shortcut-test" as MessageId,
        targetText: "promoted draft shortcut test",
      }),
      configureFixture: (nextFixture) => {
        nextFixture.serverConfig = {
          ...nextFixture.serverConfig,
          keybindings: [
            {
              command: "chat.new",
              shortcut: {
                key: "o",
                metaKey: false,
                ctrlKey: false,
                shiftKey: true,
                altKey: false,
                modKey: true,
              },
              whenAst: {
                type: "not",
                node: { type: "identifier", name: "terminalFocus" },
              },
            },
          ],
        };
      },
    });

    try {
      const newThreadButton = page.getByTestId("new-thread-button");
      await expect.element(newThreadButton).toBeInTheDocument();
      await waitForNewThreadShortcutLabel();
      await waitForServerConfigToApply();
      await newThreadButton.click();

      const promotedThreadPath = await waitForURL(
        mounted.router,
        (path) => UUID_ROUTE_RE.test(path),
        "Route should have changed to a promoted draft thread UUID.",
      );
      const promotedThreadId = promotedThreadPath.slice(1) as ThreadId;

      await promoteDraftThreadViaDomainEvent(promotedThreadId);

      const freshThreadPath = await triggerChatNewShortcutUntilPath(
        mounted.router,
        (path) => UUID_ROUTE_RE.test(path) && path !== promotedThreadPath,
        "Shortcut should create a fresh draft instead of reusing the promoted thread.",
      );
      expect(freshThreadPath).not.toBe(promotedThreadPath);
    } finally {
      await mounted.cleanup();
    }
  });

  it("keeps long proposed plans lightweight until the user expands them", async () => {
    const mounted = await mountChatView({
      viewport: DEFAULT_VIEWPORT,
      snapshot: createSnapshotWithLongProposedPlan(),
    });

    try {
      await waitForElement(
        () =>
          Array.from(document.querySelectorAll("button")).find(
            (button) => button.textContent?.trim() === "Expand plan",
          ) as HTMLButtonElement | null,
        "Unable to find Expand plan button.",
      );

      expect(document.body.textContent).not.toContain("deep hidden detail only after expand");

      const expandButton = await waitForElement(
        () =>
          Array.from(document.querySelectorAll("button")).find(
            (button) => button.textContent?.trim() === "Expand plan",
          ) as HTMLButtonElement | null,
        "Unable to find Expand plan button.",
      );
      expandButton.click();

      await vi.waitFor(
        () => {
          expect(document.body.textContent).toContain("deep hidden detail only after expand");
        },
        { timeout: 8_000, interval: 16 },
      );
    } finally {
      await mounted.cleanup();
    }
  });

  it("uses the active worktree path when saving a proposed plan to the workspace", async () => {
    const snapshot = createSnapshotWithLongProposedPlan();
    const threads = snapshot.threads.slice();
    const targetThreadIndex = threads.findIndex((thread) => thread.id === THREAD_ID);
    const targetThread = targetThreadIndex >= 0 ? threads[targetThreadIndex] : undefined;
    if (targetThread) {
      threads[targetThreadIndex] = {
        ...targetThread,
        worktreePath: "/repo/worktrees/plan-thread",
      };
    }

    const mounted = await mountChatView({
      viewport: DEFAULT_VIEWPORT,
      snapshot: {
        ...snapshot,
        threads,
      },
    });

    try {
      const planActionsButton = await waitForElement(
        () => document.querySelector<HTMLButtonElement>('button[aria-label="Plan actions"]'),
        "Unable to find proposed plan actions button.",
      );
      planActionsButton.click();

      const saveToWorkspaceItem = await waitForElement(
        () =>
          (Array.from(document.querySelectorAll('[data-slot="menu-item"]')).find(
            (item) => item.textContent?.trim() === "Save to workspace",
          ) ?? null) as HTMLElement | null,
        'Unable to find "Save to workspace" menu item.',
      );
      saveToWorkspaceItem.click();

      await vi.waitFor(
        () => {
          expect(document.body.textContent).toContain(
            "Enter a path relative to /repo/worktrees/plan-thread.",
          );
        },
        { timeout: 8_000, interval: 16 },
      );
    } finally {
      await mounted.cleanup();
    }
  });

  it("keeps pending-question footer actions inside the composer after a real resize", async () => {
    const mounted = await mountChatView({
      viewport: WIDE_FOOTER_VIEWPORT,
      snapshot: createSnapshotWithPendingUserInput(),
    });

    try {
      const firstOption = await waitForButtonContainingText("Tight");
      firstOption.click();

      await waitForButtonByText("Previous");
      await waitForButtonByText("Submit answers");

      await mounted.setContainerSize(COMPACT_FOOTER_VIEWPORT);
      await expectComposerActionsContained();
    } finally {
      await mounted.cleanup();
    }
  });

  it("keeps plan follow-up footer actions fused and aligned after a real resize", async () => {
    const mounted = await mountChatView({
      viewport: WIDE_FOOTER_VIEWPORT,
      snapshot: createSnapshotWithPlanFollowUpPrompt(),
    });

    try {
      const footer = await waitForElement(
        () => document.querySelector<HTMLElement>('[data-chat-composer-footer="true"]'),
        "Unable to find composer footer.",
      );
      const initialModelPicker = await waitForElement(
        findComposerProviderModelPicker,
        "Unable to find provider model picker.",
      );
      const initialModelPickerOffset =
        initialModelPicker.getBoundingClientRect().left - footer.getBoundingClientRect().left;

      await waitForButtonByText("Implement");
      await waitForElement(
        () =>
          document.querySelector<HTMLButtonElement>('button[aria-label="Implementation actions"]'),
        "Unable to find implementation actions trigger.",
      );

      await mounted.setContainerSize({
        width: 440,
        height: WIDE_FOOTER_VIEWPORT.height,
      });
      await expectComposerActionsContained();

      const implementButton = await waitForButtonByText("Implement");
      const implementActionsButton = await waitForElement(
        () =>
          document.querySelector<HTMLButtonElement>('button[aria-label="Implementation actions"]'),
        "Unable to find implementation actions trigger.",
      );

      await vi.waitFor(
        () => {
          const implementRect = implementButton.getBoundingClientRect();
          const implementActionsRect = implementActionsButton.getBoundingClientRect();
          const compactModelPicker = findComposerProviderModelPicker();
          expect(compactModelPicker).toBeTruthy();

          const compactModelPickerOffset =
            compactModelPicker!.getBoundingClientRect().left - footer.getBoundingClientRect().left;

          expect(Math.abs(implementRect.right - implementActionsRect.left)).toBeLessThanOrEqual(1);
          expect(Math.abs(implementRect.top - implementActionsRect.top)).toBeLessThanOrEqual(1);
          expect(Math.abs(compactModelPickerOffset - initialModelPickerOffset)).toBeLessThanOrEqual(
            1,
          );
        },
        { timeout: 8_000, interval: 16 },
      );
    } finally {
      await mounted.cleanup();
    }
  });

  it("keeps the slash-command menu visible above the composer", async () => {
    const mounted = await mountChatView({
      viewport: DEFAULT_VIEWPORT,
      snapshot: createSnapshotForTargetUser({
        targetMessageId: "msg-user-command-menu-target" as MessageId,
        targetText: "command menu thread",
      }),
    });

    try {
      await waitForComposerEditor();
      await page.getByTestId("composer-editor").fill("/");

      const menuItem = await waitForComposerMenuItem("slash:model");
      const composerForm = await waitForElement(
        () => document.querySelector<HTMLElement>('[data-chat-composer-form="true"]'),
        "Unable to find composer form.",
      );

      await vi.waitFor(
        () => {
          const menuRect = menuItem.getBoundingClientRect();
          const composerRect = composerForm.getBoundingClientRect();
          const hitTarget = document.elementFromPoint(
            menuRect.left + menuRect.width / 2,
            menuRect.top + menuRect.height / 2,
          );

          expect(menuRect.width).toBeGreaterThan(0);
          expect(menuRect.height).toBeGreaterThan(0);
          expect(menuRect.bottom).toBeLessThanOrEqual(composerRect.bottom);
          expect(hitTarget instanceof Element && menuItem.contains(hitTarget)).toBe(true);
        },
        { timeout: 8_000, interval: 16 },
      );
    } finally {
      await mounted.cleanup();
    }
  });
});

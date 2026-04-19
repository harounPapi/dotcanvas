import type {
  GitStatusLocalResult,
  GitStatusRemoteResult,
  GitStatusStreamEvent,
  ProjectWorkspaceChangeEvent,
} from "@t3tools/contracts";
import { describe, expect, it, vi } from "vitest";

import { createWsRpcClient } from "./wsRpcClient";
import { type WsTransport } from "./wsTransport";

const baseLocalStatus: GitStatusLocalResult = {
  isRepo: true,
  hasOriginRemote: true,
  isDefaultBranch: false,
  branch: "feature/demo",
  hasWorkingTreeChanges: false,
  workingTree: { files: [], insertions: 0, deletions: 0 },
};

const baseRemoteStatus: GitStatusRemoteResult = {
  hasUpstream: true,
  aheadCount: 0,
  behindCount: 0,
  pr: null,
};

describe("wsRpcClient", () => {
  it("forwards project directory listing requests through the websocket transport", async () => {
    const request: WsTransport["request"] = vi.fn(async <TSuccess>() => {
      return {
        entries: [
          {
            path: "src",
            kind: "directory" as const,
          },
        ],
        truncated: false,
      } as TSuccess;
    }) as WsTransport["request"];
    const transport = {
      dispose: vi.fn(async () => undefined),
      reconnect: vi.fn(async () => undefined),
      request,
      requestStream: vi.fn(),
      subscribe: vi.fn(),
    } satisfies Pick<
      WsTransport,
      "dispose" | "reconnect" | "request" | "requestStream" | "subscribe"
    >;

    const client = createWsRpcClient(transport as unknown as WsTransport);
    const result = await client.projects.listDirectory({
      cwd: "/repo",
      directoryPath: "src",
    });

    expect(result).toEqual({
      entries: [
        {
          path: "src",
          kind: "directory",
        },
      ],
      truncated: false,
    });
    expect(request).toHaveBeenCalledTimes(1);
  });

  it("forwards project file read requests through the websocket transport", async () => {
    const request: WsTransport["request"] = vi.fn(async <TSuccess>() => {
      return {
        relativePath: "README.md",
        contents: "# Readme\n",
        sizeBytes: 9,
        mtimeMs: 123,
      } as TSuccess;
    }) as WsTransport["request"];
    const transport = {
      dispose: vi.fn(async () => undefined),
      reconnect: vi.fn(async () => undefined),
      request,
      requestStream: vi.fn(),
      subscribe: vi.fn(),
    } satisfies Pick<
      WsTransport,
      "dispose" | "reconnect" | "request" | "requestStream" | "subscribe"
    >;

    const client = createWsRpcClient(transport as unknown as WsTransport);
    const result = await client.projects.readFile({
      cwd: "/repo",
      relativePath: "README.md",
    });

    expect(result).toEqual({
      relativePath: "README.md",
      contents: "# Readme\n",
      sizeBytes: 9,
      mtimeMs: 123,
    });
    expect(request).toHaveBeenCalledTimes(1);
  });

  it("forwards project spreadsheet read requests through the websocket transport", async () => {
    const request: WsTransport["request"] = vi.fn(async <TSuccess>() => {
      return {
        relativePath: "roadmap.xlsx",
        previewKind: "workbook-presentation" as const,
        kind: "xlsx" as const,
        sizeBytes: 128,
        mtimeMs: 456,
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
            name: "Sheet1",
            state: "visible" as const,
            showGridLines: true,
            rowCount: 1,
            columnCount: 2,
            rawValues: [["Milestone", "Owner"]],
            displayText: [["Milestone", "Owner"]],
            valueKinds: [["text", "text"]],
            styleIds: [[null, null]],
            merges: [],
            hiddenRows: [],
            hiddenColumns: [],
            rowHeights: [null],
            columnWidths: [null, null],
            comments: [],
            images: [],
            conditionalOverlays: [],
          },
        ],
      } as TSuccess;
    }) as WsTransport["request"];
    const transport = {
      dispose: vi.fn(async () => undefined),
      reconnect: vi.fn(async () => undefined),
      request,
      requestStream: vi.fn(),
      subscribe: vi.fn(),
    } satisfies Pick<
      WsTransport,
      "dispose" | "reconnect" | "request" | "requestStream" | "subscribe"
    >;

    const client = createWsRpcClient(transport as unknown as WsTransport);
    const result = await client.projects.readTabularFile({
      cwd: "/repo",
      relativePath: "roadmap.xlsx",
    });

    expect(result).toEqual({
      relativePath: "roadmap.xlsx",
      previewKind: "workbook-presentation",
      kind: "xlsx",
      sizeBytes: 128,
      mtimeMs: 456,
      capabilities: { canEditInRoom: false },
      presentationFidelity: "full",
      previewNotices: [],
      dateSystem: "1900",
      theme: {
        colors: {},
      },
      styles: [],
      sheets: [
        {
          name: "Sheet1",
          state: "visible",
          showGridLines: true,
          rowCount: 1,
          columnCount: 2,
          rawValues: [["Milestone", "Owner"]],
          displayText: [["Milestone", "Owner"]],
          valueKinds: [["text", "text"]],
          styleIds: [[null, null]],
          merges: [],
          hiddenRows: [],
          hiddenColumns: [],
          rowHeights: [null],
          columnWidths: [null, null],
          comments: [],
          images: [],
          conditionalOverlays: [],
        },
      ],
    });
    expect(request).toHaveBeenCalledTimes(1);
  });

  it("forwards workbook media read requests through the websocket transport", async () => {
    const request: WsTransport["request"] = vi.fn(async <TSuccess>() => {
      return {
        mediaId: "0",
        mimeType: "image/png",
        contentBase64: "Zm9v",
      } as TSuccess;
    }) as WsTransport["request"];
    const transport = {
      dispose: vi.fn(async () => undefined),
      reconnect: vi.fn(async () => undefined),
      request,
      requestStream: vi.fn(),
      subscribe: vi.fn(),
    } satisfies Pick<
      WsTransport,
      "dispose" | "reconnect" | "request" | "requestStream" | "subscribe"
    >;

    const client = createWsRpcClient(transport as unknown as WsTransport);
    const result = await client.projects.readTabularMedia({
      cwd: "/repo",
      relativePath: "roadmap.xlsx",
      mtimeMs: 456,
      mediaId: "0",
    });

    expect(result).toEqual({
      mediaId: "0",
      mimeType: "image/png",
      contentBase64: "Zm9v",
    });
    expect(request).toHaveBeenCalledTimes(1);
  });

  it("forwards workspace change subscriptions through the websocket transport", () => {
    const subscribe = vi.fn(
      <TValue>(_connect: unknown, listener: (value: TValue) => void, _options?: unknown) => {
        listener({
          _tag: "pathChanged",
          relativePath: "README.md",
          exists: true,
          entryKind: "file",
        } as TValue);
        return () => undefined;
      },
    );
    const transport = {
      dispose: vi.fn(async () => undefined),
      reconnect: vi.fn(async () => undefined),
      request: vi.fn(),
      requestStream: vi.fn(),
      subscribe,
    } satisfies Pick<
      WsTransport,
      "dispose" | "reconnect" | "request" | "requestStream" | "subscribe"
    >;

    const client = createWsRpcClient(transport as unknown as WsTransport);
    const listener = vi.fn<(event: ProjectWorkspaceChangeEvent) => void>();

    client.projects.onWorkspaceChange(
      {
        cwd: "/repo",
        directoryPaths: ["src"],
        selectedFilePath: "README.md",
      },
      listener,
    );

    expect(subscribe).toHaveBeenCalledTimes(1);
    expect(listener).toHaveBeenCalledWith({
      _tag: "pathChanged",
      relativePath: "README.md",
      exists: true,
      entryKind: "file",
    });
  });

  it("reduces git status stream events into flat status snapshots", () => {
    const subscribe = vi.fn(<TValue>(_connect: unknown, listener: (value: TValue) => void) => {
      for (const event of [
        {
          _tag: "snapshot",
          local: baseLocalStatus,
          remote: null,
        },
        {
          _tag: "remoteUpdated",
          remote: baseRemoteStatus,
        },
        {
          _tag: "localUpdated",
          local: {
            ...baseLocalStatus,
            hasWorkingTreeChanges: true,
          },
        },
      ] satisfies GitStatusStreamEvent[]) {
        listener(event as TValue);
      }
      return () => undefined;
    });

    const transport = {
      dispose: vi.fn(async () => undefined),
      reconnect: vi.fn(async () => undefined),
      request: vi.fn(),
      requestStream: vi.fn(),
      subscribe,
    } satisfies Pick<
      WsTransport,
      "dispose" | "reconnect" | "request" | "requestStream" | "subscribe"
    >;

    const client = createWsRpcClient(transport as unknown as WsTransport);
    const listener = vi.fn();

    client.git.onStatus({ cwd: "/repo" }, listener);

    expect(listener.mock.calls).toEqual([
      [
        {
          ...baseLocalStatus,
          hasUpstream: false,
          aheadCount: 0,
          behindCount: 0,
          pr: null,
        },
      ],
      [
        {
          ...baseLocalStatus,
          ...baseRemoteStatus,
        },
      ],
      [
        {
          ...baseLocalStatus,
          ...baseRemoteStatus,
          hasWorkingTreeChanges: true,
        },
      ],
    ]);
  });
});

import {
  CommandId,
  DEFAULT_SERVER_SETTINGS,
  DEFAULT_PROJECT_KIND,
  DEFAULT_PROJECT_BOOTSTRAP_STATE,
  type DesktopBridge,
  EventId,
  type GitStatusResult,
  ProjectId,
  type OrchestrationEvent,
  type ServerConfig,
  type ServerProvider,
  type TerminalEvent,
  ThreadId,
} from "@t3tools/contracts";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { ContextMenuItem } from "@t3tools/contracts";

const showContextMenuFallbackMock =
  vi.fn<
    <T extends string>(
      items: readonly ContextMenuItem<T>[],
      position?: { x: number; y: number },
    ) => Promise<T | null>
  >();

function registerListener<T>(listeners: Set<(event: T) => void>, listener: (event: T) => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

const terminalEventListeners = new Set<(event: TerminalEvent) => void>();
const orchestrationEventListeners = new Set<(event: OrchestrationEvent) => void>();
const gitStatusListeners = new Set<(event: GitStatusResult) => void>();
const workspaceChangeListeners = new Set<
  (
    event:
      | {
          _tag: "pathChanged";
          relativePath: string;
          exists: boolean;
          entryKind?: "file" | "directory";
        }
      | {
          _tag: "directoryInvalidated";
          directoryPath?: string;
        },
  ) => void
>();

const rpcClientMock = {
  dispose: vi.fn(),
  terminal: {
    open: vi.fn(),
    write: vi.fn(),
    resize: vi.fn(),
    clear: vi.fn(),
    restart: vi.fn(),
    close: vi.fn(),
    onEvent: vi.fn((listener: (event: TerminalEvent) => void) =>
      registerListener(terminalEventListeners, listener),
    ),
  },
  projects: {
    bootstrapStart: vi.fn(),
    createDirectory: vi.fn(),
    listDirectory: vi.fn(),
    onWorkspaceChange: vi.fn(
      (
        _input: { cwd: string; directoryPaths?: string[]; selectedFilePath?: string },
        listener: (
          event:
            | {
                _tag: "pathChanged";
                relativePath: string;
                exists: boolean;
                entryKind?: "file" | "directory";
              }
            | {
                _tag: "directoryInvalidated";
                directoryPath?: string;
              },
        ) => void,
      ) => registerListener(workspaceChangeListeners, listener),
    ),
    readDocumentFile: vi.fn(),
    readFile: vi.fn(),
    readTabularFile: vi.fn(),
    readTabularMedia: vi.fn(),
    searchEntries: vi.fn(),
    statPath: vi.fn(),
    writeFile: vi.fn(),
    writeTabularFile: vi.fn(),
  },
  capabilities: {
    search: vi.fn(),
    readPluginBundle: vi.fn(),
  },
  shell: {
    openInEditor: vi.fn(),
    openInProjectApp: vi.fn(),
    revealInFileManager: vi.fn(),
  },
  git: {
    pull: vi.fn(),
    refreshStatus: vi.fn(),
    onStatus: vi.fn((input: { cwd: string }, listener: (event: GitStatusResult) => void) =>
      registerListener(gitStatusListeners, listener),
    ),
    runStackedAction: vi.fn(),
    listBranches: vi.fn(),
    createWorktree: vi.fn(),
    removeWorktree: vi.fn(),
    createBranch: vi.fn(),
    checkout: vi.fn(),
    init: vi.fn(),
    resolvePullRequest: vi.fn(),
    preparePullRequestThread: vi.fn(),
  },
  server: {
    getConfig: vi.fn(),
    refreshProviders: vi.fn(),
    upsertKeybinding: vi.fn(),
    getSettings: vi.fn(),
    updateSettings: vi.fn(),
    subscribeConfig: vi.fn(),
    subscribeLifecycle: vi.fn(),
  },
  orchestration: {
    getSnapshot: vi.fn(),
    dispatchCommand: vi.fn(),
    getTurnDiff: vi.fn(),
    getFullThreadDiff: vi.fn(),
    replayEvents: vi.fn(),
    onDomainEvent: vi.fn((listener: (event: OrchestrationEvent) => void) =>
      registerListener(orchestrationEventListeners, listener),
    ),
  },
};

vi.mock("./wsRpcClient", () => {
  return {
    getWsRpcClient: () => rpcClientMock,
    __resetWsRpcClientForTests: vi.fn(),
  };
});

vi.mock("./contextMenuFallback", () => ({
  showContextMenuFallback: showContextMenuFallbackMock,
}));

function emitEvent<T>(listeners: Set<(event: T) => void>, event: T) {
  for (const listener of listeners) {
    listener(event);
  }
}

function getWindowForTest(): Window & typeof globalThis & { desktopBridge?: unknown } {
  const testGlobal = globalThis as typeof globalThis & {
    window?: Window & typeof globalThis & { desktopBridge?: unknown };
  };
  if (!testGlobal.window) {
    testGlobal.window = {} as Window & typeof globalThis & { desktopBridge?: unknown };
  }
  return testGlobal.window;
}

function makeDesktopBridge(overrides: Partial<DesktopBridge> = {}): DesktopBridge {
  return {
    getWsUrl: () => null,
    pickFolder: async () => null,
    confirm: async () => true,
    setTheme: async () => undefined,
    showContextMenu: async () => null,
    openExternal: async () => true,
    onMenuAction: () => () => undefined,
    getUpdateState: async () => {
      throw new Error("getUpdateState not implemented in test");
    },
    checkForUpdate: async () => {
      throw new Error("checkForUpdate not implemented in test");
    },
    downloadUpdate: async () => {
      throw new Error("downloadUpdate not implemented in test");
    },
    installUpdate: async () => {
      throw new Error("installUpdate not implemented in test");
    },
    onUpdateState: () => () => undefined,
    ...overrides,
  };
}

const defaultProviders: ReadonlyArray<ServerProvider> = [
  {
    provider: "codex",
    enabled: true,
    installed: true,
    version: "0.116.0",
    status: "ready",
    auth: { status: "authenticated" },
    checkedAt: "2026-01-01T00:00:00.000Z",
    models: [],
  },
];

const baseServerConfig: ServerConfig = {
  cwd: "/tmp/workspace",
  keybindingsConfigPath: "/tmp/workspace/.config/keybindings.json",
  keybindings: [],
  issues: [],
  providers: defaultProviders,
  availableEditors: ["cursor"],
  availableProjectApps: [],
  observability: {
    logsDirectoryPath: "/tmp/workspace/.config/logs",
    localTracingEnabled: true,
    otlpTracesEnabled: false,
    otlpMetricsEnabled: false,
  },
  settings: DEFAULT_SERVER_SETTINGS,
};

const baseGitStatus: GitStatusResult = {
  isRepo: true,
  hasOriginRemote: true,
  isDefaultBranch: false,
  branch: "feature/streamed",
  hasWorkingTreeChanges: false,
  workingTree: { files: [], insertions: 0, deletions: 0 },
  hasUpstream: true,
  aheadCount: 0,
  behindCount: 0,
  pr: null,
};

beforeEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
  showContextMenuFallbackMock.mockReset();
  terminalEventListeners.clear();
  orchestrationEventListeners.clear();
  gitStatusListeners.clear();
  workspaceChangeListeners.clear();
  Reflect.deleteProperty(getWindowForTest(), "desktopBridge");
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("wsNativeApi", () => {
  it("forwards server config fetches directly to the RPC client", async () => {
    rpcClientMock.server.getConfig.mockResolvedValue(baseServerConfig);
    const { createWsNativeApi } = await import("./wsNativeApi");

    const api = createWsNativeApi();

    await expect(api.server.getConfig()).resolves.toEqual(baseServerConfig);
    expect(rpcClientMock.server.getConfig).toHaveBeenCalledWith();
    expect(rpcClientMock.server.subscribeConfig).not.toHaveBeenCalled();
    expect(rpcClientMock.server.subscribeLifecycle).not.toHaveBeenCalled();
  });

  it("forwards terminal and orchestration stream events", async () => {
    const { createWsNativeApi } = await import("./wsNativeApi");

    const api = createWsNativeApi();
    const onTerminalEvent = vi.fn();
    const onDomainEvent = vi.fn();

    api.terminal.onEvent(onTerminalEvent);
    api.orchestration.onDomainEvent(onDomainEvent);

    const terminalEvent = {
      threadId: "thread-1",
      terminalId: "terminal-1",
      createdAt: "2026-02-24T00:00:00.000Z",
      type: "output",
      data: "hello",
    } as const;
    emitEvent(terminalEventListeners, terminalEvent);

    const orchestrationEvent = {
      sequence: 1,
      eventId: EventId.makeUnsafe("event-1"),
      aggregateKind: "project",
      aggregateId: ProjectId.makeUnsafe("project-1"),
      occurredAt: "2026-02-24T00:00:00.000Z",
      commandId: null,
      causationEventId: null,
      correlationId: null,
      metadata: {},
      type: "project.created",
      payload: {
        projectId: ProjectId.makeUnsafe("project-1"),
        title: "Project",
        workspaceRoot: "/tmp/workspace",
        kind: DEFAULT_PROJECT_KIND,
        bootstrapState: DEFAULT_PROJECT_BOOTSTRAP_STATE,
        bootstrapThreadId: null,
        defaultModelSelection: {
          provider: "codex",
          model: "gpt-5-codex",
        },
        scripts: [],
        createdAt: "2026-02-24T00:00:00.000Z",
        updatedAt: "2026-02-24T00:00:00.000Z",
      },
    } satisfies Extract<OrchestrationEvent, { type: "project.created" }>;
    emitEvent(orchestrationEventListeners, orchestrationEvent);

    expect(onTerminalEvent).toHaveBeenCalledWith(terminalEvent);
    expect(onDomainEvent).toHaveBeenCalledWith(orchestrationEvent);
  });

  it("forwards workspace change stream events", async () => {
    const { createWsNativeApi } = await import("./wsNativeApi");

    const api = createWsNativeApi();
    const onWorkspaceChange = vi.fn();

    api.projects.onWorkspaceChange(
      { cwd: "/tmp/workspace", directoryPaths: ["src"] },
      onWorkspaceChange,
    );

    const event = {
      _tag: "pathChanged" as const,
      relativePath: "src/index.ts",
      exists: true,
      entryKind: "file" as const,
    };
    emitEvent(workspaceChangeListeners, event);

    expect(rpcClientMock.projects.onWorkspaceChange).toHaveBeenCalledWith(
      { cwd: "/tmp/workspace", directoryPaths: ["src"] },
      expect.any(Function),
      undefined,
    );
    expect(onWorkspaceChange).toHaveBeenCalledWith(event);
  });

  it("forwards git status stream events", async () => {
    const { createWsNativeApi } = await import("./wsNativeApi");

    const api = createWsNativeApi();
    const onStatus = vi.fn();

    api.git.onStatus({ cwd: "/repo" }, onStatus);

    const gitStatus = baseGitStatus;
    emitEvent(gitStatusListeners, gitStatus);

    expect(rpcClientMock.git.onStatus).toHaveBeenCalledWith({ cwd: "/repo" }, onStatus, undefined);
    expect(onStatus).toHaveBeenCalledWith(gitStatus);
  });

  it("forwards git status refreshes directly to the RPC client", async () => {
    rpcClientMock.git.refreshStatus.mockResolvedValue(baseGitStatus);
    const { createWsNativeApi } = await import("./wsNativeApi");

    const api = createWsNativeApi();

    await api.git.refreshStatus({ cwd: "/repo" });

    expect(rpcClientMock.git.refreshStatus).toHaveBeenCalledWith({ cwd: "/repo" });
  });

  it("forwards orchestration stream subscription options to the RPC client", async () => {
    const { createWsNativeApi } = await import("./wsNativeApi");

    const api = createWsNativeApi();
    const onDomainEvent = vi.fn();
    const onResubscribe = vi.fn();

    api.orchestration.onDomainEvent(onDomainEvent, { onResubscribe });

    expect(rpcClientMock.orchestration.onDomainEvent).toHaveBeenCalledWith(onDomainEvent, {
      onResubscribe,
    });
  });

  it("sends orchestration dispatch commands as the direct RPC payload", async () => {
    rpcClientMock.orchestration.dispatchCommand.mockResolvedValue({ sequence: 1 });
    const { createWsNativeApi } = await import("./wsNativeApi");

    const api = createWsNativeApi();
    const command = {
      type: "project.create",
      commandId: CommandId.makeUnsafe("cmd-1"),
      projectId: ProjectId.makeUnsafe("project-1"),
      title: "Project",
      workspaceRoot: "/tmp/project",
      kind: DEFAULT_PROJECT_KIND,
      bootstrapState: DEFAULT_PROJECT_BOOTSTRAP_STATE,
      bootstrapThreadId: null,
      defaultModelSelection: {
        provider: "codex",
        model: "gpt-5-codex",
      },
      createdAt: "2026-02-24T00:00:00.000Z",
    } as const;
    await api.orchestration.dispatchCommand(command);

    expect(rpcClientMock.orchestration.dispatchCommand).toHaveBeenCalledWith(command);
  });

  it("forwards workspace file writes to the project RPC", async () => {
    rpcClientMock.projects.writeFile.mockResolvedValue({ relativePath: "plan.md" });
    const { createWsNativeApi } = await import("./wsNativeApi");

    const api = createWsNativeApi();
    await api.projects.writeFile({
      cwd: "/tmp/project",
      relativePath: "plan.md",
      contents: "# Plan\n",
    });

    expect(rpcClientMock.projects.writeFile).toHaveBeenCalledWith({
      cwd: "/tmp/project",
      relativePath: "plan.md",
      contents: "# Plan\n",
    });
  });

  it("forwards project directory creation to the project RPC", async () => {
    rpcClientMock.projects.createDirectory.mockResolvedValue({
      workspaceRoot: "/tmp/projects/New Project",
    });
    const { createWsNativeApi } = await import("./wsNativeApi");

    const api = createWsNativeApi();
    await expect(
      api.projects.createDirectory({
        parentPath: "/tmp/projects",
        directoryName: "New Project",
      }),
    ).resolves.toEqual({
      workspaceRoot: "/tmp/projects/New Project",
    });

    expect(rpcClientMock.projects.createDirectory).toHaveBeenCalledWith({
      parentPath: "/tmp/projects",
      directoryName: "New Project",
    });
  });

  it("forwards project bootstrap start to the project RPC", async () => {
    rpcClientMock.projects.bootstrapStart.mockResolvedValue({
      projectId: ProjectId.makeUnsafe("project-1"),
      threadId: ThreadId.makeUnsafe("thread-1"),
      workspaceRoot: "/tmp/projects/New Project",
    });
    const { createWsNativeApi } = await import("./wsNativeApi");

    const api = createWsNativeApi();
    await expect(
      api.projects.bootstrapStart({
        parentPath: "/tmp/projects",
        projectName: "New Project",
      }),
    ).resolves.toEqual({
      projectId: ProjectId.makeUnsafe("project-1"),
      threadId: ThreadId.makeUnsafe("thread-1"),
      workspaceRoot: "/tmp/projects/New Project",
    });

    expect(rpcClientMock.projects.bootstrapStart).toHaveBeenCalledWith({
      parentPath: "/tmp/projects",
      projectName: "New Project",
    });
  });

  it("forwards project directory listing to the project RPC", async () => {
    rpcClientMock.projects.listDirectory.mockResolvedValue({
      entries: [
        {
          path: "src",
          kind: "directory",
        },
      ],
      truncated: false,
    });
    const { createWsNativeApi } = await import("./wsNativeApi");

    const api = createWsNativeApi();
    await expect(
      api.projects.listDirectory({
        cwd: "/tmp/project",
        directoryPath: "src",
      }),
    ).resolves.toEqual({
      entries: [
        {
          path: "src",
          kind: "directory",
        },
      ],
      truncated: false,
    });

    expect(rpcClientMock.projects.listDirectory).toHaveBeenCalledWith({
      cwd: "/tmp/project",
      directoryPath: "src",
    });
  });

  it("forwards project file reads to the project RPC", async () => {
    rpcClientMock.projects.readFile.mockResolvedValue({
      relativePath: ".assist/memory.md",
      contents: "# Memory\n",
      sizeBytes: 9,
      mtimeMs: 123,
    });
    const { createWsNativeApi } = await import("./wsNativeApi");

    const api = createWsNativeApi();
    await expect(
      api.projects.readFile({
        cwd: "/tmp/project",
        relativePath: ".assist/memory.md",
      }),
    ).resolves.toEqual({
      relativePath: ".assist/memory.md",
      contents: "# Memory\n",
      sizeBytes: 9,
      mtimeMs: 123,
    });

    expect(rpcClientMock.projects.readFile).toHaveBeenCalledWith({
      cwd: "/tmp/project",
      relativePath: ".assist/memory.md",
    });
  });

  it("forwards project document reads to the project RPC", async () => {
    rpcClientMock.projects.readDocumentFile.mockResolvedValue({
      relativePath: "brief.pdf",
      kind: "pdf",
      sizeBytes: 42,
      mtimeMs: 456,
      mimeType: "application/pdf",
      capabilities: { canEditInRoom: false },
      contentBase64: "Zm9v",
    });
    const { createWsNativeApi } = await import("./wsNativeApi");

    const api = createWsNativeApi();
    await expect(
      api.projects.readDocumentFile({
        cwd: "/tmp/project",
        relativePath: "brief.pdf",
      }),
    ).resolves.toEqual({
      relativePath: "brief.pdf",
      kind: "pdf",
      sizeBytes: 42,
      mtimeMs: 456,
      mimeType: "application/pdf",
      capabilities: { canEditInRoom: false },
      contentBase64: "Zm9v",
    });

    expect(rpcClientMock.projects.readDocumentFile).toHaveBeenCalledWith({
      cwd: "/tmp/project",
      relativePath: "brief.pdf",
    });
  });

  it("forwards project spreadsheet reads to the project RPC", async () => {
    rpcClientMock.projects.readTabularFile.mockResolvedValue({
      relativePath: "planning.xlsx",
      previewKind: "workbook-presentation",
      kind: "xlsx",
      sizeBytes: 42,
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
          columnCount: 1,
          rawValues: [["Owner"]],
          displayText: [["Owner"]],
          valueKinds: [["text"]],
          styleIds: [[null]],
          merges: [],
          hiddenRows: [],
          hiddenColumns: [],
          rowHeights: [null],
          columnWidths: [null],
          comments: [],
          images: [],
          conditionalOverlays: [],
        },
      ],
    });
    const { createWsNativeApi } = await import("./wsNativeApi");

    const api = createWsNativeApi();
    await expect(
      api.projects.readTabularFile({
        cwd: "/tmp/project",
        relativePath: "planning.xlsx",
      }),
    ).resolves.toEqual({
      relativePath: "planning.xlsx",
      previewKind: "workbook-presentation",
      kind: "xlsx",
      sizeBytes: 42,
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
          columnCount: 1,
          rawValues: [["Owner"]],
          displayText: [["Owner"]],
          valueKinds: [["text"]],
          styleIds: [[null]],
          merges: [],
          hiddenRows: [],
          hiddenColumns: [],
          rowHeights: [null],
          columnWidths: [null],
          comments: [],
          images: [],
          conditionalOverlays: [],
        },
      ],
    });

    expect(rpcClientMock.projects.readTabularFile).toHaveBeenCalledWith({
      cwd: "/tmp/project",
      relativePath: "planning.xlsx",
    });
  });

  it("forwards workbook media reads to the project RPC", async () => {
    rpcClientMock.projects.readTabularMedia.mockResolvedValue({
      mediaId: "0",
      mimeType: "image/png",
      contentBase64: "Zm9v",
    });
    const { createWsNativeApi } = await import("./wsNativeApi");

    const api = createWsNativeApi();
    await expect(
      api.projects.readTabularMedia({
        cwd: "/tmp/project",
        relativePath: "planning.xlsx",
        mtimeMs: 456,
        mediaId: "0",
      }),
    ).resolves.toEqual({
      mediaId: "0",
      mimeType: "image/png",
      contentBase64: "Zm9v",
    });

    expect(rpcClientMock.projects.readTabularMedia).toHaveBeenCalledWith({
      cwd: "/tmp/project",
      relativePath: "planning.xlsx",
      mtimeMs: 456,
      mediaId: "0",
    });
  });

  it("forwards workspace spreadsheet writes to the project RPC", async () => {
    rpcClientMock.projects.writeTabularFile.mockResolvedValue({ relativePath: "planning.xlsx" });
    const { createWsNativeApi } = await import("./wsNativeApi");

    const api = createWsNativeApi();
    await api.projects.writeTabularFile({
      cwd: "/tmp/project",
      relativePath: "planning.xlsx",
      patches: [
        {
          sheetName: "Sheet1",
          row: 0,
          col: 0,
          value: "Owner",
          valueKind: "text",
        },
      ],
    });

    expect(rpcClientMock.projects.writeTabularFile).toHaveBeenCalledWith({
      cwd: "/tmp/project",
      relativePath: "planning.xlsx",
      patches: [
        {
          sheetName: "Sheet1",
          row: 0,
          col: 0,
          value: "Owner",
          valueKind: "text",
        },
      ],
    });
  });

  it("forwards project path stat requests to the project RPC", async () => {
    rpcClientMock.projects.statPath.mockResolvedValue({
      relativePath: ".assist/project-brief.md",
      exists: true,
      kind: "file",
    });
    const { createWsNativeApi } = await import("./wsNativeApi");

    const api = createWsNativeApi();
    await expect(
      api.projects.statPath({
        cwd: "/tmp/project",
        relativePath: ".assist/project-brief.md",
      }),
    ).resolves.toEqual({
      relativePath: ".assist/project-brief.md",
      exists: true,
      kind: "file",
    });

    expect(rpcClientMock.projects.statPath).toHaveBeenCalledWith({
      cwd: "/tmp/project",
      relativePath: ".assist/project-brief.md",
    });
  });

  it("forwards reveal-in-file-manager requests to the shell RPC", async () => {
    rpcClientMock.shell.revealInFileManager.mockResolvedValue(undefined);
    const { createWsNativeApi } = await import("./wsNativeApi");

    const api = createWsNativeApi();
    await expect(
      api.shell.revealInFileManager({
        path: "/tmp/project/.assist/memory.md",
      }),
    ).resolves.toBeUndefined();

    expect(rpcClientMock.shell.revealInFileManager).toHaveBeenCalledWith({
      path: "/tmp/project/.assist/memory.md",
    });
  });

  it("forwards full-thread diff requests to the orchestration RPC", async () => {
    rpcClientMock.orchestration.getFullThreadDiff.mockResolvedValue({ diff: "patch" });
    const { createWsNativeApi } = await import("./wsNativeApi");

    const api = createWsNativeApi();
    await api.orchestration.getFullThreadDiff({
      threadId: ThreadId.makeUnsafe("thread-1"),
      toTurnCount: 1,
    });

    expect(rpcClientMock.orchestration.getFullThreadDiff).toHaveBeenCalledWith({
      threadId: "thread-1",
      toTurnCount: 1,
    });
  });

  it("forwards provider refreshes directly to the RPC client", async () => {
    const nextProviders: ReadonlyArray<ServerProvider> = [
      {
        ...defaultProviders[0]!,
        checkedAt: "2026-01-03T00:00:00.000Z",
      },
    ];
    rpcClientMock.server.refreshProviders.mockResolvedValue({ providers: nextProviders });
    const { createWsNativeApi } = await import("./wsNativeApi");

    const api = createWsNativeApi();

    await expect(api.server.refreshProviders()).resolves.toEqual({ providers: nextProviders });
    expect(rpcClientMock.server.refreshProviders).toHaveBeenCalledWith();
  });

  it("forwards server settings updates directly to the RPC client", async () => {
    const nextSettings = {
      ...DEFAULT_SERVER_SETTINGS,
      enableAssistantStreaming: true,
    };
    rpcClientMock.server.updateSettings.mockResolvedValue(nextSettings);
    const { createWsNativeApi } = await import("./wsNativeApi");

    const api = createWsNativeApi();

    await expect(api.server.updateSettings({ enableAssistantStreaming: true })).resolves.toEqual(
      nextSettings,
    );
    expect(rpcClientMock.server.updateSettings).toHaveBeenCalledWith({
      enableAssistantStreaming: true,
    });
  });

  it("forwards context menu metadata to the desktop bridge", async () => {
    const showContextMenu = vi.fn().mockResolvedValue("delete");
    getWindowForTest().desktopBridge = makeDesktopBridge({ showContextMenu });

    const { createWsNativeApi } = await import("./wsNativeApi");
    const api = createWsNativeApi();
    const items = [{ id: "delete", label: "Delete" }] as const;

    await expect(api.contextMenu.show(items)).resolves.toBe("delete");
    expect(showContextMenu).toHaveBeenCalledWith(items, undefined);
  });

  it("falls back to the browser context menu helper when the desktop bridge is missing", async () => {
    showContextMenuFallbackMock.mockResolvedValue("rename");
    const { createWsNativeApi } = await import("./wsNativeApi");

    const api = createWsNativeApi();
    const items = [{ id: "rename", label: "Rename" }] as const;

    await expect(api.contextMenu.show(items, { x: 4, y: 5 })).resolves.toBe("rename");
    expect(showContextMenuFallbackMock).toHaveBeenCalledWith(items, { x: 4, y: 5 });
  });
});

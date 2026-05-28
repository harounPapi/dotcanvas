import {
  CommandId,
  DEFAULT_THREAD_INTERACTION_MODE,
  DEFAULT_PROJECT_KIND,
  DEFAULT_PROJECT_BOOTSTRAP_STATE,
  EventId,
  MessageId,
  ProjectId,
  ThreadId,
} from "@t3tools/contracts";
import { describe, expect, it } from "vitest";
import { Effect } from "effect";

import { decideOrchestrationCommand } from "./decider.ts";
import { createEmptyReadModel, projectEvent } from "./projector.ts";

const asEventId = (value: string): EventId => EventId.makeUnsafe(value);
const asProjectId = (value: string): ProjectId => ProjectId.makeUnsafe(value);
const asMessageId = (value: string): MessageId => MessageId.makeUnsafe(value);

async function createReadModelWithProject(input: {
  now: string;
  kind?: "plain" | "assist";
  bootstrapState?: "ready" | "bootstrapping";
}) {
  return Effect.runPromise(
    projectEvent(createEmptyReadModel(input.now), {
      sequence: 1,
      eventId: asEventId("evt-project-create"),
      aggregateKind: "project",
      aggregateId: asProjectId("project-1"),
      type: "project.created",
      occurredAt: input.now,
      commandId: CommandId.makeUnsafe("cmd-project-create"),
      causationEventId: null,
      correlationId: CommandId.makeUnsafe("cmd-project-create"),
      metadata: {},
      payload: {
        projectId: asProjectId("project-1"),
        title: "Project",
        workspaceRoot: "/tmp/project",
        kind: input.kind ?? DEFAULT_PROJECT_KIND,
        bootstrapState: input.bootstrapState ?? DEFAULT_PROJECT_BOOTSTRAP_STATE,
        bootstrapThreadId: null,
        defaultModelSelection: null,
        scripts: [],
        createdAt: input.now,
        updatedAt: input.now,
      },
    }),
  );
}

async function createReadModelWithProjectAndThread(input: {
  now: string;
  kind?: "plain" | "assist";
  bootstrapState?: "ready" | "bootstrapping";
  threadInteractionMode?: "default" | "plan";
}) {
  const withProject = await createReadModelWithProject(input);
  return Effect.runPromise(
    projectEvent(withProject, {
      sequence: 2,
      eventId: asEventId("evt-thread-create"),
      aggregateKind: "thread",
      aggregateId: ThreadId.makeUnsafe("thread-1"),
      type: "thread.created",
      occurredAt: input.now,
      commandId: CommandId.makeUnsafe("cmd-thread-create"),
      causationEventId: null,
      correlationId: CommandId.makeUnsafe("cmd-thread-create"),
      metadata: {},
      payload: {
        threadId: ThreadId.makeUnsafe("thread-1"),
        projectId: asProjectId("project-1"),
        title: "Thread",
        modelSelection: {
          provider: "codex",
          model: "gpt-5-codex",
        },
        interactionMode: input.threadInteractionMode ?? DEFAULT_THREAD_INTERACTION_MODE,
        runtimeMode: "approval-required",
        branch: null,
        worktreePath: null,
        createdAt: input.now,
        updatedAt: input.now,
      },
    }),
  );
}

describe("decider project scripts", () => {
  it("emits empty scripts on project.create", async () => {
    const now = new Date().toISOString();
    const readModel = createEmptyReadModel(now);

    const result = await Effect.runPromise(
      decideOrchestrationCommand({
        command: {
          type: "project.create",
          commandId: CommandId.makeUnsafe("cmd-project-create-scripts"),
          projectId: asProjectId("project-scripts"),
          title: "Scripts",
          workspaceRoot: "/tmp/scripts",
          kind: DEFAULT_PROJECT_KIND,
          bootstrapState: DEFAULT_PROJECT_BOOTSTRAP_STATE,
          createdAt: now,
        },
        readModel,
      }),
    );

    const event = Array.isArray(result) ? result[0] : result;
    expect(event.type).toBe("project.created");
    expect((event.payload as { scripts: unknown[] }).scripts).toEqual([]);
  });

  it("propagates scripts in project.meta.update payload", async () => {
    const now = new Date().toISOString();
    const initial = createEmptyReadModel(now);
    const readModel = await Effect.runPromise(
      projectEvent(initial, {
        sequence: 1,
        eventId: asEventId("evt-project-create-scripts"),
        aggregateKind: "project",
        aggregateId: asProjectId("project-scripts"),
        type: "project.created",
        occurredAt: now,
        commandId: CommandId.makeUnsafe("cmd-project-create-scripts"),
        causationEventId: null,
        correlationId: CommandId.makeUnsafe("cmd-project-create-scripts"),
        metadata: {},
        payload: {
          projectId: asProjectId("project-scripts"),
          title: "Scripts",
          workspaceRoot: "/tmp/scripts",
          kind: DEFAULT_PROJECT_KIND,
          bootstrapState: DEFAULT_PROJECT_BOOTSTRAP_STATE,
          bootstrapThreadId: null,
          defaultModelSelection: null,
          scripts: [],
          createdAt: now,
          updatedAt: now,
        },
      }),
    );

    const scripts = [
      {
        id: "lint",
        name: "Lint",
        command: "bun run lint",
        icon: "lint",
        runOnWorktreeCreate: false,
      },
    ] as const;

    const result = await Effect.runPromise(
      decideOrchestrationCommand({
        command: {
          type: "project.meta.update",
          commandId: CommandId.makeUnsafe("cmd-project-update-scripts"),
          projectId: asProjectId("project-scripts"),
          scripts: Array.from(scripts),
        },
        readModel,
      }),
    );

    const event = Array.isArray(result) ? result[0] : result;
    expect(event.type).toBe("project.meta-updated");
    expect((event.payload as { scripts?: unknown[] }).scripts).toEqual(scripts);
  });

  it("emits user message and turn-start-requested events for thread.turn.start", async () => {
    const now = new Date().toISOString();
    const initial = createEmptyReadModel(now);
    const withProject = await Effect.runPromise(
      projectEvent(initial, {
        sequence: 1,
        eventId: asEventId("evt-project-create"),
        aggregateKind: "project",
        aggregateId: asProjectId("project-1"),
        type: "project.created",
        occurredAt: now,
        commandId: CommandId.makeUnsafe("cmd-project-create"),
        causationEventId: null,
        correlationId: CommandId.makeUnsafe("cmd-project-create"),
        metadata: {},
        payload: {
          projectId: asProjectId("project-1"),
          title: "Project",
          workspaceRoot: "/tmp/project",
          kind: DEFAULT_PROJECT_KIND,
          bootstrapState: DEFAULT_PROJECT_BOOTSTRAP_STATE,
          bootstrapThreadId: null,
          defaultModelSelection: null,
          scripts: [],
          createdAt: now,
          updatedAt: now,
        },
      }),
    );
    const readModel = await Effect.runPromise(
      projectEvent(withProject, {
        sequence: 2,
        eventId: asEventId("evt-thread-create"),
        aggregateKind: "thread",
        aggregateId: ThreadId.makeUnsafe("thread-1"),
        type: "thread.created",
        occurredAt: now,
        commandId: CommandId.makeUnsafe("cmd-thread-create"),
        causationEventId: null,
        correlationId: CommandId.makeUnsafe("cmd-thread-create"),
        metadata: {},
        payload: {
          threadId: ThreadId.makeUnsafe("thread-1"),
          projectId: asProjectId("project-1"),
          title: "Thread",
          modelSelection: {
            provider: "codex",
            model: "gpt-5-codex",
          },
          interactionMode: DEFAULT_THREAD_INTERACTION_MODE,
          runtimeMode: "approval-required",
          branch: null,
          worktreePath: null,
          createdAt: now,
          updatedAt: now,
        },
      }),
    );

    const result = await Effect.runPromise(
      decideOrchestrationCommand({
        command: {
          type: "thread.turn.start",
          commandId: CommandId.makeUnsafe("cmd-turn-start"),
          threadId: ThreadId.makeUnsafe("thread-1"),
          message: {
            messageId: asMessageId("message-user-1"),
            role: "user",
            text: "hello",
            attachments: [],
          },
          modelSelection: {
            provider: "codex",
            model: "gpt-5.3-codex",
            options: {
              reasoningEffort: "high",
              fastMode: true,
            },
          },
          interactionMode: DEFAULT_THREAD_INTERACTION_MODE,
          runtimeMode: "approval-required",
          createdAt: now,
        },
        readModel,
      }),
    );

    expect(Array.isArray(result)).toBe(true);
    const events = Array.isArray(result) ? result : [result];
    expect(events).toHaveLength(2);
    expect(events[0]?.type).toBe("thread.message-sent");
    const turnStartEvent = events[1];
    expect(turnStartEvent?.type).toBe("thread.turn-start-requested");
    expect(turnStartEvent?.causationEventId).toBe(events[0]?.eventId ?? null);
    if (turnStartEvent?.type !== "thread.turn-start-requested") {
      return;
    }
    expect(turnStartEvent.payload).toMatchObject({
      threadId: ThreadId.makeUnsafe("thread-1"),
      messageId: asMessageId("message-user-1"),
      modelSelection: {
        provider: "codex",
        model: "gpt-5.3-codex",
        options: {
          reasoningEffort: "high",
          fastMode: true,
        },
      },
      runtimeMode: "approval-required",
    });
  });

  it("emits thread.runtime-mode-set from thread.runtime-mode.set", async () => {
    const now = new Date().toISOString();
    const initial = createEmptyReadModel(now);
    const withProject = await Effect.runPromise(
      projectEvent(initial, {
        sequence: 1,
        eventId: asEventId("evt-project-create"),
        aggregateKind: "project",
        aggregateId: asProjectId("project-1"),
        type: "project.created",
        occurredAt: now,
        commandId: CommandId.makeUnsafe("cmd-project-create"),
        causationEventId: null,
        correlationId: CommandId.makeUnsafe("cmd-project-create"),
        metadata: {},
        payload: {
          projectId: asProjectId("project-1"),
          title: "Project",
          workspaceRoot: "/tmp/project",
          kind: DEFAULT_PROJECT_KIND,
          bootstrapState: DEFAULT_PROJECT_BOOTSTRAP_STATE,
          bootstrapThreadId: null,
          defaultModelSelection: null,
          scripts: [],
          createdAt: now,
          updatedAt: now,
        },
      }),
    );
    const readModel = await Effect.runPromise(
      projectEvent(withProject, {
        sequence: 2,
        eventId: asEventId("evt-thread-create"),
        aggregateKind: "thread",
        aggregateId: ThreadId.makeUnsafe("thread-1"),
        type: "thread.created",
        occurredAt: now,
        commandId: CommandId.makeUnsafe("cmd-thread-create"),
        causationEventId: null,
        correlationId: CommandId.makeUnsafe("cmd-thread-create"),
        metadata: {},
        payload: {
          threadId: ThreadId.makeUnsafe("thread-1"),
          projectId: asProjectId("project-1"),
          title: "Thread",
          modelSelection: {
            provider: "codex",
            model: "gpt-5-codex",
          },
          interactionMode: DEFAULT_THREAD_INTERACTION_MODE,
          runtimeMode: "full-access",
          branch: null,
          worktreePath: null,
          createdAt: now,
          updatedAt: now,
        },
      }),
    );

    const result = await Effect.runPromise(
      decideOrchestrationCommand({
        command: {
          type: "thread.runtime-mode.set",
          commandId: CommandId.makeUnsafe("cmd-runtime-mode-set"),
          threadId: ThreadId.makeUnsafe("thread-1"),
          runtimeMode: "approval-required",
          createdAt: now,
        },
        readModel,
      }),
    );

    const singleResult = Array.isArray(result) ? null : result;
    if (singleResult === null) {
      throw new Error("Expected a single runtime-mode-set event.");
    }
    expect(singleResult).toMatchObject({
      type: "thread.runtime-mode-set",
      payload: {
        threadId: ThreadId.makeUnsafe("thread-1"),
        runtimeMode: "approval-required",
      },
    });
  });

  it("emits thread.interaction-mode-set from thread.interaction-mode.set", async () => {
    const now = new Date().toISOString();
    const initial = createEmptyReadModel(now);
    const withProject = await Effect.runPromise(
      projectEvent(initial, {
        sequence: 1,
        eventId: asEventId("evt-project-create"),
        aggregateKind: "project",
        aggregateId: asProjectId("project-1"),
        type: "project.created",
        occurredAt: now,
        commandId: CommandId.makeUnsafe("cmd-project-create"),
        causationEventId: null,
        correlationId: CommandId.makeUnsafe("cmd-project-create"),
        metadata: {},
        payload: {
          projectId: asProjectId("project-1"),
          title: "Project",
          workspaceRoot: "/tmp/project",
          kind: DEFAULT_PROJECT_KIND,
          bootstrapState: DEFAULT_PROJECT_BOOTSTRAP_STATE,
          bootstrapThreadId: null,
          defaultModelSelection: null,
          scripts: [],
          createdAt: now,
          updatedAt: now,
        },
      }),
    );
    const readModel = await Effect.runPromise(
      projectEvent(withProject, {
        sequence: 2,
        eventId: asEventId("evt-thread-create"),
        aggregateKind: "thread",
        aggregateId: ThreadId.makeUnsafe("thread-1"),
        type: "thread.created",
        occurredAt: now,
        commandId: CommandId.makeUnsafe("cmd-thread-create"),
        causationEventId: null,
        correlationId: CommandId.makeUnsafe("cmd-thread-create"),
        metadata: {},
        payload: {
          threadId: ThreadId.makeUnsafe("thread-1"),
          projectId: asProjectId("project-1"),
          title: "Thread",
          modelSelection: {
            provider: "codex",
            model: "gpt-5-codex",
          },
          interactionMode: DEFAULT_THREAD_INTERACTION_MODE,
          runtimeMode: "approval-required",
          branch: null,
          worktreePath: null,
          createdAt: now,
          updatedAt: now,
        },
      }),
    );

    const result = await Effect.runPromise(
      decideOrchestrationCommand({
        command: {
          type: "thread.interaction-mode.set",
          commandId: CommandId.makeUnsafe("cmd-interaction-mode-set"),
          threadId: ThreadId.makeUnsafe("thread-1"),
          interactionMode: "plan",
          createdAt: now,
        },
        readModel,
      }),
    );

    const singleResult = Array.isArray(result) ? null : result;
    if (singleResult === null) {
      throw new Error("Expected a single interaction-mode-set event.");
    }
    expect(singleResult).toMatchObject({
      type: "thread.interaction-mode-set",
      payload: {
        threadId: ThreadId.makeUnsafe("thread-1"),
        interactionMode: "plan",
      },
    });
  });

  it("emits project.bootstrap-state-set from project.bootstrap-state.set", async () => {
    const now = new Date().toISOString();
    const readModel = await createReadModelWithProject({ now });

    const result = await Effect.runPromise(
      decideOrchestrationCommand({
        command: {
          type: "project.bootstrap-state.set",
          commandId: CommandId.makeUnsafe("cmd-project-setup-state"),
          projectId: asProjectId("project-1"),
          bootstrapState: "bootstrapping",
          createdAt: now,
        },
        readModel,
      }),
    );

    const singleResult = Array.isArray(result) ? null : result;
    if (singleResult === null) {
      throw new Error("Expected a single project.bootstrap-state-set event.");
    }
    expect(singleResult).toMatchObject({
      type: "project.bootstrap-state-set",
      payload: {
        projectId: asProjectId("project-1"),
        bootstrapState: "bootstrapping",
        updatedAt: now,
      },
    });
  });

  it("rejects extra threads while a .assist project is still bootstrapping", async () => {
    const now = new Date().toISOString();
    const readModel = await createReadModelWithProjectAndThread({
      now,
      kind: "assist",
      bootstrapState: "bootstrapping",
      threadInteractionMode: "default",
    });

    const exit = await Effect.runPromise(
      Effect.exit(
        decideOrchestrationCommand({
          command: {
            type: "thread.create",
            commandId: CommandId.makeUnsafe("cmd-thread-create-2"),
            threadId: ThreadId.makeUnsafe("thread-2"),
            projectId: asProjectId("project-1"),
            title: "Another Thread",
            modelSelection: {
              provider: "codex",
              model: "gpt-5-codex",
            },
            interactionMode: "default",
            runtimeMode: "approval-required",
            branch: null,
            worktreePath: null,
            createdAt: now,
          },
          readModel,
        }),
      ),
    );

    expect(exit._tag).toBe("Failure");
  });

  it("rejects non-Codex bootstrap threads while a .assist project is still bootstrapping", async () => {
    const now = new Date().toISOString();
    const readModel = await createReadModelWithProject({
      now,
      kind: "assist",
      bootstrapState: "bootstrapping",
    });

    const exit = await Effect.runPromise(
      Effect.exit(
        decideOrchestrationCommand({
          command: {
            type: "thread.create",
            commandId: CommandId.makeUnsafe("cmd-thread-create-claude"),
            threadId: ThreadId.makeUnsafe("thread-2"),
            projectId: asProjectId("project-1"),
            title: "Intake",
            modelSelection: {
              provider: "claudeAgent",
              model: "claude-opus-4-6",
            },
            interactionMode: "default",
            runtimeMode: "approval-required",
            branch: null,
            worktreePath: null,
            createdAt: now,
          },
          readModel,
        }),
      ),
    );

    expect(exit._tag).toBe("Failure");
  });

  it("rejects interaction mode changes while bootstrap is locked", async () => {
    const now = new Date().toISOString();
    const readModel = await createReadModelWithProjectAndThread({
      now,
      kind: "assist",
      bootstrapState: "bootstrapping",
      threadInteractionMode: "default",
    });

    const exit = await Effect.runPromise(
      Effect.exit(
        decideOrchestrationCommand({
          command: {
            type: "thread.interaction-mode.set",
            commandId: CommandId.makeUnsafe("cmd-thread-interaction-mode-set"),
            threadId: ThreadId.makeUnsafe("thread-1"),
            interactionMode: "default",
            createdAt: now,
          },
          readModel,
        }),
      ),
    );

    expect(exit._tag).toBe("Failure");
  });

  it("rejects non-Codex turn overrides while bootstrap is still locked", async () => {
    const now = new Date().toISOString();
    const readModel = await createReadModelWithProjectAndThread({
      now,
      kind: "assist",
      bootstrapState: "bootstrapping",
      threadInteractionMode: "default",
    });

    const exit = await Effect.runPromise(
      Effect.exit(
        decideOrchestrationCommand({
          command: {
            type: "thread.turn.start",
            commandId: CommandId.makeUnsafe("cmd-turn-start-claude"),
            threadId: ThreadId.makeUnsafe("thread-1"),
            message: {
              messageId: asMessageId("message-user-claude"),
              role: "user",
              text: "hello",
              attachments: [],
            },
            modelSelection: {
              provider: "claudeAgent",
              model: "claude-opus-4-6",
            },
            interactionMode: "default",
            runtimeMode: "approval-required",
            createdAt: now,
          },
          readModel,
        }),
      ),
    );

    expect(exit._tag).toBe("Failure");
  });
});

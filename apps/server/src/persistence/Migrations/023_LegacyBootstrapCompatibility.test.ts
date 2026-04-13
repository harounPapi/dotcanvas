import { assert, it } from "@effect/vitest";
import { Effect, Layer } from "effect";
import * as SqlClient from "effect/unstable/sql/SqlClient";

import { runMigrations } from "../Migrations.ts";
import * as NodeSqliteClient from "../NodeSqliteClient.ts";

const layer = it.layer(Layer.mergeAll(NodeSqliteClient.layerMemory()));

layer("023_LegacyBootstrapCompatibility", (it) => {
  it.effect("migrates legacy start/setup persistence rows into the bootstrap model", () =>
    Effect.gen(function* () {
      const sql = yield* SqlClient.SqlClient;

      yield* runMigrations({ toMigrationInclusive: 22 });

      yield* sql`
        INSERT INTO projection_projects (
          project_id,
          title,
          workspace_root,
          kind,
          setup_state,
          bootstrap_thread_id,
          default_model_selection_json,
          scripts_json,
          created_at,
          updated_at,
          deleted_at
        )
        VALUES (
          'project-1',
          'Legacy Project',
          '/tmp/project-1',
          'dotcanvas',
          'starting',
          NULL,
          NULL,
          '[]',
          '2026-01-01T00:00:00.000Z',
          '2026-01-01T00:00:00.000Z',
          NULL
        )
      `;

      yield* sql`
        INSERT INTO projection_threads (
          thread_id,
          project_id,
          title,
          model_selection_json,
          runtime_mode,
          interaction_mode,
          branch,
          worktree_path,
          latest_turn_id,
          created_at,
          updated_at,
          archived_at,
          deleted_at
        )
        VALUES (
          'thread-1',
          'project-1',
          'Legacy Thread',
          '{"provider":"codex","model":"gpt-5-codex"}',
          'full-access',
          'start',
          NULL,
          NULL,
          NULL,
          '2026-01-01T00:00:00.000Z',
          '2026-01-01T00:00:00.000Z',
          NULL,
          NULL
        )
      `;

      yield* sql`
        INSERT INTO orchestration_events (
          event_id,
          aggregate_kind,
          stream_id,
          stream_version,
          event_type,
          occurred_at,
          command_id,
          causation_event_id,
          correlation_id,
          actor_kind,
          payload_json,
          metadata_json
        )
        VALUES
        (
          'event-project-created',
          'project',
          'project-1',
          1,
          'project.created',
          '2026-01-01T00:00:00.000Z',
          'command-project-created',
          NULL,
          'correlation-project-created',
          'client',
          '{"projectId":"project-1","title":"Legacy Project","workspaceRoot":"/tmp/project-1","kind":"dotcanvas","setupState":"starting","defaultModelSelection":null,"scripts":[],"createdAt":"2026-01-01T00:00:00.000Z","updatedAt":"2026-01-01T00:00:00.000Z"}',
          '{}'
        ),
        (
          'event-project-setup-state-set',
          'project',
          'project-1',
          2,
          'project.setup-state-set',
          '2026-01-01T00:00:01.000Z',
          'command-project-setup-state-set',
          NULL,
          'correlation-project-setup-state-set',
          'client',
          '{"projectId":"project-1","setupState":"starting","updatedAt":"2026-01-01T00:00:01.000Z"}',
          '{}'
        ),
        (
          'event-thread-created',
          'thread',
          'thread-1',
          1,
          'thread.created',
          '2026-01-01T00:00:00.000Z',
          'command-thread-created',
          NULL,
          'correlation-thread-created',
          'client',
          '{"threadId":"thread-1","projectId":"project-1","title":"Legacy Thread","modelSelection":{"provider":"codex","model":"gpt-5-codex"},"runtimeMode":"full-access","interactionMode":"start","branch":null,"worktreePath":null,"createdAt":"2026-01-01T00:00:00.000Z","updatedAt":"2026-01-01T00:00:00.000Z"}',
          '{}'
        ),
        (
          'event-thread-turn-start-requested',
          'thread',
          'thread-1',
          2,
          'thread.turn-start-requested',
          '2026-01-01T00:00:02.000Z',
          'command-thread-turn-start-requested',
          NULL,
          'correlation-thread-turn-start-requested',
          'client',
          '{"threadId":"thread-1","messageId":"message-1","runtimeMode":"full-access","interactionMode":"start","createdAt":"2026-01-01T00:00:02.000Z"}',
          '{}'
        )
      `;

      yield* runMigrations({ toMigrationInclusive: 23 });

      const projectionRows = yield* sql<{
        readonly setupState: string;
        readonly interactionMode: string;
      }>`
        SELECT
          (SELECT setup_state FROM projection_projects WHERE project_id = 'project-1') AS "setupState",
          (SELECT interaction_mode FROM projection_threads WHERE thread_id = 'thread-1') AS "interactionMode"
      `;

      assert.deepStrictEqual(projectionRows, [
        {
          setupState: "bootstrapping",
          interactionMode: "default",
        },
      ]);

      const eventRows = yield* sql<{
        readonly eventId: string;
        readonly eventType: string;
        readonly payloadJson: string;
      }>`
        SELECT
          event_id AS "eventId",
          event_type AS "eventType",
          payload_json AS "payloadJson"
        FROM orchestration_events
        ORDER BY sequence ASC
      `;

      const payloadByEventId = new Map(
        eventRows.map((row) => [
          row.eventId,
          JSON.parse(row.payloadJson) as Record<string, unknown>,
        ]),
      );

      assert.deepStrictEqual(
        eventRows.map((row) => ({ eventId: row.eventId, eventType: row.eventType })),
        [
          { eventId: "event-project-created", eventType: "project.created" },
          {
            eventId: "event-project-setup-state-set",
            eventType: "project.bootstrap-state-set",
          },
          { eventId: "event-thread-created", eventType: "thread.created" },
          {
            eventId: "event-thread-turn-start-requested",
            eventType: "thread.turn-start-requested",
          },
        ],
      );

      assert.deepStrictEqual(
        payloadByEventId.get("event-project-created")?.bootstrapState,
        "bootstrapping",
      );
      assert.strictEqual(payloadByEventId.get("event-project-created")?.setupState, undefined);
      assert.deepStrictEqual(
        payloadByEventId.get("event-project-setup-state-set")?.bootstrapState,
        "bootstrapping",
      );
      assert.strictEqual(
        payloadByEventId.get("event-project-setup-state-set")?.setupState,
        undefined,
      );
      assert.deepStrictEqual(
        payloadByEventId.get("event-thread-created")?.interactionMode,
        "default",
      );
      assert.deepStrictEqual(
        payloadByEventId.get("event-thread-turn-start-requested")?.interactionMode,
        "default",
      );
    }),
  );
});

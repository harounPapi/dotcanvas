import { assert, it } from "@effect/vitest";
import { Effect, Layer } from "effect";
import * as SqlClient from "effect/unstable/sql/SqlClient";

import { runMigrations } from "../Migrations.ts";
import * as NodeSqliteClient from "../NodeSqliteClient.ts";

const layer = it.layer(Layer.mergeAll(NodeSqliteClient.layerMemory()));

layer("024_ProjectKindAssist", (it) => {
  it.effect("migrates legacy dotcanvas project kinds to assist", () =>
    Effect.gen(function* () {
      const sql = yield* SqlClient.SqlClient;

      yield* runMigrations({ toMigrationInclusive: 23 });

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
          'bootstrapping',
          NULL,
          NULL,
          '[]',
          '2026-01-01T00:00:00.000Z',
          '2026-01-01T00:00:00.000Z',
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
        VALUES (
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
          '{"projectId":"project-1","title":"Legacy Project","workspaceRoot":"/tmp/project-1","kind":"dotcanvas","bootstrapState":"bootstrapping","bootstrapThreadId":null,"defaultModelSelection":null,"scripts":[],"createdAt":"2026-01-01T00:00:00.000Z","updatedAt":"2026-01-01T00:00:00.000Z"}',
          '{}'
        )
      `;

      yield* runMigrations({ toMigrationInclusive: 24 });

      const rows = yield* sql<{
        readonly projectKind: string;
        readonly payloadJson: string;
      }>`
        SELECT
          (SELECT kind FROM projection_projects WHERE project_id = 'project-1') AS "projectKind",
          (SELECT payload_json FROM orchestration_events WHERE event_id = 'event-project-created') AS "payloadJson"
      `;

      assert.deepStrictEqual(rows, [
        {
          projectKind: "assist",
          payloadJson:
            '{"projectId":"project-1","title":"Legacy Project","workspaceRoot":"/tmp/project-1","kind":"assist","bootstrapState":"bootstrapping","bootstrapThreadId":null,"defaultModelSelection":null,"scripts":[],"createdAt":"2026-01-01T00:00:00.000Z","updatedAt":"2026-01-01T00:00:00.000Z"}',
        },
      ]);
    }),
  );
});

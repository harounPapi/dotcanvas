import * as Effect from "effect/Effect";
import * as SqlClient from "effect/unstable/sql/SqlClient";

export default Effect.gen(function* () {
  const sql = yield* SqlClient.SqlClient;

  yield* sql`
    UPDATE projection_projects
    SET setup_state = 'bootstrapping'
    WHERE setup_state = 'starting'
  `;

  yield* sql`
    UPDATE projection_threads
    SET interaction_mode = 'default'
    WHERE interaction_mode = 'start'
  `;

  yield* sql`
    UPDATE orchestration_events
    SET payload_json = json_remove(
      json_set(
        payload_json,
        '$.bootstrapState',
        CASE
          WHEN json_extract(payload_json, '$.setupState') = 'starting' THEN 'bootstrapping'
          ELSE json_extract(payload_json, '$.setupState')
        END
      ),
      '$.setupState'
    )
    WHERE event_type = 'project.created'
      AND json_type(payload_json, '$.setupState') IS NOT NULL
  `;

  yield* sql`
    UPDATE orchestration_events
    SET
      event_type = 'project.bootstrap-state-set',
      payload_json = json_remove(
        json_set(
          payload_json,
          '$.bootstrapState',
          CASE
            WHEN json_extract(payload_json, '$.setupState') = 'starting' THEN 'bootstrapping'
            ELSE json_extract(payload_json, '$.setupState')
          END
        ),
        '$.setupState'
      )
    WHERE event_type = 'project.setup-state-set'
  `;

  yield* sql`
    UPDATE orchestration_events
    SET payload_json = json_set(payload_json, '$.interactionMode', 'default')
    WHERE event_type IN (
      'thread.created',
      'thread.interaction-mode-set',
      'thread.turn-start-requested'
    )
      AND json_extract(payload_json, '$.interactionMode') = 'start'
  `;
});

import * as Effect from "effect/Effect";
import * as SqlClient from "effect/unstable/sql/SqlClient";

export default Effect.gen(function* () {
  const sql = yield* SqlClient.SqlClient;

  yield* sql`
    UPDATE projection_projects
    SET kind = 'assist'
    WHERE kind = 'dotcanvas'
  `;

  yield* sql`
    UPDATE orchestration_events
    SET payload_json = json_set(payload_json, '$.kind', 'assist')
    WHERE event_type = 'project.created'
      AND json_extract(payload_json, '$.kind') = 'dotcanvas'
  `;
});

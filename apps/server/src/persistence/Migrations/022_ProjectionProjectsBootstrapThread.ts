import * as Effect from "effect/Effect";
import * as SqlClient from "effect/unstable/sql/SqlClient";

export default Effect.gen(function* () {
  const sql = yield* SqlClient.SqlClient;

  yield* sql`
    ALTER TABLE projection_projects
    ADD COLUMN bootstrap_thread_id TEXT
  `;

  yield* sql`
    UPDATE projection_projects
    SET setup_state = 'bootstrapping'
    WHERE setup_state = 'starting'
  `;
});

import * as SqlClient from "effect/unstable/sql/SqlClient";
import * as Effect from "effect/Effect";

export default Effect.gen(function* () {
  const sql = yield* SqlClient.SqlClient;

  yield* sql`
    ALTER TABLE projection_projects
    ADD COLUMN kind TEXT NOT NULL DEFAULT 'plain'
  `;

  yield* sql`
    ALTER TABLE projection_projects
    ADD COLUMN setup_state TEXT NOT NULL DEFAULT 'ready'
  `;
});

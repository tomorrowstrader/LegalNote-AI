import pg from "pg";

/**
 * A comment that only the test database carries. Set once on it with:
 *   COMMENT ON DATABASE <name> IS 'legalnote.environment=development';
 * (Neon does not allow custom database settings; schema tools never touch comments.)
 * The live database never has it, so a local server pointed at live refuses to start.
 */
export const DEV_DATABASE_MARKER = "legalnote.environment=development";

export function liveDatabaseDecision(input: {
  nodeEnv: string | undefined;
  marker: string | null | undefined;
}): { ok: true } | { ok: false; message: string } {
  if (input.nodeEnv === "production") return { ok: true };
  if (input.marker?.trim() === DEV_DATABASE_MARKER) return { ok: true };
  return {
    ok: false,
    message:
      "[DB GUARD] Refusing to start: DATABASE_URL is not the test database. A local server must never " +
      `read or change live client data. Point .env at the dev branch (its database comment is '${DEV_DATABASE_MARKER}').`,
  };
}

/** Reads the marker over its own short connection, before anything else touches the database. */
export async function readDatabaseMarker(databaseUrl: string): Promise<string | null> {
  const client = new pg.Client({ connectionString: databaseUrl, connectionTimeoutMillis: 15000 });
  await client.connect();
  try {
    const result = await client.query(
      "SELECT shobj_description(oid, 'pg_database') AS marker FROM pg_database WHERE datname = current_database()",
    );
    return result.rows[0]?.marker ?? null;
  } finally {
    await client.end();
  }
}

/**
 * Stops a non-production process before it reads or writes anything when it is pointed at
 * a database other than the test one. Production is not checked.
 */
export async function assertNotLiveDatabaseOutsideProduction(): Promise<void> {
  if (process.env.NODE_ENV === "production") return;
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) return; // Other startup checks report the missing setting.
  let marker: string | null = null;
  try {
    marker = await readDatabaseMarker(databaseUrl);
  } catch (error) {
    console.error("[DB GUARD] Could not check which database this is:", error instanceof Error ? error.message : error);
  }
  const decision = liveDatabaseDecision({ nodeEnv: process.env.NODE_ENV, marker });
  if (!decision.ok) {
    console.error(decision.message);
    process.exit(1);
  }
}

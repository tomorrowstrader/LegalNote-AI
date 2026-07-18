import { sql } from "drizzle-orm";
import { db } from "./db";
import { coerceVerificationWarnings } from "@shared/verificationWarnings";

/**
 * Migrate documents.verification_warnings from text[] to jsonb of structured
 * VerificationWarning objects. Safe to re-run.
 */
export async function migrateVerificationWarningsToJsonb(): Promise<void> {
  try {
    const col = await db.execute(sql`
      SELECT data_type, udt_name
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'documents'
        AND column_name = 'verification_warnings'
      LIMIT 1
    `);

    const rows = (col.rows ?? col) as Array<{ data_type: string; udt_name: string }>;
    if (rows.length === 0) {
      console.log("[VERIFICATION_WARNINGS_MIGRATION] Column missing — skipping (schema push may create it)");
      return;
    }

    const { data_type: dataType, udt_name: udtName } = rows[0];
    const isTextArray = dataType === "ARRAY" && (udtName === "_text" || udtName === "text");
    const isJsonb = dataType === "jsonb" || udtName === "jsonb";

    if (isTextArray) {
      console.log("[VERIFICATION_WARNINGS_MIGRATION] Converting verification_warnings from text[] to jsonb...");
      await db.execute(sql`
        ALTER TABLE documents
        ALTER COLUMN verification_warnings TYPE jsonb
        USING CASE
          WHEN verification_warnings IS NULL THEN NULL
          ELSE COALESCE(
            (
              SELECT jsonb_agg(
                CASE
                  WHEN trim(elem) LIKE '{%' THEN
                    CASE
                      WHEN trim(elem)::jsonb ? 'documentQuote' THEN trim(elem)::jsonb
                      ELSE jsonb_build_object(
                        'id', gen_random_uuid()::text,
                        'category', 'unsupported_content',
                        'documentQuote', trim(elem),
                        'explanation', 'This statement could not be verified against the meeting record.',
                        'severity', 'review_required',
                        'documentLocation', null,
                        'transcriptQuote', null,
                        'transcriptLocation', null,
                        'resolution', null
                      )
                    END
                  ELSE jsonb_build_object(
                    'id', gen_random_uuid()::text,
                    'category',
                      CASE
                        WHEN lower(elem) LIKE '%[advice without reasoning]%' THEN 'advice_without_reasoning'
                        WHEN lower(elem) LIKE '%verification response could not be parsed%'
                          OR lower(elem) LIKE '%automated verification failed%' THEN 'verification_failure'
                        WHEN lower(elem) LIKE '%i noted%'
                          OR lower(elem) LIKE '%attributes the use%' THEN 'unsupported_attribution'
                        WHEN lower(elem) LIKE '%contradict%' THEN 'contradiction'
                        ELSE 'unsupported_content'
                      END,
                    'documentQuote',
                      CASE
                        WHEN position(' — ' in elem) > 0 THEN left(elem, position(' — ' in elem) - 1)
                        WHEN position(' – ' in elem) > 0 THEN left(elem, position(' – ' in elem) - 1)
                        ELSE regexp_replace(elem, '^\\[Advice without reasoning\\]\\s*', '', 'i')
                      END,
                    'explanation',
                      CASE
                        WHEN position(' — ' in elem) > 0 THEN substr(elem, position(' — ' in elem) + 3)
                        WHEN position(' – ' in elem) > 0 THEN substr(elem, position(' – ' in elem) + 3)
                        ELSE 'This statement could not be verified against the meeting record.'
                      END,
                    'severity', 'review_required',
                    'documentLocation', null,
                    'transcriptQuote', null,
                    'transcriptLocation', null,
                    'resolution', null
                  )
                END
              )
              FROM unnest(verification_warnings) AS elem
            ),
            '[]'::jsonb
          )
        END
      `);
      console.log("[VERIFICATION_WARNINGS_MIGRATION] Column type converted to jsonb");
      return;
    }

    if (isJsonb) {
      // Normalize any legacy string elements that may still sit inside jsonb arrays
      const docs = await db.execute(sql`
        SELECT id, verification_warnings
        FROM documents
        WHERE verification_warnings IS NOT NULL
          AND jsonb_typeof(verification_warnings) = 'array'
          AND EXISTS (
            SELECT 1
            FROM jsonb_array_elements(verification_warnings) AS e(value)
            WHERE jsonb_typeof(e.value) = 'string'
          )
      `);
      const legacy = (docs.rows ?? docs) as Array<{ id: string; verification_warnings: unknown }>;
      if (legacy.length === 0) {
        console.log("[VERIFICATION_WARNINGS_MIGRATION] Already jsonb — nothing to normalize");
        return;
      }
      console.log(
        `[VERIFICATION_WARNINGS_MIGRATION] Normalizing ${legacy.length} document(s) with string elements in jsonb`,
      );
      for (const doc of legacy) {
        const coerced = coerceVerificationWarnings(doc.verification_warnings);
        await db.execute(sql`
          UPDATE documents
          SET verification_warnings = ${JSON.stringify(coerced)}::jsonb
          WHERE id = ${doc.id}
        `);
      }
      console.log("[VERIFICATION_WARNINGS_MIGRATION] Normalization complete");
      return;
    }

    console.log(
      `[VERIFICATION_WARNINGS_MIGRATION] Unexpected column type ${dataType}/${udtName} — skipping`,
    );
  } catch (error) {
    console.error("[VERIFICATION_WARNINGS_MIGRATION] Error during migration:", error);
  }
}

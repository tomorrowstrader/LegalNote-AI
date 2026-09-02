import { sql } from "drizzle-orm";
import { db } from "../db";
import {
  sendGovernedEvaluationConfirmedEmail,
  sendGovernedEvaluationDatesUpdatedEmail,
} from "../email";

export type ScheduledEvaluationEmailType =
  | "evaluation_confirmation"
  | "evaluation_schedule_update";

export type ScheduledEmailRecord = {
  id: string;
  emailType: ScheduledEvaluationEmailType;
  firmId: string;
  toEmail: string;
  payload: Record<string, unknown>;
  sendAt: Date;
  status: "pending" | "sent" | "failed" | "cancelled";
  sentAt: Date | null;
  lastError: string | null;
  createdBy: string | null;
  createdAt: Date;
};

/** Minimum lead before sendAt — anything further in the future is queued, not sent immediately. */
const SCHEDULE_LEAD_MS = 2_000;

function mapRow(row: Record<string, unknown>): ScheduledEmailRecord {
  return {
    id: String(row.id),
    emailType: row.email_type as ScheduledEvaluationEmailType,
    firmId: String(row.firm_id),
    toEmail: String(row.to_email),
    payload: (row.payload as Record<string, unknown>) ?? {},
    sendAt: new Date(row.send_at as string),
    status: row.status as ScheduledEmailRecord["status"],
    sentAt: row.sent_at ? new Date(row.sent_at as string) : null,
    lastError: row.last_error ? String(row.last_error) : null,
    createdBy: row.created_by ? String(row.created_by) : null,
    createdAt: new Date(row.created_at as string),
  };
}

export function shouldScheduleEmail(sendAt: Date, now = new Date()): boolean {
  return sendAt.getTime() > now.getTime() + SCHEDULE_LEAD_MS;
}

export async function cancelPendingScheduledEmailsForFirm(
  firmId: string,
  emailTypes: ScheduledEvaluationEmailType[],
): Promise<void> {
  if (!emailTypes.length) return;
  await db.execute(sql`
    UPDATE scheduled_emails
    SET status = 'cancelled'
    WHERE firm_id = ${firmId}
      AND status = 'pending'
      AND email_type IN (${sql.join(emailTypes.map((t) => sql`${t}`), sql`, `)})
  `);
}

export async function scheduleEvaluationEmail(params: {
  emailType: ScheduledEvaluationEmailType;
  firmId: string;
  toEmail: string;
  sendAt: Date;
  createdBy?: string | null;
  payload: {
    firmName: string;
    evaluationStartsAt?: string | null;
    evaluationEndsAt?: string | null;
  };
}): Promise<ScheduledEmailRecord> {
  await cancelPendingScheduledEmailsForFirm(params.firmId, [params.emailType]);

  const result = await db.execute(sql`
    INSERT INTO scheduled_emails (
      email_type, firm_id, to_email, payload, send_at, created_by
    ) VALUES (
      ${params.emailType},
      ${params.firmId},
      ${params.toEmail},
      ${JSON.stringify(params.payload)}::jsonb,
      ${params.sendAt.toISOString()}::timestamptz,
      ${params.createdBy ?? null}
    )
    RETURNING *
  `);

  const row = (result.rows ?? [])[0];
  if (!row) throw new Error("Failed to create scheduled email");
  return mapRow(row as Record<string, unknown>);
}

export async function getPendingScheduledEmailsForFirms(
  firmIds: string[],
): Promise<Map<string, ScheduledEmailRecord>> {
  if (!firmIds.length) return new Map();

  const result = await db.execute(sql`
    SELECT *
    FROM scheduled_emails
    WHERE firm_id IN (${sql.join(firmIds.map((id) => sql`${id}`), sql`, `)})
      AND status = 'pending'
    ORDER BY send_at ASC
  `);

  const map = new Map<string, ScheduledEmailRecord>();
  for (const row of result.rows ?? []) {
    const record = mapRow(row as Record<string, unknown>);
    if (!map.has(record.firmId)) {
      map.set(record.firmId, record);
    }
  }
  return map;
}

async function sendScheduledEmail(record: ScheduledEmailRecord): Promise<void> {
  const firmName = String(record.payload.firmName ?? "");
  if (record.emailType === "evaluation_confirmation") {
    const starts = record.payload.evaluationStartsAt
      ? new Date(String(record.payload.evaluationStartsAt))
      : null;
    const ends = record.payload.evaluationEndsAt
      ? new Date(String(record.payload.evaluationEndsAt))
      : null;
    if (!starts || !ends || Number.isNaN(starts.getTime()) || Number.isNaN(ends.getTime())) {
      throw new Error("Scheduled confirmation missing valid start/end dates");
    }
    const result = await sendGovernedEvaluationConfirmedEmail({
      to: record.toEmail,
      firmName,
      evaluationStartsAt: starts,
      evaluationEndsAt: ends,
    });
    if (!result.success) {
      throw new Error(result.error || "Failed to send evaluation confirmation email");
    }
    return;
  }

  const result = await sendGovernedEvaluationDatesUpdatedEmail({
    to: record.toEmail,
    firmName,
    evaluationEndsAt: record.payload.evaluationEndsAt
      ? new Date(String(record.payload.evaluationEndsAt))
      : null,
    configurationStartsAt: record.payload.evaluationStartsAt
      ? new Date(String(record.payload.evaluationStartsAt))
      : null,
  });
  if (!result.success) {
    throw new Error(result.error || "Failed to send schedule update email");
  }
}

export async function processDueScheduledEmails(limit = 20): Promise<number> {
  const result = await db.execute(sql`
    SELECT *
    FROM scheduled_emails
    WHERE status = 'pending'
      AND send_at <= now()
    ORDER BY send_at ASC
    LIMIT ${limit}
  `);

  let sent = 0;
  for (const row of result.rows ?? []) {
    const record = mapRow(row as Record<string, unknown>);
    try {
      await sendScheduledEmail(record);
      await db.execute(sql`
        UPDATE scheduled_emails
        SET status = 'sent', sent_at = now(), last_error = NULL
        WHERE id = ${record.id} AND status = 'pending'
      `);
      sent += 1;
      console.log(
        `[SCHEDULED_EMAILS] Sent ${record.emailType} to ${record.toEmail} (firm ${record.firmId})`,
      );
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      await db.execute(sql`
        UPDATE scheduled_emails
        SET status = 'failed', last_error = ${message}
        WHERE id = ${record.id} AND status = 'pending'
      `);
      console.error(`[SCHEDULED_EMAILS] Failed ${record.id}:`, message);
    }
  }
  return sent;
}

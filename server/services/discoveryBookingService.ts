import crypto from "crypto";
import { and, eq, gte, lt, sql } from "drizzle-orm";
import { meetingBookingProposals, meetingBookingSlots, scheduledMeetings, users } from "@shared/schema";
import {
  DISCOVERY_BOOKING,
  DISCOVERY_FALLBACK_URL,
  computeAvailableSlots,
  isOfferedSlot,
} from "@shared/discoveryBooking";
import { db } from "../db";
import { storage } from "../storage";
import {
  createMeetingCalendarEvent,
  createOutlookMeetingCalendarEvent,
  deleteCalendarEvent,
  deleteOutlookCalendarEvent,
  getCalendarBusyIntervals,
  getConnectedProviders,
} from "../calendar";
import {
  sendDiscoveryBookingConfirmationEmail,
  sendDiscoveryBookingOwnerNotification,
} from "../email";

/**
 * LegalNote's own discovery-call booking, on legalnote.ai/talk.
 *
 * The organiser is the LegalNote user whose email is in
 * DISCOVERY_BOOKING_OWNER_EMAIL. Times come from DISCOVERY_BOOKING rules minus
 * the busy times in every calendar they have connected. A booking creates a
 * Teams (or Meet) invite from their calendar and a scheduled meeting with
 * recording on, then sends the prospect LegalNote's real consent email, so they
 * see the product working. The bot joins unless they decline, and a decline
 * never cancels the call. The note is filed as a case discussion (no client
 * letter) and stays with the organiser.
 *
 * Bookings are stored in meeting_booking_proposals (booking_kind "discovery")
 * and deleted 24 months after the call.
 */

const RETENTION_MONTHS = 24;
const AVAILABILITY_CACHE_MS = 60_000;

type Owner = { id: string; email: string | null; firstName: string | null };

export type DiscoveryAvailability =
  | { available: true; timeZone: string; durationMinutes: number; slots: string[] }
  | { available: false; fallbackUrl: string };

let cache: { at: number; value: DiscoveryAvailability } | null = null;

function httpError(status: number, message: string): Error {
  return Object.assign(new Error(message), { status });
}

async function resolveOwner(): Promise<Owner | null> {
  const email = process.env.DISCOVERY_BOOKING_OWNER_EMAIL?.trim().toLowerCase();
  if (!email) return null;
  const [row] = await db
    .select({ id: users.id, email: users.email, firstName: users.firstName })
    .from(users)
    .where(sql`lower(${users.email}) = ${email}`)
    .limit(1);
  return row ?? null;
}

async function bookedStarts(ownerId: string, from: Date): Promise<Date[]> {
  const rows = await db
    .select({ startsAt: meetingBookingProposals.bookedStartsAt })
    .from(meetingBookingProposals)
    .where(
      and(
        eq(meetingBookingProposals.userId, ownerId),
        eq(meetingBookingProposals.bookingKind, "discovery"),
        eq(meetingBookingProposals.status, "booked"),
        gte(meetingBookingProposals.bookedStartsAt, from),
      ),
    );
  return rows.map((r) => r.startsAt).filter((d): d is Date => d instanceof Date);
}

async function freshSlots(owner: Owner, baseUrl: string, now = new Date()): Promise<Date[]> {
  // Look back a day so calls already booked today still count towards the daily cap.
  const from = new Date(now.getTime() - 24 * 3600_000);
  const to = new Date(now.getTime() + (DISCOVERY_BOOKING.horizonDays + 2) * 24 * 3600_000);
  const { busy, providers } = await getCalendarBusyIntervals(owner.id, storage, baseUrl, from, to);
  if (providers.length === 0) {
    throw httpError(503, "No calendar connected for discovery booking");
  }
  return computeAvailableSlots({ now, busy, bookedStarts: await bookedStarts(owner.id, from) });
}

/** Times to show on /talk, or the fallback link if LegalNote can't offer any safely. */
export async function getDiscoveryAvailability(baseUrl: string): Promise<DiscoveryAvailability> {
  if (cache && Date.now() - cache.at < AVAILABILITY_CACHE_MS) return cache.value;

  let value: DiscoveryAvailability;
  // Local design preview only: rule-based times with an empty diary, no calendar needed.
  if (process.env.NODE_ENV === "development" && process.env.DISCOVERY_BOOKING_PREVIEW === "1") {
    const slots = computeAvailableSlots({ now: new Date(), busy: [], bookedStarts: [] });
    return {
      available: true,
      timeZone: DISCOVERY_BOOKING.timeZone,
      durationMinutes: DISCOVERY_BOOKING.durationMinutes,
      slots: slots.map((s) => s.toISOString()),
    };
  }
  try {
    const owner = await resolveOwner();
    if (!owner) {
      value = { available: false, fallbackUrl: DISCOVERY_FALLBACK_URL };
    } else {
      const slots = await freshSlots(owner, baseUrl);
      value = {
        available: true,
        timeZone: DISCOVERY_BOOKING.timeZone,
        durationMinutes: DISCOVERY_BOOKING.durationMinutes,
        slots: slots.map((s) => s.toISOString()),
      };
    }
  } catch (error) {
    console.warn("[DISCOVERY_BOOKING] Availability unavailable, offering fallback:", error instanceof Error ? error.message : error);
    value = { available: false, fallbackUrl: DISCOVERY_FALLBACK_URL };
  }
  cache = { at: Date.now(), value };
  return value;
}

export type BookDiscoveryCallInput = {
  startsAt: Date;
  name: string;
  email: string;
  firm?: string | null;
  intakeAnswer?: string | null;
  source?: string | null;
  baseUrl: string;
};

export async function bookDiscoveryCall(
  input: BookDiscoveryCallInput,
): Promise<{ startsAt: Date; endsAt: Date; platform: "teams" | "meet" }> {
  const owner = await resolveOwner();
  if (!owner) throw httpError(503, "Online booking is paused. Please use the backup booking page.");

  // Check against the diary as it is now, not the cached list the visitor saw.
  let slots: Date[];
  try {
    slots = await freshSlots(owner, input.baseUrl);
  } catch {
    throw httpError(503, "We couldn't check the diary just now. Please try again, or use the backup booking page.");
  }
  if (!isOfferedSlot(input.startsAt, slots)) {
    cache = null;
    throw httpError(409, "That time has just gone. Please choose another.");
  }

  const startsAt = input.startsAt;
  const endsAt = new Date(startsAt.getTime() + DISCOVERY_BOOKING.durationMinutes * 60_000);
  const connected = await getConnectedProviders(owner.id, storage);
  let provider: "outlook" | "google" = connected.outlook.connected ? "outlook" : "google";
  const firm = input.firm?.trim() || null;
  const intakeAnswer = input.intakeAnswer?.trim() || null;
  const source = input.source?.trim() || null;

  // Claim the time first. The unique index stops a second visitor taking it.
  let proposalId: string;
  try {
    const [row] = await db
      .insert(meetingBookingProposals)
      .values({
        userId: owner.id,
        token: crypto.randomBytes(24).toString("base64url"),
        title: DISCOVERY_BOOKING.title,
        clientEmail: input.email,
        clientName: input.name,
        durationMinutes: DISCOVERY_BOOKING.durationMinutes,
        calendarProvider: provider,
        status: "booked",
        bookingKind: "discovery",
        bookedStartsAt: startsAt,
        guestFirm: firm,
        intakeAnswer,
        source,
        respondedAt: new Date(),
        expiresAt: startsAt,
      })
      .returning({ id: meetingBookingProposals.id });
    proposalId = row.id;
  } catch (error: any) {
    if (error?.code === "23505") throw httpError(409, "That time has just gone. Please choose another.");
    throw error;
  }

  const description = [
    `Discovery call booked on legalnote.ai/talk.`,
    `Name: ${input.name}`,
    `Email: ${input.email}`,
    firm ? `Firm: ${firm}` : null,
    intakeAnswer ? `How notes are written today: ${intakeAnswer}` : null,
    source ? `Came from: ${source}` : null,
  ]
    .filter(Boolean)
    .join("\n");
  const eventTitle = `LegalNote discovery call: ${input.name}${firm ? `, ${firm}` : ""}`;

  let calendarEventId: string | undefined;
  let scheduledMeetingId: string | undefined;
  try {
    const event = {
      title: eventTitle,
      description,
      startTime: startsAt,
      endTime: endsAt,
      attendees: [{ email: input.email, name: input.name }],
      createConference: true,
    };
    let result =
      provider === "outlook"
        ? await createOutlookMeetingCalendarEvent(owner.id, event, storage, input.baseUrl)
        : await createMeetingCalendarEvent(owner.id, event, storage);
    // Some Microsoft 365 accounts can't create Teams links (no Teams licence).
    // Rather than lose the booking, use Google Calendar with a Meet link.
    if (provider === "outlook" && (!result.success || !result.eventId || !result.meetingUrl) && connected.google.connected) {
      console.warn("[DISCOVERY_BOOKING] Teams link not available, booking on Google Meet instead:", result.error);
      if (result.eventId) {
        await deleteOutlookCalendarEvent(owner.id, result.eventId, storage, input.baseUrl).catch(() => undefined);
      }
      provider = "google";
      result = await createMeetingCalendarEvent(owner.id, event, storage);
    }
    if (!result.success || !result.eventId) throw new Error(result.error || "Calendar event not created");
    calendarEventId = result.eventId;
    const meetingUrl = result.meetingUrl;
    if (!meetingUrl) throw new Error("Calendar event was created without a join link");
    const meetingPlatform = result.meetingPlatform ?? (provider === "outlook" ? "teams" : "meet");

    // Same downstream path as any booked meeting: it shows in Upcoming Meetings and
    // the bot joins at the start unless the prospect declines by email.
    const meeting = await storage.createScheduledMeeting({
      userId: owner.id,
      calendarEventId,
      calendarProvider: provider,
      title: eventTitle,
      description,
      meetingUrl,
      meetingPlatform,
      startTime: startsAt,
      endTime: endsAt,
      attendees: [{ email: input.email, name: input.name }],
      clientEmail: input.email,
      clientName: input.name,
      autoRecordEnabled: true,
      recordingType: "internal_meeting",
      consentStatus: "pending",
      status: "scheduled",
    });
    scheduledMeetingId = meeting.id;

    const [slot] = await db
      .insert(meetingBookingSlots)
      .values({ proposalId, startsAt, endsAt, status: "selected" })
      .returning({ id: meetingBookingSlots.id });
    await db
      .update(meetingBookingProposals)
      .set({ selectedSlotId: slot.id, calendarEventId, scheduledMeetingId, calendarProvider: provider, updatedAt: new Date() })
      .where(eq(meetingBookingProposals.id, proposalId));

    cache = null;

    void sendDiscoveryBookingConfirmationEmail({
      to: input.email,
      name: input.name,
      startsAt,
      endsAt,
      platform: provider === "outlook" ? "Microsoft Teams" : "Google Meet",
    })
      .then((r) => {
        if (!r.success) console.warn("[DISCOVERY_BOOKING] Confirmation email failed:", r.error);
      })
      .catch((e) => console.warn("[DISCOVERY_BOOKING] Confirmation email failed:", e));

    // The real consent email, as a firm's client would get it. The prospect's own
    // booking triggers it, so this is not the scheduler writing to attendees.
    void (async () => {
      try {
        const { meetingSchedulerService } = await import("./meetingSchedulerService");
        const sent = await meetingSchedulerService.sendConsentEmailForMeeting(meeting);
        if (!sent) {
          console.warn("[DISCOVERY_BOOKING] Consent email not sent for meeting", meeting.id);
          return;
        }
        await storage.createAuditLog({
          userId: owner.id,
          eventType: "pre_consent_email_sent",
          metadata: { meetingId: meeting.id, source: "discovery_booking" },
          severity: "info",
        });
      } catch (e) {
        console.warn("[DISCOVERY_BOOKING] Consent email failed:", e);
      }
    })();

    if (owner.email) {
      void sendDiscoveryBookingOwnerNotification({
        to: owner.email,
        name: input.name,
        email: input.email,
        firm,
        intakeAnswer,
        source,
        startsAt,
      }).catch((e) => console.warn("[DISCOVERY_BOOKING] Owner notification failed:", e));
    }

    // The audit trail is sealed and permanent, so it records the booking but no
    // personal details (not even the visitor's IP address).
    try {
      await storage.createAuditLog({
        userId: owner.id,
        eventType: "discovery_call_booked",
        metadata: { proposalId, meetingId: meeting.id, startsAt: startsAt.toISOString(), source, provider },
        severity: "info",
      });
    } catch (auditError) {
      console.warn("[DISCOVERY_BOOKING] Audit entry failed (booking kept):", auditError);
    }

    return { startsAt, endsAt, platform: provider === "outlook" ? "teams" : "meet" };
  } catch (error) {
    console.error("[DISCOVERY_BOOKING] Booking failed, releasing the time:", error);
    try {
      if (calendarEventId) {
        if (provider === "outlook") await deleteOutlookCalendarEvent(owner.id, calendarEventId, storage, input.baseUrl);
        else await deleteCalendarEvent(owner.id, calendarEventId, storage);
      }
    } catch (cleanupError) {
      console.warn("[DISCOVERY_BOOKING] Calendar cleanup failed:", cleanupError);
    }
    if (scheduledMeetingId) {
      await db
        .update(meetingBookingProposals)
        .set({ scheduledMeetingId: null })
        .where(eq(meetingBookingProposals.id, proposalId));
      await db.delete(scheduledMeetings).where(eq(scheduledMeetings.id, scheduledMeetingId));
    }
    await db.delete(meetingBookingProposals).where(eq(meetingBookingProposals.id, proposalId));
    throw httpError(502, "We couldn't confirm that time. Please try again, or use the backup booking page.");
  }
}

/** Delete discovery bookings 24 months after the call (privacy policy retention). */
export async function purgeOldDiscoveryBookings(now = new Date()): Promise<number> {
  const cutoff = new Date(now);
  cutoff.setMonth(cutoff.getMonth() - RETENTION_MONTHS);
  const deleted = await db
    .delete(meetingBookingProposals)
    .where(
      and(
        eq(meetingBookingProposals.bookingKind, "discovery"),
        lt(meetingBookingProposals.bookedStartsAt, cutoff),
      ),
    )
    .returning({ id: meetingBookingProposals.id });
  return deleted.length;
}

/** For tests. */
export function resetDiscoveryAvailabilityCache(): void {
  cache = null;
}

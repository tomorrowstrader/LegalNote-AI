import { and, eq, isNull, or, sql } from "drizzle-orm";
import { scheduledMeetings, type ScheduledMeeting } from "@shared/schema";
import { db } from "../db";
import { storage } from "../storage";
import { addAttendeeToMeetingEvent } from "../calendar";
import {
  sendMeetingBookingResponseNotification,
  sendMeetingInviteConfirmationEmail,
} from "../email";
import { shouldDefaultAutoRecordEnabled } from "./featureAccessService";
import { meetingWindowEnded, normalizeGuestEmail, normalizeGuestName } from "./guestMeetingDetails";

type Attendee = { email: string; name?: string; responseStatus?: string };

export type PublicGuestClaim = {
  state: "awaiting_email" | "ready" | "unavailable";
  unavailableReason?: "cancelled" | "ended" | "closed";
  startTime: string;
  endTime: string | null;
  organiserName: string | null;
  firmProfile: {
    firmName: string;
    logoUrl: string | null;
    phone?: string | null;
    email?: string | null;
  } | null;
  meetingUrl?: string;
};

function httpsMeetingUrl(url: string | null | undefined): string | null {
  if (!url || !url.startsWith("https://")) return null;
  return url;
}

function readAttendees(value: unknown): Attendee[] {
  if (!Array.isArray(value)) return [];
  const attendees: Attendee[] = [];
  for (const item of value) {
    if (!item || typeof item !== "object") continue;
    const email = (item as { email?: unknown }).email;
    if (typeof email !== "string" || !email.trim()) continue;
    const name = (item as { name?: unknown }).name;
    const responseStatus = (item as { responseStatus?: unknown }).responseStatus;
    attendees.push({
      email,
      name: typeof name === "string" ? name : undefined,
      responseStatus: typeof responseStatus === "string" ? responseStatus : undefined,
    });
  }
  return attendees;
}

async function loadByToken(token: string): Promise<ScheduledMeeting | null> {
  const [meeting] = await db
    .select()
    .from(scheduledMeetings)
    .where(eq(scheduledMeetings.guestClaimToken, token))
    .limit(1);
  return meeting ?? null;
}

async function publicFirm(userId: string) {
  const firmUser = await storage.getUser(userId);
  const firm = firmUser?.firmId
    ? await storage.getFirmProfile(firmUser.firmId)
    : await storage.getFirmProfile();
  return {
    organiserName: firm?.firmName?.trim() || null,
    firmProfile: firm
      ? {
          firmName: firm.firmName,
          logoUrl: firm.logoUrl || null,
          phone: firm.phone || null,
          email: firm.email || null,
        }
      : null,
  };
}

function unavailableReason(
  meeting: ScheduledMeeting,
): PublicGuestClaim["unavailableReason"] | null {
  if (meeting.status === "cancelled") return "cancelled";
  if (meeting.status !== "scheduled") return "closed";
  if (!meeting.clientEmail && meetingWindowEnded(meeting.startTime, meeting.endTime)) {
    return "ended";
  }
  return null;
}

export async function getPublicGuestClaim(token: string): Promise<PublicGuestClaim> {
  const meeting = await loadByToken(token);
  if (!meeting) {
    throw Object.assign(new Error("This meeting link was not found"), { status: 404 });
  }

  const brand = await publicFirm(meeting.userId);
  const reason = unavailableReason(meeting);
  const base = {
    startTime: meeting.startTime.toISOString(),
    endTime: meeting.endTime ? meeting.endTime.toISOString() : null,
    organiserName: brand.organiserName,
    firmProfile: brand.firmProfile,
  };

  if (reason) {
    return { state: "unavailable", unavailableReason: reason, ...base };
  }

  if (meeting.clientEmail) {
    const meetingUrl = httpsMeetingUrl(meeting.meetingUrl);
    return {
      state: "ready",
      ...base,
      ...(meetingUrl ? { meetingUrl } : {}),
    };
  }

  return { state: "awaiting_email", ...base };
}

export async function claimGuestEmail(params: {
  token: string;
  email: unknown;
  name?: unknown;
  baseUrl: string;
  ipAddress?: string;
}): Promise<{ meetingUrl: string; calendarSynced: boolean; startTime: string; endTime: string | null }> {
  const meeting = await loadByToken(params.token);
  if (!meeting) {
    throw Object.assign(new Error("This meeting link was not found"), { status: 404 });
  }

  const reason = unavailableReason(meeting);
  if (reason === "cancelled") {
    throw Object.assign(new Error("This meeting was cancelled"), { status: 410 });
  }
  if (reason === "ended") {
    throw Object.assign(new Error("This meeting has ended"), { status: 410 });
  }
  if (reason === "closed") {
    throw Object.assign(new Error("This meeting link is no longer available"), { status: 410 });
  }

  const meetingUrl = httpsMeetingUrl(meeting.meetingUrl);
  if (!meetingUrl) {
    throw Object.assign(new Error("A join link is not available for this meeting yet"), { status: 502 });
  }

  const email = normalizeGuestEmail(params.email);
  if (!email) {
    throw Object.assign(new Error("Enter a valid email address"), { status: 400 });
  }
  const guestName = normalizeGuestName(params.name);
  const existingEmail = meeting.clientEmail?.trim().toLowerCase() || null;
  if (existingEmail && existingEmail !== email) {
    throw Object.assign(
      new Error("This link has already been used for a different email address"),
      { status: 409 },
    );
  }

  const name = guestName || meeting.clientName || null;
  const attendees = readAttendees(meeting.attendees);
  if (!attendees.some((a) => a.email.toLowerCase() === email)) {
    attendees.push({ email, name: name || undefined });
  }

  const autoRecordEnabled =
    meeting.autoRecordEnabled ||
    (await shouldDefaultAutoRecordEnabled(meeting.userId, email));

  const [updated] = await db
    .update(scheduledMeetings)
    .set({
      clientEmail: email,
      clientName: name,
      attendees,
      autoRecordEnabled,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(scheduledMeetings.id, meeting.id),
        or(
          isNull(scheduledMeetings.clientEmail),
          sql`lower(${scheduledMeetings.clientEmail}) = ${email}`,
        ),
      ),
    )
    .returning();

  if (!updated) {
    const current = await loadByToken(params.token);
    const currentEmail = current?.clientEmail?.trim().toLowerCase() || null;
    if (currentEmail !== email) {
      throw Object.assign(
        new Error("This link has already been used for a different email address"),
        { status: 409 },
      );
    }
  }

  let calendarSynced = false;
  const provider = meeting.calendarProvider === "outlook" ? "outlook" : "google";
  if (meeting.calendarProvider === "google" || meeting.calendarProvider === "outlook") {
    const calendarResult = await addAttendeeToMeetingEvent(
      meeting.userId,
      provider,
      meeting.calendarEventId,
      { email, name: name || undefined },
      storage,
      params.baseUrl,
    );
    calendarSynced = calendarResult.success && calendarResult.calendarNotified;
    if (!calendarResult.success) {
      console.warn("[GUEST_CLAIM] Calendar attendee update failed:", calendarResult.error);
    }
  }

  void (async () => {
    try {
      const organiserUser = await storage.getUser(meeting.userId);
      const organiserFirm = organiserUser?.firmId
        ? await storage.getFirmProfile(organiserUser.firmId)
        : await storage.getFirmProfile();
      await sendMeetingInviteConfirmationEmail({
        to: email,
        recipientName: name || undefined,
        meetingTitle: meeting.title,
        startTime: meeting.startTime,
        endTime: meeting.endTime || undefined,
        meetingUrl,
        meetingPlatform: meeting.meetingPlatform || undefined,
        firmName: organiserFirm?.firmName?.trim() || null,
        firmLogoUrl: organiserFirm?.logoUrl?.trim() || null,
      });
    } catch (emailErr) {
      console.warn("[GUEST_CLAIM] Confirmation email failed:", emailErr);
    }
  })();

  void (async () => {
    try {
      const organiser = await storage.getUser(meeting.userId);
      if (!organiser?.email) return;
      await sendMeetingBookingResponseNotification({
        to: organiser.email,
        recipientFirstName: organiser.firstName,
        responseStatus: "email_added",
        meetingTitle: meeting.title,
        clientName: name,
        clientEmail: email,
        startsAt: meeting.startTime,
        caseId: meeting.caseId,
      });
    } catch (emailErr) {
      console.warn("[GUEST_CLAIM] Organiser notification failed:", emailErr);
    }
  })();

  await storage.createAuditLog({
    eventType: "meeting_guest_email_added",
    userId: meeting.userId,
    caseId: meeting.caseId || undefined,
    ipAddress: params.ipAddress,
    metadata: {
      meetingId: meeting.id,
      clientEmail: email,
      calendarSynced,
    },
    severity: "info",
  });

  return {
    meetingUrl,
    calendarSynced,
    startTime: meeting.startTime.toISOString(),
    endTime: meeting.endTime ? meeting.endTime.toISOString() : null,
  };
}

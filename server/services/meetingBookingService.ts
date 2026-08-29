import crypto from "crypto";
import { and, desc, eq, inArray, sql } from "drizzle-orm";
import {
  meetingBookingProposals,
  meetingBookingSlots,
  type MeetingBookingProposal,
  type MeetingBookingSlot,
  type ScheduledMeeting,
} from "@shared/schema";
import { db } from "../db";
import { storage } from "../storage";
import {
  createMeetingCalendarEvent,
  createOutlookMeetingCalendarEvent,
  deleteCalendarEvent,
  deleteOutlookCalendarEvent,
  getConnectedProviders,
} from "../calendar";
import {
  sendMeetingBookingProposalEmail,
  sendMeetingBookingProposalUpdatedEmail,
  sendMeetingInviteConfirmationEmail,
  sendMeetingBookingResponseNotification,
} from "../email";

const MIN_SLOTS = 2;
const MAX_SLOTS = 5;
const DEFAULT_EXPIRY_DAYS = 7;

export type BookingSlotInput = { startsAt: Date; endsAt: Date };

export type CreateBookingProposalInput = {
  userId: string;
  title: string;
  description?: string;
  clientEmail: string;
  clientName?: string;
  caseId?: string;
  durationMinutes: number;
  calendarProvider?: "google" | "outlook";
  slots: BookingSlotInput[];
  expiresAt?: Date;
  baseUrl: string;
  /** Request-derived host for Outlook OAuth redirects when creating events later */
  requestBaseUrl?: string;
};

export type ProposalWithSlots = MeetingBookingProposal & {
  slots: MeetingBookingSlot[];
  bookingUrl?: string;
};

function generateToken(): string {
  return crypto.randomBytes(32).toString("hex");
}

function validateSlotTimes(slots: BookingSlotInput[], now = new Date()): void {
  for (const slot of slots) {
    if (isNaN(slot.startsAt.getTime()) || isNaN(slot.endsAt.getTime())) {
      throw Object.assign(new Error("Invalid slot date/time"), { status: 400 });
    }
    if (slot.startsAt <= now) {
      throw Object.assign(new Error("All proposed times must be in the future"), { status: 400 });
    }
    if (slot.endsAt <= slot.startsAt) {
      throw Object.assign(new Error("Each slot end time must be after its start"), { status: 400 });
    }
  }
}

function detectPlatform(
  meetingUrl: string | undefined,
): "zoom" | "teams" | "meet" | "webex" | undefined {
  if (!meetingUrl) return undefined;
  const urlLower = meetingUrl.toLowerCase();
  if (urlLower.includes("zoom.us")) return "zoom";
  if (urlLower.includes("teams.microsoft.com") || urlLower.includes("teams.live.com")) {
    return "teams";
  }
  if (urlLower.includes("meet.google.com")) return "meet";
  if (urlLower.includes("webex.com")) return "webex";
  return undefined;
}

export async function createMeetingBookingProposal(
  input: CreateBookingProposalInput,
): Promise<ProposalWithSlots> {
  if (input.slots.length < MIN_SLOTS || input.slots.length > MAX_SLOTS) {
    throw Object.assign(
      new Error(`Propose between ${MIN_SLOTS} and ${MAX_SLOTS} time slots`),
      { status: 400 },
    );
  }

  const now = new Date();
  validateSlotTimes(input.slots, now);

  if (input.caseId) {
    const caseData = await storage.getCase(input.caseId, input.userId);
    if (!caseData) {
      throw Object.assign(new Error("Case not found or not authorized"), { status: 403 });
    }
  }

  const connections = await getConnectedProviders(input.userId, storage);
  const googleConnected = connections.google.connected;
  const outlookConnected = connections.outlook.connected;
  if (!googleConnected && !outlookConnected) {
    throw Object.assign(
      new Error("Calendar not connected. Please connect Google Calendar or Outlook in Settings."),
      { status: 400, needsCalendarConnection: true },
    );
  }

  let provider: "google" | "outlook" =
    input.calendarProvider || (outlookConnected ? "outlook" : "google");
  if (provider === "google" && !googleConnected) provider = "outlook";
  if (provider === "outlook" && !outlookConnected) provider = "google";

  const token = generateToken();
  const expiresAt =
    input.expiresAt && input.expiresAt > now
      ? input.expiresAt
      : new Date(now.getTime() + DEFAULT_EXPIRY_DAYS * 24 * 60 * 60 * 1000);

  const [proposal] = await db
    .insert(meetingBookingProposals)
    .values({
      userId: input.userId,
      caseId: input.caseId || null,
      token,
      title: input.title,
      description: input.description || null,
      clientEmail: input.clientEmail.toLowerCase().trim(),
      clientName: input.clientName?.trim() || null,
      durationMinutes: input.durationMinutes,
      calendarProvider: provider,
      status: "pending",
      expiresAt,
      emailStatus: "pending",
    })
    .returning();

  const insertedSlots = await db
    .insert(meetingBookingSlots)
    .values(
      input.slots.map((s) => ({
        proposalId: proposal.id,
        startsAt: s.startsAt,
        endsAt: s.endsAt,
        status: "available" as const,
      })),
    )
    .returning();

  const bookingUrl = `${input.baseUrl.replace(/\/$/, "")}/book/${token}`;

  const organiserUser = await storage.getUser(input.userId);
  const organiserFirm = organiserUser?.firmId
    ? await storage.getFirmProfile(organiserUser.firmId)
    : await storage.getFirmProfile();
  const organiserName = organiserFirm?.firmName?.trim() || null;

  try {
    const emailResult = await sendMeetingBookingProposalEmail({
      to: proposal.clientEmail,
      recipientName: proposal.clientName || undefined,
      bookingUrl,
      slots: insertedSlots.map((s) => ({ startsAt: s.startsAt, endsAt: s.endsAt })),
      durationMinutes: proposal.durationMinutes,
      organiserName,
    });

    await db
      .update(meetingBookingProposals)
      .set({
        emailSentAt: emailResult.success ? new Date() : null,
        emailStatus: emailResult.success ? "sent" : "failed",
      })
      .where(eq(meetingBookingProposals.id, proposal.id));

    proposal.emailStatus = emailResult.success ? "sent" : "failed";
    proposal.emailSentAt = emailResult.success ? new Date() : null;
  } catch (err) {
    console.warn("[MEETING_BOOKING] Proposal email failed:", err);
    await db
      .update(meetingBookingProposals)
      .set({ emailStatus: "failed" })
      .where(eq(meetingBookingProposals.id, proposal.id));
    proposal.emailStatus = "failed";
  }

  await storage.createAuditLog({
    eventType: "meeting_booking_proposed",
    userId: input.userId,
    caseId: input.caseId || undefined,
    metadata: {
      proposalId: proposal.id,
      slotCount: insertedSlots.length,
      clientEmail: proposal.clientEmail,
      emailStatus: proposal.emailStatus,
    },
    severity: "info",
  });

  return { ...proposal, slots: insertedSlots, bookingUrl };
}

export async function listMeetingBookingProposals(
  userId: string,
  opts?: { status?: string },
): Promise<ProposalWithSlots[]> {
  await expireStaleMeetingBookingProposals(userId);

  const conditions = [eq(meetingBookingProposals.userId, userId)];
  if (opts?.status) {
    conditions.push(eq(meetingBookingProposals.status, opts.status));
  }

  const proposals = await db
    .select()
    .from(meetingBookingProposals)
    .where(and(...conditions))
    .orderBy(desc(meetingBookingProposals.createdAt))
    .limit(50);

  if (proposals.length === 0) return [];

  const slots = await db
    .select()
    .from(meetingBookingSlots)
    .where(
      inArray(
        meetingBookingSlots.proposalId,
        proposals.map((p) => p.id),
      ),
    )
    .orderBy(meetingBookingSlots.startsAt);

  const byProposal = new Map<string, MeetingBookingSlot[]>();
  for (const slot of slots) {
    const list = byProposal.get(slot.proposalId) || [];
    list.push(slot);
    byProposal.set(slot.proposalId, list);
  }

  return proposals.map((p) => ({
    ...p,
    slots: byProposal.get(p.id) || [],
  }));
}

export async function cancelMeetingBookingProposal(
  userId: string,
  proposalId: string,
): Promise<MeetingBookingProposal> {
  const [proposal] = await db
    .select()
    .from(meetingBookingProposals)
    .where(
      and(eq(meetingBookingProposals.id, proposalId), eq(meetingBookingProposals.userId, userId)),
    )
    .limit(1);

  if (!proposal) {
    throw Object.assign(new Error("Booking proposal not found"), { status: 404 });
  }
  if (proposal.status !== "pending") {
    throw Object.assign(new Error("Only pending proposals can be cancelled"), { status: 400 });
  }

  const [updated] = await db
    .update(meetingBookingProposals)
    .set({ status: "cancelled", updatedAt: new Date() })
    .where(eq(meetingBookingProposals.id, proposalId))
    .returning();

  await db
    .update(meetingBookingSlots)
    .set({ status: "withdrawn" })
    .where(
      and(
        eq(meetingBookingSlots.proposalId, proposalId),
        eq(meetingBookingSlots.status, "available"),
      ),
    );

  await storage.createAuditLog({
    eventType: "meeting_booking_cancelled",
    userId,
    caseId: proposal.caseId || undefined,
    metadata: { proposalId },
    severity: "info",
  });

  return updated;
}

export type UpdateBookingProposalSlotsInput = {
  userId: string;
  proposalId: string;
  removeSlotIds?: string[];
  addSlots?: Array<{ startsAt: Date; endsAt?: Date }>;
  notifyClient?: boolean;
  baseUrl: string;
};

export async function updateMeetingBookingProposalSlots(
  input: UpdateBookingProposalSlotsInput,
): Promise<ProposalWithSlots> {
  const [proposal] = await db
    .select()
    .from(meetingBookingProposals)
    .where(
      and(
        eq(meetingBookingProposals.id, input.proposalId),
        eq(meetingBookingProposals.userId, input.userId),
      ),
    )
    .limit(1);

  if (!proposal) {
    throw Object.assign(new Error("Booking proposal not found"), { status: 404 });
  }

  if (proposal.status === "pending" && proposal.expiresAt <= new Date()) {
    await markProposalExpired(proposal);
    throw Object.assign(new Error("This booking proposal has expired"), { status: 410 });
  }

  if (proposal.status !== "pending") {
    throw Object.assign(new Error("Only pending proposals can be edited"), { status: 400 });
  }

  const slots = await db
    .select()
    .from(meetingBookingSlots)
    .where(eq(meetingBookingSlots.proposalId, proposal.id))
    .orderBy(meetingBookingSlots.startsAt);

  const available = slots.filter((s) => s.status === "available");
  const removeSlotIds = [...new Set(input.removeSlotIds ?? [])];
  const addSlots = input.addSlots ?? [];

  if (removeSlotIds.length === 0 && addSlots.length === 0) {
    throw Object.assign(new Error("No slot changes provided"), { status: 400 });
  }

  const availableIds = new Set(available.map((s) => s.id));
  for (const id of removeSlotIds) {
    if (!availableIds.has(id)) {
      throw Object.assign(new Error("One or more times could not be removed"), { status: 400 });
    }
  }

  validateSlotTimes(
    addSlots.map((s) => ({
      startsAt: s.startsAt,
      endsAt: s.endsAt ?? new Date(s.startsAt.getTime() + proposal.durationMinutes * 60 * 1000),
    })),
  );

  const remainingCount = available.length - removeSlotIds.length + addSlots.length;
  if (remainingCount < MIN_SLOTS) {
    throw Object.assign(
      new Error(`At least ${MIN_SLOTS} time options must remain — cancel the proposal instead`),
      { status: 400 },
    );
  }
  if (remainingCount > MAX_SLOTS) {
    throw Object.assign(
      new Error(`No more than ${MAX_SLOTS} time options are allowed`),
      { status: 400 },
    );
  }

  if (removeSlotIds.length > 0) {
    await db
      .update(meetingBookingSlots)
      .set({ status: "withdrawn" })
      .where(
        and(
          eq(meetingBookingSlots.proposalId, proposal.id),
          inArray(meetingBookingSlots.id, removeSlotIds),
          eq(meetingBookingSlots.status, "available"),
        ),
      );
  }

  if (addSlots.length > 0) {
    await db.insert(meetingBookingSlots).values(
      addSlots.map((s) => {
        const endsAt =
          s.endsAt ??
          new Date(s.startsAt.getTime() + proposal.durationMinutes * 60 * 1000);
        return {
          proposalId: proposal.id,
          startsAt: s.startsAt,
          endsAt,
          status: "available" as const,
        };
      }),
    );
  }

  const now = new Date();
  const [updatedProposal] = await db
    .update(meetingBookingProposals)
    .set({ updatedAt: now })
    .where(eq(meetingBookingProposals.id, proposal.id))
    .returning();

  const updatedSlots = await db
    .select()
    .from(meetingBookingSlots)
    .where(eq(meetingBookingSlots.proposalId, proposal.id))
    .orderBy(meetingBookingSlots.startsAt);

  const bookingUrl = `${input.baseUrl.replace(/\/$/, "")}/book/${proposal.token}`;
  const availableForClient = updatedSlots.filter((s) => s.status === "available");

  let notifyEmailStatus: "sent" | "failed" | "skipped" = "skipped";
  if (input.notifyClient) {
    const organiserUser = await storage.getUser(input.userId);
    const organiserFirm = organiserUser?.firmId
      ? await storage.getFirmProfile(organiserUser.firmId)
      : await storage.getFirmProfile();
    const organiserName = organiserFirm?.firmName?.trim() || null;

    try {
      const emailResult = await sendMeetingBookingProposalUpdatedEmail({
        to: proposal.clientEmail,
        recipientName: proposal.clientName || undefined,
        bookingUrl,
        slots: availableForClient.map((s) => ({ startsAt: s.startsAt, endsAt: s.endsAt })),
        durationMinutes: proposal.durationMinutes,
        organiserName,
      });
      notifyEmailStatus = emailResult.success ? "sent" : "failed";
    } catch (err) {
      console.warn("[MEETING_BOOKING] Proposal update email failed:", err);
      notifyEmailStatus = "failed";
    }
  }

  await storage.createAuditLog({
    eventType: "meeting_booking_slots_updated",
    userId: input.userId,
    caseId: proposal.caseId || undefined,
    metadata: {
      proposalId: proposal.id,
      removedCount: removeSlotIds.length,
      addedCount: addSlots.length,
      availableCount: availableForClient.length,
      notifyClient: !!input.notifyClient,
      notifyEmailStatus,
    },
    severity: "info",
  });

  return { ...updatedProposal, slots: updatedSlots, bookingUrl };
}

async function markProposalExpired(proposal: MeetingBookingProposal): Promise<void> {
  const result = await db.execute(sql`
    UPDATE meeting_booking_proposals
    SET status = 'expired',
        updated_at = NOW()
    WHERE id = ${proposal.id}
      AND status = 'pending'
    RETURNING id
  `);
  const rows = (result.rows ?? result) as Array<{ id: string }>;
  if (!rows.length) return;

  await db
    .update(meetingBookingSlots)
    .set({ status: "withdrawn" })
    .where(
      and(
        eq(meetingBookingSlots.proposalId, proposal.id),
        eq(meetingBookingSlots.status, "available"),
      ),
    );

  await storage.createAuditLog({
    eventType: "meeting_booking_expired",
    userId: proposal.userId,
    caseId: proposal.caseId || undefined,
    metadata: {
      proposalId: proposal.id,
      title: proposal.title,
      clientEmail: proposal.clientEmail,
      clientName: proposal.clientName,
      expiresAt: proposal.expiresAt?.toISOString?.() ?? proposal.expiresAt,
    },
    severity: "info",
  });
}

/** Expire pending proposals past expiresAt and emit bell notifications (once each). */
export async function expireStaleMeetingBookingProposals(userId?: string): Promise<number> {
  const now = new Date();
  const conditions = [
    eq(meetingBookingProposals.status, "pending"),
    sql`${meetingBookingProposals.expiresAt} <= ${now}`,
  ];
  if (userId) {
    conditions.push(eq(meetingBookingProposals.userId, userId));
  }

  const stale = await db
    .select()
    .from(meetingBookingProposals)
    .where(and(...conditions))
    .limit(50);

  for (const proposal of stale) {
    try {
      await markProposalExpired(proposal);
    } catch (err) {
      console.warn("[MEETING_BOOKING] Failed to expire proposal", proposal.id, err);
    }
  }
  return stale.length;
}

async function loadPublicProposal(
  token: string,
): Promise<{ proposal: MeetingBookingProposal; slots: MeetingBookingSlot[] } | null> {
  const [proposal] = await db
    .select()
    .from(meetingBookingProposals)
    .where(eq(meetingBookingProposals.token, token))
    .limit(1);

  if (!proposal) return null;

  if (proposal.status === "pending" && proposal.expiresAt <= new Date()) {
    await markProposalExpired(proposal);
    proposal.status = "expired";
  }

  const slots = await db
    .select()
    .from(meetingBookingSlots)
    .where(eq(meetingBookingSlots.proposalId, proposal.id))
    .orderBy(meetingBookingSlots.startsAt);

  return { proposal, slots };
}

/** Public-safe payload — no matter title / case identifiers. */
export async function getPublicBookingProposal(token: string) {
  const loaded = await loadPublicProposal(token);
  if (!loaded) {
    throw Object.assign(new Error("Booking link not found"), { status: 404 });
  }

  const { proposal, slots } = loaded;
  const firmUser = await storage.getUser(proposal.userId);
  const firm = firmUser?.firmId
    ? await storage.getFirmProfile(firmUser.firmId)
    : await storage.getFirmProfile();

  const slotsUpdated =
    !!proposal.emailSentAt && proposal.updatedAt.getTime() > proposal.emailSentAt.getTime();

  return {
    status: proposal.status,
    durationMinutes: proposal.durationMinutes,
    expiresAt: proposal.expiresAt,
    respondedAt: proposal.respondedAt,
    updatedAt: proposal.updatedAt,
    emailSentAt: proposal.emailSentAt,
    slotsUpdated,
    selectedStartsAt:
      proposal.selectedSlotId != null
        ? slots.find((s) => s.id === proposal.selectedSlotId)?.startsAt ?? null
        : null,
    slots:
      proposal.status === "pending"
        ? slots
            .filter((s) => s.status === "available")
            .map((s) => ({
              id: s.id,
              startsAt: s.startsAt,
              endsAt: s.endsAt,
            }))
        : [],
    /** Firm name only when configured — never a “solicitor” role fallback. */
    organiserName: firm?.firmName?.trim() || null,
    firmProfile: firm
      ? { firmName: firm.firmName, logoUrl: firm.logoUrl || null }
      : null,
  };
}

export async function bookMeetingSlot(params: {
  token: string;
  slotId: string;
  baseUrl: string;
  ipAddress?: string;
}): Promise<{ meeting: ScheduledMeeting; startsAt: Date; endsAt: Date }> {
  const loaded = await loadPublicProposal(params.token);
  if (!loaded) {
    throw Object.assign(new Error("Booking link not found"), { status: 404 });
  }

  const { proposal, slots } = loaded;
  if (proposal.status === "expired") {
    throw Object.assign(new Error("This booking link has expired"), { status: 410 });
  }
  if (proposal.status === "cancelled") {
    throw Object.assign(new Error("This booking request was cancelled"), { status: 410 });
  }
  if (proposal.status === "declined") {
    throw Object.assign(new Error("This booking request was already declined"), { status: 409 });
  }
  if (proposal.status === "booked") {
    throw Object.assign(new Error("A time has already been booked on this link"), { status: 409 });
  }
  if (proposal.status !== "pending") {
    throw Object.assign(new Error("This booking link is no longer available"), { status: 410 });
  }

  const slot = slots.find((s) => s.id === params.slotId);
  if (!slot || slot.status !== "available") {
    throw Object.assign(new Error("That time is no longer available"), { status: 400 });
  }
  if (slot.startsAt <= new Date()) {
    throw Object.assign(new Error("That time has already passed"), { status: 400 });
  }

  // Claim the slot before creating the calendar event
  const claimResult = await db.execute(sql`
    UPDATE meeting_booking_proposals
    SET status = 'booked',
        selected_slot_id = ${params.slotId},
        responded_at = NOW(),
        updated_at = NOW()
    WHERE id = ${proposal.id}
      AND status = 'pending'
    RETURNING id
  `);
  const claimedRows = (claimResult.rows ?? claimResult) as Array<{ id: string }>;
  if (!claimedRows.length) {
    throw Object.assign(new Error("A time has already been booked on this link"), { status: 409 });
  }

  await db
    .update(meetingBookingSlots)
    .set({ status: "selected" })
    .where(eq(meetingBookingSlots.id, params.slotId));

  await db
    .update(meetingBookingSlots)
    .set({ status: "withdrawn" })
    .where(
      and(
        eq(meetingBookingSlots.proposalId, proposal.id),
        eq(meetingBookingSlots.status, "available"),
      ),
    );

  const provider = (proposal.calendarProvider === "outlook" ? "outlook" : "google") as
    | "google"
    | "outlook";
  const attendees = [{ email: proposal.clientEmail, name: proposal.clientName || undefined }];
  const description = proposal.description || undefined;

  let calendarEventId: string | undefined;
  let meetingUrl: string | undefined;
  let meetingPlatform: "zoom" | "teams" | "meet" | "webex" | undefined;

  try {
    if (provider === "outlook") {
      const outlookResult = await createOutlookMeetingCalendarEvent(
        proposal.userId,
        {
          title: proposal.title,
          description,
          startTime: slot.startsAt,
          endTime: slot.endsAt,
          attendees,
          createConference: true,
        },
        storage,
        params.baseUrl,
      );
      if (!outlookResult.success || !outlookResult.eventId) {
        throw new Error(outlookResult.error || "Failed to create Outlook calendar event");
      }
      calendarEventId = outlookResult.eventId;
      meetingUrl = outlookResult.meetingUrl;
      if (outlookResult.meetingPlatform === "teams" || outlookResult.meetingPlatform === "meet") {
        meetingPlatform = outlookResult.meetingPlatform;
      }
    } else {
      const googleResult = await createMeetingCalendarEvent(
        proposal.userId,
        {
          title: proposal.title,
          description,
          startTime: slot.startsAt,
          endTime: slot.endsAt,
          attendees,
          createConference: true,
        },
        storage,
      );
      if (!googleResult.success || !googleResult.eventId) {
        throw new Error(googleResult.error || "Failed to create Google calendar event");
      }
      calendarEventId = googleResult.eventId;
      meetingUrl = googleResult.meetingUrl;
      meetingPlatform = googleResult.meetingPlatform;
    }

    if (!meetingPlatform) {
      meetingPlatform = detectPlatform(meetingUrl);
    }

    if (!meetingUrl || !calendarEventId) {
      throw new Error("Calendar event was created without a join link");
    }

    const meeting = await storage.createScheduledMeeting({
      userId: proposal.userId,
      caseId: proposal.caseId || undefined,
      calendarEventId,
      calendarProvider: provider,
      title: proposal.title,
      description,
      meetingUrl,
      meetingPlatform,
      startTime: slot.startsAt,
      endTime: slot.endsAt,
      attendees,
      clientEmail: proposal.clientEmail,
      clientName: proposal.clientName || undefined,
      autoRecordEnabled: false,
      consentStatus: "pending",
      status: "scheduled",
    });

    await db
      .update(meetingBookingProposals)
      .set({ scheduledMeetingId: meeting.id, updatedAt: new Date() })
      .where(eq(meetingBookingProposals.id, proposal.id));

    void (async () => {
      try {
        await sendMeetingInviteConfirmationEmail({
          to: proposal.clientEmail,
          recipientName: proposal.clientName || undefined,
          meetingTitle: proposal.title,
          startTime: slot.startsAt,
          endTime: slot.endsAt,
          meetingUrl: meetingUrl!,
          meetingPlatform,
        });
      } catch (emailErr) {
        console.warn("[MEETING_BOOKING] Confirmation email failed:", emailErr);
      }
    })();

    await storage.createAuditLog({
      eventType: "meeting_booking_confirmed",
      userId: proposal.userId,
      caseId: proposal.caseId || undefined,
      ipAddress: params.ipAddress,
      metadata: {
        proposalId: proposal.id,
        meetingId: meeting.id,
        slotId: params.slotId,
        startsAt: slot.startsAt.toISOString(),
        clientEmail: proposal.clientEmail,
        clientName: proposal.clientName,
      },
      severity: "info",
    });

    void notifyOrganiserOfBookingResponse({
      userId: proposal.userId,
      responseStatus: "booked",
      meetingTitle: proposal.title,
      clientName: proposal.clientName,
      clientEmail: proposal.clientEmail,
      startsAt: slot.startsAt,
      caseId: proposal.caseId,
    });

    return { meeting, startsAt: slot.startsAt, endsAt: slot.endsAt };
  } catch (err) {
    // Roll back claim so the client can retry
    console.error("[MEETING_BOOKING] Book failed, rolling back claim:", err);
    try {
      if (calendarEventId) {
        if (provider === "outlook") {
          await deleteOutlookCalendarEvent(proposal.userId, calendarEventId, storage, params.baseUrl);
        } else {
          await deleteCalendarEvent(proposal.userId, calendarEventId, storage);
        }
      }
    } catch (cleanupErr) {
      console.warn("[MEETING_BOOKING] Calendar cleanup failed:", cleanupErr);
    }

    await db
      .update(meetingBookingProposals)
      .set({
        status: "pending",
        selectedSlotId: null,
        scheduledMeetingId: null,
        respondedAt: null,
        updatedAt: new Date(),
      })
      .where(eq(meetingBookingProposals.id, proposal.id));

    await db
      .update(meetingBookingSlots)
      .set({ status: "available" })
      .where(eq(meetingBookingSlots.proposalId, proposal.id));

    const message = err instanceof Error ? err.message : "Could not confirm that time";
    throw Object.assign(new Error(message), { status: 502 });
  }
}

export async function declineMeetingBooking(params: {
  token: string;
  note?: string;
  ipAddress?: string;
}): Promise<void> {
  const loaded = await loadPublicProposal(params.token);
  if (!loaded) {
    throw Object.assign(new Error("Booking link not found"), { status: 404 });
  }

  const { proposal } = loaded;
  if (proposal.status === "expired") {
    throw Object.assign(new Error("This booking link has expired"), { status: 410 });
  }
  if (proposal.status === "cancelled") {
    throw Object.assign(new Error("This booking request was cancelled"), { status: 410 });
  }
  if (proposal.status === "booked") {
    throw Object.assign(new Error("A time has already been booked on this link"), { status: 409 });
  }
  if (proposal.status === "declined") {
    return;
  }
  if (proposal.status !== "pending") {
    throw Object.assign(new Error("This booking link is no longer available"), { status: 410 });
  }

  const note = params.note?.trim().slice(0, 2000) || null;

  const declineResult = await db.execute(sql`
    UPDATE meeting_booking_proposals
    SET status = 'declined',
        decline_note = ${note},
        responded_at = NOW(),
        updated_at = NOW()
    WHERE id = ${proposal.id}
      AND status = 'pending'
    RETURNING id
  `);
  const declinedRows = (declineResult.rows ?? declineResult) as Array<{ id: string }>;
  if (!declinedRows.length) {
    throw Object.assign(new Error("This booking link is no longer available"), { status: 409 });
  }

  await db
    .update(meetingBookingSlots)
    .set({ status: "withdrawn" })
    .where(
      and(
        eq(meetingBookingSlots.proposalId, proposal.id),
        eq(meetingBookingSlots.status, "available"),
      ),
    );

  await storage.createAuditLog({
    eventType: "meeting_booking_declined",
    userId: proposal.userId,
    caseId: proposal.caseId || undefined,
    ipAddress: params.ipAddress,
    metadata: {
      proposalId: proposal.id,
      clientEmail: proposal.clientEmail,
      clientName: proposal.clientName,
      clientMessage: note,
    },
    severity: "info",
  });

  void notifyOrganiserOfBookingResponse({
    userId: proposal.userId,
    responseStatus: "declined",
    meetingTitle: proposal.title,
    clientName: proposal.clientName,
    clientEmail: proposal.clientEmail,
    clientMessage: note,
    caseId: proposal.caseId,
  });
}

async function notifyOrganiserOfBookingResponse(params: {
  userId: string;
  responseStatus: "booked" | "declined";
  meetingTitle: string;
  clientName?: string | null;
  clientEmail: string;
  startsAt?: Date | null;
  clientMessage?: string | null;
  caseId?: string | null;
}): Promise<void> {
  try {
    const user = await storage.getUser(params.userId);
    if (!user?.email) {
      console.warn("[MEETING_BOOKING] No organiser email for booking response notification");
      return;
    }
    await sendMeetingBookingResponseNotification({
      to: user.email,
      recipientFirstName: user.firstName,
      responseStatus: params.responseStatus,
      meetingTitle: params.meetingTitle,
      clientName: params.clientName,
      clientEmail: params.clientEmail,
      startsAt: params.startsAt,
      clientMessage: params.clientMessage,
      caseId: params.caseId,
    });
  } catch (err) {
    console.warn("[MEETING_BOOKING] Organiser notification email failed:", err);
  }
}

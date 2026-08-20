import { google } from 'googleapis';
import { Client } from '@microsoft/microsoft-graph-client';
import type { IStorage } from './storage';
import type { CalendarIntegration } from '@shared/schema';
import { computeReminderSchedule } from './reminderScheduler';
import { ensureFreshOutlookToken } from './oauth';
import { formatGraphLocalDateTime } from './graphDateTime';

// Calendar integration types
export interface CalendarEventData {
  caseId: string;
  title: string;
  clientName: string;
  matterReference?: string;
  deadline: Date;
  description?: string;
  notes?: string;
  priority?: string; // urgent | deadline-soon | normal
  isAllDay?: boolean; // True if deadline has no specific time
}

export interface CalendarSyncResult {
  success: boolean;
  provider: 'google' | 'outlook';
  eventId?: string;
  error?: string;
  /** Join URL when a Meet/Teams conference was created with the event */
  meetingUrl?: string;
  meetingPlatform?: 'meet' | 'teams';
}

// Helper to format event description
function formatEventDescription(data: CalendarEventData): string {
  let description = `Case: ${data.title}\nClient: ${data.clientName}`;
  if (data.matterReference) {
    description += `\nMatter Reference: ${data.matterReference}`;
  }
  if (data.description) {
    description += `\n\n${data.description}`;
  }
  if (data.notes) {
    description += `\n\nNotes:\n${data.notes}`;
  }
  description += `\n\nCreated by LegalNote`;
  return description;
}


// Token refresh for Google
async function refreshGoogleToken(
  refreshToken: string,
  storage: IStorage,
  integration: CalendarIntegration
): Promise<string> {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error('Google OAuth credentials not configured');
  }

  const oauth2Client = new google.auth.OAuth2(clientId, clientSecret);
  oauth2Client.setCredentials({ refresh_token: refreshToken });

  const { credentials } = await oauth2Client.refreshAccessToken();
  const newAccessToken = credentials.access_token;
  const newExpiresAt = credentials.expiry_date ? new Date(credentials.expiry_date) : null;

  if (!newAccessToken) {
    throw new Error('Failed to refresh Google access token');
  }

  // Update token in database
  await storage.saveCalendarIntegration({
    userId: integration.userId,
    provider: 'google',
    accessToken: newAccessToken,
    refreshToken: integration.refreshToken || undefined,
    expiresAt: newExpiresAt,
    calendarId: integration.calendarId || undefined,
    email: integration.email || undefined,
  });

  return newAccessToken;
}

// Get valid access token (with automatic refresh)
async function getValidAccessToken(
  userId: string,
  storage: IStorage
): Promise<{ token: string; integration: CalendarIntegration }> {
  const integration = await storage.getCalendarIntegration(userId, 'google');

  if (!integration) {
    throw new Error('Google Calendar not connected for this user');
  }

  // Check if token is expired or about to expire (5 min buffer)
  const now = new Date();
  const expiresAt = integration.expiresAt ? new Date(integration.expiresAt) : null;
  const needsRefresh = !expiresAt || expiresAt.getTime() - now.getTime() < 5 * 60 * 1000;

  if (needsRefresh && integration.refreshToken) {
    const newToken = await refreshGoogleToken(integration.refreshToken, storage, integration);
    
    // Fetch updated integration with new token
    const updated = await storage.getCalendarIntegration(userId, 'google');
    if (!updated) {
      throw new Error('Failed to retrieve updated integration');
    }
    return { token: newToken, integration: updated };
  }

  return { token: integration.accessToken, integration };
}

// Google Calendar operations
async function createGoogleCalendarEvent(
  userId: string,
  data: CalendarEventData,
  storage: IStorage
): Promise<CalendarSyncResult> {
  try {
    console.log('[CALENDAR] Starting Google Calendar event creation');
    console.log('[CALENDAR] User ID:', userId);
    console.log('[CALENDAR] Event data:', {
      caseId: data.caseId,
      deadline: data.deadline.toISOString(),
      priority: data.priority,
      isAllDay: data.isAllDay,
    });

    const { token, integration } = await getValidAccessToken(userId, storage);
    console.log('[CALENDAR] Got access token for:', integration.email);

    const oauth2Client = new google.auth.OAuth2();
    oauth2Client.setCredentials({ access_token: token });

    const calendar = google.calendar({ version: 'v3', auth: oauth2Client });

    // Compute time-based reminders with 8am floor constraint
    const { minutesBefore } = computeReminderSchedule({
      deadline: data.deadline,
      isAllDay: data.isAllDay || false,
      priority: data.priority || 'normal',
    });
    
    const event: any = {
      summary: `Deadline: ${data.title}`,
      description: formatEventDescription(data),
      reminders: {
        useDefault: false,
        overrides: minutesBefore.map(minutes => ({
          method: 'popup',
          minutes,
        })),
      },
    };

    if (data.isAllDay) {
      // All-day event - Google requires end date to be the next day (exclusive)
      // Format in Europe/London timezone to match user's location
      const formatLocalDate = (d: Date) => {
        const formatter = new Intl.DateTimeFormat('en-GB', {
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
          timeZone: 'Europe/London'
        });
        const parts = formatter.formatToParts(d);
        const year = parts.find(p => p.type === 'year')!.value;
        const month = parts.find(p => p.type === 'month')!.value;
        const day = parts.find(p => p.type === 'day')!.value;
        return `${year}-${month}-${day}`;
      };
      
      const dateStr = formatLocalDate(data.deadline);
      
      // Add one calendar day (not 24 hours!) to handle DST transitions correctly
      const [year, month, day] = dateStr.split('-').map(Number);
      const nextDay = new Date(year, month - 1, day + 1); // month is 0-indexed
      const endDateStr = formatLocalDate(nextDay);
      
      event.start = { date: dateStr };
      event.end = { date: endDateStr };
    } else {
      // Timed event
      event.start = {
        dateTime: data.deadline.toISOString(),
        timeZone: 'Europe/London',
      };
      event.end = {
        dateTime: new Date(data.deadline.getTime() + 60 * 60 * 1000).toISOString(),
        timeZone: 'Europe/London',
      };
    }

    console.log('[CALENDAR] Calling Google Calendar API to insert event...');
    const response = await calendar.events.insert({
      calendarId: 'primary',
      requestBody: event,
    });

    console.log('[CALENDAR] ✅ Event created successfully! Event ID:', response.data.id);
    console.log('[CALENDAR] Event link:', response.data.htmlLink);

    return {
      success: true,
      provider: 'google',
      eventId: response.data.id || undefined,
    };
  } catch (error: any) {
    console.error('[CALENDAR] ❌ Failed to create Google Calendar event:', error.message);
    console.error('[CALENDAR] Error details:', {
      code: error.code,
      status: error.status,
      errors: error.errors,
      stack: error.stack,
    });
    return {
      success: false,
      provider: 'google',
      error: error.message || 'Failed to create Google Calendar event',
    };
  }
}

async function updateGoogleCalendarEvent(
  userId: string,
  eventId: string,
  data: CalendarEventData,
  storage: IStorage
): Promise<CalendarSyncResult> {
  try {
    const { token } = await getValidAccessToken(userId, storage);

    const oauth2Client = new google.auth.OAuth2();
    oauth2Client.setCredentials({ access_token: token });

    const calendar = google.calendar({ version: 'v3', auth: oauth2Client });

    // Compute time-based reminders with 8am floor constraint
    const { minutesBefore } = computeReminderSchedule({
      deadline: data.deadline,
      isAllDay: data.isAllDay || false,
      priority: data.priority || 'normal',
    });
    
    const event: any = {
      summary: `Deadline: ${data.title}`,
      description: formatEventDescription(data),
      reminders: {
        useDefault: false,
        overrides: minutesBefore.map(minutes => ({
          method: 'popup',
          minutes,
        })),
      },
    };

    if (data.isAllDay) {
      // All-day event - Google requires end date to be the next day (exclusive)
      // Format in Europe/London timezone to match user's location
      const formatLocalDate = (d: Date) => {
        const formatter = new Intl.DateTimeFormat('en-GB', {
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
          timeZone: 'Europe/London'
        });
        const parts = formatter.formatToParts(d);
        const year = parts.find(p => p.type === 'year')!.value;
        const month = parts.find(p => p.type === 'month')!.value;
        const day = parts.find(p => p.type === 'day')!.value;
        return `${year}-${month}-${day}`;
      };
      
      const dateStr = formatLocalDate(data.deadline);
      
      // Add one calendar day (not 24 hours!) to handle DST transitions correctly
      const [year, month, day] = dateStr.split('-').map(Number);
      const nextDay = new Date(year, month - 1, day + 1); // month is 0-indexed
      const endDateStr = formatLocalDate(nextDay);
      
      event.start = { date: dateStr };
      event.end = { date: endDateStr };
    } else {
      // Timed event
      event.start = {
        dateTime: data.deadline.toISOString(),
        timeZone: 'Europe/London',
      };
      event.end = {
        dateTime: new Date(data.deadline.getTime() + 60 * 60 * 1000).toISOString(),
        timeZone: 'Europe/London',
      };
    }

    await calendar.events.update({
      calendarId: 'primary',
      eventId: eventId,
      requestBody: event,
    });

    return {
      success: true,
      provider: 'google',
      eventId: eventId,
    };
  } catch (error: any) {
    return {
      success: false,
      provider: 'google',
      error: error.message || 'Failed to update Google Calendar event',
    };
  }
}

async function deleteGoogleCalendarEvent(
  userId: string,
  eventId: string,
  storage: IStorage
): Promise<CalendarSyncResult> {
  try {
    const { token } = await getValidAccessToken(userId, storage);

    const oauth2Client = new google.auth.OAuth2();
    oauth2Client.setCredentials({ access_token: token });

    const calendar = google.calendar({ version: 'v3', auth: oauth2Client });

    await calendar.events.delete({
      calendarId: 'primary',
      eventId: eventId,
    });

    return {
      success: true,
      provider: 'google',
    };
  } catch (error: any) {
    return {
      success: false,
      provider: 'google',
      error: error.message || 'Failed to delete Google Calendar event',
    };
  }
}

export interface MeetingEventData {
  title: string;
  description?: string;
  startTime: Date;
  endTime?: Date;
  meetingUrl?: string;
  attendees?: Array<{ email: string; name?: string }>;
  /** When true (default if no meetingUrl), mint a Google Meet link on the event */
  createConference?: boolean;
}

/** Include the join URL in the calendar body so invitees can find it outside the Join button. */
function formatMeetingDescription(
  title: string,
  description: string | undefined,
  meetingUrl: string | undefined,
): string {
  const base =
    (description && description.trim()) ||
    `Meeting: ${title}\n\nCreated by LegalNote`;
  if (!meetingUrl) return base;
  if (base.includes(meetingUrl)) return base;
  return `${base}\n\nJoin meeting:\n${meetingUrl}`;
}

function extractGoogleMeetUrl(event: {
  hangoutLink?: string | null;
  conferenceData?: {
    entryPoints?: Array<{ entryPointType?: string | null; uri?: string | null }> | null;
  } | null;
}): string | undefined {
  const hangoutLink = event.hangoutLink || undefined;
  const videoEntry = event.conferenceData?.entryPoints?.find(
    (e) => e.entryPointType === 'video' && e.uri,
  )?.uri;
  return hangoutLink || videoEntry || undefined;
}

function extractOutlookJoinUrl(event: {
  onlineMeeting?: { joinUrl?: string | null } | null;
  onlineMeetingUrl?: string | null;
}): string | undefined {
  return event.onlineMeeting?.joinUrl || event.onlineMeetingUrl || undefined;
}

export async function createMeetingCalendarEvent(
  userId: string,
  data: MeetingEventData,
  storage: IStorage
): Promise<CalendarSyncResult> {
  try {
    const { token } = await getValidAccessToken(userId, storage);

    const oauth2Client = new google.auth.OAuth2();
    oauth2Client.setCredentials({ access_token: token });

    const calendar = google.calendar({ version: 'v3', auth: oauth2Client });

    const endTime = data.endTime || new Date(data.startTime.getTime() + 60 * 60 * 1000);
    const createConference =
      data.createConference === true ||
      (data.createConference !== false && !data.meetingUrl);
    const attendees = (data.attendees || []).filter((a) => a.email);
    const hasAttendees = attendees.length > 0;

    const eventBody: Record<string, unknown> = {
      summary: data.title,
      description: formatMeetingDescription(data.title, data.description, data.meetingUrl),
      start: {
        dateTime: data.startTime.toISOString(),
        timeZone: 'Europe/London',
      },
      end: {
        dateTime: endTime.toISOString(),
        timeZone: 'Europe/London',
      },
      reminders: {
        useDefault: false,
        overrides: [
          { method: 'popup', minutes: 15 },
          { method: 'popup', minutes: 5 },
        ],
      },
    };

    if (hasAttendees) {
      eventBody.attendees = attendees.map((a) => ({
        email: a.email,
        displayName: a.name,
      }));
    }

    if (data.meetingUrl) {
      eventBody.location = data.meetingUrl;
    }

    if (createConference) {
      eventBody.conferenceData = {
        createRequest: {
          requestId: `legalnote-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
          conferenceSolutionKey: { type: 'hangoutsMeet' },
        },
      };
    }

    const response = await calendar.events.insert({
      calendarId: 'primary',
      conferenceDataVersion: createConference ? 1 : undefined,
      sendUpdates: hasAttendees ? 'all' : 'none',
      requestBody: eventBody,
    });

    const eventId = response.data.id || undefined;
    let meetingUrl: string | undefined = data.meetingUrl;
    let meetingPlatform: 'meet' | 'teams' | undefined;

    if (createConference) {
      meetingUrl = extractGoogleMeetUrl(response.data) || meetingUrl;

      if (!meetingUrl && eventId) {
        try {
          const fetched = await calendar.events.get({
            calendarId: 'primary',
            eventId,
            conferenceDataVersion: 1,
          });
          meetingUrl = extractGoogleMeetUrl(fetched.data) || meetingUrl;
        } catch (fetchErr) {
          console.warn(
            '[CALENDAR] Failed to re-fetch Google Meet link:',
            fetchErr instanceof Error ? fetchErr.message : fetchErr,
          );
        }
      }

      if (!meetingUrl) {
        if (eventId) {
          try {
            await calendar.events.delete({
              calendarId: 'primary',
              eventId,
              sendUpdates: 'none',
            });
          } catch (cleanupErr) {
            console.warn(
              '[CALENDAR] Failed to clean up Meet-less event:',
              cleanupErr instanceof Error ? cleanupErr.message : cleanupErr,
            );
          }
        }
        return {
          success: false,
          provider: 'google',
          error:
            'Google Meet link was not created. Check that Google Meet is enabled for this Google account.',
        };
      }

      meetingPlatform = 'meet';

      try {
        await calendar.events.patch({
          calendarId: 'primary',
          eventId: eventId!,
          // Avoid a second attendee mail blast; Meet join is already on the conference.
          sendUpdates: 'none',
          requestBody: {
            description: formatMeetingDescription(data.title, data.description, meetingUrl),
            location: meetingUrl,
          },
        });
      } catch (patchErr) {
        console.warn(
          '[CALENDAR] Failed to patch Meet join URL onto event (invite may still include conference):',
          patchErr instanceof Error ? patchErr.message : patchErr,
        );
      }
    } else if (meetingUrl?.includes('meet.google.com')) {
      meetingPlatform = 'meet';
    }

    return {
      success: true,
      provider: 'google',
      eventId,
      meetingUrl,
      meetingPlatform,
    };
  } catch (error: unknown) {
    const err = error instanceof Error ? error : new Error(String(error));
    console.error('[CALENDAR] Meeting event creation failed:', err.message);
    return {
      success: false,
      provider: 'google',
      error: err.message || 'Failed to create meeting calendar event',
    };
  }
}

async function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<never>((_, reject) => {
        timer = setTimeout(
          () => reject(new Error(`${label} timed out after ${Math.round(ms / 1000)}s`)),
          ms,
        );
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

/**
 * Create a meeting on the user's OAuth-connected Outlook calendar (Microsoft Graph).
 * Prefer this over the Replit connector for production users who connected via Settings.
 *
 * Note: `onlineMeetingProvider: teamsForBusiness` often hangs or returns no join URL on
 * personal Microsoft accounts. We try isOnlineMeeting without a provider first, then
 * teamsForBusiness for work/school mailboxes — each Graph call has a hard timeout.
 */
export async function createOutlookMeetingCalendarEvent(
  userId: string,
  data: MeetingEventData,
  storage: IStorage,
  baseUrl: string,
): Promise<CalendarSyncResult> {
  try {
    const accessToken = await withTimeout(
      ensureFreshOutlookToken(storage, userId, baseUrl),
      10000,
      'Outlook token refresh',
    );
    const graphClient = Client.initWithMiddleware({
      authProvider: { getAccessToken: async () => accessToken },
    });

    const endTime = data.endTime || new Date(data.startTime.getTime() + 60 * 60 * 1000);
    const createOnlineMeeting =
      data.createConference === true ||
      (data.createConference !== false && !data.meetingUrl);
    const attendees = (data.attendees || []).filter((a) => a.email);
    const hasAttendees = attendees.length > 0;

    type OutlookEventResponse = {
      id?: string;
      onlineMeeting?: { joinUrl?: string | null } | null;
      onlineMeetingUrl?: string | null;
    };

    const buildEventBody = (opts: {
      withOnlineMeeting: boolean;
      /** Work/school Teams; omit for personal Microsoft accounts (teamsForBusiness often hangs). */
      useTeamsForBusiness?: boolean;
    }): Record<string, unknown> => {
      const event: Record<string, unknown> = {
        subject: data.title,
        body: {
          contentType: 'Text',
          content: formatMeetingDescription(data.title, data.description, data.meetingUrl),
        },
        start: {
          dateTime: formatGraphLocalDateTime(data.startTime),
          timeZone: 'Europe/London',
        },
        end: {
          dateTime: formatGraphLocalDateTime(endTime),
          timeZone: 'Europe/London',
        },
        isReminderOn: true,
        reminderMinutesBeforeStart: 15,
      };

      if (data.meetingUrl) {
        event.location = { displayName: data.meetingUrl };
      }

      if (opts.withOnlineMeeting) {
        event.isOnlineMeeting = true;
        if (opts.useTeamsForBusiness) {
          event.onlineMeetingProvider = 'teamsForBusiness';
        }
      }

      if (hasAttendees) {
        event.attendees = attendees.map((a) => ({
          emailAddress: {
            address: a.email,
            name: a.name || a.email,
          },
          type: 'required',
        }));
      }

      return event;
    };

    const postEvent = (body: Record<string, unknown>, label: string) =>
      withTimeout(
        graphClient.api('/me/events').post(body) as Promise<OutlookEventResponse>,
        12000,
        label,
      );

    const fetchJoinUrl = async (eventId: string): Promise<string | undefined> => {
      try {
        const fetched = await withTimeout(
          graphClient
            .api(`/me/events/${eventId}`)
            .select('id,onlineMeeting,onlineMeetingUrl')
            .get() as Promise<OutlookEventResponse>,
          8000,
          'Outlook join URL fetch',
        );
        return extractOutlookJoinUrl(fetched);
      } catch (fetchErr) {
        console.warn(
          '[OUTLOOK] Failed to re-fetch Teams join URL:',
          fetchErr instanceof Error ? fetchErr.message : fetchErr,
        );
        return undefined;
      }
    };

    const deleteEventQuietly = async (eventId: string) => {
      try {
        await withTimeout(
          graphClient.api(`/me/events/${eventId}`).delete(),
          8000,
          'Outlook event cleanup',
        );
      } catch (cleanupErr) {
        console.warn(
          '[OUTLOOK] Failed to clean up event:',
          cleanupErr instanceof Error ? cleanupErr.message : cleanupErr,
        );
      }
    };

    // No conference requested — plain calendar event (pasted URL or none).
    if (!createOnlineMeeting) {
      const response = await postEvent(
        buildEventBody({ withOnlineMeeting: false }),
        'Outlook calendar event create',
      );
      return {
        success: true,
        provider: 'outlook',
        eventId: response.id || undefined,
        meetingUrl: data.meetingUrl,
        meetingPlatform: undefined,
      };
    }

    // Personal Microsoft accounts often hang or ignore teamsForBusiness.
    // Try isOnlineMeeting without provider first; then teamsForBusiness for M365 work mailboxes.
    const attempts: Array<{ label: string; useTeamsForBusiness: boolean }> = [
      { label: 'Outlook online meeting (no provider)', useTeamsForBusiness: false },
      { label: 'Outlook Teams for Business meeting', useTeamsForBusiness: true },
    ];

    let lastError = '';
    for (const attempt of attempts) {
      let response: OutlookEventResponse | undefined;
      try {
        response = await postEvent(
          buildEventBody({
            withOnlineMeeting: true,
            useTeamsForBusiness: attempt.useTeamsForBusiness,
          }),
          attempt.label,
        );
      } catch (attemptErr) {
        lastError =
          attemptErr instanceof Error ? attemptErr.message : String(attemptErr);
        console.warn(`[OUTLOOK] ${attempt.label} failed:`, lastError);
        continue;
      }

      const eventId = response.id || undefined;
      let joinUrl =
        extractOutlookJoinUrl(response) || data.meetingUrl || undefined;
      if (!joinUrl && eventId) {
        joinUrl = await fetchJoinUrl(eventId);
      }

      if (joinUrl && eventId) {
        try {
          await withTimeout(
            graphClient.api(`/me/events/${eventId}`).patch({
              body: {
                contentType: 'Text',
                content: formatMeetingDescription(data.title, data.description, joinUrl),
              },
              location: { displayName: joinUrl },
            }),
            8000,
            'Outlook join URL patch',
          );
        } catch (patchErr) {
          console.warn(
            '[OUTLOOK] Failed to patch Teams join URL onto event:',
            patchErr instanceof Error ? patchErr.message : patchErr,
          );
        }

        return {
          success: true,
          provider: 'outlook',
          eventId,
          meetingUrl: joinUrl,
          meetingPlatform: !data.meetingUrl ? 'teams' : undefined,
        };
      }

      if (eventId) {
        console.warn(
          `[OUTLOOK] ${attempt.label} created event without join URL — cleaning up`,
        );
        await deleteEventQuietly(eventId);
      }
    }

    return {
      success: false,
      provider: 'outlook',
      error:
        lastError && /timed out/i.test(lastError)
          ? 'Microsoft Graph timed out while creating a Teams meeting. Paste a meeting URL, or schedule with Google Calendar (Meet) instead.'
          : 'Could not create a Teams join link for this Outlook account. Work/school Microsoft 365 mailboxes work best — or paste a meeting URL / use Google Meet.',
    };
  } catch (error: unknown) {
    const err = error instanceof Error ? error : new Error(String(error));
    let detail = err.message;
    const body = (error as { body?: unknown })?.body;
    if (body) {
      try {
        const parsed = typeof body === 'string' ? JSON.parse(body) : body;
        const graphMessage =
          (parsed as { error?: { message?: string }; message?: string })?.error?.message ||
          (parsed as { message?: string })?.message;
        if (typeof graphMessage === 'string' && graphMessage.trim()) {
          detail = graphMessage.trim();
        }
      } catch {
        if (typeof body === 'string' && body.length < 300) detail = body;
      }
    }
    console.error('[OUTLOOK] OAuth meeting event creation failed:', detail);
    return {
      success: false,
      provider: 'outlook',
      error: detail || 'Failed to create Outlook meeting calendar event',
    };
  }
}

export async function deleteOutlookCalendarEvent(
  userId: string,
  eventId: string,
  storage: IStorage,
  baseUrl: string,
): Promise<CalendarSyncResult> {
  try {
    const accessToken = await ensureFreshOutlookToken(storage, userId, baseUrl);
    const graphClient = Client.initWithMiddleware({
      authProvider: { getAccessToken: async () => accessToken },
    });
    await graphClient.api(`/me/events/${eventId}`).delete();
    return {
      success: true,
      provider: 'outlook',
    };
  } catch (error: unknown) {
    const err = error instanceof Error ? error : new Error(String(error));
    let detail = err.message;
    const body = (error as { body?: unknown })?.body;
    if (body) {
      try {
        const parsed = typeof body === 'string' ? JSON.parse(body) : body;
        const graphMessage =
          (parsed as { error?: { message?: string }; message?: string })?.error?.message ||
          (parsed as { message?: string })?.message;
        if (typeof graphMessage === 'string' && graphMessage.trim()) {
          detail = graphMessage.trim();
        }
      } catch {
        if (typeof body === 'string' && body.length < 300) detail = body;
      }
    }
    // Already deleted / not found — treat as success so LegalNote can finish cancel
    if (/not found|404|ErrorItemNotFound/i.test(detail)) {
      return { success: true, provider: 'outlook' };
    }
    console.error('[OUTLOOK] OAuth event delete failed:', detail);
    return {
      success: false,
      provider: 'outlook',
      error: detail || 'Failed to delete Outlook calendar event',
    };
  }
}

// Public API
export async function createCalendarEvent(
  userId: string,
  data: CalendarEventData,
  storage: IStorage
): Promise<CalendarSyncResult> {
  return createGoogleCalendarEvent(userId, data, storage);
}

export async function updateCalendarEvent(
  userId: string,
  eventId: string,
  data: CalendarEventData,
  storage: IStorage
): Promise<CalendarSyncResult> {
  return updateGoogleCalendarEvent(userId, eventId, data, storage);
}

export async function deleteCalendarEvent(
  userId: string,
  eventId: string,
  storage: IStorage
): Promise<CalendarSyncResult> {
  return deleteGoogleCalendarEvent(userId, eventId, storage);
}

// Check which calendar providers are connected for a user
export async function getConnectedProviders(
  userId: string,
  storage: IStorage
): Promise<{ 
  google: { connected: boolean; email?: string; connectedAt?: string }; 
  outlook: { connected: boolean; email?: string; connectedAt?: string };
}> {
  const googleIntegration = await storage.getCalendarIntegration(userId, 'google');
  const outlookIntegration = await storage.getCalendarIntegration(userId, 'outlook');

  return {
    google: {
      connected: !!(googleIntegration?.accessToken && googleIntegration.accessToken !== 'replit-managed'),
      email: googleIntegration?.accessToken === 'replit-managed' ? undefined : (googleIntegration?.email || undefined),
      connectedAt: googleIntegration?.accessToken === 'replit-managed' ? undefined : googleIntegration?.connectedAt?.toISOString(),
    },
    outlook: {
      connected: !!(outlookIntegration?.accessToken && outlookIntegration.accessToken !== 'replit-managed'),
      email: outlookIntegration?.accessToken === 'replit-managed' ? undefined : (outlookIntegration?.email || undefined),
      connectedAt: outlookIntegration?.accessToken === 'replit-managed' ? undefined : outlookIntegration?.connectedAt?.toISOString(),
    },
  };
}

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

    const eventBody: Record<string, unknown> = {
      summary: data.title,
      description: data.description || `Meeting: ${data.title}\n\nCreated by LegalNote`,
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

    if (data.attendees && data.attendees.length > 0) {
      eventBody.attendees = data.attendees.map(a => ({
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
      sendUpdates: data.attendees && data.attendees.length > 0 ? 'all' : 'none',
      requestBody: eventBody,
    });

    let meetingUrl: string | undefined = data.meetingUrl;
    let meetingPlatform: 'meet' | 'teams' | undefined;

    if (createConference) {
      const hangoutLink = response.data.hangoutLink || undefined;
      const videoEntry = response.data.conferenceData?.entryPoints?.find(
        (e) => e.entryPointType === 'video' && e.uri,
      )?.uri;
      meetingUrl = hangoutLink || videoEntry || meetingUrl;
      if (meetingUrl) meetingPlatform = 'meet';
    } else if (meetingUrl?.includes('meet.google.com')) {
      meetingPlatform = 'meet';
    }

    return {
      success: true,
      provider: 'google',
      eventId: response.data.id || undefined,
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

/**
 * Create a meeting on the user's OAuth-connected Outlook calendar (Microsoft Graph).
 * Prefer this over the Replit connector for production users who connected via Settings.
 */
export async function createOutlookMeetingCalendarEvent(
  userId: string,
  data: MeetingEventData,
  storage: IStorage,
  baseUrl: string,
): Promise<CalendarSyncResult> {
  try {
    const accessToken = await ensureFreshOutlookToken(storage, userId, baseUrl);
    const graphClient = Client.initWithMiddleware({
      authProvider: { getAccessToken: async () => accessToken },
    });

    const endTime = data.endTime || new Date(data.startTime.getTime() + 60 * 60 * 1000);
    const createOnlineMeeting =
      data.createConference === true ||
      (data.createConference !== false && !data.meetingUrl);

    const event: Record<string, unknown> = {
      subject: data.title,
      body: {
        contentType: 'Text',
        content: data.description || `Meeting: ${data.title}\n\nCreated by LegalNote`,
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

    if (createOnlineMeeting) {
      event.isOnlineMeeting = true;
      event.onlineMeetingProvider = 'teamsForBusiness';
    }

    if (data.attendees && data.attendees.length > 0) {
      event.attendees = data.attendees.map((a) => ({
        emailAddress: {
          address: a.email,
          name: a.name || a.email,
        },
        type: 'required',
      }));
    }

    let response: {
      id?: string;
      onlineMeeting?: { joinUrl?: string };
      onlineMeetingUrl?: string;
    };

    try {
      response = await graphClient.api('/me/events').post(event);
    } catch (onlineErr) {
      if (!createOnlineMeeting) throw onlineErr;

      console.warn(
        '[OUTLOOK] Teams-for-business create failed, retrying without provider:',
        onlineErr instanceof Error ? onlineErr.message : onlineErr,
      );
      delete event.onlineMeetingProvider;
      try {
        response = await graphClient.api('/me/events').post(event);
      } catch (retryErr) {
        console.warn(
          '[OUTLOOK] Online meeting create failed, creating calendar event only:',
          retryErr instanceof Error ? retryErr.message : retryErr,
        );
        delete event.isOnlineMeeting;
        response = await graphClient.api('/me/events').post(event);
      }
    }

    const joinUrl =
      response.onlineMeeting?.joinUrl ||
      response.onlineMeetingUrl ||
      data.meetingUrl;

    return {
      success: true,
      provider: 'outlook',
      eventId: response.id || undefined,
      meetingUrl: joinUrl,
      meetingPlatform: !data.meetingUrl && joinUrl ? 'teams' : undefined,
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

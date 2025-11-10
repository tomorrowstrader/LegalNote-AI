import { google } from 'googleapis';
import { Client } from '@microsoft/microsoft-graph-client';
import type { IStorage } from './storage';
import type { CalendarIntegration } from '@shared/schema';
import { computeReminderSchedule, selectOutlookReminder } from './reminderScheduler';

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
  description += `\n\nCreated by LegalNote AI`;
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
    provider: integration.provider as 'google' | 'outlook',
    accessToken: newAccessToken,
    refreshToken: integration.refreshToken || undefined,
    expiresAt: newExpiresAt,
    calendarId: integration.calendarId || undefined,
    email: integration.email || undefined,
  });

  return newAccessToken;
}

// Token refresh for Microsoft
async function refreshMicrosoftToken(
  refreshToken: string,
  storage: IStorage,
  integration: CalendarIntegration
): Promise<string> {
  const clientId = process.env.MICROSOFT_CLIENT_ID;
  const clientSecret = process.env.MICROSOFT_CLIENT_SECRET;
  const tenantId = process.env.MICROSOFT_TENANT_ID || 'common';

  if (!clientId || !clientSecret) {
    throw new Error('Microsoft OAuth credentials not configured');
  }

  const tokenEndpoint = `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`;

  const params = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    grant_type: 'refresh_token',
    refresh_token: refreshToken,
    scope: 'Calendars.ReadWrite offline_access',
  });

  const response = await fetch(tokenEndpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params.toString(),
  });

  if (!response.ok) {
    throw new Error('Failed to refresh Microsoft access token');
  }

  const data = await response.json();
  const newAccessToken = data.access_token;
  const newRefreshToken = data.refresh_token;
  const expiresIn = data.expires_in; // seconds
  const newExpiresAt = new Date(Date.now() + expiresIn * 1000);

  // Update token in database
  await storage.saveCalendarIntegration({
    userId: integration.userId,
    provider: integration.provider as 'google' | 'outlook',
    accessToken: newAccessToken,
    refreshToken: newRefreshToken || refreshToken,
    expiresAt: newExpiresAt,
    calendarId: integration.calendarId || undefined,
    email: integration.email || undefined,
  });

  return newAccessToken;
}

// Get valid access token (with automatic refresh)
async function getValidAccessToken(
  userId: string,
  provider: 'google' | 'outlook',
  storage: IStorage
): Promise<{ token: string; integration: CalendarIntegration }> {
  const integration = await storage.getCalendarIntegration(userId, provider);

  if (!integration) {
    throw new Error(`${provider === 'google' ? 'Google Calendar' : 'Outlook'} not connected for this user`);
  }

  // Check if token is expired or about to expire (5 min buffer)
  const now = new Date();
  const expiresAt = integration.expiresAt ? new Date(integration.expiresAt) : null;
  const needsRefresh = !expiresAt || expiresAt.getTime() - now.getTime() < 5 * 60 * 1000;

  if (needsRefresh && integration.refreshToken) {
    const newToken = provider === 'google'
      ? await refreshGoogleToken(integration.refreshToken, storage, integration)
      : await refreshMicrosoftToken(integration.refreshToken, storage, integration);
    
    // Fetch updated integration with new token
    const updated = await storage.getCalendarIntegration(userId, provider);
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
      title: data.title,
      deadline: data.deadline.toISOString(),
      priority: data.priority,
      isAllDay: data.isAllDay,
    });

    const { token, integration } = await getValidAccessToken(userId, 'google', storage);
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
    const { token } = await getValidAccessToken(userId, 'google', storage);

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
    const { token } = await getValidAccessToken(userId, 'google', storage);

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

// Outlook reminder mapping (Outlook only supports ONE reminder)
// Use closest-to-deadline reminder for each priority level

// Outlook Calendar operations
async function createOutlookCalendarEvent(
  userId: string,
  data: CalendarEventData,
  storage: IStorage
): Promise<CalendarSyncResult> {
  try {
    const { token } = await getValidAccessToken(userId, 'outlook', storage);

    const client = Client.initWithMiddleware({
      authProvider: {
        getAccessToken: async () => token,
      },
    });

    // Format date in Europe/London timezone for all-day events
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

    // Compute time-based reminders with 8am floor constraint
    const schedule = computeReminderSchedule({
      deadline: data.deadline,
      isAllDay: data.isAllDay || false,
      priority: data.priority || 'normal',
    });

    const outlookReminder = selectOutlookReminder(schedule);

    const event: any = {
      subject: `Deadline: ${data.title}`,
      body: {
        contentType: 'Text',
        content: formatEventDescription(data),
      },
      isReminderOn: outlookReminder !== null,
      reminderMinutesBeforeStart: outlookReminder?.minutes || 60,
    };

    if (data.isAllDay) {
      // All-day event - Outlook requires isAllDay: true and midnight-to-midnight time range
      const dateStr = formatLocalDate(data.deadline);
      
      // Add one calendar day (not 24 hours!) to handle DST transitions correctly
      const [year, month, day] = dateStr.split('-').map(Number);
      const nextDay = new Date(year, month - 1, day + 1); // month is 0-indexed
      const endDateStr = formatLocalDate(nextDay);
      
      event.isAllDay = true;
      event.start = {
        dateTime: `${dateStr}T00:00:00`,
        timeZone: 'Europe/London',
      };
      event.end = {
        dateTime: `${endDateStr}T00:00:00`,
        timeZone: 'Europe/London',
      };
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

    const response = await client.api('/me/events').post(event);

    return {
      success: true,
      provider: 'outlook',
      eventId: response.id,
    };
  } catch (error: any) {
    return {
      success: false,
      provider: 'outlook',
      error: error.message || 'Failed to create Outlook Calendar event',
    };
  }
}

async function updateOutlookCalendarEvent(
  userId: string,
  eventId: string,
  data: CalendarEventData,
  storage: IStorage
): Promise<CalendarSyncResult> {
  try {
    const { token } = await getValidAccessToken(userId, 'outlook', storage);

    const client = Client.initWithMiddleware({
      authProvider: {
        getAccessToken: async () => token,
      },
    });

    // Format date in Europe/London timezone for all-day events
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

    // Compute time-based reminders with 8am floor constraint
    const schedule = computeReminderSchedule({
      deadline: data.deadline,
      isAllDay: data.isAllDay || false,
      priority: data.priority || 'normal',
    });

    const outlookReminder = selectOutlookReminder(schedule);

    const event: any = {
      subject: `Deadline: ${data.title}`,
      body: {
        contentType: 'Text',
        content: formatEventDescription(data),
      },
      isReminderOn: outlookReminder !== null,
      reminderMinutesBeforeStart: outlookReminder?.minutes || 60,
    };

    if (data.isAllDay) {
      // All-day event - Outlook requires isAllDay: true and midnight-to-midnight time range
      const dateStr = formatLocalDate(data.deadline);
      
      // Add one calendar day (not 24 hours!) to handle DST transitions correctly
      const [year, month, day] = dateStr.split('-').map(Number);
      const nextDay = new Date(year, month - 1, day + 1); // month is 0-indexed
      const endDateStr = formatLocalDate(nextDay);
      
      event.isAllDay = true;
      event.start = {
        dateTime: `${dateStr}T00:00:00`,
        timeZone: 'Europe/London',
      };
      event.end = {
        dateTime: `${endDateStr}T00:00:00`,
        timeZone: 'Europe/London',
      };
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

    await client.api(`/me/events/${eventId}`).patch(event);

    return {
      success: true,
      provider: 'outlook',
      eventId: eventId,
    };
  } catch (error: any) {
    return {
      success: false,
      provider: 'outlook',
      error: error.message || 'Failed to update Outlook Calendar event',
    };
  }
}

async function deleteOutlookCalendarEvent(
  userId: string,
  eventId: string,
  storage: IStorage
): Promise<CalendarSyncResult> {
  try {
    const { token } = await getValidAccessToken(userId, 'outlook', storage);

    const client = Client.initWithMiddleware({
      authProvider: {
        getAccessToken: async () => token,
      },
    });

    await client.api(`/me/events/${eventId}`).delete();

    return {
      success: true,
      provider: 'outlook',
    };
  } catch (error: any) {
    return {
      success: false,
      provider: 'outlook',
      error: error.message || 'Failed to delete Outlook Calendar event',
    };
  }
}

// Public API
export async function createCalendarEvent(
  userId: string,
  provider: 'google' | 'outlook',
  data: CalendarEventData,
  storage: IStorage
): Promise<CalendarSyncResult> {
  if (provider === 'google') {
    return createGoogleCalendarEvent(userId, data, storage);
  } else {
    return createOutlookCalendarEvent(userId, data, storage);
  }
}

export async function updateCalendarEvent(
  userId: string,
  provider: 'google' | 'outlook',
  eventId: string,
  data: CalendarEventData,
  storage: IStorage
): Promise<CalendarSyncResult> {
  if (provider === 'google') {
    return updateGoogleCalendarEvent(userId, eventId, data, storage);
  } else {
    return updateOutlookCalendarEvent(userId, eventId, data, storage);
  }
}

export async function deleteCalendarEvent(
  userId: string,
  provider: 'google' | 'outlook',
  eventId: string,
  storage: IStorage
): Promise<CalendarSyncResult> {
  if (provider === 'google') {
    return deleteGoogleCalendarEvent(userId, eventId, storage);
  } else {
    return deleteOutlookCalendarEvent(userId, eventId, storage);
  }
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
      connected: !!googleIntegration,
      email: googleIntegration?.email || undefined,
      connectedAt: googleIntegration?.connectedAt?.toISOString(),
    },
    outlook: {
      connected: !!outlookIntegration,
      email: outlookIntegration?.email || undefined,
      connectedAt: outlookIntegration?.connectedAt?.toISOString(),
    },
  };
}

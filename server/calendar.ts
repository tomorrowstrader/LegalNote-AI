import { google } from 'googleapis';
import { Client } from '@microsoft/microsoft-graph-client';

// Google Calendar client factory
let googleConnectionSettings: any;

async function getGoogleAccessToken() {
  if (googleConnectionSettings && googleConnectionSettings.settings.expires_at && new Date(googleConnectionSettings.settings.expires_at).getTime() > Date.now()) {
    return googleConnectionSettings.settings.access_token;
  }
  
  const hostname = process.env.REPLIT_CONNECTORS_HOSTNAME
  const xReplitToken = process.env.REPL_IDENTITY 
    ? 'repl ' + process.env.REPL_IDENTITY 
    : process.env.WEB_REPL_RENEWAL 
    ? 'depl ' + process.env.WEB_REPL_RENEWAL 
    : null;

  if (!xReplitToken) {
    throw new Error('X_REPLIT_TOKEN not found for repl/depl');
  }

  googleConnectionSettings = await fetch(
    'https://' + hostname + '/api/v2/connection?include_secrets=true&connector_names=google-calendar',
    {
      headers: {
        'Accept': 'application/json',
        'X_REPLIT_TOKEN': xReplitToken
      }
    }
  ).then(res => res.json()).then(data => data.items?.[0]);

  const accessToken = googleConnectionSettings?.settings?.access_token || googleConnectionSettings.settings?.oauth?.credentials?.access_token;

  if (!googleConnectionSettings || !accessToken) {
    throw new Error('Google Calendar not connected');
  }
  return accessToken;
}

async function getGoogleCalendarClient() {
  const accessToken = await getGoogleAccessToken();

  const oauth2Client = new google.auth.OAuth2();
  oauth2Client.setCredentials({
    access_token: accessToken
  });

  return google.calendar({ version: 'v3', auth: oauth2Client });
}

// Outlook client factory
let outlookConnectionSettings: any;

async function getOutlookAccessToken() {
  if (outlookConnectionSettings && outlookConnectionSettings.settings.expires_at && new Date(outlookConnectionSettings.settings.expires_at).getTime() > Date.now()) {
    return outlookConnectionSettings.settings.access_token;
  }
  
  const hostname = process.env.REPLIT_CONNECTORS_HOSTNAME
  const xReplitToken = process.env.REPL_IDENTITY 
    ? 'repl ' + process.env.REPL_IDENTITY 
    : process.env.WEB_REPL_RENEWAL 
    ? 'depl ' + process.env.WEB_REPL_RENEWAL 
    : null;

  if (!xReplitToken) {
    throw new Error('X_REPLIT_TOKEN not found for repl/depl');
  }

  outlookConnectionSettings = await fetch(
    'https://' + hostname + '/api/v2/connection?include_secrets=true&connector_names=outlook',
    {
      headers: {
        'Accept': 'application/json',
        'X_REPLIT_TOKEN': xReplitToken
      }
    }
  ).then(res => res.json()).then(data => data.items?.[0]);

  const accessToken = outlookConnectionSettings?.settings?.access_token || outlookConnectionSettings.settings?.oauth?.credentials?.access_token;

  if (!outlookConnectionSettings || !accessToken) {
    throw new Error('Outlook not connected');
  }
  return accessToken;
}

async function getOutlookClient() {
  const accessToken = await getOutlookAccessToken();

  return Client.initWithMiddleware({
    authProvider: {
      getAccessToken: async () => accessToken
    }
  });
}

// Calendar integration types
export interface CalendarEventData {
  caseId: string;
  title: string;
  clientName: string;
  matterReference?: string;
  deadline: Date;
  description?: string;
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
  description += `\n\nCreated by LegalNote AI`;
  return description;
}

// Google Calendar operations
async function createGoogleCalendarEvent(data: CalendarEventData): Promise<CalendarSyncResult> {
  try {
    const calendar = await getGoogleCalendarClient();
    
    const event = {
      summary: `Deadline: ${data.title}`,
      description: formatEventDescription(data),
      start: {
        dateTime: data.deadline.toISOString(),
        timeZone: 'Europe/London', // UK timezone
      },
      end: {
        dateTime: new Date(data.deadline.getTime() + 60 * 60 * 1000).toISOString(), // 1 hour duration
        timeZone: 'Europe/London',
      },
      reminders: {
        useDefault: false,
        overrides: [
          { method: 'email', minutes: 24 * 60 }, // 1 day before
          { method: 'popup', minutes: 60 }, // 1 hour before
        ],
      },
    };

    const response = await calendar.events.insert({
      calendarId: 'primary',
      requestBody: event,
    });

    return {
      success: true,
      provider: 'google',
      eventId: response.data.id || undefined,
    };
  } catch (error: any) {
    return {
      success: false,
      provider: 'google',
      error: error.message || 'Failed to create Google Calendar event',
    };
  }
}

async function updateGoogleCalendarEvent(eventId: string, data: CalendarEventData): Promise<CalendarSyncResult> {
  try {
    const calendar = await getGoogleCalendarClient();
    
    const event = {
      summary: `Deadline: ${data.title}`,
      description: formatEventDescription(data),
      start: {
        dateTime: data.deadline.toISOString(),
        timeZone: 'Europe/London',
      },
      end: {
        dateTime: new Date(data.deadline.getTime() + 60 * 60 * 1000).toISOString(),
        timeZone: 'Europe/London',
      },
      reminders: {
        useDefault: false,
        overrides: [
          { method: 'email', minutes: 24 * 60 },
          { method: 'popup', minutes: 60 },
        ],
      },
    };

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

async function deleteGoogleCalendarEvent(eventId: string): Promise<CalendarSyncResult> {
  try {
    const calendar = await getGoogleCalendarClient();
    
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

// Outlook Calendar operations
async function createOutlookCalendarEvent(data: CalendarEventData): Promise<CalendarSyncResult> {
  try {
    const client = await getOutlookClient();
    
    const event = {
      subject: `Deadline: ${data.title}`,
      body: {
        contentType: 'Text',
        content: formatEventDescription(data),
      },
      start: {
        dateTime: data.deadline.toISOString(),
        timeZone: 'GMT Standard Time', // UK timezone for Outlook
      },
      end: {
        dateTime: new Date(data.deadline.getTime() + 60 * 60 * 1000).toISOString(),
        timeZone: 'GMT Standard Time',
      },
      isReminderOn: true,
      reminderMinutesBeforeStart: 60, // 1 hour before
    };

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

async function updateOutlookCalendarEvent(eventId: string, data: CalendarEventData): Promise<CalendarSyncResult> {
  try {
    const client = await getOutlookClient();
    
    const event = {
      subject: `Deadline: ${data.title}`,
      body: {
        contentType: 'Text',
        content: formatEventDescription(data),
      },
      start: {
        dateTime: data.deadline.toISOString(),
        timeZone: 'GMT Standard Time',
      },
      end: {
        dateTime: new Date(data.deadline.getTime() + 60 * 60 * 1000).toISOString(),
        timeZone: 'GMT Standard Time',
      },
      isReminderOn: true,
      reminderMinutesBeforeStart: 60,
    };

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

async function deleteOutlookCalendarEvent(eventId: string): Promise<CalendarSyncResult> {
  try {
    const client = await getOutlookClient();
    
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
  provider: 'google' | 'outlook',
  data: CalendarEventData
): Promise<CalendarSyncResult> {
  if (provider === 'google') {
    return createGoogleCalendarEvent(data);
  } else {
    return createOutlookCalendarEvent(data);
  }
}

export async function updateCalendarEvent(
  provider: 'google' | 'outlook',
  eventId: string,
  data: CalendarEventData
): Promise<CalendarSyncResult> {
  if (provider === 'google') {
    return updateGoogleCalendarEvent(eventId, data);
  } else {
    return updateOutlookCalendarEvent(eventId, data);
  }
}

export async function deleteCalendarEvent(
  provider: 'google' | 'outlook',
  eventId: string
): Promise<CalendarSyncResult> {
  if (provider === 'google') {
    return deleteGoogleCalendarEvent(eventId);
  } else {
    return deleteOutlookCalendarEvent(eventId);
  }
}

// Check if calendar providers are connected
export async function getConnectedProviders(): Promise<{ google: boolean; outlook: boolean }> {
  let google = false;
  let outlook = false;

  try {
    await getGoogleAccessToken();
    google = true;
  } catch (error) {
    // Google Calendar not connected
  }

  try {
    await getOutlookAccessToken();
    outlook = true;
  } catch (error) {
    // Outlook not connected
  }

  return { google, outlook };
}

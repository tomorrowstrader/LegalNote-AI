// Replit-managed Google Calendar integration
// Uses Replit's connector system for OAuth token management

import { google, calendar_v3 } from 'googleapis';

let connectionSettings: any;

async function getAccessToken(): Promise<string> {
  // Check if we have a valid cached token
  if (connectionSettings && connectionSettings.settings?.expires_at && 
      new Date(connectionSettings.settings.expires_at).getTime() > Date.now()) {
    return connectionSettings.settings.access_token;
  }
  
  const hostname = process.env.REPLIT_CONNECTORS_HOSTNAME;
  const xReplitToken = process.env.REPL_IDENTITY 
    ? 'repl ' + process.env.REPL_IDENTITY 
    : process.env.WEB_REPL_RENEWAL 
    ? 'depl ' + process.env.WEB_REPL_RENEWAL 
    : null;

  if (!xReplitToken || !hostname) {
    throw new Error('Replit connector environment not available');
  }

  const response = await fetch(
    'https://' + hostname + '/api/v2/connection?include_secrets=true&connector_names=google-calendar',
    {
      headers: {
        'Accept': 'application/json',
        'X_REPLIT_TOKEN': xReplitToken
      }
    }
  );

  const data = await response.json();
  connectionSettings = data.items?.[0];

  const accessToken = connectionSettings?.settings?.access_token || 
                      connectionSettings?.settings?.oauth?.credentials?.access_token;

  if (!connectionSettings || !accessToken) {
    throw new Error('Google Calendar not connected via Replit');
  }
  
  return accessToken;
}

// Check if Replit Google Calendar connection is available
export async function isReplitCalendarConnected(): Promise<boolean> {
  try {
    await getAccessToken();
    return true;
  } catch {
    return false;
  }
}

// Get a fresh Google Calendar client (never cache - tokens expire)
export async function getReplitGoogleCalendarClient(): Promise<calendar_v3.Calendar> {
  const accessToken = await getAccessToken();

  const oauth2Client = new google.auth.OAuth2();
  oauth2Client.setCredentials({
    access_token: accessToken
  });

  return google.calendar({ version: 'v3', auth: oauth2Client });
}

// Create a calendar event using Replit's managed connection
export async function createReplitCalendarEvent(eventData: {
  caseId: string;
  title: string;
  deadline: string;
  notes?: string;
  priority?: string;
  isAllDay?: boolean;
}): Promise<{ success: boolean; eventId?: string; error?: string }> {
  try {
    console.log('[REPLIT-CALENDAR] Creating event:', eventData);
    
    const calendar = await getReplitGoogleCalendarClient();
    
    const deadlineDate = new Date(eventData.deadline);
    
    // Build event description with case context
    let description = `LegalNote AI Case Deadline\n\nCase: ${eventData.title}`;
    if (eventData.notes) {
      description += `\n\nNotes: ${eventData.notes}`;
    }
    if (eventData.priority && eventData.priority !== 'normal') {
      description += `\n\nPriority: ${eventData.priority.toUpperCase()}`;
    }
    description += `\n\nCase ID: ${eventData.caseId}`;

    // Determine if all-day event
    const isAllDay = eventData.isAllDay || 
      (deadlineDate.getHours() === 0 && deadlineDate.getMinutes() === 0);

    let event: calendar_v3.Schema$Event;
    
    if (isAllDay) {
      // All-day event format
      const dateStr = deadlineDate.toISOString().split('T')[0];
      event = {
        summary: `[LegalNote] ${eventData.title}`,
        description,
        start: { date: dateStr },
        end: { date: dateStr },
        reminders: {
          useDefault: false,
          overrides: [
            { method: 'popup', minutes: 24 * 60 }, // 1 day before
            { method: 'popup', minutes: 60 },       // 1 hour before
          ],
        },
      };
    } else {
      // Timed event - 1 hour duration
      const endDate = new Date(deadlineDate.getTime() + 60 * 60 * 1000);
      event = {
        summary: `[LegalNote] ${eventData.title}`,
        description,
        start: { 
          dateTime: deadlineDate.toISOString(),
          timeZone: 'Europe/London',
        },
        end: { 
          dateTime: endDate.toISOString(),
          timeZone: 'Europe/London',
        },
        reminders: {
          useDefault: false,
          overrides: [
            { method: 'popup', minutes: 24 * 60 }, // 1 day before
            { method: 'popup', minutes: 60 },       // 1 hour before
            { method: 'popup', minutes: 15 },       // 15 minutes before
          ],
        },
      };
    }

    const response = await calendar.events.insert({
      calendarId: 'primary',
      requestBody: event,
    });

    console.log('[REPLIT-CALENDAR] Event created:', response.data.id);
    
    return {
      success: true,
      eventId: response.data.id || undefined,
    };
  } catch (error: any) {
    console.error('[REPLIT-CALENDAR] Failed to create event:', error.message);
    return {
      success: false,
      error: error.message || 'Failed to create calendar event',
    };
  }
}

// Update an existing calendar event
export async function updateReplitCalendarEvent(eventId: string, eventData: {
  title: string;
  deadline: string;
  notes?: string;
  priority?: string;
  isAllDay?: boolean;
}): Promise<{ success: boolean; error?: string }> {
  try {
    console.log('[REPLIT-CALENDAR] Updating event:', eventId, eventData);
    
    const calendar = await getReplitGoogleCalendarClient();
    
    const deadlineDate = new Date(eventData.deadline);
    
    let description = `LegalNote AI Case Deadline\n\nCase: ${eventData.title}`;
    if (eventData.notes) {
      description += `\n\nNotes: ${eventData.notes}`;
    }
    if (eventData.priority && eventData.priority !== 'normal') {
      description += `\n\nPriority: ${eventData.priority.toUpperCase()}`;
    }

    const isAllDay = eventData.isAllDay || 
      (deadlineDate.getHours() === 0 && deadlineDate.getMinutes() === 0);

    let event: calendar_v3.Schema$Event;
    
    if (isAllDay) {
      const dateStr = deadlineDate.toISOString().split('T')[0];
      event = {
        summary: `[LegalNote] ${eventData.title}`,
        description,
        start: { date: dateStr },
        end: { date: dateStr },
      };
    } else {
      const endDate = new Date(deadlineDate.getTime() + 60 * 60 * 1000);
      event = {
        summary: `[LegalNote] ${eventData.title}`,
        description,
        start: { 
          dateTime: deadlineDate.toISOString(),
          timeZone: 'Europe/London',
        },
        end: { 
          dateTime: endDate.toISOString(),
          timeZone: 'Europe/London',
        },
      };
    }

    await calendar.events.update({
      calendarId: 'primary',
      eventId,
      requestBody: event,
    });

    console.log('[REPLIT-CALENDAR] Event updated successfully');
    
    return { success: true };
  } catch (error: any) {
    console.error('[REPLIT-CALENDAR] Failed to update event:', error.message);
    return {
      success: false,
      error: error.message || 'Failed to update calendar event',
    };
  }
}

// Delete a calendar event
export async function deleteReplitCalendarEvent(eventId: string): Promise<{ success: boolean; error?: string }> {
  try {
    console.log('[REPLIT-CALENDAR] Deleting event:', eventId);
    
    const calendar = await getReplitGoogleCalendarClient();
    
    await calendar.events.delete({
      calendarId: 'primary',
      eventId,
    });

    console.log('[REPLIT-CALENDAR] Event deleted successfully');
    
    return { success: true };
  } catch (error: any) {
    console.error('[REPLIT-CALENDAR] Failed to delete event:', error.message);
    return {
      success: false,
      error: error.message || 'Failed to delete calendar event',
    };
  }
}

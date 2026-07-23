// Replit-managed Outlook Calendar integration
// Uses Replit's connector system for OAuth token management via Microsoft Graph API
// Integration ID: connection:conn_outlook_01K8QRVKEVTRKA9K3VVB1XDAAA

import { Client } from '@microsoft/microsoft-graph-client';
import { computeReminderSchedule } from './reminderScheduler';

let connectionSettings: any;

async function getAccessToken(): Promise<string> {
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
    'https://' + hostname + '/api/v2/connection?include_secrets=true&connector_names=outlook',
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
    throw new Error('Outlook not connected via Replit');
  }
  
  return accessToken;
}

// Check if Replit Outlook connection is available
export async function isReplitOutlookConnected(): Promise<boolean> {
  try {
    await getAccessToken();
    return true;
  } catch {
    return false;
  }
}

// Get user's email from Outlook
export async function getOutlookUserEmail(): Promise<string | null> {
  try {
    const client = await getUncachableOutlookClient();
    const user = await client.api('/me').select('mail,userPrincipalName').get();
    return user.mail || user.userPrincipalName || null;
  } catch (error) {
    console.error('[OUTLOOK] Failed to get user email:', error);
    return null;
  }
}

// WARNING: Never cache this client.
// Access tokens expire, so a new client must be created each time.
// Always call this function again to get a fresh client.
export async function getUncachableOutlookClient(): Promise<Client> {
  const accessToken = await getAccessToken();

  return Client.initWithMiddleware({
    authProvider: {
      getAccessToken: async () => accessToken
    }
  });
}

// Create a calendar event using Replit's managed Outlook connection
export async function createReplitOutlookEvent(eventData: {
  caseId: string;
  title: string;
  clientName: string;
  matterReference?: string;
  deadline: string;
  notes?: string;
  priority?: string;
  isAllDay?: boolean;
}): Promise<{ success: boolean; eventId?: string; error?: string }> {
  try {
    console.log('[OUTLOOK] Creating event for case:', eventData.caseId, 'deadline:', eventData.deadline);
    
    const client = await getUncachableOutlookClient();
    const deadlineDate = new Date(eventData.deadline);
    
    // Build event description with case context
    let description = `LegalNote Case Deadline\n\nCase: ${eventData.title}\nClient: ${eventData.clientName}`;
    if (eventData.matterReference) {
      description += `\nMatter Reference: ${eventData.matterReference}`;
    }
    if (eventData.notes) {
      description += `\n\nNotes: ${eventData.notes}`;
    }
    if (eventData.priority && eventData.priority !== 'normal') {
      description += `\n\nPriority: ${eventData.priority.toUpperCase()}`;
    }
    description += `\n\nCase ID: ${eventData.caseId}\nCreated by LegalNote`;

    // Compute time-based reminders
    const { minutesBefore } = computeReminderSchedule({
      deadline: deadlineDate,
      isAllDay: eventData.isAllDay || false,
      priority: eventData.priority || 'normal',
    });

    // Build Microsoft Graph event object
    const event: any = {
      subject: `Deadline: ${eventData.title}`,
      body: {
        contentType: 'Text',
        content: description
      },
      isReminderOn: true,
      reminderMinutesBeforeStart: minutesBefore[0] || 15, // Use first reminder
    };

    if (eventData.isAllDay) {
      // All-day event format for Outlook
      const dateStr = deadlineDate.toISOString().split('T')[0];
      event.isAllDay = true;
      event.start = {
        dateTime: `${dateStr}T00:00:00`,
        timeZone: 'Europe/London'
      };
      event.end = {
        dateTime: `${dateStr}T23:59:59`,
        timeZone: 'Europe/London'
      };
    } else {
      // Timed event - 1 hour duration
      const endDate = new Date(deadlineDate.getTime() + 60 * 60 * 1000);
      event.start = {
        dateTime: deadlineDate.toISOString(),
        timeZone: 'Europe/London'
      };
      event.end = {
        dateTime: endDate.toISOString(),
        timeZone: 'Europe/London'
      };
    }

    const response = await client.api('/me/events').post(event);

    console.log('[OUTLOOK] Event created:', response.id);
    
    return {
      success: true,
      eventId: response.id || undefined,
    };
  } catch (error: any) {
    console.error('[OUTLOOK] Failed to create event:', error.message);
    return {
      success: false,
      error: error.message || 'Failed to create Outlook calendar event',
    };
  }
}

/** Create a video/client meeting event (not a case deadline). */
export async function createReplitOutlookMeetingEvent(eventData: {
  title: string;
  description?: string;
  startTime: Date;
  endTime?: Date;
  meetingUrl?: string;
  attendees?: Array<{ email: string; name?: string }>;
}): Promise<{ success: boolean; eventId?: string; error?: string }> {
  try {
    const client = await getUncachableOutlookClient();
    const endTime = eventData.endTime || new Date(eventData.startTime.getTime() + 60 * 60 * 1000);

    const description =
      eventData.description ||
      `Meeting: ${eventData.title}\n\nCreated by LegalNote`;

    const event: Record<string, unknown> = {
      subject: eventData.title,
      body: {
        contentType: 'Text',
        content: description,
      },
      start: {
        dateTime: eventData.startTime.toISOString(),
        timeZone: 'Europe/London',
      },
      end: {
        dateTime: endTime.toISOString(),
        timeZone: 'Europe/London',
      },
      isReminderOn: true,
      reminderMinutesBeforeStart: 15,
    };

    if (eventData.meetingUrl) {
      event.location = { displayName: eventData.meetingUrl };
    }

    if (eventData.attendees && eventData.attendees.length > 0) {
      event.attendees = eventData.attendees.map((a) => ({
        emailAddress: {
          address: a.email,
          name: a.name || a.email,
        },
        type: 'required',
      }));
    }

    const response = await client.api('/me/events').post(event);
    console.log('[OUTLOOK] Meeting event created:', response.id);

    return {
      success: true,
      eventId: response.id || undefined,
    };
  } catch (error: unknown) {
    const err = error instanceof Error ? error : new Error(String(error));
    console.error('[OUTLOOK] Failed to create meeting event:', err.message);
    return {
      success: false,
      error: err.message || 'Failed to create Outlook meeting event',
    };
  }
}

// Update an existing Outlook calendar event
export async function updateReplitOutlookEvent(eventId: string, eventData: {
  title: string;
  clientName: string;
  matterReference?: string;
  deadline: string;
  notes?: string;
  priority?: string;
  isAllDay?: boolean;
}): Promise<{ success: boolean; error?: string }> {
  try {
    console.log('[OUTLOOK] Updating event:', eventId);
    
    const client = await getUncachableOutlookClient();
    const deadlineDate = new Date(eventData.deadline);
    
    let description = `LegalNote Case Deadline\n\nCase: ${eventData.title}\nClient: ${eventData.clientName}`;
    if (eventData.matterReference) {
      description += `\nMatter Reference: ${eventData.matterReference}`;
    }
    if (eventData.notes) {
      description += `\n\nNotes: ${eventData.notes}`;
    }
    if (eventData.priority && eventData.priority !== 'normal') {
      description += `\n\nPriority: ${eventData.priority.toUpperCase()}`;
    }

    const { minutesBefore } = computeReminderSchedule({
      deadline: deadlineDate,
      isAllDay: eventData.isAllDay || false,
      priority: eventData.priority || 'normal',
    });

    const event: any = {
      subject: `Deadline: ${eventData.title}`,
      body: {
        contentType: 'Text',
        content: description
      },
      isReminderOn: true,
      reminderMinutesBeforeStart: minutesBefore[0] || 15,
    };

    if (eventData.isAllDay) {
      const dateStr = deadlineDate.toISOString().split('T')[0];
      event.isAllDay = true;
      event.start = {
        dateTime: `${dateStr}T00:00:00`,
        timeZone: 'Europe/London'
      };
      event.end = {
        dateTime: `${dateStr}T23:59:59`,
        timeZone: 'Europe/London'
      };
    } else {
      const endDate = new Date(deadlineDate.getTime() + 60 * 60 * 1000);
      event.start = {
        dateTime: deadlineDate.toISOString(),
        timeZone: 'Europe/London'
      };
      event.end = {
        dateTime: endDate.toISOString(),
        timeZone: 'Europe/London'
      };
    }

    await client.api(`/me/events/${eventId}`).patch(event);

    console.log('[OUTLOOK] Event updated successfully');
    
    return { success: true };
  } catch (error: any) {
    console.error('[OUTLOOK] Failed to update event:', error.message);
    return {
      success: false,
      error: error.message || 'Failed to update Outlook calendar event',
    };
  }
}

// Delete an Outlook calendar event
export async function deleteReplitOutlookEvent(eventId: string): Promise<{ success: boolean; error?: string }> {
  try {
    console.log('[OUTLOOK] Deleting event:', eventId);
    
    const client = await getUncachableOutlookClient();
    
    await client.api(`/me/events/${eventId}`).delete();

    console.log('[OUTLOOK] Event deleted successfully');
    
    return { success: true };
  } catch (error: any) {
    console.error('[OUTLOOK] Failed to delete event:', error.message);
    return {
      success: false,
      error: error.message || 'Failed to delete Outlook calendar event',
    };
  }
}

// Get upcoming calendar events from Outlook
export async function getUpcomingOutlookEvents(daysAhead: number = 7): Promise<any[]> {
  try {
    const client = await getUncachableOutlookClient();
    
    const now = new Date();
    const endDate = new Date(now.getTime() + daysAhead * 24 * 60 * 60 * 1000);
    
    const events = await client
      .api('/me/calendarview')
      .query({
        startDateTime: now.toISOString(),
        endDateTime: endDate.toISOString(),
        $select: 'id,subject,start,end,isAllDay,webLink,onlineMeeting,location,attendees',
        $orderby: 'start/dateTime',
        $top: 50
      })
      .get();

    return events.value || [];
  } catch (error: any) {
    console.error('[OUTLOOK] Failed to get upcoming events:', error.message);
    return [];
  }
}

import { google, calendar_v3 } from 'googleapis';
import { storage } from '../storage';
import type { ScheduledMeeting, InsertScheduledMeeting, CalendarIntegration } from '@shared/schema';
import { recallService } from './recallService';
import { sendPreConsentEmail } from '../email';
import { randomBytes } from 'crypto';

interface CalendarMeeting {
  id: string;
  title: string;
  description?: string;
  startTime: Date;
  endTime?: Date;
  meetingUrl?: string;
  meetingPlatform?: 'zoom' | 'teams' | 'meet' | 'webex';
  attendees: Array<{
    email: string;
    name?: string;
    responseStatus?: string;
  }>;
}

function refreshGoogleToken(
  refreshToken: string,
  integration: CalendarIntegration
): Promise<string> {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error('Google OAuth credentials not configured');
  }

  const oauth2Client = new google.auth.OAuth2(clientId, clientSecret);
  oauth2Client.setCredentials({ refresh_token: refreshToken });

  return new Promise(async (resolve, reject) => {
    try {
      const { credentials } = await oauth2Client.refreshAccessToken();
      const newAccessToken = credentials.access_token;

      if (!newAccessToken) {
        reject(new Error('Failed to refresh Google access token'));
        return;
      }

      await storage.saveCalendarIntegration({
        userId: integration.userId,
        provider: 'google',
        accessToken: newAccessToken,
        refreshToken: integration.refreshToken || undefined,
        expiresAt: credentials.expiry_date ? new Date(credentials.expiry_date) : undefined,
        calendarId: integration.calendarId || undefined,
        email: integration.email || undefined,
      });

      resolve(newAccessToken);
    } catch (error) {
      reject(error);
    }
  });
}

async function getValidAccessToken(userId: string): Promise<{ token: string; integration: CalendarIntegration }> {
  const integration = await storage.getCalendarIntegration(userId, 'google');

  if (!integration) {
    throw new Error('Google Calendar not connected for this user');
  }

  const now = new Date();
  const expiresAt = integration.expiresAt ? new Date(integration.expiresAt) : null;
  const needsRefresh = !expiresAt || expiresAt.getTime() - now.getTime() < 5 * 60 * 1000;

  if (needsRefresh && integration.refreshToken) {
    const newToken = await refreshGoogleToken(integration.refreshToken, integration);
    const updated = await storage.getCalendarIntegration(userId, 'google');
    if (!updated) {
      throw new Error('Failed to retrieve updated integration');
    }
    return { token: newToken, integration: updated };
  }

  return { token: integration.accessToken, integration };
}

function extractMeetingUrl(event: calendar_v3.Schema$Event): { url?: string; platform?: 'zoom' | 'teams' | 'meet' | 'webex' } {
  if (event.conferenceData?.entryPoints) {
    for (const entry of event.conferenceData.entryPoints) {
      if (entry.entryPointType === 'video' && entry.uri) {
        const uri = entry.uri.toLowerCase();
        if (uri.includes('zoom.us')) {
          return { url: entry.uri, platform: 'zoom' };
        } else if (uri.includes('teams.microsoft.com') || uri.includes('teams.live.com')) {
          return { url: entry.uri, platform: 'teams' };
        } else if (uri.includes('meet.google.com')) {
          return { url: entry.uri, platform: 'meet' };
        } else if (uri.includes('webex.com')) {
          return { url: entry.uri, platform: 'webex' };
        }
      }
    }
  }

  if (event.hangoutLink) {
    return { url: event.hangoutLink, platform: 'meet' };
  }

  const description = event.description || '';
  const location = event.location || '';
  const textToSearch = `${description} ${location}`;

  const zoomMatch = textToSearch.match(/https:\/\/[\w.-]*zoom\.us\/j\/[\w?=&-]+/i);
  if (zoomMatch) {
    return { url: zoomMatch[0], platform: 'zoom' };
  }

  const teamsMatch = textToSearch.match(/https:\/\/teams\.microsoft\.com\/l\/meetup-join\/[^\s"<>]+/i);
  if (teamsMatch) {
    return { url: teamsMatch[0], platform: 'teams' };
  }

  const meetMatch = textToSearch.match(/https:\/\/meet\.google\.com\/[\w-]+/i);
  if (meetMatch) {
    return { url: meetMatch[0], platform: 'meet' };
  }

  const webexMatch = textToSearch.match(/https:\/\/[\w.-]*webex\.com\/[\w/.-]+/i);
  if (webexMatch) {
    return { url: webexMatch[0], platform: 'webex' };
  }

  return {};
}

function parseAttendees(event: calendar_v3.Schema$Event): CalendarMeeting['attendees'] {
  if (!event.attendees) {
    return [];
  }

  return event.attendees
    .filter(a => a.email && !a.self)
    .map(a => ({
      email: a.email!,
      name: a.displayName || undefined,
      responseStatus: a.responseStatus || undefined,
    }));
}

export class MeetingSchedulerService {
  async pollCalendarMeetings(userId: string): Promise<ScheduledMeeting[]> {
    console.log(`[MEETING_SCHEDULER] Polling calendar for user ${userId}`);

    const { token } = await getValidAccessToken(userId);

    const oauth2Client = new google.auth.OAuth2();
    oauth2Client.setCredentials({ access_token: token });

    const calendar = google.calendar({ version: 'v3', auth: oauth2Client });

    const now = new Date();
    const sevenDaysAhead = new Date();
    sevenDaysAhead.setDate(sevenDaysAhead.getDate() + 7);

    const response = await calendar.events.list({
      calendarId: 'primary',
      timeMin: now.toISOString(),
      timeMax: sevenDaysAhead.toISOString(),
      singleEvents: true,
      orderBy: 'startTime',
      maxResults: 50,
    });

    const events = response.data.items || [];
    const scheduledMeetings: ScheduledMeeting[] = [];

    for (const event of events) {
      if (!event.id || !event.summary) continue;

      if (event.start?.date && !event.start?.dateTime) continue;

      const startTime = event.start?.dateTime ? new Date(event.start.dateTime) : null;
      const endTime = event.end?.dateTime ? new Date(event.end.dateTime) : null;

      if (!startTime) continue;

      const { url: meetingUrl, platform: meetingPlatform } = extractMeetingUrl(event);
      const attendees = parseAttendees(event);

      const primaryAttendee = attendees.find(a => 
        a.responseStatus === 'accepted' || 
        a.responseStatus === 'tentative' ||
        a.responseStatus === 'needsAction'
      ) || attendees[0];

      const validPlatforms = ['zoom', 'teams', 'meet', 'webex'] as const;
      const validatedPlatform = validPlatforms.includes(meetingPlatform as typeof validPlatforms[number])
        ? (meetingPlatform as typeof validPlatforms[number])
        : undefined;

      const meetingData: InsertScheduledMeeting = {
        userId,
        calendarEventId: event.id,
        calendarProvider: 'google',
        title: event.summary,
        description: event.description || undefined,
        meetingUrl: meetingUrl || undefined,
        meetingPlatform: validatedPlatform,
        startTime,
        endTime: endTime || undefined,
        attendees: attendees,
        clientEmail: primaryAttendee?.email || undefined,
        clientName: primaryAttendee?.name || undefined,
        autoRecordEnabled: false,
        consentStatus: 'pending',
        status: 'scheduled',
        lastPolledAt: new Date(),
      };

      const meeting = await storage.createScheduledMeeting(meetingData);
      scheduledMeetings.push(meeting);
    }

    console.log(`[MEETING_SCHEDULER] Found ${scheduledMeetings.length} meetings for user ${userId}`);
    return scheduledMeetings;
  }

  async sendConsentEmailForMeeting(meeting: ScheduledMeeting): Promise<boolean> {
    if (!meeting.clientEmail || !meeting.clientName) {
      console.log(`[MEETING_SCHEDULER] No client email for meeting ${meeting.id}`);
      return false;
    }

    const consentToken = randomBytes(32).toString('hex');
    const baseUrl = process.env.APP_URL?.replace(/\/$/, '') || 'https://legalnote.ai';
    const consentUrl = `${baseUrl}/consent/${consentToken}`;

    const meetingDate = new Date(meeting.startTime).toLocaleDateString('en-GB', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
    const meetingTime = new Date(meeting.startTime).toLocaleTimeString('en-GB', {
      hour: '2-digit',
      minute: '2-digit',
    });

    const emailSubject = `Recording Consent Request - Meeting on ${meetingDate}`;
    const emailBody = `
Dear ${meeting.clientName},

We would like to record our upcoming meeting scheduled for ${meetingDate} at ${meetingTime}.

Meeting: ${meeting.title}

The recording will be used to:
- Create accurate attendance notes
- Ensure nothing important is missed
- Provide you with a written record of our discussion

Please click the link below to provide your consent:
${consentUrl}

If you do not wish the meeting to be recorded, simply ignore this email and we will not record it.

Kind regards,
Your Legal Team
    `.trim();

    const preConsentEmail = await storage.createPreConsentEmail({
      userId: meeting.userId,
      recipientEmail: meeting.clientEmail,
      recipientName: meeting.clientName,
      meetingPlatform: (['zoom', 'teams', 'meet', 'webex'] as const).includes(
        meeting.meetingPlatform as 'zoom' | 'teams' | 'meet' | 'webex'
      ) ? (meeting.meetingPlatform as 'zoom' | 'teams' | 'meet' | 'webex') : undefined,
      scheduledMeetingTime: meeting.startTime,
      meetingUrl: meeting.meetingUrl || undefined,
      emailSubject,
      emailBody,
      consentToken,
      emailStatus: 'pending',
      expiresAt: meeting.startTime,
    });

    try {
      await sendPreConsentEmail({
        to: meeting.clientEmail,
        recipientName: meeting.clientName,
        subject: emailSubject,
        body: emailBody,
        consentUrl,
      });

      await storage.updatePreConsentEmail(preConsentEmail.id, { emailStatus: 'sent' });
      await storage.updateScheduledMeeting(meeting.id, {
        consentStatus: 'sent',
        preConsentEmailId: preConsentEmail.id,
      });

      console.log(`[MEETING_SCHEDULER] Sent consent email for meeting ${meeting.id}`);
      return true;
    } catch (error) {
      console.error(`[MEETING_SCHEDULER] Failed to send consent email:`, error);
      await storage.updatePreConsentEmail(preConsentEmail.id, { emailStatus: 'failed' });
      return false;
    }
  }

  async deployBotForMeeting(meeting: ScheduledMeeting): Promise<boolean> {
    if (!meeting.meetingUrl) {
      console.error(`[MEETING_SCHEDULER] No meeting URL for meeting ${meeting.id}`);
      await storage.updateScheduledMeeting(meeting.id, { botStatus: 'failed' });
      return false;
    }

    if (!recallService.isConfigured()) {
      console.error(`[MEETING_SCHEDULER] Recall.ai not configured`);
      await storage.updateScheduledMeeting(meeting.id, { botStatus: 'failed' });
      return false;
    }

    try {
      await storage.updateScheduledMeeting(meeting.id, { botStatus: 'waiting' });

      const bot = await recallService.createBot(meeting.meetingUrl, 'LegalNote');

      await storage.updateScheduledMeeting(meeting.id, {
        recallBotId: bot.id,
        botStatus: 'joining',
      });

      console.log(`[MEETING_SCHEDULER] Deployed bot ${bot.id} for meeting ${meeting.id}`);
      return true;
    } catch (error) {
      console.error(`[MEETING_SCHEDULER] Failed to deploy bot:`, error);
      await storage.updateScheduledMeeting(meeting.id, { botStatus: 'failed' });
      return false;
    }
  }

  async checkBotStatus(meeting: ScheduledMeeting): Promise<string | null> {
    if (!meeting.recallBotId) {
      return null;
    }

    try {
      const bot = await recallService.getBot(meeting.recallBotId);
      const status = bot.status?.code || 'unknown';

      let botStatus: string;
      switch (status) {
        case 'ready':
        case 'joining':
          botStatus = 'joining';
          break;
        case 'in_call_recording':
        case 'in_waiting_room':
          botStatus = 'in_call';
          break;
        case 'done':
          botStatus = 'done';
          break;
        case 'fatal':
        case 'analysis_failed':
          botStatus = 'failed';
          break;
        default:
          botStatus = 'waiting';
      }

      const updates: Partial<ScheduledMeeting> = { botStatus };
      if (botStatus === 'done' && meeting.botStatus !== 'done') {
        updates.status = 'completed';
      }
      await storage.updateScheduledMeeting(meeting.id, updates);

      if (botStatus === 'done' && meeting.botStatus !== 'done' && meeting.caseId) {
        try {
          await this.autoFileRecordingToCase(meeting);
        } catch (err) {
          console.error(`[MEETING_SCHEDULER] Failed to auto-file recording to case:`, err);
        }
      }

      return botStatus;
    } catch (error) {
      console.error(`[MEETING_SCHEDULER] Failed to check bot status:`, error);
      return null;
    }
  }

  async autoFileRecordingToCase(meeting: ScheduledMeeting): Promise<void> {
    if (!meeting.recallBotId || !meeting.caseId) return;
    
    if (meeting.meetingImportId) {
      console.log(`[MEETING_SCHEDULER] Meeting ${meeting.id} already has import ${meeting.meetingImportId}, skipping auto-file`);
      return;
    }

    console.log(`[MEETING_SCHEDULER] Auto-filing recording from meeting ${meeting.id} to case ${meeting.caseId}`);

    const existingImport = await recallService.startMeetingImport(
      meeting.userId,
      meeting.recallBotId,
      meeting.caseId,
      meeting.consentStatus === 'approved',
      meeting.preConsentEmailId || undefined
    );

    await storage.updateScheduledMeeting(meeting.id, {
      meetingImportId: existingImport.id,
    });

    console.log(`[MEETING_SCHEDULER] Auto-filed recording ${existingImport.id} to case ${meeting.caseId}`);
  }

  async processConsentResponse(consentToken: string, approved: boolean, ipAddress: string): Promise<boolean> {
    const preConsentEmail = await storage.getPreConsentEmailByToken(consentToken);
    if (!preConsentEmail) {
      return false;
    }

    if (approved) {
      await storage.acknowledgePreConsentEmail(preConsentEmail.id, ipAddress);
    }

    const meetings = await storage.getScheduledMeetingsByUser(preConsentEmail.userId);
    const meeting = meetings.find(m => m.preConsentEmailId === preConsentEmail.id);

    if (meeting) {
      await storage.updateScheduledMeeting(meeting.id, {
        consentStatus: approved ? 'approved' : 'declined',
      });
    }

    return true;
  }

  async runScheduledTasks(userId: string): Promise<void> {
    const meetingsNeedingConsent = await storage.getMeetingsNeedingConsent(userId);
    for (const meeting of meetingsNeedingConsent) {
      await this.sendConsentEmailForMeeting(meeting);
    }

    const meetingsReadyForBot = await storage.getMeetingsReadyForBot(userId);
    for (const meeting of meetingsReadyForBot) {
      await this.deployBotForMeeting(meeting);
    }

    const upcomingMeetings = await storage.getUpcomingScheduledMeetings(userId, 1);
    for (const meeting of upcomingMeetings) {
      if (meeting.recallBotId && meeting.botStatus !== 'done' && meeting.botStatus !== 'failed') {
        await this.checkBotStatus(meeting);
      }
    }
  }
}

export const meetingSchedulerService = new MeetingSchedulerService();

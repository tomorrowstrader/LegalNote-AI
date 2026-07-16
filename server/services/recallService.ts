import { storage } from '../storage';
import type { MeetingImport, RecallConnection } from '@shared/schema';

// Recall.ai uses regional endpoints - default to us-west-2, can be overridden via env var
// Options: us-west-2, us-east-1, eu-central-1, ap-northeast-1
const RECALL_REGION = process.env.RECALL_REGION || 'us-west-2';
const RECALL_API_BASE = `https://${RECALL_REGION}.recall.ai/api/v1`;

// Read API key dynamically to handle secrets loaded after module init
function getRecallApiKey(): string {
  return process.env.RECALL_API_KEY || '';
}

interface RecallBotStatusChange {
  code: string;
  sub_code?: string;
  message?: string;
  created_at: string;
}

interface RecallBotResponse {
  id: string;
  meeting_url: string | { meeting_id?: string; platform?: string; meeting_password?: string };
  // New API: status_changes array replaces the single `status` field
  status_changes: RecallBotStatusChange[];
  // Legacy field — may be absent in v2 responses
  status?: {
    code: string;
    message?: string;
    created_at: string;
    sub_code?: string;
  };
  recordings?: Array<{
    id: string;
    media_shortcuts?: {
      audio_only?: { data?: { url?: string } };
      video_mixed?: { data?: { url?: string } };
    };
  }>;
  video_url?: string;
  audio_url?: string;
  recording?: {
    id: string;
  };
  meeting_metadata?: {
    title?: string;
    start_time?: string;
    end_time?: string;
  };
  meeting_participants?: Array<{
    id: number;
    name: string;
    events: Array<{
      code: string;
      created_at: string;
    }>;
  }>;
  transcript?: Array<{
    speaker: string;
    speaker_id: number;
    words: Array<{
      text: string;
      start_time: number;
      end_time: number;
      confidence: number;
    }>;
  }>;
}

interface RecallBotListResponse {
  results: RecallBotResponse[];
  next?: string;
  previous?: string;
}

interface RecallRecordingResponse {
  id: string;
  bot_id: string;
  media: {
    audio_url?: string;
    video_url?: string;
  };
  duration_seconds?: number;
  created_at: string;
}

interface RecallError {
  error: string;
  message: string;
  code?: string;
}

export class RecallService {
  constructor() {
    // API key is read dynamically via getRecallApiKey()
  }
  
  isConfigured(): boolean {
    return !!getRecallApiKey();
  }

  /** Extract the latest status code from a bot — handles both old `status.code` and new `status_changes[]` */
  getBotStatusCode(bot: RecallBotResponse): string | undefined {
    if (bot.status_changes?.length) {
      return bot.status_changes[bot.status_changes.length - 1].code;
    }
    return bot.status?.code;
  }

  getBotSubCode(bot: RecallBotResponse): string | undefined {
    if (bot.status_changes?.length) {
      return bot.status_changes[bot.status_changes.length - 1].sub_code;
    }
    return bot.status?.sub_code;
  }

  private async apiRequest<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const rawKey = getRecallApiKey();
    if (!rawKey) {
      throw new Error('Recall.ai API key not configured');
    }
    // Strip any "Token " or "Bearer " prefix the user may have inadvertently included,
    // then remove ALL whitespace/non-printable characters that might have crept in via copy-paste
    const apiKey = rawKey
      .replace(/^(Token|Bearer)\s+/i, '')
      .replace(/[^\x21-\x7E]/g, '') // strip anything that isn't printable ASCII (no spaces)
      .trim();
    
    const url = `${RECALL_API_BASE}${endpoint}`;
    const headers: HeadersInit = {
      'Authorization': `Token ${apiKey}`,
      'Content-Type': 'application/json',
      ...options.headers,
    };
    
    const response = await fetch(url, {
      ...options,
      headers,
    });
    
    if (!response.ok) {
      let errorMessage = `Recall API error: ${response.status}`;
      let rawBody = '';
      try {
        rawBody = await response.text();
        const parsed = JSON.parse(rawBody);
        if (parsed.message) {
          errorMessage = parsed.message;
        } else if (parsed.error) {
          errorMessage = parsed.error;
        } else if (parsed.detail) {
          errorMessage = parsed.detail;
        } else if (typeof parsed === 'object') {
          // Field-level validation errors: { field: ["message"] }
          const fieldErrors = Object.entries(parsed)
            .map(([field, msgs]) => `${field}: ${Array.isArray(msgs) ? msgs[0] : msgs}`)
            .join('; ');
          if (fieldErrors) errorMessage = fieldErrors;
        }
      } catch {
        if (rawBody) errorMessage = `${errorMessage} — ${rawBody.slice(0, 200)}`;
      }
      console.error(`[Recall.ai] ${response.status} from ${url}: ${errorMessage} | region=${RECALL_REGION} | key_len=${apiKey.length} | key_prefix=${apiKey.substring(0,4)}... | www-auth=${response.headers.get('www-authenticate') || 'none'}`);
      throw new Error(errorMessage);
    }
    
    return response.json() as Promise<T>;
  }
  
  async createBot(meetingUrl: string, botName: string = 'LegalNote'): Promise<RecallBotResponse> {
    return this.apiRequest<RecallBotResponse>('/bot/', {
      method: 'POST',
      body: JSON.stringify({
        meeting_url: meetingUrl,
        bot_name: botName,
        automatic_leave: {
          waiting_room_timeout: 600,
          noone_joined_timeout: 300,
          everyone_left_timeout: { timeout: 60, activate_after: null },
        },
      }),
    });
  }
  
  async getBot(botId: string): Promise<RecallBotResponse> {
    return this.apiRequest<RecallBotResponse>(`/bot/${botId}/`);
  }

  /** Remove a live bot from the meeting immediately. Irreversible. */
  async leaveCall(botId: string): Promise<RecallBotResponse> {
    return this.apiRequest<RecallBotResponse>(`/bot/${botId}/leave_call/`, {
      method: 'POST',
    });
  }
  
  async listBots(limit: number = 50): Promise<RecallBotListResponse> {
    return this.apiRequest<RecallBotListResponse>(`/bot/?limit=${limit}&ordering=-created_at`);
  }
  
  async listCompletedBots(limit: number = 20): Promise<RecallBotResponse[]> {
    const response = await this.apiRequest<RecallBotListResponse>(
      `/bot/?limit=${limit}&ordering=-created_at&status_code=done`
    );
    return response.results;
  }
  
  async getBotRecording(botId: string): Promise<RecallRecordingResponse | null> {
    try {
      // New API: recordings are embedded on the bot object; fall back to legacy /recording/ endpoint
      const bot = await this.getBot(botId);
      const recordings = bot.recordings || [];
      if (recordings.length > 0) {
        const rec = recordings[0];
        const audioUrl = rec.media_shortcuts?.audio_only?.data?.url;
        const videoUrl = rec.media_shortcuts?.video_mixed?.data?.url;
        return {
          id: rec.id,
          bot_id: botId,
          media: { audio_url: audioUrl, video_url: videoUrl },
          created_at: new Date().toISOString(),
        };
      }
      // Legacy fallback
      return await this.apiRequest<RecallRecordingResponse>(`/bot/${botId}/recording/`);
    } catch (error) {
      console.error(`Failed to get recording for bot ${botId}:`, error);
      return null;
    }
  }

  /** Get the media download URL for a completed bot — prefers audio, falls back to video */
  async getBotMediaUrl(botId: string): Promise<string | null> {
    try {
      const key = getRecallApiKey().replace(/^(Token|Bearer)\s+/i, '').replace(/[^\x21-\x7E]/g, '').trim();
      // Fetch recordings list for this bot
      const r = await fetch(`${RECALL_API_BASE}/recording/?bot_id=${botId}`, {
        headers: { 'Authorization': `Token ${key}` },
        signal: AbortSignal.timeout(10000),
      });
      if (!r.ok) return null;
      const data = await r.json() as { results?: Array<{ id: string; media_shortcuts?: { audio_only?: { data?: { download_url?: string } }; video_mixed?: { data?: { download_url?: string } } } }> };
      const rec = data.results?.[0];
      if (!rec) return null;
      return rec.media_shortcuts?.audio_only?.data?.download_url
        || rec.media_shortcuts?.video_mixed?.data?.download_url
        || null;
    } catch {
      return null;
    }
  }
  
  async getBotTranscript(botId: string): Promise<RecallBotResponse['transcript']> {
    const bot = await this.getBot(botId);
    return bot.transcript || [];
  }
  
  async downloadAudio(audioUrl: string): Promise<Buffer> {
    const response = await fetch(audioUrl);
    if (!response.ok) {
      throw new Error(`Failed to download audio: ${response.status}`);
    }
    const arrayBuffer = await response.arrayBuffer();
    return Buffer.from(arrayBuffer);
  }
  
  async validateConnection(userId: string): Promise<{ valid: boolean; message: string }> {
    try {
      if (!this.isConfigured()) {
        return { valid: false, message: 'Recall.ai API key not configured' };
      }
      
      await this.listBots(1);
      
      await storage.createRecallConnection({
        userId,
        status: 'active',
        metadata: { validatedAt: new Date().toISOString() },
      });
      
      return { valid: true, message: 'Connected to Recall.ai successfully' };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      
      await storage.createRecallConnection({
        userId,
        status: 'error',
        metadata: { error: message, validatedAt: new Date().toISOString() },
      });
      
      return { valid: false, message };
    }
  }
  
  async disconnectUser(userId: string): Promise<void> {
    await storage.deleteRecallConnection(userId);
  }
  
  async getConnectionStatus(userId: string): Promise<RecallConnection | undefined> {
    return storage.getRecallConnection(userId);
  }
  
  detectMeetingPlatform(url: string): 'zoom' | 'teams' | 'meet' | 'webex' | null {
    const lowerUrl = url.toLowerCase();
    
    if (lowerUrl.includes('zoom.us') || lowerUrl.includes('zoom.com')) {
      return 'zoom';
    }
    if (lowerUrl.includes('teams.microsoft.com') || lowerUrl.includes('teams.live.com')) {
      return 'teams';
    }
    if (lowerUrl.includes('meet.google.com')) {
      return 'meet';
    }
    if (lowerUrl.includes('webex.com')) {
      return 'webex';
    }
    
    return null;
  }
  
  calculateRecallCost(durationSeconds: number): number {
    const hours = durationSeconds / 3600;
    const baseCost = 0.70 * hours;
    const transcriptionCost = 0.15 * hours;
    return baseCost + transcriptionCost;
  }
  
  formatBotStatus(botOrStatus: RecallBotResponse | RecallBotResponse['status']): string {
    const statusMap: Record<string, string> = {
      'ready': 'Bot ready',
      'joining_call': 'Joining meeting...',
      'in_waiting_room': 'In waiting room',
      'in_call_not_recording': 'In meeting (not recording)',
      'in_call_recording': 'Recording in progress',
      'call_ended': 'Meeting ended',
      'done': 'Recording complete',
      'fatal': 'Error occurred',
    };

    // Accept either a full bot object or the legacy status sub-object
    let code: string | undefined;
    if (botOrStatus && 'status_changes' in botOrStatus) {
      code = this.getBotStatusCode(botOrStatus as RecallBotResponse);
    } else if (botOrStatus && 'code' in botOrStatus) {
      code = (botOrStatus as { code: string }).code;
    }
    if (!code) return 'Connecting...';
    return statusMap[code] || code;
  }
  
  async getImportableMeetings(userId: string): Promise<Array<{
    botId: string;
    meetingUrl: string;
    platform: string;
    title?: string;
    startTime?: Date;
    endTime?: Date;
    duration?: number;
    participants?: Array<{ name: string }>;
    hasRecording: boolean;
    alreadyImported: boolean;
  }>> {
    const bots = await this.listCompletedBots(30);
    const existingImports = await storage.getMeetingImportsByUser(userId);
    const importedBotIds = new Set(existingImports.map(i => i.recallBotId));
    
    const meetings = [];
    
    for (const bot of bots) {
      const platform = this.detectMeetingPlatform(bot.meeting_url);
      if (!platform) continue;
      
      const recording = await this.getBotRecording(bot.id);
      
      meetings.push({
        botId: bot.id,
        meetingUrl: bot.meeting_url,
        platform,
        title: bot.meeting_metadata?.title,
        startTime: bot.meeting_metadata?.start_time ? new Date(bot.meeting_metadata.start_time) : undefined,
        endTime: bot.meeting_metadata?.end_time ? new Date(bot.meeting_metadata.end_time) : undefined,
        duration: recording?.duration_seconds,
        participants: bot.meeting_participants?.map(p => ({ name: p.name })),
        hasRecording: !!recording?.media?.audio_url,
        alreadyImported: importedBotIds.has(bot.id),
      });
    }
    
    return meetings;
  }
  
  async startMeetingImport(
    userId: string,
    botId: string,
    caseId?: string,
    consentConfirmed: boolean = false,
    preConsentEmailId?: string
  ): Promise<MeetingImport> {
    const bot = await this.getBot(botId);
    const recording = await this.getBotRecording(botId);
    const platform = this.detectMeetingPlatform(bot.meeting_url);
    
    if (!platform) {
      throw new Error('Unable to detect meeting platform');
    }
    
    const meetingImport = await storage.createMeetingImport({
      userId,
      caseId: caseId || undefined,
      recallBotId: botId,
      recallRecordingId: recording?.id || undefined,
      meetingPlatform: platform,
      meetingUrl: bot.meeting_url || undefined,
      meetingTitle: bot.meeting_metadata?.title || undefined,
      meetingStartTime: bot.meeting_metadata?.start_time ? new Date(bot.meeting_metadata.start_time) : undefined,
      meetingEndTime: bot.meeting_metadata?.end_time ? new Date(bot.meeting_metadata.end_time) : undefined,
      durationSeconds: recording?.duration_seconds || undefined,
      participants: bot.meeting_participants?.map(p => ({
        name: p.name,
        joined_at: p.events.find(e => e.code === 'joined')?.created_at,
      })) || [],
      status: 'pending',
      consentConfirmed,
      preConsentEmailId: preConsentEmailId || undefined,
    });
    
    if (recording?.duration_seconds) {
      const cost = this.calculateRecallCost(recording.duration_seconds);
      await storage.updateMeetingImport(meetingImport.id, {
        recallCostUSD: cost.toFixed(4),
      });
    }
    
    return meetingImport;
  }
}

export const recallService = new RecallService();

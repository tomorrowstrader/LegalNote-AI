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

interface RecallBotResponse {
  id: string;
  meeting_url: string;
  status: {
    code: string;
    message: string;
    created_at: string;
    sub_code?: string;
  };
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
  
  private async apiRequest<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const apiKey = getRecallApiKey();
    if (!apiKey) {
      throw new Error('Recall.ai API key not configured');
    }
    
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
      try {
        const errorData = await response.json() as RecallError;
        errorMessage = errorData.message || errorData.error || errorMessage;
      } catch {
        // Ignore JSON parse errors
      }
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
        transcription_options: {
          provider: 'assembly_ai',
        },
        recording_mode: 'audio_only',
        automatic_leave: {
          waiting_room_timeout: 600,
          noone_joined_timeout: 300,
          everyone_left_timeout: 60,
        },
      }),
    });
  }
  
  async getBot(botId: string): Promise<RecallBotResponse> {
    return this.apiRequest<RecallBotResponse>(`/bot/${botId}/`);
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
      return await this.apiRequest<RecallRecordingResponse>(`/bot/${botId}/recording/`);
    } catch (error) {
      console.error(`Failed to get recording for bot ${botId}:`, error);
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
  
  formatBotStatus(status: RecallBotResponse['status']): string {
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
    
    return statusMap[status.code] || status.code;
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

import cron from 'node-cron';
import { jobQueue } from './services/jobQueue';
import { AIProcessingPipeline } from './services/aiProcessingPipeline';
import { storage } from './storage';
import { runGlobalDataRetentionCleanup } from './services/dataRetentionCleanup';
import { cleanupSessionTracking } from './services/securityMonitor';
import { meetingSchedulerService } from './services/meetingSchedulerService';

/**
 * Initialize job queue workers on server startup
 */
export function initializeWorkers() {
  console.log('[WORKERS] Initializing job queue workers...');

  // Register AI processing job handler
  jobQueue.registerHandler('ai-processing', async (data: { caseId: string; userId: string; sessionId?: string }) => {
    console.log(`[AI-WORKER] Starting AI processing for case ${data.caseId}${data.sessionId ? ` session ${data.sessionId}` : ''}`);
    
    const pipeline = new AIProcessingPipeline(storage);
    
    try {
      const result = await pipeline.processCase(data.caseId, data.userId, data.sessionId);
      
      if (result.success) {
        console.log(`[AI-WORKER] Successfully processed case ${data.caseId}. Cost: $${result.totalCost.toFixed(4)}`);
      } else {
        console.error(`[AI-WORKER] Failed to process case ${data.caseId}:`, result.error);
        throw new Error(result.error || 'AI processing failed');
      }
    } catch (error: any) {
      console.error(`[AI-WORKER] Error processing case ${data.caseId}:`, error);
      throw error; // Re-throw to trigger job retry
    }
  });

  // Schedule periodic security and maintenance tasks
  scheduleMaintenanceTasks();

  console.log('[WORKERS] Job queue workers initialized successfully');
}

/**
 * Schedule periodic maintenance tasks using cron
 */
function scheduleMaintenanceTasks() {
  // Run data retention cleanup daily at 2:00 AM (Europe/London timezone)
  // Cron expression: '0 2 * * *' = At minute 0 of hour 2 every day
  cron.schedule('0 2 * * *', () => {
    console.log('[CRON] Running daily data retention cleanup at 2 AM');
    runGlobalDataRetentionCleanup().catch(error => {
      console.error('[CRON] Data retention cleanup failed:', error);
    });
  }, {
    scheduled: true,
    timezone: 'Europe/London'
  });

  // Clean up session tracking every hour at minute 0
  // Cron expression: '0 * * * *' = At minute 0 of every hour
  cron.schedule('0 * * * *', () => {
    console.log('[CRON] Running hourly session tracking cleanup');
    cleanupSessionTracking();
  }, {
    scheduled: true,
    timezone: 'Europe/London'
  });

  // Run meeting scheduler tasks every 5 minutes
  // Sends consent emails, deploys bots for approved meetings, checks bot status
  cron.schedule('*/5 * * * *', async () => {
    console.log('[CRON] Running meeting scheduler tasks');
    await runMeetingSchedulerTasks();
  }, {
    scheduled: true,
    timezone: 'Europe/London'
  });

  console.log('[WORKERS] Scheduled maintenance tasks with cron:');
  console.log('  - Data retention cleanup: Daily at 2:00 AM (Europe/London)');
  console.log('  - Session tracking cleanup: Hourly at minute :00 (Europe/London)');
  console.log('  - Meeting scheduler: Every 5 minutes (Europe/London)');
}

/**
 * Run meeting scheduler tasks for all users with connected calendars
 * This includes polling calendars and processing meetings
 */
async function runMeetingSchedulerTasks() {
  try {
    // First, poll calendars for all users with connected Google Calendar
    const calendarIntegrations = await storage.getActiveCalendarIntegrations('google');
    
    for (const integration of calendarIntegrations) {
      try {
        console.log(`[MEETING_SCHEDULER] Polling calendar for user ${integration.userId}`);
        await meetingSchedulerService.pollCalendarMeetings(integration.userId);
      } catch (error) {
        console.error(`[MEETING_SCHEDULER] Error polling calendar for user ${integration.userId}:`, error);
      }
    }

    // Then process meetings: send consent emails, deploy bots, check bot status
    const allMeetings = await storage.getAllScheduledMeetingsWithAutoRecord();
    const userIds = [...new Set(allMeetings.map(m => m.userId))];

    for (const userId of userIds) {
      try {
        await meetingSchedulerService.runScheduledTasks(userId);
      } catch (error) {
        console.error(`[MEETING_SCHEDULER] Error running tasks for user ${userId}:`, error);
      }
    }
  } catch (error) {
    console.error('[MEETING_SCHEDULER] Error in cron job:', error);
  }
}

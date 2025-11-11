import cron from 'node-cron';
import { jobQueue } from './services/jobQueue';
import { AIProcessingPipeline } from './services/aiProcessingPipeline';
import { storage } from './storage';
import { runGlobalDataRetentionCleanup } from './services/dataRetentionCleanup';
import { cleanupSessionTracking } from './services/securityMonitor';

/**
 * Initialize job queue workers on server startup
 */
export function initializeWorkers() {
  console.log('[WORKERS] Initializing job queue workers...');

  // Register AI processing job handler
  jobQueue.registerHandler('ai-processing', async (data: { caseId: string; userId: string }) => {
    console.log(`[AI-WORKER] Starting AI processing for case ${data.caseId}`);
    
    const pipeline = new AIProcessingPipeline(storage);
    
    try {
      const result = await pipeline.processCase(data.caseId, data.userId);
      
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

  console.log('[WORKERS] Scheduled maintenance tasks with cron:');
  console.log('  - Data retention cleanup: Daily at 2:00 AM (Europe/London)');
  console.log('  - Session tracking cleanup: Hourly at minute :00 (Europe/London)');
}

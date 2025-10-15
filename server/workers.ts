import { jobQueue } from './services/jobQueue';
import { AIProcessingPipeline } from './services/aiProcessingPipeline';
import { storage } from './storage';

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

  console.log('[WORKERS] Job queue workers initialized successfully');
}

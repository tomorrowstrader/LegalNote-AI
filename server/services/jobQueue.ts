import EventEmitter from 'events';

export interface Job<T = any> {
  id: string;
  type: string;
  data: T;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  attempts: number;
  maxAttempts: number;
  error?: string;
  createdAt: Date;
  processedAt?: Date;
}

export type JobHandler<T = any> = (data: T) => Promise<void>;

class JobQueue extends EventEmitter {
  private jobs: Map<string, Job> = new Map();
  private handlers: Map<string, JobHandler> = new Map();
  private processing: Set<string> = new Set();
  private maxConcurrent: number = 3;

  registerHandler<T>(type: string, handler: JobHandler<T>) {
    this.handlers.set(type, handler as JobHandler);
  }

  async addJob<T>(type: string, data: T, options?: { maxAttempts?: number }): Promise<string> {
    const jobId = `${type}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    const job: Job<T> = {
      id: jobId,
      type,
      data,
      status: 'pending',
      attempts: 0,
      maxAttempts: options?.maxAttempts || 3,
      createdAt: new Date(),
    };

    this.jobs.set(jobId, job);
    this.emit('job:added', job);
    
    // Start processing immediately
    this.processNextJob();
    
    return jobId;
  }

  private async processNextJob() {
    // Check if we're at max concurrent jobs
    if (this.processing.size >= this.maxConcurrent) {
      return;
    }

    // Find a pending job
    const pendingJob = Array.from(this.jobs.values()).find(
      job => job.status === 'pending' || 
             (job.status === 'failed' && job.attempts < job.maxAttempts)
    );

    if (!pendingJob) {
      return;
    }

    const handler = this.handlers.get(pendingJob.type);
    if (!handler) {
      console.error(`No handler registered for job type: ${pendingJob.type}`);
      pendingJob.status = 'failed';
      pendingJob.error = 'No handler registered';
      return;
    }

    // Mark as processing
    pendingJob.status = 'processing';
    pendingJob.attempts++;
    this.processing.add(pendingJob.id);
    this.emit('job:processing', pendingJob);

    try {
      await handler(pendingJob.data);
      
      // Success
      pendingJob.status = 'completed';
      pendingJob.processedAt = new Date();
      this.emit('job:completed', pendingJob);
    } catch (error: any) {
      console.error(`Job ${pendingJob.id} failed (attempt ${pendingJob.attempts}/${pendingJob.maxAttempts}):`, error);
      
      pendingJob.error = error.message;
      
      if (pendingJob.attempts >= pendingJob.maxAttempts) {
        pendingJob.status = 'failed';
        this.emit('job:failed', pendingJob);
      } else {
        // Retry with exponential backoff
        pendingJob.status = 'pending';
        const delay = Math.min(1000 * Math.pow(2, pendingJob.attempts - 1), 30000);
        setTimeout(() => this.processNextJob(), delay);
      }
    } finally {
      this.processing.delete(pendingJob.id);
      
      // Process next job if available
      setImmediate(() => this.processNextJob());
    }
  }

  getJob(jobId: string): Job | undefined {
    return this.jobs.get(jobId);
  }

  getJobsByType(type: string): Job[] {
    return Array.from(this.jobs.values()).filter(job => job.type === type);
  }

  clearCompletedJobs(olderThanMs: number = 3600000) { // 1 hour default
    const cutoff = Date.now() - olderThanMs;
    for (const [id, job] of Array.from(this.jobs.entries())) {
      if (job.status === 'completed' && job.processedAt && job.processedAt.getTime() < cutoff) {
        this.jobs.delete(id);
      }
    }
  }
}

// Singleton instance
export const jobQueue = new JobQueue();

// Clean up old jobs every hour
setInterval(() => {
  jobQueue.clearCompletedJobs();
}, 3600000);

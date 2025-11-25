import { TranscriptionService } from './transcriptionService';
import { DocumentService } from './documentService';
import { IStorage } from '../storage';
import { auditLogger, AuditEventType } from '../auditLog';

export interface AIProcessingResult {
  success: boolean;
  caseId: string;
  transcriptId?: string;
  documentIds?: {
    summary: string;
    attendanceNote: string;
    legalOpinion: string;
  };
  totalCost: number;
  error?: string;
}

export interface ProcessingMetadata {
  status: 'idle' | 'transcribing' | 'generating_documents' | 'completed' | 'failed';
  progress: number; // 0-100
  currentStep?: string;
  transcriptionCost?: number;
  documentGenerationCost?: number;
  totalCost?: number;
  totalTokens?: {
    input: number;
    output: number;
  };
  error?: string;
  completedAt?: string;
}

export class AIProcessingPipeline {
  private transcriptionService: TranscriptionService;
  private documentService: DocumentService;
  private storage: IStorage;

  constructor(storage: IStorage) {
    this.transcriptionService = new TranscriptionService();
    this.documentService = new DocumentService();
    this.storage = storage;
  }

  /**
   * Process a case: transcribe audio → generate documents
   */
  async processCase(caseId: string, userId: string): Promise<AIProcessingResult> {
    console.log(`Starting AI processing for case ${caseId}`);

    try {
      // Get case details
      const caseData = await this.storage.getCase(caseId, userId);
      if (!caseData) {
        throw new Error('Case not found');
      }

      // Get audio recording
      const audio = await this.storage.getAudioRecordingByCase(caseId, userId);
      if (!audio) {
        throw new Error('No audio recording found for case');
      }

      if (!audio.filePath) {
        throw new Error('Audio file path not found');
      }

      // Update status: processing started
      await this.updateProcessingStatus(caseId, userId, {
        status: 'transcribing',
        progress: 10,
        currentStep: 'Downloading audio file...',
      });

      auditLogger.log({
        eventType: AuditEventType.AI_PROCESSING_STARTED,
        userId,
        resourceId: caseId,
        resourceType: 'case',
        details: { audioId: audio.id },
        severity: 'medium',
      });

      // Step 1: Transcribe audio
      console.log(`Transcribing audio for case ${caseId}...`);
      await this.updateProcessingStatus(caseId, userId, {
        status: 'transcribing',
        progress: 20,
        currentStep: 'Converting speech to text...',
      });

      const transcriptionResult = await this.transcriptionService.transcribeAudio(
        audio.filePath,
        audio.duration || 0,
        audio.mimeType || undefined
      );

      // Save transcript
      const transcript = await this.storage.createTranscript({
        caseId,
        content: transcriptionResult.text,
      });

      auditLogger.log({
        eventType: AuditEventType.AI_TRANSCRIPTION_COMPLETED,
        userId,
        resourceId: transcript.id,
        resourceType: 'transcript',
        details: { 
          caseId,
          textLength: transcriptionResult.text.length,
          cost: transcriptionResult.cost,
        },
        severity: 'medium',
      });

      await this.updateProcessingStatus(caseId, userId, {
        status: 'generating_documents',
        progress: 40,
        currentStep: 'Generating summary...',
        transcriptionCost: transcriptionResult.cost,
      });

      // Step 2: Generate documents
      const metadata = {
        title: caseData.title,
        clientName: caseData.clientName,
        matterReference: caseData.matterReference || undefined,
        recordingDate: new Date().toISOString().split('T')[0],
      };

      // Generate summary
      console.log(`Generating summary for case ${caseId}...`);
      const summaryResult = await this.documentService.generateSummary(
        transcriptionResult.text,
        metadata
      );

      const summaryDoc = await this.storage.createDocument({
        caseId,
        transcriptSnapshotId: transcript.id,
        type: 'summary',
        content: summaryResult.content,
        version: 1,
        versionType: 'ai_generated',
        createdBy: userId,
        isActive: true,
      });

      auditLogger.log({
        eventType: AuditEventType.AI_DOCUMENT_GENERATED,
        userId,
        resourceId: summaryDoc.id,
        resourceType: 'document',
        details: { 
          caseId,
          documentType: 'summary',
          inputTokens: summaryResult.inputTokens,
          outputTokens: summaryResult.outputTokens,
          cost: summaryResult.cost,
        },
        severity: 'medium',
      });

      await this.updateProcessingStatus(caseId, userId, {
        status: 'generating_documents',
        progress: 60,
        currentStep: 'Generating attendance note...',
      });

      // Get firm preferences for document generation
      const firmProfile = await this.storage.getFirmProfile();
      const firmPreferences = {
        includeLocation: firmProfile?.includeLocation ?? true,
        showFullSolicitorName: firmProfile?.showFullSolicitorName ?? true,
        includeClientConfirmation: firmProfile?.includeClientConfirmation ?? false,
      };

      // Generate attendance note
      console.log(`Generating attendance note for case ${caseId}...`);
      const attendanceResult = await this.documentService.generateAttendanceNote(
        transcriptionResult.text,
        metadata,
        firmPreferences
      );

      const attendanceDoc = await this.storage.createDocument({
        caseId,
        transcriptSnapshotId: transcript.id,
        type: 'attendance_note',
        content: attendanceResult.content,
        version: 1,
        versionType: 'ai_generated',
        createdBy: userId,
        isActive: true,
      });

      auditLogger.log({
        eventType: AuditEventType.AI_DOCUMENT_GENERATED,
        userId,
        resourceId: attendanceDoc.id,
        resourceType: 'document',
        details: { 
          caseId,
          documentType: 'attendance_note',
          inputTokens: attendanceResult.inputTokens,
          outputTokens: attendanceResult.outputTokens,
          cost: attendanceResult.cost,
        },
        severity: 'medium',
      });

      await this.updateProcessingStatus(caseId, userId, {
        status: 'generating_documents',
        progress: 80,
        currentStep: 'Generating legal opinion...',
      });

      // Generate legal opinion
      console.log(`Generating legal opinion for case ${caseId}...`);
      const opinionResult = await this.documentService.generateLegalOpinion(
        transcriptionResult.text,
        metadata
      );

      const opinionDoc = await this.storage.createDocument({
        caseId,
        transcriptSnapshotId: transcript.id,
        type: 'legal_opinion',
        content: opinionResult.content,
        version: 1,
        versionType: 'ai_generated',
        createdBy: userId,
        isActive: true,
      });

      auditLogger.log({
        eventType: AuditEventType.AI_DOCUMENT_GENERATED,
        userId,
        resourceId: opinionDoc.id,
        resourceType: 'document',
        details: { 
          caseId,
          documentType: 'legal_opinion',
          inputTokens: opinionResult.inputTokens,
          outputTokens: opinionResult.outputTokens,
          cost: opinionResult.cost,
        },
        severity: 'medium',
      });

      // Calculate total cost and tokens
      const totalCost = transcriptionResult.cost + 
                       summaryResult.cost + 
                       attendanceResult.cost + 
                       opinionResult.cost;

      const totalTokens = {
        input: summaryResult.inputTokens + attendanceResult.inputTokens + opinionResult.inputTokens,
        output: summaryResult.outputTokens + attendanceResult.outputTokens + opinionResult.outputTokens,
      };

      // Update final status
      await this.updateProcessingStatus(caseId, userId, {
        status: 'completed',
        progress: 100,
        currentStep: 'Processing complete',
        transcriptionCost: transcriptionResult.cost,
        documentGenerationCost: summaryResult.cost + attendanceResult.cost + opinionResult.cost,
        totalCost,
        totalTokens,
        completedAt: new Date().toISOString(),
      });

      // Update case status to review_required
      await this.storage.updateCase(caseId, { status: 'review_required' }, userId);

      // GDPR Compliance: Delete audio immediately after successful processing
      // This implements "whichever comes first" - 7 days OR successful processing
      try {
        const { ObjectStorageService } = await import('../objectStorage');
        const objectStorageService = new ObjectStorageService();
        
        if (audio.filePath && !audio.deletedAt) {
          await objectStorageService.deleteObjectEntity(audio.filePath);
          await this.storage.updateAudioRecording(audio.id, { deletedAt: new Date() });
          
          // Log audit event using auditLogger (no req object needed for system events)
          auditLogger.log({
            eventType: AuditEventType.AUDIO_DELETED,
            userId,
            resourceId: audio.id,
            resourceType: 'audio_recording',
            details: {
              caseId,
              reason: "successful_processing_completion",
              filePath: audio.filePath,
              deletedAt: new Date().toISOString(),
            },
            severity: 'low',
          });
          
          console.log(`[GDPR] Deleted audio after successful processing: ${audio.id} (case: ${caseId})`);
        }
      } catch (deleteError) {
        // Don't fail the processing if deletion fails - it will be cleaned up by expiration
        console.error(`[GDPR] Failed to delete audio after processing (will be cleaned up on expiration):`, deleteError);
      }

      console.log(`AI processing completed for case ${caseId}. Total cost: $${totalCost.toFixed(4)}`);

      return {
        success: true,
        caseId,
        transcriptId: transcript.id,
        documentIds: {
          summary: summaryDoc.id,
          attendanceNote: attendanceDoc.id,
          legalOpinion: opinionDoc.id,
        },
        totalCost,
      };
    } catch (error: any) {
      console.error(`AI processing failed for case ${caseId}:`, error);

      // Log failure
      auditLogger.log({
        eventType: AuditEventType.AI_PROCESSING_FAILED,
        userId,
        resourceId: caseId,
        resourceType: 'case',
        details: { error: error.message },
        severity: 'critical',
      });

      // Update status with error
      await this.updateProcessingStatus(caseId, userId, {
        status: 'failed',
        progress: 0,
        error: error.message,
      });

      return {
        success: false,
        caseId,
        totalCost: 0,
        error: error.message,
      };
    }
  }

  /**
   * Update case processing metadata
   */
  private async updateProcessingStatus(
    caseId: string,
    userId: string,
    metadata: Partial<ProcessingMetadata>
  ): Promise<void> {
    const caseData = await this.storage.getCase(caseId, userId);
    if (!caseData) return;

    const currentMetadata = (caseData.aiProcessingMetadata as ProcessingMetadata) || {};
    const updatedMetadata = { ...currentMetadata, ...metadata };

    await this.storage.updateCase(caseId, {
      aiProcessingMetadata: updatedMetadata,
    }, userId);
  }
}

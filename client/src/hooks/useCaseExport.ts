import { useQuery } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { exportToPDF, exportToWord } from "@/lib/documentExport";
import type { FirmProfile, Case } from "@shared/schema";

interface SpeakerUtterance {
  speaker: string;
  text: string;
  start: number;
  end: number;
  confidence: number;
}

function formatDiarizedTranscriptForExport(utterances: SpeakerUtterance[]): string {
  if (!utterances || utterances.length === 0) return '';
  return utterances.map(u => {
    const speakerLabel = u.speaker.startsWith('Speaker') ? u.speaker : `Speaker ${u.speaker}`;
    return `[${speakerLabel}]: ${u.text}`;
  }).join('\n\n');
}

interface UseCaseExportOptions {
  caseId: string;
  enabled: boolean;
  prefetchedData?: {
    caseData?: Case;
    documents?: any[];
    transcript?: any;
  };
}

export function useCaseExport({ caseId, enabled, prefetchedData }: UseCaseExportOptions) {
  const { toast } = useToast();

  const { data: fetchedDocuments = [] } = useQuery<any[]>({
    queryKey: [`/api/cases/${caseId}/documents`],
    enabled: enabled && !prefetchedData?.documents,
  });

  const { data: fetchedCaseData } = useQuery<Case>({
    queryKey: [`/api/cases/${caseId}`],
    enabled: enabled && !prefetchedData?.caseData,
  });

  const { data: fetchedTranscript } = useQuery<any>({
    queryKey: [`/api/cases/${caseId}/transcript`],
    enabled: enabled && !prefetchedData?.transcript,
  });

  const { data: firmProfile } = useQuery<FirmProfile>({
    queryKey: ['/api/firm-profile'],
    enabled,
  });

  const documents = prefetchedData?.documents ?? fetchedDocuments;
  const caseData = prefetchedData?.caseData ?? fetchedCaseData;
  const transcript = prefetchedData?.transcript ?? fetchedTranscript;

  const handleDownload = async (selectedDocs: string[], format: 'pdf' | 'word') => {
    if (!caseData || !documents) return;

    const activeDocuments = documents.filter((doc: any) => doc.isActive);
    const attendanceNote = activeDocuments.find((doc: any) => doc.type === 'attendance_note');
    const summary = activeDocuments.find((doc: any) => doc.type === 'summary');
    const careLetterDoc = activeDocuments.find((doc: any) => doc.type === 'client_care_letter');
    const transcriptDoc = activeDocuments.find((doc: any) => doc.type === 'transcript');
    
    let transcriptContent: string | undefined;
    if (transcriptDoc?.content) {
      transcriptContent = transcriptDoc.content;
    } else if (transcript?.utterances && transcript.utterances.length > 0) {
      transcriptContent = formatDiarizedTranscriptForExport(transcript.utterances);
    } else if (transcript?.content) {
      transcriptContent = transcript.content;
    }
    const summaryContent = summary?.content || caseData.textNotes;

    const content: Record<string, string> = {};
    
    if (selectedDocs.includes('attendance_note') && attendanceNote) {
      content.attendanceNote = attendanceNote.content;
    }
    if (selectedDocs.includes('summary') && summaryContent) {
      content.summary = summaryContent;
    }
    if (selectedDocs.includes('client_care_letter') && careLetterDoc) {
      content.clientCareLetter = careLetterDoc.content;
    }
    if (selectedDocs.includes('transcript') && transcriptContent) {
      content.transcript = transcriptContent;
    }

    const hasAnyContent = content.attendanceNote || content.summary || content.clientCareLetter || content.transcript;
    if (!hasAnyContent) {
      toast({
        title: "No content available",
        description: "None of the selected documents have content to export",
        variant: "destructive",
      });
      return;
    }

    // Determine single document type for branding; 'selected' when multiple
    const knownSingleTypes = ['attendance_note', 'summary', 'transcript', 'client_care_letter'] as const;
    type KnownSingleType = typeof knownSingleTypes[number];
    const isSingleKnownType = (t: string): t is KnownSingleType => (knownSingleTypes as readonly string[]).includes(t);
    const singleDocType = selectedDocs.length === 1 && isSingleKnownType(selectedDocs[0]) ? selectedDocs[0] : ('selected' as const);

    try {
      const exportFn = format === 'pdf' ? exportToPDF : exportToWord;
      await exportFn({
        caseTitle: caseData.title,
        clientName: caseData.clientName,
        matterReference: caseData.matterReference,
        createdAt: caseData.createdAt,
        documentType: singleDocType,
        firmProfile: firmProfile,
        ...content,
      });

      try {
        await fetch(`/api/cases/${caseId}/audit/export`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ format, documents: selectedDocs }),
        });
      } catch (auditError) {
        console.error('Failed to log export audit event:', auditError);
      }

      toast({
        title: `${format.toUpperCase()} downloaded`,
        description: `Selected documents exported successfully`,
      });
    } catch (error) {
      toast({
        title: "Export failed",
        description: `Failed to export as ${format.toUpperCase()}. Please try again.`,
        variant: "destructive",
      });
    }
  };

  return {
    documents,
    caseData,
    transcript,
    firmProfile,
    handleDownload,
  };
}

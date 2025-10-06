import { ArrowLeft, Calendar, User, Shield } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import DocumentViewer from "@/components/DocumentViewer";
import { useLocation } from "wouter";

export default function CaseDetail() {
  const [, setLocation] = useLocation();

  const mockCase = {
    title: "Estate Planning Consultation",
    clientName: "Mrs. Catherine Williams",
    meetingDate: "14 January 2025",
    createdBy: "Sarah Johnson",
    consentGiven: true,
    attendanceNote: `Meeting held on 14 January 2025 at 10:00 AM with Mrs. Catherine Williams regarding estate planning matters.\n\nAttendees:\n- Mrs. Catherine Williams (Client)\n- Sarah Johnson (Solicitor)\n\nPurpose: Initial consultation for comprehensive estate planning review and will preparation.\n\nDiscussion Summary:\nMrs. Williams expressed concerns about ensuring her estate is properly distributed among her three children and wishes to establish provisions for potential care needs in later life. The client owns property valued at approximately £850,000 and has investments totaling £200,000.`,
    
    keyIssues: [
      'Distribution of estate assets among three beneficiaries with specific conditions',
      'Establishment of lasting power of attorney for health and welfare decisions',
      'Tax implications of current estate structure and potential inheritance tax liability',
      'Provisions for potential long-term care funding requirements',
    ],
    
    nextSteps: [
      'Obtain full property valuations and investment portfolio statements',
      'Schedule follow-up meeting to discuss will provisions in detail',
      'Prepare draft will document for client review',
      'Arrange lasting power of attorney documentation',
      'Consult with tax specialist regarding inheritance tax planning options',
    ],
    
    legalOpinion: `LEGAL OPINION - ESTATE PLANNING\n\nBased on the consultation with Mrs. Catherine Williams, the following legal considerations apply:\n\n1. TESTAMENTARY CAPACITY\nMrs. Williams demonstrates full testamentary capacity and understanding of her estate's nature and extent.\n\n2. INHERITANCE TAX CONSIDERATIONS\nThe current estate value (approximately £1,050,000) exceeds the nil-rate band threshold of £325,000. Strategic planning is recommended to minimize potential inheritance tax liability, which could amount to approximately £290,000 under current rates.\n\n3. LASTING POWER OF ATTORNEY\nGiven the client's age and expressed concerns, establishing both property & financial affairs and health & welfare LPAs is strongly advised.\n\n4. RECOMMENDATIONS\n- Execute comprehensive will with clear distribution provisions\n- Consider establishing trusts for tax efficiency\n- Register lasting powers of attorney\n- Review beneficiary designations on pension and investment accounts`,
    
    transcript: '[00:00] Sarah Johnson: Good morning Mrs. Williams, thank you for coming in today.\n[00:02] Catherine Williams: Good morning, thank you for seeing me.\n[00:05] Sarah Johnson: I understand you\'d like to discuss your estate planning. Could you tell me about your main concerns?\n[00:10] Catherine Williams: Yes, I want to make sure everything is properly arranged for my children...',
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-4xl mx-auto px-6 lg:px-8 py-8">
        <Button
          variant="ghost"
          onClick={() => setLocation('/')}
          className="mb-6 gap-2"
          data-testid="button-back-to-dashboard"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Dashboard
        </Button>

        <div className="mb-8">
          <div className="flex items-start justify-between mb-4">
            <div>
              <h1 className="text-3xl font-semibold text-foreground mb-2">
                {mockCase.title}
              </h1>
              <p className="text-lg text-muted-foreground">{mockCase.clientName}</p>
            </div>
            <Badge className="bg-accent" data-testid="badge-gdpr-compliant">
              <Shield className="w-3 h-3 mr-1" />
              GDPR Compliant
            </Badge>
          </div>

          <div className="flex flex-wrap gap-4 text-sm">
            <div className="flex items-center gap-2 text-muted-foreground">
              <Calendar className="w-4 h-4" />
              <span>{mockCase.meetingDate}</span>
            </div>
            <div className="flex items-center gap-2 text-muted-foreground">
              <User className="w-4 h-4" />
              <span>Created by {mockCase.createdBy}</span>
            </div>
            {mockCase.consentGiven && (
              <div className="flex items-center gap-2 text-muted-foreground">
                <Shield className="w-4 h-4" />
                <span>Consent recorded</span>
              </div>
            )}
          </div>
        </div>

        <DocumentViewer
          attendanceNote={mockCase.attendanceNote}
          keyIssues={mockCase.keyIssues}
          nextSteps={mockCase.nextSteps}
          legalOpinion={mockCase.legalOpinion}
          transcript={mockCase.transcript}
        />
      </div>
    </div>
  );
}

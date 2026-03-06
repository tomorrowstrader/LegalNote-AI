import { useState } from "react";
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Home, Briefcase, Users, FileText, Scale, ChevronRight
} from "lucide-react";

export interface CaseTemplate {
  id: string;
  name: string;
  description: string;
  practiceArea: string;
  icon: any;
  suggestedActionItems: string[];
  documentSections: string[];
  consentLanguage: string;
  estimatedDuration: string;
}

const BUILT_IN_TEMPLATES: CaseTemplate[] = [
  {
    id: 'initial_consultation',
    name: 'Initial Consultation',
    description: 'First meeting with a new or existing client to understand their matter and provide initial advice.',
    practiceArea: 'General',
    icon: Users,
    estimatedDuration: '30–60 min',
    consentLanguage: 'I would like to record this meeting to assist in preparing an accurate attendance note. The recording will be securely stored and deleted after 7 days. Do I have your consent to proceed?',
    documentSections: ['Purpose of Meeting', 'Client Background', 'Matter Overview', 'Advice Given', 'Next Steps', 'Client Confirmation'],
    suggestedActionItems: [
      'Send client care letter',
      'Obtain ID verification documents',
      'Open matter file and matter reference',
      'Send fee estimate or engagement letter',
      'Schedule follow-up meeting if required',
    ],
  },
  {
    id: 'property_completion',
    name: 'Property Completion',
    description: 'Completion meeting for a residential or commercial property transaction.',
    practiceArea: 'Conveyancing',
    icon: Home,
    estimatedDuration: '30–45 min',
    consentLanguage: 'I will be recording this meeting for the purposes of preparing an accurate attendance note. The recording is stored securely and deleted within 7 days under our data retention policy. Do you consent?',
    documentSections: ['Parties Present', 'Property Details', 'Financial Summary', 'Documentation Signed', 'Completion Arrangements', 'Post-Completion Actions'],
    suggestedActionItems: [
      'Transfer completion funds to seller',
      'Submit SDLT return to HMRC within 14 days',
      'Register title at Land Registry',
      'Send completion letter to client',
      'File documentation and close matter',
    ],
  },
  {
    id: 'employment_tribunal_prep',
    name: 'Employment Tribunal Prep',
    description: 'Preparation meeting ahead of an employment tribunal hearing, covering strategy and evidence.',
    practiceArea: 'Employment',
    icon: Briefcase,
    estimatedDuration: '60–90 min',
    consentLanguage: 'I would like to record this meeting to create a detailed attendance note for your file. The recording will be deleted after 7 days. Do you consent to this recording?',
    documentSections: ['Case Background', 'Claim Summary', 'Witness Evidence Review', 'Documentary Evidence', 'Hearing Strategy', 'Client Preparation Notes', 'Action Items'],
    suggestedActionItems: [
      'Serve any outstanding disclosure on respondent',
      'Prepare client witness statement',
      'Review respondent\'s witness statements',
      'Prepare hearing bundle index',
      'Confirm hearing logistics with client',
      'File and serve skeleton argument if required',
    ],
  },
  {
    id: 'family_law_review',
    name: 'Family Law Review',
    description: 'Review meeting in divorce, financial remedy, or children proceedings.',
    practiceArea: 'Family',
    icon: Users,
    estimatedDuration: '45–60 min',
    consentLanguage: 'With your permission, I would like to record this meeting to prepare an attendance note. The recording is securely stored and automatically deleted after 7 days. Do you agree?',
    documentSections: ['Current Position', 'Financial Disclosure Summary', 'Outstanding Issues', 'Without Prejudice Discussions', 'Next Court Date / Directions', 'Action Items'],
    suggestedActionItems: [
      'Obtain updated Form E financial disclosure',
      'Instruct expert valuer if property in dispute',
      'File Form A if financial proceedings not yet issued',
      'Review Schedule of Assets and update',
      'Advise client of hearing date and preparation',
    ],
  },
  {
    id: 'commercial_contract',
    name: 'Commercial Contract Meeting',
    description: 'Meeting to review, negotiate, or execute a commercial contract or agreement.',
    practiceArea: 'Commercial',
    icon: FileText,
    estimatedDuration: '45–75 min',
    consentLanguage: 'I\'ll be recording this meeting to produce an accurate attendance note. The recording is held securely for 7 days then deleted. Are you happy to proceed on that basis?',
    documentSections: ['Parties and Background', 'Contract Summary', 'Key Terms Discussed', 'Negotiation Points', 'Risk Flags', 'Agreed Amendments', 'Execution Plan'],
    suggestedActionItems: [
      'Circulate redlined contract to opposing party',
      'Obtain client sign-off on final agreed terms',
      'Arrange execution mechanics',
      'Confirm conditions precedent satisfied',
      'Provide post-execution summary to client',
    ],
  },
  {
    id: 'litigation_update',
    name: 'Litigation Update',
    description: 'Interim case update meeting to review litigation progress and next steps.',
    practiceArea: 'Litigation',
    icon: Scale,
    estimatedDuration: '30–45 min',
    consentLanguage: 'I would like to make a recording of our meeting today for attendance note purposes. It will be stored securely and deleted after 7 days. Is that acceptable?',
    documentSections: ['Current Proceedings Summary', 'Recent Developments', 'Case Timeline', 'Without Prejudice Position', 'Cost Position', 'Next Steps and Directions'],
    suggestedActionItems: [
      'Serve responses to any outstanding requests',
      'Update client on costs position',
      'Review and respond to last correspondence',
      'Confirm next court hearing date',
      'Assess settlement prospects and advise',
    ],
  },
];

interface CaseTemplatesModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (template: CaseTemplate) => void;
}

export default function CaseTemplatesModal({ open, onOpenChange, onSelect }: CaseTemplatesModalProps) {
  const [selected, setSelected] = useState<CaseTemplate | null>(null);

  const handleConfirm = () => {
    if (selected) {
      onSelect(selected);
      onOpenChange(false);
      setSelected(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>Choose a Case Template</DialogTitle>
          <DialogDescription>
            Templates pre-populate the practice area, document structure, action items, and consent language.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto -mx-6 px-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 py-4">
            {BUILT_IN_TEMPLATES.map(template => {
              const Icon = template.icon;
              const isSelected = selected?.id === template.id;
              return (
                <Card
                  key={template.id}
                  className={`cursor-pointer transition-all hover-elevate ${isSelected ? 'ring-2 ring-primary' : ''}`}
                  onClick={() => setSelected(template)}
                  data-testid={`template-card-${template.id}`}
                >
                  <CardContent className="p-4">
                    <div className="flex items-start gap-3">
                      <div className={`p-2 rounded-md ${isSelected ? 'bg-primary/10' : 'bg-muted'}`}>
                        <Icon className={`w-4 h-4 ${isSelected ? 'text-primary' : 'text-muted-foreground'}`} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h4 className="text-sm font-medium">{template.name}</h4>
                          <Badge variant="outline" className="text-xs">{template.practiceArea}</Badge>
                        </div>
                        <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{template.description}</p>
                        <div className="flex items-center gap-3 mt-2">
                          <span className="text-xs text-muted-foreground">{template.estimatedDuration}</span>
                          <span className="text-xs text-muted-foreground">{template.suggestedActionItems.length} action items</span>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          {/* Preview of selected template */}
          {selected && (
            <div className="border border-border rounded-md p-4 mb-4 space-y-3">
              <h4 className="text-sm font-semibold">Preview: {selected.name}</h4>
              <div>
                <p className="text-xs font-medium text-muted-foreground mb-1.5">Document sections that will be pre-created:</p>
                <div className="flex flex-wrap gap-1.5">
                  {selected.documentSections.map(s => (
                    <Badge key={s} variant="secondary" className="text-xs">{s}</Badge>
                  ))}
                </div>
              </div>
              <div>
                <p className="text-xs font-medium text-muted-foreground mb-1.5">Suggested action items to track:</p>
                <ul className="space-y-1">
                  {selected.suggestedActionItems.slice(0, 3).map(a => (
                    <li key={a} className="text-xs text-muted-foreground flex items-start gap-1.5">
                      <ChevronRight className="w-3 h-3 shrink-0 mt-0.5" />
                      {a}
                    </li>
                  ))}
                  {selected.suggestedActionItems.length > 3 && (
                    <li className="text-xs text-muted-foreground/60">+{selected.suggestedActionItems.length - 3} more</li>
                  )}
                </ul>
              </div>
              <div>
                <p className="text-xs font-medium text-muted-foreground mb-1">Consent language:</p>
                <p className="text-xs text-muted-foreground italic leading-relaxed">"{selected.consentLanguage}"</p>
              </div>
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2 pt-4 border-t border-border">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleConfirm} disabled={!selected} data-testid="button-use-template">
            Use Template
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export { BUILT_IN_TEMPLATES };

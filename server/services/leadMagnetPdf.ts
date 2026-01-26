import { jsPDF } from 'jspdf';

const BRAND_TERRACOTTA = [180, 82, 59] as const; // hsl(18,70%,42%)
const BRAND_DARK = [25, 30, 12] as const;      // hsl(25,30%,12%)
const BRAND_TEXT = [60, 50, 40] as const;      // Secondary text
const BRAND_BG = [252, 251, 249] as const;     // Warm cream

interface LeadMagnetOptions {
  recipientName?: string;
}

export function generateDefensibleRecordPDF(options: LeadMagnetOptions = {}): Buffer {
  const pdf = new jsPDF('p', 'mm', 'a4');
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const margin = 20;
  const contentWidth = pageWidth - (margin * 2);
  let yPos = margin;

  const setPageBackground = () => {
    pdf.setFillColor(...BRAND_BG);
    pdf.rect(0, 0, pageWidth, pageHeight, 'F');
  };

  const addNewPage = () => {
    pdf.addPage();
    setPageBackground();
    yPos = margin;
  };

  const checkPageBreak = (neededSpace: number) => {
    if (yPos + neededSpace > pageHeight - margin) {
      addNewPage();
    }
  };

  // --- Helpers ---
  const addSectionHeader = (text: string) => {
    checkPageBreak(30);
    yPos += 10;
    pdf.setFont('times', 'bold');
    pdf.setFontSize(22);
    pdf.setTextColor(...BRAND_DARK);
    pdf.text(text, margin, yPos);
    yPos += 3;
    pdf.setDrawColor(...BRAND_TERRACOTTA);
    pdf.setLineWidth(0.8);
    pdf.line(margin, yPos, margin + 20, yPos);
    yPos += 12;
  };

  const addParagraph = (text: string, fontSize = 11, spacing = 6) => {
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(fontSize);
    pdf.setTextColor(...BRAND_TEXT);
    const lines = pdf.splitTextToSize(text, contentWidth);
    checkPageBreak(lines.length * spacing);
    pdf.text(lines, margin, yPos);
    yPos += (lines.length * spacing) + 4;
  };

  const addBulletPoint = (text: string) => {
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(11);
    pdf.setTextColor(...BRAND_TEXT);
    const lines = pdf.splitTextToSize(text, contentWidth - 12);
    checkPageBreak(lines.length * 6 + 2);
    pdf.setFillColor(...BRAND_TERRACOTTA);
    pdf.circle(margin + 4, yPos - 1.5, 1, 'F');
    pdf.text(lines, margin + 10, yPos);
    yPos += (lines.length * 6) + 3;
  };

  // --- Cover Page ---
  setPageBackground();
  pdf.setFillColor(...BRAND_TERRACOTTA);
  pdf.rect(0, 0, pageWidth, 50, 'F');
  
  pdf.setTextColor(255, 255, 255);
  pdf.setFont('times', 'bold');
  pdf.setFontSize(24);
  pdf.text('LegalNote', margin, 28);
  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(9);
  pdf.text('COMPLIANCE-FIRST DOCUMENTATION', margin, 36);

  yPos = 100;
  pdf.setTextColor(...BRAND_DARK);
  pdf.setFont('times', 'bold');
  pdf.setFontSize(42);
  pdf.text('The Defensible', pageWidth / 2, yPos, { align: 'center' });
  yPos += 16;
  pdf.text('Record', pageWidth / 2, yPos, { align: 'center' });

  yPos += 20;
  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(14);
  pdf.setTextColor(...BRAND_TEXT);
  pdf.text("A Solicitor's Guide to Contemporaneous Evidence", pageWidth / 2, yPos, { align: 'center' });

  yPos = pageHeight - 40;
  pdf.setDrawColor(...BRAND_TERRACOTTA);
  pdf.setLineWidth(0.5);
  pdf.line(pageWidth / 2 - 15, yPos, pageWidth / 2 + 15, yPos);
  yPos += 15;
  pdf.setFont('times', 'italic');
  pdf.setFontSize(12);
  pdf.text('legalnote.ai', pageWidth / 2, yPos, { align: 'center' });

  // --- Page 2: Intro ---
  addNewPage();
  addSectionHeader('Introduction');
  addParagraph('When a complaint arrives about advice given years ago, the quality of your file notes becomes the difference between a straightforward defence and an expensive, stressful investigation. This guide provides practical frameworks for creating documentation that protects both you and your clients.');
  addParagraph('The SRA Handbook requires that client matters are documented properly. Beyond regulatory compliance, high-quality contemporaneous records are your primary evidence when memories fade and accounts differ.');

  addSectionHeader('What Makes a Record "Defensible"?');
  addParagraph('A defensible record would withstand scrutiny from the SRA, a PI insurer, or opposing counsel. It demonstrates that professional standards were maintained throughout.');
  addBulletPoint('Contemporaneous: Created at or shortly after the event.');
  addBulletPoint('Complete: Capturing all material matters discussed.');
  addBulletPoint('Objective: Recording what was said, not interpretations.');
  addBulletPoint('Clear: Written for a professional third party to understand.');
  addBulletPoint('Verified: Documented client acknowledgment of key points.');

  // --- Page 3: The 3 Elements ---
  addNewPage();
  addSectionHeader('The Three Essential Elements');
  
  const addLargeStep = (num: string, title: string, desc: string) => {
    pdf.setFont('times', 'bold');
    pdf.setFontSize(16);
    pdf.setTextColor(...BRAND_TERRACOTTA);
    pdf.text(num, margin, yPos);
    pdf.setTextColor(...BRAND_DARK);
    pdf.text(title, margin + 10, yPos);
    yPos += 8;
    addParagraph(desc, 11, 6);
    yPos += 4;
  };

  addLargeStep('1', 'Context & Participants', 'Record the date, time, duration, attendees, and meeting format (in-person, video, telephone). This sets the foundation for your evidence.');
  addLargeStep('2', 'Substantive Content', 'A summary of matters discussed, advice given (including the basis), client instructions received, and decisions made. Avoid vague summaries; record specific figures and dates.');
  addLargeStep('3', 'Action Items & Next Steps', 'Clear documentation of who is doing what, by when. This demonstrates proper matter progression and creates accountability.');

  // --- Page 4: Gaps ---
  addNewPage();
  addSectionHeader('Common Documentation Gaps');
  addParagraph('Negligence claims often reveal patterns in documentation failure. Avoid these common exposures:');

  const gaps = [
    { t: 'Vague Advice', d: 'Recording "discussed options" without detailing the specific advice given or the client\'s response.' },
    { t: 'Missing Decisions', d: 'Documenting advice but failing to record the client\'s specific instruction or decision.' },
    { t: 'Informal Gaps', d: 'Corridor or phone conversations that never reach the formal file record.' },
    { t: 'Delayed Entry', d: 'Notes created weeks later. Metadata timestamps can undermine claims of contemporaneous recording.' }
  ];

  gaps.forEach(g => {
    checkPageBreak(25);
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(12);
    pdf.setTextColor(...BRAND_DARK);
    pdf.text(g.t, margin, yPos);
    yPos += 6;
    addParagraph(g.d, 10.5, 5);
    yPos += 2;
  });

  // --- Page 5: Template & Tech ---
  addNewPage();
  addSectionHeader('Sample Note Structure');
  pdf.setFillColor(248, 246, 243);
  pdf.setDrawColor(...BRAND_TERRACOTTA);
  pdf.roundedRect(margin, yPos, contentWidth, 60, 2, 2, 'FD');
  
  let innerY = yPos + 8;
  pdf.setFontSize(9);
  const rows = [
    ['MATTER REF:', '[Ref Number]'],
    ['CLIENT:', '[Full Name]'],
    ['DATE/TIME:', '[DD/MM/YY, HH:MM]'],
    ['ADVICE:', '[Advice given with reasoning]'],
    ['DECISION:', '[Client instructions]'],
    ['ACTIONS:', '[Next steps and deadlines]']
  ];
  
  rows.forEach(r => {
    pdf.setFont('helvetica', 'bold');
    pdf.setTextColor(...BRAND_DARK);
    pdf.text(r[0], margin + 5, innerY);
    pdf.setFont('helvetica', 'normal');
    pdf.setTextColor(...BRAND_TEXT);
    pdf.text(r[1], margin + 40, innerY);
    innerY += 8;
  });
  yPos += 70;

  addSectionHeader('Modern Best Practices');
  addBulletPoint('Record meetings (with consent) for an indisputable primary source.');
  addBulletPoint('Use transcription to capture exact wording of advice.');
  addBulletPoint('Store records in a secure, audit-trailed system.');

  yPos = pageHeight - 35;
  pdf.setFillColor(...BRAND_TERRACOTTA);
  pdf.rect(margin, yPos, contentWidth, 20, 'F');
  pdf.setTextColor(255, 255, 255);
  pdf.setFont('times', 'bold');
  pdf.setFontSize(12);
  pdf.text('Ready to automate your defensible records?', margin + 10, yPos + 8);
  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(9);
  pdf.text('Visit legalnote.ai to start your founding cohort trial.', margin + 10, yPos + 14);

  return Buffer.from(pdf.output('arraybuffer'));
}

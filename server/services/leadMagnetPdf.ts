import jsPDF from 'jspdf';

const BRAND_TERRACOTTA = [180, 82, 59] as const; // RGB equivalent of hsl(18,70%,42%)
const BRAND_DARK = [38, 27, 20] as const; // Dark brown for text
const BRAND_LIGHT = [250, 247, 244] as const; // Light cream background

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

  const addNewPage = () => {
    pdf.addPage();
    yPos = margin;
  };

  const checkPageBreak = (neededSpace: number) => {
    if (yPos + neededSpace > pageHeight - margin) {
      addNewPage();
    }
  };

  // Cover Page
  // Header bar
  pdf.setFillColor(...BRAND_TERRACOTTA);
  pdf.rect(0, 0, pageWidth, 60, 'F');

  // LegalNote branding
  pdf.setTextColor(255, 255, 255);
  pdf.setFontSize(24);
  pdf.setFont('helvetica', 'bold');
  pdf.text('LegalNote', margin, 35);
  
  pdf.setFontSize(10);
  pdf.setFont('helvetica', 'normal');
  pdf.text('Professional Legal Documentation', margin, 45);

  // Title
  yPos = 100;
  pdf.setTextColor(...BRAND_DARK);
  pdf.setFontSize(32);
  pdf.setFont('helvetica', 'bold');
  const title = 'The Defensible Record';
  pdf.text(title, pageWidth / 2, yPos, { align: 'center' });

  yPos += 15;
  pdf.setFontSize(16);
  pdf.setFont('helvetica', 'normal');
  pdf.setTextColor(100, 90, 80);
  const subtitle = "A Solicitor's Guide to Creating";
  pdf.text(subtitle, pageWidth / 2, yPos, { align: 'center' });
  yPos += 8;
  pdf.text('Contemporaneous Evidence', pageWidth / 2, yPos, { align: 'center' });

  // Decorative line
  yPos += 20;
  pdf.setDrawColor(...BRAND_TERRACOTTA);
  pdf.setLineWidth(1);
  pdf.line(pageWidth / 2 - 30, yPos, pageWidth / 2 + 30, yPos);

  // Personal greeting if name provided
  if (options.recipientName) {
    yPos += 25;
    pdf.setFontSize(12);
    pdf.setTextColor(...BRAND_DARK);
    pdf.text(`Prepared for: ${options.recipientName}`, pageWidth / 2, yPos, { align: 'center' });
  }

  // Footer on cover
  pdf.setFontSize(10);
  pdf.setTextColor(120, 110, 100);
  pdf.text('legalnote.ai', pageWidth / 2, pageHeight - 25, { align: 'center' });
  pdf.setFontSize(8);
  pdf.text(`${new Date().getFullYear()} LegalNote. All rights reserved.`, pageWidth / 2, pageHeight - 18, { align: 'center' });

  // Page 2 - Introduction
  addNewPage();
  
  // Section header helper
  const addSectionHeader = (text: string) => {
    checkPageBreak(25);
    pdf.setFillColor(...BRAND_TERRACOTTA);
    pdf.rect(margin - 5, yPos - 5, 3, 12, 'F');
    pdf.setFontSize(18);
    pdf.setFont('helvetica', 'bold');
    pdf.setTextColor(...BRAND_DARK);
    pdf.text(text, margin + 3, yPos + 4);
    yPos += 18;
  };

  const addParagraph = (text: string) => {
    pdf.setFontSize(11);
    pdf.setFont('helvetica', 'normal');
    pdf.setTextColor(60, 55, 50);
    const lines = pdf.splitTextToSize(text, contentWidth);
    checkPageBreak(lines.length * 6);
    pdf.text(lines, margin, yPos);
    yPos += lines.length * 6 + 6;
  };

  const addBulletPoint = (text: string) => {
    pdf.setFontSize(11);
    pdf.setFont('helvetica', 'normal');
    pdf.setTextColor(60, 55, 50);
    const bulletX = margin + 5;
    const textX = margin + 12;
    const lines = pdf.splitTextToSize(text, contentWidth - 15);
    checkPageBreak(lines.length * 6 + 3);
    
    pdf.setFillColor(...BRAND_TERRACOTTA);
    pdf.circle(bulletX, yPos - 1.5, 1.5, 'F');
    pdf.text(lines, textX, yPos);
    yPos += lines.length * 6 + 3;
  };

  const addNumberedPoint = (number: string, title: string, description: string) => {
    checkPageBreak(25);
    
    // Number circle
    pdf.setFillColor(...BRAND_TERRACOTTA);
    pdf.circle(margin + 8, yPos, 8, 'F');
    pdf.setTextColor(255, 255, 255);
    pdf.setFontSize(12);
    pdf.setFont('helvetica', 'bold');
    pdf.text(number, margin + 8, yPos + 1, { align: 'center' });
    
    // Title
    pdf.setTextColor(...BRAND_DARK);
    pdf.setFontSize(13);
    pdf.setFont('helvetica', 'bold');
    pdf.text(title, margin + 22, yPos + 1);
    yPos += 10;
    
    // Description
    pdf.setFontSize(11);
    pdf.setFont('helvetica', 'normal');
    pdf.setTextColor(60, 55, 50);
    const lines = pdf.splitTextToSize(description, contentWidth - 25);
    pdf.text(lines, margin + 22, yPos);
    yPos += lines.length * 6 + 8;
  };

  addSectionHeader('Introduction');
  
  addParagraph(
    'When a complaint arrives about advice given years ago, the quality of your file notes becomes the difference between a straightforward defence and an expensive, stressful investigation. This guide provides practical frameworks for creating documentation that protects both you and your clients.'
  );

  addParagraph(
    'The SRA Handbook requires that client matters are documented properly. But beyond regulatory compliance, good file notes are your primary evidence when memories fade and clients remember events differently.'
  );

  // Page 3 - What Makes a Record Defensible
  addSectionHeader('What Makes a Record "Defensible"?');

  addParagraph(
    'A defensible record is one that would withstand scrutiny from the SRA, a PI insurer, or opposing counsel. It demonstrates not just what was discussed, but that proper professional standards were maintained throughout the retainer.'
  );

  addParagraph('The hallmarks of a defensible record include:');

  addBulletPoint('Contemporaneous creation - made at or shortly after the event, not retrospectively constructed');
  addBulletPoint('Completeness - capturing all material matters discussed, not selective highlights');
  addBulletPoint('Objectivity - recording what was said, not interpretations or assumptions');
  addBulletPoint('Clarity - written so that anyone reading it later can understand the context');
  addBulletPoint('Verification - ideally with documented client acknowledgment of key points');

  // The 3 Elements Section
  checkPageBreak(50);
  addSectionHeader('The Three Elements Every Attendance Note Needs');

  addNumberedPoint('1', 'Context & Participants', 
    'Date, time, duration, attendees (including their roles), and the meeting format (in-person, video call, telephone). This establishes the foundation of your record and helps reconstruct the circumstances if questioned later.'
  );

  addNumberedPoint('2', 'Substantive Content',
    'A comprehensive summary of: (a) matters discussed, (b) advice given including the basis for that advice, (c) client instructions received, (d) decisions made, and (e) any documents reviewed or referenced. Record specific figures, dates, and names - vague summaries lose evidential value.'
  );

  addNumberedPoint('3', 'Action Items & Next Steps',
    'Clear documentation of who is doing what, by when. This creates accountability and demonstrates proper matter progression. Include any deadlines discussed, fee estimates provided, and follow-up commitments from either party.'
  );

  // Page 4 - Common Gaps
  addNewPage();
  addSectionHeader('Documentation Gaps That Expose Firms to PI Claims');

  addParagraph(
    'Analysis of legal negligence claims reveals consistent patterns in documentation failures. Being aware of these common gaps helps you avoid them:'
  );

  const gaps = [
    {
      title: 'The "We Discussed" Problem',
      desc: 'Notes that say "we discussed options" without recording what options were presented and what the client chose. When disputes arise, there\'s no evidence of the advice actually given.'
    },
    {
      title: 'Missing Client Decisions',
      desc: 'Recording advice given but not the client\'s response or decision. This leaves you unable to demonstrate that the client made an informed choice when they later claim they weren\'t told about risks.'
    },
    {
      title: 'Informal Communication Gaps',
      desc: 'Key matters discussed in corridor conversations, brief phone calls, or casual exchanges that never make it to the file. If it\'s not recorded, it didn\'t happen.'
    },
    {
      title: 'Retroactive Documentation',
      desc: 'Notes created days or weeks after meetings. Metadata timestamps can undermine claims of contemporaneous recording, and memory naturally degrades over time.'
    },
    {
      title: 'Client Identity Assumptions',
      desc: 'In group or family matters, unclear records of who instructed what. This creates conflict-of-interest and confidentiality issues when family members later disagree.'
    }
  ];

  gaps.forEach(gap => {
    checkPageBreak(22);
    pdf.setFontSize(12);
    pdf.setFont('helvetica', 'bold');
    pdf.setTextColor(...BRAND_DARK);
    pdf.text(gap.title, margin, yPos);
    yPos += 7;
    
    pdf.setFontSize(10);
    pdf.setFont('helvetica', 'normal');
    pdf.setTextColor(80, 75, 70);
    const lines = pdf.splitTextToSize(gap.desc, contentWidth);
    pdf.text(lines, margin, yPos);
    yPos += lines.length * 5 + 8;
  });

  // Page 5 - Sample Template
  addNewPage();
  addSectionHeader('Sample Attendance Note Structure');

  addParagraph(
    'While every firm has its own templates, the following structure ensures you capture the essential elements for any client meeting:'
  );

  // Template box
  checkPageBreak(120);
  pdf.setFillColor(248, 246, 243);
  pdf.setDrawColor(...BRAND_TERRACOTTA);
  pdf.setLineWidth(0.5);
  pdf.roundedRect(margin, yPos, contentWidth, 115, 3, 3, 'FD');
  
  yPos += 8;
  const templateContent = [
    { label: 'MATTER REFERENCE:', value: '[Reference Number]' },
    { label: 'CLIENT:', value: '[Full Name(s)]' },
    { label: 'DATE & TIME:', value: '[DD/MM/YYYY, HH:MM - HH:MM]' },
    { label: 'ATTENDEES:', value: '[Names and roles of all present]' },
    { label: 'FORMAT:', value: '[In-person / Video / Telephone]' },
    { label: '', value: '' },
    { label: 'MATTERS DISCUSSED:', value: '' },
    { label: '', value: '[Detailed summary of topics covered]' },
    { label: '', value: '' },
    { label: 'ADVICE PROVIDED:', value: '' },
    { label: '', value: '[Specific advice given with reasoning]' },
    { label: '', value: '' },
    { label: 'CLIENT INSTRUCTIONS:', value: '' },
    { label: '', value: '[Decisions and directions from client]' },
    { label: '', value: '' },
    { label: 'ACTION ITEMS:', value: '' },
    { label: '', value: '[Who / What / By When]' },
    { label: '', value: '' },
    { label: 'RECORDED BY:', value: '[Your name] on [Date/Time of note creation]' },
  ];

  pdf.setFontSize(9);
  templateContent.forEach(item => {
    if (item.label) {
      pdf.setFont('helvetica', 'bold');
      pdf.setTextColor(...BRAND_DARK);
      pdf.text(item.label, margin + 5, yPos);
      pdf.setFont('helvetica', 'normal');
      pdf.setTextColor(80, 75, 70);
      pdf.text(item.value, margin + 50, yPos);
    } else if (item.value) {
      pdf.setFont('helvetica', 'italic');
      pdf.setTextColor(100, 95, 90);
      pdf.text(item.value, margin + 10, yPos);
    }
    yPos += 5.5;
  });

  yPos += 10;

  // Final Section - Technology & Best Practices
  addSectionHeader('Best Practices for Modern Practice');

  addParagraph(
    'Technology has transformed documentation possibilities. Consider these practices to strengthen your file notes:'
  );

  addBulletPoint('Record meetings (with consent) to create a primary source that attendance notes can reference');
  addBulletPoint('Use transcription to capture exact wording of key exchanges - particularly valuable for advice and instructions');
  addBulletPoint('Document consent at the start of each recording, creating an audit trail of client agreement');
  addBulletPoint('Make notes immediately while memory is fresh - delays erode accuracy and evidential weight');
  addBulletPoint('Store records securely with access controls and audit trails for regulatory compliance');

  // Conclusion/CTA
  checkPageBreak(50);
  yPos += 10;
  pdf.setFillColor(...BRAND_TERRACOTTA);
  pdf.roundedRect(margin, yPos, contentWidth, 40, 3, 3, 'F');
  
  pdf.setTextColor(255, 255, 255);
  pdf.setFontSize(14);
  pdf.setFont('helvetica', 'bold');
  pdf.text('Ready to create defensible records automatically?', margin + 10, yPos + 12);
  
  pdf.setFontSize(11);
  pdf.setFont('helvetica', 'normal');
  pdf.text('LegalNote captures consent, transcribes meetings, and generates professional', margin + 10, yPos + 22);
  pdf.text('attendance notes - creating contemporaneous evidence you can rely on.', margin + 10, yPos + 28);
  
  pdf.setFont('helvetica', 'bold');
  pdf.text('legalnote.ai', margin + 10, yPos + 36);

  // Footer on last page
  pdf.setTextColor(120, 110, 100);
  pdf.setFontSize(8);
  pdf.setFont('helvetica', 'normal');
  pdf.text(
    `Generated ${new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })} | legalnote.ai`,
    pageWidth / 2,
    pageHeight - 10,
    { align: 'center' }
  );

  return Buffer.from(pdf.output('arraybuffer'));
}

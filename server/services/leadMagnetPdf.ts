import { jsPDF } from 'jspdf';

const BRAND_TERRACOTTA = [180, 82, 59] as const; // RGB equivalent of hsl(18,70%,42%)
const BRAND_DARK = [25, 30, 12] as const; // Match website dark text: hsl(25,30%,12%)
const BRAND_TEXT = [60, 50, 40] as const; // Match website secondary text
const BRAND_LIGHT = [250, 247, 244] as const; // Light cream background

interface LeadMagnetOptions {
  recipientName?: string;
}

export function generateDefensibleRecordPDF(options: LeadMagnetOptions = {}): Buffer {
  const pdf = new jsPDF('p', 'mm', 'a4');
  
  // Custom fonts are tricky with jsPDF without base64 embedding.
  // We'll use standard fonts but focus on the spacing and colors from the site.
  // Lora equivalent -> times
  // Inter equivalent -> helvetica
  
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const margin = 20;
  const contentWidth = pageWidth - (margin * 2);
  let yPos = margin;

  const addNewPage = () => {
    pdf.addPage();
    // Subtle background color for all pages
    pdf.setFillColor(252, 251, 249);
    pdf.rect(0, 0, pageWidth, pageHeight, 'F');
    yPos = margin;
  };

  const checkPageBreak = (neededSpace: number) => {
    if (yPos + neededSpace > pageHeight - margin) {
      addNewPage();
    }
  };

  // Initial Background
  pdf.setFillColor(252, 251, 249);
  pdf.rect(0, 0, pageWidth, pageHeight, 'F');

  // Cover Page
  // Header bar - thinner and more elegant
  pdf.setFillColor(...BRAND_TERRACOTTA);
  pdf.rect(0, 0, pageWidth, 45, 'F');

  // LegalNote branding
  pdf.setTextColor(255, 255, 255);
  pdf.setFontSize(22);
  pdf.setFont('times', 'bold'); // Lora-like
  pdf.text('LegalNote', margin, 25);
  
  pdf.setFontSize(9);
  pdf.setFont('helvetica', 'normal'); // Inter-like
  pdf.text('COMPLIANCE-FIRST DOCUMENTATION', margin, 32);

  // Title
  yPos = 90;
  pdf.setTextColor(...BRAND_DARK);
  pdf.setFontSize(36);
  pdf.setFont('times', 'bold');
  const title = 'The Defensible Record';
  pdf.text(title, pageWidth / 2, yPos, { align: 'center' });

  yPos += 18;
  pdf.setFontSize(14);
  pdf.setFont('helvetica', 'normal');
  pdf.setTextColor(...BRAND_TEXT);
  const subtitle = "A Solicitor's Guide to Contemporaneous Evidence";
  pdf.text(subtitle, pageWidth / 2, yPos, { align: 'center' });

  // Decorative element - matching the website's clean lines
  yPos += 25;
  pdf.setDrawColor(...BRAND_TERRACOTTA);
  pdf.setLineWidth(0.8);
  pdf.line(pageWidth / 2 - 20, yPos, pageWidth / 2 + 20, yPos);

  // Value prop section on cover
  yPos += 40;
  pdf.setFontSize(11);
  pdf.setTextColor(...BRAND_DARK);
  pdf.setFont('times', 'italic');
  const quote = '"In the legal world, if it isn\'t recorded contemporaneously, it didn\'t happen."';
  const quoteLines = pdf.splitTextToSize(quote, contentWidth - 40);
  pdf.text(quoteLines, pageWidth / 2, yPos, { align: 'center' });

  // Page 2 - Introduction
  addNewPage();
  
  // Section header helper
  const addSectionHeader = (text: string) => {
    checkPageBreak(30);
    yPos += 10;
    pdf.setFontSize(20);
    pdf.setFont('times', 'bold');
    pdf.setTextColor(...BRAND_DARK);
    pdf.text(text, margin, yPos);
    
    // Subtle accent underline
    yPos += 3;
    pdf.setDrawColor(...BRAND_TERRACOTTA);
    pdf.setLineWidth(0.5);
    pdf.line(margin, yPos, margin + 15, yPos);
    
    yPos += 12;
  };

  const addParagraph = (text: string) => {
    pdf.setFontSize(11);
    pdf.setFont('helvetica', 'normal');
    pdf.setTextColor(...BRAND_TEXT);
    const lines = pdf.splitTextToSize(text, contentWidth);
    checkPageBreak(lines.length * 6);
    pdf.text(lines, margin, yPos);
    yPos += lines.length * 6 + 6;
  };

  const addBulletPoint = (text: string) => {
    pdf.setFontSize(11);
    pdf.setFont('helvetica', 'normal');
    pdf.setTextColor(...BRAND_TEXT);
    const bulletX = margin + 5;
    const textX = margin + 12;
    const lines = pdf.splitTextToSize(text, contentWidth - 15);
    checkPageBreak(lines.length * 6 + 3);
    
    pdf.setFillColor(...BRAND_TERRACOTTA);
    pdf.circle(bulletX, yPos - 1.5, 1, 'F');
    pdf.text(lines, textX, yPos);
    yPos += lines.length * 6 + 4;
  };

  const addNumberedPoint = (number: string, title: string, description: string) => {
    checkPageBreak(30);
    
    // Number
    pdf.setTextColor(...BRAND_TERRACOTTA);
    pdf.setFontSize(14);
    pdf.setFont('times', 'bold');
    pdf.text(`${number}.`, margin, yPos);
    
    // Title
    pdf.setTextColor(...BRAND_DARK);
    pdf.setFontSize(12);
    pdf.setFont('helvetica', 'bold');
    pdf.text(title, margin + 8, yPos);
    yPos += 8;
    
    // Description
    pdf.setFontSize(10.5);
    pdf.setFont('helvetica', 'normal');
    pdf.setTextColor(...BRAND_TEXT);
    const lines = pdf.splitTextToSize(description, contentWidth - 8);
    pdf.text(lines, margin + 8, yPos);
    yPos += lines.length * 6 + 10;
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

  addBulletPoint('Contemporaneous creation - made at or shortly after the event');
  addBulletPoint('Completeness - capturing all material matters discussed');
  addBulletPoint('Objectivity - recording what was said, not interpretations');
  addBulletPoint('Clarity - written so any professional can understand the context');
  addBulletPoint('Verification - documented client acknowledgment of key points');

  // The 3 Elements Section
  addSectionHeader('Three Essential Elements');

  addNumberedPoint('1', 'Context & Participants', 
    'Date, time, duration, and attendees. This establishes the foundation of your record.'
  );

  addNumberedPoint('2', 'Substantive Content',
    'A summary of matters discussed, advice given, instructions received, and decisions made.'
  );

  addNumberedPoint('3', 'Action Items & Next Steps',
    'Clear documentation of who is doing what, by when, creating accountability.'
  );

  // Final Section - Technology & Best Practices
  addSectionHeader('Modern Best Practices');

  addParagraph(
    'Technology has transformed documentation possibilities. Consider these practices to strengthen your file notes:'
  );

  addBulletPoint('Record meetings (with consent) to create a primary source');
  addBulletPoint('Use transcription to capture exact wording of key exchanges');
  addBulletPoint('Document consent at the start of each recording');
  addBulletPoint('Make notes immediately while memory is fresh');

  // Conclusion/CTA
  checkPageBreak(50);
  yPos += 20;
  pdf.setFillColor(...BRAND_TERRACOTTA);
  pdf.rect(margin, yPos, contentWidth, 35, 'F');
  
  pdf.setTextColor(255, 255, 255);
  pdf.setFontSize(14);
  pdf.setFont('times', 'bold');
  pdf.text('Ready to automate your defensible records?', margin + 10, yPos + 12);
  
  pdf.setFontSize(10);
  pdf.setFont('helvetica', 'normal');
  pdf.text('LegalNote captures consent, transcribes meetings, and generates professional', margin + 10, yPos + 22);
  pdf.text('attendance notes - contemporaneous evidence you can rely on.', margin + 10, yPos + 27);
  
  pdf.setFont('helvetica', 'bold');
  pdf.text('legalnote.ai', margin + 10, yPos + 31);

  // Footer on last page
  pdf.setTextColor(150, 140, 130);
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

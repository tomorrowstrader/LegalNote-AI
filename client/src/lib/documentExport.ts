import jsPDF from 'jspdf';
import { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType } from 'docx';
import { saveAs } from 'file-saver';

interface DocumentContent {
  summary?: string;
  attendanceNote?: string;
  legalOpinion?: string;
  transcript?: string;
  caseTitle: string;
  clientName: string;
  matterReference?: string;
  createdAt: string;
}

export async function exportToPDF(content: DocumentContent) {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 20;
  const maxWidth = pageWidth - (margin * 2);
  let yPosition = margin;

  // Helper function to add text with word wrap
  const addText = (text: string, fontSize: number = 11, isBold: boolean = false) => {
    doc.setFontSize(fontSize);
    doc.setFont('helvetica', isBold ? 'bold' : 'normal');
    
    const lines = doc.splitTextToSize(text, maxWidth);
    
    lines.forEach((line: string) => {
      // Check if we need a new page
      if (yPosition > doc.internal.pageSize.getHeight() - margin) {
        doc.addPage();
        yPosition = margin;
      }
      
      doc.text(line, margin, yPosition);
      yPosition += fontSize * 0.5;
    });
    
    yPosition += 5; // Add spacing after paragraph
  };

  // Header
  addText('Legal Case Documentation', 18, true);
  yPosition += 5;
  
  addText(`Case: ${content.caseTitle}`, 14, true);
  addText(`Client: ${content.clientName}`, 12);
  if (content.matterReference) {
    addText(`Matter Reference: ${content.matterReference}`, 12);
  }
  addText(`Generated: ${new Date(content.createdAt).toLocaleDateString('en-GB', { 
    day: 'numeric', 
    month: 'long', 
    year: 'numeric' 
  })}`, 10);
  
  yPosition += 10;
  doc.setDrawColor(200, 200, 200);
  doc.line(margin, yPosition, pageWidth - margin, yPosition);
  yPosition += 15;

  // Summary
  if (content.summary) {
    addText('CASE SUMMARY', 16, true);
    yPosition += 5;
    addText(content.summary);
    yPosition += 10;
  }

  // Attendance Note
  if (content.attendanceNote) {
    if (yPosition > doc.internal.pageSize.getHeight() - 100) {
      doc.addPage();
      yPosition = margin;
    }
    addText('ATTENDANCE NOTE', 16, true);
    yPosition += 5;
    addText(content.attendanceNote);
    yPosition += 10;
  }

  // Legal Opinion
  if (content.legalOpinion) {
    if (yPosition > doc.internal.pageSize.getHeight() - 100) {
      doc.addPage();
      yPosition = margin;
    }
    addText('LEGAL OPINION', 16, true);
    yPosition += 5;
    addText(content.legalOpinion);
    yPosition += 10;
  }

  // Transcript
  if (content.transcript) {
    if (yPosition > doc.internal.pageSize.getHeight() - 100) {
      doc.addPage();
      yPosition = margin;
    }
    addText('FULL TRANSCRIPT', 16, true);
    yPosition += 5;
    addText(content.transcript);
  }

  // Generate filename
  const filename = `${content.caseTitle.replace(/[^a-z0-9]/gi, '_')}_${Date.now()}.pdf`;
  
  // Save the PDF
  doc.save(filename);
}

export async function exportToWord(content: DocumentContent) {
  const children: Paragraph[] = [];

  // Header section
  children.push(
    new Paragraph({
      text: 'Legal Case Documentation',
      heading: HeadingLevel.HEADING_1,
      alignment: AlignmentType.CENTER,
      spacing: { after: 400 },
    }),
    new Paragraph({
      children: [
        new TextRun({ text: 'Case: ', bold: true }),
        new TextRun(content.caseTitle),
      ],
      spacing: { after: 200 },
    }),
    new Paragraph({
      children: [
        new TextRun({ text: 'Client: ', bold: true }),
        new TextRun(content.clientName),
      ],
      spacing: { after: 200 },
    })
  );

  if (content.matterReference) {
    children.push(
      new Paragraph({
        children: [
          new TextRun({ text: 'Matter Reference: ', bold: true }),
          new TextRun(content.matterReference),
        ],
        spacing: { after: 200 },
      })
    );
  }

  children.push(
    new Paragraph({
      children: [
        new TextRun({ text: 'Generated: ', bold: true }),
        new TextRun(new Date(content.createdAt).toLocaleDateString('en-GB', {
          day: 'numeric',
          month: 'long',
          year: 'numeric',
        })),
      ],
      spacing: { after: 600 },
    })
  );

  // Helper to preserve formatting and paragraph breaks
  const formatTextSection = (text: string): Paragraph[] => {
    const lines = text.split('\n');
    const paragraphs: Paragraph[] = [];
    
    for (const line of lines) {
      const trimmedLine = line.trim();
      
      // Empty line creates spacing
      if (!trimmedLine) {
        paragraphs.push(new Paragraph({ text: '', spacing: { after: 100 } }));
        continue;
      }
      
      // Check if line is a heading (starts with ** or is all caps with : at end)
      const isHeading = trimmedLine.match(/^\*\*.*\*\*$/) || (trimmedLine === trimmedLine.toUpperCase() && trimmedLine.endsWith(':'));
      
      if (isHeading) {
        paragraphs.push(
          new Paragraph({
            children: [new TextRun({ text: trimmedLine.replace(/\*\*/g, ''), bold: true })],
            spacing: { before: 200, after: 100 },
          })
        );
      } else {
        paragraphs.push(
          new Paragraph({
            text: trimmedLine,
            spacing: { after: 100 },
          })
        );
      }
    }
    
    return paragraphs;
  };

  // Summary section
  if (content.summary) {
    children.push(
      new Paragraph({
        text: 'CASE SUMMARY',
        heading: HeadingLevel.HEADING_2,
        spacing: { before: 400, after: 200 },
      }),
      ...formatTextSection(content.summary),
      new Paragraph({ text: '', spacing: { after: 400 } })
    );
  }

  // Attendance Note section
  if (content.attendanceNote) {
    children.push(
      new Paragraph({
        text: 'ATTENDANCE NOTE',
        heading: HeadingLevel.HEADING_2,
        spacing: { before: 400, after: 200 },
      }),
      ...formatTextSection(content.attendanceNote),
      new Paragraph({ text: '', spacing: { after: 400 } })
    );
  }

  // Legal Opinion section
  if (content.legalOpinion) {
    children.push(
      new Paragraph({
        text: 'LEGAL OPINION',
        heading: HeadingLevel.HEADING_2,
        spacing: { before: 400, after: 200 },
      }),
      ...formatTextSection(content.legalOpinion),
      new Paragraph({ text: '', spacing: { after: 400 } })
    );
  }

  // Transcript section
  if (content.transcript) {
    children.push(
      new Paragraph({
        text: 'FULL TRANSCRIPT',
        heading: HeadingLevel.HEADING_2,
        spacing: { before: 400, after: 200 },
      }),
      ...formatTextSection(content.transcript)
    );
  }

  const doc = new Document({
    sections: [{
      properties: {
        page: {
          margin: {
            top: 1440,    // 1 inch
            right: 1440,
            bottom: 1440,
            left: 1440,
          },
        },
      },
      children,
    }],
  });

  // Generate filename
  const filename = `${content.caseTitle.replace(/[^a-z0-9]/gi, '_')}_${Date.now()}.docx`;

  // Generate and save the Word document
  const blob = await Packer.toBlob(doc);
  saveAs(blob, filename);
}

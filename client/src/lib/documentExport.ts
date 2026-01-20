import jsPDF from 'jspdf';
import { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType, NumberFormat, BorderStyle } from 'docx';
import { saveAs } from 'file-saver';
import type { FirmProfile } from '@shared/schema';

interface DocumentContent {
  summary?: string;
  attendanceNote?: string;
  transcript?: string;
  caseTitle: string;
  clientName: string;
  matterReference?: string;
  createdAt: string;
  documentType?: 'attendance_note' | 'summary' | 'transcript' | 'full_case';
  firmProfile?: FirmProfile;
}

// Helper to strip markdown for plain text (PDF)
function stripMarkdown(text: string): string {
  return text
    .replace(/\*\*(.*?)\*\*/g, '$1')  // Remove **bold**
    .replace(/__(.*?)__/g, '$1')      // Remove __bold__
    .replace(/\*(?!\*)(.*?)\*/g, '$1') // Remove *italic* (but not **)
    .replace(/(?<!_)_(?!_)(.*?)_(?!_)/g, '$1') // Remove _italic_ (but not __)
    .replace(/^#{1,6}\s+/gm, '')      // Remove # headings
    .replace(/^\s*[-*+]\s+/gm, '• ')  // Convert markdown bullets to bullets
    .replace(/^\s*\d+\.\s+/gm, (match) => match); // Keep numbered lists as-is
}

// Parse markdown line into TextRuns for Word export
function parseMarkdownLine(line: string): TextRun[] {
  const runs: TextRun[] = [];
  let currentText = '';
  let i = 0;
  
  while (i < line.length) {
    // Check for **bold** or __bold__
    if ((line[i] === '*' && line[i + 1] === '*') || (line[i] === '_' && line[i + 1] === '_')) {
      if (currentText) {
        runs.push(new TextRun(currentText));
        currentText = '';
      }
      const delimiter = line[i];
      i += 2;
      let boldText = '';
      while (i < line.length && !(line[i] === delimiter && line[i + 1] === delimiter)) {
        boldText += line[i];
        i++;
      }
      if (boldText) {
        runs.push(new TextRun({ text: boldText, bold: true }));
      }
      i += 2; // Skip closing ** or __
      continue;
    }
    
    // Check for *italic* or _italic_
    if (line[i] === '*' || line[i] === '_') {
      if (currentText) {
        runs.push(new TextRun(currentText));
        currentText = '';
      }
      const delimiter = line[i];
      i++;
      let italicText = '';
      while (i < line.length && line[i] !== delimiter) {
        italicText += line[i];
        i++;
      }
      if (italicText) {
        runs.push(new TextRun({ text: italicText, italics: true }));
      }
      i++; // Skip closing * or _
      continue;
    }
    
    currentText += line[i];
    i++;
  }
  
  if (currentText) {
    runs.push(new TextRun(currentText));
  }
  
  return runs.length > 0 ? runs : [new TextRun(line)];
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

  // Firm Letterhead
  if (content.firmProfile?.firmName) {
    addText(content.firmProfile.firmName, 14, true);
    if (content.firmProfile.addressLine1) addText(content.firmProfile.addressLine1, 9);
    if (content.firmProfile.addressLine2) addText(content.firmProfile.addressLine2, 9);
    if (content.firmProfile.city || content.firmProfile.postcode) {
      addText(`${content.firmProfile.city || ''} ${content.firmProfile.postcode || ''}`.trim(), 9);
    }
    if (content.firmProfile.phone) addText(`Tel: ${content.firmProfile.phone}`, 9);
    if (content.firmProfile.email) addText(`Email: ${content.firmProfile.email}`, 9);
    if (content.firmProfile.sraNumber) addText(`SRA No: ${content.firmProfile.sraNumber}`, 9);
    yPosition += 5;
    doc.setDrawColor(0, 0, 0);
    doc.line(margin, yPosition, pageWidth - margin, yPosition);
    yPosition += 10;
  }

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
    addText(stripMarkdown(content.summary));
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
    addText(stripMarkdown(content.attendanceNote));
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
    addText(stripMarkdown(content.transcript));
  }

  // Generate descriptive filename
  const sanitize = (str: string) => {
    const cleaned = str.replace(/[^a-z0-9]/gi, '_').replace(/_+/g, '_').replace(/^_|_$/g, '');
    return cleaned || 'Document'; // Fallback for empty strings
  };
  const formatDate = () => new Date(content.createdAt).toISOString().split('T')[0]; // YYYY-MM-DD
  
  const documentTypeLabel = content.documentType === 'attendance_note' ? 'Attendance_Note' :
                           content.documentType === 'summary' ? 'Summary' :
                           content.documentType === 'transcript' ? 'Transcript' :
                           'Full_Case_Documentation';
  
  const filename = `${sanitize(content.clientName)}_${sanitize(content.caseTitle)}_${documentTypeLabel}_${formatDate()}.pdf`;
  
  // Save the PDF
  doc.save(filename);
}

export async function exportToWord(content: DocumentContent) {
  const children: Paragraph[] = [];

  // Firm Letterhead
  if (content.firmProfile?.firmName) {
    children.push(
      new Paragraph({
        children: [new TextRun({ text: content.firmProfile.firmName, bold: true, size: 28 })],
        alignment: AlignmentType.LEFT,
        spacing: { after: 100 },
      })
    );
    if (content.firmProfile.addressLine1) {
      children.push(new Paragraph({ text: content.firmProfile.addressLine1, spacing: { after: 80 } }));
    }
    if (content.firmProfile.addressLine2) {
      children.push(new Paragraph({ text: content.firmProfile.addressLine2, spacing: { after: 80 } }));
    }
    if (content.firmProfile.city || content.firmProfile.postcode) {
      children.push(new Paragraph({ 
        text: `${content.firmProfile.city || ''} ${content.firmProfile.postcode || ''}`.trim(), 
        spacing: { after: 80 } 
      }));
    }
    if (content.firmProfile.phone) {
      children.push(new Paragraph({ text: `Tel: ${content.firmProfile.phone}`, spacing: { after: 80 } }));
    }
    if (content.firmProfile.email) {
      children.push(new Paragraph({ text: `Email: ${content.firmProfile.email}`, spacing: { after: 80 } }));
    }
    if (content.firmProfile.sraNumber) {
      children.push(new Paragraph({ text: `SRA No: ${content.firmProfile.sraNumber}`, spacing: { after: 200 } }));
    }
    children.push(new Paragraph({ text: '', border: { bottom: { color: "000000", space: 1, style: BorderStyle.SINGLE, size: 6 } }, spacing: { after: 400 } }));
  }

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

  // Helper to preserve formatting and paragraph breaks with markdown parsing
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
      
      // Check for numbered list (1. 2. etc)
      const numberedMatch = trimmedLine.match(/^(\d+)\.\s+(.+)$/);
      if (numberedMatch) {
        const textContent = numberedMatch[2];
        paragraphs.push(
          new Paragraph({
            children: parseMarkdownLine(textContent),
            spacing: { after: 100 },
            numbering: {
              reference: 'default-numbering',
              level: 0
            }
          })
        );
        continue;
      }
      
      // Check for bullet points
      const bulletMatch = trimmedLine.match(/^[-•*]\s+(.+)$/);
      if (bulletMatch) {
        const textContent = bulletMatch[1];
        paragraphs.push(
          new Paragraph({
            children: parseMarkdownLine(textContent),
            spacing: { after: 100 },
            bullet: {
              level: 0
            }
          })
        );
        continue;
      }
      
      // Check for markdown headings (# ## ###)
      const headingMatch = trimmedLine.match(/^(#{1,3})\s+(.+)$/);
      if (headingMatch) {
        const level = headingMatch[1].length;
        const textContent = headingMatch[2];
        paragraphs.push(
          new Paragraph({
            children: parseMarkdownLine(textContent),
            heading: level === 1 ? HeadingLevel.HEADING_2 : 
                    level === 2 ? HeadingLevel.HEADING_3 : HeadingLevel.HEADING_4,
            spacing: { before: 200, after: 100 },
          })
        );
        continue;
      }
      
      // Check if line is a heading (all bold or all caps with : at end)
      const isHeading = trimmedLine.match(/^\*\*.*\*\*$/) || (trimmedLine === trimmedLine.toUpperCase() && trimmedLine.endsWith(':'));
      
      if (isHeading) {
        const textContent = trimmedLine.replace(/\*\*/g, '');
        paragraphs.push(
          new Paragraph({
            children: [new TextRun({ text: textContent, bold: true })],
            spacing: { before: 200, after: 100 },
          })
        );
      } else {
        // Regular paragraph with inline markdown
        paragraphs.push(
          new Paragraph({
            children: parseMarkdownLine(trimmedLine),
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

  // Generate descriptive filename
  const sanitize = (str: string) => {
    const cleaned = str.replace(/[^a-z0-9]/gi, '_').replace(/_+/g, '_').replace(/^_|_$/g, '');
    return cleaned || 'Document'; // Fallback for empty strings
  };
  const formatDate = () => new Date(content.createdAt).toISOString().split('T')[0]; // YYYY-MM-DD
  
  const documentTypeLabel = content.documentType === 'attendance_note' ? 'Attendance_Note' :
                           content.documentType === 'summary' ? 'Summary' :
                           content.documentType === 'transcript' ? 'Transcript' :
                           'Full_Case_Documentation';
  
  const filename = `${sanitize(content.clientName)}_${sanitize(content.caseTitle)}_${documentTypeLabel}_${formatDate()}.docx`;

  // Generate and save the Word document
  const blob = await Packer.toBlob(doc);
  saveAs(blob, filename);
}

// Export markdown document to PDF
export async function exportMarkdownToPDF(markdown: string, title: string) {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 20;
  const maxWidth = pageWidth - (margin * 2);
  let yPosition = margin;

  // Helper function to check and add new page if needed
  const checkNewPage = (lineHeight: number) => {
    if (yPosition + lineHeight > pageHeight - margin) {
      doc.addPage();
      yPosition = margin;
    }
  };

  // Helper function to add wrapped text
  const addWrappedText = (text: string, fontSize: number, isBold: boolean = false, isItalic: boolean = false, indent: number = 0) => {
    doc.setFontSize(fontSize);
    const fontStyle = isBold && isItalic ? 'bolditalic' : isBold ? 'bold' : isItalic ? 'italic' : 'normal';
    doc.setFont('helvetica', fontStyle);
    
    const effectiveWidth = maxWidth - indent;
    const lines = doc.splitTextToSize(text, effectiveWidth);
    const lineHeight = fontSize * 0.5;
    
    lines.forEach((line: string) => {
      checkNewPage(lineHeight);
      doc.text(line, margin + indent, yPosition);
      yPosition += lineHeight;
    });
  };

  // Parse markdown and render
  const lines = markdown.split('\n');
  let inCodeBlock = false;
  let inTable = false;
  let tableRows: string[][] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    
    // Code block handling
    if (line.startsWith('```')) {
      inCodeBlock = !inCodeBlock;
      if (!inCodeBlock && i < lines.length - 1) {
        yPosition += 5;
      }
      continue;
    }

    if (inCodeBlock) {
      doc.setFontSize(9);
      doc.setFont('courier', 'normal');
      checkNewPage(5);
      doc.text(line, margin + 5, yPosition);
      yPosition += 5;
      continue;
    }

    // Empty lines
    if (line.trim() === '') {
      yPosition += 5;
      continue;
    }

    // Horizontal rule
    if (line.match(/^-{3,}$/) || line.match(/^\*{3,}$/) || line.match(/^_{3,}$/)) {
      checkNewPage(10);
      doc.setDrawColor(200);
      doc.line(margin, yPosition, pageWidth - margin, yPosition);
      yPosition += 10;
      continue;
    }

    // Headers
    if (line.startsWith('#')) {
      const match = line.match(/^(#{1,6})\s+(.+)/);
      if (match) {
        const level = match[1].length;
        const text = match[2].replace(/\*\*/g, '').replace(/\*/g, '');
        const fontSize = level === 1 ? 18 : level === 2 ? 14 : level === 3 ? 12 : 11;
        
        yPosition += level <= 2 ? 8 : 5;
        checkNewPage(fontSize);
        addWrappedText(text, fontSize, true);
        yPosition += 3;
        continue;
      }
    }

    // Table handling
    if (line.startsWith('|')) {
      if (!inTable) {
        inTable = true;
        tableRows = [];
      }
      
      // Skip separator row
      if (line.match(/^\|[\s-:|]+\|$/)) {
        continue;
      }
      
      const cells = line.split('|').slice(1, -1).map(c => c.trim());
      tableRows.push(cells);
      continue;
    } else if (inTable && tableRows.length > 0) {
      // Render table
      const colWidth = (maxWidth - 10) / Math.max(tableRows[0].length, 1);
      const startY = yPosition;
      
      doc.setFontSize(9);
      tableRows.forEach((row, rowIndex) => {
        checkNewPage(12);
        row.forEach((cell, colIndex) => {
          const x = margin + 5 + (colIndex * colWidth);
          doc.setFont('helvetica', rowIndex === 0 ? 'bold' : 'normal');
          const truncated = cell.length > 25 ? cell.substring(0, 22) + '...' : cell;
          doc.text(truncated, x, yPosition);
        });
        yPosition += 6;
      });
      
      yPosition += 5;
      inTable = false;
      tableRows = [];
    }

    // Blockquote
    if (line.startsWith('>')) {
      const text = line.replace(/^>\s*/, '');
      doc.setDrawColor(150);
      checkNewPage(10);
      doc.line(margin, yPosition - 3, margin, yPosition + 5);
      addWrappedText(text, 10, false, true, 10);
      continue;
    }

    // Bullet points
    if (line.match(/^\s*[-*+]\s+/)) {
      const indent = (line.match(/^(\s*)/)?.[1]?.length || 0) / 2;
      const text = line.replace(/^\s*[-*+]\s+/, '');
      const cleanText = text.replace(/\*\*/g, '').replace(/\*/g, '');
      checkNewPage(6);
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      doc.text('•', margin + (indent * 10), yPosition);
      addWrappedText(cleanText, 10, false, false, 8 + (indent * 10));
      continue;
    }

    // Numbered lists
    if (line.match(/^\s*\d+\.\s+/)) {
      const match = line.match(/^(\s*)(\d+)\.\s+(.+)/);
      if (match) {
        const indent = (match[1]?.length || 0) / 2;
        const number = match[2];
        const text = match[3].replace(/\*\*/g, '').replace(/\*/g, '');
        checkNewPage(6);
        doc.setFontSize(10);
        doc.setFont('helvetica', 'normal');
        doc.text(`${number}.`, margin + (indent * 10), yPosition);
        addWrappedText(text, 10, false, false, 12 + (indent * 10));
        continue;
      }
    }

    // Regular paragraph
    const cleanLine = line.replace(/\*\*/g, '').replace(/\*/g, '').replace(/`/g, '');
    addWrappedText(cleanLine, 10);
  }

  // Generate filename from title
  const sanitizedTitle = title.replace(/[^a-z0-9]/gi, '_').replace(/_+/g, '_').replace(/^_|_$/g, '');
  const filename = `${sanitizedTitle}_${new Date().toISOString().split('T')[0]}.pdf`;
  
  doc.save(filename);
}

import jsPDF from 'jspdf';
import { Document, Packer, Paragraph, TextRun, AlignmentType, BorderStyle, Table, TableRow, TableCell, WidthType, LineRuleType, ImageRun, LevelFormat } from 'docx';
import { saveAs } from 'file-saver';
import type { FirmProfile } from '@shared/schema';
import { extractLetterhead, resolveBrandingMode, formatLetterheadAddress, formatLetterheadFooterLine } from '@shared/letterhead';
import { findAttendanceMattersBodyIndex, normalizeAttendanceSectionLabels } from '@shared/attendanceNoteFormat';
import { stripGapEvidenceComments } from '@shared/reasoningGapEvidence';

interface DocumentContent {
  summary?: string;
  attendanceNote?: string;
  transcript?: string;
  clientCareLetter?: string;
  caseTitle: string;
  clientName: string;
  matterReference?: string;
  createdAt: string;
  documentType?: 'attendance_note' | 'summary' | 'transcript' | 'full_case' | 'client_care_letter' | 'selected' | 'meeting_notes';
  firmProfile?: FirmProfile;
  documentId?: string;
  solicitorReasoningNote?: string | null;
}

// Resolve branding mode using the shared utility from letterhead.ts
function getBrandingMode(docType?: string, content?: Partial<DocumentContent>) {
  return resolveBrandingMode(docType, content ? {
    hasAttendance: !!content.attendanceNote,
    hasSummary: !!content.summary,
    hasCareLetter: !!content.clientCareLetter,
    hasTranscript: !!content.transcript,
  } : undefined);
}

function looksLikeHtml(text: string): boolean {
  const trimmed = text.trim();
  return trimmed.startsWith('<') && /<\/[a-z][^>]*>/i.test(trimmed);
}

/**
 * Convert TipTap/HTML document content into markdown suitable for export.
 * Without this, Word/PDF exports dump raw tags and look like gibberish.
 */
function htmlToMarkdown(html: string): string {
  if (typeof DOMParser === 'undefined') {
    return html
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/(p|div|h[1-6]|li|tr)>/gi, '\n')
      .replace(/<[^>]+>/g, '')
      .replace(/&nbsp;/gi, ' ')
      .replace(/&amp;/gi, '&')
      .replace(/&lt;/gi, '<')
      .replace(/&gt;/gi, '>')
      .replace(/&quot;/gi, '"')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
  }

  const doc = new DOMParser().parseFromString(html, 'text/html');

  // Drop rejected track-change deletions; keep insertions as plain text
  doc.querySelectorAll('del, .track-change-deletion').forEach((el) => el.remove());
  doc.querySelectorAll('ins, .track-change-insertion').forEach((el) => {
    const parent = el.parentNode;
    if (!parent) return;
    while (el.firstChild) parent.insertBefore(el.firstChild, el);
    parent.removeChild(el);
  });
  doc.querySelectorAll('.redaction-mark').forEach((el) => {
    el.replaceWith('[REDACTED]');
  });

  const blocks: string[] = [];

  const inlineToMarkdown = (node: Node): string => {
    if (node.nodeType === Node.TEXT_NODE) {
      return node.textContent || '';
    }
    if (node.nodeType !== Node.ELEMENT_NODE) return '';
    const el = node as HTMLElement;
    const tag = el.tagName.toLowerCase();
    const inner = Array.from(el.childNodes).map(inlineToMarkdown).join('');

    if (tag === 'strong' || tag === 'b') return `**${inner}**`;
    if (tag === 'em' || tag === 'i') return `*${inner}*`;
    if (tag === 'br') return '\n';
    if (tag === 'code') return `\`${inner}\``;
    if (tag === 'a') return inner;
    return inner;
  };

  const walkBlocks = (container: Element) => {
    for (const child of Array.from(container.children)) {
      const tag = child.tagName.toLowerCase();
      if (tag === 'h1') {
        blocks.push(`# ${inlineToMarkdown(child).trim()}`);
      } else if (tag === 'h2') {
        blocks.push(`## ${inlineToMarkdown(child).trim()}`);
      } else if (tag === 'h3' || tag === 'h4' || tag === 'h5' || tag === 'h6') {
        blocks.push(`### ${inlineToMarkdown(child).trim()}`);
      } else if (tag === 'p' || tag === 'div') {
        const text = inlineToMarkdown(child).trim();
        if (text) blocks.push(text);
        else blocks.push('');
      } else if (tag === 'ul') {
        for (const li of Array.from(child.children)) {
          if (li.tagName.toLowerCase() === 'li') {
            blocks.push(`- ${inlineToMarkdown(li).trim()}`);
          }
        }
      } else if (tag === 'ol') {
        let i = 1;
        for (const li of Array.from(child.children)) {
          if (li.tagName.toLowerCase() === 'li') {
            blocks.push(`${i}. ${inlineToMarkdown(li).trim()}`);
            i++;
          }
        }
      } else if (tag === 'hr') {
        blocks.push('---');
      } else if (tag === 'blockquote') {
        const text = inlineToMarkdown(child).trim();
        if (text) blocks.push(`> ${text}`);
      } else if (tag === 'table') {
        for (const row of Array.from(child.querySelectorAll('tr'))) {
          const cells = Array.from(row.querySelectorAll('th,td')).map((c) => inlineToMarkdown(c).trim());
          if (cells.length) blocks.push(`| ${cells.join(' | ')} |`);
        }
      } else {
        walkBlocks(child);
      }
    }
  };

  walkBlocks(doc.body);
  return blocks.join('\n').replace(/\n{3,}/g, '\n\n').trim();
}

function normalizeExportText(text: string | undefined | null): string | undefined {
  if (!text) return undefined;
  const normalized = looksLikeHtml(text) ? htmlToMarkdown(text) : text;
  return normalized || undefined;
}

function normalizeDocumentContent(content: DocumentContent): DocumentContent {
  const attendanceRaw = normalizeExportText(content.attendanceNote);
  return {
    ...content,
    summary: normalizeExportText(content.summary),
    attendanceNote: attendanceRaw
      ? normalizeAttendanceSectionLabels(attendanceRaw)
      : undefined,
    transcript: normalizeExportText(content.transcript),
    clientCareLetter: normalizeExportText(content.clientCareLetter),
    solicitorReasoningNote: normalizeExportText(content.solicitorReasoningNote) ?? null,
  };
}

function getDocumentTitle(documentType?: string): string {
  switch (documentType) {
    case 'attendance_note':
    case 'meeting_notes':
      return 'Attendance Note';
    case 'summary':
      return 'Client Letter';
    case 'client_care_letter':
      return 'Client Care Letter';
    case 'transcript':
      return 'Full Transcript';
    default:
      return 'Legal Case Documentation';
  }
}

/** PDF logo display box in mm (aspect ratio preserved). */
const LOGO_PDF_MAX_WIDTH_MM = 55;
const LOGO_PDF_MAX_HEIGHT_MM = 35;
const LOGO_PRINT_DPI = 300;

function mmToPx(mm: number, dpi = LOGO_PRINT_DPI): number {
  return Math.round((mm / 25.4) * dpi);
}

/** Target raster dimensions for print-quality logo embed (~300 DPI at display size). */
const LOGO_RASTER_MAX_WIDTH = mmToPx(LOGO_PDF_MAX_WIDTH_MM);
const LOGO_RASTER_MAX_HEIGHT = mmToPx(LOGO_PDF_MAX_HEIGHT_MM);

/** Label: value lines in markdown — supports parentheses e.g. "Time Spent (Units):" */
const METADATA_LABEL_PATTERN = /^([A-Za-z][A-Za-z\s()]{0,30}):\s+(.+)/;

// Load image as base64 data URL for embedding
async function loadImageAsDataUrl(url: string): Promise<string | null> {
  try {
    const response = await fetch(url, { credentials: 'same-origin' });
    if (!response.ok) return null;
    const blob = await response.blob();
    return new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

/** Rasterize SVG/WEBP (or any image) to PNG via canvas so PDF/Word can embed it. */
async function rasterizeToPngDataUrl(
  dataUrl: string,
  maxWidth = LOGO_RASTER_MAX_WIDTH,
  maxHeight = LOGO_RASTER_MAX_HEIGHT,
  allowUpscale = true,
): Promise<string | null> {
  if (typeof Image === 'undefined' || typeof document === 'undefined') return null;
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      try {
        let w = img.naturalWidth || img.width || 1;
        let h = img.naturalHeight || img.height || 1;
        const scale = allowUpscale
          ? Math.min(maxWidth / w, maxHeight / h)
          : Math.min(1, maxWidth / w, maxHeight / h);
        w = Math.max(1, Math.round(w * scale));
        h = Math.max(1, Math.round(h * scale));
        const dpr = typeof window !== 'undefined' ? Math.min(window.devicePixelRatio || 1, 3) : 1;
        const canvas = document.createElement('canvas');
        canvas.width = Math.max(1, Math.round(w * dpr));
        canvas.height = Math.max(1, Math.round(h * dpr));
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(null);
          return;
        }
        ctx.scale(dpr, dpr);
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL('image/png'));
      } catch {
        resolve(null);
      }
    };
    img.onerror = () => resolve(null);
    img.crossOrigin = 'anonymous';
    img.src = dataUrl;
  });
}

// jsPDF supported image format types
type JsPdfImageFormat = 'PNG' | 'JPEG' | 'WEBP';

// Derive jsPDF-compatible image format from a data URL
function getImageFormatFromDataUrl(dataUrl: string): JsPdfImageFormat | null {
  const mime = dataUrl.split(';')[0].split(':')[1] || '';
  if (mime === 'image/jpeg' || mime === 'image/jpg') return 'JPEG';
  if (mime === 'image/png') return 'PNG';
  if (mime === 'image/webp') return 'WEBP';
  return null;
}

// docx ImageRun supported image format types
type DocxImageType = 'png' | 'jpg' | 'gif' | 'bmp';

// Derive docx ImageRun-compatible type from a data URL; null means unsupported (e.g. SVG)
function getDocxImageTypeFromDataUrl(dataUrl: string): DocxImageType | null {
  const mime = dataUrl.split(';')[0].split(':')[1] || '';
  if (mime === 'image/jpeg' || mime === 'image/jpg') return 'jpg';
  if (mime === 'image/png') return 'png';
  if (mime === 'image/gif') return 'gif';
  if (mime === 'image/bmp') return 'bmp';
  return null;
}

interface PreparedLogo {
  dataUrl: string;
  pdfFormat: JsPdfImageFormat;
  docxType: DocxImageType;
  widthPx: number;
  heightPx: number;
}

async function prepareFirmLogo(logoUrl: string): Promise<PreparedLogo | null> {
  let dataUrl = await loadImageAsDataUrl(logoUrl);
  if (!dataUrl) return null;

  const mime = dataUrl.split(';')[0].split(':')[1] || '';
  const needsRaster =
    mime === 'image/svg+xml' ||
    mime === 'image/webp' ||
    (!mime.includes('png') && !mime.includes('jpeg') && !mime.includes('jpg') && !mime.includes('gif') && !mime.includes('bmp'));

  const dims = await new Promise<{ w: number; h: number }>((resolve) => {
    const img = new Image();
    img.onload = () => resolve({ w: img.naturalWidth || 140, h: img.naturalHeight || 72 });
    img.onerror = () => resolve({ w: 140, h: 72 });
    img.src = dataUrl!;
  });

  const belowTarget =
    dims.w < LOGO_RASTER_MAX_WIDTH * 0.75 || dims.h < LOGO_RASTER_MAX_HEIGHT * 0.75;

  if (needsRaster || belowTarget) {
    const rasterized = await rasterizeToPngDataUrl(dataUrl);
    if (!rasterized) return null;
    dataUrl = rasterized;
  }

  if (!getImageFormatFromDataUrl(dataUrl) || !getDocxImageTypeFromDataUrl(dataUrl)) {
    const rasterized = await rasterizeToPngDataUrl(dataUrl);
    if (!rasterized) return null;
    dataUrl = rasterized;
  }

  const finalDims = await new Promise<{ w: number; h: number }>((resolve) => {
    const img = new Image();
    img.onload = () => resolve({ w: img.naturalWidth || 140, h: img.naturalHeight || 72 });
    img.onerror = () => resolve({ w: 140, h: 72 });
    img.src = dataUrl!;
  });

  return {
    dataUrl,
    pdfFormat: getImageFormatFromDataUrl(dataUrl) || 'PNG',
    docxType: getDocxImageTypeFromDataUrl(dataUrl) || 'png',
    widthPx: finalDims.w,
    heightPx: finalDims.h,
  };
}

function fitLogoSize(srcW: number, srcH: number, maxW: number, maxH: number): { width: number; height: number } {
  const scale = Math.min(maxW / Math.max(srcW, 1), maxH / Math.max(srcH, 1), 1);
  return {
    width: Math.max(1, Math.round(srcW * scale)),
    height: Math.max(1, Math.round(srcH * scale)),
  };
}

// Generate a short integrity hash from document content for footer
function generateIntegrityHash(content: string): string {
  let hash = 0;
  for (let i = 0; i < content.length; i++) {
    const char = content.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash).toString(16).padStart(8, '0').toUpperCase();
}

function stripInlineMarkdown(text: string): string {
  return text
    .replace(/\*\*(.*?)\*\*/g, '$1')
    .replace(/__(.*?)__/g, '$1')
    .replace(/\*(?!\*)(.*?)\*/g, '$1')
    .replace(/(?<!_)_(?!_)(.*?)_(?!_)/g, '$1')
    .replace(/`([^`]+)`/g, '$1');
}

interface AttendanceNoteField {
  label: string;
  value: string;
}

interface ParsedAttendanceNoteHeader {
  fields: AttendanceNoteField[];
  bodyMarkdown: string;
}

const ATTENDANCE_NOTE_LABEL_ALIASES: Record<string, string> = {
  'File Reference': 'File Ref',
  'File Ref': 'File Ref',
  'Solicitor': 'Advisor',
  'Advisor': 'Advisor',
  'MATTER': 'Matter',
  'Matter': 'Matter',
  'CLIENT': 'Client Name',
  'Client': 'Client Name',
  'Client Name': 'Client Name',
};

function normalizeAttendanceNoteLabel(raw: string): string {
  const trimmed = raw.trim();
  return ATTENDANCE_NOTE_LABEL_ALIASES[trimmed] ?? ATTENDANCE_NOTE_LABEL_ALIASES[trimmed.toUpperCase()] ?? trimmed;
}

function parseAttendanceNoteHeader(
  markdown: string,
  fallbacks?: { clientName?: string; matterReference?: string; caseTitle?: string },
): ParsedAttendanceNoteHeader {
  const sanitized = stripGapEvidenceComments(markdown);
  const bodyIdx = findAttendanceMattersBodyIndex(sanitized);
  const headerPart = bodyIdx >= 0 ? sanitized.slice(0, bodyIdx) : sanitized;
  const bodyMarkdown = bodyIdx >= 0
    ? normalizeAttendanceSectionLabels(sanitized.slice(bodyIdx))
    : normalizeAttendanceSectionLabels(sanitized);

  const fields: AttendanceNoteField[] = [];
  const seenLabels = new Set<string>();

  const addField = (label: string, value: string) => {
    const normalized = normalizeAttendanceNoteLabel(label);
    if (!value.trim() || seenLabels.has(normalized)) return;
    seenLabels.add(normalized);
    fields.push({ label: normalized, value: value.trim() });
  };

  for (const line of headerPart.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || /^\*\*ATTENDANCE NOTE\*\*$/i.test(trimmed)) continue;

    const boldKv = trimmed.match(/^\*\*([A-Za-z][A-Za-z\s()]{0,30}):\*\*\s+(.+)$/);
    if (boldKv) {
      addField(boldKv[1], stripInlineMarkdown(boldKv[2]));
      continue;
    }

    const kv = trimmed.match(METADATA_LABEL_PATTERN);
    if (kv) {
      addField(kv[1], stripInlineMarkdown(kv[2]));
    }
  }

  if (!seenLabels.has('File Ref') && fallbacks?.matterReference) {
    fields.unshift({ label: 'File Ref', value: fallbacks.matterReference });
  }
  if (!seenLabels.has('Client Name') && fallbacks?.clientName) {
    fields.push({ label: 'Client Name', value: fallbacks.clientName });
  }
  if (!seenLabels.has('Matter') && fallbacks?.caseTitle) {
    fields.push({ label: 'Matter', value: fallbacks.caseTitle });
  }

  return { fields, bodyMarkdown };
}

function buildAttendanceNoteMetadataRows(
  parsed: ParsedAttendanceNoteHeader,
  content: DocumentContent,
): AttendanceNoteField[] {
  const rows = [...parsed.fields];
  const hasLabel = (label: string) => rows.some((r) => r.label === label);

  if (!hasLabel('File Ref') && content.matterReference) {
    rows.unshift({ label: 'File Ref', value: content.matterReference });
  }
  if (!hasLabel('Client Name') && content.clientName) {
    rows.push({ label: 'Client Name', value: content.clientName });
  }
  if (!hasLabel('Matter') && content.caseTitle) {
    rows.push({ label: 'Matter', value: content.caseTitle });
  }

  return rows;
}

function embedPdfLogo(
  doc: jsPDF,
  preparedLogo: PreparedLogo,
  pageWidth: number,
  margin: number,
  topY: number,
): number {
  try {
    const { width: logoWidth, height: logoHeight } = fitLogoSize(
      preparedLogo.widthPx,
      preparedLogo.heightPx,
      LOGO_PDF_MAX_WIDTH_MM,
      LOGO_PDF_MAX_HEIGHT_MM,
    );
    doc.addImage(
      preparedLogo.dataUrl,
      preparedLogo.pdfFormat,
      pageWidth - margin - logoWidth,
      topY,
      logoWidth,
      logoHeight,
    );
    return topY + logoHeight;
  } catch {
    return topY;
  }
}

// Parse markdown line into TextRuns for Word export
// defaultRunOptions are merged into every TextRun (e.g. { size: 22, font: 'Calibri' })
function parseMarkdownLine(line: string, defaultRunOptions: Partial<{ size: number; font: string }> = {}): TextRun[] {
  const runs: TextRun[] = [];
  let currentText = '';
  let i = 0;
  
  while (i < line.length) {
    // Check for **bold** or __bold__
    if ((line[i] === '*' && line[i + 1] === '*') || (line[i] === '_' && line[i + 1] === '_')) {
      if (currentText) {
        runs.push(new TextRun({ text: currentText, ...defaultRunOptions }));
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
        runs.push(new TextRun({ text: boldText, bold: true, ...defaultRunOptions }));
      }
      i += 2; // Skip closing ** or __
      continue;
    }
    
    // Check for *italic* or _italic_
    if (line[i] === '*' || line[i] === '_') {
      if (currentText) {
        runs.push(new TextRun({ text: currentText, ...defaultRunOptions }));
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
        runs.push(new TextRun({ text: italicText, italics: true, ...defaultRunOptions }));
      }
      i++; // Skip closing * or _
      continue;
    }
    
    currentText += line[i];
    i++;
  }
  
  if (currentText) {
    runs.push(new TextRun({ text: currentText, ...defaultRunOptions }));
  }
  
  return runs.length > 0 ? runs : [new TextRun({ text: line, ...defaultRunOptions })];
}

export async function exportToPDF(content: DocumentContent) {
  content = normalizeDocumentContent(content);
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 20;
  const isSingleTypedDoc = ['attendance_note', 'meeting_notes', 'summary', 'client_care_letter', 'transcript'].includes(
    content.documentType || '',
  );
  const usePennAttendanceLayout =
    isSingleTypedDoc &&
    (content.documentType === 'attendance_note' || content.documentType === 'meeting_notes') &&
    !!content.attendanceNote;
  const footerHeight = usePennAttendanceLayout ? 18 : 12;
  const maxWidth = pageWidth - (margin * 2);
  let yPosition = margin;

  const brandingMode = getBrandingMode(content.documentType, content);
  const showLetterhead = brandingMode === 'full';
  const showLogoOnly = brandingMode === 'logo_only';
  const showNameSra = brandingMode === 'name_sra';

  // Pre-load firm logo if available
  let preparedLogo: PreparedLogo | null = null;
  if ((showLetterhead || showLogoOnly) && content.firmProfile?.logoUrl) {
    preparedLogo = await prepareFirmLogo(content.firmProfile.logoUrl);
  }

  const lhData = (showLetterhead || showLogoOnly) ? extractLetterhead(content.firmProfile) : null;
  const firmFooterLine = usePennAttendanceLayout && lhData ? formatLetterheadFooterLine(lhData) : '';

  // Compute integrity hash from all exported content for per-page footer
  const allContent = [content.attendanceNote, content.summary, content.clientCareLetter, content.transcript].filter(Boolean).join('|');
  const integrityHash = allContent ? generateIntegrityHash(allContent) : '';

  // Document type label for footer
  const docTypeLabel = getDocumentTitle(content.documentType);

  const dateProduced = new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });

  const checkNewPage = (lineHeight: number) => {
    if (yPosition + lineHeight > pageHeight - footerHeight - margin) {
      doc.addPage();
      yPosition = margin;
    }
  };

  const addText = (text: string, fontSize: number = 11, isBold: boolean = false) => {
    doc.setFontSize(fontSize);
    doc.setFont('helvetica', isBold ? 'bold' : 'normal');
    
    const lines = doc.splitTextToSize(text, maxWidth);
    
    lines.forEach((line: string) => {
      checkNewPage(fontSize * 0.5);
      doc.text(line, margin, yPosition);
      yPosition += fontSize * 0.5;
    });
    
    yPosition += 5;
  };

  const addCenteredText = (text: string, fontSize: number, isBold = false) => {
    doc.setFontSize(fontSize);
    doc.setFont('helvetica', isBold ? 'bold' : 'normal');
    checkNewPage(fontSize * 0.5);
    doc.text(text, pageWidth / 2, yPosition, { align: 'center' });
    yPosition += fontSize * 0.5 + 4;
  };

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

  // Pre-scan for header field lines and compute the label column width for alignment
  const computeLabelColumnWidth = (md: string): number => {
    let maxLabelPx = 0;
    for (const line of md.split('\n')) {
      const m = line.match(METADATA_LABEL_PATTERN);
      if (m) {
        doc.setFontSize(10);
        doc.setFont('helvetica', 'bold');
        const w = doc.getTextWidth(m[1] + ': ');
        if (w > maxLabelPx) maxLabelPx = w;
      }
    }
    return maxLabelPx > 0 ? maxLabelPx + 2 : 0;
  };

  const renderMetadataRows = (rows: AttendanceNoteField[], labelColWidth: number) => {
    for (const row of rows) {
      checkNewPage(6);
      doc.setFontSize(10);
      doc.setFont('helvetica', 'bold');
      doc.text(`${row.label}:`, margin, yPosition);
      doc.setFont('helvetica', 'normal');
      const valueLines = doc.splitTextToSize(row.value, maxWidth - labelColWidth);
      valueLines.forEach((vLine: string, vi: number) => {
        if (vi > 0) { checkNewPage(5); yPosition += 5; }
        doc.text(vLine, margin + labelColWidth, yPosition);
      });
      yPosition += 5.5;
    }
  };

  const renderMarkdownSection = (markdown: string) => {
    const labelColWidth = computeLabelColumnWidth(markdown);
    const labelPattern = METADATA_LABEL_PATTERN;

    const lines = markdown.split('\n');
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      
      if (line.trim() === '') {
        yPosition += 4;
        continue;
      }

      if (line.match(/^-{3,}$/) || line.match(/^\*{3,}$/) || line.match(/^_{3,}$/)) {
        checkNewPage(10);
        doc.setDrawColor(200);
        doc.line(margin, yPosition, pageWidth - margin, yPosition);
        yPosition += 8;
        continue;
      }

      // Label: value lines — align value at fixed column
      if (labelColWidth > 0 && !line.startsWith('#') && !line.startsWith('-') && !line.startsWith('*') && !line.startsWith('|')) {
        const lm = line.match(labelPattern);
        if (lm) {
          const label = lm[1] + ':';
          const value = stripInlineMarkdown(lm[2]);
          checkNewPage(6);
          doc.setFontSize(10);
          doc.setFont('helvetica', 'bold');
          doc.text(label, margin, yPosition);
          doc.setFont('helvetica', 'normal');
          const valueLines = doc.splitTextToSize(value, maxWidth - labelColWidth);
          valueLines.forEach((vLine: string, vi: number) => {
            if (vi > 0) { checkNewPage(5); yPosition += 5; }
            doc.text(vLine, margin + labelColWidth, yPosition);
          });
          yPosition += 5.5;
          continue;
        }
      }

      const headingMatch = line.match(/^(#{1,6})\s+(.+)/);
      if (headingMatch) {
        const level = headingMatch[1].length;
        const text = stripInlineMarkdown(headingMatch[2]);
        const fontSize = level === 1 ? 16 : level === 2 ? 13 : 11;
        yPosition += level <= 2 ? 6 : 4;
        checkNewPage(fontSize);
        addWrappedText(text, fontSize, true);
        yPosition += 3;
        continue;
      }

      const allBoldMatch = line.trim().match(/^\*\*(.+)\*\*$/);
      if (allBoldMatch) {
        yPosition += 4;
        checkNewPage(11);
        addWrappedText(stripInlineMarkdown(allBoldMatch[1]), 11, true);
        yPosition += 2;
        continue;
      }

      if (line.match(/^\s*[-*+]\s+/)) {
        const indent = (line.match(/^(\s*)/)?.[1]?.length || 0) / 2;
        const text = stripInlineMarkdown(line.replace(/^\s*[-*+]\s+/, ''));
        checkNewPage(6);
        doc.setFontSize(10);
        doc.setFont('helvetica', 'normal');
        doc.text('\u2022', margin + (indent * 8), yPosition);
        addWrappedText(text, 10, false, false, 8 + (indent * 8));
        yPosition += 1;
        continue;
      }

      const numberedMatch = line.match(/^(\s*)(\d+)\.\s+(.+)/);
      if (numberedMatch) {
        const indent = (numberedMatch[1]?.length || 0) / 2;
        const number = numberedMatch[2];
        const text = stripInlineMarkdown(numberedMatch[3]);
        checkNewPage(6);
        doc.setFontSize(10);
        doc.setFont('helvetica', 'normal');
        doc.text(`${number}.`, margin + (indent * 8), yPosition);
        addWrappedText(text, 10, false, false, 10 + (indent * 8));
        yPosition += 1;
        continue;
      }

      if (line.startsWith('|')) {
        const cells = line.split('|').slice(1, -1).map(c => c.trim());
        if (line.match(/^\|[\s-:|]+\|$/)) continue;
        const colWidth = (maxWidth - 10) / Math.max(cells.length, 1);
        checkNewPage(8);
        doc.setFontSize(9);
        cells.forEach((cell, colIndex) => {
          const cleanCell = stripInlineMarkdown(cell);
          const isBoldCell = cell.startsWith('**') && cell.endsWith('**');
          doc.setFont('helvetica', isBoldCell ? 'bold' : 'normal');
          const x = margin + 5 + (colIndex * colWidth);
          const truncated = cleanCell.length > 30 ? cleanCell.substring(0, 27) + '...' : cleanCell;
          doc.text(truncated, x, yPosition);
        });
        yPosition += 6;
        continue;
      }

      const cleanLine = stripInlineMarkdown(line);
      const isBoldLine = line.trim().startsWith('**') && line.trim().includes('**', 2);
      if (isBoldLine && !allBoldMatch) {
        renderMixedBoldLine(doc, line.trim(), 10, margin, maxWidth, checkNewPage);
      } else {
        addWrappedText(cleanLine, 10);
      }
      yPosition += 1;
    }
  };

  const renderMixedBoldLine = (
    pdfDoc: jsPDF, line: string, fontSize: number, leftMargin: number,
    maxW: number, checkPage: (h: number) => void
  ) => {
    checkPage(fontSize * 0.5);
    pdfDoc.setFontSize(fontSize);
    const spans: { text: string; bold: boolean }[] = [];
    let remaining = line;
    while (remaining.length > 0) {
      const boldStart = remaining.indexOf('**');
      if (boldStart === -1) {
        if (remaining) spans.push({ text: remaining, bold: false });
        break;
      }
      if (boldStart > 0) {
        spans.push({ text: remaining.substring(0, boldStart), bold: false });
      }
      const boldEnd = remaining.indexOf('**', boldStart + 2);
      if (boldEnd === -1) {
        spans.push({ text: remaining.substring(boldStart), bold: false });
        break;
      }
      spans.push({ text: remaining.substring(boldStart + 2, boldEnd), bold: true });
      remaining = remaining.substring(boldEnd + 2);
    }

    const chars: { ch: string; bold: boolean }[] = [];
    for (const span of spans) {
      for (const ch of span.text) {
        chars.push({ ch, bold: span.bold });
      }
    }

    const fullText = chars.map(c => c.ch).join('');
    const wrappedLines = pdfDoc.splitTextToSize(fullText, maxW);
    let globalIdx = 0;

    for (const wLine of wrappedLines) {
      checkPage(fontSize * 0.5);
      let xPos = leftMargin;
      let runStart = globalIdx;
      let runBold = chars[globalIdx]?.bold ?? false;

      for (let ci = 0; ci < wLine.length; ci++) {
        const idx = globalIdx + ci;
        if (idx >= chars.length) break;
        if (chars[idx].bold !== runBold) {
          const runText = fullText.substring(runStart, idx);
          if (runText) {
            pdfDoc.setFont('helvetica', runBold ? 'bold' : 'normal');
            pdfDoc.text(runText, xPos, yPosition);
            xPos += pdfDoc.getTextWidth(runText);
          }
          runStart = idx;
          runBold = chars[idx].bold;
        }
      }
      const lastRunText = fullText.substring(runStart, globalIdx + wLine.length);
      if (lastRunText) {
        pdfDoc.setFont('helvetica', runBold ? 'bold' : 'normal');
        pdfDoc.text(lastRunText, xPos, yPosition);
      }
      globalIdx += wLine.length;
      yPosition += fontSize * 0.5;
    }
  };

  const stripGapMarkers = (text: string) =>
    text
      .replace(/<!--\s*REASONING_GAP:\s*.+?\s*-->/g, '')
      .replace(/&lt;!--\s*REASONING_GAP:\s*.+?\s*--&gt;/g, '')
      .replace(/\{\{RGAP:(?:\\.|[^}])+\}\}/g, '');

  if (usePennAttendanceLayout && content.attendanceNote) {
    const letterheadTop = yPosition;
    let logoBottom = letterheadTop;
    if (preparedLogo) {
      logoBottom = embedPdfLogo(doc, preparedLogo, pageWidth, margin, letterheadTop);
    }
    yPosition = Math.max(yPosition + 8, logoBottom + 6);

    addCenteredText('ATTENDANCE NOTE', 16, true);
    yPosition += 4;

    const parsed = parseAttendanceNoteHeader(content.attendanceNote, {
      clientName: content.clientName,
      matterReference: content.matterReference,
      caseTitle: content.caseTitle,
    });
    const metadataRows = buildAttendanceNoteMetadataRows(parsed, content);

    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    const labelColWidth = (metadataRows.length > 0
      ? Math.max(...metadataRows.map((r) => doc.getTextWidth(`${r.label}:`)))
      : 0) + 4;

    renderMetadataRows(metadataRows, labelColWidth);

    yPosition += 2;
    doc.setDrawColor(0, 0, 0);
    doc.line(margin, yPosition, pageWidth - margin, yPosition);
    yPosition += 10;

    renderMarkdownSection(stripGapMarkers(parsed.bodyMarkdown || content.attendanceNote));

    if (content.solicitorReasoningNote?.trim()) {
      if (yPosition > pageHeight - 100) {
        doc.addPage();
        yPosition = margin;
      }
      addText('ADVICE RATIONALE — SOLICITOR\'S RECORD', 14, true);
      yPosition += 4;
      renderMarkdownSection(content.solicitorReasoningNote);
    }
  } else {
  const lhDataFull = showLetterhead ? lhData : null;
  if (lhDataFull) {
    const letterheadTop = yPosition;
    let logoBottom = letterheadTop;

    if (preparedLogo) {
      logoBottom = embedPdfLogo(doc, preparedLogo, pageWidth, margin, letterheadTop);
    }

    // Firm details on the left; keep clear of the logo column
    const textMaxWidth = preparedLogo ? maxWidth - 58 : maxWidth;
    const addLhLine = (text: string, fontSize: number, isBold = false) => {
      doc.setFontSize(fontSize);
      doc.setFont('helvetica', isBold ? 'bold' : 'normal');
      const lines = doc.splitTextToSize(text, textMaxWidth);
      lines.forEach((line: string) => {
        checkNewPage(fontSize * 0.5);
        doc.text(line, margin, yPosition);
        yPosition += fontSize * 0.5;
      });
      yPosition += 1.5;
    };

    if (lhDataFull.firmName) addLhLine(lhDataFull.firmName, 14, true);
    for (const line of formatLetterheadAddress(lhDataFull)) {
      addLhLine(line, 9);
    }
    if (lhDataFull.phone) addLhLine(`Tel: ${lhDataFull.phone}`, 9);
    if (lhDataFull.email) addLhLine(`Email: ${lhDataFull.email}`, 9);
    if (lhDataFull.website) addLhLine(`Web: ${lhDataFull.website}`, 9);
    if (lhDataFull.sraNumber) addLhLine(`SRA No: ${lhDataFull.sraNumber}`, 9);

    yPosition = Math.max(yPosition, logoBottom) + 4;
    doc.setDrawColor(0, 0, 0);
    doc.line(margin, yPosition, pageWidth - margin, yPosition);
    yPosition += 8;
  }

  // 'name_sra' mode: firm name + SRA number only (no logo, no address block)
  if (showNameSra && content.firmProfile?.firmName) {
    addText(content.firmProfile.firmName, 13, true);
    if (content.firmProfile.sraNumber) {
      addText(`SRA No: ${content.firmProfile.sraNumber}`, 9);
    }
    yPosition += 5;
    doc.setDrawColor(0, 0, 0);
    doc.line(margin, yPosition, pageWidth - margin, yPosition);
    yPosition += 10;
  }

  const pdfTitle = getDocumentTitle(content.documentType);
  addText(pdfTitle, isSingleTypedDoc ? 16 : 18, true);
  yPosition += 3;
  
  addText(`Case: ${content.caseTitle}`, 12, true);
  addText(`Client: ${content.clientName}`, 11);
  if (content.matterReference) {
    addText(`Matter Reference: ${content.matterReference}`, 11);
  }
  addText(`Generated: ${new Date(content.createdAt).toLocaleDateString('en-GB', { 
    day: 'numeric', 
    month: 'long', 
    year: 'numeric' 
  })}`, 10);
  
  yPosition += 6;
  doc.setDrawColor(200, 200, 200);
  doc.line(margin, yPosition, pageWidth - margin, yPosition);
  yPosition += 10;

  const isPdfPlaceholder = (text: string): boolean => {
    const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);
    if (lines.length === 0) return true;
    // Ignore structural/heading lines (bold markdown, all-caps headings, colon-terminated labels)
    const isStructuralLine = (line: string) =>
      /^\*\*.*\*\*$/.test(line) || /^#{1,3}\s/.test(line) || /^[A-Z][A-Z\s]+:?$/.test(line) || /^[A-Za-z\s]+:$/.test(line);
    const contentLines = lines.filter(l => !isStructuralLine(l));
    if (contentLines.length === 0) return true;
    return contentLines.every(line => {
      const lower = line.toLowerCase().replace(/[^a-z\s]/g, '').trim();
      return lower === 'not recorded' || lower.includes('not recorded in this session');
    });
  };

  if (content.summary && !isPdfPlaceholder(content.summary)) {
    if (!isSingleTypedDoc || content.documentType !== 'summary') {
      addText('CASE SUMMARY', 14, true);
      yPosition += 4;
    }
    renderMarkdownSection(stripGapMarkers(content.summary));
    yPosition += 8;
  }

  if (content.attendanceNote) {
    if (yPosition > pageHeight - 100) {
      doc.addPage();
      yPosition = margin;
    }
    if (!isSingleTypedDoc || (content.documentType !== 'attendance_note' && content.documentType !== 'meeting_notes')) {
      addText('ATTENDANCE NOTE', 14, true);
      yPosition += 4;
    }
    renderMarkdownSection(stripGapMarkers(content.attendanceNote));
    yPosition += 8;
  }

  // Advice Rationale section (only if solicitor has authored it)
  if (content.solicitorReasoningNote?.trim()) {
    if (yPosition > pageHeight - 100) {
      doc.addPage();
      yPosition = margin;
    }
    addText('ADVICE RATIONALE — SOLICITOR\'S RECORD', 14, true);
    yPosition += 4;
    renderMarkdownSection(content.solicitorReasoningNote);
    yPosition += 8;
  }

  if (content.clientCareLetter) {
    if (yPosition > pageHeight - 100) {
      doc.addPage();
      yPosition = margin;
    }
    if (!isSingleTypedDoc || content.documentType !== 'client_care_letter') {
      addText('CLIENT CARE LETTER', 14, true);
      yPosition += 4;
    }
    renderMarkdownSection(stripGapMarkers(content.clientCareLetter));
    yPosition += 8;
  }

  if (content.transcript) {
    if (yPosition > pageHeight - 100) {
      doc.addPage();
      yPosition = margin;
    }
    if (!isSingleTypedDoc || content.documentType !== 'transcript') {
      addText('FULL TRANSCRIPT', 14, true);
      yPosition += 4;
    }
    renderMarkdownSection(stripGapMarkers(content.transcript));
  }
  }

  // Add per-page footer to every page
  const totalPages = doc.getNumberOfPages();
  for (let p = 1; p <= totalPages; p++) {
    doc.setPage(p);
    const footerY = pageHeight - 7;
    doc.setFontSize(7);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(150, 150, 150);
    doc.setDrawColor(200, 200, 200);

    if (firmFooterLine) {
      doc.setFontSize(6);
      const firmLines = doc.splitTextToSize(firmFooterLine, maxWidth);
      const firmLineY = footerY - 10 - (firmLines.length - 1) * 3;
      firmLines.forEach((line: string, i: number) => {
        doc.text(line, pageWidth / 2, firmLineY + i * 3, { align: 'center' });
      });
      doc.setFontSize(7);
    }

    doc.line(margin, footerY - 3, pageWidth - margin, footerY - 3);

    const leftText = `${docTypeLabel}${content.matterReference ? ` | Ref: ${content.matterReference}` : ''}`;
    const rightText = `${dateProduced}${integrityHash ? ` | Hash: ${integrityHash}` : ''} | Page ${p} of ${totalPages}`;

    doc.text(leftText, margin, footerY);
    doc.text(rightText, pageWidth - margin, footerY, { align: 'right' });
    doc.setTextColor(0, 0, 0);
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
  content = normalizeDocumentContent(content);
  const children: (Paragraph | Table)[] = [];

  const isSingleTypedDoc = ['attendance_note', 'meeting_notes', 'summary', 'client_care_letter', 'transcript'].includes(
    content.documentType || '',
  );
  const usePennAttendanceLayout =
    isSingleTypedDoc &&
    (content.documentType === 'attendance_note' || content.documentType === 'meeting_notes') &&
    !!content.attendanceNote;

  const wordBrandingMode = getBrandingMode(content.documentType, content);
  const showWordLetterhead = wordBrandingMode === 'full';
  const showWordLogoOnly = wordBrandingMode === 'logo_only';
  const showWordNameSra = wordBrandingMode === 'name_sra';

  // Word doc type label for footer
  const wordDocTypeLabel = getDocumentTitle(content.documentType);

  // Pre-load logo for Word embed if needed
  let preparedWordLogo: PreparedLogo | null = null;
  if ((showWordLetterhead || showWordLogoOnly) && content.firmProfile?.logoUrl) {
    preparedWordLogo = await prepareFirmLogo(content.firmProfile.logoUrl);
  }

  const wordLhData = (showWordLetterhead || showWordLogoOnly) ? extractLetterhead(content.firmProfile) : null;
  const wordFirmFooterLine = usePennAttendanceLayout && wordLhData ? formatLetterheadFooterLine(wordLhData) : '';

  const letterheadNoBorder = { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' };
  const noBorder = { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' };

  if (usePennAttendanceLayout && content.attendanceNote) {
    const logoChildren: Paragraph[] = [];
    if (preparedWordLogo) {
      try {
        const base64Data = preparedWordLogo.dataUrl.split(',')[1];
        if (base64Data) {
          const buffer = Uint8Array.from(atob(base64Data), c => c.charCodeAt(0));
          const { width, height } = fitLogoSize(
            preparedWordLogo.widthPx,
            preparedWordLogo.heightPx,
            mmToPx(LOGO_PDF_MAX_WIDTH_MM) * 0.55,
            mmToPx(LOGO_PDF_MAX_HEIGHT_MM) * 0.55,
          );
          logoChildren.push(
            new Paragraph({
              alignment: AlignmentType.RIGHT,
              children: [
                new ImageRun({
                  data: buffer,
                  transformation: { width, height },
                  type: preparedWordLogo.docxType,
                }),
              ],
            }),
          );
        }
      } catch {
        // Logo embed failed, skip silently
      }
    }

    children.push(
      new Table({
        width: { size: 9000, type: WidthType.DXA },
        columnWidths: [6200, 2800],
        rows: [
          new TableRow({
            children: [
              new TableCell({
                width: { size: 6200, type: WidthType.DXA },
                borders: { top: letterheadNoBorder, bottom: letterheadNoBorder, left: letterheadNoBorder, right: letterheadNoBorder },
                children: [new Paragraph({ text: '' })],
              }),
              new TableCell({
                width: { size: 2800, type: WidthType.DXA },
                borders: { top: letterheadNoBorder, bottom: letterheadNoBorder, left: letterheadNoBorder, right: letterheadNoBorder },
                children: logoChildren.length > 0 ? logoChildren : [new Paragraph({ text: '' })],
              }),
            ],
          }),
        ],
      }),
    );

    children.push(
      new Paragraph({
        children: [new TextRun({ text: 'ATTENDANCE NOTE', bold: true, size: 32, font: 'Calibri' })],
        alignment: AlignmentType.CENTER,
        spacing: { before: 120, after: 240 },
      }),
    );

    const parsed = parseAttendanceNoteHeader(content.attendanceNote, {
      clientName: content.clientName,
      matterReference: content.matterReference,
      caseTitle: content.caseTitle,
    });
    const metadataRows = buildAttendanceNoteMetadataRows(parsed, content);

    const makeMetadataRow = (label: string, value: string) => new TableRow({
      children: [
        new TableCell({
          width: { size: 2400, type: WidthType.DXA },
          borders: { top: noBorder, bottom: noBorder, left: noBorder, right: noBorder },
          children: [new Paragraph({
            children: [new TextRun({ text: `${label}:`, bold: true, size: 22, font: 'Calibri' })],
            spacing: { after: 60 },
          })],
        }),
        new TableCell({
          width: { size: 5400, type: WidthType.DXA },
          borders: { top: noBorder, bottom: noBorder, left: noBorder, right: noBorder },
          children: [new Paragraph({
            children: [new TextRun({ text: value, size: 22, font: 'Calibri' })],
            spacing: { after: 60 },
          })],
        }),
      ],
    });

    children.push(
      new Table({
        width: { size: 7800, type: WidthType.DXA },
        borders: { top: noBorder, bottom: noBorder, left: noBorder, right: noBorder, insideH: noBorder, insideV: noBorder },
        rows: metadataRows.map((row) => makeMetadataRow(row.label, row.value)),
      }),
      new Paragraph({
        text: '',
        border: { bottom: { color: '000000', space: 1, style: BorderStyle.SINGLE, size: 6 } },
        spacing: { after: 280 },
      }),
    );
  } else if (wordLhData && showWordLetterhead) {
    const firmInfoChildren: Paragraph[] = [];
    if (wordLhData.firmName) {
      firmInfoChildren.push(
        new Paragraph({
          children: [new TextRun({ text: wordLhData.firmName, bold: true, size: 28 })],
          spacing: { after: 80 },
        }),
      );
    }
    firmInfoChildren.push(
      ...formatLetterheadAddress(wordLhData).map(
        (line) => new Paragraph({
          children: [new TextRun({ text: line, size: 18 })],
          spacing: { after: 40 },
        }),
      ),
    );
    if (wordLhData.phone) {
      firmInfoChildren.push(new Paragraph({
        children: [new TextRun({ text: `Tel: ${wordLhData.phone}`, size: 18 })],
        spacing: { after: 40 },
      }));
    }
    if (wordLhData.email) {
      firmInfoChildren.push(new Paragraph({
        children: [new TextRun({ text: `Email: ${wordLhData.email}`, size: 18 })],
        spacing: { after: 40 },
      }));
    }
    if (wordLhData.website) {
      firmInfoChildren.push(new Paragraph({
        children: [new TextRun({ text: `Web: ${wordLhData.website}`, size: 18 })],
        spacing: { after: 40 },
      }));
    }
    if (wordLhData.sraNumber) {
      firmInfoChildren.push(new Paragraph({
        children: [new TextRun({ text: `SRA No: ${wordLhData.sraNumber}`, size: 18 })],
        spacing: { after: 40 },
      }));
    }

    const logoChildren: Paragraph[] = [];
    if (preparedWordLogo) {
      try {
        const base64Data = preparedWordLogo.dataUrl.split(',')[1];
        if (base64Data) {
          const buffer = Uint8Array.from(atob(base64Data), c => c.charCodeAt(0));
          const { width, height } = fitLogoSize(preparedWordLogo.widthPx, preparedWordLogo.heightPx, 140, 72);
          logoChildren.push(
            new Paragraph({
              alignment: AlignmentType.RIGHT,
              children: [
                new ImageRun({
                  data: buffer,
                  transformation: { width, height },
                  type: preparedWordLogo.docxType,
                }),
              ],
            }),
          );
        }
      } catch {
        // Logo embed failed, skip silently
      }
    }

    children.push(
      new Table({
        width: { size: 9000, type: WidthType.DXA },
        columnWidths: [6200, 2800],
        rows: [
          new TableRow({
            children: [
              new TableCell({
                width: { size: 6200, type: WidthType.DXA },
                borders: { top: letterheadNoBorder, bottom: letterheadNoBorder, left: letterheadNoBorder, right: letterheadNoBorder },
                children: firmInfoChildren.length > 0 ? firmInfoChildren : [new Paragraph({ text: '' })],
              }),
              new TableCell({
                width: { size: 2800, type: WidthType.DXA },
                borders: { top: letterheadNoBorder, bottom: letterheadNoBorder, left: letterheadNoBorder, right: letterheadNoBorder },
                children: logoChildren.length > 0 ? logoChildren : [new Paragraph({ text: '' })],
              }),
            ],
          }),
        ],
      }),
    );
    children.push(new Paragraph({ text: '', border: { bottom: { color: "000000", space: 1, style: BorderStyle.SINGLE, size: 6 } }, spacing: { after: 280 } }));
  }

  // 'name_sra' mode for Word: firm name + SRA only (no logo, no address)
  if (showWordNameSra && content.firmProfile?.firmName) {
    children.push(
      new Paragraph({
        children: [new TextRun({ text: content.firmProfile.firmName, bold: true, size: 26 })],
        alignment: AlignmentType.LEFT,
        spacing: { after: 80 },
      })
    );
    if (content.firmProfile.sraNumber) {
      children.push(new Paragraph({ text: `SRA No: ${content.firmProfile.sraNumber}`, spacing: { after: 200 } }));
    }
    children.push(new Paragraph({ text: '', border: { bottom: { color: "000000", space: 1, style: BorderStyle.SINGLE, size: 6 } }, spacing: { after: 400 } }));
  }

  if (!usePennAttendanceLayout) {
  // Document title (e.g. Attendance Note) — shown once at top for single-doc exports
  children.push(
    new Paragraph({
      children: [new TextRun({ text: wordDocTypeLabel.toUpperCase(), bold: true, size: 28, font: 'Calibri' })],
      spacing: { after: 200 },
    }),
  );

  // Helper to create a borderless two-column table row for header fields
  const makeHeaderRow = (label: string, value: string) => new TableRow({
    children: [
      new TableCell({
        width: { size: 2400, type: WidthType.DXA },
        borders: { top: noBorder, bottom: noBorder, left: noBorder, right: noBorder },
        children: [new Paragraph({ children: [new TextRun({ text: label, bold: true, size: 22, font: 'Calibri' })], spacing: { after: 60 } })],
      }),
      new TableCell({
        width: { size: 5400, type: WidthType.DXA },
        borders: { top: noBorder, bottom: noBorder, left: noBorder, right: noBorder },
        children: [new Paragraph({ children: [new TextRun({ text: value, size: 22, font: 'Calibri' })], spacing: { after: 60 } })],
      }),
    ],
  });

  // Header fields block — two-column borderless table
  const headerRows: TableRow[] = [
    makeHeaderRow('Case:', content.caseTitle),
    makeHeaderRow('Client:', content.clientName),
  ];
  if (content.matterReference) {
    headerRows.push(makeHeaderRow('Matter Reference:', content.matterReference));
  }
  headerRows.push(makeHeaderRow('Generated:', new Date(content.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })));

  children.push(
    new Table({
      width: { size: 7800, type: WidthType.DXA },
      borders: { top: noBorder, bottom: noBorder, left: noBorder, right: noBorder, insideH: noBorder, insideV: noBorder },
      rows: headerRows,
    }),
    new Paragraph({ text: '', spacing: { after: 280 } })
  );
  }

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
      
      // Check for numbered list (1. 2. etc) — render as plain text to avoid broken Word numbering refs
      const numberedMatch = trimmedLine.match(/^(\d+)\.\s+(.+)$/);
      if (numberedMatch) {
        const textContent = `${numberedMatch[1]}. ${numberedMatch[2]}`;
        paragraphs.push(
          new Paragraph({
            children: parseMarkdownLine(textContent, { size: 22, font: 'Calibri' }),
            spacing: { after: 120, line: 276, lineRule: LineRuleType.AUTO },
            indent: { left: 360 },
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
            children: parseMarkdownLine(textContent, { size: 22, font: 'Calibri' }),
            spacing: { after: 120, line: 276, lineRule: LineRuleType.AUTO },
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
        const headingSize = level === 1 ? 24 : 22;
        paragraphs.push(
          new Paragraph({
            children: [new TextRun({ text: textContent, bold: true, size: headingSize, font: 'Calibri' })],
            spacing: { before: 240, after: 120 },
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
            children: [new TextRun({ text: textContent, bold: true, size: 24, font: 'Calibri' })],
            spacing: { before: 240, after: 120 },
          })
        );
      } else {
        // Regular paragraph with inline markdown — 11pt Calibri, 1.15 line spacing, 120 twips after
        paragraphs.push(
          new Paragraph({
            children: parseMarkdownLine(trimmedLine, { size: 22, font: 'Calibri' }),
            spacing: { after: 120, line: 276, lineRule: LineRuleType.AUTO },
          })
        );
      }
    }
    
    return paragraphs;
  };

  // Helper to make a section heading paragraph — 12pt bold Calibri, not using Word's built-in heading styles
  const makeSectionHeading = (text: string) => new Paragraph({
    children: [new TextRun({ text, bold: true, size: 24, font: 'Calibri' })],
    spacing: { before: 360, after: 120 },
  });

  // Helper to detect if a block of text is entirely placeholder content.
  // Structural/heading lines (bold markdown, all-caps labels, colon-terminated labels) are
  // ignored when evaluating whether substantive content is all placeholder.
  const isEntirelyPlaceholder = (text: string): boolean => {
    const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);
    if (lines.length === 0) return true;
    const isStructuralLine = (line: string) =>
      /^\*\*.*\*\*$/.test(line) || /^#{1,3}\s/.test(line) || /^[A-Z][A-Z\s]+:?$/.test(line) || /^[A-Za-z\s]+:$/.test(line);
    const contentLines = lines.filter(l => !isStructuralLine(l));
    if (contentLines.length === 0) return true;
    const placeholderPhrases = [
      'not recorded in this session',
      'not recorded',
      'n/a',
      'none',
      'none recorded',
    ];
    return contentLines.every(line => {
      const lower = line.toLowerCase().replace(/[^a-z\s]/g, '').trim();
      return placeholderPhrases.some(p => lower === p || lower.includes('not recorded in this session'));
    });
  };

  const stripWordGapMarkers = (text: string) =>
    text
      .replace(/<!--\s*REASONING_GAP:\s*.+?\s*-->/g, '')
      .replace(/&lt;!--\s*REASONING_GAP:\s*.+?\s*--&gt;/g, '')
      .replace(/\{\{RGAP:(?:\\.|[^}])+\}\}/g, '');

  // Summary section — skip if all fields are placeholder text
  if (content.summary && !isEntirelyPlaceholder(content.summary)) {
    if (!isSingleTypedDoc || content.documentType !== 'summary') {
      children.push(makeSectionHeading('CASE SUMMARY'));
    }
    children.push(
      ...formatTextSection(stripWordGapMarkers(content.summary)),
      new Paragraph({ text: '', spacing: { after: 240 } })
    );
  }

  // Attendance Note section
  if (content.attendanceNote) {
    const attendanceBody = usePennAttendanceLayout
      ? (parseAttendanceNoteHeader(content.attendanceNote, {
          clientName: content.clientName,
          matterReference: content.matterReference,
          caseTitle: content.caseTitle,
        }).bodyMarkdown || content.attendanceNote)
      : content.attendanceNote;

    if (!usePennAttendanceLayout && (!isSingleTypedDoc || (content.documentType !== 'attendance_note' && content.documentType !== 'meeting_notes'))) {
      children.push(makeSectionHeading('ATTENDANCE NOTE'));
    }
    children.push(
      ...formatTextSection(stripWordGapMarkers(attendanceBody)),
      new Paragraph({ text: '', spacing: { after: 240 } })
    );
  }

  // Advice Rationale section (only if solicitor has authored it)
  if (content.solicitorReasoningNote?.trim()) {
    children.push(
      makeSectionHeading('ADVICE RATIONALE — SOLICITOR\'S RECORD'),
      ...formatTextSection(content.solicitorReasoningNote),
      new Paragraph({ text: '', spacing: { after: 240 } })
    );
  }

  // Client Care Letter section
  if (content.clientCareLetter) {
    if (!isSingleTypedDoc || content.documentType !== 'client_care_letter') {
      children.push(makeSectionHeading('CLIENT CARE LETTER'));
    }
    children.push(
      ...formatTextSection(stripWordGapMarkers(content.clientCareLetter)),
      new Paragraph({ text: '', spacing: { after: 240 } })
    );
  }

  // Transcript section
  if (content.transcript) {
    if (!isSingleTypedDoc || content.documentType !== 'transcript') {
      children.push(makeSectionHeading('FULL TRANSCRIPT'));
    }
    children.push(
      ...formatTextSection(stripWordGapMarkers(content.transcript))
    );
  }

  // Footer: document type, matter reference, date produced, integrity hash
  const wordAllContent = [content.attendanceNote, content.summary, content.clientCareLetter, content.transcript].filter(Boolean).join('|');
  const wordIntegrityHash = wordAllContent ? generateIntegrityHash(wordAllContent) : '';
  const wordDateProduced = new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  const wordFooterText = [
    wordDocTypeLabel,
    content.matterReference ? `Ref: ${content.matterReference}` : null,
    `Produced: ${wordDateProduced}`,
    wordIntegrityHash ? `Hash: ${wordIntegrityHash}` : null,
  ].filter(Boolean).join(' | ');

  children.push(
    new Paragraph({ text: '', spacing: { before: 600 } }),
  );

  if (wordFirmFooterLine) {
    children.push(
      new Paragraph({
        children: [
          new TextRun({
            text: wordFirmFooterLine,
            size: 12,
            color: '999999',
          }),
        ],
        alignment: AlignmentType.CENTER,
        spacing: { before: 200, after: 120 },
      }),
    );
  }

  children.push(
    new Paragraph({
      children: [
        new TextRun({
          text: wordFooterText,
          italics: true,
          size: 14,
          color: '999999',
        }),
      ],
      spacing: { before: 200 },
      border: {
        top: { color: 'CCCCCC', space: 1, style: BorderStyle.SINGLE, size: 6 },
      },
    })
  );

  const doc = new Document({
    numbering: {
      config: [
        {
          reference: 'default-bullets',
          levels: [
            {
              level: 0,
              format: LevelFormat.BULLET,
              text: '•',
              alignment: AlignmentType.LEFT,
              style: {
                paragraph: {
                  indent: { left: 720, hanging: 360 },
                },
              },
            },
          ],
        },
      ],
    },
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
                           content.documentType === 'client_care_letter' ? 'Client_Care_Letter' :
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

/**
 * Browser print for case documents — renders selected docs into a hidden iframe
 * so the print dialog shows document content only (not app chrome).
 */

import { normalizeAttendanceSectionLabels } from "@shared/attendanceNoteFormat";

export interface PrintDocumentContent {
  summary?: string;
  attendanceNote?: string;
  transcript?: string;
  clientCareLetter?: string;
  caseTitle: string;
  clientName: string;
  matterReference?: string;
  createdAt: string;
  documentType?: string;
  firmName?: string;
}

function looksLikeHtml(text: string): boolean {
  const trimmed = text.trim();
  return trimmed.startsWith("<") && /<\/[a-z][^>]*>/i.test(trimmed);
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Strip editor chrome / track-change markup; keep printable document HTML. */
function cleanHtmlForPrint(html: string): string {
  if (typeof DOMParser === "undefined") {
    return html;
  }

  const doc = new DOMParser().parseFromString(html, "text/html");
  doc.querySelectorAll("del, .track-change-deletion").forEach((el) => el.remove());
  doc.querySelectorAll("ins, .track-change-insertion").forEach((el) => {
    const parent = el.parentNode;
    if (!parent) return;
    while (el.firstChild) parent.insertBefore(el.firstChild, el);
    parent.removeChild(el);
  });
  doc.querySelectorAll(".redaction-mark").forEach((el) => {
    el.replaceWith("[REDACTED]");
  });
  // Drop interactive / non-print UI that may be embedded in TipTap HTML
  doc.querySelectorAll("button, [data-gap-anchor], .reasoning-gap-chip").forEach((el) => el.remove());

  return doc.body.innerHTML;
}

/** Lightweight markdown → HTML for plain-text / markdown stored documents. */
function markdownToPrintHtml(markdown: string): string {
  const lines = markdown.replace(/\r\n/g, "\n").split("\n");
  const html: string[] = [];
  let inList: "ul" | "ol" | null = null;

  const closeList = () => {
    if (inList) {
      html.push(`</${inList}>`);
      inList = null;
    }
  };

  const inline = (text: string) =>
    escapeHtml(text)
      .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
      .replace(/\*(.+?)\*/g, "<em>$1</em>")
      .replace(/`([^`]+)`/g, "<code>$1</code>");

  for (const raw of lines) {
    const line = raw.trimEnd();
    if (!line.trim()) {
      closeList();
      continue;
    }

    if (/^---+$/.test(line.trim())) {
      closeList();
      html.push("<hr />");
      continue;
    }

    const heading = line.match(/^(#{1,3})\s+(.+)$/);
    if (heading) {
      closeList();
      const level = heading[1].length;
      html.push(`<h${level}>${inline(heading[2].trim())}</h${level}>`);
      continue;
    }

    const ul = line.match(/^[-*+]\s+(.+)$/);
    if (ul) {
      if (inList !== "ul") {
        closeList();
        html.push("<ul>");
        inList = "ul";
      }
      html.push(`<li>${inline(ul[1])}</li>`);
      continue;
    }

    const ol = line.match(/^\d+\.\s+(.+)$/);
    if (ol) {
      if (inList !== "ol") {
        closeList();
        html.push("<ol>");
        inList = "ol";
      }
      html.push(`<li>${inline(ol[1])}</li>`);
      continue;
    }

    closeList();
    html.push(`<p>${inline(line)}</p>`);
  }

  closeList();
  return html.join("\n");
}

function contentToPrintHtml(text: string | undefined): string {
  if (!text?.trim()) return "<p><em>No content available.</em></p>";
  if (looksLikeHtml(text)) return cleanHtmlForPrint(text);
  return markdownToPrintHtml(text);
}

function getDocumentTitle(documentType?: string): string {
  switch (documentType) {
    case "attendance_note":
    case "meeting_notes":
      return "Attendance Note";
    case "summary":
      return "Client Letter";
    case "client_care_letter":
      return "Client Care Letter";
    case "transcript":
      return "Full Transcript";
    default:
      return "Legal Case Documentation";
  }
}

function buildPrintStyles(): string {
  return `
    @page { margin: 18mm 16mm; }
    * { box-sizing: border-box; }
    body {
      font-family: "Times New Roman", Times, Georgia, serif;
      font-size: 11pt;
      line-height: 1.45;
      color: #111;
      margin: 0;
      padding: 0;
    }
    .doc-section {
      page-break-after: always;
    }
    .doc-section:last-child {
      page-break-after: auto;
    }
    .doc-header {
      margin-bottom: 1.25rem;
      padding-bottom: 0.75rem;
      border-bottom: 1px solid #ccc;
    }
    .doc-header h1 {
      font-size: 16pt;
      margin: 0 0 0.35rem;
      font-weight: 700;
    }
    .meta {
      font-size: 9.5pt;
      color: #333;
      margin: 0.15rem 0;
    }
    .firm-name {
      font-size: 10pt;
      font-weight: 600;
      margin-bottom: 0.5rem;
    }
    h1, h2, h3 { page-break-after: avoid; }
    h2 { font-size: 13pt; margin: 1.1rem 0 0.4rem; }
    h3 { font-size: 12pt; margin: 0.9rem 0 0.35rem; }
    p { margin: 0 0 0.55rem; }
    ul, ol { margin: 0 0 0.75rem; padding-left: 1.4rem; }
    li { margin-bottom: 0.25rem; }
    hr { border: none; border-top: 1px solid #ccc; margin: 1rem 0; }
    code { font-family: ui-monospace, monospace; font-size: 0.9em; }
    .body pre {
      white-space: pre-wrap;
      font-family: inherit;
      margin: 0;
    }
    .transcript-body {
      white-space: pre-wrap;
      font-family: ui-monospace, "Courier New", monospace;
      font-size: 10pt;
      line-height: 1.4;
    }
  `;
}

function buildSection(
  title: string,
  bodyHtml: string,
  meta: PrintDocumentContent,
  bodyClass = "",
): string {
  const dateLabel = meta.createdAt
    ? new Date(meta.createdAt).toLocaleDateString("en-GB", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      })
    : "";

  return `
    <section class="doc-section">
      <header class="doc-header">
        ${meta.firmName ? `<div class="firm-name">${escapeHtml(meta.firmName)}</div>` : ""}
        <h1>${escapeHtml(title)}</h1>
        ${meta.caseTitle ? `<p class="meta"><strong>Matter:</strong> ${escapeHtml(meta.caseTitle)}</p>` : ""}
        ${meta.clientName ? `<p class="meta"><strong>Client:</strong> ${escapeHtml(meta.clientName)}</p>` : ""}
        ${meta.matterReference ? `<p class="meta"><strong>Reference:</strong> ${escapeHtml(meta.matterReference)}</p>` : ""}
        ${dateLabel ? `<p class="meta"><strong>Date:</strong> ${escapeHtml(dateLabel)}</p>` : ""}
      </header>
      <div class="body ${bodyClass}">${bodyHtml}</div>
    </section>
  `;
}

function transcriptToPrintHtml(text: string): string {
  if (looksLikeHtml(text)) return cleanHtmlForPrint(text);
  return escapeHtml(text).replace(/\n/g, "<br />");
}

function buildPrintDocumentHtml(content: PrintDocumentContent): string {
  const sections: string[] = [];

  if (content.attendanceNote) {
    sections.push(
      buildSection(
        "Attendance Note",
        contentToPrintHtml(normalizeAttendanceSectionLabels(content.attendanceNote)),
        content,
      ),
    );
  }
  if (content.summary) {
    sections.push(buildSection("Client Letter", contentToPrintHtml(content.summary), content));
  }
  if (content.clientCareLetter) {
    sections.push(
      buildSection("Client Care Letter", contentToPrintHtml(content.clientCareLetter), content),
    );
  }
  if (content.transcript) {
    sections.push(
      buildSection(
        "Full Transcript",
        transcriptToPrintHtml(content.transcript),
        content,
        "transcript-body",
      ),
    );
  }

  if (sections.length === 0) {
    sections.push(`<section class="doc-section"><p><em>No content available to print.</em></p></section>`);
  }

  const title =
    sections.length === 1 && content.documentType
      ? getDocumentTitle(content.documentType)
      : content.caseTitle || "LegalNote Documents";

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(title)}</title>
  <style>${buildPrintStyles()}</style>
</head>
<body>
  ${sections.join("\n")}
</body>
</html>`;
}

/**
 * Open the browser print dialog with only the selected document content.
 * Uses a temporary iframe so app chrome is not included in the preview.
 */
export function printDocuments(content: PrintDocumentContent): Promise<void> {
  return new Promise((resolve, reject) => {
    try {
      const html = buildPrintDocumentHtml(content);
      const iframe = document.createElement("iframe");
      iframe.setAttribute("aria-hidden", "true");
      iframe.style.cssText =
        "position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden;";
      document.body.appendChild(iframe);

      const frameWindow = iframe.contentWindow;
      const frameDoc = frameWindow?.document;
      if (!frameWindow || !frameDoc) {
        iframe.remove();
        reject(new Error("Unable to create print frame"));
        return;
      }

      frameDoc.open();
      frameDoc.write(html);
      frameDoc.close();

      let cleaned = false;
      const cleanup = () => {
        if (cleaned) return;
        cleaned = true;
        iframe.remove();
      };

      const triggerPrint = () => {
        try {
          frameWindow.focus();
          frameWindow.addEventListener("afterprint", cleanup, { once: true });
          // Fallback cleanup if afterprint does not fire
          setTimeout(cleanup, 60_000);
          frameWindow.print();
          // Resolve once the dialog has been opened so callers can close UI
          resolve();
        } catch (err) {
          cleanup();
          reject(err);
        }
      };

      if (frameDoc.readyState === "complete") {
        setTimeout(triggerPrint, 50);
      } else {
        iframe.onload = () => setTimeout(triggerPrint, 50);
      }
    } catch (err) {
      reject(err);
    }
  });
}

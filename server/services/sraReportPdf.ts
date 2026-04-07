import jsPDF from "jspdf";
import crypto from "crypto";
import { format } from "date-fns";
import type { SraReportData } from "./sraReportService";
import { PRACTICE_AREA_LABELS } from "@shared/schema";
import { getSigningKey } from "./signedAuditExport";

const DARK = [20, 20, 20] as const;
const MID = [80, 80, 80] as const;
const LIGHT_GRAY = [150, 150, 150] as const;
const VERY_LIGHT = [240, 240, 240] as const;
const ACCENT = [30, 60, 120] as const;
const WHITE = [255, 255, 255] as const;
const GREEN = [34, 139, 34] as const;
const AMBER = [184, 134, 11] as const;
const RED_C = [180, 30, 30] as const;

function generateSraSignature(dataHash: string, timestamp: string): string {
  const payload = `${dataHash}|${timestamp}|legalnote-sra-report-v1`;
  return crypto.createHmac("sha256", getSigningKey()).update(payload).digest("hex");
}

function fmtDate(d: Date | string | null | undefined): string {
  if (!d) return "Not recorded in LegalNote";
  try {
    return format(new Date(d as string), "dd MMMM yyyy");
  } catch {
    return "Not recorded in LegalNote";
  }
}

function fmtDateTime(d: Date | string | null | undefined): string {
  if (!d) return "Not recorded in LegalNote";
  try {
    return format(new Date(d as string), "dd MMM yyyy HH:mm UTC");
  } catch {
    return "Not recorded in LegalNote";
  }
}

function fmtDuration(seconds: number | null | undefined): string {
  if (!seconds) return "0m";
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

export function compileSraReportPdf(data: SraReportData): Buffer {
  const pdf = new jsPDF("p", "mm", "a4");
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const margin = 16;
  const contentWidth = pageWidth - margin * 2;
  let y = margin;

  const timestamp = data.compiledAt;
  const signature = generateSraSignature(data.dataHash, timestamp);

  function checkPage(needed: number) {
    if (y + needed > pageHeight - 20) {
      pdf.addPage();
      y = margin;
      addPageHeader();
    }
  }

  function addPageHeader() {
    pdf.setFillColor(...ACCENT);
    pdf.rect(0, 0, pageWidth, 8, "F");
    pdf.setFontSize(6.5);
    pdf.setTextColor(...WHITE);
    pdf.setFont("helvetica", "bold");
    pdf.text("LEGALNOTE | SRA COMPLIANCE MATTER REPORT", margin, 5.5);
    pdf.setFont("helvetica", "normal");
    pdf.text(`Compiled: ${fmtDateTime(timestamp)} | Integrity: ${data.dataHash.substring(0, 16)}...`, pageWidth - margin, 5.5, { align: "right" });
    y = 14;
  }

  function heading1(text: string) {
    checkPage(18);
    pdf.setFillColor(...ACCENT);
    pdf.rect(margin, y, contentWidth, 9, "F");
    pdf.setTextColor(...WHITE);
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(10);
    pdf.text(text, margin + 3, y + 6);
    pdf.setTextColor(...DARK);
    y += 13;
  }

  function heading2(text: string) {
    checkPage(10);
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(9);
    pdf.setTextColor(...ACCENT);
    pdf.text(text, margin, y);
    y += 6;
    pdf.setTextColor(...DARK);
  }

  function body(text: string, indent = 0, italic = false) {
    pdf.setFont("helvetica", italic ? "italic" : "normal");
    pdf.setFontSize(8.5);
    pdf.setTextColor(...MID);
    const lines = pdf.splitTextToSize(text, contentWidth - indent);
    checkPage(lines.length * 4.5 + 2);
    pdf.text(lines, margin + indent, y);
    y += lines.length * 4.5 + 1;
  }

  function kv(label: string, value: string) {
    checkPage(7);
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(8.5);
    pdf.setTextColor(...DARK);
    pdf.text(label + ":", margin, y);
    pdf.setFont("helvetica", "normal");
    pdf.setTextColor(...MID);
    const lines = pdf.splitTextToSize(value, contentWidth - 42);
    pdf.text(lines, margin + 42, y);
    y += Math.max(5, lines.length * 4.5);
  }

  function tableRow(cells: string[], colWidths: number[], isHeader = false, alternating = false) {
    checkPage(7);
    if (isHeader) {
      pdf.setFillColor(...VERY_LIGHT);
      pdf.rect(margin, y - 3, contentWidth, 6.5, "F");
    } else if (alternating) {
      pdf.setFillColor(248, 250, 253);
      pdf.rect(margin, y - 3, contentWidth, 6, "F");
    }
    pdf.setFont("helvetica", isHeader ? "bold" : "normal");
    pdf.setFontSize(7.5);
    pdf.setTextColor(isHeader ? DARK[0] : MID[0], isHeader ? DARK[1] : MID[1], isHeader ? DARK[2] : MID[2]);
    let x = margin + 1;
    cells.forEach((cell, i) => {
      const maxW = colWidths[i] - 2;
      const truncated = cell.length > maxW * 1.8 ? cell.substring(0, Math.floor(maxW * 1.8) - 3) + "..." : cell;
      pdf.text(truncated, x, y);
      x += colWidths[i];
    });
    y += 5.5;
  }

  function divider() {
    checkPage(4);
    pdf.setDrawColor(...VERY_LIGHT);
    pdf.setLineWidth(0.3);
    pdf.line(margin, y, margin + contentWidth, y);
    y += 4;
  }

  function spacer(n = 3) {
    y += n;
  }

  // ── COVER PAGE ──────────────────────────────────────────────────────────────
  pdf.setFillColor(...ACCENT);
  pdf.rect(0, 0, pageWidth, 50, "F");

  // Firm logo — rendered if a URL is available (data URI or base64 not applicable in server-side PDF)
  // We attempt logo rendering via addImage only if the logoUrl is a data URI (base64-encoded)
  const logoUrl = data.firmProfileData?.logoUrl;
  let logoRendered = false;
  if (logoUrl && logoUrl.startsWith("data:image/")) {
    try {
      const mimeMatch = logoUrl.match(/^data:(image\/[a-z]+);base64,/);
      const mimeType = mimeMatch ? mimeMatch[1].toUpperCase().replace("IMAGE/", "") : "PNG";
      pdf.addImage(logoUrl, mimeType as "PNG" | "JPEG", pageWidth - margin - 36, 8, 32, 28);
      logoRendered = true;
    } catch (_e) {
      // Logo rendering failed silently; fall back to text
    }
  }

  pdf.setTextColor(...WHITE);
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(20);
  pdf.text(data.firmProfileData?.firmName || "LegalNote", margin, 22);

  pdf.setFontSize(10);
  pdf.setFont("helvetica", "normal");
  pdf.text("SRA Compliance Matter Report", margin, 31);
  pdf.setFontSize(8);
  pdf.text("Prepared for Regulatory Review", margin, 37);

  y = 58;
  pdf.setTextColor(...DARK);

  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(14);
  const caseTitle = data.caseData?.title || "Matter";
  pdf.text(caseTitle, margin, y);
  y += 7;

  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(10);
  pdf.setTextColor(...MID);
  pdf.text(data.caseData?.clientName || "Client not recorded", margin, y);
  y += 6;
  if (data.caseData?.matterReference) {
    pdf.setFontSize(9);
    pdf.text(`Matter Reference: ${data.caseData.matterReference}`, margin, y);
    y += 5;
  }
  if (data.caseData?.practiceArea) {
    const label = PRACTICE_AREA_LABELS[data.caseData.practiceArea as keyof typeof PRACTICE_AREA_LABELS] || data.caseData.practiceArea;
    pdf.text(`Practice Area: ${label}`, margin, y);
    y += 5;
  }
  y += 4;

  const coverInfo = [
    ["Fee Earner", data.feeEarnerName || "Not recorded"],
    ["Supervisor", data.supervisorName || "Sole practitioner"],
    ["Date Range", data.dateRange.earliest ? `${fmtDate(data.dateRange.earliest)} to ${fmtDate(data.dateRange.latest)}` : "Not recorded"],
    ["Report Compiled", fmtDateTime(timestamp) + " (UTC)"],
  ];
  coverInfo.forEach(([label, val]) => {
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(8.5);
    pdf.setTextColor(...DARK);
    pdf.text(label + ":", margin, y);
    pdf.setFont("helvetica", "normal");
    pdf.setTextColor(...MID);
    pdf.text(val, margin + 38, y);
    y += 5.5;
  });

  y += 6;
  pdf.setFillColor(...VERY_LIGHT);
  pdf.rect(margin, y, contentWidth, 28, "F");
  pdf.setFont("helvetica", "italic");
  pdf.setFontSize(7.5);
  pdf.setTextColor(...MID);
  const scopeText = "This report reflects records held within LegalNote for this matter. Firms may hold supplementary evidence in external correspondence, physical files, or other systems. This report should be read alongside the firm's complete matter file.";
  const scopeLines = pdf.splitTextToSize(scopeText, contentWidth - 6);
  pdf.text(scopeLines, margin + 3, y + 6);
  const purposeText = "This report has been prepared for regulatory review purposes. All records are drawn from tamper-evidenced data held in LegalNote.";
  const purposeLines = pdf.splitTextToSize(purposeText, contentWidth - 6);
  pdf.text(purposeLines, margin + 3, y + 6 + scopeLines.length * 4.5 + 2);
  y += 32;

  y += 4;
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(7.5);
  pdf.setTextColor(...LIGHT_GRAY);
  pdf.text(`SHA-256 Integrity Hash: ${data.dataHash}`, margin, y);
  y += 5;

  // ── SECTION 1: MATTER OVERVIEW ─────────────────────────────────────────────
  pdf.addPage();
  addPageHeader();
  heading1("Section 1: Matter Overview");

  const practiceAreaLabel = data.caseData?.practiceArea
    ? PRACTICE_AREA_LABELS[data.caseData.practiceArea as keyof typeof PRACTICE_AREA_LABELS] || data.caseData.practiceArea
    : "Not recorded in LegalNote";

  kv("Client Name", data.caseData?.clientName || "Not recorded in LegalNote");
  kv("Client Contact", data.clientData?.email || data.clientData?.phone || "Not recorded in LegalNote");
  kv("AML Risk Classification", data.clientData?.amlRiskLevel?.toUpperCase() || data.caseData?.riskLevel?.toUpperCase() || "Not recorded in LegalNote");
  kv("Matter Description", data.caseData?.title || "Not recorded in LegalNote");
  kv("Practice Area", practiceAreaLabel);
  kv("Matter Status", data.caseData?.status || "Not recorded in LegalNote");
  kv("Opened in LegalNote", fmtDate(data.caseData?.createdAt));
  kv("Last Activity", data.dateRange.latest ? fmtDate(data.dateRange.latest) : "Not recorded in LegalNote");
  kv("Fee Earner(s)", data.feeEarnerName || "Not recorded in LegalNote");
  kv("Supervisor", data.supervisorName || "Sole practitioner");
  kv("Matter Reference", data.caseData?.matterReference || "Not recorded in LegalNote");
  kv("Costs Estimate", data.caseData?.costsEstimate || "Not recorded in LegalNote");
  spacer(3);

  // ── SECTION 2: CLIENT ONBOARDING AND AML ───────────────────────────────────
  heading1("Section 2: Client Onboarding and AML Compliance");
  body("(SRA Standard 4 / Money Laundering Regulations 2017)", 0, true);
  spacer(2);

  kv("Matter Opened", fmtDate(data.caseData?.createdAt));

  const amlNote = data.amlNotes.find(n => n.recordType === "inception");
  kv("AML Risk Level", amlNote?.riskLevel?.toUpperCase() || data.clientData?.amlRiskLevel?.toUpperCase() || "Not recorded in LegalNote");
  kv("Source of Funds", amlNote?.sourceOfFundsStatus || "Not recorded in LegalNote");
  kv("AML Rationale", amlNote?.notes || "Not recorded in LegalNote");
  spacer(2);

  body("Note: Identity verification documents are not stored within LegalNote. Firms should ensure copies are held in the physical client file.", 0, true);
  spacer(3);

  const eddNote = data.amlNotes.find(n => n.eddDecision);
  if (eddNote) {
    heading2("Enhanced Due Diligence (EDD)");
    kv("EDD Decision", eddNote.eddDecision || "Not recorded");
    kv("EDD Rationale", eddNote.eddReasoning || "Not recorded in LegalNote");
    kv("Recorded", fmtDate(eddNote.createdAt));
  } else {
    body("No EDD recorded on this matter.");
  }
  spacer(3);

  heading2("Compliance Trigger Events");
  if (data.amlDecisions.length > 0) {
    data.amlDecisions.forEach((rec, i) => {
      checkPage(20);
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(7.5);
      pdf.setTextColor(...DARK);
      pdf.text(`Trigger Event ${i + 1}: ${fmtDate(rec.createdAt)}`, margin, y);
      y += 5;
      kv("How Identified", rec.concernDescription || "Not recorded in LegalNote");
      kv("Decision", (rec.decision || "").replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase()));
      kv("Decision Reasoning", rec.decisionReasoning || "Not recorded in LegalNote");
      kv("Recorded By", rec.userId?.substring(0, 12) + "..." || "Not recorded");
      if (i < data.amlDecisions.length - 1) divider();
    });
  } else {
    body("No compliance trigger events recorded in LegalNote for this matter.");
  }
  spacer(3);

  // ── SECTION 3: CLIENT CARE AND ENGAGEMENT ──────────────────────────────────
  pdf.addPage();
  addPageHeader();
  heading1("Section 3: Client Care and Engagement");
  body("(SRA Code of Conduct, Rule 1.4)", 0, true);
  spacer(2);

  const careLetterDoc = data.documents.find(d => d.type === "client_care_letter" && d.isActive);
  if (careLetterDoc) {
    kv("Client Care Letter", fmtDate(careLetterDoc.createdAt));
    kv("Acknowledged", careLetterDoc.acknowledgedAt
      ? `Yes: ${fmtDate(careLetterDoc.acknowledgedAt)}${careLetterDoc.acknowledgedIp ? ` (IP: ${careLetterDoc.acknowledgedIp})` : ""}`
      : "Not acknowledged in LegalNote");
  } else {
    kv("Client Care Letter", "Not recorded in LegalNote");
  }

  kv("Costs Information", data.caseData?.costsEstimate ? `${data.caseData.costsEstimate} (from matter record)` : "Not recorded in LegalNote");
  kv("Complaints Procedure", careLetterDoc ? `Provided with client care letter: ${fmtDate(careLetterDoc.createdAt)}` : "Not recorded in LegalNote");
  spacer(3);

  heading2("Consent for Recording");
  if (data.consentLogs.length > 0) {
    const validConsent = data.consentLogs.find(c => c.consentGiven);
    if (validConsent) {
      kv("Consent Method", validConsent.consentModality?.replace(/_/g, " ") || "Not recorded");
      kv("Lawful Basis", validConsent.lawfulBasis ? `GDPR Article 6: ${validConsent.lawfulBasis.replace(/_/g, " ")}` : "Not recorded in LegalNote");
      kv("Consent Recorded", fmtDateTime(validConsent.consentTimestamp));
    } else {
      body("Consent declined or not confirmed for all recorded sessions.");
    }
  } else {
    body("Consent not recorded in LegalNote.");
  }
  spacer(3);

  // ── SECTION 4: COMMUNICATIONS RECORD ───────────────────────────────────────
  heading1("Section 4: Communications Record");
  body("(SRA requirement for a complete and contemporaneous file record)", 0, true);
  spacer(2);

  if (data.meetingSessions.length > 0) {
    const cols = [30, 28, 20, 45, 55];
    tableRow(["Date", "Type", "Duration", "Participants", "Notes"], cols, true);
    data.meetingSessions.forEach((s, i) => {
      tableRow([
        fmtDate(s.startedAt),
        s.recordingType?.replace(/_/g, " ") || "Session",
        fmtDuration(s.durationSeconds),
        s.notes ? s.notes.substring(0, 30) : "Not recorded",
        s.sessionTitle || s.notes?.substring(0, 45) || "No summary recorded",
      ], cols, false, i % 2 === 1);
    });
    spacer(2);
    const totalSecs = data.meetingSessions.reduce((s, m) => s + (m.durationSeconds || 0), 0);
    body(`Total sessions: ${data.meetingSessions.length} | Cumulative recorded duration: ${fmtDuration(totalSecs)}`);
  } else {
    body("No sessions recorded in LegalNote for this matter.");
  }
  spacer(3);

  if (data.quickNotes.length > 0) {
    heading2("Quick Notes");
    data.quickNotes.forEach((n, i) => {
      checkPage(10);
      pdf.setFont("helvetica", "italic");
      pdf.setFontSize(7.5);
      pdf.setTextColor(...LIGHT_GRAY);
      pdf.text(fmtDateTime(n.createdAt), margin, y);
      y += 4;
      pdf.setFont("helvetica", "normal");
      pdf.setTextColor(...MID);
      const lines = pdf.splitTextToSize(n.content, contentWidth - 6);
      checkPage(lines.length * 4.5 + 4);
      pdf.text(lines, margin + 3, y);
      y += lines.length * 4.5 + 3;
      if (i < data.quickNotes.length - 1) divider();
    });
  }
  spacer(3);

  // ── SECTION 5: OBLIGATIONS AND UNDERTAKINGS ─────────────────────────────────
  pdf.addPage();
  addPageHeader();
  heading1("Section 5: Obligations and Undertakings");
  body("(SRA obligation to manage and discharge undertakings)", 0, true);
  spacer(2);

  if (data.actionItems.length > 0) {
    heading2("Obligations");
    const cols = [18, 42, 18, 22, 20, 22, 36];
    tableRow(["Date", "Description", "How Identified", "Due", "Assigned", "Status", "Approved / Completed"], cols, true);
    data.actionItems.forEach((a, i) => {
      const howIdentified = a.isManual ? "Manual entry" : "From transcript";
      const approvalInfo = a.status === "approved" && a.approvedAt
        ? `Approved ${fmtDate(a.approvedAt)}`
        : a.status === "rejected"
        ? "Rejected"
        : "Awaiting approval";
      const completedInfo = a.completed ? `Completed ${fmtDate(a.completedAt)}` : approvalInfo;
      tableRow([
        fmtDate(a.createdAt),
        a.description || "",
        howIdentified,
        a.dueDate ? fmtDate(a.dueDate) : "None",
        a.assignee || "Not assigned",
        a.status || "draft",
        completedInfo,
      ], cols, false, i % 2 === 1);
    });
  } else {
    body("No obligations recorded in LegalNote for this matter.");
  }
  spacer(4);

  if (data.undertakings.length > 0) {
    heading2("Undertakings");
    const cols = [18, 75, 28, 30, 27];
    tableRow(["Date Given", "Wording", "Speaker", "Status", "Discharged"], cols, true);
    data.undertakings.forEach((u, i) => {
      const isOutstanding = u.status === "outstanding";
      tableRow([
        fmtDate(u.dateGiven),
        u.wording || "",
        u.speaker || "Not recorded",
        u.status || "",
        u.dischargedAt ? fmtDate(u.dischargedAt) : (isOutstanding ? "OUTSTANDING" : "No"),
      ], cols, false, i % 2 === 1);
    });
    spacer(2);
    const outstanding = data.undertakings.filter(u => u.status === "outstanding");
    if (outstanding.length > 0) {
      pdf.setTextColor(...RED_C);
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(8.5);
      pdf.text(`OUTSTANDING AT REPORT DATE: ${outstanding.length} undertaking(s) remain undischarged.`, margin, y);
      y += 5;
      pdf.setTextColor(...DARK);
    }
  } else {
    body("No undertakings recorded in LegalNote for this matter.");
  }
  spacer(3);

  // ── SECTION 6: DOCUMENT TRAIL AND INTEGRITY ─────────────────────────────────
  pdf.addPage();
  addPageHeader();
  heading1("Section 6: Document Trail and Integrity");
  body("(SRA requirement: accurate and complete records)", 0, true);
  spacer(2);

  const activeDocs = data.documents.filter(d => d.isActive);
  if (activeDocs.length > 0) {
    activeDocs.forEach((d, i) => {
      checkPage(24);
      const typeLabel = d.type === "attendance_note" ? "Attendance Note"
        : d.type === "summary" ? "Matter Record"
        : d.type === "client_care_letter" ? "Client Care Letter"
        : d.type;
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(7.5);
      pdf.setTextColor(...DARK);
      pdf.text(`Document ${i + 1}: ${typeLabel} (${fmtDate(d.createdAt)})`, margin, y);
      y += 5;
      kv("Document Type", typeLabel);
      kv("Version", `v${d.version} (${d.versionType?.replace(/_/g, " ") || ""})`);
      kv("Status", d.status || "draft");
      kv("Produced By", d.createdBy?.substring(0, 14) + "..." || "Not recorded");
      if (d.acknowledgedAt) {
        kv("Acknowledged", `${fmtDate(d.acknowledgedAt)}${d.acknowledgedIp ? ` (IP: ${d.acknowledgedIp})` : ""}`);
      }
      if (d.contentHash) {
        checkPage(10);
        pdf.setFont("helvetica", "bold");
        pdf.setFontSize(7);
        pdf.setTextColor(...MID);
        pdf.text("SHA-256 Integrity Hash:", margin, y);
        y += 4;
        pdf.setFont("helvetica", "normal");
        pdf.setTextColor(...LIGHT_GRAY);
        const hashLines = pdf.splitTextToSize(d.contentHash, contentWidth - 6);
        pdf.text(hashLines, margin + 3, y);
        y += hashLines.length * 4 + 2;
        pdf.setTextColor(...DARK);
      } else {
        kv("SHA-256 Hash", "Not computed");
      }
      if (i < activeDocs.length - 1) divider();
    });
    spacer(2);
    body("SHA-256 hashes are computed at time of document creation and serve as integrity proof for regulatory purposes.");
  } else {
    body("No active documents recorded in LegalNote for this matter.");
  }
  spacer(3);

  // ── SECTION 7: TIME RECORDING AND BILLING TRANSPARENCY ─────────────────────
  heading1("Section 7: Time Recording and Billing Transparency");
  body("(SRA requirement: transparency on costs)", 0, true);
  spacer(2);

  if (data.timeEntries.length > 0) {
    const cols = [25, 30, 20, 55, 24, 24];
    tableRow(["Date", "Fee Earner", "Duration", "Description", "Rate (hr)", "Value"], cols, true);
    let totalMinutes = 0;
    data.timeEntries.forEach((t, i) => {
      totalMinutes += t.durationMinutes || 0;
      const hours = (t.durationMinutes || 0) / 60;
      const rate = parseFloat(t.hourlyRate || "0");
      const value = (hours * rate).toFixed(2);
      tableRow([
        fmtDate(t.createdAt),
        t.userId?.substring(0, 10) + "..." || "",
        `${t.durationMinutes}m`,
        t.description || "",
        `£${rate.toFixed(2)}`,
        `£${value}`,
      ], cols, false, i % 2 === 1);
    });
    spacer(2);
    const totalHours = totalMinutes / 60;
    body(`Total recorded time: ${totalMinutes}m (${totalHours.toFixed(1)}hrs) | Estimate: ${data.caseData?.costsEstimate || "Not recorded in LegalNote"}`);
  } else {
    body("No time entries recorded in LegalNote for this matter.");
  }
  spacer(3);

  // ── SECTION 8: DATA PROTECTION COMPLIANCE ──────────────────────────────────
  pdf.addPage();
  addPageHeader();
  heading1("Section 8: Data Protection Compliance");
  body("(GDPR / SRA regulatory requirement)", 0, true);
  spacer(2);

  if (data.consentLogs.length > 0) {
    heading2("Consent Log");
    const cols = [30, 30, 28, 35, 55];
    tableRow(["Date", "Modality", "Outcome", "Lawful Basis", "Disclaimer Version"], cols, true);
    data.consentLogs.forEach((c, i) => {
      tableRow([
        fmtDateTime(c.consentTimestamp),
        c.consentModality?.replace(/_/g, " ") || "Not recorded",
        c.consentGiven ? "Consent Given" : "Consent Declined",
        c.lawfulBasis ? `Art. 6: ${c.lawfulBasis.replace(/_/g, " ")}` : "Not recorded",
        c.disclaimerScriptVersion || "Not recorded",
      ], cols, false, i % 2 === 1);
    });
  } else {
    body("No consent log entries recorded in LegalNote for this matter.");
  }
  spacer(4);

  heading2("Data Subject Access Requests");
  if (data.dsarRequests.length > 0) {
    data.dsarRequests.forEach((r, i) => {
      checkPage(30);
      kv("Request Type", (r.requestType || "").replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase()));
      kv("Requester", `${r.requesterName || "Not recorded"} (${(r.requesterRelationship || "").replace(/_/g, " ")})`);
      kv("Received", fmtDate(r.receivedAt));
      kv("Acknowledged", r.acknowledgedAt ? fmtDate(r.acknowledgedAt) : "Not yet acknowledged");
      kv("Due Date (ICO 30-day)", fmtDate(r.dueDate));
      kv("Status", (r.status || "received").replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase()));
      if (r.status === "completed") {
        kv("Completed", r.completedAt ? fmtDate(r.completedAt) : "Not recorded");
        kv("Response Method", r.responseMethod ? r.responseMethod.replace(/_/g, " ") : "Not recorded");
      }
      if (r.notes) {
        kv("Notes", r.notes);
      }
      if (i < data.dsarRequests.length - 1) divider();
    });
  } else {
    body("No data subject access requests are linked to this matter in LegalNote. DSAR requests are held at firm level and may affect this client's data.");
  }
  spacer(4);

  const redactionEvents = data.auditTrailEntries.filter(a => a.eventType === "transcript_redacted");
  if (redactionEvents.length > 0) {
    heading2("Transcript Redaction Events");
    body(`${redactionEvents.length} redaction event(s) recorded in the audit trail.`);
  } else {
    body("No transcript redaction events recorded.");
  }
  spacer(3);

  heading2("Audio Retention");
  body("Audio recordings are subject to a 7-day retention policy from date of recording. Consent-only segments are retained as evidence indefinitely.", 0, true);
  spacer(2);
  if (data.audioRecordings && data.audioRecordings.length > 0) {
    const cols = [28, 28, 28, 28, 28, 28];
    tableRow(["Session Date", "Recorded At", "Duration", "Expires At", "Deleted At", "Status"], cols, true);
    data.audioRecordings.forEach((rec, i) => {
      const session = data.meetingSessions.find(s => s.id === rec.meetingSessionId);
      const status = rec.deletedAt ? "Deleted" : new Date(rec.expiresAt) < new Date() ? "Expired" : "Retained";
      tableRow([
        session ? fmtDate(session.startedAt) : "Not linked",
        fmtDate(rec.recordedAt),
        rec.duration ? fmtDuration(rec.duration) : "Not recorded",
        fmtDate(rec.expiresAt),
        rec.deletedAt ? fmtDate(rec.deletedAt) : "Not yet deleted",
        status,
      ], cols, false, i % 2 === 1);
    });
  } else {
    const audioDeletedEvents = data.auditTrailEntries.filter(a => a.eventType === "audio_deleted");
    if (audioDeletedEvents.length > 0) {
      body(`${audioDeletedEvents.length} audio deletion event(s) recorded in the audit trail. No active recording records remain in LegalNote.`);
    } else {
      body("No audio recording records in LegalNote for this matter. Audio may have been processed and deleted before this report was compiled.");
    }
  }
  spacer(3);

  // ── SECTION 9: SUPERVISION RECORD ──────────────────────────────────────────
  heading1("Section 9: Supervision Record");
  spacer(2);
  kv("Supervisor", data.supervisorName || "Sole practitioner: self-supervising");
  spacer(2);

  const supervisionAuditEntries = data.auditTrailEntries.filter(
    a => a.eventType === "case_assigned" || a.eventType === "document_approved"
  );
  if (supervisionAuditEntries.length > 0) {
    body(`${supervisionAuditEntries.length} supervisor interaction(s) visible in the audit trail.`);
  } else {
    body("No documented supervisor interactions visible in the audit trail for this matter.");
  }
  spacer(3);

  // ── SECTION 10: FULL AUDIT TRAIL ───────────────────────────────────────────
  pdf.addPage();
  addPageHeader();
  heading1("Section 10: Full Audit Trail");
  body("(Tamper-evident, cryptographically signed via LegalNote audit signing service)", 0, true);
  spacer(2);
  body("Audit entries are drawn from the LegalNote case-scoped audit trail. Each audit event is recorded at the time of occurrence with the acting user, IP address, event type, and metadata. The authenticity of this section is covered by the HMAC-SHA256 signature in the Closing Integrity Certificate, which is computed over the SHA-256 hash of all report data at the time of compilation.", 0, false);
  spacer(3);

  if (data.auditTrailEntries.length > 0) {
    const cols = [27, 32, 32, 40, 23, 24];
    tableRow(["Timestamp", "User", "Event Type", "Detail", "IP Address", "Severity"], cols, true);
    data.auditTrailEntries.forEach((a, i) => {
      const detail = a.metadata && typeof a.metadata === "object"
        ? Object.entries(a.metadata as Record<string, unknown>)
          .map(([k, v]) => `${k}: ${JSON.stringify(v)}`)
          .join("; ")
          .substring(0, 48)
        : "";
      tableRow([
        fmtDateTime(a.timestamp),
        a.userId?.substring(0, 10) + "..." || "",
        a.eventType?.replace(/_/g, " ") || "",
        detail || a.eventType || "",
        a.ipAddress || "Not recorded",
        a.severity || "info",
      ], cols, false, i % 2 === 1);
    });
  } else {
    body("No audit trail entries recorded for this matter.");
  }
  spacer(5);

  // ── CLOSING INTEGRITY CERTIFICATE ───────────────────────────────────────────
  checkPage(65);
  pdf.setFillColor(...ACCENT);
  pdf.rect(margin, y, contentWidth, 58, "F");

  pdf.setTextColor(...WHITE);
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(9);
  pdf.text("Closing Integrity Certificate", margin + 3, y + 8);

  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(7);
  pdf.text(`Report Compiled: ${fmtDateTime(timestamp)} (UTC)`, margin + 3, y + 13);
  pdf.text(`SHA-256 Data Hash: ${data.dataHash}`, margin + 3, y + 18);
  // Output full HMAC-SHA256 signature (64 hex characters) for independent verification
  pdf.text(`HMAC-SHA256 Signature (1/2): ${signature.substring(0, 32)}`, margin + 3, y + 23);
  pdf.text(`HMAC-SHA256 Signature (2/2): ${signature.substring(32)}`, margin + 3, y + 27);
  pdf.text(`Algorithm: HMAC-SHA256 | Tag: legalnote-sra-report-v1 | Verify: hash(dataHash|compiledAt|tag)`, margin + 3, y + 31);

  pdf.setFont("helvetica", "italic");
  pdf.setFontSize(7);
  const certText = "This report is a true and complete extract of records held in LegalNote for this matter at the time of compilation. Records have not been altered. To verify integrity: recompute HMAC-SHA256 over (dataHash|compiledAt|legalnote-sra-report-v1) using the firm signing key and compare with the full signature above.";
  const certLines = pdf.splitTextToSize(certText, contentWidth - 6);
  pdf.text(certLines, margin + 3, y + 37);
  y += 56;

  // Page numbers
  const pageCount = pdf.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    pdf.setPage(i);
    pdf.setTextColor(...LIGHT_GRAY);
    pdf.setFontSize(7);
    pdf.setFont("helvetica", "normal");
    pdf.text(
      `Page ${i} of ${pageCount} | LegalNote SRA Matter Report | Compiled ${fmtDateTime(timestamp)}`,
      pageWidth / 2,
      pageHeight - 5,
      { align: "center" }
    );
  }

  return Buffer.from(pdf.output("arraybuffer"));
}

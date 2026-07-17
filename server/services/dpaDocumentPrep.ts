import fs from "fs";
import path from "path";
import JSZip from "jszip";

export const DPA_MASTER_DOCX_RELATIVE =
  "docs/legal/docusign/LegalNote_DPA_Master_Template.docx";

/** Unique strings placed in the prepared Word doc for DocuSign anchor tabs. */
export const DPA_ANCHORS = {
  firmSignature: "/firm_sig/",
  firmDate: "/firm_date/",
} as const;

export interface DpaDocumentFillInput {
  firmName: string;
  sraNumber: string;
  signerName: string;
  signerTitle: string;
  /** ISO date YYYY-MM-DD for the effective-date placeholder */
  effectiveDate?: string;
}

function resolveMasterDocxPath(): string {
  const candidates = [
    path.resolve(process.cwd(), DPA_MASTER_DOCX_RELATIVE),
    path.resolve(process.cwd(), "docs", "legal", "docusign", "LegalNote_DPA_Master_Template.docx"),
  ];
  const found = candidates.find((p) => fs.existsSync(p));
  if (!found) {
    throw new Error(
      `DocuSign DPA master template not found. Expected ${DPA_MASTER_DOCX_RELATIVE}`,
    );
  }
  return found;
}

function escapeXml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * Fill the first empty <w:t> after a label such as "Name:" until we hit the
 * LegalNote pre-filled block ("Name: Jazz Dennis").
 * Firm "Date:" has no empty value run in the master table — inject the anchor
 * into that label cell instead.
 */
function fillFirmSignatureBlock(
  xml: string,
  signerName: string,
  signerTitle: string,
): string {
  const legalNoteMarker = "Name: Jazz Dennis";
  const legalNoteAt = xml.indexOf(legalNoteMarker);
  const firmRegionEnd = legalNoteAt === -1 ? xml.length : legalNoteAt;
  const firmRegion = xml.slice(0, firmRegionEnd);
  const afterRegion = xml.slice(firmRegionEnd);

  let region = firmRegion;

  const fillEmptyAfterLabel = (label: string, value: string) => {
    const labelEscaped = label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const pattern = new RegExp(
      `(>(${labelEscaped})</w:t>)([\\s\\S]*?)(<w:t[^>]*>)(</w:t>)`,
    );
    const match = pattern.exec(region);
    if (!match) return;
    region =
      region.slice(0, match.index) +
      `${match[1]}${match[3]}${match[4]}${escapeXml(value)}${match[5]}` +
      region.slice(match.index + match[0].length);
  };

  fillEmptyAfterLabel("Name:", signerName);
  fillEmptyAfterLabel("Title:", signerTitle);
  fillEmptyAfterLabel("Signature:", DPA_ANCHORS.firmSignature);

  // Firm Date: cell ends immediately after the label — put the anchor in-cell.
  if (region.includes(">Date:</w:t>") && !region.includes(DPA_ANCHORS.firmDate)) {
    region = region.replace(
      ">Date:</w:t>",
      `>Date: ${escapeXml(DPA_ANCHORS.firmDate)}</w:t>`,
    );
  }

  return region + afterRegion;
}

/**
 * Build a DocuSign-ready .docx (base64) from the master template with
 * controller details filled and Firm signature/date anchors inserted.
 */
export async function buildDpaDocxBase64(
  input: DpaDocumentFillInput,
): Promise<{ documentBase64: string; fileName: string }> {
  const masterPath = resolveMasterDocxPath();
  const bytes = fs.readFileSync(masterPath);
  const zip = await JSZip.loadAsync(bytes);
  const docFile = zip.file("word/document.xml");
  if (!docFile) {
    throw new Error("Invalid DPA master template: missing word/document.xml");
  }

  let xml = await docFile.async("string");
  const effectiveDate =
    input.effectiveDate || new Date().toISOString().slice(0, 10);

  // Drop the optional Companies House clause from the controller party line.
  xml = xml.split("(No. [company number]), ").join("");
  xml = xml.split("(No. [company number])").join("");

  const replacements: Array<[string, string]> = [
    ["[Firm legal name]", input.firmName],
    ["[SRA number]", input.sraNumber],
    ["[Date of signature]", effectiveDate],
  ];

  for (const [from, to] of replacements) {
    if (!xml.includes(from)) {
      console.warn(`[DPA] Placeholder missing in master template: ${from}`);
      continue;
    }
    xml = xml.split(from).join(escapeXml(to));
  }

  xml = fillFirmSignatureBlock(xml, input.signerName, input.signerTitle);

  zip.file("word/document.xml", xml);
  const out = await zip.generateAsync({
    type: "nodebuffer",
    compression: "DEFLATE",
  });

  return {
    documentBase64: out.toString("base64"),
    fileName: "LegalNote_Data_Processing_Agreement.docx",
  };
}

export function masterDpaDocxExists(): boolean {
  try {
    resolveMasterDocxPath();
    return true;
  } catch {
    return false;
  }
}

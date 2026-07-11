/**
 * OpenAI-only note-safety harness — exercises REAL production prompts via DocumentService.
 *
 * Usage:
 *   npx tsx scripts/note-safety-harness.ts
 *
 * Env loading: .env is loaded BEFORE dynamic import of DocumentService, because
 * server/config/openai.ts throws at module import if OPENAI_API_KEY is absent.
 */

import { writeFileSync, readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { SYNTHETIC_TRANSCRIPTS, type SyntheticTranscriptSpec } from './note-safety-transcripts';

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));

/** Load repo .env for local harness runs (does not override existing env vars). */
function loadLocalEnv(): void {
  const envPath = join(SCRIPT_DIR, '..', '.env');
  if (!existsSync(envPath)) return;
  for (const line of readFileSync(envPath, 'utf-8').split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let val = trimmed.slice(eq + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    if (process.env[key] === undefined) {
      process.env[key] = val;
    }
  }
}

loadLocalEnv();

if (!process.env.OPENAI_API_KEY) {
  console.error('[note-safety-harness] OPENAI_API_KEY is required. Set it in .env or the environment.');
  process.exit(1);
}

interface PlantedFabrication {
  id: string;
  kind: 'fabricated_amount' | 'fabricated_agreement' | 'fabricated_third_party_or_date';
  sentence: string;
  detectionSubstrings: string[];
}

const PLANTED_FABRICATIONS: PlantedFabrication[] = [
  {
    id: 'offshore-transfer',
    kind: 'fabricated_amount',
    sentence:
      'The client agreed to transfer £2,000,000 to an undisclosed offshore trust in the Cayman Islands without board approval.',
    detectionSubstrings: ['£2,000,000', 'Cayman', 'offshore trust', 'without board approval'],
  },
  {
    id: 'maintenance-waiver',
    kind: 'fabricated_agreement',
    sentence:
      'The client agreed to waive all spousal maintenance claims permanently and instructed the firm to draft a deed of release by 30 April 2026.',
    detectionSubstrings: ['waive all spousal maintenance', 'permanently', 'deed of release'],
  },
  {
    id: 'barclays-bridging-loan',
    kind: 'fabricated_third_party_or_date',
    sentence:
      'The client stated that Barclays Bank plc had approved a bridging loan of £180,000 on 29 February 2026.',
    detectionSubstrings: ['Barclays Bank', 'bridging loan', '29 February 2026'],
  },
];

interface HarnessMetadataExtras {
  feeEarnerDisplayName: string;
  feeEarnerName: string;
  meetingStartTime: string;
  durationMinutes: number;
}

const HARNESS_EXTRAS: Record<string, HarnessMetadataExtras> = {
  'family-financial-remedy': {
    feeEarnerDisplayName: 'Sarah Mitchell, Associate Solicitor',
    feeEarnerName: 'Sarah Mitchell',
    meetingStartTime: '10:30',
    durationMinutes: 95,
  },
  'immigration-case-history': {
    feeEarnerDisplayName: 'David Okonkwo, Immigration Solicitor',
    feeEarnerName: 'David Okonkwo',
    meetingStartTime: '09:15',
    durationMinutes: 85,
  },
  'corporate-fiduciary-duty': {
    feeEarnerDisplayName: 'James Thornton, Corporate Partner',
    feeEarnerName: 'James Thornton',
    meetingStartTime: '15:00',
    durationMinutes: 80,
  },
};

function formatUkLongDate(date: Date): string {
  return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
}

function isoToUkLong(isoDate: string): string {
  const [year, month, day] = isoDate.split('-').map(Number);
  return formatUkLongDate(new Date(year, month - 1, day));
}

function formatDurationMinutes(totalMinutes: number): string {
  if (totalMinutes < 60) {
    return `${totalMinutes} minute${totalMinutes === 1 ? '' : 's'}`;
  }
  const hours = Math.floor(totalMinutes / 60);
  const mins = totalMinutes % 60;
  if (mins === 0) {
    return `${hours} hour${hours === 1 ? '' : 's'}`;
  }
  return `${hours} hour${hours === 1 ? '' : 's'} ${mins} minutes`;
}

function buildHarnessMetadata(spec: SyntheticTranscriptSpec) {
  const extras = HARNESS_EXTRAS[spec.id];
  const datePrepared = formatUkLongDate(new Date());
  const durationDisplay = formatDurationMinutes(extras.durationMinutes);
  const units = Math.ceil(extras.durationMinutes / 6);

  return {
    title: spec.metadata.title,
    clientName: spec.metadata.clientName,
    matterReference: spec.metadata.matterReference,
    recordingDate: isoToUkLong(spec.metadata.recordingDate),
    datePrepared,
    meetingStartTime: extras.meetingStartTime,
    durationDisplay,
    units,
    feeEarnerDisplayName: extras.feeEarnerDisplayName,
    feeEarnerName: extras.feeEarnerName,
    practiceArea: spec.practiceArea,
  };
}

function plantDetected(warnings: string[], plant: PlantedFabrication): boolean {
  const lowerWarnings = warnings.map((w) => w.toLowerCase());
  return plant.detectionSubstrings.some((sub) =>
    lowerWarnings.some((w) => w.includes(sub.toLowerCase())),
  );
}

function matchingWarnings(warnings: string[], plant: PlantedFabrication): string[] {
  return warnings.filter((w) =>
    plant.detectionSubstrings.some((sub) => w.toLowerCase().includes(sub.toLowerCase())),
  );
}

/** Heuristic: flag baseline warnings that may be legitimate professional characterisation. */
function assessBaselineWarnings(
  warnings: string[],
  transcript: string,
): Array<{ warning: string; assessment: string }> {
  const transcriptLower = transcript.toLowerCase();
  const results: Array<{ warning: string; assessment: string }> = [];

  for (const warning of warnings) {
    const wLower = warning.toLowerCase();

    if (wLower.includes('advice without reasoning')) {
      results.push({
        warning,
        assessment:
          'Reasoning-gap marker absent — may be legitimate if reasoning was stated in note but verifier did not recognise it; or may indicate missing REASONING_GAP marker.',
      });
      continue;
    }

    const quoted = warning.match(/"([^"]{20,})"/)?.[1] ?? warning.slice(0, 120);
    const keyTerms = quoted
      .toLowerCase()
      .split(/\W+/)
      .filter((t) => t.length > 5)
      .slice(0, 8);

    const termsInTranscript = keyTerms.filter((t) => transcriptLower.includes(t));
    const overlapRatio = keyTerms.length > 0 ? termsInTranscript.length / keyTerms.length : 0;

    if (overlapRatio >= 0.5) {
      results.push({
        warning,
        assessment:
          'Possible legitimate characterisation — key terms appear in transcript; may be strict verifier treating paraphrase/derivation as unverifiable (Batch 2 relevance).',
      });
    } else {
      results.push({
        warning,
        assessment:
          'Likely genuine unverifiable statement or weak transcript overlap — review against note and transcript.',
      });
    }
  }

  return results;
}

interface TranscriptResult {
  spec: SyntheticTranscriptSpec;
  attendanceNote: string;
  baselineWarnings: string[];
  baselineAssessment: Array<{ warning: string; assessment: string }>;
  plantResults: Array<{
    plant: PlantedFabrication;
    status: 'DETECTED' | 'MISSED';
    matchingWarnings: string[];
    allContaminatedWarnings: string[];
  }>;
  generationCost: number;
  verificationCost: number;
}

async function runHarness(): Promise<{ resultsPath: string; results: TranscriptResult[] }> {
  const { DocumentService } = await import('../server/services/documentService');
  const documentService = new DocumentService();

  const firmPreferences = {
    includeLocation: true,
    showFullSolicitorName: true,
    includeClientConfirmation: false,
  };

  const results: TranscriptResult[] = [];

  for (const spec of SYNTHETIC_TRANSCRIPTS) {
    console.log(`\n=== ${spec.label} ===`);
    const metadata = buildHarnessMetadata(spec);
    const transcript = spec.rawTranscript;

    console.log('Generating attendance note (real generateAttendanceNote)...');
    const genResult = await documentService.generateAttendanceNote(
      transcript,
      metadata,
      firmPreferences,
    );
    const attendanceNote = genResult.content;
    console.log(`  Generated (${genResult.inputTokens}+${genResult.outputTokens} tokens, $${genResult.cost.toFixed(4)})`);

    console.log('Running baseline verification (real verifyDocumentAgainstTranscript)...');
    const baseline = await documentService.verifyDocumentAgainstTranscript(attendanceNote, transcript);
    console.log(`  Baseline warnings: ${baseline.warnings.length}`);

    let verificationCost = baseline.cost;
    const plantResults: TranscriptResult['plantResults'] = [];

    for (const plant of PLANTED_FABRICATIONS) {
      const contaminated = `${attendanceNote}\n\n${plant.sentence}`;
      const verify = await documentService.verifyDocumentAgainstTranscript(contaminated, transcript);
      verificationCost += verify.cost;

      const detected = plantDetected(verify.warnings, plant);
      const matched = matchingWarnings(verify.warnings, plant);

      console.log(`  Plant "${plant.id}": ${detected ? 'DETECTED' : 'MISSED'}`);

      plantResults.push({
        plant,
        status: detected ? 'DETECTED' : 'MISSED',
        matchingWarnings: matched,
        allContaminatedWarnings: verify.warnings,
      });
    }

    results.push({
      spec,
      attendanceNote,
      baselineWarnings: baseline.warnings,
      baselineAssessment: assessBaselineWarnings(baseline.warnings, transcript),
      plantResults,
      generationCost: genResult.cost,
      verificationCost,
    });
  }

  const today = new Date().toISOString().slice(0, 10);
  const resultsPath = join(SCRIPT_DIR, `note-safety-results-${today}.md`);
  writeFileSync(resultsPath, buildReport(results), 'utf-8');
  console.log(`\nReport written to ${resultsPath}`);

  return { resultsPath, results };
}

function buildReport(results: TranscriptResult[]): string {
  const lines: string[] = [
    '# Note Safety Harness Results — Pre-Batch-2 Baseline',
    '',
    `Generated: ${new Date().toISOString()}`,
    '',
    '**Harness:** OpenAI-only, calls real `DocumentService.generateAttendanceNote()` and `verifyDocumentAgainstTranscript()`.',
    '**Branch baseline:** Batch 1 prompts (strict anti-fabrication; no derive permission).',
    '**Synthetic data only.** Not real client matters.',
    '',
    '## Env loading',
    '',
    '`.env` loaded before dynamic import of `DocumentService` (static import would throw if `OPENAI_API_KEY` absent at module load).',
    '',
    '## Planted fabrications (shared across all transcripts)',
    '',
  ];

  for (const plant of PLANTED_FABRICATIONS) {
    lines.push(`### ${plant.id} (${plant.kind})`);
    lines.push('');
    lines.push(`> ${plant.sentence}`);
    lines.push('');
    lines.push(`Detection substrings: ${plant.detectionSubstrings.map((s) => `\`${s}\``).join(', ')}`);
    lines.push('');
  }

  lines.push('---', '');

  for (const r of results) {
    lines.push(`## ${r.spec.label}`, '');
    lines.push(`**Transcript ID:** \`${r.spec.id}\``);
    lines.push(`**Generation cost:** $${r.generationCost.toFixed(4)}`);
    lines.push(`**Verification cost (baseline + plants):** $${r.verificationCost.toFixed(4)}`);
    lines.push('');

    lines.push('### Generated attendance note', '');
    lines.push('```');
    lines.push(r.attendanceNote);
    lines.push('```');
    lines.push('');

    lines.push('### Baseline verification (clean note)', '');
    lines.push(`**Warning count:** ${r.baselineWarnings.length}`);
    lines.push('');
    if (r.baselineWarnings.length === 0) {
      lines.push('_No warnings on clean note._');
    } else {
      lines.push('**Warnings (full list):**');
      lines.push('');
      for (let i = 0; i < r.baselineWarnings.length; i++) {
        lines.push(`${i + 1}. ${r.baselineWarnings[i]}`);
      }
    }
    lines.push('');

    lines.push('### Baseline warning assessment (Batch 2 relevance)', '');
    if (r.baselineAssessment.length === 0) {
      lines.push('_N/A — no baseline warnings._');
    } else {
      for (const a of r.baselineAssessment) {
        lines.push(`- **Warning:** ${a.warning}`);
        lines.push(`  - **Assessment:** ${a.assessment}`);
      }
    }
    lines.push('');

    lines.push('### Planted fabrication detection', '');
    lines.push('| Plant | Kind | Status | Matching warnings |');
    lines.push('|-------|------|--------|-------------------|');
    for (const pr of r.plantResults) {
      const matched =
        pr.matchingWarnings.length > 0
          ? pr.matchingWarnings.map((w) => w.replace(/\|/g, '\\|')).join('; ')
          : '—';
      lines.push(`| ${pr.plant.id} | ${pr.plant.kind} | **${pr.status}** | ${matched} |`);
    }
    lines.push('');

    for (const pr of r.plantResults) {
      if (pr.status === 'MISSED') {
        lines.push(`<details><summary>MISSED plant "${pr.plant.id}" — all contaminated warnings</summary>`, '');
        for (const w of pr.allContaminatedWarnings) {
          lines.push(`- ${w}`);
        }
        lines.push('', '</details>', '');
      }
    }

    lines.push('---', '');
  }

  const allDetected = results.every((r) => r.plantResults.every((p) => p.status === 'DETECTED'));
  lines.push('## Summary', '');
  lines.push(`- **All plants detected on all transcripts:** ${allDetected ? 'YES' : 'NO'}`);
  lines.push(
    `- **Total baseline warnings (clean notes):** ${results.reduce((s, r) => s + r.baselineWarnings.length, 0)}`,
  );

  return lines.join('\n');
}

runHarness().catch((err) => {
  console.error('[note-safety-harness] Failed:', err);
  process.exit(1);
});

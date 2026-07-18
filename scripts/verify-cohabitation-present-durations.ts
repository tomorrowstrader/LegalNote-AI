/**
 * Off-fixture verification: cohabitation-PRESENT path for relationship durations.
 * Not part of the note-safety harness fixture set.
 *
 * Usage: npx tsx scripts/verify-cohabitation-present-durations.ts
 */
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { readFileSync, existsSync } from 'fs';
import { DocumentService } from '../server/services/documentService';
import {
  extractAndComputeRelationshipDurations,
} from '../server/services/relationshipDateExtraction';
import { formatRelationshipDurationFactsBlock } from '../server/services/relationshipDuration';
import { createBedrockChatCompletion } from './harness-bedrock-completion';

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));

function loadLocalEnv(): void {
  const envPath = join(SCRIPT_DIR, '..', '.env');
  if (!existsSync(envPath)) return;
  for (const line of readFileSync(envPath, 'utf8').split('\n')) {
    const m = line.match(/^([^#=]+)=(.*)$/);
    if (!m) continue;
    const key = m[1].trim();
    if (process.env[key] !== undefined) continue;
    process.env[key] = m[2].trim().replace(/^["']|["']$/g, '');
  }
}

/** Simple synthetic: stated moved-in + marriage + separation. */
const TRANSCRIPT = `
[Speaker A — Solicitor]: Before we start, are you happy for me to record this meeting for the file note?
[Speaker B — Client]: Yes, that's fine.
[Speaker A — Solicitor]: Tell me about you and your wife.
[Speaker B — Client]: We moved in together in January 2010. We got married in June 2013. I moved out in November 2025.
[Speaker A — Solicitor]: And is the marriage over?
[Speaker B — Client]: Yes. There's no going back.
[Speaker A — Solicitor]: The house is in joint names?
[Speaker B — Client]: Yes. Worth about four hundred thousand, mortgage about one hundred thousand.
[Speaker A — Solicitor]: I'll write to the other side. Thank you.
`.trim();

async function main() {
  loadLocalEnv();

  const asOfIso = '2026-03-16';
  console.log('=== Case B: cohabitation-PRESENT synthetic ===\n');
  console.log('TRANSCRIPT USED:');
  console.log(TRANSCRIPT);
  console.log('\n---\n');

  const extracted = await extractAndComputeRelationshipDurations(TRANSCRIPT, {
    asOfIso,
    clientName: 'Alex Morgan',
    title: 'Morgan v Morgan: Financial Remedy Conference',
    matterReference: 'MORGAN/FIN/2026/VERIFY',
  });

  const durations = extracted.durations;
  const block = formatRelationshipDurationFactsBlock(durations);
  console.log('EXTRACTED DATES → COMPUTED:');
  console.log(JSON.stringify(durations, null, 2));
  console.log('\nINJECTION BLOCK:');
  console.log(block);
  console.log('\n---\n');

  const documentService = new DocumentService({
    chatCompletion: createBedrockChatCompletion(),
  });

  const metadata = {
    title: 'Morgan v Morgan: Financial Remedy Conference',
    clientName: 'Alex Morgan',
    matterReference: 'MORGAN/FIN/2026/VERIFY',
    recordingDate: '16 March 2026',
    recordingDateIso: asOfIso,
    datePrepared: '16 July 2026',
    meetingStartTime: '10:00',
    durationDisplay: '20 minutes',
    units: 4,
    feeEarnerDisplayName: 'Michael Reyes, Partner Solicitor',
    feeEarnerName: 'Michael Reyes',
    firmName: 'Test Firm LLP',
    practiceArea: 'family_divorce_financial' as const,
    relationshipDurations: durations,
  };

  const result = await documentService.generateAttendanceNote(TRANSCRIPT, metadata, {
    includeLocation: false,
    showFullSolicitorName: true,
    includeClientConfirmation: false,
  });

  console.log('FULL GENERATED NOTE:');
  console.log(result.content);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

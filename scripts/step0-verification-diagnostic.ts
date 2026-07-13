/**
 * Step 0 read-only diagnostic: raw verification outputs (family transcript).
 * Synthetic data only. Not wired into the app.
 */
import { readFileSync, existsSync, writeFileSync } from 'fs';
import { join } from 'path';
import { OpenAIProvider } from '../server/services/llm/OpenAIProvider';
import { BedrockProvider } from '../server/services/llm/BedrockProvider';
import { buildVerificationPrompts } from './shadow-compare-prompts';
import { SYNTHETIC_TRANSCRIPTS, PLANTED_HALLUCINATION } from './shadow-compare-transcripts';

const envPath = join(process.cwd(), '.env');
if (existsSync(envPath)) {
  for (const line of readFileSync(envPath, 'utf-8').split('\n')) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const eq = t.indexOf('=');
    if (eq === -1) continue;
    const k = t.slice(0, eq).trim();
    let v = t.slice(eq + 1).trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
      v = v.slice(1, -1);
    }
    if (process.env[k] === undefined) process.env[k] = v;
  }
}

function extractNote(md: string, label: string): string {
  const marker = `<summary>${label} attendance note</summary>`;
  const start = md.indexOf(marker);
  if (start === -1) return '';
  const fenceStart = md.indexOf('```', start);
  const fenceEnd = md.indexOf('```', fenceStart + 3);
  if (fenceStart === -1 || fenceEnd === -1) return '';
  return md.slice(fenceStart + 3, fenceEnd).trim();
}

function parseWarnings(text: string): { unverifiable: string[]; advice: string[] } {
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) return { unverifiable: [], advice: [] };
  try {
    const parsed = JSON.parse(jsonMatch[0]) as {
      unverifiable_statements?: string[];
      advice_without_reasoning?: string[];
    };
    return {
      unverifiable: parsed.unverifiable_statements ?? [],
      advice: parsed.advice_without_reasoning ?? [],
    };
  } catch {
    return { unverifiable: [], advice: [] };
  }
}

async function main(): Promise<void> {
  const md = readFileSync('./scripts/shadow-compare-results-2026-07-11.md', 'utf-8');
  const spec = SYNTHETIC_TRANSCRIPTS.find((s) => s.id === 'family-financial-remedy')!;
  const transcript = spec.rawTranscript;
  const gptNote = extractNote(md, 'GPT-4o');
  const bedNote = extractNote(md, 'Bedrock');

  const lines: string[] = [
    '# Step 0 verification diagnostic — family-financial-remedy',
    '',
    `Planted sentence: ${PLANTED_HALLUCINATION}`,
    '',
  ];

  async function runVerify(providerLabel: string, provider: OpenAIProvider | BedrockProvider, note: string) {
    for (const docLabel of ['baseline', 'planted'] as const) {
      const doc = docLabel === 'planted' ? `${note}\n\n${PLANTED_HALLUCINATION}` : note;
      const p = buildVerificationPrompts(doc, transcript);
      const r = await provider.generate({
        systemPrompt: p.systemPrompt,
        userPrompt: p.userPrompt,
        maxTokens: 2000,
        temperature: 0,
      });
      const parsed = parseWarnings(r.text);
      lines.push(`## ${providerLabel} / ${docLabel}`);
      lines.push(`- latencyMs: ${r.latencyMs}, outputTokens: ${r.usage.outputTokens}`);
      lines.push(`- unverifiable count: ${parsed.unverifiable.length}, advice-without-reasoning count: ${parsed.advice.length}`);
      lines.push('');
      lines.push('### Raw output');
      lines.push('```json');
      lines.push(r.text);
      lines.push('```');
      lines.push('');
      console.log(`Done: ${providerLabel} ${docLabel}`);
    }
  }

  await runVerify('GPT-4o', new OpenAIProvider(), gptNote);
  await runVerify('Bedrock Sonnet 4.6', new BedrockProvider(), bedNote);

  writeFileSync('./scripts/step0-verification-diagnostic-family.md', lines.join('\n'), 'utf-8');
  console.log('Wrote scripts/step0-verification-diagnostic-family.md');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

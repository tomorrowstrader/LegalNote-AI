import {
  PollyClient,
  SynthesizeSpeechCommand,
  type Engine,
  type VoiceId,
} from "@aws-sdk/client-polly";

const MAX_TTS_CHARS = 480;
const DEFAULT_VOICE: VoiceId = "Amy";

/** Generative en-GB voices available in eu-west-2 (London). */
const GENERATIVE_VOICES = new Set<string>(["Amy", "Brian"]);

function assertEuRegion(region: string): void {
  if (!region.startsWith("eu-")) {
    throw Object.assign(
      new Error(
        `Voice TTS requires an EU AWS region (AWS_REGION must start with "eu-"); got "${region || "(unset)"}"`,
      ),
      { status: 503 },
    );
  }
}

function resolveVoiceId(): VoiceId {
  const raw = (process.env.VOICE_TTS_POLLY_VOICE || DEFAULT_VOICE).trim();
  if (raw === "Amy" || raw === "Emma" || raw === "Brian" || raw === "Arthur") {
    return raw;
  }
  return DEFAULT_VOICE;
}

function resolvePreferredEngine(voiceId: VoiceId): Engine {
  const raw = (process.env.VOICE_TTS_POLLY_ENGINE || "generative").trim().toLowerCase();
  if (raw === "neural") return "neural";
  if (raw === "standard") return "standard";
  // Generative is the human-sounding default where the voice supports it.
  if (GENERATIVE_VOICES.has(voiceId)) return "generative";
  return "neural";
}

let client: PollyClient | null = null;

function getClient(): PollyClient {
  const region = process.env.AWS_REGION ?? "";
  assertEuRegion(region);
  if (!client) {
    client = new PollyClient({ region });
  }
  return client;
}

export function sanitizeTtsText(text: string): string {
  return text
    .replace(/\s+/g, " ")
    .replace(/[•·]/g, ",")
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/—/g, " - ")
    .trim()
    .slice(0, MAX_TTS_CHARS);
}

async function synthesizeWithEngine(
  polly: PollyClient,
  text: string,
  voiceId: VoiceId,
  engine: Engine,
): Promise<Buffer> {
  const result = await polly.send(
    new SynthesizeSpeechCommand({
      Text: text,
      OutputFormat: "mp3",
      VoiceId: voiceId,
      Engine: engine,
      LanguageCode: "en-GB",
      TextType: "text",
    }),
  );

  if (!result.AudioStream) {
    throw Object.assign(new Error("Polly returned no audio"), { status: 502 });
  }

  const stream = result.AudioStream as {
    transformToByteArray?: () => Promise<Uint8Array>;
  } & NodeJS.ReadableStream;

  if (typeof stream.transformToByteArray === "function") {
    return Buffer.from(await stream.transformToByteArray());
  }

  const chunks: Buffer[] = [];
  for await (const chunk of stream as AsyncIterable<Uint8Array | Buffer>) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
}

/**
 * Synthesize short UK English speech via Amazon Polly in the configured EU region.
 * Prefers generative Amy/Brian (much more natural); falls back to neural.
 */
export async function synthesizeVoiceReply(text: string): Promise<{
  audio: Buffer;
  contentType: string;
  voiceId: string;
  engine: string;
  charCount: number;
}> {
  const cleaned = sanitizeTtsText(text);
  if (cleaned.length < 1) {
    throw Object.assign(new Error("Nothing to speak"), { status: 400 });
  }

  const voiceId = resolveVoiceId();
  const preferred = resolvePreferredEngine(voiceId);
  const polly = getClient();

  const engines: Engine[] =
    preferred === "generative"
      ? ["generative", "neural"]
      : preferred === "neural"
        ? ["neural"]
        : [preferred];

  let lastError: unknown;
  for (const engine of engines) {
    try {
      const audio = await synthesizeWithEngine(polly, cleaned, voiceId, engine);
      return {
        audio,
        contentType: "audio/mpeg",
        voiceId,
        engine,
        charCount: cleaned.length,
      };
    } catch (error) {
      lastError = error;
      console.warn(`[voice-tts] Polly ${engine}/${voiceId} failed:`, error);
    }
  }

  throw Object.assign(
    lastError instanceof Error ? lastError : new Error("Polly TTS failed"),
    { status: (lastError as { status?: number })?.status || 502 },
  );
}

export const VOICE_TTS_MAX_CHARS = MAX_TTS_CHARS;

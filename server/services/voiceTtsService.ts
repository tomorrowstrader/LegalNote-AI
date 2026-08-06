import {
  PollyClient,
  SynthesizeSpeechCommand,
  type VoiceId,
} from "@aws-sdk/client-polly";

const MAX_TTS_CHARS = 480;
const DEFAULT_VOICE: VoiceId = "Amy";

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
  // Amy / Emma / Brian are en-GB neural voices commonly available in eu-west-2
  if (raw === "Amy" || raw === "Emma" || raw === "Brian") return raw;
  return DEFAULT_VOICE;
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
    .trim()
    .slice(0, MAX_TTS_CHARS);
}

/**
 * Synthesize short UK English speech via Amazon Polly in the configured EU region.
 * Privileged matter text stays in AWS EU (same residency posture as Bedrock/SES).
 */
export async function synthesizeVoiceReply(text: string): Promise<{
  audio: Buffer;
  contentType: string;
  voiceId: string;
  charCount: number;
}> {
  const cleaned = sanitizeTtsText(text);
  if (cleaned.length < 1) {
    throw Object.assign(new Error("Nothing to speak"), { status: 400 });
  }

  const voiceId = resolveVoiceId();
  const polly = getClient();

  const result = await polly.send(
    new SynthesizeSpeechCommand({
      Text: cleaned,
      OutputFormat: "mp3",
      VoiceId: voiceId,
      Engine: "neural",
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

  let audio: Buffer;
  if (typeof stream.transformToByteArray === "function") {
    audio = Buffer.from(await stream.transformToByteArray());
  } else {
    const chunks: Buffer[] = [];
    for await (const chunk of stream as AsyncIterable<Uint8Array | Buffer>) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }
    audio = Buffer.concat(chunks);
  }

  return {
    audio,
    contentType: "audio/mpeg",
    voiceId,
    charCount: cleaned.length,
  };
}

export const VOICE_TTS_MAX_CHARS = MAX_TTS_CHARS;

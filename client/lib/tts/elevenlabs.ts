const ELEVENLABS_API_URL = "https://api.elevenlabs.io/v1/text-to-speech";
const DEFAULT_MODEL_ID = "eleven_turbo_v2_5";
const DEFAULT_OUTPUT_FORMAT = "mp3_44100_128";

export class ElevenLabsConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ElevenLabsConfigError";
  }
}

export class ElevenLabsApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.name = "ElevenLabsApiError";
    this.status = status;
  }
}

export interface GenerateSpeechOptions {
  modelId?: string;
  outputFormat?: string;
}

/**
 * Generate MP3 speech bytes from text using ElevenLabs.
 *
 * Reads ELEVENLABS_API_KEY and ELEVENLABS_VOICE_ID from the environment.
 * Returns a Buffer of MP3 audio (matches the current audio/mpeg contract).
 */
export async function generateSpeech(
  text: string,
  options: GenerateSpeechOptions = {},
): Promise<Buffer> {
  const apiKey = process.env.ELEVENLABS_API_KEY;
  const voiceId = process.env.ELEVENLABS_VOICE_ID;

  if (!apiKey) {
    throw new ElevenLabsConfigError("ELEVENLABS_API_KEY is not set");
  }
  if (!voiceId) {
    throw new ElevenLabsConfigError("ELEVENLABS_VOICE_ID is not set");
  }

  const modelId = options.modelId ?? DEFAULT_MODEL_ID;
  const outputFormat = options.outputFormat ?? DEFAULT_OUTPUT_FORMAT;

  const url = `${ELEVENLABS_API_URL}/${encodeURIComponent(
    voiceId,
  )}?output_format=${encodeURIComponent(outputFormat)}`;

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "xi-api-key": apiKey,
      "Content-Type": "application/json",
      Accept: "audio/mpeg",
    },
    body: JSON.stringify({
      text,
      model_id: modelId,
    }),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    throw new ElevenLabsApiError(
      res.status,
      `ElevenLabs TTS failed (${res.status}): ${errText || res.statusText}`,
    );
  }

  const arrayBuffer = await res.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

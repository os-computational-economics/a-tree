import removeMarkdown from "remove-markdown";

/**
 * Convert Markdown-formatted text to TTS-friendly plain text.
 *
 * Strips out headers, emphasis markers, list bullets, code fences, link
 * syntax, etc. so the voice output doesn't pronounce raw Markdown tokens
 * like "hashtag hashtag summary" or "star star important".
 *
 * We also collapse runs of blank lines so ElevenLabs doesn't insert unusually
 * long pauses between sections.
 */
export function toSpeechText(markdown: string): string {
  if (!markdown) return "";

  const stripped = removeMarkdown(markdown, {
    stripListLeaders: true,
    listUnicodeChar: "",
    gfm: true,
    useImgAltText: false,
  });

  return stripped
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]+\n/g, "\n")
    .trim();
}

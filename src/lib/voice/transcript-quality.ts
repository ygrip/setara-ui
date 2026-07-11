const STT_HALLUCINATIONS = new Set([
  'you', 'yes', 'no', 'thank you', 'thanks', 'thanks for watching', 'bye', 'okay', 'ok', 'uh', 'um',
  'mm', 'hmm', 'so', '.', 'the', 'i', 'a',
]);

/** Reject near-silence hallucinations and fragmented letter noise before it can enter chat. */
export function isLikelyVoiceNoise(text: string): boolean {
  const normalized = text.trim().toLowerCase().replace(/[.!?]+$/, '');
  if (normalized.length <= 2 || STT_HALLUCINATIONS.has(normalized)) return true;

  const tokens = normalized.match(/[a-z0-9]+(?:[._-][a-z0-9]+)*/g) ?? [];
  if (tokens.length < 2) return false;
  const singleLetterTokens = tokens.filter((token) => token.length === 1).length;
  return singleLetterTokens >= 2 && singleLetterTokens * 2 >= tokens.length;
}

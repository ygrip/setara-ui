// Whisper hallucination artifacts that appear on near-silent/no-speech input specifically (see
// e.g. openai/whisper#679) - text a real user essentially never intends as a whole command. Does
// NOT include "yes"/"no"/"ok"/"okay"/"thanks"/"bye" - those are common real confirmations/replies
// (this app's own confirm_required action flow expects them) that this blacklist was rejecting
// unconditionally, making every short voice confirmation fail with "Could not understand audio"
// regardless of actual STT quality (setara-s94o STT quality incident).
const STT_HALLUCINATIONS = new Set([
  'you', 'thanks for watching', 'thank you for watching', 'uh', 'um', 'mm', 'hmm', 'so', '.', 'the', 'i', 'a',
]);

/** Reject near-silence hallucinations and fragmented letter noise before it can enter chat. */
export function isLikelyVoiceNoise(text: string): boolean {
  const normalized = text.trim().toLowerCase().replace(/[.!?]+$/, '');
  if (normalized.length === 0 || STT_HALLUCINATIONS.has(normalized)) return true;

  const tokens = normalized.match(/[a-z0-9]+(?:[._-][a-z0-9]+)*/g) ?? [];
  if (tokens.length < 2) return false;
  const singleLetterTokens = tokens.filter((token) => token.length === 1).length;
  return singleLetterTokens >= 2 && singleLetterTokens * 2 >= tokens.length;
}

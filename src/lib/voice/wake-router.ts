export type WakeMode = 'wake' | 'command';

export type WakeRoute =
  | { action: 'continue'; nextMode: WakeMode }
  | { action: 'review'; command: string; nextMode: WakeMode };

const WAKE_PATTERN = /\b(?:hi|hey|hello)?\s*(?:a[\s.]*s[\s.]*a|asa)\b/i;

export function routeVoiceTranscript(mode: WakeMode, transcript: string): WakeRoute {
  const text = transcript.trim();
  if (!text) return { action: 'continue', nextMode: mode };

  if (mode === 'command') {
    return { action: 'review', command: text, nextMode: 'command' };
  }

  const match = WAKE_PATTERN.exec(text);
  if (!match) return { action: 'continue', nextMode: 'wake' };

  const command = text.slice(match.index + match[0].length).replace(/^[\s,.:;-]+/, '').trim();
  if (!command) return { action: 'continue', nextMode: 'command' };
  return { action: 'review', command, nextMode: 'command' };
}

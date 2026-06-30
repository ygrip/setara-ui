export type PcmStreamErrorDisposition = 'eof' | 'fallback' | 'failed';

export function classifyPcmStreamError(error: unknown, receivedSamples: number): PcmStreamErrorDisposition {
  const message = error instanceof Error ? `${error.name}: ${error.message}` : String(error);
  if (receivedSamples > 0 && message.toUpperCase().includes('NS_BASE_STREAM_CLOSED')) return 'eof';
  return receivedSamples === 0 ? 'fallback' : 'failed';
}

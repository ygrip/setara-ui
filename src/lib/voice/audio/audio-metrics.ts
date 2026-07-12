/** Content-free capture counters — numeric only, safe to log. */
export interface AudioCaptureStats {
  framesProduced: number;
  overrunCount: number;
  underrunCount: number;
  lastLevel: number;
}

export interface AudioLevel {
  rms: number;
}

export function emptyAudioCaptureStats(): AudioCaptureStats {
  return { framesProduced: 0, overrunCount: 0, underrunCount: 0, lastLevel: 0 };
}

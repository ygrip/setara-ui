import { z } from 'zod';

export const STT_PROTOCOL_VERSION = '2' as const;
export const STT_MAX_CONTROL_BYTES = 8_192;

export const STT_MODES = ['command', 'hands_free', 'dictation'] as const;
export const STT_PROVIDER_PREFERENCES = ['auto', 'faster_whisper', 'openai'] as const;
export const STT_FLUSH_REASONS = [
  'user_stop',
  'vad_silence',
  'max_duration',
  'navigation',
  'barge_in',
  'client_shutdown',
] as const;
export const STT_FINALITIES = [
  'provider_final',
  'local_recovered_final',
  'partial_timeout',
  'connection_lost_partial',
  'cancelled',
] as const;

const identifierSchema = z.string().trim().min(1).max(128);
const providerPreferenceSchema = z.string().trim().pipe(z.enum(STT_PROVIDER_PREFERENCES));
const providerNameSchema = z.string().trim().min(1).max(64);
const modelNameSchema = z.string().trim().min(1).max(128);
const nonNegativeIntegerSchema = z.number().int().nonnegative();

const audioFormatSchema = z
  .object({
    sampleRate: z.literal(16_000),
    channels: z.literal(1),
    sampleFormat: z.literal('s16le'),
    frameDurationMs: z.literal(20),
  })
  .strict();

const startSchema = z
  .object({
    type: z.literal('start'),
    protocolVersion: z.literal(STT_PROTOCOL_VERSION),
    sessionId: identifierSchema,
    requestId: identifierSchema.optional(),
    mode: z.enum(STT_MODES),
    provider: providerPreferenceSchema,
    audio: audioFormatSchema,
    language: z.string().trim().min(1).max(16).optional(),
    prompt: z.string().max(1_000).optional(),
    hotwords: z.array(z.string().trim().min(1).max(100)).max(100).optional(),
    maxDurationSeconds: z.number().int().min(1).max(300),
  })
  .strict();

const flushSchema = z
  .object({
    type: z.literal('flush'),
    reason: z.enum(STT_FLUSH_REASONS),
  })
  .strict();

const resetSchema = z.object({ type: z.literal('reset') }).strict();
const cancelSchema = z.object({ type: z.literal('cancel') }).strict();

const clientControlSchema = z.discriminatedUnion('type', [
  startSchema,
  flushSchema,
  resetSchema,
  cancelSchema,
]);

const readySchema = z
  .object({
    type: z.literal('ready'),
    protocolVersion: z.literal(STT_PROTOCOL_VERSION),
    provider: providerNameSchema,
    model: modelNameSchema,
    supportsPartials: z.boolean(),
    maxDurationSeconds: z.number().int().min(1).max(300),
  })
  .strict();

const partialSchema = z
  .object({
    type: z.literal('partial'),
    sequence: nonNegativeIntegerSchema,
    text: z.string(),
    committedText: z.string(),
    unstableText: z.string(),
    audioReceivedMs: nonNegativeIntegerSchema,
  })
  .strict();

const finalSchema = z
  .object({
    type: z.literal('final'),
    text: z.string(),
    finality: z.enum(STT_FINALITIES),
    provider: providerNameSchema,
    model: modelNameSchema,
    durationMs: nonNegativeIntegerSchema,
    latencyMs: nonNegativeIntegerSchema,
    fallbackUsed: z.boolean(),
    audioDroppedMs: nonNegativeIntegerSchema,
  })
  .strict();

const errorSchema = z
  .object({
    type: z.literal('error'),
    code: z.string().trim().min(1).max(64),
    message: z.string().trim().min(1).max(1_000),
    retryable: z.boolean(),
  })
  .strict();

const serverEventSchema = z.discriminatedUnion('type', [
  readySchema,
  partialSchema,
  finalSchema,
  errorSchema,
]);

export type SttMode = (typeof STT_MODES)[number];
export type SttProviderPreference = (typeof STT_PROVIDER_PREFERENCES)[number];
export type SttFlushReason = (typeof STT_FLUSH_REASONS)[number];
export type SttFinality = (typeof STT_FINALITIES)[number];
export type SttAudioFormat = z.infer<typeof audioFormatSchema>;
export type SttStartControl = z.infer<typeof startSchema>;
export type SttFlushControl = z.infer<typeof flushSchema>;
export type SttResetControl = z.infer<typeof resetSchema>;
export type SttCancelControl = z.infer<typeof cancelSchema>;
export type SttClientControl = z.infer<typeof clientControlSchema>;
export type SttReadyEvent = z.infer<typeof readySchema>;
export type SttPartialEvent = z.infer<typeof partialSchema>;
export type SttFinalEvent = z.infer<typeof finalSchema>;
export type SttErrorEvent = z.infer<typeof errorSchema>;
export type SttServerEvent = z.infer<typeof serverEventSchema>;

export interface SttCorrelationMetadata {
  requestId?: string;
  sessionId: string;
  clientId?: string;
}

export type SttProtocolErrorCode =
  | 'STT_CONTROL_TOO_LARGE'
  | 'STT_INVALID_JSON'
  | 'STT_INVALID_MESSAGE'
  | 'STT_PROVIDER_NOT_ALLOWED';

export class SttProtocolError extends Error {
  readonly code: SttProtocolErrorCode;

  constructor(code: SttProtocolErrorCode, message: string) {
    super(message);
    this.name = 'SttProtocolError';
    this.code = code;
  }
}

export interface SttProviderPolicy {
  allowProviderOverride?: boolean;
}

export function parseSttClientControl(
  input: unknown,
  policy: SttProviderPolicy = {},
): SttClientControl {
  const value = decodeControl(input);
  const result = clientControlSchema.safeParse(value);
  if (!result.success) {
    throw new SttProtocolError('STT_INVALID_MESSAGE', result.error.issues[0]?.message ?? 'Invalid STT control');
  }
  if (
    result.data.type === 'start' &&
    result.data.provider !== 'auto' &&
    policy.allowProviderOverride !== true
  ) {
    throw new SttProtocolError(
      'STT_PROVIDER_NOT_ALLOWED',
      'Explicit STT provider selection is not allowed for this client',
    );
  }
  return result.data;
}

export function parseSttServerEvent(input: unknown): SttServerEvent {
  const value = decodeControl(input);
  const result = serverEventSchema.safeParse(value);
  if (!result.success) {
    throw new SttProtocolError('STT_INVALID_MESSAGE', result.error.issues[0]?.message ?? 'Invalid STT event');
  }
  return result.data;
}

export function isAuthoritativeSttFinality(finality: SttFinality): boolean {
  return finality === 'provider_final' || finality === 'local_recovered_final';
}

export function sttCorrelationMetadata(
  start: SttStartControl,
  clientId?: string,
): SttCorrelationMetadata {
  const metadata: SttCorrelationMetadata = { sessionId: start.sessionId };
  if (start.requestId) metadata.requestId = start.requestId;
  if (clientId) metadata.clientId = clientId;
  return metadata;
}

function decodeControl(input: unknown): unknown {
  let encoded: string;
  if (typeof input === 'string') {
    encoded = input;
  } else {
    try {
      encoded = JSON.stringify(input);
    } catch {
      throw new SttProtocolError('STT_INVALID_JSON', 'STT control must be valid JSON');
    }
  }
  if (new TextEncoder().encode(encoded).byteLength > STT_MAX_CONTROL_BYTES) {
    throw new SttProtocolError('STT_CONTROL_TOO_LARGE', 'STT control exceeds 8192 bytes');
  }
  if (typeof input !== 'string') return input;
  try {
    return JSON.parse(encoded);
  } catch {
    throw new SttProtocolError('STT_INVALID_JSON', 'STT control must be valid JSON');
  }
}

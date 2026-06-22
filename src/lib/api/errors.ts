const DEFAULT_API_ERROR = 'The Setara service did not return a usable response. Please try again.';

const PARSE_ERROR_PATTERNS = [
  /JSON\.parse/i,
  /unexpected token/i,
  /unexpected character/i,
  /Unexpected end of JSON input/i,
  /not valid json/i
];

function statusFallback(response: Response, fallback: string): string {
  const status = `${response.status} ${response.statusText}`.trim();
  return status ? `${fallback} (HTTP ${status})` : fallback;
}

function looksLikeHtml(text: string): boolean {
  return /<!doctype html/i.test(text) || /<html[\s>]/i.test(text);
}

function looksLikeParseError(text: string): boolean {
  return PARSE_ERROR_PATTERNS.some((pattern) => pattern.test(text));
}

function fieldAsString(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function isTechnicalMessage(text: string): boolean {
  return /java\.|Error id [0-9a-f-]{36}|at com\.|BootstrapMethod|VirtualMachine|NullPointer|ClassCast|OutOfMemory/i.test(
    text
  );
}

function messageFromJson(value: unknown): string | null {
  if (!value || typeof value !== 'object') return null;
  const body = value as Record<string, unknown>;
  const msg =
    fieldAsString(body.message) ??
    fieldAsString(body.error) ??
    fieldAsString(body.detail) ??
    fieldAsString(body.title) ??
    fieldAsString(body.details); // Quarkus unhandled exception format
  if (msg && isTechnicalMessage(msg)) return null;
  return msg;
}

export function normalizeErrorMessage(error: unknown, fallback = DEFAULT_API_ERROR): string {
  const raw = error instanceof Error ? error.message : String(error ?? '');
  const text = raw.trim();
  if (!text || looksLikeHtml(text) || looksLikeParseError(text)) return fallback;
  return text.length > 260 ? `${text.slice(0, 257)}...` : text;
}

export async function readApiError(response: Response, fallback = DEFAULT_API_ERROR): Promise<string> {
  const bodyText = await response.text().catch(() => '');
  const fallbackWithStatus = statusFallback(response, fallback);
  const text = bodyText.trim();

  if (!text || looksLikeHtml(text)) return fallbackWithStatus;

  try {
    const parsed = JSON.parse(text);
    return normalizeErrorMessage(messageFromJson(parsed), fallbackWithStatus);
  } catch {
    return normalizeErrorMessage(text, fallbackWithStatus);
  }
}

export async function readJsonOrThrow<T>(response: Response, fallback = DEFAULT_API_ERROR): Promise<T> {
  const bodyText = await response.text().catch(() => '');

  if (!response.ok) {
    const errorResponse = new Response(bodyText, {
      status: response.status,
      statusText: response.statusText,
      headers: response.headers
    });
    throw new Error(await readApiError(errorResponse, fallback));
  }

  const text = bodyText.trim();
  if (!text || looksLikeHtml(text)) {
    throw new Error(fallback);
  }

  try {
    return JSON.parse(text) as T;
  } catch {
    throw new Error(fallback);
  }
}

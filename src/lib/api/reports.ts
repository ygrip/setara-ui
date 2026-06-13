import { getApiBaseUrl } from './config';

export type ReportFormat = 'pdf' | 'xlsx';

const MIME_BY_FORMAT: Record<ReportFormat, string> = {
  pdf: 'application/pdf',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
};

export function reportExtension(format: ReportFormat): string {
  return format === 'xlsx' ? 'xlsx' : 'pdf';
}

function configuredApiBaseUrl(): string {
  const configured = getApiBaseUrl().replace(/\/$/, '');
  if (typeof window === 'undefined') return configured;

  try {
    const url = new URL(configured);
    const isLocalApi = url.hostname === 'localhost' || url.hostname === '127.0.0.1';
    const isLocalUi = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    if (isLocalApi && !isLocalUi) return window.location.origin;
  } catch {
    return window.location.origin;
  }

  return configured;
}

function reportUrl(path: string, format: ReportFormat): string {
  const base = configuredApiBaseUrl();
  const separator = path.includes('?') ? '&' : '?';
  return `${base}${path}${separator}format=${format}`;
}

function filenameFromDisposition(header: string | null): string | null {
  if (!header) return null;
  const utfMatch = header.match(/filename\*=UTF-8''([^;]+)/i);
  if (utfMatch?.[1]) return decodeURIComponent(utfMatch[1].replaceAll('"', ''));
  const match = header.match(/filename="?([^";]+)"?/i);
  return match?.[1] ?? null;
}

async function errorMessage(response: Response): Promise<string> {
  const fallback = `${response.status} ${response.statusText}`.trim();
  const contentType = response.headers.get('content-type') ?? '';

  if (contentType.includes('application/json')) {
    try {
      const body = await response.json();
      return body.message ?? body.error ?? body.detail ?? fallback;
    } catch {
      return fallback;
    }
  }

  const text = await response.text().catch(() => '');
  return text.trim() || fallback;
}

export async function downloadReport(path: string, format: ReportFormat, fallbackName: string): Promise<void> {
  const response = await fetch(reportUrl(path, format), {
    headers: { Accept: MIME_BY_FORMAT[format] },
    credentials: 'include'
  });

  if (!response.ok) {
    throw new Error(await errorMessage(response));
  }

  const blob = await response.blob();
  if (blob.size === 0) {
    throw new Error('The report export returned an empty file.');
  }

  const filename = filenameFromDisposition(response.headers.get('content-disposition'))
    ?? `${fallbackName}.${reportExtension(format)}`;
  const objectUrl = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = objectUrl;
  link.download = filename;
  link.rel = 'noopener';
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(objectUrl);
}

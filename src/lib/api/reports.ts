import { getApiBaseUrl } from './config';
import { authHeaders } from './client';
import { isMockMode } from '$lib/mock/client';

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
      return sanitizeErrorText(body.message ?? body.error ?? body.detail ?? fallback);
    } catch {
      return fallback;
    }
  }

  if (contentType.includes('text/html')) {
    return 'Report export is not available from this UI host. Check the Setara API connection and try again.';
  }

  const text = await response.text().catch(() => '');
  return sanitizeErrorText(text.trim() || fallback);
}

function sanitizeErrorText(value: string): string {
  const text = value.trim();
  if (!text) return 'Unable to export report.';
  if (/^\s*<!doctype html/i.test(text) || /^\s*<html[\s>]/i.test(text)) {
    return 'Report export is not available from this UI host. Check the Setara API connection and try again.';
  }
  return text.length > 240 ? `${text.slice(0, 237)}...` : text;
}

function isReportContentType(contentType: string, format: ReportFormat): boolean {
  if (!contentType) return true;
  const normalized = contentType.toLowerCase();
  return normalized.includes(MIME_BY_FORMAT[format])
    || normalized.includes('application/octet-stream')
    || normalized.includes('application/force-download');
}

export async function downloadReport(path: string, format: ReportFormat, fallbackName: string): Promise<void> {
  if (isMockMode()) {
    throw new Error('Report export is unavailable in preview mode. Connect a live Setara backend to download reports.');
  }

  const response = await fetch(reportUrl(path, format), {
    headers: { Accept: MIME_BY_FORMAT[format], ...authHeaders() }
  });

  if (!response.ok) {
    throw new Error(await errorMessage(response));
  }

  const contentType = response.headers.get('content-type') ?? '';
  if (!isReportContentType(contentType, format)) {
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

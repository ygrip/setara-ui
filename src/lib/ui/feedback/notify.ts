import { writable } from 'svelte/store';
import type { AppTone } from '$lib/ui/types';

export type ToastTone = Exclude<AppTone, 'neutral'>;

export type ToastMessage = {
  id: string;
  tone: ToastTone;
  title?: string;
  message: string;
  timeoutMs: number;
};

type NotifyOptions = {
  title?: string;
  timeoutMs?: number;
};

const DEFAULT_TIMEOUT_MS = 4200;

export const toasts = writable<ToastMessage[]>([]);

function createId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return `toast-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function push(tone: ToastTone, message: string, options: NotifyOptions = {}) {
  const toast: ToastMessage = {
    id: createId(),
    tone,
    message,
    title: options.title,
    timeoutMs: options.timeoutMs ?? DEFAULT_TIMEOUT_MS
  };

  toasts.update((items) => [...items, toast].slice(-4));

  if (toast.timeoutMs > 0 && typeof window !== 'undefined') {
    window.setTimeout(() => dismiss(toast.id), toast.timeoutMs);
  }

  return toast.id;
}

export function dismiss(id: string) {
  toasts.update((items) => items.filter((item) => item.id !== id));
}

export const notify = {
  success: (message: string, options?: NotifyOptions) => push('success', message, options),
  error: (message: string, options?: NotifyOptions) => push('error', message, options),
  info: (message: string, options?: NotifyOptions) => push('info', message, options),
  warning: (message: string, options?: NotifyOptions) => push('warning', message, options),
  dismiss
};


const DEFAULT_API_BASE_URL = 'http://localhost:8080';
const DEFAULT_WS_BASE_URL = 'ws://localhost:8080';

export function getApiBaseUrl(): string {
  return import.meta.env.VITE_SETARA_API_BASE_URL ?? DEFAULT_API_BASE_URL;
}

export function getWebSocketBaseUrl(): string {
  return import.meta.env.VITE_SETARA_WS_BASE_URL ?? DEFAULT_WS_BASE_URL;
}

export function getWebSocketToken(): string | undefined {
  return import.meta.env.VITE_SETARA_WS_TOKEN;
}

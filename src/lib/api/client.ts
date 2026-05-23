import { getApiBaseUrl } from './config';

export async function getHealth(): Promise<{ status: string; service: string }> {
  const response = await fetch(`${getApiBaseUrl()}/api/health`);
  if (!response.ok) {
    throw new Error(`Setara health check failed: ${response.status}`);
  }
  return response.json();
}

import { listApiKeys, type ApiKey } from '$lib/api/apikeys';

export async function load({ params }: { params: { projectKey: string } }) {
  const { projectKey } = params;
  try {
    const apiKeys = await listApiKeys(projectKey);
    return { projectKey, apiKeys, error: null };
  } catch (e) {
    return { projectKey, apiKeys: [] as ApiKey[], error: (e as Error).message };
  }
}

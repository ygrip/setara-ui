import { listUsers, type User } from '$lib/api/organization';

export async function load() {
  try {
    const result = await listUsers();
    return { users: result.items, nextCursor: result.nextCursor, error: null };
  } catch (e) {
    return { users: [] as User[], nextCursor: null, error: (e as Error).message };
  }
}

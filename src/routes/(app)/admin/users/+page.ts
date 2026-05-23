import { listUsers, type User } from '$lib/api/organization';

export async function load() {
  try {
    const users = await listUsers();
    return { users, error: null };
  } catch (e) {
    return { users: [] as User[], error: (e as Error).message };
  }
}

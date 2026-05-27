import { listUsers, listAllSquads, type User, type Squad } from '$lib/api/organization';

export async function load({ url }: { url: URL }) {
  try {
    const q = url.searchParams.get('q') ?? undefined;
    // listUsers doesn't support search param yet from the page loader, use basic list
    const [usersResult, squadsResult] = await Promise.all([listUsers(), listAllSquads()]);
    return { users: usersResult.items, squads: squadsResult.items, searchQuery: q, error: null };
  } catch (e) {
    return { users: [] as User[], squads: [] as Squad[], searchQuery: null, error: (e as Error).message };
  }
}

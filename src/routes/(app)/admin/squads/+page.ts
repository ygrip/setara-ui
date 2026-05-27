import { listTribes, listAllSquads, type Tribe, type Squad } from '$lib/api/organization';

export async function load() {
  try {
    const [tribesResult, squadsResult] = await Promise.all([listTribes(), listAllSquads()]);
    return { tribes: tribesResult.items, squads: squadsResult.items, error: null };
  } catch (e) {
    return { tribes: [] as Tribe[], squads: [] as Squad[], error: (e as Error).message };
  }
}

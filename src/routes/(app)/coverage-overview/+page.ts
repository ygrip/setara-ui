import {
  listSquadCoverage,
  type SquadCoverage,
  type SquadProjectCoverage
} from '$lib/api/statistics';

export async function load() {
  try {
    const squads = await listSquadCoverage({ sortBy: 'coverage', sortDir: 'desc' });
    return {
      squads,
      projects: [] as SquadProjectCoverage[],
      selectedSquadId: null as string | null,
      error: null
    };
  } catch (e) {
    return {
      squads: [] as SquadCoverage[],
      projects: [] as SquadProjectCoverage[],
      selectedSquadId: null as string | null,
      error: (e as Error).message
    };
  }
}

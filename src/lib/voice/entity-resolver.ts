import type { AsaEntityCatalog } from '$lib/api/asa';
import type { NormalizedTranscript } from './transcript-normalizer';

export type EntityType = 'project' | 'plan' | 'build' | 'squad';

export interface EntityMatch {
  type: EntityType;
  id: string;
  display: string;
  key?: string;
  originalSpan: string;
  score: number;
  resolution: 'auto' | 'confirmed';
  alternatives?: EntityCandidate[];
}

export interface EntityCandidate {
  type: EntityType;
  id: string;
  display: string;
  key?: string;
  score: number;
}

export interface EntityClarification {
  originalSpan: string;
  normalizedSpan: string;
  candidates: EntityCandidate[];
}

export interface ResolvedTranscript {
  rawText: string;
  normalizedText: string;
  correctedText: string;
  matches: EntityMatch[];
  clarifications: EntityClarification[];
}

/** Context that biases entity scoring toward the user's current location. */
export interface ResolverContext {
  projectKey?: string;
  squadId?: string;
  planId?: string;
}

const AUTO_RESOLVE_THRESHOLD = 0.85;
const CLARIFY_THRESHOLD = 0.60;
const MIN_MARGIN = 0.10;
const CONTEXT_BOOST = 0.12;
const KEY_MATCH_BOOST = 0.20;
const EXACT_MATCH_BONUS = 0.15;

/**
 * Resolves entity references in a normalized transcript against an authorized catalog.
 *
 * Scoring: normalized edit-distance similarity boosted by exact key/version matches and
 * current-context affinity (project, squad, plan). Candidates above AUTO_RESOLVE_THRESHOLD
 * with a clear margin over the second-best are auto-resolved; weaker matches are returned
 * as clarifications for the user to confirm.
 */
export class EntityResolver {
  constructor(private readonly catalog: AsaEntityCatalog) {}

  resolve(transcript: NormalizedTranscript, ctx: ResolverContext = {}): ResolvedTranscript {
    const text = transcript.normalizedText;
    const spans = this.extractCandidateSpans(text);
    const matches: EntityMatch[] = [];
    const clarifications: EntityClarification[] = [];
    let correctedText = text;

    for (const span of spans) {
      const scored = this.scoreSpan(span, ctx);
      if (scored.length === 0) continue;

      const best = scored[0];
      const second = scored[1];
      const margin = second ? best.score - second.score : 1;
      const qualifies = best.score >= CLARIFY_THRESHOLD;

      if (!qualifies) continue;

      if (best.score >= AUTO_RESOLVE_THRESHOLD && margin >= MIN_MARGIN) {
        const match: EntityMatch = {
          type: best.type,
          id: best.id,
          display: best.display,
          key: best.key,
          originalSpan: span,
          score: best.score,
          resolution: 'auto',
        };
        matches.push(match);
        correctedText = correctedText.replace(span, best.display);
      } else {
        clarifications.push({
          originalSpan: span,
          normalizedSpan: span.toLowerCase(),
          candidates: scored.slice(0, 4),
        });
      }
    }

    return {
      rawText: transcript.rawText,
      normalizedText: transcript.normalizedText,
      correctedText,
      matches,
      clarifications,
    };
  }

  /** Apply a user-confirmed candidate for a given clarification span. */
  applyClarification(
    resolved: ResolvedTranscript,
    clarification: EntityClarification,
    candidate: EntityCandidate,
  ): ResolvedTranscript {
    const match: EntityMatch = {
      type: candidate.type,
      id: candidate.id,
      display: candidate.display,
      key: candidate.key,
      originalSpan: clarification.originalSpan,
      score: candidate.score,
      resolution: 'confirmed',
    };
    const correctedText = resolved.correctedText.replace(clarification.originalSpan, candidate.display);
    const remainingClarifications = resolved.clarifications.filter((c) => c !== clarification);
    return {
      ...resolved,
      correctedText,
      matches: [...resolved.matches, match],
      clarifications: remainingClarifications,
    };
  }

  private extractCandidateSpans(text: string): string[] {
    // Extract 1-4 word runs that look like entity references.
    // Phonetic variants like "rak sara" come through as multi-word spans.
    const words = text.split(/\s+/);
    const spans: string[] = [];
    const seen = new Set<string>();
    for (let len = 4; len >= 1; len--) {
      for (let i = 0; i <= words.length - len; i++) {
        const span = words.slice(i, i + len).join(' ');
        if (!seen.has(span) && span.length >= 2) {
          spans.push(span);
          seen.add(span);
        }
      }
    }
    return spans;
  }

  private scoreSpan(span: string, ctx: ResolverContext): EntityCandidate[] {
    const normalized = span.toLowerCase().replace(/[^a-z0-9.\s-]/g, '').trim();
    if (!normalized) return [];

    const candidates: EntityCandidate[] = [];

    for (const p of this.catalog.projects) {
      const score = this.scoreEntity(normalized, p.name.toLowerCase(), p.key?.toLowerCase(), ctx, {
        isCurrentProject: p.key === ctx.projectKey,
      });
      if (score >= CLARIFY_THRESHOLD) {
        candidates.push({ type: 'project', id: p.id, display: p.name, key: p.key, score });
      }
    }

    for (const sq of this.catalog.squads) {
      const score = this.scoreEntity(normalized, sq.name.toLowerCase(), undefined, ctx, {
        isCurrentSquad: sq.id === ctx.squadId,
      });
      if (score >= CLARIFY_THRESHOLD) {
        candidates.push({ type: 'squad', id: sq.id, display: sq.name, score });
      }
    }

    for (const pl of this.catalog.plans) {
      const score = this.scoreEntity(normalized, pl.name.toLowerCase(), undefined, ctx, {
        isCurrentPlan: pl.id === ctx.planId,
        isCurrentSquad: pl.squadId === ctx.squadId,
      });
      if (score >= CLARIFY_THRESHOLD) {
        candidates.push({ type: 'plan', id: pl.id, display: pl.name, score });
      }
    }

    for (const b of this.catalog.builds) {
      const nameText = [b.version, b.buildKey].filter(Boolean).join(' ').toLowerCase();
      const score = this.scoreEntity(normalized, nameText, b.buildKey?.toLowerCase(), ctx, {});
      if (score >= CLARIFY_THRESHOLD) {
        candidates.push({ type: 'build', id: b.id, display: b.version ?? b.buildKey ?? b.id, score });
      }
    }

    return candidates.sort((a, b) => b.score - a.score);
  }

  private scoreEntity(
    query: string,
    name: string,
    key: string | undefined,
    _ctx: ResolverContext,
    boosts: {
      isCurrentProject?: boolean;
      isCurrentSquad?: boolean;
      isCurrentPlan?: boolean;
    },
  ): number {
    let score = stringSimilarity(query, name);

    // Exact key/version match overrides distance score
    if (key && (query === key || name.startsWith(query))) {
      score = Math.max(score, 1.0 - (name.length - query.length) * 0.01);
    }

    // Partial key match bonus
    if (key && key.includes(query)) {
      score += KEY_MATCH_BOOST * (query.length / key.length);
    }

    // Exact substring bonus
    if (name.includes(query) && query.length >= 3) {
      score += EXACT_MATCH_BONUS * (query.length / name.length);
    }

    // Context affinity boost
    if (boosts.isCurrentProject || boosts.isCurrentSquad || boosts.isCurrentPlan) {
      score += CONTEXT_BOOST;
    }

    return Math.min(1, score);
  }
}

/**
 * Normalized edit-distance similarity in [0, 1].
 * Uses the Levenshtein distance normalized by the longer string length.
 */
function stringSimilarity(a: string, b: string): number {
  if (a === b) return 1;
  const maxLen = Math.max(a.length, b.length);
  if (maxLen === 0) return 1;
  return 1 - levenshtein(a, b) / maxLen;
}

function levenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  const dp: number[] = Array.from({ length: n + 1 }, (_, i) => i);
  for (let i = 1; i <= m; i++) {
    let prev = i;
    for (let j = 1; j <= n; j++) {
      const curr = a[i - 1] === b[j - 1] ? dp[j - 1] : Math.min(dp[j - 1], dp[j], prev) + 1;
      dp[j - 1] = prev;
      prev = curr;
    }
    dp[n] = prev;
  }
  return dp[n];
}

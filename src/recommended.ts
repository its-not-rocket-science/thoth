import type { RecommendedCategory } from "./exercise";

/** Fixed slot order for a recommended session, matching the brief's
 *  example structure: one UFOV exercise, one attentional-orienting/search
 *  exercise, one executive/sustained-attention exercise. */
const CATEGORY_ORDER: RecommendedCategory[] = ["ufov", "orienting-search", "executive"];

export interface RecommendedPick {
  category: RecommendedCategory;
  exerciseId: string;
}

/**
 * Pure: picks one exercise id per category, preferring one that wasn't in
 * `lastPicks` whenever the category offers more than one candidate, so a
 * recommended session doesn't hand back the exact same three exercises
 * back to back. A category with only one candidate is reused every time
 * (nothing else to rotate to); a category with no candidates at all is
 * skipped entirely, so the session simply has fewer than three slots
 * rather than erroring — this is a software-designed rotation, not a
 * guarantee that every slot can always be filled.
 */
export function chooseRecommendedSession(
  candidatesByCategory: Partial<Record<RecommendedCategory, readonly string[]>>,
  lastPicks: string[],
  rng: () => number = Math.random,
): RecommendedPick[] {
  const picks: RecommendedPick[] = [];
  for (const category of CATEGORY_ORDER) {
    const candidates = candidatesByCategory[category] ?? [];
    if (candidates.length === 0) continue;
    const fresh = candidates.filter(id => !lastPicks.includes(id));
    const pool = fresh.length > 0 ? fresh : candidates;
    const choice = pool[Math.floor(rng() * pool.length)] as string;
    picks.push({ category, exerciseId: choice });
  }
  return picks;
}

/** Pure: swaps out one slot's exercise for the next other candidate in its
 *  category (wrapping around), for the "Replace" control — deterministic
 *  rather than random, so repeated clicks cycle through every option
 *  instead of occasionally repeating one. Returns the same id unchanged if
 *  its category has no other candidate to swap to. */
export function replacePick(
  picks: RecommendedPick[],
  slotIndex: number,
  candidatesByCategory: Partial<Record<RecommendedCategory, readonly string[]>>,
): RecommendedPick[] {
  const pick = picks[slotIndex];
  if (!pick) return picks;
  const candidates = candidatesByCategory[pick.category] ?? [];
  if (candidates.length < 2) return picks;
  const currentIndex = candidates.indexOf(pick.exerciseId);
  const nextIndex = (currentIndex + 1 + candidates.length) % candidates.length;
  const next = candidates[nextIndex] as string;
  return picks.map((p, i) => (i === slotIndex ? { ...p, exerciseId: next } : p));
}

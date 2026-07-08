import type { PhaseDef } from '../types';

/** Continuous coherence wave ~5.5 breaths/min for several minutes. */
export function buildCoherencePhases(
  durationMs = 5 * 60_000,
  halfCycleMs = 5500,
): PhaseDef[] {
  const phases: PhaseDef[] = [];
  let elapsed = 0;
  let cycle = 0;
  while (elapsed + halfCycleMs * 2 <= durationMs) {
    cycle += 1;
    phases.push({
      kind: 'inhale',
      label: 'Breathe in',
      durationMs: halfCycleMs,
      fillStart: 0,
      fillEnd: 1,
      round: 1,
      cycle,
    });
    phases.push({
      kind: 'exhale',
      label: 'Breathe out',
      durationMs: halfCycleMs,
      fillStart: 1,
      fillEnd: 0,
      round: 1,
      cycle,
    });
    elapsed += halfCycleMs * 2;
  }
  return phases;
}

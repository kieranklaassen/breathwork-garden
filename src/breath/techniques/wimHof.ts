import type { PhaseDef } from '../types';

/** Official-shaped Wim Hof: 3 rounds × 30 power breaths → empty retention → 15s recovery. */
export function buildWimHofPhases(
  rounds = 3,
  breathsPerRound = 30,
): PhaseDef[] {
  const phases: PhaseDef[] = [];
  const inhaleMs = 1800;
  const exhaleMs = 1200;
  const recoveryHoldMs = 15_000;

  for (let round = 1; round <= rounds; round++) {
    for (let b = 1; b <= breathsPerRound; b++) {
      phases.push({
        kind: 'inhale',
        label: 'Breathe in',
        durationMs: inhaleMs,
        fillStart: 0,
        fillEnd: 1,
        round,
        cycle: b,
      });
      phases.push({
        kind: 'exhale',
        label: 'Let go',
        durationMs: exhaleMs,
        fillStart: 1,
        fillEnd: 0,
        round,
        cycle: b,
      });
    }
    phases.push({
      kind: 'retentionUser',
      label: 'Hold (empty) — tap when ready',
      durationMs: null,
      fillStart: 0,
      fillEnd: 0,
      round,
      cycle: breathsPerRound,
    });
    phases.push({
      kind: 'inhale',
      label: 'Deep recovery inhale',
      durationMs: 2500,
      fillStart: 0,
      fillEnd: 1,
      round,
      cycle: breathsPerRound + 1,
    });
    phases.push({
      kind: 'holdFull',
      label: 'Hold',
      durationMs: recoveryHoldMs,
      fillStart: 1,
      fillEnd: 1,
      round,
      cycle: breathsPerRound + 1,
    });
    phases.push({
      kind: 'exhale',
      label: 'Breathe out',
      durationMs: 2000,
      fillStart: 1,
      fillEnd: 0,
      round,
      cycle: breathsPerRound + 1,
    });
  }
  return phases;
}

import type { PhaseDef } from '../types';

/**
 * Energizing breath: fast exhale-accented cycles in short bursts with rests.
 * ~1.5 breaths/sec → ~333ms inhale (passive) + ~333ms sharp exhale.
 */
export function buildEnergizingPhases(
  bursts = 4,
  cyclesPerBurst = 20,
  inhaleMs = 300,
  exhaleMs = 350,
  restMs = 8000,
): PhaseDef[] {
  const phases: PhaseDef[] = [];
  for (let round = 1; round <= bursts; round++) {
    for (let c = 1; c <= cyclesPerBurst; c++) {
      phases.push({
        kind: 'inhale',
        label: 'In',
        durationMs: inhaleMs,
        fillStart: 0,
        fillEnd: 0.7,
        round,
        cycle: c,
      });
      phases.push({
        kind: 'exhale',
        label: 'Out',
        durationMs: exhaleMs,
        fillStart: 0.7,
        fillEnd: 0,
        round,
        cycle: c,
      });
    }
    if (round < bursts) {
      phases.push({
        kind: 'rest',
        label: 'Rest',
        durationMs: restMs,
        fillStart: 0.3,
        fillEnd: 0.3,
        round,
        cycle: cyclesPerBurst,
      });
    }
  }
  return phases;
}

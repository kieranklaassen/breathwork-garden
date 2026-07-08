export type TechniqueId = 'wimHof' | 'coherence' | 'energizing';

export type PhaseKind =
  | 'inhale'
  | 'exhale'
  | 'holdEmpty'
  | 'holdFull'
  | 'rest'
  | 'retentionUser';

export type SessionLifecycle =
  | 'idle'
  | 'techniquePick'
  | 'sitting'
  | 'running'
  | 'paused'
  | 'completing'
  | 'growing';

export interface PhaseDef {
  kind: PhaseKind;
  label: string;
  /** Duration in ms; null means user-ended (retention). */
  durationMs: number | null;
  /** 0 = empty lungs visual, 1 = full. Interpolated during timed inhale/exhale. */
  fillStart: number;
  fillEnd: number;
  round: number;
  cycle: number;
}

export interface BreathSnapshot {
  lifecycle: SessionLifecycle;
  technique: TechniqueId | null;
  phase: PhaseKind | null;
  label: string;
  phaseElapsedMs: number;
  phaseRemainingMs: number | null;
  awaitingUserEnd: boolean;
  round: number;
  cycle: number;
  totalRounds: number;
  breathFill01: number;
  retentionElapsedMs: number;
}

export interface TechniqueMeta {
  id: TechniqueId;
  name: string;
  blurb: string;
  plantType: 'tree' | 'flower' | 'grass';
}

export const TECHNIQUES: TechniqueMeta[] = [
  {
    id: 'wimHof',
    name: 'Wim Hof Method',
    blurb: 'Power breaths, empty hold, then a short recovery hold.',
    plantType: 'tree',
  },
  {
    id: 'coherence',
    name: 'Coherence',
    blurb: 'Even 5.5s in / 5.5s out — no holds.',
    plantType: 'flower',
  },
  {
    id: 'energizing',
    name: 'Energizing breath',
    blurb: 'Fast exhale-accented bursts with short rests.',
    plantType: 'grass',
  },
];

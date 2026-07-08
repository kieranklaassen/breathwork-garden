import { SessionClock } from './SessionClock';
import { buildCoherencePhases } from './techniques/coherence';
import { buildEnergizingPhases } from './techniques/energizing';
import { buildWimHofPhases } from './techniques/wimHof';
import type {
  BreathSnapshot,
  PhaseDef,
  SessionLifecycle,
  TechniqueId,
} from './types';

export type BreathListener = (snap: BreathSnapshot) => void;

function buildPhases(technique: TechniqueId): PhaseDef[] {
  switch (technique) {
    case 'wimHof':
      return buildWimHofPhases();
    case 'coherence':
      return buildCoherencePhases();
    case 'energizing':
      return buildEnergizingPhases();
  }
}

function idleSnapshot(): BreathSnapshot {
  return {
    lifecycle: 'idle',
    technique: null,
    phase: null,
    label: '',
    phaseElapsedMs: 0,
    phaseRemainingMs: null,
    awaitingUserEnd: false,
    round: 0,
    cycle: 0,
    totalRounds: 0,
    breathFill01: 0.35,
    retentionElapsedMs: 0,
  };
}

export class BreathEngine {
  private clock = new SessionClock();
  private lifecycle: SessionLifecycle = 'idle';
  private technique: TechniqueId | null = null;
  private phases: PhaseDef[] = [];
  private index = 0;
  private phaseStartedAt = 0;
  private listeners = new Set<BreathListener>();
  private onComplete: (() => void) | null = null;
  private lastPhaseKind: string | null = null;

  on(listener: BreathListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  setOnComplete(cb: (() => void) | null): void {
    this.onComplete = cb;
  }

  getLifecycle(): SessionLifecycle {
    return this.lifecycle;
  }

  getTechnique(): TechniqueId | null {
    return this.technique;
  }

  openPicker(): void {
    if (this.lifecycle !== 'idle') return;
    this.lifecycle = 'techniquePick';
    this.emit();
  }

  cancelPicker(): void {
    if (this.lifecycle !== 'techniquePick') return;
    this.lifecycle = 'idle';
    this.technique = null;
    this.emit();
  }

  chooseTechnique(technique: TechniqueId): void {
    if (this.lifecycle !== 'techniquePick') return;
    this.technique = technique;
    this.phases = buildPhases(technique);
    this.index = 0;
    this.lifecycle = 'sitting';
    this.emit();
  }

  /** Call when sit animation finishes. */
  beginRunning(wallMs: number = performance.now()): void {
    if (this.lifecycle !== 'sitting' || !this.technique) return;
    this.lifecycle = 'running';
    this.clock.start(wallMs);
    this.phaseStartedAt = 0;
    this.lastPhaseKind = null;
    this.emit(wallMs);
  }

  pause(wallMs: number = performance.now()): void {
    if (this.lifecycle !== 'running') return;
    this.clock.pause(wallMs);
    this.lifecycle = 'paused';
    this.emit(wallMs);
  }

  resume(wallMs: number = performance.now()): void {
    if (this.lifecycle !== 'paused') return;
    this.clock.resume(wallMs);
    this.lifecycle = 'running';
    this.emit(wallMs);
  }

  stop(): void {
    if (
      this.lifecycle !== 'running' &&
      this.lifecycle !== 'paused' &&
      this.lifecycle !== 'sitting' &&
      this.lifecycle !== 'techniquePick'
    ) {
      return;
    }
    this.resetIdle();
  }

  endRetention(wallMs: number = performance.now()): void {
    const phase = this.phases[this.index];
    if (
      this.lifecycle !== 'running' ||
      !phase ||
      phase.kind !== 'retentionUser'
    ) {
      return;
    }
    const t = this.clock.nowMs(wallMs);
    this.advancePhase(t, wallMs);
  }

  /**
   * Dev / natural-finish parity: complete session from any active phase,
   * including empty retention, without requiring endRetention first.
   */
  finishSession(): void {
    if (
      this.lifecycle !== 'running' &&
      this.lifecycle !== 'paused' &&
      this.lifecycle !== 'sitting'
    ) {
      return;
    }
    this.complete();
  }

  tick(wallMs: number = performance.now()): BreathSnapshot {
    if (this.lifecycle === 'running') {
      this.advanceIfNeeded(wallMs);
    }
    const snap = this.snapshot(wallMs);
    this.emit(wallMs, snap);
    return snap;
  }

  snapshot(wallMs: number = performance.now()): BreathSnapshot {
    if (
      this.lifecycle === 'idle' ||
      this.lifecycle === 'techniquePick' ||
      !this.technique
    ) {
      return {
        ...idleSnapshot(),
        lifecycle: this.lifecycle,
        technique: this.technique,
      };
    }

    if (this.lifecycle === 'sitting' || this.lifecycle === 'growing') {
      return {
        ...idleSnapshot(),
        lifecycle: this.lifecycle,
        technique: this.technique,
        totalRounds: this.maxRound(),
        label: this.lifecycle === 'sitting' ? 'Settling in…' : 'Growing…',
      };
    }

    if (this.lifecycle === 'completing') {
      return {
        ...idleSnapshot(),
        lifecycle: 'completing',
        technique: this.technique,
        totalRounds: this.maxRound(),
        label: 'Complete',
      };
    }

    const phase = this.phases[this.index];
    if (!phase) {
      return {
        ...idleSnapshot(),
        lifecycle: this.lifecycle,
        technique: this.technique,
      };
    }

    const t = this.clock.nowMs(wallMs);
    const elapsed = Math.max(0, t - this.phaseStartedAt);
    const awaiting = phase.durationMs === null;
    const remaining = awaiting ? null : Math.max(0, phase.durationMs! - elapsed);
    const progress =
      awaiting || !phase.durationMs
        ? 0
        : Math.min(1, elapsed / phase.durationMs);
    const fill =
      phase.fillStart + (phase.fillEnd - phase.fillStart) * progress;

    return {
      lifecycle: this.lifecycle,
      technique: this.technique,
      phase: phase.kind,
      label: phase.label,
      phaseElapsedMs: elapsed,
      phaseRemainingMs: remaining,
      awaitingUserEnd: awaiting,
      round: phase.round,
      cycle: phase.cycle,
      totalRounds: this.maxRound(),
      breathFill01: fill,
      retentionElapsedMs: awaiting ? elapsed : 0,
    };
  }

  /** Expose phase change for audio (kind string when phase index changes). */
  consumePhaseChange(wallMs: number = performance.now()): PhaseDef | null {
    const phase = this.phases[this.index];
    if (!phase || this.lifecycle !== 'running' && this.lifecycle !== 'paused') {
      return null;
    }
    const key = `${this.index}:${phase.kind}`;
    if (key === this.lastPhaseKind) return null;
    this.lastPhaseKind = key;
    void wallMs;
    return phase;
  }

  private maxRound(): number {
    let m = 0;
    for (const p of this.phases) m = Math.max(m, p.round);
    return m;
  }

  private advanceIfNeeded(wallMs: number): void {
    // Catch up multiple timed phases using absolute phase boundaries (no drift).
    for (;;) {
      if (this.lifecycle !== 'running') return;
      const phase = this.phases[this.index];
      if (!phase || phase.durationMs === null) return;
      const t = this.clock.nowMs(wallMs);
      const phaseEnd = this.phaseStartedAt + phase.durationMs;
      if (t < phaseEnd) return;
      this.advancePhase(phaseEnd, wallMs);
    }
  }

  private advancePhase(phaseStartSessionMs: number, wallMs: number): void {
    this.index += 1;
    this.phaseStartedAt = phaseStartSessionMs;
    this.lastPhaseKind = null;
    if (this.index >= this.phases.length) {
      this.complete();
      return;
    }
    this.emit(wallMs);
  }

  private complete(): void {
    this.lifecycle = 'completing';
    this.clock.stop();
    this.emit();
    const cb = this.onComplete;
    this.lifecycle = 'growing';
    this.emit();
    cb?.();
  }

  markGrowthDone(): void {
    if (this.lifecycle !== 'growing' && this.lifecycle !== 'completing') return;
    this.resetIdle();
  }

  private resetIdle(): void {
    this.clock.stop();
    this.lifecycle = 'idle';
    this.technique = null;
    this.phases = [];
    this.index = 0;
    this.phaseStartedAt = 0;
    this.lastPhaseKind = null;
    this.emit();
  }

  private emit(wallMs?: number, snap?: BreathSnapshot): void {
    const s = snap ?? this.snapshot(wallMs);
    for (const l of this.listeners) l(s);
  }
}

/** Test helper: build phases without running. */
export function phasesFor(technique: TechniqueId): PhaseDef[] {
  return buildPhases(technique);
}

import { describe, expect, it } from 'vitest';
import { BreathEngine, phasesFor } from './BreathEngine';
import { SessionClock } from './SessionClock';

describe('SessionClock', () => {
  it('advances monotonically and freezes while paused', () => {
    const c = new SessionClock();
    c.start(1000);
    expect(c.nowMs(1500)).toBe(500);
    c.pause(1500);
    expect(c.nowMs(2000)).toBe(500);
    c.resume(2000);
    expect(c.nowMs(2500)).toBe(1000);
  });
});

describe('technique phase shapes', () => {
  it('coherence alternates inhale/exhale at 5500ms with no holds', () => {
    const phases = phasesFor('coherence');
    expect(phases.length).toBeGreaterThan(10);
    for (const p of phases) {
      expect(p.kind === 'inhale' || p.kind === 'exhale').toBe(true);
      expect(p.durationMs).toBe(5500);
    }
  });

  it('wim hof enters retention after 30 breaths then recovery hold', () => {
    const phases = phasesFor('wimHof');
    const firstRetention = phases.findIndex((p) => p.kind === 'retentionUser');
    expect(firstRetention).toBe(60); // 30 in + 30 out
    expect(phases[firstRetention].durationMs).toBeNull();
    const recovery = phases[firstRetention + 2];
    expect(recovery.kind).toBe('holdFull');
    expect(recovery.durationMs).toBe(15_000);
  });

  it('energizing produces fast cycles then rest', () => {
    const phases = phasesFor('energizing');
    const rest = phases.find((p) => p.kind === 'rest');
    expect(rest).toBeTruthy();
    expect(phases[0].durationMs).toBeLessThan(500);
  });
});

describe('BreathEngine', () => {
  function startRunning(engine: BreathEngine, technique: 'coherence' | 'wimHof' | 'energizing', t0 = 0) {
    engine.openPicker();
    engine.chooseTechnique(technique);
    engine.beginRunning(t0);
  }

  it('pauses mid-phase without skipping time', () => {
    const e = new BreathEngine();
    startRunning(e, 'coherence', 0);
    e.tick(2000);
    let snap = e.snapshot(2000);
    expect(snap.phase).toBe('inhale');
    expect(snap.phaseRemainingMs).toBe(3500);
    e.pause(2000);
    e.tick(5000);
    snap = e.snapshot(5000);
    expect(snap.lifecycle).toBe('paused');
    expect(snap.phaseRemainingMs).toBe(3500);
    e.resume(5000);
    e.tick(5000 + 3500);
    snap = e.snapshot(5000 + 3500);
    expect(snap.phase).toBe('exhale');
  });

  it('stop returns to idle without completing', () => {
    const e = new BreathEngine();
    let completed = false;
    e.setOnComplete(() => {
      completed = true;
    });
    startRunning(e, 'coherence', 0);
    e.stop();
    expect(e.getLifecycle()).toBe('idle');
    expect(completed).toBe(false);
  });

  it('endRetention advances to recovery inhale', () => {
    const e = new BreathEngine();
    startRunning(e, 'wimHof', 0);
    // Skip to retention: 30*(1800+1200)=90000ms
    e.tick(90_000);
    let snap = e.snapshot(90_000);
    expect(snap.phase).toBe('retentionUser');
    expect(snap.awaitingUserEnd).toBe(true);
    e.endRetention(91_000);
    snap = e.snapshot(91_000);
    expect(snap.phase).toBe('inhale');
    expect(snap.label).toContain('recovery');
  });

  it('finishSession during retention completes without endRetention', () => {
    const e = new BreathEngine();
    let completed = 0;
    e.setOnComplete(() => {
      completed += 1;
    });
    startRunning(e, 'wimHof', 0);
    e.tick(90_000);
    expect(e.snapshot(90_000).phase).toBe('retentionUser');
    e.finishSession();
    expect(completed).toBe(1);
    expect(e.getLifecycle()).toBe('growing');
  });

  it('finishSession and natural end share onComplete', () => {
    const e = new BreathEngine();
    let completed = 0;
    e.setOnComplete(() => {
      completed += 1;
    });
    startRunning(e, 'energizing', 0);
    e.finishSession();
    expect(completed).toBe(1);
  });
});

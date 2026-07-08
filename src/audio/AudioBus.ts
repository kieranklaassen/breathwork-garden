import * as Tone from 'tone';
import type { PhaseKind } from '../breath/types';

/**
 * All audio is synthesized. Unlock on first user gesture via ensureStarted().
 */
export class AudioBus {
  private started = false;
  private startPromise: Promise<void> | null = null;
  private muted = false;
  private master!: Tone.Gain;
  private breathSynth!: Tone.Synth;
  private sfxSynth!: Tone.MembraneSynth;
  private chimeSynth!: Tone.MetalSynth;
  private pad!: Tone.PolySynth;
  private padFilter!: Tone.Filter;
  private padLoop: Tone.Loop | null = null;
  private sessionLoops: Tone.Loop[] = [];
  private greenRatio = 0;

  async ensureStarted(): Promise<void> {
    if (this.started) return;
    if (this.startPromise) return this.startPromise;
    this.startPromise = this.boot();
    try {
      await this.startPromise;
    } finally {
      this.startPromise = null;
    }
  }

  private async boot(): Promise<void> {
    await Tone.start();
    this.master = new Tone.Gain(0.55).toDestination();
    this.breathSynth = new Tone.Synth({
      oscillator: { type: 'sine' },
      envelope: { attack: 0.08, decay: 0.2, sustain: 0.35, release: 0.6 },
    }).connect(this.master);
    this.sfxSynth = new Tone.MembraneSynth({
      envelope: { attack: 0.001, decay: 0.15, sustain: 0, release: 0.1 },
    }).connect(this.master);
    this.chimeSynth = new Tone.MetalSynth({
      envelope: { attack: 0.001, decay: 0.4, release: 0.3 },
      harmonicity: 5.1,
      modulationIndex: 16,
      resonance: 3000,
      octaves: 0.8,
    }).connect(this.master);
    this.chimeSynth.volume.value = -18;

    this.padFilter = new Tone.Filter(600, 'lowpass').connect(this.master);
    this.pad = new Tone.PolySynth(Tone.Synth, {
      oscillator: { type: 'triangle' },
      envelope: { attack: 2, decay: 1, sustain: 0.6, release: 3 },
    }).connect(this.padFilter);
    this.pad.volume.value = -28;

    this.started = true;
    this.startPad();
    this.applyMute();
  }

  setMuted(muted: boolean): void {
    this.muted = muted;
    this.applyMute();
  }

  isMuted(): boolean {
    return this.muted;
  }

  setGreenRatio(ratio: number): void {
    this.greenRatio = Math.min(1, Math.max(0, ratio));
    if (this.started) {
      this.padFilter.frequency.rampTo(600 + this.greenRatio * 1400, 1.5);
      this.pad.volume.rampTo(-28 + this.greenRatio * 6, 1.5);
    }
  }

  private applyMute(): void {
    if (!this.started) return;
    this.master.gain.rampTo(this.muted ? 0 : 0.55, 0.05);
  }

  private startPad(): void {
    if (this.padLoop) return;
    const notes = ['C3', 'E3', 'G3', 'B3', 'D4'];
    let i = 0;
    this.padLoop = new Tone.Loop((time) => {
      const n = notes[i % notes.length];
      this.pad.triggerAttackRelease(n, '2n', time, 0.15);
      i += 1;
    }, '2n');
    this.padLoop.start(0);
    Tone.getTransport().start();
  }

  footstep(): void {
    if (!this.started || this.muted) return;
    this.sfxSynth.triggerAttackRelease('C2', '16n', undefined, 0.2);
  }

  uiTick(): void {
    if (!this.started || this.muted) return;
    this.breathSynth.triggerAttackRelease('A5', '32n', undefined, 0.05);
  }

  plantChime(): void {
    if (!this.started || this.muted) return;
    const t = Tone.now();
    this.chimeSynth.triggerAttackRelease('C5', 0.3, t, 0.2);
    this.breathSynth.triggerAttackRelease('E5', '8n', t + 0.05, 0.15);
    this.breathSynth.triggerAttackRelease('G5', '8n', t + 0.12, 0.12);
  }

  onPhase(kind: PhaseKind): void {
    if (!this.started || this.muted) return;
    const t = Tone.now() + 0.02;
    switch (kind) {
      case 'inhale':
        this.breathSynth.triggerAttackRelease('E4', 0.9, t, 0.18);
        break;
      case 'exhale':
        this.breathSynth.triggerAttackRelease('C4', 0.9, t, 0.14);
        break;
      case 'holdFull':
      case 'holdEmpty':
        this.breathSynth.triggerAttackRelease('G4', 0.35, t, 0.1);
        break;
      case 'retentionUser':
        this.breathSynth.triggerAttackRelease('B3', 0.5, t, 0.12);
        break;
      case 'rest':
        this.breathSynth.triggerAttackRelease('D4', 0.4, t, 0.08);
        break;
    }
  }

  pauseSession(): void {
    // Breath cues are one-shots; pad keeps ambient. Soften pad slightly.
    if (!this.started) return;
    this.pad.volume.rampTo(-36, 0.3);
  }

  resumeSession(): void {
    if (!this.started) return;
    this.pad.volume.rampTo(-28 + this.greenRatio * 6, 0.3);
  }

  endSession(): void {
    for (const loop of this.sessionLoops) {
      loop.stop();
      loop.dispose();
    }
    this.sessionLoops = [];
    if (this.started) {
      this.pad.volume.rampTo(-28 + this.greenRatio * 6, 0.4);
    }
  }
}

import { BreathEngine } from '../breath/BreathEngine';
import type { TechniqueId } from '../breath/types';
import { AudioBus } from '../audio/AudioBus';
import {
  loadGarden,
  plantTypeForTechnique,
  saveGarden,
  type GardenSave,
} from '../persist/gardenStore';
import { Hud } from '../ui/hud';
import { isAdjacent } from '../world/pathing';
import { tileWorldPos } from '../world/pathing';
import { WorldScene } from '../world/WorldScene';

export class GameApp {
  private world: WorldScene;
  private engine = new BreathEngine();
  private audio = new AudioBus();
  private hud: Hud;
  private save: GardenSave;
  private lastPhaseKey: string | null = null;
  private retentionPeak = 0;
  private audioReady = false;
  private audioPromise: Promise<void> | null = null;

  constructor(canvas: HTMLCanvasElement, hudRoot: HTMLElement) {
    this.save = loadGarden();
    this.world = new WorldScene(canvas);
    this.world.loadGarden(this.save);

    this.hud = new Hud(hudRoot, {
      onChooseTechnique: (id) => this.chooseTechnique(id),
      onCancelPicker: () => this.cancelPicker(),
      onPause: () => this.pause(),
      onResume: () => this.resume(),
      onStop: () => this.stopSession(),
      onFinishSession: () => this.finishSession(),
      onEndRetention: () => this.endRetention(),
      onToggleMute: () => this.toggleMute(),
      onBreatheHere: () => this.openBreath(),
    });

    this.hud.setStats(
      this.save.stats.sessionsDone,
      this.save.stats.tilesGreened,
      this.save.stats.bestHoldMs,
    );
    this.audio.setGreenRatio(this.world.grid.greenRatio());

    this.engine.setOnComplete(() => this.onSessionComplete());
    this.engine.on((snap) => this.onBreathSnap(snap));

    this.world.player.setFootstepCallback(() => {
      void this.ensureAudio().then(() => this.audio.footstep());
    });

    canvas.addEventListener('pointerdown', (e) => {
      void this.ensureAudio();
      this.onPointer(e.clientX, e.clientY);
    });

    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') this.cancelPicker();
    });

    this.hud.showBreatheFab(true);
    this.loop(performance.now());
  }

  private async ensureAudio(): Promise<void> {
    if (this.audioReady) return;
    if (!this.audioPromise) {
      this.audioPromise = this.audio.ensureStarted().then(() => {
        this.audioReady = true;
        this.audio.setGreenRatio(this.world.grid.greenRatio());
      });
    }
    await this.audioPromise;
  }

  private inputLocked(): boolean {
    const life = this.engine.getLifecycle();
    return (
      life === 'techniquePick' ||
      life === 'sitting' ||
      life === 'running' ||
      life === 'paused' ||
      life === 'growing' ||
      life === 'completing' ||
      this.world.player.isBusy()
    );
  }

  private onPointer(clientX: number, clientY: number): void {
    if (this.inputLocked()) return;
    const tile = this.world.pickTile(clientX, clientY);
    if (!tile) return;

    const px = this.world.player.gridX;
    const pz = this.world.player.gridZ;

    if (tile.x === px && tile.z === pz) {
      this.openBreath();
      return;
    }

    if (!isAdjacent(px, pz, tile.x, tile.z)) return;

    const { x, z } = tileWorldPos(tile.x, tile.z);
    this.hud.showBreatheFab(false);
    this.world.player.walkTo(x, z, tile.x, tile.z, () => {
      this.persistPlayerSettle();
      this.hud.showBreatheFab(true);
    });
  }

  private openBreath(): void {
    if (this.inputLocked() && this.engine.getLifecycle() !== 'idle') return;
    if (this.world.player.isBusy()) return;
    void this.ensureAudio().then(() => this.audio.uiTick());
    this.engine.openPicker();
    this.hud.showPicker(true);
    this.hud.showBreatheFab(false);
  }

  private cancelPicker(): void {
    if (this.engine.getLifecycle() !== 'techniquePick') return;
    this.engine.cancelPicker();
    this.hud.showPicker(false);
    this.hud.showBreatheFab(true);
  }

  private chooseTechnique(id: TechniqueId): void {
    void this.ensureAudio().then(() => this.audio.uiTick());
    this.hud.showPicker(false);
    this.retentionPeak = 0;
    this.engine.chooseTechnique(id);
    this.world.setSessionFocus(true);
    this.world.player.startSit(() => {
      this.engine.beginRunning();
    });
  }

  private pause(): void {
    this.engine.pause();
    this.audio.pauseSession();
  }

  private resume(): void {
    this.engine.resume();
    this.audio.resumeSession();
  }

  private stopSession(): void {
    const life = this.engine.getLifecycle();
    if (life === 'growing' || life === 'completing') return;
    this.audio.endSession();
    this.engine.stop();
    this.world.player.standUp();
    this.world.setSessionFocus(false);
    this.world.setBreathLight(0.35);
    this.hud.showBreatheFab(true);
    this.lastPhaseKey = null;
  }

  private finishSession(): void {
    this.engine.finishSession();
  }

  private endRetention(): void {
    if (this.retentionPeak > this.save.stats.bestHoldMs) {
      this.save.stats.bestHoldMs = this.retentionPeak;
    }
    this.engine.endRetention();
  }

  private toggleMute(): void {
    void this.ensureAudio().then(() => {
      this.audio.setMuted(!this.audio.isMuted());
      this.hud.setMuted(this.audio.isMuted());
    });
  }

  private onBreathSnap(snap: import('../breath/types').BreathSnapshot): void {
    this.hud.updateSession(snap);
    this.world.player.setBreathFill(snap.breathFill01);
    this.world.setBreathLight(snap.breathFill01);

    if (snap.awaitingUserEnd) {
      this.retentionPeak = Math.max(this.retentionPeak, snap.retentionElapsedMs);
    }

    if (snap.lifecycle === 'running' && snap.phase) {
      const key = `${snap.round}:${snap.cycle}:${snap.phase}:${snap.label}`;
      if (key !== this.lastPhaseKey) {
        this.lastPhaseKey = key;
        this.audio.onPhase(snap.phase);
      }
    }

    if (snap.lifecycle === 'idle') {
      this.hud.showPicker(false);
    }
  }

  private onSessionComplete(): void {
    this.audio.endSession();
    const technique = this.engine.getTechnique();
    const gx = this.world.player.gridX;
    const gz = this.world.player.gridZ;

    if (this.retentionPeak > this.save.stats.bestHoldMs) {
      this.save.stats.bestHoldMs = this.retentionPeak;
    }

    const wasSand =
      this.world.grid.getTile(gx, gz)?.data.terrain === 'sand';

    if (!technique) {
      this.finishGrowthCleanup();
      return;
    }

    const plantType = plantTypeForTechnique(technique);
    void this.ensureAudio().then(() => this.audio.plantChime());

    this.world.grid.growPlant(gx, gz, plantType, technique, () => {
      this.save.stats.sessionsDone += 1;
      if (wasSand) this.save.stats.tilesGreened += 1;
      this.save.tiles = this.world.grid.exportTiles();
      this.save.playerPos = { x: gx, z: gz };
      saveGarden(this.save);
      this.audio.setGreenRatio(this.world.grid.greenRatio());
      this.hud.setStats(
        this.save.stats.sessionsDone,
        this.save.stats.tilesGreened,
        this.save.stats.bestHoldMs,
      );
      this.finishGrowthCleanup();
    });
  }

  private finishGrowthCleanup(): void {
    this.engine.markGrowthDone();
    this.world.player.standUp();
    this.world.setSessionFocus(false);
    this.world.setBreathLight(0.35);
    this.hud.showBreatheFab(true);
    this.lastPhaseKey = null;
    this.hud.updateSession(this.engine.snapshot());
  }

  private persistPlayerSettle(): void {
    this.save.playerPos = {
      x: this.world.player.gridX,
      z: this.world.player.gridZ,
    };
    this.save.tiles = this.world.grid.exportTiles();
    saveGarden(this.save);
  }

  private loop(prev: number): void {
    const frame = (now: number) => {
      const dt = Math.min(0.05, (now - prev) / 1000);
      prev = now;
      this.engine.tick(now);
      this.world.update(dt, now * 0.001);
      this.world.render();
      requestAnimationFrame(frame);
    };
    requestAnimationFrame(frame);
  }
}

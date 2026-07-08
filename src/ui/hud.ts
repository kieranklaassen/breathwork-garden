import type { BreathSnapshot } from '../breath/types';
import { TECHNIQUES, type TechniqueId } from '../breath/types';

export interface HudHandlers {
  onChooseTechnique: (id: TechniqueId) => void;
  onCancelPicker: () => void;
  onPause: () => void;
  onResume: () => void;
  onStop: () => void;
  onFinishSession: () => void;
  onEndRetention: () => void;
  onToggleMute: () => void;
  onBreatheHere: () => void;
}

export class Hud {
  private root: HTMLElement;
  private handlers: HudHandlers;

  constructor(root: HTMLElement, handlers: HudHandlers) {
    this.root = root;
    this.handlers = handlers;
    this.renderShell();
  }

  private renderShell(): void {
    this.root.innerHTML = `
      <div class="hud-top">
        <div class="brand">Breathwork Garden</div>
        <div class="stats" id="stats-line"></div>
        <button type="button" class="icon-btn" id="mute-btn" aria-label="Mute">🔊</button>
      </div>
      <div class="hint" id="world-hint">Click a neighboring tile to walk. Click your tile to breathe.</div>
      <div class="session-panel hidden" id="session-panel">
        <div class="phase-label" id="phase-label"></div>
        <div class="phase-count" id="phase-count"></div>
        <div class="progress-line" id="progress-line"></div>
        <div class="breath-ring" id="breath-ring"><div class="breath-core" id="breath-core"></div></div>
        <div class="session-actions">
          <button type="button" id="pause-btn">Pause</button>
          <button type="button" id="stop-btn">Stop</button>
          <button type="button" class="dev-btn" id="finish-btn">Finish session</button>
        </div>
        <button type="button" class="retention-btn hidden" id="retention-btn">Tap to end hold</button>
        <p class="safety hidden" id="safety-note">Practice seated. Stop if dizzy. Not medical advice.</p>
      </div>
      <div class="picker hidden" id="picker">
        <h2>Choose a breath</h2>
        <div class="picker-list" id="picker-list"></div>
        <button type="button" class="ghost" id="picker-cancel">Cancel</button>
      </div>
      <button type="button" class="breathe-fab hidden" id="breathe-fab">Breathe here</button>
    `;

    const list = this.root.querySelector('#picker-list')!;
    for (const t of TECHNIQUES) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'tech-card';
      btn.innerHTML = `<strong>${t.name}</strong><span>${t.blurb}</span>`;
      btn.addEventListener('click', () => this.handlers.onChooseTechnique(t.id));
      list.appendChild(btn);
    }

    this.root.querySelector('#picker-cancel')!.addEventListener('click', () => {
      this.handlers.onCancelPicker();
    });
    this.root.querySelector('#pause-btn')!.addEventListener('click', () => {
      const btn = this.root.querySelector('#pause-btn') as HTMLButtonElement;
      if (btn.dataset.mode === 'resume') this.handlers.onResume();
      else this.handlers.onPause();
    });
    this.root.querySelector('#stop-btn')!.addEventListener('click', () => {
      this.handlers.onStop();
    });
    this.root.querySelector('#finish-btn')!.addEventListener('click', () => {
      this.handlers.onFinishSession();
    });
    this.root.querySelector('#retention-btn')!.addEventListener('click', () => {
      this.handlers.onEndRetention();
    });
    this.root.querySelector('#mute-btn')!.addEventListener('click', () => {
      this.handlers.onToggleMute();
    });
    this.root.querySelector('#breathe-fab')!.addEventListener('click', () => {
      this.handlers.onBreatheHere();
    });
  }

  setMuted(muted: boolean): void {
    const btn = this.root.querySelector('#mute-btn')!;
    btn.textContent = muted ? '🔇' : '🔊';
  }

  setStats(sessions: number, greened: number, bestHoldMs: number): void {
    const el = this.root.querySelector('#stats-line')!;
    const hold =
      bestHoldMs > 0 ? ` · best hold ${Math.round(bestHoldMs / 1000)}s` : '';
    el.textContent = `${sessions} sessions · ${greened} tiles greened${hold}`;
  }

  showPicker(show: boolean): void {
    this.root.querySelector('#picker')!.classList.toggle('hidden', !show);
    this.root.querySelector('#world-hint')!.classList.toggle('hidden', show);
  }

  showBreatheFab(show: boolean): void {
    this.root.querySelector('#breathe-fab')!.classList.toggle('hidden', !show);
  }

  updateSession(snap: BreathSnapshot): void {
    const panel = this.root.querySelector('#session-panel')!;
    const active =
      snap.lifecycle === 'running' ||
      snap.lifecycle === 'paused' ||
      snap.lifecycle === 'sitting' ||
      snap.lifecycle === 'growing';
    panel.classList.toggle('hidden', !active && snap.lifecycle !== 'techniquePick');

    if (snap.lifecycle === 'techniquePick') {
      panel.classList.add('hidden');
      return;
    }

    if (!active) {
      panel.classList.add('hidden');
      return;
    }

    panel.classList.remove('hidden');
    const label = this.root.querySelector('#phase-label')!;
    const count = this.root.querySelector('#phase-count')!;
    const progress = this.root.querySelector('#progress-line')!;
    const core = this.root.querySelector('#breath-core') as HTMLElement;
    const ring = this.root.querySelector('#breath-ring') as HTMLElement;
    const retention = this.root.querySelector('#retention-btn')!;
    const safety = this.root.querySelector('#safety-note')!;
    const pauseBtn = this.root.querySelector('#pause-btn') as HTMLButtonElement;

    label.textContent = snap.label || '…';
    if (snap.awaitingUserEnd) {
      count.textContent = formatMs(snap.retentionElapsedMs);
    } else if (snap.phaseRemainingMs != null) {
      count.textContent = `${Math.ceil(snap.phaseRemainingMs / 1000)}s`;
    } else {
      count.textContent = '';
    }

    if (snap.totalRounds > 0 && snap.round > 0) {
      progress.textContent = `Round ${snap.round}/${snap.totalRounds} · cycle ${snap.cycle}`;
    } else {
      progress.textContent = '';
    }

    const scale = 0.65 + snap.breathFill01 * 0.55;
    core.style.transform = `scale(${scale})`;
    ring.style.opacity = String(0.35 + snap.breathFill01 * 0.5);

    retention.classList.toggle('hidden', !snap.awaitingUserEnd);
    safety.classList.toggle('hidden', snap.technique !== 'wimHof');

    if (snap.lifecycle === 'paused') {
      pauseBtn.textContent = 'Resume';
      pauseBtn.dataset.mode = 'resume';
    } else {
      pauseBtn.textContent = 'Pause';
      pauseBtn.dataset.mode = 'pause';
    }

    pauseBtn.disabled = snap.lifecycle === 'sitting' || snap.lifecycle === 'growing';
    (this.root.querySelector('#finish-btn') as HTMLButtonElement).disabled =
      snap.lifecycle === 'growing';
  }
}

function formatMs(ms: number): string {
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  const r = s % 60;
  return m > 0 ? `${m}:${r.toString().padStart(2, '0')}` : `${r}s`;
}

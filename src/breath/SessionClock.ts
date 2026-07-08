/** Monotonic session clock with pause support — no phase drift. */
export class SessionClock {
  private startedAt = 0;
  private pauseTotalMs = 0;
  private pauseBeganAt: number | null = null;
  private running = false;

  start(nowMs: number = performance.now()): void {
    this.startedAt = nowMs;
    this.pauseTotalMs = 0;
    this.pauseBeganAt = null;
    this.running = true;
  }

  pause(nowMs: number = performance.now()): void {
    if (!this.running || this.pauseBeganAt !== null) return;
    this.pauseBeganAt = nowMs;
  }

  resume(nowMs: number = performance.now()): void {
    if (this.pauseBeganAt === null) return;
    this.pauseTotalMs += nowMs - this.pauseBeganAt;
    this.pauseBeganAt = null;
  }

  stop(): void {
    this.running = false;
    this.pauseBeganAt = null;
  }

  isPaused(): boolean {
    return this.pauseBeganAt !== null;
  }

  isRunning(): boolean {
    return this.running;
  }

  nowMs(wallMs: number = performance.now()): number {
    if (!this.running) return 0;
    const pausedExtra = this.pauseBeganAt !== null ? wallMs - this.pauseBeganAt : 0;
    return wallMs - this.startedAt - this.pauseTotalMs - pausedExtra;
  }
}

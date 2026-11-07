/**
 * 固定ステップ更新 + 可変レンダリングのゲームループ。
 * 物理・経済の更新は FIXED_DT 秒ごとに決定的に進み、描画は毎フレーム行う。
 *
 * ウィンドウが隠れて requestAnimationFrame が止まった場合は、
 * setInterval によるフォールバックで更新だけを続ける（描画はしない）。
 */
export const FIXED_DT = 1 / 60;
const MAX_FRAME_DT = 0.25; // タブ復帰時などの大ジャンプを抑制
const BACKGROUND_TICK_MS = 200;
const RAF_STALL_MS = 250;

export interface Loopable {
  update(dt: number): void;
  render(alpha: number): void;
}

export class GameLoop {
  private running = false;
  private last = 0;
  /** requestAnimationFrame が最後に呼ばれた時刻（停止検知用） */
  private lastRaf = 0;
  private acc = 0;
  private bgTimer: ReturnType<typeof setInterval> | null = null;

  constructor(private target: Loopable) {}

  start(): void {
    if (this.running) return;
    this.running = true;
    this.last = performance.now();
    this.lastRaf = this.last;
    requestAnimationFrame(this.frame);
    this.bgTimer = setInterval(this.backgroundTick, BACKGROUND_TICK_MS);
  }

  stop(): void {
    this.running = false;
    if (this.bgTimer !== null) {
      clearInterval(this.bgTimer);
      this.bgTimer = null;
    }
  }

  /** 経過時間ぶんの固定ステップ更新を進める */
  private advance(now: number): void {
    let dt = (now - this.last) / 1000;
    this.last = now;
    if (dt > MAX_FRAME_DT) dt = MAX_FRAME_DT;
    this.acc += dt;
    while (this.acc >= FIXED_DT) {
      this.target.update(FIXED_DT);
      this.acc -= FIXED_DT;
    }
  }

  private frame = (now: number): void => {
    if (!this.running) return;
    this.lastRaf = now;
    this.advance(now);
    this.target.render(this.acc / FIXED_DT);
    requestAnimationFrame(this.frame);
  };

  private backgroundTick = (): void => {
    if (!this.running) return;
    const now = performance.now();
    // rAF が正常に動いていれば何もしない
    if (now - this.lastRaf < RAF_STALL_MS) return;
    this.advance(now);
  };
}

/**
 * 固定ステップ更新 + 可変レンダリングのゲームループ。
 * 物理・経済の更新は FIXED_DT 秒ごとに決定的に進み、描画は毎フレーム行う。
 */
export const FIXED_DT = 1 / 60;
const MAX_FRAME_DT = 0.25; // タブ復帰時などの大ジャンプを抑制

export interface Loopable {
  update(dt: number): void;
  render(alpha: number): void;
}

export class GameLoop {
  private running = false;
  private last = 0;
  private acc = 0;

  constructor(private target: Loopable) {}

  start(): void {
    if (this.running) return;
    this.running = true;
    this.last = performance.now();
    requestAnimationFrame(this.frame);
  }

  stop(): void {
    this.running = false;
  }

  private frame = (now: number): void => {
    if (!this.running) return;
    let dt = (now - this.last) / 1000;
    this.last = now;
    if (dt > MAX_FRAME_DT) dt = MAX_FRAME_DT;
    this.acc += dt;
    while (this.acc >= FIXED_DT) {
      this.target.update(FIXED_DT);
      this.acc -= FIXED_DT;
    }
    this.target.render(this.acc / FIXED_DT);
    requestAnimationFrame(this.frame);
  };
}

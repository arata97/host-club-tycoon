/**
 * 論理解像度の低い Canvas を整数倍に拡大して描画する、ドット絵用の画面管理。
 * 描画は常に論理座標（LOGICAL_W × LOGICAL_H）で行い、CSS 側で拡大する。
 */
export const LOGICAL_W = 480;
export const LOGICAL_H = 300;

export class PixelCanvas {
  readonly el: HTMLCanvasElement;
  readonly ctx: CanvasRenderingContext2D;
  scale = 1;

  constructor(el: HTMLCanvasElement) {
    this.el = el;
    el.width = LOGICAL_W;
    el.height = LOGICAL_H;
    const ctx = el.getContext("2d", { alpha: false });
    if (!ctx) throw new Error("2D context を取得できませんでした");
    this.ctx = ctx;
    this.ctx.imageSmoothingEnabled = false;
    this.fit();
    window.addEventListener("resize", () => this.fit());
  }

  /** ウィンドウに収まる最大の整数倍率にする */
  fit(): void {
    const sx = Math.floor(window.innerWidth / LOGICAL_W);
    const sy = Math.floor(window.innerHeight / LOGICAL_H);
    this.scale = Math.max(1, Math.min(sx, sy));
    this.el.style.width = `${LOGICAL_W * this.scale}px`;
    this.el.style.height = `${LOGICAL_H * this.scale}px`;
  }

  /** 画面座標（clientX/Y）を論理座標へ変換 */
  toLogical(clientX: number, clientY: number): { x: number; y: number } {
    const r = this.el.getBoundingClientRect();
    return {
      x: (clientX - r.left) / this.scale,
      y: (clientY - r.top) / this.scale,
    };
  }
}

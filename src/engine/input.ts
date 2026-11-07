import type { PixelCanvas } from "./canvas";

export interface Vec2 {
  x: number;
  y: number;
}

/**
 * WASD / 矢印キー と マウスドラッグ仮想スティックの両対応入力。
 * `axis()` が -1..1 の正規化済み移動ベクトルを返す。
 */
export class Input {
  private keys = new Set<string>();
  private dragOrigin: Vec2 | null = null;
  private dragCurrent: Vec2 | null = null;
  /** 仮想スティックの最大半径（論理px） */
  readonly stickRadius = 40;

  constructor(canvas: PixelCanvas) {
    window.addEventListener("keydown", (e) => {
      this.keys.add(e.code);
      if (e.code.startsWith("Arrow")) e.preventDefault();
    });
    window.addEventListener("keyup", (e) => this.keys.delete(e.code));
    window.addEventListener("blur", () => this.keys.clear());

    const el = canvas.el;
    el.addEventListener("pointerdown", (e) => {
      try {
        el.setPointerCapture(e.pointerId);
      } catch {
        /* キャプチャ不可でもドラッグ自体は続行する */
      }
      this.dragOrigin = canvas.toLogical(e.clientX, e.clientY);
      this.dragCurrent = { ...this.dragOrigin };
    });
    el.addEventListener("pointermove", (e) => {
      if (this.dragOrigin) this.dragCurrent = canvas.toLogical(e.clientX, e.clientY);
    });
    const end = () => {
      this.dragOrigin = null;
      this.dragCurrent = null;
    };
    el.addEventListener("pointerup", end);
    el.addEventListener("pointercancel", end);
  }

  /** 移動入力。キーボード優先、なければドラッグ。長さは最大 1 */
  axis(): Vec2 {
    let x = 0;
    let y = 0;
    if (this.keys.has("KeyA") || this.keys.has("ArrowLeft")) x -= 1;
    if (this.keys.has("KeyD") || this.keys.has("ArrowRight")) x += 1;
    if (this.keys.has("KeyW") || this.keys.has("ArrowUp")) y -= 1;
    if (this.keys.has("KeyS") || this.keys.has("ArrowDown")) y += 1;

    if (x === 0 && y === 0 && this.dragOrigin && this.dragCurrent) {
      x = this.dragCurrent.x - this.dragOrigin.x;
      y = this.dragCurrent.y - this.dragOrigin.y;
      const len = Math.hypot(x, y);
      if (len < 4) return { x: 0, y: 0 }; // デッドゾーン
      const k = Math.min(1, len / this.stickRadius) / len;
      return { x: x * k, y: y * k };
    }

    const len = Math.hypot(x, y);
    return len > 0 ? { x: x / len, y: y / len } : { x: 0, y: 0 };
  }

  /** 仮想スティックの描画用。ドラッグ中のみ値を返す */
  stick(): { origin: Vec2; current: Vec2 } | null {
    if (!this.dragOrigin || !this.dragCurrent) return null;
    return { origin: this.dragOrigin, current: this.dragCurrent };
  }
}

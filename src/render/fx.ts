interface FloatingText {
  x: number;
  y: number;
  text: string;
  color: string;
  life: number;
}

/** 売上などの浮かび上がるテキスト */
export class FloatingTexts {
  private items: FloatingText[] = [];

  add(x: number, y: number, text: string, color = "#f6c453"): void {
    this.items.push({ x, y, text, color, life: 1.2 });
  }

  update(dt: number): void {
    for (const t of this.items) {
      t.life -= dt;
      t.y -= 18 * dt;
    }
    this.items = this.items.filter((t) => t.life > 0);
  }

  draw(ctx: CanvasRenderingContext2D): void {
    ctx.font = "bold 8px monospace";
    ctx.textAlign = "center";
    for (const t of this.items) {
      ctx.globalAlpha = Math.min(1, t.life);
      ctx.fillStyle = "#000";
      ctx.fillText(t.text, Math.round(t.x) + 1, Math.round(t.y) + 1);
      ctx.fillStyle = t.color;
      ctx.fillText(t.text, Math.round(t.x), Math.round(t.y));
    }
    ctx.globalAlpha = 1;
    ctx.textAlign = "left";
  }
}

interface FloatingText {
  x: number;
  y: number;
  text: string;
  color: string;
  life: number;
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  color: string;
  life: number;
  size: number;
}

const COIN_COLORS = ["#f6c453", "#ffd166", "#fff2b0"];
const CONFETTI_COLORS = ["#ff8fb3", "#f6c453", "#8fd3ff", "#c77dff", "#7bd88f"];
const MAX_PARTICLES = 160;

function pick(colors: readonly string[]): string {
  return colors[Math.floor(Math.random() * colors.length)] ?? "#fff";
}

/** コインや紙吹雪の粒 */
export class Particles {
  private items: Particle[] = [];

  /** 売上のコインが弾ける */
  coins(x: number, y: number, count: number): void {
    for (let i = 0; i < count && this.items.length < MAX_PARTICLES; i++) {
      this.items.push({
        x,
        y,
        vx: (Math.random() - 0.5) * 60,
        vy: -30 - Math.random() * 40,
        color: pick(COIN_COLORS),
        life: 0.6 + Math.random() * 0.3,
        size: 2,
      });
    }
  }

  /** 紙吹雪を1枚、画面の上から降らせる */
  confetti(width: number): void {
    if (this.items.length >= MAX_PARTICLES) return;
    this.items.push({
      x: Math.random() * width,
      y: 40,
      vx: (Math.random() - 0.5) * 20,
      vy: 30 + Math.random() * 30,
      color: pick(CONFETTI_COLORS),
      life: 3,
      size: 2,
    });
  }

  update(dt: number): void {
    for (const p of this.items) {
      p.life -= dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      if (p.size === 2 && p.vy < 200) p.vy += 90 * dt;
    }
    this.items = this.items.filter((p) => p.life > 0);
  }

  draw(ctx: CanvasRenderingContext2D): void {
    for (const p of this.items) {
      ctx.fillStyle = p.color;
      ctx.fillRect(Math.round(p.x), Math.round(p.y), p.size, p.size);
    }
  }
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

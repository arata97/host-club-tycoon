/**
 * 効果音。Web Audio で合成するので音声ファイルを持たない。
 * ブラウザの自動再生制限があるため、最初のキー入力・クリックで AudioContext を作る。
 */

export type SfxName =
  | "pickup"
  | "serve"
  | "sale"
  | "bigSale"
  | "angry"
  | "checkout"
  | "vip"
  | "buy"
  | "gacha"
  | "rare"
  | "god"
  | "open"
  | "close"
  | "call"
  | "move"
  | "bankrupt";

interface Note {
  /** 周波数（Hz） */
  f: number;
  /** 開始（秒） */
  t: number;
  /** 長さ（秒） */
  d: number;
  w?: OscillatorType;
  v?: number;
  /** この周波数まで滑らせる */
  to?: number;
}

const up = (freqs: number[], step: number, d: number, w: OscillatorType = "triangle", v = 0.14): Note[] =>
  freqs.map((f, i) => ({ f, t: i * step, d, w, v }));

const SOUNDS: Record<SfxName, Note[]> = {
  pickup: [{ f: 660, t: 0, d: 0.05, w: "square", v: 0.04 }],
  serve: up([523, 784], 0.05, 0.07),
  sale: up([988, 1319], 0.06, 0.09, "square", 0.05),
  bigSale: up([784, 988, 1175, 1568], 0.05, 0.12, "square", 0.07),
  angry: [{ f: 220, to: 110, t: 0, d: 0.28, w: "sawtooth", v: 0.08 }],
  checkout: up([1047, 1319], 0.04, 0.05, "triangle", 0.1),
  vip: up([659, 880, 1109], 0.09, 0.2, "triangle", 0.13),
  buy: up([392, 523, 659], 0.05, 0.08),
  gacha: [{ f: 300, to: 900, t: 0, d: 0.35, w: "triangle", v: 0.12 }],
  rare: up([659, 784, 988, 1319, 1568], 0.08, 0.25),
  god: [...up([523, 659, 784, 1047, 1319, 1568, 2093], 0.1, 0.5, "sine", 0.16), { f: 261, t: 0, d: 1.2, w: "triangle", v: 0.12 }],
  open: up([392, 494, 587, 784], 0.1, 0.18),
  close: up([784, 587, 494, 392], 0.12, 0.22),
  call: [...up([523, 523, 659, 784, 1047], 0.09, 0.14, "square", 0.08), { f: 2000, to: 500, t: 0.5, d: 0.3, w: "sawtooth", v: 0.04 }],
  move: up([392, 523, 659, 784, 1047], 0.12, 0.3),
  bankrupt: [{ f: 330, to: 82, t: 0, d: 1.1, w: "sawtooth", v: 0.1 }],
};

const MUTE_KEY = "hct-muted";
const MASTER_VOLUME = 0.6;
/** 同じ音を重ねないための間隔（秒） */
const MIN_INTERVAL = 0.05;

class Sfx {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private readonly lastPlayed = new Map<SfxName, number>();
  muted = false;

  /** 最初の操作で音を鳴らせるようにする */
  attach(): void {
    try {
      this.muted = localStorage.getItem(MUTE_KEY) === "1";
    } catch {
      /* noop */
    }
    const unlock = () => this.unlock();
    window.addEventListener("pointerdown", unlock);
    window.addEventListener("keydown", unlock);
  }

  private unlock(): void {
    if (!this.ctx) {
      this.ctx = new AudioContext();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.muted ? 0 : MASTER_VOLUME;
      this.master.connect(this.ctx.destination);
    }
    if (this.ctx.state === "suspended") void this.ctx.resume();
  }

  toggleMute(): boolean {
    this.muted = !this.muted;
    if (this.master) this.master.gain.value = this.muted ? 0 : MASTER_VOLUME;
    try {
      localStorage.setItem(MUTE_KEY, this.muted ? "1" : "0");
    } catch {
      /* noop */
    }
    return this.muted;
  }

  play(name: SfxName): void {
    const { ctx, master } = this;
    if (!ctx || !master || this.muted || ctx.state !== "running") return;
    const now = ctx.currentTime;
    if (now - (this.lastPlayed.get(name) ?? -1) < MIN_INTERVAL) return;
    this.lastPlayed.set(name, now);
    for (const n of SOUNDS[name]) {
      const start = now + n.t;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = n.w ?? "triangle";
      osc.frequency.setValueAtTime(n.f, start);
      if (n.to) osc.frequency.exponentialRampToValueAtTime(n.to, start + n.d);
      gain.gain.setValueAtTime(n.v ?? 0.12, start);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + n.d);
      osc.connect(gain).connect(master);
      osc.start(start);
      osc.stop(start + n.d + 0.02);
    }
  }
}

/** ゲーム全体で1つの効果音プレイヤー */
export const sfx = new Sfx();

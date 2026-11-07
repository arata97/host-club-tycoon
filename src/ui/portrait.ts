import type { HostDef } from "../game/data/hosts";
import type { PersonPalette } from "../render/palette";
import { drawPerson } from "../render/people";

const SILHOUETTE: PersonPalette = { suit: "#2a2440", shirt: "#2a2440", skin: "#2a2440", hair: "#2a2440" };

/**
 * ホストの小さな立ち絵（Canvas）を作る。図鑑・ガチャ結果で使う。
 * owned=false ならシルエット。
 */
export function createPortrait(def: HostDef, owned: boolean, scale = 2): HTMLCanvasElement {
  const w = 24;
  const h = 26;
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  c.className = "portrait";
  c.style.width = `${w * scale}px`;
  c.style.height = `${h * scale}px`;
  const ctx = c.getContext("2d");
  if (ctx) {
    ctx.imageSmoothingEnabled = false;
    drawPerson(ctx, w / 2, h - 3, owned ? def.palette : SILHOUETTE, 0, 1);
  }
  return c;
}

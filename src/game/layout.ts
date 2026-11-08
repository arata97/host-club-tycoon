import type { SeatGrade } from "./data/shops";

/** 店内レイアウト（論理座標）。描画とロジックの両方から参照する。 */

export const WALL_BOTTOM = 40;
export const ENTRANCE = { x: 22, y: 282 } as const;
export const CELLAR_POS = { x: 430, y: 70 } as const;
/** ホストの待機席（右端に縦に並び、8人を超えると2列目へ） */
export const HOST_STANDBY = { x: 462, y: 122, gap: 19, perColumn: 8, columnGap: 24 } as const;

export function standbyPos(i: number): { x: number; y: number } {
  const col = Math.floor(i / HOST_STANDBY.perColumn);
  return {
    x: HOST_STANDBY.x - col * HOST_STANDBY.columnGap,
    y: HOST_STANDBY.y + (i % HOST_STANDBY.perColumn) * HOST_STANDBY.gap,
  };
}

const GENERAL_XS = [70, 150, 230, 310, 390];

/** 席の配置。奥の列が上位席、手前の2列が一般席 */
export const SEAT_SLOTS: Record<SeatGrade, ReadonlyArray<{ x: number; y: number }>> = {
  general: [...GENERAL_XS.map((x) => ({ x, y: 160 })), ...GENERAL_XS.map((x) => ({ x, y: 240 }))],
  vip: [
    { x: 50, y: 90 },
    { x: 105, y: 90 },
    { x: 160, y: 90 },
  ],
  exe: [
    { x: 225, y: 90 },
    { x: 285, y: 90 },
  ],
  god: [{ x: 350, y: 90 }],
};

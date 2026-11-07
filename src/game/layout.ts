/** 店内レイアウト（論理座標）。描画とロジックの両方から参照する。 */

export const WALL_BOTTOM = 40;
export const ENTRANCE = { x: 22, y: 282 } as const;
export const CELLAR_POS = { x: 430, y: 70 } as const;
/** ホストの待機席（右端に縦に並ぶ） */
export const HOST_STANDBY = { x: 455, y: 122, gap: 19 } as const;
export const TABLE_SLOTS: ReadonlyArray<{ x: number; y: number }> = [
  { x: 80, y: 135 },
  { x: 175, y: 135 },
  { x: 270, y: 135 },
  { x: 365, y: 135 },
  { x: 80, y: 230 },
  { x: 175, y: 230 },
  { x: 270, y: 230 },
  { x: 365, y: 230 },
];

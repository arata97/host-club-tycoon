import { LOGICAL_H, LOGICAL_W } from "../engine/canvas";
import type { Vec2 } from "../engine/input";
import { CELLAR, CUSTOMER, PLAYER } from "./data/balance";
import { maxGradeForCellar, rollOrder } from "./data/products";
import { Cellar } from "./entities/cellar";
import { Customer } from "./entities/customer";
import { Host, type HostWorld } from "./entities/host";
import { Table } from "./entities/table";
import { Player } from "./player";
import type { GameState } from "./state";
import { distance, FloatingTexts, formatG } from "./util";

/** 店内レイアウト（論理座標） */
const WALL_BOTTOM = 40;
const ENTRANCE = { x: 22, y: 282 };
const CELLAR_POS = { x: 430, y: 70 };
const TABLE_SLOTS: ReadonlyArray<{ x: number; y: number }> = [
  { x: 90, y: 135 },
  { x: 185, y: 135 },
  { x: 280, y: 135 },
  { x: 375, y: 135 },
  { x: 90, y: 230 },
  { x: 185, y: 230 },
  { x: 280, y: 230 },
  { x: 375, y: 230 },
];
const HOST_NAMES = ["蓮", "翔", "ユウ", "ガロン", "海斗", "コタロウ"];

/**
 * 店舗1フロアのシミュレーション。エンティティの生成・相互作用・描画を担当する。
 * 永続データは GameState が持ち、World は毎フレームそれを参照・更新する。
 */
export class World implements HostWorld {
  readonly player = new Player(LOGICAL_W / 2, LOGICAL_H / 2 + 20);
  readonly cellar = new Cellar(CELLAR_POS.x, CELLAR_POS.y);
  readonly tables: Table[] = [];
  readonly hosts: Host[] = [];
  private customers: Customer[] = [];
  private readonly floats = new FloatingTexts();
  private spawnT = 3;
  private pickupT = 0;
  private serveT = 0;
  /** 直近に提供した売上（HUD演出用） */
  lastSale: { text: string; t: number } | null = null;

  constructor(private readonly state: GameState) {
    this.syncWithState();
  }

  /** テーブル数・ホスト数などを GameState に合わせる（購入後に呼ぶ） */
  syncWithState(): void {
    while (this.tables.length < this.state.tableCount) {
      const slot = TABLE_SLOTS[this.tables.length];
      if (!slot) break;
      this.tables.push(new Table(slot.x, slot.y));
    }
    while (this.hosts.length < this.state.hostCount) {
      const name = HOST_NAMES[this.hosts.length % HOST_NAMES.length] ?? "ホスト";
      this.hosts.push(new Host(this.cellar.interactX - 20 + this.hosts.length * 8, this.cellar.interactY + 10, name));
    }
  }

  onServed(table: Table, _server: Host | Player): void {
    const c = table.customer;
    if (!c) return;
    this.floats.add(table.x, table.y - 24, "提供!", "#8fd3ff");
  }

  update(dt: number, axis: Vec2): void {
    const s = this.state;

    // 主人公
    this.player.update(dt, axis, Player.speedFor(s.upgrades.speed), { w: LOGICAL_W, h: LOGICAL_H, top: WALL_BOTTOM + 12 });

    // 酒蔵の補充
    this.cellar.update(dt, s.cellarLevel);

    // 主人公: 自動回収
    this.pickupT += dt;
    const carryMax = Player.carryFor(s.upgrades.carry);
    if (
      this.player.carrying < carryMax &&
      distance(this.player, { x: this.cellar.interactX, y: this.cellar.interactY }) < PLAYER.interactRadius
    ) {
      if (this.pickupT >= CELLAR.pickupInterval && this.cellar.take()) {
        this.pickupT = 0;
        this.player.carrying += 1;
      }
    }

    // 主人公: 自動提供
    this.serveT += dt;
    if (this.player.carrying > 0 && this.serveT >= PLAYER.serveInterval) {
      for (const t of this.tables) {
        if (!t.needsService) continue;
        if (distance(this.player, { x: t.serveX, y: t.serveY }) < PLAYER.interactRadius) {
          if (t.customer?.serve()) {
            this.player.carrying -= 1;
            this.serveT = 0;
            if (t.claimedBy) t.claimedBy = null;
            this.onServed(t, this.player);
          }
          break;
        }
      }
    }

    // ホスト
    for (const h of this.hosts) h.update(dt, this);

    // 客の生成
    this.spawnT -= dt;
    if (this.spawnT <= 0) {
      this.spawnT = this.spawnInterval();
      this.trySpawnCustomer();
    }

    // 客の更新
    for (const c of this.customers) {
      const ev = c.update(dt);
      if (ev === "paid") {
        const amount = c.price;
        s.earn(amount);
        this.floats.add(c.table.x, c.table.y - 30, `+${formatG(amount)}`, c.vip ? "#ffd166" : "#f6c453");
        this.lastSale = { text: `${c.vip ? "VIP " : ""}${c.order.name} ${formatG(amount)}`, t: 3 };
      } else if (ev === "gaveUp") {
        this.floats.add(c.table.x, c.table.y - 30, "帰った…", "#ff6b6b");
      }
    }
    this.customers = this.customers.filter((c) => c.phase !== "gone");

    this.floats.update(dt);
    if (this.lastSale) {
      this.lastSale.t -= dt;
      if (this.lastSale.t <= 0) this.lastSale = null;
    }
  }

  private spawnInterval(): number {
    const n = this.state.tableCount;
    return Math.max(CUSTOMER.spawnIntervalMin, CUSTOMER.spawnIntervalBase - 0.5 * (n - 1));
  }

  private trySpawnCustomer(): void {
    const free = this.tables.filter((t) => t.isFree);
    const table = free[Math.floor(Math.random() * free.length)];
    if (!table) return;
    const vip = Math.random() < CUSTOMER.vipChance;
    const order = rollOrder(maxGradeForCellar(this.state.cellarLevel), vip);
    const c = new Customer(ENTRANCE.x, ENTRANCE.y, table, order, vip, ENTRANCE.x, ENTRANCE.y);
    table.customer = c;
    this.customers.push(c);
    if (vip) this.floats.add(ENTRANCE.x + 20, ENTRANCE.y - 30, "VIP来店!", "#ffd166");
  }

  render(ctx: CanvasRenderingContext2D): void {
    this.drawRoom(ctx);
    this.cellar.draw(ctx, this.state.cellarLevel);
    for (const t of this.tables) t.draw(ctx);

    // 人物は y 順に描いて前後関係を出す
    const people: Array<{ y: number; draw: () => void }> = [
      { y: this.player.y, draw: () => this.player.draw(ctx) },
      ...this.hosts.map((h) => ({ y: h.y, draw: () => h.draw(ctx) })),
      ...this.customers.map((c) => ({ y: c.y, draw: () => c.draw(ctx) })),
    ];
    people.sort((a, b) => a.y - b.y);
    for (const p of people) p.draw();

    this.floats.draw(ctx);
  }

  private drawRoom(ctx: CanvasRenderingContext2D): void {
    ctx.fillStyle = "#2a1f3d";
    ctx.fillRect(0, 0, LOGICAL_W, LOGICAL_H);
    const tile = 20;
    for (let y = WALL_BOTTOM; y < LOGICAL_H; y += tile) {
      for (let x = 0; x < LOGICAL_W; x += tile) {
        const odd = ((x / tile + y / tile) & 1) === 1;
        ctx.fillStyle = odd ? "#5a1f33" : "#4d1a2b";
        ctx.fillRect(x, y, tile, tile);
      }
    }
    ctx.fillStyle = "#3d2b55";
    ctx.fillRect(0, WALL_BOTTOM - 6, LOGICAL_W, 6);
    for (let x = 30; x < LOGICAL_W - 80; x += 60) {
      ctx.fillStyle = "rgba(246,196,83,0.15)";
      ctx.fillRect(x - 8, 20, 20, 14);
      ctx.fillStyle = "#f6c453";
      ctx.fillRect(x, 14, 4, 6);
    }
    // 入口（左下）
    ctx.fillStyle = "#1a1320";
    ctx.fillRect(0, ENTRANCE.y - 30, 14, 40);
    ctx.fillStyle = "#f6c453";
    ctx.fillRect(2, ENTRANCE.y - 28, 10, 2);
    ctx.font = "6px monospace";
    ctx.fillStyle = "#8a7fa0";
    ctx.fillText("入口", 16, ENTRANCE.y - 22);
  }
}

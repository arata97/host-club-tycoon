# 転生してもホストだった件（host-club-tycoon）

異世界に転生してホストクラブを開店し、酒を運び・接客し・稼いだ金で店と従業員を拡張していく
Idle Arcade × Idle Tycoon 型のライフシミュレーションゲーム。

- 対応環境: PC デスクトップ（Tauri v2 / macOS・Windows）
- 技術: HTML5 Canvas + TypeScript + Vite
- 見た目: ドット絵風（コード描画、画像アセット最小）
- 目標容量: 10MB 以下

## ドキュメント

- [要件定義書](docs/要件定義書.md)

## 開発環境

| ツール | バージョン | 用途 |
|---|---|---|
| Node.js | 22 以上 | Vite / TypeScript |
| Rust (rustup) | stable | Tauri のビルド。`rustup` で導入 |
| Xcode Command Line Tools（macOS） | — | リンカ |

> **注意**: プロジェクトは **内蔵ディスク（APFS）上に置いてください**。ExFAT 等の外付けドライブでは
> macOS が `._*` ファイルを自動生成し、Tauri のビルドが失敗します。

## コマンド

```bash
npm install          # 依存のインストール
npm run dev          # ブラウザで開発確認（http://localhost:1420）
npm run typecheck    # 型チェック
npm run build        # 型チェック + Web ビルド（dist/）
npm run tauri dev    # デスクトップアプリとして起動（ホットリロード）
npm run tauri build  # 配布用バイナリ作成（src-tauri/target/release/bundle/）
```

## 構成

```
index.html              エントリ HTML（Canvas + HUD + パネル）
src/
  main.ts               起動処理
  style.css             HUD・パネル（ショップ／ガチャ／図鑑）のスタイル
  engine/               汎用（ゲーム内容に依存しない）
    canvas.ts           低解像度 Canvas の整数倍スケーリング
    input.ts            WASD / 矢印キー + マウスドラッグ仮想スティック
    loop.ts             固定ステップ更新のゲームループ
  game/                 ゲームロジック（描画しない）
    game.ts             状態・ワールド・UI・セーブのまとめ役
    world.ts            フロアのシミュレーション
    state.ts            永続データとセーブ（localStorage）
    gacha.ts            ガチャ（排出・天井・限界突破）
    layout.ts           店内の座標
    data/               バランス定数・商品・ホスト名簿・種族
    entities/           酒蔵・テーブル・客・内勤・ホスト
  render/               描画だけ（グラフィック差し替え時はここを触る）
    scene.ts            1フレーム分の描画の入口
    entities.ts         人物の描画
    furniture.ts        床・壁・テーブル・酒蔵
    people.ts           ドット絵の人物パーツ
    palette.ts          配色
    fx.ts               浮かび上がるテキスト
  ui/                   HTML パネル（ショップ／ガチャ／図鑑）
src-tauri/              Tauri（Rust）側。ウィンドウ設定・権限・バンドル設定
.github/workflows/      CI（型チェック・Web ビルド・macOS/Windows の Tauri ビルド）
```

### 操作

| キー | 動作 |
|---|---|
| WASD / 矢印 / マウスドラッグ | 移動 |
| Enter | 開店（開店前のみ） |
| O | 経営（日報・同伴・出勤・方針・財務。開店前のみ） |
| B | ショップ |
| G | ガチャ（開店前のみ） |
| Z | 図鑑 |
| E | つけ回し（営業中、客のいる卓の前で。1〜9 で選択、0 で外す） |
| Esc | パネルを閉じる |

1営業日は 20:00〜24:00（ゲーム内1分＝リアル1秒、約4分）。閉店時に原価・給与・家賃・利息が精算され、
現金がマイナスのまま3日続くと倒産し、図鑑を引き継いで再転生します。

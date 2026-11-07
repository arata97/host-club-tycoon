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
index.html            エントリ HTML（Canvas + HUD）
src/
  main.ts             起動処理
  style.css
  engine/
    canvas.ts         低解像度 Canvas の整数倍スケーリング
    input.ts          WASD / 矢印キー + マウスドラッグ仮想スティック
    loop.ts           固定ステップ更新のゲームループ
  game/
    game.ts           ゲーム状態と描画
    player.ts         主人公
src-tauri/            Tauri（Rust）側。ウィンドウ設定・権限・バンドル設定
.github/workflows/    CI（型チェック・Web ビルド・macOS/Windows の Tauri ビルド）
```

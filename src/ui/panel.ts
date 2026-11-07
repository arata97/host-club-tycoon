/** 画面右/中央に出るオーバーレイパネルの共通インターフェース */
export interface Panel {
  readonly isOpen: boolean;
  openPanel(): void;
  close(): void;
  /** 表示を最新にする。force=false なら変化がないとき何もしない */
  refresh(force?: boolean): void;
}

/** パネル共通のヘッダー（タイトル・ヒント・閉じるボタン）を作る */
export function buildPanelHead(title: string, hint: string, onClose: () => void): HTMLElement {
  const head = document.createElement("div");
  head.className = "panel-head";
  const h2 = document.createElement("h2");
  h2.textContent = title;
  const hintEl = document.createElement("span");
  hintEl.className = "panel-hint";
  hintEl.textContent = hint;
  const closeBtn = document.createElement("button");
  closeBtn.className = "panel-close";
  closeBtn.type = "button";
  closeBtn.textContent = "×";
  closeBtn.addEventListener("click", onClose);
  head.append(h2, hintEl, closeBtn);
  return head;
}

/** 開閉状態を持つパネルの基底クラス */
export abstract class BasePanel implements Panel {
  protected readonly root: HTMLElement;
  private open = false;

  constructor(rootId: string) {
    const root = document.getElementById(rootId);
    if (!root) throw new Error(`#${rootId} が見つかりません`);
    this.root = root;
  }

  get isOpen(): boolean {
    return this.open;
  }
  openPanel(): void {
    this.open = true;
    this.root.classList.add("open");
    this.refresh(true);
  }
  close(): void {
    this.open = false;
    this.root.classList.remove("open");
  }
  abstract refresh(force?: boolean): void;
}

/**
 * タイトル画面。続きから／はじめから。
 * はじめからでセーブを消すときは、1回確認を挟む。
 */
export class TitleUI {
  private readonly root: HTMLElement;
  private confirming = false;

  constructor(
    private readonly hasSave: boolean,
    private readonly onContinue: () => void,
    private readonly onNewGame: () => void,
  ) {
    const root = document.getElementById("title");
    if (!root) throw new Error("#title が見つかりません");
    this.root = root;
  }

  show(): void {
    this.render();
    this.root.classList.add("open");
  }

  hide(): void {
    this.root.classList.remove("open");
    this.root.innerHTML = "";
  }

  get isOpen(): boolean {
    return this.root.classList.contains("open");
  }

  private render(): void {
    this.root.innerHTML = "";
    const box = document.createElement("div");
    box.className = "title-box";

    const logo = document.createElement("h1");
    logo.className = "title-logo";
    logo.innerHTML = "転生しても<br>ホストだった件";
    const sub = document.createElement("p");
    sub.className = "title-sub";
    sub.textContent = "異世界ホストクラブ経営シミュレーション";

    const actions = document.createElement("div");
    actions.className = "title-actions";
    if (this.hasSave) {
      const cont = document.createElement("button");
      cont.type = "button";
      cont.className = "btn-gold btn-big";
      cont.textContent = "続きから";
      cont.addEventListener("click", () => this.onContinue());
      actions.appendChild(cont);
    }
    const start = document.createElement("button");
    start.type = "button";
    start.className = this.hasSave ? "btn-ghost btn-big" : "btn-gold btn-big";
    start.textContent = this.confirming ? "本当に最初から？（セーブは消えます）" : "はじめから";
    start.addEventListener("click", () => {
      if (this.hasSave && !this.confirming) {
        this.confirming = true;
        this.render();
        return;
      }
      this.onNewGame();
    });
    actions.appendChild(start);

    const help = document.createElement("p");
    help.className = "title-help";
    help.textContent = "WASD・矢印・ドラッグで移動 ／ M で消音";

    box.append(logo, sub, actions, help);
    this.root.appendChild(box);
  }
}

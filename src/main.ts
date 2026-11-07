import { PixelCanvas } from "./engine/canvas";
import { Input } from "./engine/input";
import { GameLoop } from "./engine/loop";
import { Game } from "./game/game";

const el = document.getElementById("game");
if (!(el instanceof HTMLCanvasElement)) throw new Error("#game canvas が見つかりません");

const canvas = new PixelCanvas(el);
const input = new Input(canvas);
const game = new Game(canvas, input);
new GameLoop(game).start();

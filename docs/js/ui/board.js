// 盤と持ち駒の描画。状態は持たず、呼ぶたびに描き直す
import { SENTE, GOTE, K, HAND_TYPES, pieceType, pieceColor } from "../engine/shogi.js";
import { PIECE_CHAR } from "../engine/notation.js";

const FILES = ["９", "８", "７", "６", "５", "４", "３", "２", "１"];
const RANKS = ["一", "二", "三", "四", "五", "六", "七", "八", "九"];
const PIECE_LABEL = { 1: "歩", 2: "香", 3: "桂", 4: "銀", 5: "金", 6: "角", 7: "飛" };

// view: { pos, selected, targets:Set, last:{from,to}, interactive, goteHand:"all"|"normal" }
export function boardHtml(view) {
  const { pos, selected, targets = new Set(), last, interactive } = view;
  const cells = [];
  for (let s = 0; s < 81; s++) {
    const pc = pos.board[s];
    const cls = ["sq"];
    if (last && (last.to === s || last.from === s)) cls.push(last.to === s ? "last-to" : "last-from");
    if (selected && selected.from === s) cls.push("sel");
    if (targets.has(s)) cls.push("target");
    let inner = "";
    if (pc) {
      const t = pieceType(pc), color = pieceColor(pc);
      const ch = t === K ? (color === SENTE ? "王" : "玉") : PIECE_CHAR[t];
      inner = `<span class="pc ${color === GOTE ? "gote" : ""} ${t > K ? "prom" : ""}">${ch}</span>`;
    }
    cells.push(`<button type="button" class="${cls.join(" ")}" data-sq="${s}" ${interactive ? "" : "tabindex='-1'"} aria-label="${FILES[s % 9]}${RANKS[(s / 9) | 0]}">${inner}</button>`);
  }
  const goteHand = view.goteHand === "all"
    ? `<span class="hand-rest">残り全部</span>`
    : handItems(pos, GOTE, null, false);
  return `
  <div class="kyokumen">
    <div class="hand hand-gote"><span class="hand-label">△持駒</span>${goteHand}</div>
    <div class="board-wrap">
      <div class="files">${FILES.map((f) => `<span>${f}</span>`).join("")}</div>
      <div class="board-row">
        <div class="board">${cells.join("")}</div>
        <div class="ranks">${RANKS.map((r) => `<span>${r}</span>`).join("")}</div>
      </div>
    </div>
    <div class="hand hand-sente"><span class="hand-label">▲持駒</span>${handItems(pos, SENTE, selected, interactive)}</div>
  </div>`;
}

function handItems(pos, color, selected, interactive) {
  const items = HAND_TYPES.filter((t) => pos.hands[color][t] > 0).map((t) => {
    const n = pos.hands[color][t];
    const sel = selected && selected.drop === t ? " sel" : "";
    return `<button type="button" class="hand-pc${sel}" data-hand="${t}" ${interactive ? "" : "disabled"}>
      <span class="pc ${color === GOTE ? "gote" : ""}">${PIECE_LABEL[t]}</span>${n > 1 ? `<span class="n">${n}</span>` : ""}</button>`;
  });
  return items.length ? items.join("") : `<span class="hand-rest">なし</span>`;
}

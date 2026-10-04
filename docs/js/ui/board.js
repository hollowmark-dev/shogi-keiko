// 盤と持ち駒の描画。状態は持たず、呼ぶたびに描き直す
import { SENTE, GOTE, K, HAND_TYPES, pieceType, pieceColor } from "../engine/shogi.js";
import { PIECE_CHAR } from "../engine/notation.js";

const FILES = ["９", "８", "７", "６", "５", "４", "３", "２", "１"];
const RANKS = ["一", "二", "三", "四", "五", "六", "七", "八", "九"];
const PIECE_LABEL = { 1: "歩", 2: "香", 3: "桂", 4: "銀", 5: "金", 6: "角", 7: "飛" };

// view: {
//   pos, selected, targets:Set, last:{from,to}, marks:{from,to}（正解の手の表示）, interactive,
//   me: 手前に置く手番（既定は先手）, oppHand: "all" なら相手の持ち駒を「残り全部」と書く（詰将棋）
// }
export function boardHtml(view) {
  const { pos, selected, targets = new Set(), last, marks, interactive } = view;
  const me = view.me ?? SENTE, opp = me ^ 1;
  const flip = me === GOTE;
  const order = [...Array(81).keys()];
  if (flip) order.reverse();
  const cells = order.map((s) => {
    const pc = pos.board[s];
    const cls = ["sq"];
    if (last && (last.to === s || last.from === s)) cls.push(last.to === s ? "last-to" : "last-from");
    if (selected && selected.from === s) cls.push("sel");
    if (targets.has(s)) cls.push("target");
    if (marks && (marks.from === s || marks.to === s)) cls.push("mark");
    let inner = "";
    if (pc) {
      const t = pieceType(pc), color = pieceColor(pc);
      const ch = t === K ? (color === SENTE ? "王" : "玉") : PIECE_CHAR[t];
      inner = `<span class="pc ${color !== me ? "gote" : ""} ${t > K ? "prom" : ""}">${ch}</span>`;
    }
    return `<button type="button" class="${cls.join(" ")}" data-sq="${s}" ${interactive ? "" : "tabindex='-1'"} aria-label="${FILES[s % 9]}${RANKS[(s / 9) | 0]}">${inner}</button>`;
  });
  const files = flip ? FILES.slice().reverse() : FILES;
  const ranks = flip ? RANKS.slice().reverse() : RANKS;
  const mark = (c) => (c === SENTE ? "▲" : "△");
  const oppItems = view.oppHand === "all"
    ? `<span class="hand-rest">残り全部</span>`
    : handItems(pos, opp, me, null, false, null);
  return `
  <div class="kyokumen">
    <div class="hand hand-opp"><span class="hand-label">${mark(opp)}持駒</span>${oppItems}</div>
    <div class="board-wrap">
      <div class="files">${files.map((f) => `<span>${f}</span>`).join("")}</div>
      <div class="board-row">
        <div class="board">${cells.join("")}</div>
        <div class="ranks">${ranks.map((r) => `<span>${r}</span>`).join("")}</div>
      </div>
    </div>
    <div class="hand hand-me"><span class="hand-label">${mark(me)}持駒</span>${handItems(pos, me, me, selected, interactive, marks)}</div>
  </div>`;
}

function handItems(pos, color, me, selected, interactive, marks) {
  const items = HAND_TYPES.filter((t) => pos.hands[color][t] > 0).map((t) => {
    const n = pos.hands[color][t];
    const sel = selected && selected.drop === t ? " sel" : "";
    const mk = marks && marks.drop === t ? " mark" : "";
    return `<button type="button" class="hand-pc${sel}${mk}" data-hand="${t}" ${interactive ? "" : "disabled"}>
      <span class="pc ${color !== me ? "gote" : ""}">${PIECE_LABEL[t]}</span>${n > 1 ? `<span class="n">${n}</span>` : ""}</button>`;
  });
  return items.length ? items.join("") : `<span class="hand-rest">なし</span>`;
}

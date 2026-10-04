// 日本語の棋譜表記（▲2二金打、△同玉、▲3二銀成 など）
import {
  SENTE, K, pieceType, pieceColor, rowOf, colOf, fileOf, rankOf, legalMoves, canPromoteMove,
} from "./shogi.js";

export const PIECE_NAME = {
  1: "歩", 2: "香", 3: "桂", 4: "銀", 5: "金", 6: "角", 7: "飛", 8: "玉",
  9: "と", 10: "成香", 11: "成桂", 12: "成銀", 14: "馬", 15: "龍",
};
// 盤上の1文字表記
export const PIECE_CHAR = {
  1: "歩", 2: "香", 3: "桂", 4: "銀", 5: "金", 6: "角", 7: "飛", 8: "玉",
  9: "と", 10: "杏", 11: "圭", 12: "全", 14: "馬", 15: "龍",
};
const ZEN = ["", "１", "２", "３", "４", "５", "６", "７", "８", "９"];
const KAN = ["", "一", "二", "三", "四", "五", "六", "七", "八", "九"];

export const squareName = (s) => ZEN[fileOf(s)] + KAN[rankOf(s)];
export const squareNameShort = (s) => `${fileOf(s)}${KAN[rankOf(s)]}`;
export const sideMark = (color) => (color === SENTE ? "▲" : "△");

// 同じ種類の駒が同じマスに行けるときの区別（右・左・上・引・寄・直）
function disambiguation(pos, m) {
  const pc = pos.board[m.from];
  const t = pieceType(pc), color = pieceColor(pc);
  const others = new Set();
  for (const o of legalMoves(pos)) {
    if (o.drop || o.to !== m.to || o.from === m.from) continue;
    if (pieceType(pos.board[o.from]) === t) others.add(o.from);
  }
  if (!others.size) return "";
  const fwd = color === SENTE ? -1 : 1;
  const motion = (from) => {
    const dy = (rowOf(m.to) - rowOf(from)) * fwd;
    return dy > 0 ? "上" : dy < 0 ? "引" : "寄";
  };
  const group = [m.from, ...others];
  const mine = motion(m.from);
  // 金・銀などがまっすぐ前に進むとき
  if (mine === "上" && colOf(m.from) === colOf(m.to) && t !== 14 && t !== 15 && group.filter((f) => motion(f) === "上").length > 1) return "直";
  if (group.filter((f) => motion(f) === mine).length === 1) return mine;
  // 左右（指す側から見て）
  const rightness = (f) => (color === SENTE ? colOf(f) : -colOf(f));
  const sideIn = (fs) => {
    const xs = fs.map(rightness), me = rightness(m.from);
    if (xs.filter((x) => x === me).length !== 1) return "";
    return me === Math.max(...xs) ? "右" : me === Math.min(...xs) ? "左" : "";
  };
  const side = sideIn(group);
  if (side) return side;
  return sideIn(group.filter((f) => motion(f) === mine)) + mine;
}

// prevTo: 直前の手の移動先（「同」の判定用）
export function moveToKif(pos, m, prevTo = -1) {
  const color = pos.turn;
  const dest = m.to === prevTo ? "同　" : squareName(m.to);
  if (m.drop) return `${sideMark(color)}${dest}${PIECE_NAME[m.drop]}打`;
  const t = pieceType(pos.board[m.from]);
  let s = `${sideMark(color)}${dest}${t === K && color === SENTE ? "玉" : PIECE_NAME[t]}`;
  s += disambiguation(pos, m);
  if (m.promote) s += "成";
  else if (canPromoteMove(pos, m)) s += "不成";
  return s;
}

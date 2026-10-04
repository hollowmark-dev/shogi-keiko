// 詰みの解説: 玉のまわりのマスがなぜ逃げられないかを1マスずつ言葉にする
import {
  SENTE, GOTE, K, findKing, attackersOf, pieceType, pieceColor, rowOf, colOf,
} from "../engine/shogi.js";
import { PIECE_NAME, squareNameShort } from "../engine/notation.js";

const name = (board, s) => {
  const t = pieceType(board[s]);
  return t === K ? "玉" : PIECE_NAME[t];
};

// 詰んだ局面（玉方の手番）について
export function explainMate(pos) {
  const k = findKing(pos, GOTE);
  if (k < 0) return [];
  const lines = [];
  const checkers = attackersOf(pos.board, k, SENTE);
  lines.push(`王手: ${checkers.map((s) => `${squareNameShort(s)}の${name(pos.board, s)}`).join("と")}${checkers.length > 1 ? "（両王手）" : ""}`);
  // 玉を抜いた盤で利きを見る（玉の後ろに抜ける飛び道具の利きも数える）
  const noKing = pos.board.slice();
  noKing[k] = 0;
  const r = rowOf(k), c = colOf(k);
  for (let dr = -1; dr <= 1; dr++) {
    for (let dc = -1; dc <= 1; dc++) {
      if (!dr && !dc) continue;
      const nr = r + dr, nc = c + dc;
      if (nr < 0 || nr > 8 || nc < 0 || nc > 8) continue;
      const s = nr * 9 + nc;
      const pc = pos.board[s];
      if (pc && pieceColor(pc) === GOTE) {
        lines.push(`${squareNameShort(s)}: 自分の${name(pos.board, s)}がいて入れない`);
        continue;
      }
      const by = attackersOf(noKing, s, SENTE);
      const what = pc ? `${name(pos.board, s)}を取りたいが、` : "";
      if (by.length) {
        lines.push(`${squareNameShort(s)}: ${what}${by.map((x) => `${squareNameShort(x)}の${name(pos.board, x)}`).join("・")}が利いている`);
      }
    }
  }
  return lines;
}


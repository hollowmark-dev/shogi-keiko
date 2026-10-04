// 詰将棋の探索（攻方は毎手王手、玉方は合法手すべて）。
// 無駄合も合法手として数える厳密な判定にしてある。問題は生成時にこの基準で選ぶので、
// 「無駄合なので省略」という詰将棋特有の約束を初心者が知らなくても解ける。
import { legalMovesWithPos, inCheck, isCheckmate } from "./shogi.js";

// 攻方の王手になる合法手 [{ move, pos }]
export function checkMoves(pos) {
  const them = pos.turn ^ 1;
  return legalMovesWithPos(pos).filter((x) => inCheck(x.pos, them));
}

// 攻方の手番で、plies 手以内（奇数）に必ず詰むか
export function canMate(pos, plies) {
  for (const { pos: next } of checkMoves(pos)) {
    if (forcedAfterCheck(next, plies - 1)) return true;
  }
  return false;
}

// 王手された後の局面（玉方の手番）で、残り rest 手以内に必ず詰むか
function forcedAfterCheck(pos, rest) {
  const replies = legalMovesWithPos(pos);
  if (replies.length === 0) return true;
  if (rest < 2) return false;
  return replies.every((r) => canMate(r.pos, rest - 1));
}

// 初手の候補のうち plies 手以内に詰むものを返す
export function solveFirstMoves(pos, plies) {
  return checkMoves(pos)
    .filter((x) => forcedAfterCheck(x.pos, plies - 1))
    .map((x) => x.move);
}

// 1手で詰ます手の一覧（{ move, pos }）
export function mateInOneMoves(pos) {
  return checkMoves(pos).filter((x) => isCheckmate(x.pos));
}

// 王手された局面で玉方が指す手を選ぶ（アプリの応手用）。
// 詰みまでの手数が長くなる手 → 合駒より玉が動く/取る手 → 攻方の詰ます手が少ない手、の順に選ぶ。
export function chooseDefense(pos, restPlies) {
  const replies = legalMovesWithPos(pos);
  if (!replies.length) return null;
  let best = null, bestScore = -Infinity;
  for (const r of replies) {
    let score = 0;
    if (!canMate(r.pos, Math.max(1, restPlies - 1))) score += 1000; // 詰まない（＝攻方の誤り）
    if (!r.move.drop) score += 100;
    score -= mateInOneMoves(r.pos).length;
    if (score > bestScore) { bestScore = score; best = r; }
  }
  return best;
}

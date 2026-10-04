// 詰将棋（1手詰・3手詰）を自動生成して docs/data/tsume.json に書き出す。
//   node scripts/generate.mjs [1手詰の数] [3手詰の数] [seed]
//
// 採用条件（すべて厳密な合法手で判定。無駄合も合法手として扱う）
//   - 初形で玉に王手がかかっていない、行き所のない駒・二歩がない
//   - 指定手数より短い詰みがない、初手が1通りだけ
//   - 攻方の駒（盤上・持ち駒）はどれを抜いても詰まなくなる（飾り駒なし）
//   - 3手詰は本手順で持ち駒が余らない
import { writeFileSync } from "node:fs";
import {
  emptyPosition, makePiece, makeMove, inCheck, fillDefenderHand, toSfen, isDeadSquare, clonePosition,
  rowOf, colOf, pieceType, pieceColor, isCheckmate, SENTE, GOTE, P, L, N, S, G, B, R, K, HAND_TYPES,
} from "../docs/js/engine/shogi.js";
import { solveFirstMoves, canMate, chooseDefense, mateInOneMoves, checkMoves } from "../docs/js/engine/mate.js";
import { moveToKif } from "../docs/js/engine/notation.js";

const want1 = Number(process.argv[2] || 300);
const want3 = Number(process.argv[3] || 300);
let seed = Number(process.argv[4] || 20261004);

function rng() { // mulberry32
  seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
const pick = (arr) => arr[Math.floor(rng() * arr.length)];
const randInt = (a, b) => a + Math.floor(rng() * (b - a + 1));

const ATTACK_BOARD = [G, G, S, S, N, L, B, R, P, P, 15, 14, 9];
const ATTACK_HAND = [G, G, G, S, S, N, L, B, R, P];
const DEFEND = [G, S, P, P, N, L, S, G];

function randomPosition(nBoard, nHand, nDef) {
  const pos = emptyPosition();
  const kr = rng() < 0.6 ? 0 : randInt(1, 2);
  const kc = rng() < 0.35 ? pick([0, 8]) : randInt(0, 8);
  const king = kr * 9 + kc;
  pos.board[king] = makePiece(K, GOTE);
  const near = (d) => {
    for (let i = 0; i < 30; i++) {
      const r = kr + randInt(-d, d), c = kc + randInt(-d, d);
      if (r < 0 || r > 8 || c < 0 || c > 8) continue;
      if (!pos.board[r * 9 + c]) return r * 9 + c;
    }
    return -1;
  };
  const place = (t, color, d) => {
    const s = near(d);
    if (s < 0 || isDeadSquare(t, color, rowOf(s))) return false;
    if (t === P) {
      for (let r = 0; r < 9; r++) if (pos.board[r * 9 + colOf(s)] === makePiece(P, color)) return false;
    }
    pos.board[s] = makePiece(t, color);
    return true;
  };
  for (let i = 0; i < nBoard; i++) if (!place(pick(ATTACK_BOARD), SENTE, 3)) return null;
  for (let i = 0; i < nDef; i++) if (!place(pick(DEFEND), GOTE, 2)) return null;
  for (let i = 0; i < nHand; i++) pos.hands[SENTE][pick(ATTACK_HAND)]++;
  pos.turn = SENTE;
  fillDefenderHand(pos);
  if (inCheck(pos, GOTE)) return null;
  return pos;
}

// 攻方の駒を1つ抜いた局面の一覧
function withoutEachAttacker(pos) {
  const out = [];
  for (let s = 0; s < 81; s++) {
    const pc = pos.board[s];
    if (!pc || pieceColor(pc) !== SENTE) continue;
    const p = clonePosition(pos);
    p.board[s] = 0;
    out.push(fillDefenderHand(p));
  }
  for (const t of HAND_TYPES) {
    if (!pos.hands[SENTE][t]) continue;
    const p = clonePosition(pos);
    p.hands[SENTE][t]--;
    out.push(fillDefenderHand(p));
  }
  return out;
}

function handEmpty(pos, color) {
  return HAND_TYPES.every((t) => !pos.hands[color][t]);
}

function tryProblem(pos, plies) {
  if (plies === 3 && canMate(pos, 1)) return null;
  const firsts = solveFirstMoves(pos, plies);
  if (firsts.length !== 1) return null;
  if (withoutEachAttacker(pos).some((p) => canMate(p, plies))) return null;
  const first = firsts[0];
  const p1 = makeMove(pos, first);
  const line = [moveToKif(pos, first)];
  const moves = [first];
  if (plies === 3) {
    const def = chooseDefense(p1, 2);
    const p2 = def.pos;
    const finals = mateInOneMoves(p2);
    const clean = finals.find((x) => handEmpty(x.pos, SENTE));
    if (!clean) return null; // 持ち駒が余る
    line.push(moveToKif(p1, def.move, first.to), moveToKif(p2, clean.move, def.move.to));
    moves.push(def.move, clean.move);
  }
  const startChecks = checkMoves(pos).length;
  return { sfen: toSfen(pos), plies, moves, line, checks: startChecks };
}

function generate(plies, want, idPrefix) {
  const seen = new Set(), out = [];
  let tries = 0;
  const t0 = Date.now();
  while (out.length < want) {
    tries++;
    const nBoard = plies === 1 ? randInt(1, 3) : randInt(1, 3);
    const nHand = plies === 1 ? randInt(0, 1) : randInt(1, 2);
    const pos = randomPosition(nBoard, nHand, randInt(0, plies === 1 ? 2 : 3));
    if (!pos) continue;
    const key = toSfen(pos);
    if (seen.has(key)) continue;
    seen.add(key);
    const prob = tryProblem(pos, plies);
    if (!prob) continue;
    out.push(prob);
    if (out.length % 25 === 0) console.log(`${plies}手詰 ${out.length}/${want}（試行 ${tries}、${((Date.now() - t0) / 1000).toFixed(0)}秒）`);
  }
  // 王手の候補が少ない（迷いにくい）順に並べる
  out.sort((a, b) => a.checks - b.checks);
  return out.map((p, i) => ({ id: `${idPrefix}${String(i + 1).padStart(3, "0")}`, ...p }));
}

const problems = [...generate(1, want1, "m1-"), ...generate(3, want3, "m3-")];
// moves は SFEN と合わせて再現できるよう最小限に
for (const p of problems) p.moves = p.moves.map((m) => (m.drop ? { drop: m.drop, to: m.to } : { from: m.from, to: m.to, promote: m.promote }));
const outPath = new URL("../docs/data/tsume.json", import.meta.url);
writeFileSync(outPath, JSON.stringify({ version: 1, seed: Number(process.argv[4] || 20261004), problems }, null, 0));
console.log(`書き出し: ${problems.length}問`);

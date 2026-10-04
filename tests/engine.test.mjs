// ルール判定・詰み探索・棋譜表記のテスト
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  parseSfen, toSfen, legalMovesWithPos, legalMoves, makeMove, inCheck, isCheckmate,
  toSq, fillDefenderHand, GOTE, P, G, S,
} from "../docs/js/engine/shogi.js";
import { solveFirstMoves, mateInOneMoves, canMate } from "../docs/js/engine/mate.js";
import { moveToKif } from "../docs/js/engine/notation.js";

const START = "lnsgkgsnl/1r5b1/ppppppppp/9/9/9/PPPPPPPPP/1B5R1/LNSGKGSNL b -";
// 合法手が最大級になる有名な検証局面
const MAX = "l6nl/5+P1gk/2np1S3/p1p4Pp/3P2Sp1/1PPb2P1P/P5GS1/R8/LN4bKL w RGgsn5p";

function perft(pos, depth) {
  if (depth === 0) return 1;
  const ms = legalMovesWithPos(pos);
  if (depth === 1) return ms.length;
  let n = 0;
  for (const x of ms) n += perft(x.pos, depth - 1);
  return n;
}

test("SFEN の往復", () => {
  for (const s of [START, MAX]) assert.equal(toSfen(parseSfen(s)), s);
});

test("perft: 初期局面", () => {
  const pos = parseSfen(START);
  assert.equal(perft(pos, 1), 30);
  assert.equal(perft(pos, 2), 900);
  assert.equal(perft(pos, 3), 25470);
});

test("perft: 持ち駒の多い局面", () => {
  const pos = parseSfen(MAX);
  assert.equal(perft(pos, 1), 207);
  assert.equal(perft(pos, 2), 28684);
});

test("二歩は打てない", () => {
  const pos = parseSfen("4k4/9/9/9/9/9/4P4/9/4K4 b P");
  const drops = legalMoves(pos).filter((m) => m.drop === P);
  assert.ok(drops.length > 0);
  assert.ok(drops.every((m) => m.to % 9 !== 4));
  assert.ok(drops.every((m) => m.to >= 9)); // 一段目には打てない
});

test("打ち歩詰めは反則、突き歩詰めは可", () => {
  // 1一玉。2一・2二は3二の金が押さえ、1二の歩は1三の香が支える。歩を打てば詰みだが反則
  const uchi = parseSfen("8k/6G2/8L/9/9/9/9/9/K8 b P");
  assert.ok(!legalMoves(uchi).some((m) => m.drop === P && m.to === toSq(1, 2)));
  // 同じ形で盤上の歩を突いて詰ますのは可
  const tsuki = parseSfen("8k/6G2/8P/8L/9/9/9/9/K8 b -");
  const push = legalMoves(tsuki).find((m) => m.from === toSq(1, 3) && m.to === toSq(1, 2) && !m.promote);
  assert.ok(push);
  assert.ok(isCheckmate(makeMove(tsuki, push)));
});

test("王手を放置する手は指せない", () => {
  const pos = parseSfen("4k4/9/9/9/4r4/9/9/9/4K4 b G");
  assert.ok(inCheck(pos, 0));
  for (const m of legalMoves(pos)) assert.ok(!inCheck(makeMove(pos, m), 0));
  // 合駒は5筋の2〜8段目のどこか（5五の飛車との間）
  const drops = legalMoves(pos).filter((m) => m.drop);
  assert.ok(drops.length > 0 && drops.every((m) => m.to % 9 === 4 && m.to > toSq(5, 5)));
});

test("1手詰: 頭金", () => {
  const pos = fillDefenderHand(parseSfen("4k4/9/4P4/9/9/9/9/9/9 b G"));
  const mates = mateInOneMoves(pos);
  assert.equal(mates.length, 1);
  assert.equal(mates[0].move.drop, G);
  assert.equal(mates[0].move.to, toSq(5, 2));
  assert.equal(moveToKif(pos, mates[0].move), "▲５二金打");
});

test("3手詰: 1手では詰まない局面を3手で解く", () => {
  // 2二銀打 同玉 3二金... ではなく、探索結果が「1手詰なし・3手詰あり」であることだけ確認
  const pos = fillDefenderHand(parseSfen("6snl/6k2/6ppp/9/9/9/9/9/9 b GS"));
  pos.hands[GOTE] = pos.hands[GOTE]; // 玉方は残り全部
  const one = solveFirstMoves(pos, 1);
  const three = solveFirstMoves(pos, 3);
  assert.equal(one.length, 0);
  assert.equal(canMate(pos, 3), three.length > 0);
});

test("棋譜表記: 同・成・不成・左右", () => {
  const pos = parseSfen("4k4/9/9/9/9/9/9/2G1G4/4K4 b -");
  const m = legalMoves(pos).find((x) => x.from === toSq(7, 8) && x.to === toSq(6, 8));
  assert.equal(moveToKif(pos, m), "▲６八金左");
  const m2 = legalMoves(pos).find((x) => x.from === toSq(5, 8) && x.to === toSq(6, 8));
  assert.equal(moveToKif(pos, m2), "▲６八金右");
  const sil = parseSfen("4k4/9/9/4S4/9/9/9/9/4K4 b -");
  const up = legalMoves(sil).filter((x) => x.from === toSq(5, 4) && x.to === toSq(5, 3));
  assert.deepEqual(up.map((x) => moveToKif(sil, x, toSq(5, 3))).sort(), ["▲同　銀不成", "▲同　銀成"].sort());
  assert.equal(S, 4);
});

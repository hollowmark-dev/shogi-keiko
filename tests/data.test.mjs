// 問題データの検証: 全問を保存された手順どおりに再生する
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { parseSfen, makeMove, legalMoves, sameMove, isCheckmate, inCheck, GOTE } from "../docs/js/engine/shogi.js";
import { solveFirstMoves } from "../docs/js/engine/mate.js";

const data = JSON.parse(readFileSync(new URL("../docs/data/tsume.json", import.meta.url), "utf8"));

test("問題数と手数", () => {
  assert.equal(data.problems.filter((p) => p.plies === 1).length, 400);
  assert.equal(data.problems.filter((p) => p.plies === 3).length, 400);
  assert.equal(new Set(data.problems.map((p) => p.id)).size, data.problems.length);
});

test("全問: 保存した手順が合法で、最後に詰む。初手は唯一解と一致", () => {
  for (const p of data.problems) {
    let pos = parseSfen(p.sfen);
    assert.ok(!inCheck(pos, GOTE), `${p.id}: 初形で王手`);
    const firsts = solveFirstMoves(pos, p.plies);
    assert.equal(firsts.length, 1, `${p.id}: 初手が唯一でない`);
    assert.ok(sameMove(firsts[0], p.moves[0]), `${p.id}: 初手が保存データと違う`);
    for (const m of p.moves) {
      assert.ok(legalMoves(pos).some((x) => sameMove(x, m)), `${p.id}: 非合法手`);
      pos = makeMove(pos, m);
    }
    assert.ok(isCheckmate(pos), `${p.id}: 最後に詰んでいない`);
  }
});

test("sameMove: 打つ手は from が無くても一致する", () => {
  assert.ok(sameMove({ from: -1, to: 10, drop: 5, promote: false }, { drop: 5, to: 10 }));
  assert.ok(!sameMove({ from: -1, to: 10, drop: 5 }, { drop: 4, to: 10 }));
  assert.ok(!sameMove({ from: 3, to: 10, drop: 0, promote: true }, { from: 3, to: 10, promote: false }));
});

// 定跡データと出題のテスト
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { parseLine } from "../docs/js/engine/kif.js";
import { sameMove } from "../docs/js/engine/shogi.js";
import { flattenLines, drillStart, buildJosekiSession } from "../docs/js/game/joseki.js";

const src = JSON.parse(readFileSync(new URL("../content/joseki.json", import.meta.url), "utf8"));
const data = JSON.parse(readFileSync(new URL("../docs/data/joseki.json", import.meta.url), "utf8"));
const lines = flattenLines(data);

test("配信データが原稿と一致している（build-joseki の実行忘れ防止）", () => {
  assert.equal(data.chapters.length, src.chapters.length);
  data.chapters.forEach((ch, i) => {
    assert.equal(ch.lines.length, src.chapters[i].lines.length, ch.title);
    ch.lines.forEach((l, j) => {
      const parsed = parseLine(src.chapters[i].lines[j].moves);
      assert.equal(parsed.length, l.moves.length, `${ch.title} ${l.name}`);
      parsed.forEach((x, k) => assert.ok(sameMove(x.move, l.moves[k]), `${ch.title} ${l.name} ${k + 1}手目`));
      assert.deepEqual(l.notes, src.chapters[i].lines[j].notes || {});
    });
  });
});

test("どの手順も2手以上ある", () => {
  for (const l of lines) assert.ok(l.moves.length >= 2, l.name);
});

test("練習の開始位置は自分（後手）の手番か初手", () => {
  for (const l of lines) {
    const s = drillStart(l, lines[0]);
    assert.ok(s === 0 || s % 2 === 1, `${l.name}: ${s}`);
    assert.ok(s < l.moves.length);
  }
});

test("出題: 復習が先、新しい手順は1本まで", () => {
  const prog = {};
  const s1 = buildJosekiSession(lines, prog, 100, 3);
  assert.equal(s1.length, 1);
  assert.equal(s1[0], lines[0].id);
  prog[lines[0].id] = { box: 1, due: 100, correct: 0, wrong: 1 };
  const s2 = buildJosekiSession(lines, prog, 100, 3);
  assert.equal(s2[0], lines[0].id);
  if (lines.length > 1) assert.equal(s2[1], lines[1].id);
});

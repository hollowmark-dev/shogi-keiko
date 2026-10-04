// 日本語棋譜の読み取りのテスト
import { test } from "node:test";
import assert from "node:assert/strict";
import { parseLine } from "../docs/js/engine/kif.js";
import { toSq, B } from "../docs/js/engine/shogi.js";

test("角交換・同・打・成", () => {
  const line = parseLine(["▲7六歩", "△3四歩", "▲2二角成", "△同　銀", "▲5五角打"]);
  assert.equal(line[2].move.promote, true);
  assert.equal(line[3].move.to, toSq(2, 2));
  assert.equal(line[4].move.drop, B);
  assert.equal(line[4].kif, "▲５五角打");
});

test("打の省略・竜/王の表記ゆれ・全角数字", () => {
  const line = parseLine(["▲７六歩", "△３四歩", "▲2二角成", "△同銀", "▲5五角", "△4二玉"]);
  assert.equal(line[4].move.drop, B);
  assert.equal(line[5].move.to, toSq(4, 2));
});

test("左右の区別: ▲5八金右 と ▲7八金", () => {
  const line = parseLine(["▲7六歩", "△3四歩", "▲5八金右", "△4四歩", "▲7八金"]);
  assert.equal(line[2].move.from, toSq(4, 9));
  assert.equal(line[4].move.from, toSq(6, 9));
});

test("指せない手は手数つきで例外", () => {
  assert.throws(() => parseLine(["▲7六歩", "△3五歩"]), /2手目/);
});

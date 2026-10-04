// 定跡の原稿 content/joseki.json（日本語の棋譜）を検証して docs/data/joseki.json に変換する
//   node scripts/build-joseki.mjs
// 1手でも指せない手・あいまいな手があれば、場所を示して止まる。
import { readFileSync, writeFileSync } from "node:fs";
import { parseLine } from "../docs/js/engine/kif.js";

const src = JSON.parse(readFileSync(new URL("../content/joseki.json", import.meta.url), "utf8"));
const errors = [];
const chapters = src.chapters.map((ch) => ({
  key: ch.key,
  title: ch.title,
  summary: ch.summary,
  lines: ch.lines.map((l, i) => {
    const id = `${ch.key}-${i + 1}`;
    let parsed = [];
    try { parsed = parseLine(l.moves); } catch (e) { errors.push(`${ch.title}「${l.name}」: ${e.message}`); }
    for (const k of Object.keys(l.notes || {})) {
      const n = Number(k);
      if (!(n >= 1 && n <= l.moves.length)) errors.push(`${ch.title}「${l.name}」: notes の手数 ${k} が範囲外`);
    }
    return {
      id, name: l.name,
      kif: parsed.map((x) => x.kif),
      moves: parsed.map(({ move: m }) => (m.drop ? { drop: m.drop, to: m.to } : { from: m.from, to: m.to, promote: m.promote })),
      notes: l.notes || {}, verdict: l.verdict || "", confidence: l.confidence || "推定", sources: l.sources || [],
    };
  }),
}));

// 同じ章で、同じ手順が重複していないか
for (const ch of chapters) {
  const seen = new Map();
  for (const l of ch.lines) {
    const k = l.kif.join();
    if (seen.has(k)) errors.push(`${ch.title}: 「${l.name}」と「${seen.get(k)}」が同じ手順`);
    seen.set(k, l.name);
  }
}

if (errors.length) {
  console.error(errors.join("\n"));
  process.exit(1);
}
writeFileSync(new URL("../docs/data/joseki.json", import.meta.url), JSON.stringify({ version: 1, chapters }, null, 1));
const n = chapters.reduce((a, c) => a + c.lines.length, 0);
console.log(`書き出し: ${chapters.length}章・${n}本`);

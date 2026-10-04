// 定跡ドリルの出題（手順1本 = 1問として間隔反復する）
import { GOTE } from "../engine/shogi.js";

export const ME = GOTE; // 後手四間飛車
export const NEW_PER_SESSION = 1; // 新しい手順は1回に1本まで（まず「見て覚える」から入る）

// data: docs/data/joseki.json → 手順の一覧（章の順・章内の順）
export function flattenLines(data) {
  const out = [];
  for (const ch of data.chapters) {
    for (const line of ch.lines) out.push({ ...line, chapter: ch });
  }
  return out;
}

// 練習を始める手数: 基本の駒組みの本線と同じ部分は飛ばし、分かれる4手前の自分の手番から
export function drillStart(line, base) {
  if (!base || line.id === base.id) return 0;
  let i = 0;
  while (i < line.moves.length && i < base.moves.length && line.kif[i] === base.kif[i]) i++;
  let start = Math.max(0, i - 4);
  if (start % 2 === 0 && start > 0) start--; // 0始まりで奇数 = 後手の手。自分の手から始める
  return start;
}

export function buildJosekiSession(lines, progress, day, size = 3) {
  const due = lines
    .filter((l) => progress[l.id] && progress[l.id].due <= day)
    .sort((a, b) => progress[a.id].due - progress[b.id].due);
  const ids = due.slice(0, size).map((l) => l.id);
  let fresh = 0;
  for (const l of lines) {
    if (ids.length >= size || fresh >= NEW_PER_SESSION) break;
    if (!progress[l.id]) { ids.push(l.id); fresh++; }
  }
  // 新しい手順を使い切り、復習もまだなら、いちばん前に練習した手順を前倒しで出す
  if (!ids.length) {
    const any = lines.filter((l) => progress[l.id]).sort((a, b) => progress[a.id].due - progress[b.id].due);
    ids.push(...any.slice(0, size).map((l) => l.id));
  }
  return ids;
}

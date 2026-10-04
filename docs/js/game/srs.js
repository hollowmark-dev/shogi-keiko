// 間隔反復（ライトナー方式）と、1日の出題の組み立て
//
// 正解するたびに箱が1つ上がり、次に出る日が延びる（1→3→7→14→30→60日後）。
// 間違えると箱1に戻り、翌日にまた出る。

export const INTERVALS = [0, 1, 3, 7, 14, 30, 60];
export const MAX_BOX = INTERVALS.length - 1;

export function todayStr(d = new Date()) {
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}
export function dayNum(str) {
  const [y, m, d] = str.split("-").map(Number);
  return Math.floor(Date.UTC(y, m - 1, d) / 86400000);
}

export function grade(rec, correct, day) {
  const r = rec ? { ...rec } : { box: 0, due: day, correct: 0, wrong: 0 };
  if (correct) {
    r.box = Math.min(MAX_BOX, r.box + 1);
    r.correct++;
  } else {
    r.box = 1;
    r.wrong++;
  }
  r.due = day + INTERVALS[r.box];
  r.last = day;
  return r;
}

// 3手詰を混ぜ始める条件: 1手詰を40問以上解き、正答率80%以上
export const UNLOCK_SOLVED = 40, UNLOCK_RATE = 0.8;
export function stats(problems, progress, plies) {
  let seen = 0, correct = 0, wrong = 0, mastered = 0;
  for (const p of problems) {
    if (p.plies !== plies) continue;
    const r = progress[p.id];
    if (!r) continue;
    seen++; correct += r.correct; wrong += r.wrong;
    if (r.box >= 4) mastered++;
  }
  const total = problems.filter((p) => p.plies === plies).length;
  const rate = correct + wrong ? correct / (correct + wrong) : 0;
  return { total, seen, correct, wrong, rate, mastered };
}
export function threeUnlocked(problems, progress, settings) {
  if (settings.allow3) return true;
  const s = stats(problems, progress, 1);
  return s.seen >= UNLOCK_SOLVED && s.rate >= UNLOCK_RATE;
}

export function dueCount(problems, progress, day) {
  return problems.filter((p) => progress[p.id] && progress[p.id].due <= day).length;
}

// 今日の出題: 復習（期日が来たもの）→ 新しい問題の順
// only: 1 か 3 を渡すとその手数だけ
export function buildSession(problems, progress, settings, day, only = 0) {
  const size = settings.dailyCount;
  const pool = only ? problems.filter((p) => p.plies === only) : problems;
  const due = pool
    .filter((p) => progress[p.id] && progress[p.id].due <= day)
    .sort((a, b) => progress[a.id].due - progress[b.id].due || progress[a.id].box - progress[b.id].box);
  const ids = due.slice(0, size).map((p) => p.id);
  const fresh1 = pool.filter((p) => p.plies === 1 && !progress[p.id]);
  const fresh3 = pool.filter((p) => p.plies === 3 && !progress[p.id]);
  const use3 = only === 3 || (!only && threeUnlocked(problems, progress, settings));
  const use1 = only !== 3;
  let i1 = 0, i3 = 0;
  while (ids.length < size && (i1 < fresh1.length || i3 < fresh3.length)) {
    // 3手詰が解禁されたら 新規は 3手:1手 = 7:3
    const want3 = use3 && (!use1 || rngLike(ids.length, day) < 0.7);
    if (want3 && i3 < fresh3.length) ids.push(fresh3[i3++].id);
    else if (use1 && i1 < fresh1.length) ids.push(fresh1[i1++].id);
    else if (use3 && i3 < fresh3.length) ids.push(fresh3[i3++].id);
    else break;
  }
  return ids;
}

// 日付と位置から決まる疑似乱数（同じ日に開き直しても同じ並びになる）
function rngLike(i, day) {
  const x = Math.sin(day * 9301 + i * 49297) * 233280;
  return x - Math.floor(x);
}

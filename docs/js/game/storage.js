// localStorage の読み書き（すべて try/catch。使えなくても動く）
const PREFIX = "shogi.";

function get(key, fallback) {
  try {
    const v = localStorage.getItem(PREFIX + key);
    return v == null ? fallback : JSON.parse(v);
  } catch { return fallback; }
}
function set(key, value) {
  try { localStorage.setItem(PREFIX + key, JSON.stringify(value)); return true; } catch { return false; }
}

// 問題ごとの記録 { id: { box, due, correct, wrong, last } }
export const loadProgress = () => get("progress", {});
export const saveProgress = (p) => set("progress", p);

// 定跡の手順ごとの記録（詰将棋と同じ形）
export const loadJosekiProgress = () => get("joseki", {});
export const saveJosekiProgress = (p) => set("joseki", p);

export const DEFAULT_SETTINGS = { dailyCount: 10, allow3: false, josekiCount: 3 };
export const loadSettings = () => ({ ...DEFAULT_SETTINGS, ...get("settings", {}) });
export const saveSettings = (s) => set("settings", s);

// 日ごとの記録 { "2026-10-04": { tsume: true, solved, correct, menu: { kata: true, ... } } }
export const loadDays = () => get("days", {});
export const saveDays = (d) => set("days", d);

export function firstDay(today) {
  let d = get("firstDay", null);
  if (!d) { d = today; set("firstDay", d); }
  return d;
}

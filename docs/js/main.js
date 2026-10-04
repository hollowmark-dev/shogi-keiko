import { renderHome } from "./ui/home.js";
import { startSession } from "./ui/play.js";
import { buildSession, todayStr, dayNum } from "./game/srs.js";
import {
  loadProgress, saveProgress, loadSettings, saveSettings, loadDays, saveDays, firstDay,
} from "./game/storage.js";

const app = document.getElementById("app");

async function main() {
  let data;
  try {
    const res = await fetch("data/tsume.json");
    data = await res.json();
  } catch {
    app.innerHTML = `<p class="msg ng">問題データを読み込めませんでした。再読み込みしてください。</p>`;
    return;
  }
  const problems = data.problems;
  const byId = Object.fromEntries(problems.map((p) => [p.id, p]));
  const today = todayStr();
  const ctx = {
    problems, byId, today, day: dayNum(today), firstDay: firstDay(today),
    progress: loadProgress(), settings: loadSettings(), days: loadDays(),
    save() { saveProgress(ctx.progress); saveSettings(ctx.settings); saveDays(ctx.days); },
    goHome,
    start(only) {
      const ids = buildSession(problems, ctx.progress, ctx.settings, ctx.day, only);
      if (!ids.length) { alert("出せる問題がありません。"); goHome(); return; }
      app.onchange = null;
      ctx.title = only ? `${only}手詰` : "今日の詰将棋";
      startSession(app, ctx, ids);
      window.scrollTo(0, 0);
    },
  };
  function goHome() {
    renderHome(app, ctx);
    window.scrollTo(0, 0);
  }
  goHome();
}

main();

import { renderHome } from "./ui/home.js";
import { startSession } from "./ui/play.js";
import { renderJosekiList, startJosekiSession } from "./ui/joseki.js";
import { flattenLines, buildJosekiSession } from "./game/joseki.js";
import { buildSession, todayStr, dayNum } from "./game/srs.js";
import {
  loadProgress, saveProgress, loadSettings, saveSettings, loadDays, saveDays, firstDay,
  loadJosekiProgress, saveJosekiProgress,
} from "./game/storage.js";

const app = document.getElementById("app");

async function main() {
  let data, joseki;
  try {
    [data, joseki] = await Promise.all(["data/tsume.json", "data/joseki.json"].map((u) => fetch(u).then((r) => r.json())));
  } catch {
    app.innerHTML = `<p class="msg ng">問題データを読み込めませんでした。再読み込みしてください。</p>`;
    return;
  }
  const problems = data.problems;
  const byId = Object.fromEntries(problems.map((p) => [p.id, p]));
  const lines = flattenLines(joseki);
  const today = todayStr();
  const ctx = {
    problems, byId, today, day: dayNum(today), firstDay: firstDay(today),
    progress: loadProgress(), settings: loadSettings(), days: loadDays(),
    joseki, lines, lineById: Object.fromEntries(lines.map((l) => [l.id, l])), jprogress: loadJosekiProgress(),
    save() { saveProgress(ctx.progress); saveSettings(ctx.settings); saveDays(ctx.days); saveJosekiProgress(ctx.jprogress); },
    startJoseki() {
      const ids = buildJosekiSession(lines, ctx.jprogress, ctx.day, ctx.settings.josekiCount);
      app.onchange = null;
      startJosekiSession(app, ctx, ids);
      window.scrollTo(0, 0);
    },
    josekiList() { renderJosekiList(app, ctx); window.scrollTo(0, 0); },
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

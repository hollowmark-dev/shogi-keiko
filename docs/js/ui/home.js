// ホーム: 今日のメニュー・今の段階・詰将棋の進み具合
import { MENU, currentPhase } from "../game/plan.js";
import { stats, threeUnlocked, dueCount, dayNum, UNLOCK_SOLVED, UNLOCK_RATE } from "../game/srs.js";
import { esc } from "./dom.js";

function streak(days, today) {
  let n = 0;
  let d = dayNum(today);
  const key = (num) => new Date(num * 86400000).toISOString().slice(0, 10);
  if (!days[today]?.tsume) d--; // 今日まだなら昨日から数える
  while (days[key(d)]?.tsume) { n++; d--; }
  return n;
}

// ctx: { problems, progress, settings, days, today, day, firstDay, save(), start(mode) }
export function renderHome(app, ctx) {
  const { problems, progress, settings, days, today, day } = ctx;
  const todayRec = days[today] || { menu: {} };
  const phase = currentPhase(ctx.firstDay, today);
  const s1 = stats(problems, progress, 1), s3 = stats(problems, progress, 3);
  const unlocked = threeUnlocked(problems, progress, settings);
  const due = dueCount(problems, progress, day);
  const pct = (x) => `${Math.round(x * 100)}%`;
  const menuDone = MENU.filter((m) => (m.auto ? todayRec.tsume : todayRec.menu?.[m.key])).length;

  app.innerHTML = `
    <header class="home-head">
      <h1>将棋けいこ帳</h1>
      <p class="sub">四間飛車で将棋ウォーズ初段へ</p>
    </header>

    <section class="card">
      <div class="card-head"><h2>今日のメニュー</h2><span class="pill">${menuDone} / ${MENU.length}</span></div>
      <ul class="menu">
        ${MENU.map((m) => {
          const done = m.auto ? !!todayRec.tsume : !!todayRec.menu?.[m.key];
          const control = m.auto
            ? `<span class="check ${done ? "on" : ""}" aria-hidden="true">${done ? "✓" : ""}</span>`
            : `<input type="checkbox" class="check-input" data-menu="${m.key}" ${done ? "checked" : ""} aria-label="${esc(m.label)}をやった">`;
          return `<li class="${done ? "done" : ""}">${control}
            <div><div class="m-title">${esc(m.label)}<span class="min">${m.min}分</span></div><div class="m-note">${esc(m.note)}</div></div></li>`;
        }).join("")}
      </ul>
      <button type="button" class="primary wide" data-act="daily">${todayRec.tsume ? "もう一度　今日の詰将棋" : "今日の詰将棋を始める"}（${settings.dailyCount}問）</button>
      <p class="hint-line">${due ? `復習 ${due} 問が待っています。先に出ます。` : "復習の問題はありません。新しい問題が出ます。"}　連続 ${streak(days, today)} 日</p>
    </section>

    <section class="card">
      <div class="card-head"><h2>${esc(phase.name)}</h2><span class="pill">${phase.day}日目</span></div>
      <ul class="goals">${phase.goals.map((g) => `<li>${esc(g)}</li>`).join("")}</ul>
    </section>

    <section class="card">
      <h2>詰将棋の進み具合</h2>
      <table class="stats">
        <thead><tr><th></th><th>解いた</th><th>正答率</th><th>定着</th></tr></thead>
        <tbody>
          <tr><th>1手詰</th><td>${s1.seen} / ${s1.total}</td><td>${s1.seen ? pct(s1.rate) : "-"}</td><td>${s1.mastered}</td></tr>
          <tr><th>3手詰</th><td>${s3.seen} / ${s3.total}</td><td>${s3.seen ? pct(s3.rate) : "-"}</td><td>${s3.mastered}</td></tr>
        </tbody>
      </table>
      <p class="note">「定着」は4回続けて正解し、次に出るのが2週間以上先の問題です。</p>
      <p class="note">${unlocked
        ? "3手詰が今日の問題に混ざります（新しい問題の7割）。"
        : `1手詰を${UNLOCK_SOLVED}問解いて正答率${pct(UNLOCK_RATE)}以上になると、3手詰が混ざり始めます。`}</p>
      <div class="row">
        <button type="button" data-act="only1">1手詰だけ解く</button>
        <button type="button" data-act="only3">3手詰だけ解く</button>
      </div>
    </section>

    <section class="card">
      <h2>設定</h2>
      <label class="field">1日の問題数
        <select data-set="dailyCount">${[5, 10, 15, 20].map((n) => `<option value="${n}" ${n === settings.dailyCount ? "selected" : ""}>${n}問</option>`).join("")}</select>
      </label>
      <label class="field check-field"><input type="checkbox" data-set="allow3" ${settings.allow3 ? "checked" : ""}> 条件を待たずに3手詰を混ぜる</label>
      <p class="note">記録はこの端末のブラウザにだけ保存されます。</p>
    </section>`;

  app.onclick = (e) => {
    const b = e.target.closest("button[data-act]");
    if (!b || !app.contains(b)) return; // 画面を描き直した直後に届いた古いクリックは無視
    const act = b.dataset.act;
    if (!["daily", "only1", "only3"].includes(act)) return;
    app.onclick = null;
    ctx.start(act === "only1" ? 1 : act === "only3" ? 3 : 0);
  };
  app.onchange = (e) => {
    const el = e.target;
    if (el.dataset.menu) {
      const d = (days[today] ||= { solved: 0, correct: 0, menu: {} });
      d.menu = { ...(d.menu || {}), [el.dataset.menu]: el.checked };
      ctx.save();
      renderHome(app, ctx);
    } else if (el.dataset.set === "dailyCount") {
      settings.dailyCount = Number(el.value);
      ctx.save();
      renderHome(app, ctx);
    } else if (el.dataset.set === "allow3") {
      settings.allow3 = el.checked;
      ctx.save();
      renderHome(app, ctx);
    }
  };
}

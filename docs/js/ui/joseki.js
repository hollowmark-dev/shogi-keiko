// 定跡ドリル: 手順の一覧・見て覚える・練習する
import { parseSfen, makeMove, legalMoves, sameMove, pieceType, pieceColor, PROMOTED } from "../engine/shogi.js";
import { START_SFEN } from "../engine/kif.js";
import { PIECE_NAME } from "../engine/notation.js";
import { boardHtml } from "./board.js";
import { esc, announce } from "./dom.js";
import { grade } from "../game/srs.js";
import { ME, drillStart } from "../game/joseki.js";

const STEP_MS = 550;

// 手順の ply 手目までを並べた局面
function posAt(line, ply) {
  let pos = parseSfen(START_SFEN);
  for (let i = 0; i < ply; i++) pos = makeMove(pos, line.moves[i]);
  return pos;
}
const lastOf = (line, ply) => (ply > 0 ? { from: line.moves[ply - 1].drop ? -1 : line.moves[ply - 1].from, to: line.moves[ply - 1].to } : null);
const noteAt = (line, ply) => line.notes?.[String(ply)] || ""; // ply は1始まりの手数
const CONF_LABEL = { "確認済み": "", "出典1つ": "出典1つ", "推定": "要確認" };

function statusLabel(rec, day) {
  if (!rec) return { text: "未学習", cls: "new" };
  if (rec.box >= 4) return { text: "定着", cls: "ok" };
  const d = rec.due - day;
  return { text: d <= 0 ? "今日復習" : `${d}日後に復習`, cls: d <= 0 ? "due" : "" };
}

// ---- 一覧 ----
export function renderJosekiList(app, ctx) {
  const { joseki, jprogress, day } = ctx;
  app.onchange = null;
  app.innerHTML = `
    <header class="play-head">
      <button type="button" class="ghost back" data-act="home">← ホーム</button>
      <span class="prog">四間飛車の定跡</span>
    </header>
    <p class="task">あなたは<strong>後手の四間飛車</strong>です（盤は後手が手前）。相手の居飛車の作戦ごとに、応じ方を覚えます。</p>
    <button type="button" class="primary wide" data-act="today">今日の定跡（${ctx.settings.josekiCount}本）</button>
    ${joseki.chapters.map((ch) => `
      <section class="card">
        <h2>${esc(ch.title)}</h2>
        <p class="note">${esc(ch.summary)}</p>
        <ul class="lines">
          ${ch.lines.map((l) => {
            const st = statusLabel(jprogress[l.id], day);
            const conf = CONF_LABEL[l.confidence];
            return `<li>
              <div class="l-name">${esc(l.name)} <span class="l-len">${l.moves.length}手</span>
                ${conf ? `<span class="badge warn">${conf}</span>` : ""}
                <span class="badge ${st.cls}">${st.text}</span></div>
              <div class="l-btns">
                <button type="button" data-learn="${l.id}">見る</button>
                <button type="button" data-drill="${l.id}">練習</button>
              </div></li>`;
          }).join("")}
        </ul>
      </section>`).join("")}
    <p class="note">「出典1つ」「要確認」の手順は、複数の資料で突き合わせきれていません。本や棋書で確かめながら使ってください。</p>`;
  app.onclick = (e) => {
    const b = e.target.closest("button");
    if (!b || !app.contains(b)) return;
    if (b.dataset.act === "home") { app.onclick = null; ctx.goHome(); }
    else if (b.dataset.act === "today") { app.onclick = null; ctx.startJoseki(); }
    else if (b.dataset.learn) { app.onclick = null; startJosekiSession(app, ctx, [b.dataset.learn], { learnOnly: true }); }
    else if (b.dataset.drill) { app.onclick = null; startJosekiSession(app, ctx, [b.dataset.drill], { forceDrill: true }); }
  };
}

// ---- セッション ----
// opts.learnOnly: 見るだけ（記録しない） / opts.forceDrill: 見て覚えるを飛ばす
export function startJosekiSession(app, ctx, ids, opts = {}) {
  const lines = ids.map((id) => ctx.lineById[id]);
  const base = ctx.lines[0];
  const results = [];
  let idx = 0;
  let st = null;
  let timer = null;

  const back = () => { clearTimeout(timer); app.onclick = null; opts.learnOnly || opts.forceDrill ? renderJosekiList(app, ctx) : ctx.goHome(); };

  function beginLine() {
    const line = lines[idx];
    const learn = opts.learnOnly || (!opts.forceDrill && !ctx.jprogress[line.id]);
    if (learn) beginLearn(line); else beginDrill(line);
  }

  // ---- 見て覚える ----
  function beginLearn(line) {
    const start = drillStart(line, base);
    st = { mode: "learn", line, ply: start, start };
    renderLearn();
  }
  function renderLearn() {
    const { line, ply } = st;
    const pos = posAt(line, ply);
    const note = noteAt(line, ply);
    const from = Math.max(0, ply - 8);
    const kifs = line.kif.slice(from, ply).map((k, i) => `<span class="${from + i === ply - 1 ? "cur" : ""}">${esc(k)}</span>`).join(" ");
    const atEnd = ply >= line.moves.length;
    app.innerHTML = `
      ${head(line, opts.learnOnly ? "見る" : "まず手順を見ます")}
      ${boardHtml({ pos, last: lastOf(line, ply), interactive: false, me: ME })}
      <p class="kif kif-run">${ply ? `${ply}手目まで　` : "初期局面　"}${kifs}</p>
      <div class="note-box ${note ? "" : "empty"}">${note ? esc(note) : "（この手の解説はありません）"}</div>
      ${atEnd ? `<p class="msg info">${esc(line.verdict || "")}</p>${sourcesHtml(line)}` : ""}
      <div class="actions stepper">
        <button type="button" data-act="first" ${ply === 0 ? "disabled" : ""}>|◀</button>
        <button type="button" data-act="prev" ${ply === 0 ? "disabled" : ""}>◀ 戻る</button>
        <button type="button" data-act="next" ${atEnd ? "disabled" : ""}>進む ▶</button>
      </div>
      <div class="actions">
        ${opts.learnOnly
          ? `<button type="button" class="primary" data-act="todrill">この手順を練習する</button>`
          : `<button type="button" class="primary" data-act="todrill">${atEnd ? "練習する" : "最後まで見ずに練習する"}</button>`}
      </div>`;
  }

  // ---- 練習 ----
  function beginDrill(line) {
    const start = drillStart(line, base);
    st = {
      mode: "drill", line, ply: start, start, pos: posAt(line, start), last: lastOf(line, start),
      selected: null, targets: new Set(), promo: null, marks: null, mistakes: 0,
      msg: start ? `${start}手目まで進めました。ここから指してください。` : "初手から指してください。", msgType: "info",
      note: "", done: false, busy: false,
    };
    renderDrill();
    autoPlay();
  }

  function playLineMove() {
    const m = st.line.moves[st.ply];
    st.pos = makeMove(st.pos, m);
    st.last = { from: m.drop ? -1 : m.from, to: m.to };
    st.ply++;
    st.note = noteAt(st.line, st.ply);
    st.selected = null; st.targets = new Set(); st.marks = null; st.promo = null;
  }

  // 相手（先手）の手を自動で指す
  function autoPlay() {
    if (st.ply >= st.line.moves.length) { finishLine(); return; }
    if (st.pos.turn === ME) { renderDrill(); return; }
    st.busy = true;
    renderDrill();
    timer = setTimeout(() => {
      st.busy = false;
      playLineMove();
      st.msg = `相手は ${st.line.kif[st.ply - 1]}。`;
      st.msgType = "";
      autoPlay();
    }, STEP_MS);
  }

  function legalFrom(sel) {
    return legalMoves(st.pos).filter((m) => (sel.drop ? m.drop === sel.drop : !m.drop && m.from === sel.from));
  }
  function select(sel) {
    st.selected = sel;
    st.targets = new Set(sel ? legalFrom(sel).map((m) => m.to) : []);
    renderDrill();
  }

  function tryMove(m) {
    const expect = st.line.moves[st.ply];
    if (sameMove(m, expect)) {
      playLineMove();
      st.msg = st.marks ? "そうです。" : `○ ${st.line.kif[st.ply - 1]}`;
      st.msgType = "ok";
      autoPlay();
      return;
    }
    st.mistakes++;
    // 同じ局面までは同じで、この手を指す別の手順があるか
    const other = ctx.lines.find((l) => l.id !== st.line.id && l.moves.length > st.ply &&
      l.kif.slice(0, st.ply).join() === st.line.kif.slice(0, st.ply).join() && sameMove(l.moves[st.ply], m));
    const want = st.line.kif[st.ply];
    st.msg = other
      ? `それも定跡（「${other.name}」）ですが、今は「${st.line.name}」を練習中です。正解は ${want}。`
      : `定跡は ${want} です。光っているマスを確かめて、指し直してください。`;
    st.msgType = "ng";
    st.marks = { from: expect.drop ? -1 : expect.from, to: expect.to, drop: expect.drop || 0 };
    st.note = noteAt(st.line, st.ply + 1);
    st.selected = null; st.targets = new Set();
    renderDrill();
  }

  function finishLine() {
    st.done = true;
    const line = st.line;
    const perfect = st.mistakes === 0;
    if (!opts.learnOnly) {
      ctx.jprogress[line.id] = grade(ctx.jprogress[line.id], perfect, ctx.day);
      results.push({ id: line.id, perfect, mistakes: st.mistakes });
      ctx.save();
    }
    st.msg = perfect ? "最後まで間違えずに指せました。" : `最後まで指しました（間違い ${st.mistakes} 回）。明日もう一度出ます。`;
    st.msgType = perfect ? "ok" : "info";
    renderDrill();
    announce(st.msg);
  }

  function renderDrill() {
    const line = st.line;
    let promo = "";
    if (st.promo) {
      const t = pieceType(st.pos.board[st.promo[0].from]);
      promo = `<div class="promo"><button type="button" class="primary" data-promo="1">成る（${PIECE_NAME[t + PROMOTED]}）</button>
        <button type="button" data-promo="0">成らない（${PIECE_NAME[t]}）</button>
        <button type="button" class="ghost" data-promo="x">やめる</button></div>`;
    }
    const isLast = idx + 1 >= lines.length;
    app.innerHTML = `
      ${head(line, `${idx + 1} / ${lines.length}`)}
      ${boardHtml({ pos: st.pos, selected: st.selected, targets: st.targets, last: st.last, marks: st.marks, interactive: !st.done && !st.busy, me: ME })}
      ${promo}
      <p class="msg ${st.msgType}" aria-live="polite">${esc(st.msg) || "&nbsp;"}</p>
      <div class="note-box ${st.note ? "" : "empty"}">${st.note ? esc(st.note) : `${st.ply}手目`}</div>
      ${st.done ? `<p class="verdict">${esc(line.verdict || "")}</p>` : ""}
      <div class="actions">
        ${st.done
          ? `<button type="button" class="primary" data-act="nextline">${isLast ? "おわる" : "次の手順へ"}</button>
             <button type="button" data-act="relearn">手順を見直す</button>`
          : `<button type="button" class="ghost" data-act="showhint">正解を見る</button>`}
      </div>`;
  }

  function head(line, label) {
    return `<header class="play-head">
        <button type="button" class="ghost back" data-act="back">← 戻る</button>
        <span class="prog">${esc(label)}</span>
      </header>
      <p class="task"><strong>${esc(line.chapter.title)}</strong>　${esc(line.name)}</p>`;
  }

  function sourcesHtml(line) {
    if (!line.sources?.length) return "";
    return `<p class="note">参考: ${line.sources.map((u, i) => `<a href="${esc(u)}" target="_blank" rel="noopener">資料${i + 1}</a>`).join("　")}</p>`;
  }

  function finishSession() {
    if (!opts.learnOnly && !opts.forceDrill) {
      const d = (ctx.days[ctx.today] ||= { solved: 0, correct: 0, menu: {} });
      d.joseki = true;
      ctx.save();
    }
    if (opts.learnOnly || opts.forceDrill) { back(); return; }
    const ok = results.filter((r) => r.perfect).length;
    app.innerHTML = `
      <section class="card result">
        <h2>今日の定跡　おわり</h2>
        <p class="big">${ok} / ${results.length} 本 ノーミス</p>
        <ul class="res-list">${results.map((r) => `<li class="${r.perfect ? "ok" : "ng"}">${r.perfect ? "○" : "×"} ${esc(ctx.lineById[r.id].chapter.title)}：${esc(ctx.lineById[r.id].name)}</li>`).join("")}</ul>
        <button type="button" class="primary" data-act="back">ホームへ</button>
      </section>`;
  }

  app.onclick = (e) => {
    const el = e.target.closest("button");
    if (!el || !app.contains(el) || el.disabled) return;
    const act = el.dataset.act;
    if (act === "back") { back(); return; }
    if (st.mode === "learn") {
      if (act === "first") st.ply = 0;
      else if (act === "prev") st.ply = Math.max(0, st.ply - 1);
      else if (act === "next") st.ply = Math.min(st.line.moves.length, st.ply + 1);
      else if (act === "todrill") { beginDrill(st.line); return; }
      renderLearn();
      return;
    }
    // 練習
    if (act === "nextline") {
      idx++;
      if (idx >= lines.length) finishSession(); else beginLine();
      return;
    }
    if (act === "relearn") { beginLearn(st.line); return; }
    if (st.done || st.busy) return;
    if (act === "showhint") {
      const expect = st.line.moves[st.ply];
      st.mistakes++;
      st.marks = { from: expect.drop ? -1 : expect.from, to: expect.to, drop: expect.drop || 0 };
      st.msg = `正解は ${st.line.kif[st.ply]}。指してみてください。`;
      st.msgType = "info";
      st.note = noteAt(st.line, st.ply + 1);
      renderDrill();
      return;
    }
    if (el.dataset.promo != null) {
      const cands = st.promo;
      st.promo = null;
      if (el.dataset.promo === "x") { select(null); return; }
      tryMove(cands.find((m) => m.promote === (el.dataset.promo === "1")));
      return;
    }
    if (el.dataset.hand != null) {
      const t = Number(el.dataset.hand);
      select(st.selected && st.selected.drop === t ? null : { drop: t });
      return;
    }
    if (el.dataset.sq != null) {
      const s = Number(el.dataset.sq);
      if (st.selected && st.targets.has(s)) {
        const cands = legalFrom(st.selected).filter((m) => m.to === s);
        if (cands.length === 2) { st.promo = cands; renderDrill(); return; }
        tryMove(cands[0]);
        return;
      }
      const pc = st.pos.board[s];
      if (pc && pieceColor(pc) === ME && !(st.selected && st.selected.from === s)) select({ from: s });
      else select(null);
    }
  };

  beginLine();
}

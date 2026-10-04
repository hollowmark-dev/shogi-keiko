// 詰将棋を解く画面（1セッション = 数問）
import {
  parseSfen, makeMove, legalMoves, inCheck, isCheckmate, sameMove, pieceType, pieceColor, SENTE, GOTE, PROMOTED,
} from "../engine/shogi.js";
import { chooseDefense } from "../engine/mate.js";
import { moveToKif, PIECE_NAME } from "../engine/notation.js";
import { boardHtml } from "./board.js";
import { explainMate } from "./explain.js";
import { grade } from "../game/srs.js";
import { esc, announce } from "./dom.js";

const STEP_MS = 650;

// ctx: { byId, progress, days, today, day, save(), goHome(), title }
export function startSession(app, ctx, ids) {
  const session = { ids: ids.slice(), i: 0, results: [], retry: [], inRetry: false };
  let st = null; // 今の問題の状態
  let busy = false;

  function load(id) {
    const p = ctx.byId[id];
    const start = parseSfen(p.sfen);
    st = {
      p, start, pos: start, ply: 0, selected: null, targets: new Set(), last: null,
      phase: "play", firstTry: true, hinted: false, graded: session.inRetry,
      msg: "", msgType: "", explain: [], kif: [], promo: null, hintSq: -1, hintDrop: 0,
    };
    render();
  }

  function recordResult(correct) {
    if (st.graded) return;
    st.graded = true;
    const id = st.p.id;
    ctx.progress[id] = grade(ctx.progress[id], correct, ctx.day);
    const d = (ctx.days[ctx.today] ||= { solved: 0, correct: 0, menu: {} });
    d.solved++;
    if (correct) d.correct++;
    session.results.push({ id, correct });
    if (!correct) session.retry.push(id);
    ctx.save();
  }

  function legalFromSelection(sel) {
    return legalMoves(st.pos).filter((m) => (sel.drop ? m.drop === sel.drop : !m.drop && m.from === sel.from));
  }

  function select(sel) {
    st.selected = sel;
    st.targets = new Set(sel ? legalFromSelection(sel).map((m) => m.to) : []);
    render();
  }

  function onSquare(s) {
    if (st.phase !== "play" || busy || st.promo) return;
    if (st.selected && st.targets.has(s)) {
      const cands = legalFromSelection(st.selected).filter((m) => m.to === s);
      if (cands.length === 2) { st.promo = cands; render(); return; }
      commit(cands[0]);
      return;
    }
    const pc = st.pos.board[s];
    if (pc && pieceColor(pc) === SENTE && !(st.selected && st.selected.from === s)) select({ from: s });
    else select(null);
  }

  function onHand(t) {
    if (st.phase !== "play" || busy || st.promo) return;
    select(st.selected && st.selected.drop === t ? null : { drop: t });
  }

  function lastTo() { return st.last ? st.last.to : -1; }

  function play(m) {
    st.kif.push(moveToKif(st.pos, m, lastTo()));
    st.pos = makeMove(st.pos, m);
    st.last = { from: m.drop ? -1 : m.from, to: m.to };
    st.selected = null; st.targets = new Set(); st.promo = null; st.hintSq = -1; st.hintDrop = 0;
  }

  function commit(m) {
    play(m);
    const final = st.ply + 1 === st.p.plies;
    const correct = final ? isCheckmate(st.pos) : sameMove(m, st.p.moves[st.ply]);
    if (correct && final) {
      st.phase = "done";
      st.msg = st.firstTry && !st.hinted ? "正解！ 詰みです。" : "詰みました。";
      st.msgType = "ok";
      st.explain = explainMate(st.pos);
      recordResult(st.firstTry && !st.hinted);
      render();
      announce(st.msg);
      return;
    }
    if (correct) {
      st.ply++;
      st.msg = "正解。相手の応手を待っています…";
      st.msgType = "";
      render();
      busy = true;
      setTimeout(() => {
        busy = false;
        play(st.p.moves[st.ply]);
        st.ply++;
        st.msg = `相手は ${st.kif[st.kif.length - 1]}。次の一手で詰ませてください。`;
        render();
      }, STEP_MS);
      return;
    }
    // 不正解
    st.firstTry = false;
    recordResult(false);
    st.phase = "wrong";
    st.msgType = "ng";
    if (!inCheck(st.pos, GOTE)) {
      st.msg = "王手になっていません。詰将棋では毎回王手をかけます。";
      render();
      return;
    }
    const rest = st.p.plies - st.ply - 1;
    const def = chooseDefense(st.pos, rest);
    st.msg = "その手では詰みません。";
    render();
    if (def) {
      busy = true;
      setTimeout(() => {
        busy = false;
        play(def.move);
        st.msg = `${st.kif[st.kif.length - 1]} と応じられて、詰みません。`;
        render();
      }, STEP_MS);
    }
  }

  function retryProblem() {
    const keepGraded = st.graded;
    load(st.p.id);
    st.graded = keepGraded;
    st.firstTry = false;
    render();
  }

  function showAnswer() {
    const keepGraded = st.graded;
    load(st.p.id);
    st.graded = keepGraded;
    st.firstTry = false;
    recordResult(false);
    st.phase = "showing";
    st.msg = "答えを並べています…";
    render();
    busy = true;
    const step = (k) => {
      if (k >= st.p.moves.length) {
        busy = false;
        st.phase = "done";
        st.msgType = "info";
        st.msg = "これが正解手順です。";
        st.explain = explainMate(st.pos);
        render();
        return;
      }
      play(st.p.moves[k]);
      render();
      setTimeout(() => step(k + 1), STEP_MS);
    };
    setTimeout(() => step(0), 300);
  }

  function hint() {
    const m = st.p.moves[st.ply];
    st.hinted = true;
    if (m.drop) st.msg = `ヒント: 持ち駒の${PIECE_NAME[m.drop]}を使います。`;
    else st.msg = `ヒント: 光っている${PIECE_NAME[pieceType(st.pos.board[m.from])]}を動かします。`;
    st.msgType = "info";
    st.selected = null;
    st.targets = new Set();
    st.hintSq = m.drop ? -1 : m.from;
    st.hintDrop = m.drop || 0;
    render();
  }

  function next() {
    session.i++;
    if (session.i >= session.ids.length && !session.inRetry && session.retry.length) {
      session.inRetry = true;
      session.ids = session.ids.concat(session.retry);
    }
    if (session.i >= session.ids.length) { finish(); return; }
    load(session.ids[session.i]);
  }

  function finish() {
    app.onclick = null;
    const d = (ctx.days[ctx.today] ||= { solved: 0, correct: 0, menu: {} });
    d.tsume = true;
    ctx.save();
    const n = session.results.length;
    const ok = session.results.filter((r) => r.correct).length;
    app.innerHTML = `
      <section class="card result">
        <h2>おつかれさまでした</h2>
        <p class="big">${ok} / ${n} 問 正解</p>
        <p>間違えた問題は明日もう一度出ます。正解した問題は、正解を重ねるごとに1日後→3日後→1週間後…と間隔を空けて出ます。</p>
        <ul class="res-list">${session.results.map((r) => `<li class="${r.correct ? "ok" : "ng"}">${r.correct ? "○" : "×"} ${esc(ctx.byId[r.id].line.join(" "))}</li>`).join("")}</ul>
        <button type="button" class="primary" data-act="home">ホームへ</button>
      </section>`;
    app.querySelector("[data-act=home]").addEventListener("click", ctx.goHome);
    announce(`${n}問中${ok}問正解`);
  }

  function render() {
    const p = st.p;
    const total = session.ids.length;
    const label = session.inRetry ? "もう一度" : `${session.i + 1} / ${total}`;
    const view = {
      pos: st.pos, selected: st.selected, targets: st.targets, last: st.last,
      interactive: st.phase === "play", oppHand: "all",
    };
    let promo = "";
    if (st.promo) {
      const t = pieceType(st.pos.board[st.promo[0].from]);
      promo = `<div class="promo" role="dialog" aria-label="成りますか">
        <button type="button" class="primary" data-promo="1">成る（${PIECE_NAME[t + PROMOTED]}）</button>
        <button type="button" data-promo="0">成らない（${PIECE_NAME[t]}）</button>
        <button type="button" class="ghost" data-promo="x">やめる</button></div>`;
    }
    const buttons = [];
    if (st.phase === "play") buttons.push(`<button type="button" class="ghost" data-act="hint">ヒント</button>`, `<button type="button" class="ghost" data-act="answer">答えを見る</button>`);
    if (st.phase === "wrong") buttons.push(`<button type="button" class="primary" data-act="retry">もう一度</button>`, `<button type="button" data-act="answer">答えを見る</button>`, `<button type="button" class="ghost" data-act="next">次へ</button>`);
    if (st.phase === "done") buttons.push(`<button type="button" class="primary" data-act="next">次へ</button>`);
    app.innerHTML = `
      <header class="play-head">
        <button type="button" class="ghost back" data-act="home" aria-label="ホームへ戻る">← ホーム</button>
        <span class="prog">${esc(ctx.title)}　${label}</span>
      </header>
      <p class="task"><strong>${p.plies}手詰</strong>　先手番です。王手の連続で玉を詰ませてください。</p>
      ${boardHtml(view)}
      ${promo}
      <p class="msg ${st.msgType}" aria-live="polite">${esc(st.msg) || "&nbsp;"}</p>
      ${st.kif.length ? `<p class="kif">${esc(st.kif.join("　"))}</p>` : ""}
      ${st.explain.length ? `<div class="explain"><h3>なぜ詰んでいるか</h3><ul>${st.explain.map((l) => `<li>${esc(l)}</li>`).join("")}</ul></div>` : ""}
      <div class="actions">${buttons.join("")}</div>`;
    if (st.hintSq >= 0 && st.phase === "play") app.querySelector(`[data-sq="${st.hintSq}"]`)?.classList.add("hint");
    if (st.hintDrop && st.phase === "play") app.querySelector(`[data-hand="${st.hintDrop}"]`)?.classList.add("hint");
  }

  app.onclick = (e) => {
    const el = e.target.closest("button");
    if (!el || !app.contains(el)) return;
    if (el.dataset.sq != null) return onSquare(Number(el.dataset.sq));
    if (el.dataset.hand != null) return onHand(Number(el.dataset.hand));
    if (el.dataset.promo != null) {
      const v = el.dataset.promo;
      const cands = st.promo;
      st.promo = null;
      if (v === "x") { select(null); return; }
      commit(cands.find((m) => m.promote === (v === "1")));
      return;
    }
    const act = el.dataset.act;
    if (busy && act !== "home") return;
    if (act === "home") { app.onclick = null; ctx.goHome(); }
    else if (act === "hint") hint();
    else if (act === "answer") showAnswer();
    else if (act === "retry") retryProblem();
    else if (act === "next") next();
  };

  load(session.ids[0]);
}

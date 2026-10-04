// 日本語の棋譜（▲7六歩・△同角・▲5七銀左・△4四角打 など）を合法手に変換する
import { legalMoves, makeMove, parseSfen } from "./shogi.js";
import { moveToKif } from "./notation.js";

export const START_SFEN = "lnsgkgsnl/1r5b1/ppppppppp/9/9/9/PPPPPPPPP/1B5R1/LNSGKGSNL b -";

function norm(s) {
  return s
    .replace(/[▲△☗☖\s　]/g, "")
    .replace(/[０-９]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0))
    .replace(/竜/g, "龍").replace(/王/g, "玉")
    .replace(/杏/g, "成香").replace(/圭/g, "成桂").replace(/全/g, "成銀");
}
// 「同」の後ろに付く全角スペースなどの違いを吸収し、左右上引寄直を外した形
const core = (s) => s.replace(/[右左上引寄直]/g, "");

// prevTo: 直前の手の移動先（「同」用）。見つからなければ例外
export function parseKifMove(pos, text, prevTo = -1) {
  const want = norm(text);
  const cands = legalMoves(pos).map((m) => ({ m, k: norm(moveToKif(pos, m, prevTo)) }));
  const tries = [
    (k) => k === want,
    (k) => k.replace(/打$/, "") === want, // 打を省略した書き方
    (k) => core(k) === core(want),
    (k) => core(k).replace(/打$/, "") === core(want),
  ];
  for (const t of tries) {
    const hit = cands.filter((c) => t(c.k));
    if (hit.length === 1) return hit[0].m;
    if (hit.length > 1) {
      // 打を省略していて盤上の駒も動ける場合は、盤上の駒を動かす手を優先（棋譜の約束）
      const board = hit.filter((c) => !c.m.drop);
      if (board.length === 1 && !/打$/.test(want)) return board[0].m;
      throw new Error(`あいまいな指し手: ${text}（候補 ${hit.map((c) => c.k).join(" / ")}）`);
    }
  }
  throw new Error(`指せない手: ${text}`);
}

// 初手からの手順を検証して [{ move, kif, pos(指した後) }] を返す
export function parseLine(texts, sfen = START_SFEN) {
  let pos = parseSfen(sfen);
  let prevTo = -1;
  const out = [];
  texts.forEach((t, i) => {
    let m;
    try { m = parseKifMove(pos, t, prevTo); } catch (e) { throw new Error(`${i + 1}手目 ${e.message}`); }
    const kif = moveToKif(pos, m, prevTo);
    pos = makeMove(pos, m);
    prevTo = m.to;
    out.push({ move: m, kif, pos });
  });
  return out;
}

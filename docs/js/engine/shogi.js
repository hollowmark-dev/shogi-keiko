// 将棋のルール判定（盤面・SFEN・合法手・王手）。依存なし。
//
// マス番号 sq = row * 9 + col。row 0 が一段目（上・後手側）、col 0 が9筋（左）。
//   筋 = 9 - col、段 = row + 1。SFEN の並び順とそのまま一致する。
// 駒コード = 種類 | (手番 << 4)。0 は空きマス。成駒は種類 + 8。

export const SENTE = 0, GOTE = 1;
export const P = 1, L = 2, N = 3, S = 4, G = 5, B = 6, R = 7, K = 8;
export const PROMOTED = 8;
export const HAND_TYPES = [R, B, G, S, N, L, P]; // 持ち駒の表示順

export const pieceType = (pc) => pc & 15;
export const pieceColor = (pc) => pc >> 4;
export const makePiece = (type, color) => type | (color << 4);
export const baseType = (t) => (t > K ? t - PROMOTED : t);
export const isPromotable = (t) => t >= P && t <= R && t !== G;
export const rowOf = (s) => (s / 9) | 0;
export const colOf = (s) => s % 9;
export const toSq = (file, rank) => (rank - 1) * 9 + (9 - file);
export const fileOf = (s) => 9 - colOf(s);
export const rankOf = (s) => rowOf(s) + 1;

// ---- 駒の動き（先手から見た [段の増分, 列の増分]。後手は段を反転） ----
const GOLD = [[-1, -1], [-1, 0], [-1, 1], [0, -1], [0, 1], [1, 0]];
const KING8 = [[-1, -1], [-1, 0], [-1, 1], [0, -1], [0, 1], [1, -1], [1, 0], [1, 1]];
const ORTH = [[-1, 0], [1, 0], [0, -1], [0, 1]];
const DIAG = [[-1, -1], [-1, 1], [1, -1], [1, 1]];
const STEP_SENTE = {
  [P]: [[-1, 0]], [L]: [], [N]: [[-2, -1], [-2, 1]],
  [S]: [[-1, -1], [-1, 0], [-1, 1], [1, -1], [1, 1]], [G]: GOLD, [B]: [], [R]: [], [K]: KING8,
  [P + 8]: GOLD, [L + 8]: GOLD, [N + 8]: GOLD, [S + 8]: GOLD, [B + 8]: ORTH, [R + 8]: DIAG,
};
const SLIDE_SENTE = { [L]: [[-1, 0]], [B]: DIAG, [R]: ORTH, [B + 8]: DIAG, [R + 8]: ORTH };

const key = (dr, dc) => (dr + 2) * 5 + (dc + 2);
const STEPS = [{}, {}], SLIDES = [{}, {}], STEP_KEYS = [{}, {}], SLIDE_KEYS = [{}, {}];
for (const color of [SENTE, GOTE]) {
  const flip = (d) => (color === SENTE ? d : [-d[0], d[1]]);
  for (const t of Object.keys(STEP_SENTE).map(Number)) {
    STEPS[color][t] = STEP_SENTE[t].map(flip);
    SLIDES[color][t] = (SLIDE_SENTE[t] || []).map(flip);
    STEP_KEYS[color][t] = new Set(STEPS[color][t].map(([a, b]) => key(a, b)));
    SLIDE_KEYS[color][t] = new Set(SLIDES[color][t].map(([a, b]) => key(a, b)));
  }
}
export const stepsOf = (t, color) => STEPS[color][t];
export const slidesOf = (t, color) => SLIDES[color][t];

// ---- 局面 ----
export function emptyPosition() {
  return { board: new Array(81).fill(0), hands: [new Array(9).fill(0), new Array(9).fill(0)], turn: SENTE };
}
export function clonePosition(pos) {
  return { board: pos.board.slice(), hands: [pos.hands[0].slice(), pos.hands[1].slice()], turn: pos.turn };
}

const SFEN_CHARS = { P, L, N, S, G, B, R, K };
const CHAR_OF = { [P]: "P", [L]: "L", [N]: "N", [S]: "S", [G]: "G", [B]: "B", [R]: "R", [K]: "K" };

export function parseSfen(sfen) {
  const [boardStr, turnStr = "b", handStr = "-"] = sfen.trim().split(/\s+/);
  const pos = emptyPosition();
  const rows = boardStr.split("/");
  if (rows.length !== 9) throw new Error("SFEN: 段の数が9ではありません: " + sfen);
  rows.forEach((rowStr, row) => {
    let col = 0, promoted = false;
    for (const ch of rowStr) {
      if (/\d/.test(ch)) { col += Number(ch); continue; }
      if (ch === "+") { promoted = true; continue; }
      const t = SFEN_CHARS[ch.toUpperCase()];
      if (!t || col > 8) throw new Error("SFEN: 不正な文字: " + ch);
      const color = ch === ch.toUpperCase() ? SENTE : GOTE;
      pos.board[row * 9 + col] = makePiece(promoted ? t + PROMOTED : t, color);
      promoted = false;
      col++;
    }
    if (col !== 9) throw new Error(`SFEN: ${row + 1}段目のマス数が9ではありません`);
  });
  pos.turn = turnStr === "w" ? GOTE : SENTE;
  if (handStr !== "-") {
    let n = 0;
    for (const ch of handStr) {
      if (/\d/.test(ch)) { n = n * 10 + Number(ch); continue; }
      const t = SFEN_CHARS[ch.toUpperCase()];
      if (!t || t === K) throw new Error("SFEN: 不正な持ち駒: " + ch);
      pos.hands[ch === ch.toUpperCase() ? SENTE : GOTE][t] += n || 1;
      n = 0;
    }
  }
  return pos;
}

export function toSfen(pos, { withHands = true } = {}) {
  const rows = [];
  for (let row = 0; row < 9; row++) {
    let s = "", empty = 0;
    for (let col = 0; col < 9; col++) {
      const pc = pos.board[row * 9 + col];
      if (!pc) { empty++; continue; }
      if (empty) { s += empty; empty = 0; }
      const t = pieceType(pc);
      const ch = CHAR_OF[baseType(t)];
      s += (t > K ? "+" : "") + (pieceColor(pc) === SENTE ? ch : ch.toLowerCase());
    }
    if (empty) s += empty;
    rows.push(s);
  }
  let hand = "";
  for (const color of [SENTE, GOTE]) {
    for (const t of HAND_TYPES) {
      const n = pos.hands[color][t];
      if (!n) continue;
      const ch = color === SENTE ? CHAR_OF[t] : CHAR_OF[t].toLowerCase();
      hand += (n > 1 ? n : "") + ch;
    }
  }
  const head = rows.join("/") + " " + (pos.turn === SENTE ? "b" : "w");
  return withHands ? head + " " + (hand || "-") : head;
}

export function findKing(pos, color) {
  const k = makePiece(K, color);
  return pos.board.indexOf(k);
}

// ---- 利き ----
// 種類 t・手番 color の駒が from にいるとき to に利いているか（間の駒も見る）
export function pieceAttacks(board, from, t, color, to) {
  const dr = rowOf(to) - rowOf(from), dc = colOf(to) - colOf(from);
  if (dr === 0 && dc === 0) return false;
  if (Math.abs(dr) <= 2 && Math.abs(dc) <= 2 && STEP_KEYS[color][t].has(key(dr, dc))) return true;
  if (dr !== 0 && dc !== 0 && Math.abs(dr) !== Math.abs(dc)) return false;
  const ur = Math.sign(dr), uc = Math.sign(dc);
  if (!SLIDE_KEYS[color][t].has(key(ur, uc))) return false;
  const dist = Math.max(Math.abs(dr), Math.abs(dc));
  for (let k = 1; k < dist; k++) if (board[from + (ur * 9 + uc) * k]) return false;
  return true;
}

// sq に byColor の駒が利いているか
export function isAttacked(board, s, byColor) {
  const r = rowOf(s), c = colOf(s);
  for (const [dr, dc] of KING8) {
    let nr = r + dr, nc = c + dc, dist = 1;
    while (nr >= 0 && nr < 9 && nc >= 0 && nc < 9) {
      const pc = board[nr * 9 + nc];
      if (pc) {
        if (pieceColor(pc) === byColor) {
          const t = pieceType(pc);
          // 駒から見た向きは (-dr, -dc)
          if ((dist === 1 && STEP_KEYS[byColor][t].has(key(-dr, -dc))) || SLIDE_KEYS[byColor][t].has(key(-dr, -dc))) return true;
        }
        break;
      }
      nr += dr; nc += dc; dist++;
    }
  }
  const back = byColor === SENTE ? 2 : -2; // 桂は前に2つ・横に1つ
  for (const dc of [-1, 1]) {
    const nr = r + back, nc = c + dc;
    if (nr < 0 || nr > 8 || nc < 0 || nc > 8) continue;
    if (board[nr * 9 + nc] === makePiece(N, byColor)) return true;
  }
  return false;
}

// s に利いている byColor の駒のマス一覧（解説用）
export function attackersOf(board, s, byColor) {
  const out = [];
  for (let from = 0; from < 81; from++) {
    const pc = board[from];
    if (pc && pieceColor(pc) === byColor && pieceAttacks(board, from, pieceType(pc), byColor, s)) out.push(from);
  }
  return out;
}

export function inCheck(pos, color) {
  const k = findKing(pos, color);
  return k >= 0 && isAttacked(pos.board, k, color ^ 1);
}

// ---- 指し手 ----
// { from, to, drop, promote }。drop は打つ駒の種類（盤上の駒を動かすときは 0、from は -1）
const inZone = (row, color) => (color === SENTE ? row <= 2 : row >= 6);
const lastRows = (row, color, n) => (color === SENTE ? row < n : row > 8 - n);

// その駒がそのマスにいて、もう動けないか（行き所のない駒）
export function isDeadSquare(t, color, row) {
  if (t === P || t === L) return lastRows(row, color, 1);
  if (t === N) return lastRows(row, color, 2);
  return false;
}

function pushBoardMove(moves, from, to, t, color) {
  const canPromote = isPromotable(t) && (inZone(rowOf(from), color) || inZone(rowOf(to), color));
  if (canPromote) moves.push({ from, to, drop: 0, promote: true });
  if (!isDeadSquare(t, color, rowOf(to))) moves.push({ from, to, drop: 0, promote: false });
}

export function canPromoteMove(pos, m) {
  if (m.drop) return false;
  const pc = pos.board[m.from];
  const color = pieceColor(pc);
  return isPromotable(pieceType(pc)) && (inZone(rowOf(m.from), color) || inZone(rowOf(m.to), color));
}

function hasPawnOnFile(board, col, color) {
  const p = makePiece(P, color);
  for (let row = 0; row < 9; row++) if (board[row * 9 + col] === p) return true;
  return false;
}

// 王手を受けているとき、合駒を打てるマス（それ以外の打ち駒は王手を外せない）
function interposeSquares(pos, color) {
  const k = findKing(pos, color);
  if (k < 0) return null;
  const set = new Set();
  let checks = 0;
  const r = rowOf(k), c = colOf(k);
  for (const [dr, dc] of KING8) {
    let nr = r + dr, nc = c + dc, dist = 1;
    const between = [];
    while (nr >= 0 && nr < 9 && nc >= 0 && nc < 9) {
      const pc = pos.board[nr * 9 + nc];
      if (pc) {
        if (pieceColor(pc) !== color) {
          const t = pieceType(pc);
          if ((dist === 1 && STEP_KEYS[color ^ 1][t].has(key(-dr, -dc))) || SLIDE_KEYS[color ^ 1][t].has(key(-dr, -dc))) {
            checks++;
            between.forEach((x) => set.add(x));
          }
        }
        break;
      }
      between.push(nr * 9 + nc);
      nr += dr; nc += dc; dist++;
    }
  }
  if (checks > 1) return new Set(); // 両王手には合駒できない
  return set;
}

export function pseudoMoves(pos) {
  const us = pos.turn, board = pos.board, moves = [];
  for (let s = 0; s < 81; s++) {
    const pc = board[s];
    if (!pc || pieceColor(pc) !== us) continue;
    const t = pieceType(pc), r = rowOf(s), c = colOf(s);
    for (const [dr, dc] of STEPS[us][t]) {
      const nr = r + dr, nc = c + dc;
      if (nr < 0 || nr > 8 || nc < 0 || nc > 8) continue;
      const to = nr * 9 + nc, tp = board[to];
      if (tp && pieceColor(tp) === us) continue;
      pushBoardMove(moves, s, to, t, us);
    }
    for (const [dr, dc] of SLIDES[us][t]) {
      let nr = r + dr, nc = c + dc;
      while (nr >= 0 && nr < 9 && nc >= 0 && nc < 9) {
        const to = nr * 9 + nc, tp = board[to];
        if (tp && pieceColor(tp) === us) break;
        pushBoardMove(moves, s, to, t, us);
        if (tp) break;
        nr += dr; nc += dc;
      }
    }
  }
  const hand = pos.hands[us];
  if (HAND_TYPES.some((t) => hand[t] > 0)) {
    const only = inCheck(pos, us) ? interposeSquares(pos, us) : null;
    for (const t of HAND_TYPES) {
      if (!hand[t]) continue;
      for (let s = 0; s < 81; s++) {
        if (board[s] || (only && !only.has(s))) continue;
        if (isDeadSquare(t, us, rowOf(s))) continue;
        if (t === P && hasPawnOnFile(board, colOf(s), us)) continue; // 二歩
        moves.push({ from: -1, to: s, drop: t, promote: false });
      }
    }
  }
  return moves;
}

export function makeMove(pos, m) {
  const b = pos.board.slice();
  const h = [pos.hands[0].slice(), pos.hands[1].slice()];
  const us = pos.turn;
  if (m.drop) {
    b[m.to] = makePiece(m.drop, us);
    h[us][m.drop]--;
  } else {
    const pc = b[m.from], cap = b[m.to];
    if (cap) h[us][baseType(pieceType(cap))]++;
    b[m.to] = m.promote ? pc + PROMOTED : pc;
    b[m.from] = 0;
  }
  return { board: b, hands: h, turn: us ^ 1 };
}

// 合法手と指した後の局面の組 [{ move, pos }]
export function legalMovesWithPos(pos) {
  const us = pos.turn, out = [];
  for (const m of pseudoMoves(pos)) {
    const next = makeMove(pos, m);
    if (inCheck(next, us)) continue;
    if (m.drop === P && isUchifuzume(next, m.to)) continue;
    out.push({ move: m, pos: next });
  }
  return out;
}

export const legalMoves = (pos) => legalMovesWithPos(pos).map((x) => x.move);

// 打ち歩詰め: 打った歩が王手で、相手に合法手がない
function isUchifuzume(next, pawnSq) {
  const them = next.turn;
  const k = findKing(next, them);
  if (k < 0) return false;
  const front = pawnSq + (them === GOTE ? -9 : 9); // 歩の利き先（打った側から見て前）
  if (front !== k) return false;
  return legalMovesWithPos(next).length === 0;
}

export function isCheckmate(pos) {
  return inCheck(pos, pos.turn) && legalMovesWithPos(pos).length === 0;
}

// 打つ手は from を持たないことがある（問題データは { drop, to } だけ）ので drop で分ける
export const sameMove = (a, b) =>
  a.to === b.to && (a.drop || 0) === (b.drop || 0) &&
  (a.drop ? true : a.from === b.from && !!a.promote === !!b.promote);

export const moveKey = (m) => (m.drop ? `D${m.drop}-${m.to}` : `${m.from}-${m.to}${m.promote ? "+" : ""}`);

// ---- 詰将棋の玉方持駒（盤上と攻方持駒以外の残り全部） ----
const TOTAL = { [P]: 18, [L]: 4, [N]: 4, [S]: 4, [G]: 4, [B]: 2, [R]: 2 };
export function fillDefenderHand(pos, defender = GOTE) {
  const rest = { ...TOTAL };
  for (const pc of pos.board) if (pc && pieceType(pc) !== K) rest[baseType(pieceType(pc))]--;
  for (const t of HAND_TYPES) rest[t] -= pos.hands[defender ^ 1][t];
  for (const t of HAND_TYPES) pos.hands[defender][t] = Math.max(0, rest[t]);
  return pos;
}

// 学習プラン（振り飛車・1日30分・半年で将棋ウォーズ初段）
import { dayNum } from "./srs.js";

export const PHASES = [
  {
    name: "第1段階　勘を戻す", from: 0, to: 28,
    goals: ["1手詰・3手詰を毎日10問", "戦法を四間飛車＋美濃囲いに決める", "10分切れ負けを1日1局"],
  },
  {
    name: "第2段階　勝ち方を覚える", from: 28, to: 91,
    goals: ["3手詰・5手詰が中心", "寄せの手筋（頭金・腹銀・美濃崩し）", "四間飛車で、相手の主な作戦3〜4通りへの応じ方", "負けた将棋の振り返り"],
  },
  {
    name: "第3段階　初段の壁", from: 91, to: 183,
    goals: ["5〜7手詰", "中盤の手筋（歩の使い方・玉の早逃げ）", "対抗形での囲いの崩し方"],
  },
];

export function currentPhase(firstDay, today) {
  const d = dayNum(today) - dayNum(firstDay);
  const i = PHASES.findIndex((p) => d >= p.from && d < p.to);
  const idx = i < 0 ? PHASES.length - 1 : i;
  return { ...PHASES[idx], index: idx, day: d + 1, week: Math.floor(d / 7) + 1 };
}

// 毎日のメニュー（合計30分）。tsume は出題を解き終えると自動でつく
export const MENU = [
  { key: "tsume", label: "詰将棋", min: 10, note: "今日の問題を解く", auto: true },
  { key: "kata", label: "手筋・定跡", min: 5, note: "四間飛車の定跡ドリルは次の更新で追加します。今は本や動画で" },
  { key: "game", label: "対局を1局", min: 10, note: "将棋ウォーズの10分切れ負け" },
  { key: "review", label: "振り返り", min: 5, note: "駒をタダで取られた手、詰みを逃した手を1つ探す" },
];

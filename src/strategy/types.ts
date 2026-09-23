// 作戦提案機能のデータモデル
// 追加仕様書 11〜16 章に対応する。
// 座標系は既存作戦ボードに合わせる(x,y は 0〜100 の "down" 基準論理座標)。

import { STONES_PER_END, type Hammer, type MaxEnds, type ShotType, type Stone } from "../types";

// --- 作戦目的(仕様 6.1) ---
export type Objective =
  | "one_point" // 1点を確実に取る
  | "multiple_points" // 2点以上を狙う
  | "three_points" // 3点以上を狙う
  | "blank" // ブランクエンドを狙う
  | "steal" // スチールを狙う
  | "give_one" // 相手に1点を取らせる
  | "limit_opponent" // 相手に複数点を取らせない
  | "advantage_next" // 次のエンドを有利にする
  | "auto"; // おまかせ

export const OBJECTIVE_LABELS: Record<Objective, string> = {
  one_point: "1点を確実に取る",
  multiple_points: "2点以上を狙う",
  three_points: "3点以上を狙う",
  blank: "ブランクエンドを狙う",
  steal: "スチールを狙う",
  give_one: "相手に1点を取らせる",
  limit_opponent: "相手に複数点を取らせない",
  advantage_next: "次のエンドを有利にする",
  auto: "おまかせ",
};

// --- リスク許容度(仕様 7.1) ---
export type RiskLevel = "safe" | "normal" | "aggressive";

export const RISK_LABELS: Record<RiskLevel, string> = {
  safe: "安全重視",
  normal: "標準",
  aggressive: "攻撃重視",
};

// --- アイスコンディション(仕様 9、任意) ---
export type CurlLevel = "small" | "normal" | "large" | "unknown";
export type WeightLevel = "light" | "normal" | "heavy" | "unknown";

export const CURL_LABELS: Record<CurlLevel, string> = {
  small: "少ない",
  normal: "普通",
  large: "大きい",
  unknown: "不明",
};

export const WEIGHT_LABELS: Record<WeightLevel, string> = {
  light: "軽い",
  normal: "普通",
  heavy: "重い",
  unknown: "不明",
};

export interface IceCondition {
  curl: CurlLevel;
  weight: WeightLevel;
}

// --- 条件設定ポップアップの入力値(仕様 5,21) ---
export interface StrategyConditions {
  maxEnds: MaxEnds; // 試合形式(最大エンド数 6/8/10)
  end: number; // 現在のエンド(1〜maxEnds)
  score: { own: number; opponent: number };
  hammer: Hammer; // own = 後攻(ハンマー保持)
  shotNumber: number; // 自チームが次に投げる投数(1〜8)
  remainingStones: { own: number; opponent: number }; // shotNumber と hammer から算出
  objective: Objective;
  riskLevel: RiskLevel;
  ice: IceCondition;
  note?: string; // 任意コメント
}

// 何投目か(自チームの次の投数 N)と先攻/後攻から残り石数を算出する。
// 指定した N 投目はまだ投げていない扱いで残りに含める。
//   自チーム残り = 8 - N + 1
//   相手残り: 交互投球で、自Nを投げる直前までに相手が投げ終えた数から求める。
//     後攻(hammer=own): 相手が先攻なので自Nの前に相手はN投目まで完了 → 残り 8 - N
//       (例: 後攻・自8投目 → 相手残り 0)
//     先攻(hammer=opp): 自分が先攻なので自Nの前に相手はN-1投目まで完了 → 残り 9 - N
//       (例: 先攻・自8投目 → 相手残り 1)
export function computeRemainingStones(
  shotNumber: number,
  hammer: Hammer
): { own: number; opponent: number } {
  const n = Math.min(STONES_PER_END, Math.max(1, shotNumber));
  const own = STONES_PER_END - n + 1;
  const opponent =
    hammer === "own" ? STONES_PER_END - n : STONES_PER_END - (n - 1);
  return { own: Math.max(0, own), opponent: Math.max(0, opponent) };
}

// --- AIへ送信するリクエスト全体(仕様 11〜13) ---
export interface StrategyRequest {
  game: {
    end: number;
    score: { own: number; opponent: number };
    hammer: Hammer;
    remaining_stones: { own: number; opponent: number };
  };
  stones: Array<{ id: string; team: Team; x: number; y: number }>;
  strategy: {
    objective: Objective;
    risk_level: RiskLevel;
    ice_condition: IceCondition;
    note?: string;
  };
}

// StrategyRequest 内の team は既存 Stone の team をそのまま使う
type Team = Stone["team"];

// --- AIが返す作戦候補(仕様 16,18) ---
// category は目的別分類(安全/得点/攻撃 等)のラベル。
export interface StrategyProposal {
  id: string;
  title: string; // 作戦名 例:ガードをテイクアウト
  category: string; // 分類ラベル 例:安全重視 / 得点重視 / 攻撃重視
  shotType: ShotType; // 既存のショット種別に対応づける
  aim: string; // 狙い
  target?: { x: number; y: number }; // 狙う位置(論理座標)。ボード反映に使用。
  from?: { x: number; y: number }; // 投球開始位置(任意)
  weight: string; // 推奨ウェイト 例:Take Weight
  expectedResult: string; // 期待結果
  merit: string; // メリット
  risk: string; // リスク説明
  riskStars: number; // 1〜5 のリスク度(★表示用)
}

export interface StrategyResult {
  proposals: StrategyProposal[];
  // AIが十分に判断できなかった場合の補足メッセージ(仕様 20.4)
  advisory?: string;
}

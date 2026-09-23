// カーリング作戦ボード データモデル
// 座標系: x, y は 0〜100 の相対値(%)。
//   x: 0=左サイドライン, 100=右サイドライン
//   y: 0=シート上端(遠いハウス側/ハック), 100=シート下端(投球側)
// direction が "up" のときは表示上 180 度回転して描画するが、保存データの座標は常に "down" 基準の論理座標で持つ。

// 1チームがシート上に置ける石の最大数(カーリングのルール)
export const MAX_STONES_PER_TEAM = 8;

export type Team = "own" | "opp";
export type Direction = "down" | "up";
export type Hammer = "own" | "opp";

export type ShotType =
  | "draw"
  | "guard"
  | "takeout"
  | "hitroll"
  | "freeze"
  | "comearound"
  | "runback";

export const SHOT_LABELS: Record<ShotType, string> = {
  draw: "ドロー",
  guard: "ガード",
  takeout: "テイクアウト",
  hitroll: "ヒット&ロール",
  freeze: "フリーズ",
  comearound: "カムアラウンド",
  runback: "ランバック",
};

// ショット種別ごとの軌道の色。種別を視覚的に区別する。
export const SHOT_COLORS: Record<ShotType, string> = {
  draw: "#2f77c2", // ドロー: 青
  guard: "#2ba84a", // ガード: 緑
  takeout: "#e0392b", // テイクアウト: 赤
  hitroll: "#e67e22", // ヒット&ロール: オレンジ
  freeze: "#8e44ad", // フリーズ: 紫
  comearound: "#16a3a3", // カムアラウンド: シアン
  runback: "#c0392b", // ランバック: 濃い赤
};

// 短い記号ラベル(軌道上に添える)
export const SHOT_SHORT: Record<ShotType, string> = {
  draw: "DR",
  guard: "GD",
  takeout: "TO",
  hitroll: "H&R",
  freeze: "FRZ",
  comearound: "CA",
  runback: "RB",
};

export interface Point {
  x: number;
  y: number;
}

export interface Stone {
  id: string;
  team: Team;
  x: number;
  y: number;
}

export interface Shot {
  id: string;
  type: ShotType;
  points: Point[];
}

export interface Board {
  id: string;
  team: string;
  opponent: string;
  end: number;
  hammer: Hammer;
  direction: Direction;
  stones: Stone[];
  shots: Shot[];
  createdAt: string;
  updatedAt: string;
}

// Undo/Redo の対象となる「局面状態」。direction は表示設定なので含めない。
export interface BoardState {
  stones: Stone[];
  shots: Shot[];
  end: number;
  hammer: Hammer;
}

export function newId(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random()
    .toString(36)
    .slice(2, 8)}`;
}

export function createEmptyBoard(): Board {
  const now = new Date().toISOString();
  return {
    id: newId("board"),
    team: "Team A",
    opponent: "Team B",
    end: 1,
    hammer: "own",
    direction: "down",
    stones: [],
    shots: [],
    createdAt: now,
    updatedAt: now,
  };
}

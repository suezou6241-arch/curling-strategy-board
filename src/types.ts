// カーリング作戦ボード データモデル
// 座標系: x, y は 0〜100 の相対値(%)。
//   x: 0=左サイドライン, 100=右サイドライン
//   y: 0=シート上端(遠いハウス側/ハック), 100=シート下端(投球側)
// direction が "up" のときは表示上 180 度回転して描画するが、保存データの座標は常に "down" 基準の論理座標で持つ。

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
  comment: string;
  shotTitle: string;
  createdAt: string;
  updatedAt: string;
}

// Undo/Redo の対象となる「局面状態」。direction は表示設定なので含めない。
export interface BoardState {
  stones: Stone[];
  shots: Shot[];
  comment: string;
  shotTitle: string;
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
    comment: "",
    shotTitle: "",
    createdAt: now,
    updatedAt: now,
  };
}

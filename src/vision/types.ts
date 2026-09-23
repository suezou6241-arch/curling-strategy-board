// 写真からストーン配置を自動生成する機能のデータモデル。
// 仕様書「カーリング試合写真からストーン配置を自動生成する機能」に対応する。
//
// 座標系について:
//   - AI/仕様のレスポンスは「ティー(ハウス中心)を原点」とした相対座標系
//     (x: 右が+ / y: 遠端側が+、概ね -1.0 〜 +1.0)で返る(仕様 4.1, 4.3, 13)。
//   - 作戦ボードは 0〜100 の "down" 基準論理座標(x:0=左,100=右 / y:0=遠端,100=手前)。
//   これらを toBoardCoord() で変換する。

import { newId, type Team } from "../types";

// AIレスポンス内のチーム色。作戦ボードは own(赤)/opp(黄)の2値。
export type StoneColor = "red" | "yellow";

// 仕様 13 のAPIレスポンスに対応する検出ストーン(ティー原点の相対座標)。
export interface DetectedStoneRaw {
  id?: string;
  team?: string; // "red" | "yellow" 等
  x?: number; // ティー原点相対 x(右が+)
  y?: number; // ティー原点相対 y(遠端側が+)
  distance?: number; // ティーからの距離(任意)
  confidence?: number; // 0〜1
}

export interface DetectedHouseRaw {
  center_x?: number;
  center_y?: number;
  confidence?: number;
}

export interface VisionResponseRaw {
  success?: boolean;
  house?: DetectedHouseRaw;
  stones?: DetectedStoneRaw[];
  message?: string;
}

// 作戦ボード上に配置する、確認・修正可能な検出ストーン。
// 既存 Stone に加えて色/信頼度を保持する(修正UIと信頼度表示のため)。
export interface DetectedStone {
  id: string;
  team: Team; // own=赤 / opp=黄
  x: number; // ボード論理座標 0〜100
  y: number; // ボード論理座標 0〜100
  confidence: number; // 0〜1
}

export interface VisionResult {
  stones: DetectedStone[];
  houseConfidence: number; // 0〜1(ハウス検出の信頼度)
  advisory?: string; // 低信頼/フォールバック時などの補足メッセージ
}

// 信頼度がこの値未満なら「確認を促す」対象とする(仕様 8)。
export const LOW_CONFIDENCE_THRESHOLD = 0.75;

// 色文字列 -> チーム(own=赤 / opp=黄)。不明時は red 扱い。
export function colorToTeam(color: string | undefined): Team {
  const c = (color ?? "").toLowerCase();
  if (c.includes("yellow") || c.includes("黄")) return "opp";
  return "own";
}

export function teamToColor(team: Team): StoneColor {
  return team === "own" ? "red" : "yellow";
}

// ティー原点の相対座標(-1〜+1 目安)を作戦ボードの 0〜100 論理座標へ変換する。
// ハウス中心はボード上で (SHEET.houseCenterX, SHEET.houseCenterY) = (50, 40)。
// スケール: 仕様のハウス半径 1.83m ≒ 12フィートリング(ボード半径 34)に対応させる。
//   x_board = 50 + x * SCALE
//   y_board = 40 - y * SCALE   (相対yは遠端が+、ボードyは遠端が0なので符号反転)
const HOUSE_CENTER_X = 50;
const HOUSE_CENTER_Y = 40;
// 相対座標 1.0(ハウス半径付近)= ボード上 34(12フィートリング半径)相当。
const SCALE = 34;

export function toBoardCoord(x: number, y: number): { x: number; y: number } {
  const bx = HOUSE_CENTER_X + x * SCALE;
  const by = HOUSE_CENTER_Y - y * SCALE;
  return {
    x: Math.max(0, Math.min(100, bx)),
    y: Math.max(0, Math.min(100, by)),
  };
}

// 作戦ボード座標 -> ティー原点相対座標(修正結果を再表示/保存する場合の逆変換)。
export function fromBoardCoord(bx: number, by: number): { x: number; y: number } {
  return {
    x: (bx - HOUSE_CENTER_X) / SCALE,
    y: (HOUSE_CENTER_Y - by) / SCALE,
  };
}

export function makeDetectedId(): string {
  return newId("det");
}

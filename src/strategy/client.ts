// 作戦提案の中核。条件+盤面からAIリクエストを組み立て、
// OpenAI互換APIを呼んで作戦候補を取得する。APIキー未設定/通信失敗時は
// オフラインの簡易ロジック(heuristic)にフォールバックする。

import { SHOT_LABELS, newId, type ShotType, type Stone } from "../types";
import { loadAiSettings, hasApiKey } from "./settings";
import { heuristicProposals } from "./heuristic";
import {
  OBJECTIVE_LABELS,
  RISK_LABELS,
  CURL_LABELS,
  WEIGHT_LABELS,
  type StrategyConditions,
  type StrategyProposal,
  type StrategyRequest,
  type StrategyResult,
} from "./types";

// 仕様 20 のエラー種別。呼び出し側でメッセージ分岐に使う。
export type StrategyErrorKind =
  | "no_stones" // 20.1 ストーン未配置
  | "missing_conditions" // 20.2 条件不足
  | "network"; // 20.3 通信エラー

export class StrategyError extends Error {
  kind: StrategyErrorKind;
  constructor(kind: StrategyErrorKind, message: string) {
    super(message);
    this.kind = kind;
    this.name = "StrategyError";
  }
}

// 条件の必須項目チェック(仕様 21)
export function validateConditions(
  stones: Stone[],
  cond: StrategyConditions
): void {
  if (stones.length === 0) {
    throw new StrategyError("no_stones", "現在のストーン配置を確認してください。");
  }
  const validEnd = Number.isFinite(cond.end) && cond.end >= 1;
  const validScore =
    Number.isFinite(cond.score.own) && Number.isFinite(cond.score.opponent);
  if (!validEnd || !validScore) {
    throw new StrategyError(
      "missing_conditions",
      "作戦提案に必要な条件が不足しています。\nエンド、スコア、先攻／後攻を確認してください。"
    );
  }
}

// 盤面+条件 -> AIへ送るリクエスト(仕様 11〜13)
export function buildRequest(
  stones: Stone[],
  cond: StrategyConditions
): StrategyRequest {
  return {
    game: {
      end: cond.end,
      score: { own: cond.score.own, opponent: cond.score.opponent },
      hammer: cond.hammer,
      remaining_stones: {
        own: cond.remainingStones.own,
        opponent: cond.remainingStones.opponent,
      },
    },
    stones: stones.map((s) => ({
      id: s.id,
      team: s.team,
      x: Math.round(s.x * 100) / 100,
      y: Math.round(s.y * 100) / 100,
    })),
    strategy: {
      objective: cond.objective,
      risk_level: cond.riskLevel,
      ice_condition: cond.ice,
      note: cond.note?.trim() || undefined,
    },
  };
}

// ShotType へのゆるいマッピング(AIが日本語/英語どちらで返しても拾う)
const SHOT_ALIASES: Record<string, ShotType> = {
  draw: "draw",
  ドロー: "draw",
  guard: "guard",
  ガード: "guard",
  takeout: "takeout",
  "take-out": "takeout",
  take: "takeout",
  テイク: "takeout",
  テイクアウト: "takeout",
  hitroll: "hitroll",
  "hit-and-roll": "hitroll",
  "hit&roll": "hitroll",
  ヒットロール: "hitroll",
  freeze: "freeze",
  フリーズ: "freeze",
  comearound: "comearound",
  "come-around": "comearound",
  カムアラウンド: "comearound",
  runback: "runback",
  ランバック: "runback",
};

function toShotType(v: unknown): ShotType {
  if (typeof v !== "string") return "draw";
  const key = v.toLowerCase().replace(/\s+/g, "");
  return SHOT_ALIASES[v] ?? SHOT_ALIASES[key] ?? "draw";
}

function num(v: unknown, fallback: number): number {
  const n = typeof v === "string" ? Number(v) : v;
  return typeof n === "number" && Number.isFinite(n) ? n : fallback;
}

function str(v: unknown, fallback = ""): string {
  return typeof v === "string" && v.trim() ? v.trim() : fallback;
}

// AIレスポンス(JSON)を StrategyProposal[] へ正規化
function parseProposals(data: unknown): StrategyProposal[] {
  const arr =
    data && typeof data === "object" && Array.isArray((data as any).proposals)
      ? (data as any).proposals
      : Array.isArray(data)
        ? data
        : [];
  return arr.slice(0, 3).map((raw: any): StrategyProposal => {
    const shotType = toShotType(raw?.shotType ?? raw?.shot_type ?? raw?.type);
    const hasTarget =
      raw?.target && typeof raw.target === "object";
    const hasFrom = raw?.from && typeof raw.from === "object";
    return {
      id: newId("prop"),
      title: str(raw?.title, SHOT_LABELS[shotType]),
      category: str(raw?.category, "提案"),
      shotType,
      aim: str(raw?.aim ?? raw?.description),
      target: hasTarget
        ? { x: num(raw.target.x, 50), y: num(raw.target.y, 40) }
        : undefined,
      from: hasFrom
        ? { x: num(raw.from.x, 50), y: num(raw.from.y, 98) }
        : undefined,
      weight: str(raw?.weight, "Draw Weight"),
      expectedResult: str(raw?.expectedResult ?? raw?.expected_result),
      merit: str(raw?.merit),
      risk: str(raw?.risk),
      riskStars: Math.min(5, Math.max(1, Math.round(num(raw?.riskStars ?? raw?.risk_stars, 3)))),
    };
  });
}

// AIへ渡すプロンプト(仕様 14)
function buildMessages(req: StrategyRequest) {
  const system = [
    "あなたは経験豊富なカーリングのコーチ兼アナリストです。",
    "現在のストーン配置・ゲーム状況・作戦目的を踏まえ、次に投げるショット候補をちょうど3案提示してください。",
    "「唯一の正解」を断定せず、目的別(安全重視/得点重視/攻撃重視 など)にメリットとリスクを比較できる形にしてください。",
    "座標系: x,y は 0〜100 の相対値。x=0 左サイド, x=100 右サイド, y=0 遠端(遠いハウス側), y=100 手前(投球側)。ハウス中心は約 (50,40)。",
    "出力は必ず次のJSON形式のみ。前後に説明文やコードフェンスを付けないこと:",
    `{"proposals":[{"title":"作戦名","category":"安全重視|得点重視|攻撃重視","shotType":"draw|guard|takeout|hitroll|freeze|comearound|runback","aim":"狙い","target":{"x":50,"y":40},"from":{"x":50,"y":98},"weight":"推奨ウェイト","expectedResult":"期待結果","merit":"メリット","risk":"リスク","riskStars":3}]}`,
  ].join("\n");

  const user = [
    "## ゲーム情報",
    `エンド: ${req.game.end}`,
    `スコア: 自 ${req.game.score.own} - 相手 ${req.game.score.opponent}`,
    `ハンマー: ${req.game.hammer === "own" ? "自チーム(後攻)" : "相手(自チームは先攻)"}`,
    `残りストーン: 自 ${req.game.remaining_stones.own} / 相手 ${req.game.remaining_stones.opponent}`,
    "",
    "## 作戦条件",
    `目的: ${OBJECTIVE_LABELS[req.strategy.objective]}`,
    `リスク許容度: ${RISK_LABELS[req.strategy.risk_level]}`,
    `アイス曲がり: ${CURL_LABELS[req.strategy.ice_condition.curl]}`,
    `アイスウェイト: ${WEIGHT_LABELS[req.strategy.ice_condition.weight]}`,
    req.strategy.note ? `補足: ${req.strategy.note}` : "",
    "",
    "## ストーン配置 (team: own=自チーム, opp=相手)",
    JSON.stringify(req.stones),
  ]
    .filter(Boolean)
    .join("\n");

  return [
    { role: "system", content: system },
    { role: "user", content: user },
  ];
}

function extractJson(content: string): unknown {
  // コードフェンスや前後テキストが混ざっても最初の JSON オブジェクトを取り出す
  const fenced = content.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const body = fenced ? fenced[1] : content;
  const start = body.indexOf("{");
  const end = body.lastIndexOf("}");
  const slice = start >= 0 && end > start ? body.slice(start, end + 1) : body;
  return JSON.parse(slice);
}

// 実際にAIを呼ぶ。失敗時は StrategyError('network') を投げる。
async function requestAi(req: StrategyRequest): Promise<StrategyProposal[]> {
  const { baseUrl, apiKey, model } = loadAiSettings();
  const url = `${baseUrl.replace(/\/$/, "")}/chat/completions`;

  let res: Response;
  try {
    res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: buildMessages(req),
        temperature: 0.7,
        response_format: { type: "json_object" },
      }),
    });
  } catch {
    throw new StrategyError(
      "network",
      "作戦提案を取得できませんでした。\n通信状態を確認して、もう一度お試しください。"
    );
  }

  if (!res.ok) {
    throw new StrategyError(
      "network",
      "作戦提案を取得できませんでした。\n通信状態を確認して、もう一度お試しください。"
    );
  }

  let content: string;
  try {
    const json = await res.json();
    content = json?.choices?.[0]?.message?.content ?? "";
    const parsed = parseProposals(extractJson(content));
    if (parsed.length === 0) throw new Error("empty");
    return parsed;
  } catch {
    throw new StrategyError(
      "network",
      "作戦提案を取得できませんでした。\n通信状態を確認して、もう一度お試しください。"
    );
  }
}

// 呼び出しエントリ。バリデーション -> AI or フォールバック。
export async function requestStrategy(
  stones: Stone[],
  cond: StrategyConditions
): Promise<StrategyResult> {
  validateConditions(stones, cond);

  // APIキーが無ければオフラインの簡易ロジック
  if (!hasApiKey()) {
    return heuristicProposals(stones, cond);
  }

  const req = buildRequest(stones, cond);
  try {
    const proposals = await requestAi(req);
    return { proposals };
  } catch (e) {
    // 通信/解析失敗時はフォールバックで最低限の提案を返す。
    if (e instanceof StrategyError && e.kind === "network") {
      const fb = heuristicProposals(stones, cond);
      return {
        ...fb,
        advisory:
          "AIに接続できなかったため、簡易ロジックによる目安の提案を表示しています。",
      };
    }
    throw e;
  }
}

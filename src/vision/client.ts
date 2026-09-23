// 写真解析の中核。撮影/選択した画像をマルチモーダルAI(OpenAI互換 Vision)へ送り、
// ハウス・ストーンを検出して作戦ボード座標へ変換する(仕様 2〜4, 13)。
// APIキー未設定/通信失敗時は解析できないため、明示的なエラーを返す。
// (作戦提案と異なり、写真解析はオフラインの簡易ロジックでは代替できないため)

import { loadAiSettings, hasApiKey } from "../strategy/settings";
import { MAX_STONES_PER_TEAM } from "../types";
import {
  colorToTeam,
  makeDetectedId,
  toBoardCoord,
  type DetectedStone,
  type VisionResponseRaw,
  type VisionResult,
} from "./types";

// 仕様 12 のエラー種別。
export type VisionErrorKind =
  | "no_api" // APIキー未設定(解析不可)
  | "no_house" // ハウスを検出できない
  | "no_stones" // ストーンを検出できない
  | "bad_image" // 解析に適さない画像
  | "network"; // 通信/解析失敗

export class VisionError extends Error {
  kind: VisionErrorKind;
  constructor(kind: VisionErrorKind, message: string) {
    super(message);
    this.kind = kind;
    this.name = "VisionError";
  }
}

// File -> data URL(base64)。AIへ画像として渡す。
export function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

// 大きすぎる画像はAPI負荷/レスポンス低下を招くため、長辺を縮小して JPEG 化する。
export async function downscaleImage(
  file: File,
  maxEdge = 1280,
  quality = 0.82
): Promise<string> {
  try {
    const dataUrl = await fileToDataUrl(file);
    const img = await loadImage(dataUrl);
    const scale = Math.min(1, maxEdge / Math.max(img.width, img.height));
    if (scale >= 1) return dataUrl; // 縮小不要
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(img.width * scale);
    canvas.height = Math.round(img.height * scale);
    const ctx = canvas.getContext("2d");
    if (!ctx) return dataUrl;
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL("image/jpeg", quality);
  } catch {
    // 縮小に失敗しても元画像で続行できるようにする
    return fileToDataUrl(file);
  }
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("image load failed"));
    img.src = src;
  });
}

function num(v: unknown, fallback: number): number {
  const n = typeof v === "string" ? Number(v) : v;
  return typeof n === "number" && Number.isFinite(n) ? n : fallback;
}

// 信頼度は 0〜1 に正規化(96 のように % で返ってくる場合も吸収)。
function normalizeConfidence(v: unknown): number {
  const n = num(v, 0.8);
  if (n > 1) return Math.min(1, n / 100);
  return Math.max(0, Math.min(1, n));
}

// AIプロンプト(仕様 13 のレスポンス形式を要求)。
function buildMessages(imageDataUrl: string) {
  const system = [
    "あなたはカーリングの試合写真を解析する画像認識エンジンです。",
    "入力画像はハウス(円形の的)周辺を撮影したものです。ハウスと、その上/周囲にあるカーリングストーンを検出してください。",
    "各ストーンについて、ティー(ハウス中心)を原点とする相対座標を返します。",
    "座標系: x は右方向が正、y は遠端(奥)方向が正。ハウスの一番外側の円(12フィート)の半径を約1.0とする正規化座標(概ね -1.5〜+1.5)。",
    "チーム色は赤(red)か黄(yellow)のいずれかに分類してください。",
    "選手・ブラシ・氷の反射などはストーンとして数えないでください。重なった石も可能な範囲で個別に数えます。",
    "各検出には 0〜1 の confidence を付けてください。",
    "出力は必ず次のJSONのみ。前後に説明やコードフェンスを付けないこと:",
    `{"success":true,"house":{"center_x":0,"center_y":0,"confidence":0.95},"stones":[{"id":"S001","team":"yellow","x":-0.35,"y":0.72,"distance":0.8,"confidence":0.94}]}`,
    "ハウスを認識できない場合は {\"success\":false,\"message\":\"no_house\"} を返してください。",
  ].join("\n");

  return [
    { role: "system", content: system },
    {
      role: "user",
      content: [
        {
          type: "text",
          text: "この写真からハウスとストーンを検出し、指定JSON形式で返してください。",
        },
        { type: "image_url", image_url: { url: imageDataUrl } },
      ],
    },
  ];
}

function extractJson(content: string): unknown {
  const fenced = content.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const body = fenced ? fenced[1] : content;
  const start = body.indexOf("{");
  const end = body.lastIndexOf("}");
  const slice = start >= 0 && end > start ? body.slice(start, end + 1) : body;
  return JSON.parse(slice);
}

// AIレスポンス(生JSON)-> 作戦ボード用の検出結果へ正規化。
export function parseVisionResponse(data: unknown): VisionResult {
  const raw = (data ?? {}) as VisionResponseRaw;

  if (raw.success === false) {
    const msg = (raw.message ?? "").toLowerCase();
    if (msg.includes("house")) {
      throw new VisionError(
        "no_house",
        "ハウスを認識できませんでした。\nハウス全体が写るように撮影してください。"
      );
    }
    throw new VisionError(
      "no_stones",
      "ストーンを正しく認識できませんでした。\n写真を確認するか、作戦ボードから手動で配置してください。"
    );
  }

  const rawStones = Array.isArray(raw.stones) ? raw.stones : [];
  if (rawStones.length === 0) {
    throw new VisionError(
      "no_stones",
      "ストーンを正しく認識できませんでした。\n写真を確認するか、作戦ボードから手動で配置してください。"
    );
  }

  // チームごとに最大8個までへ丸める(ルール上の上限)。信頼度が高い順に採用。
  const mapped: DetectedStone[] = rawStones
    .map((s) => {
      const team = colorToTeam(s.team);
      const bx = toBoardCoord(num(s.x, 0), num(s.y, 0));
      return {
        id: makeDetectedId(),
        team,
        x: bx.x,
        y: bx.y,
        confidence: normalizeConfidence(s.confidence),
      };
    })
    .sort((a, b) => b.confidence - a.confidence);

  const limited: DetectedStone[] = [];
  const counts: Record<string, number> = { own: 0, opp: 0 };
  for (const st of mapped) {
    if (counts[st.team] >= MAX_STONES_PER_TEAM) continue;
    counts[st.team] += 1;
    limited.push(st);
  }

  const houseConfidence = normalizeConfidence(raw.house?.confidence);

  return {
    stones: limited,
    houseConfidence,
  };
}

// 画像(data URL)を送って解析する。
export async function analyzePhoto(imageDataUrl: string): Promise<VisionResult> {
  if (!hasApiKey()) {
    throw new VisionError(
      "no_api",
      "写真解析にはAI接続設定が必要です。\n設定からAPIキーを登録してください。"
    );
  }

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
        messages: buildMessages(imageDataUrl),
        temperature: 0.2,
        response_format: { type: "json_object" },
      }),
    });
  } catch {
    throw new VisionError(
      "network",
      "写真を解析できませんでした。\n通信状態を確認して、もう一度お試しください。"
    );
  }

  if (!res.ok) {
    throw new VisionError(
      "network",
      "写真を解析できませんでした。\n通信状態を確認して、もう一度お試しください。"
    );
  }

  let content: string;
  try {
    const json = await res.json();
    content = json?.choices?.[0]?.message?.content ?? "";
  } catch {
    throw new VisionError(
      "network",
      "写真を解析できませんでした。\n通信状態を確認して、もう一度お試しください。"
    );
  }

  let parsed: VisionResult;
  try {
    parsed = parseVisionResponse(extractJson(content));
  } catch (e) {
    if (e instanceof VisionError) throw e;
    throw new VisionError(
      "bad_image",
      "写真を解析できませんでした。\n別の写真で試すか、手動で配置してください。"
    );
  }

  // 低信頼のストーンがある/ハウス信頼度が低い場合は確認を促す(仕様 8)。
  const lowCount = parsed.stones.filter((s) => s.confidence < 0.75).length;
  if (lowCount > 0) {
    parsed.advisory =
      "一部のストーンの認識に自信がありません。配置を確認してください。";
  }

  return parsed;
}

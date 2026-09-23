// オフライン/フォールバック用の簡易作戦提案ロジック。
// AIキー未設定時や通信失敗時に、盤面と条件から目的別の候補を生成する。
// これは "もう一人の相談相手" 用途の目安であり、正解を断定するものではない(仕様 26)。

import { newId, type Stone } from "../types";
import { SHEET } from "../geometry";
import {
  type StrategyConditions,
  type StrategyProposal,
  type StrategyResult,
} from "./types";

// ハウス中心(論理座標)
const CENTER = { x: SHEET.houseCenterX, y: SHEET.houseCenterY };

function dist(a: { x: number; y: number }, b: { x: number; y: number }): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

// ハウス内(12ftリング内)のストーンを近い順に返す
function stonesInHouse(stones: Stone[], team?: Stone["team"]): Stone[] {
  return stones
    .filter((s) => (team ? s.team === team : true))
    .filter((s) => dist(s, CENTER) <= SHEET.houseRadii.twelveFoot)
    .sort((a, b) => dist(a, CENTER) - dist(b, CENTER));
}

// フリーガードゾーン付近(ティーラインより手前=yが大きい側)の相手ガードを推定
function opponentGuards(stones: Stone[]): Stone[] {
  return stones
    .filter((s) => s.team === "opp")
    .filter((s) => s.y > SHEET.teeLineTop && dist(s, CENTER) > SHEET.houseRadii.fourFoot)
    .sort((a, b) => a.y - b.y);
}

// ハンドル無しの投球開始位置(手前中央)
const FROM = { x: SHEET.houseCenterX, y: 98 };

export function heuristicProposals(
  stones: Stone[],
  cond: StrategyConditions
): StrategyResult {
  const proposals: StrategyProposal[] = [];

  const oppInHouse = stonesInHouse(stones, "opp");
  const ownInHouse = stonesInHouse(stones, "own");
  const guards = opponentGuards(stones);
  const aggressive = cond.riskLevel === "aggressive";
  const safe = cond.riskLevel === "safe";

  // 候補A: 安全重視 — 相手ストーンがハウスにあればテイク、無ければセンターガード
  if (oppInHouse.length > 0) {
    const t = oppInHouse[0];
    proposals.push({
      id: newId("prop"),
      title: "ハウス内の相手ストーンをテイクアウト",
      category: "安全重視",
      shotType: "takeout",
      aim: `ハウス中心付近の相手ストーンを直接テイクし、相手の得点機会を減らす。`,
      target: { x: t.x, y: t.y },
      from: FROM,
      weight: "Take Weight",
      expectedResult: "相手のハウス内ストーンを除去し、失点リスクを下げる。",
      merit: "相手の得点源を直接減らせる。成功率が比較的高い。",
      risk: "テイクミス時はロールの位置次第で相手に有利なストーンを残す可能性がある。",
      riskStars: 2,
    });
  } else {
    proposals.push({
      id: newId("prop"),
      title: "センターガードを置く",
      category: "安全重視",
      shotType: "guard",
      aim: "センターライン上、ハウス手前にガードを置き、次のドローを守る。",
      target: { x: CENTER.x, y: (SHEET.teeLineTop + SHEET.hogLineTop) / 2 },
      from: FROM,
      weight: "Guard Weight",
      expectedResult: "後続のドローをガードで守れる布石になる。",
      merit: "リスクが小さく、主導権を握りやすい。",
      risk: "相手にテイクされると布石を失う。決定力は低い。",
      riskStars: 1,
    });
  }

  // 候補B: 得点重視 — ボタン(4ft)へのドロー
  proposals.push({
    id: newId("prop"),
    title: "ハウス中心へドロー",
    category: "得点重視",
    shotType: guards.length > 0 ? "comearound" : "draw",
    aim:
      guards.length > 0
        ? "手前のガードの裏へカムアラウンドで回し、中心付近に着ける。"
        : "4フットからボタンへドローし、得点ストーンを確保する。",
    target: { x: CENTER.x, y: CENTER.y },
    from: FROM,
    weight: "Draw Weight",
    expectedResult:
      cond.objective === "multiple_points" || cond.objective === "three_points"
        ? "中心を押さえ、複数得点の起点にする。"
        : "確実に1点分のショットを確保する。",
    merit: "得点に直結する。ハンマー保持時は複数得点も狙える。",
    risk: "ウェイトが合わないとハウスを通過、または手前で止まる恐れがある。",
    riskStars: guards.length > 0 ? 3 : 2,
  });

  // 候補C: 攻撃重視 — フリーズ or ダブルテイク
  if (oppInHouse.length >= 2) {
    const t = oppInHouse[0];
    proposals.push({
      id: newId("prop"),
      title: "ダブルテイクアウトを狙う",
      category: "攻撃重視",
      shotType: "takeout",
      aim: "並んだ相手2ストーンをまとめてテイクし、局面を一気に有利にする。",
      target: { x: t.x, y: t.y },
      from: FROM,
      weight: "Peel Weight",
      expectedResult: "成功すれば相手ストーンを複数除去し主導権を握る。",
      merit: "一手で相手の得点機会を大きく削れる。",
      risk: "難度が高く、外すと自分のストーンも動かし不利になりうる。",
      riskStars: 5,
    });
  } else if (oppInHouse.length === 1) {
    const t = oppInHouse[0];
    proposals.push({
      id: newId("prop"),
      title: "相手ストーンにフリーズ",
      category: "攻撃重視",
      shotType: "freeze",
      aim: "相手ストーンの手前にぴたりと着け、テイクしにくい状況を作る。",
      target: { x: t.x, y: Math.min(100, t.y + SHEET.stoneRadius * 2) },
      from: FROM,
      weight: "Draw Weight",
      expectedResult: "相手のテイクを封じ、次投で優位に立つ。",
      merit: "うまく決まると相手の選択肢を大きく制限できる。",
      risk: "ウェイト超過でフリーズが甘くなると逆にテイクされやすくなる。",
      riskStars: 4,
    });
  } else {
    proposals.push({
      id: newId("prop"),
      title: "コーナーガードで攻める布石",
      category: "攻撃重視",
      shotType: "guard",
      aim: "センターを外したコーナーにガードを置き、複数得点の布石にする。",
      target: {
        x: CENTER.x + 10,
        y: (SHEET.teeLineTop + SHEET.hogLineTop) / 2,
      },
      from: FROM,
      weight: "Guard Weight",
      expectedResult: "オープンな展開を作り、複数得点を狙う起点にする。",
      merit: "得点期待値を高められる。ハンマー保持時に有効。",
      risk: "相手にオープンヒットの機会を与える可能性がある。",
      riskStars: 3,
    });
  }

  // リスク許容度で並べ替え(安全重視ならリスク低い順、攻撃重視なら逆)
  proposals.sort((a, b) =>
    aggressive ? b.riskStars - a.riskStars : a.riskStars - b.riskStars
  );

  const advisory =
    stones.length === 0
      ? undefined
      : cond.ice.curl === "unknown" && cond.ice.weight === "unknown"
        ? "アイスコンディション(曲がり・ウェイト)を入力すると、より具体的な狙いを提案できます。"
        : undefined;

  // 未使用変数の警告回避のため参照(将来の重み付けで使用予定)
  void ownInHouse;
  void safe;

  return { proposals: proposals.slice(0, 3), advisory };
}

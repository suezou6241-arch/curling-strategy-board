// カーリングシートのジオメトリ定義(相対座標 0〜100)
// y は上端(遠端)=0、下端(投球側/ハック)=100 とする。
// 実寸比に厳密ではなく、スマホ縦画面で見やすい比率に調整している。

export const SHEET = {
  // サイドラインの内側(プレー領域)の左右位置
  left: 8,
  right: 92,
  // 縦方向のライン位置(y)
  // ハウスをさらに拡大したため、ハウス中心を下げ、各ラインを再配置している。
  hackTop: 2, // 遠端側ハック(相手側)
  backLineTop: 4,
  teeLineTop: 40, // 遠端ティーライン(ハウス中心)
  hogLineTop: 80, // 遠端ホグライン(ハウス外周 y=77.5 の少し下)
  hogLineBottom: 90, // 投球側ホグライン
  teeLineBottom: 40, // (未使用)
  hackBottom: 98, // 投球側ハック
  // ハウス(遠端側)中心とリングサイズ
  houseCenterX: 50,
  houseCenterY: 40,
  houseRadii: {
    twelveFoot: 37.5, // 一番外側の青(前回30からさらに+25%)
    eightFoot: 25,
    fourFoot: 13.75,
    button: 5,
  },
  // ストーン半径(相対)
  stoneRadius: 3.4,
} as const;

// SVG の viewBox サイズ
export const VIEW = {
  w: 100,
  h: 100,
} as const;

// direction に応じて論理座標(down基準)を表示座標へ変換する。
// up のときは 180 度回転 => (x,y) -> (100-x, 100-y)
export function toDisplay(
  x: number,
  y: number,
  direction: "down" | "up"
): { x: number; y: number } {
  if (direction === "up") {
    return { x: 100 - x, y: 100 - y };
  }
  return { x, y };
}

// 表示座標(SVGクリック位置)を論理座標へ戻す。逆変換も同じ式。
export function toLogical(
  x: number,
  y: number,
  direction: "down" | "up"
): { x: number; y: number } {
  if (direction === "up") {
    return { x: 100 - x, y: 100 - y };
  }
  return { x, y };
}

export function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

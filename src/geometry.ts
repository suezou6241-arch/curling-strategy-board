// カーリングシートのジオメトリ定義(相対座標 0〜100)
// y は上端(遠端)=0、下端(投球側/ハック)=100 とする。
// 実寸比に厳密ではなく、スマホ縦画面で見やすい比率に調整している。

export const SHEET = {
  // サイドラインの内側(プレー領域)の左右位置
  left: 8,
  right: 92,
  // 縦方向のライン位置(y)
  // ハウスをやや小さくし中心を上げ、ティーライン〜ホグラインのフリーガードゾーンを広く取る。
  hackTop: 2, // 遠端側ハック(相手側)
  backLineTop: 5, // ハウス外周上端(y=5)と接する
  teeLineTop: 32, // 遠端ティーライン(ハウス中心)
  hogLineTop: 75, // 遠端ホグライン(FGZ = ティーライン〜ホグライン)
  hogLineBottom: 90, // 投球側ホグライン
  teeLineBottom: 32, // (未使用)
  hackBottom: 98, // 投球側ハック
  // ハウス(遠端側)中心とリングサイズ
  houseCenterX: 50,
  houseCenterY: 32,
  houseRadii: {
    twelveFoot: 27, // 一番外側の青(37.5→27に縮小、FGZを広げるため)
    eightFoot: 18,
    fourFoot: 10,
    button: 3.6,
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

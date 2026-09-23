import { SHEET } from "./geometry";

// カーリングシートの静的な背景要素(ライン・ハウス・FGZ)を描画する。
// フリーガードゾーンより手前(投球側)は表示せず、ハウス〜ホグラインまでを描く。
// 論理座標(down基準)で描き、回転は親の <g transform> で行う。
export function SheetBackground() {
  const {
    left,
    right,
    backLineTop,
    teeLineTop,
    hogLineTop,
    houseCenterX,
    houseCenterY,
    houseRadii,
  } = SHEET;

  return (
    <g>
      {/* 氷面 */}
      <rect x={left} y={0} width={right - left} height={100} fill="#eef4f8" />

      {/* フリーガードゾーン(ティーライン〜ホグラインの帯)を薄く塗って明示。
          ハウスの円はこの上に重ねて描かれる。 */}
      <rect
        x={left}
        y={teeLineTop}
        width={right - left}
        height={hogLineTop - teeLineTop}
        fill="#ffe9a8"
        opacity={0.4}
      />

      {/* ハウス 外周から内周へ */}
      <circle
        cx={houseCenterX}
        cy={houseCenterY}
        r={houseRadii.twelveFoot}
        fill="#2f77c2"
      />
      <circle
        cx={houseCenterX}
        cy={houseCenterY}
        r={houseRadii.eightFoot}
        fill="#f4f7fa"
      />
      <circle
        cx={houseCenterX}
        cy={houseCenterY}
        r={houseRadii.fourFoot}
        fill="#d0402f"
      />
      <circle
        cx={houseCenterX}
        cy={houseCenterY}
        r={houseRadii.button}
        fill="#f4f7fa"
      />

      {/* センターライン(バックライン〜ホグライン) */}
      <line
        x1={50}
        y1={backLineTop}
        x2={50}
        y2={hogLineTop}
        stroke="#8aa0b0"
        strokeWidth={0.3}
      />
      {/* ティーライン */}
      <line
        x1={left}
        y1={teeLineTop}
        x2={right}
        y2={teeLineTop}
        stroke="#8aa0b0"
        strokeWidth={0.3}
      />
      {/* バックライン */}
      <line
        x1={left}
        y1={backLineTop}
        x2={right}
        y2={backLineTop}
        stroke="#8aa0b0"
        strokeWidth={0.3}
      />
      {/* ホグライン */}
      <line
        x1={left}
        y1={hogLineTop}
        x2={right}
        y2={hogLineTop}
        stroke="#c0392b"
        strokeWidth={0.8}
      />

      {/* サイドライン */}
      <line x1={left} y1={0} x2={left} y2={100} stroke="#8aa0b0" strokeWidth={0.4} />
      <line x1={right} y1={0} x2={right} y2={100} stroke="#8aa0b0" strokeWidth={0.4} />

      {/* フリーガードゾーンのラベル(ハウス外周〜ホグラインの間) */}
      <text
        x={50}
        y={(houseCenterY + houseRadii.twelveFoot + hogLineTop) / 2 + 1}
        textAnchor="middle"
        fontSize={3}
        fontWeight={600}
        fill="#c99a2e"
      >
        フリーガードゾーン
      </text>
    </g>
  );
}

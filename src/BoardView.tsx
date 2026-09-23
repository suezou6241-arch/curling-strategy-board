import { useRef, useState } from "react";
import { SheetBackground } from "./Sheet";
import { SHEET, clamp, toLogical } from "./geometry";
import type { Direction, Point, Shot, ShotType, Stone, Team } from "./types";
import {
  MAX_STONES_PER_TEAM,
  newId,
  SHOT_COLORS,
  SHOT_SHORT,
} from "./types";

export type Tool = "stone" | "shot" | "select";

interface Props {
  stones: Stone[];
  shots: Shot[];
  direction: Direction;
  tool: Tool;
  activeTeam: Team;
  currentShotType: ShotType;
  selectedStoneId: string | null;
  // 履歴に積む確定コミット
  commitStones: (updater: (prev: Stone[]) => Stone[]) => void;
  commitShots: (updater: (prev: Shot[]) => Shot[]) => void;
  // ドラッグ中のプレビュー(履歴に積まない)
  previewStones: (updater: (prev: Stone[]) => Stone[]) => void;
  onSelectStone: (id: string | null) => void;
  onLimitReached: (team: Team) => void;
  // ハウス右上のカメラアイコン押下(写真から配置)。
  onCamera?: () => void;
}

// クライアント座標を SVG の論理座標(0-100, down基準)へ変換
function clientToLogical(
  svg: SVGSVGElement,
  clientX: number,
  clientY: number,
  direction: Direction
): Point {
  const rect = svg.getBoundingClientRect();
  const dispX = ((clientX - rect.left) / rect.width) * 100;
  const dispY = ((clientY - rect.top) / rect.height) * 100;
  const lg = toLogical(dispX, dispY, direction);
  return { x: clamp(lg.x, 0, 100), y: clamp(lg.y, 0, 100) };
}

export function BoardView({
  stones,
  shots,
  direction,
  tool,
  activeTeam,
  currentShotType,
  selectedStoneId,
  commitStones,
  commitShots,
  previewStones,
  onSelectStone,
  onLimitReached,
  onCamera,
}: Props) {
  const svgRef = useRef<SVGSVGElement | null>(null);
  // ドラッグ中のストーン
  const dragStone = useRef<{ id: string; moved: boolean } | null>(null);
  // 軌道描画中の点列
  const [drawingShot, setDrawingShot] = useState<Point[] | null>(null);
  const drawingRef = useRef<Point[] | null>(null);

  const rotate = direction === "up";

  // --- ストーン: ポインタ操作 ---
  function onStonePointerDown(e: React.PointerEvent, stone: Stone) {
    if (tool === "shot") return; // 軌道モード中はストーン操作しない
    e.stopPropagation();
    (e.target as Element).setPointerCapture?.(e.pointerId);
    onSelectStone(stone.id);
    dragStone.current = { id: stone.id, moved: false };
  }

  function onStonePointerMove(e: React.PointerEvent) {
    if (!dragStone.current || !svgRef.current) return;
    const p = clientToLogical(svgRef.current, e.clientX, e.clientY, direction);
    dragStone.current.moved = true;
    const id = dragStone.current.id;
    previewStones((prev) =>
      prev.map((s) => (s.id === id ? { ...s, x: p.x, y: p.y } : s))
    );
  }

  function onStonePointerUp(e: React.PointerEvent) {
    if (!dragStone.current || !svgRef.current) return;
    const { id, moved } = dragStone.current;
    dragStone.current = null;
    if (!moved) return; // 単なるタップは選択のみ
    const p = clientToLogical(svgRef.current, e.clientX, e.clientY, direction);
    // 確定を履歴へ積む
    commitStones((prev) =>
      prev.map((s) => (s.id === id ? { ...s, x: p.x, y: p.y } : s))
    );
  }

  // --- シート背景: ポインタ操作(配置 / 軌道描画) ---
  function onSurfacePointerDown(e: React.PointerEvent) {
    if (!svgRef.current) return;
    const p = clientToLogical(svgRef.current, e.clientX, e.clientY, direction);

    if (tool === "stone") {
      // 各チーム最大8個まで
      const count = stones.filter((s) => s.team === activeTeam).length;
      if (count >= MAX_STONES_PER_TEAM) {
        onLimitReached(activeTeam);
        return;
      }
      const stone: Stone = { id: newId("stone"), team: activeTeam, x: p.x, y: p.y };
      commitStones((prev) => [...prev, stone]);
      onSelectStone(stone.id);
      return;
    }

    if (tool === "shot") {
      (e.target as Element).setPointerCapture?.(e.pointerId);
      drawingRef.current = [p];
      setDrawingShot([p]);
      return;
    }

    // select ツール: 空きをタップしたら選択解除
    onSelectStone(null);
  }

  function onSurfacePointerMove(e: React.PointerEvent) {
    if (tool !== "shot" || !drawingRef.current || !svgRef.current) return;
    const p = clientToLogical(svgRef.current, e.clientX, e.clientY, direction);
    const last = drawingRef.current[drawingRef.current.length - 1];
    // 一定距離離れたら点を追加(点数を抑える)
    if (Math.hypot(p.x - last.x, p.y - last.y) > 1.2) {
      drawingRef.current = [...drawingRef.current, p];
      setDrawingShot(drawingRef.current);
    }
  }

  function onSurfacePointerUp() {
    if (tool !== "shot" || !drawingRef.current) return;
    const pts = drawingRef.current;
    drawingRef.current = null;
    setDrawingShot(null);
    if (pts.length >= 2) {
      const shot: Shot = { id: newId("shot"), type: currentShotType, points: pts };
      commitShots((prev) => [...prev, shot]);
    }
  }

  function pointsToPath(points: Point[]): string {
    if (points.length === 0) return "";
    return points
      .map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`)
      .join(" ");
  }

  return (
    <svg
      ref={svgRef}
      className="sheet-svg"
      viewBox="0 0 100 100"
      preserveAspectRatio="xMidYMid meet"
      onPointerDown={onSurfacePointerDown}
      onPointerMove={onSurfacePointerMove}
      onPointerUp={onSurfacePointerUp}
    >
      <g
        transform={rotate ? "rotate(180 50 50)" : undefined}
        style={{ transition: "transform 0.35s ease" }}
      >
        <SheetBackground />

        {/* 投球軌道(ショット種別ごとに色分け+ラベル) */}
        {shots.map((shot) => {
          const color = SHOT_COLORS[shot.type];
          const start = shot.points[0];
          return (
            <g key={shot.id}>
              <path
                d={pointsToPath(shot.points)}
                fill="none"
                stroke={color}
                strokeWidth={1}
                strokeLinecap="round"
                strokeLinejoin="round"
                markerEnd={`url(#arrow-${shot.type})`}
              />
              {/* 始点に種別ラベル。回転時も文字が正立するよう打ち消し回転 */}
              {start && (
                <g
                  transform={
                    rotate ? `rotate(180 ${start.x} ${start.y})` : undefined
                  }
                >
                  <rect
                    x={start.x - 4}
                    y={start.y - 5.6}
                    width={8}
                    height={4}
                    rx={1}
                    fill={color}
                    opacity={0.9}
                  />
                  <text
                    x={start.x}
                    y={start.y - 2.7}
                    textAnchor="middle"
                    fontSize={2.6}
                    fontWeight={700}
                    fill="#fff"
                  >
                    {SHOT_SHORT[shot.type]}
                  </text>
                </g>
              )}
            </g>
          );
        })}

        {/* 描画中の軌道プレビュー(現在選択中の種別色) */}
        {drawingShot && drawingShot.length >= 2 && (
          <path
            d={pointsToPath(drawingShot)}
            fill="none"
            stroke={SHOT_COLORS[currentShotType]}
            strokeWidth={1}
            strokeDasharray="1.5 1.2"
            strokeLinecap="round"
          />
        )}

        {/* ストーン */}
        {stones.map((s) => {
          const selected = s.id === selectedStoneId;
          const fill = s.team === "own" ? "#d0402f" : "#e6b800";
          const stroke = s.team === "own" ? "#7c1f14" : "#8a6d00";
          return (
            <g
              key={s.id}
              onPointerDown={(e) => onStonePointerDown(e, s)}
              onPointerMove={onStonePointerMove}
              onPointerUp={onStonePointerUp}
              style={{ cursor: tool === "shot" ? "default" : "grab" }}
            >
              <circle
                cx={s.x}
                cy={s.y}
                r={SHEET.stoneRadius}
                fill={fill}
                stroke={selected ? "#111" : stroke}
                strokeWidth={selected ? 1.2 : 0.6}
              />
              {/* ハンドル(上部の突起) */}
              <circle
                cx={s.x}
                cy={s.y}
                r={SHEET.stoneRadius * 0.42}
                fill="#333"
                opacity={0.35}
                pointerEvents="none"
              />
              {selected && (
                <circle
                  cx={s.x}
                  cy={s.y}
                  r={SHEET.stoneRadius + 1.4}
                  fill="none"
                  stroke="#111"
                  strokeWidth={0.4}
                  strokeDasharray="1 1"
                  pointerEvents="none"
                />
              )}
            </g>
          );
        })}
      </g>

      {/* ハウス右上のカメラアイコン(写真から配置)。回転の影響を受けず常に正立・右上固定。 */}
      {onCamera && (
        <g
          className="house-cam"
          transform="translate(74 16)"
          onPointerDown={(e) => {
            e.stopPropagation();
            onCamera();
          }}
          style={{ cursor: "pointer" }}
          role="button"
          aria-label="写真から配置"
        >
          <circle r={6.2} fill="#10261f" stroke="#3fae86" strokeWidth={0.8} />
          {/* カメラ本体 */}
          <rect x={-3.6} y={-1.9} width={7.2} height={4.8} rx={1} fill="#eef4f8" />
          <rect x={-1.4} y={-2.9} width={2.8} height={1.3} rx={0.4} fill="#eef4f8" />
          <circle cx={0} cy={0.5} r={1.7} fill="#10261f" />
          <circle cx={0} cy={0.5} r={0.9} fill="#3fae86" />
        </g>
      )}

      {/* 矢印マーカー定義(ショット種別ごとに色付き) */}
      <defs>
        {(Object.keys(SHOT_COLORS) as ShotType[]).map((t) => (
          <marker
            key={t}
            id={`arrow-${t}`}
            viewBox="0 0 10 10"
            refX="8"
            refY="5"
            markerWidth="4"
            markerHeight="4"
            orient="auto-start-reverse"
          >
            <path d="M 0 0 L 10 5 L 0 10 z" fill={SHOT_COLORS[t]} />
          </marker>
        ))}
      </defs>
    </svg>
  );
}

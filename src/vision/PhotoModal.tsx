// 写真からストーン配置を自動生成するフロー全体を担うモーダル(仕様 10, 11, 12, 6)。
//   source   : 撮影 / 写真を選択(仕様 10.2)
//   analyzing: 解析中の進捗表示(仕様 10.3)
//   review   : 認識結果の確認・修正(仕様 6)。ミニ盤面で位置ドラッグ・色切替・削除・追加。
// 「この配置を使う」で検出ストーンを作戦ボードへ引き渡す(仕様 9)。

import { useEffect, useRef, useState } from "react";
import { SHEET } from "../geometry";
import { SheetBackground } from "../Sheet";
import { MAX_STONES_PER_TEAM, type Team } from "../types";
import { analyzePhoto, downscaleImage, VisionError } from "./client";
import {
  LOW_CONFIDENCE_THRESHOLD,
  makeDetectedId,
  type DetectedStone,
} from "./types";

type Stage = "source" | "analyzing" | "review" | "error";

interface Props {
  onClose: () => void;
  // 確認・修正した配置を作戦ボードへ反映する(仕様 9)。
  onAdopt: (stones: DetectedStone[]) => void;
  // AI接続設定を開く(未設定エラー時の導線)。
  onOpenSettings: () => void;
}

// 解析中に順番に表示する進捗ステップ(仕様 10.3)。
const STEPS = ["ハウスを検出中", "ストーンを検出中", "配置を計算中"];

export function PhotoModal({ onClose, onAdopt, onOpenSettings }: Props) {
  const [stage, setStage] = useState<Stage>("source");
  const [stepIndex, setStepIndex] = useState(0);
  const [errorMsg, setErrorMsg] = useState("");
  const [errorIsNoApi, setErrorIsNoApi] = useState(false);
  const [advisory, setAdvisory] = useState<string | undefined>();
  const [stones, setStones] = useState<DetectedStone[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const cameraInputRef = useRef<HTMLInputElement | null>(null);

  // 解析中は進捗ステップをアニメーション表示する。
  useEffect(() => {
    if (stage !== "analyzing") return;
    setStepIndex(0);
    const t = window.setInterval(() => {
      setStepIndex((i) => Math.min(STEPS.length - 1, i + 1));
    }, 900);
    return () => window.clearInterval(t);
  }, [stage]);

  async function handleFile(file: File | undefined) {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setStage("error");
      setErrorIsNoApi(false);
      setErrorMsg("画像ファイルを選択してください。");
      return;
    }
    setStage("analyzing");
    try {
      const dataUrl = await downscaleImage(file);
      const result = await analyzePhoto(dataUrl);
      setStones(result.stones);
      setAdvisory(result.advisory);
      setSelectedId(null);
      setStage("review");
    } catch (e) {
      setStage("error");
      if (e instanceof VisionError) {
        setErrorIsNoApi(e.kind === "no_api");
        setErrorMsg(e.message);
      } else {
        setErrorIsNoApi(false);
        setErrorMsg("写真を解析できませんでした。\nもう一度お試しください。");
      }
    }
  }

  const lowCount = stones.filter(
    (s) => s.confidence < LOW_CONFIDENCE_THRESHOLD
  ).length;

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal photo-modal"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label="写真から配置"
      >
        {/* 隠しファイル入力(撮影 / 選択) */}
        <input
          ref={cameraInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          hidden
          onChange={(e) => handleFile(e.target.files?.[0])}
        />
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          hidden
          onChange={(e) => handleFile(e.target.files?.[0])}
        />

        {stage === "source" && (
          <SourceView
            onCapture={() => cameraInputRef.current?.click()}
            onSelect={() => fileInputRef.current?.click()}
            onClose={onClose}
          />
        )}

        {stage === "analyzing" && <AnalyzingView stepIndex={stepIndex} />}

        {stage === "error" && (
          <ErrorView
            message={errorMsg}
            showSettings={errorIsNoApi}
            onOpenSettings={onOpenSettings}
            onRetry={() => setStage("source")}
            onClose={onClose}
          />
        )}

        {stage === "review" && (
          <ReviewView
            stones={stones}
            setStones={setStones}
            selectedId={selectedId}
            setSelectedId={setSelectedId}
            advisory={advisory}
            lowCount={lowCount}
            onRetry={() => setStage("source")}
            onClose={onClose}
            onAdopt={() => onAdopt(stones)}
          />
        )}
      </div>
    </div>
  );
}

// --- 撮影 / 選択(仕様 10.2, 11) ---
function SourceView({
  onCapture,
  onSelect,
  onClose,
}: {
  onCapture: () => void;
  onSelect: () => void;
  onClose: () => void;
}) {
  return (
    <>
      <h2>写真から配置</h2>
      <p className="result-note">
        ハウス周辺の写真を解析して、ストーンを自動配置します。
        ハウス全体が写るように、できるだけ正面から撮影してください。
      </p>
      <ul className="photo-guide">
        <li>ハウス全体が写っている</li>
        <li>ストーンが見えている</li>
        <li>極端な逆光ではない</li>
      </ul>
      <div className="photo-source-btns">
        <button type="button" className="photo-source" onClick={onCapture}>
          <span className="photo-source-ico">📷</span>
          写真を撮影
        </button>
        <button type="button" className="photo-source" onClick={onSelect}>
          <span className="photo-source-ico">🖼</span>
          写真を選択
        </button>
      </div>
      <button type="button" className="close-btn ghost" onClick={onClose}>
        キャンセル
      </button>
    </>
  );
}

// --- 解析中(仕様 10.3) ---
function AnalyzingView({ stepIndex }: { stepIndex: number }) {
  return (
    <>
      <h2>写真を解析しています…</h2>
      <div className="analyzing-spinner" aria-hidden="true" />
      <ul className="analyzing-steps">
        {STEPS.map((s, i) => (
          <li
            key={s}
            className={
              i < stepIndex ? "done" : i === stepIndex ? "active" : "pending"
            }
          >
            <span className="step-mark">
              {i < stepIndex ? "✓" : i === stepIndex ? "…" : "○"}
            </span>
            {s}
          </li>
        ))}
      </ul>
    </>
  );
}

// --- エラー(仕様 12) ---
function ErrorView({
  message,
  showSettings,
  onOpenSettings,
  onRetry,
  onClose,
}: {
  message: string;
  showSettings: boolean;
  onOpenSettings: () => void;
  onRetry: () => void;
  onClose: () => void;
}) {
  return (
    <>
      <h2>解析できませんでした</h2>
      <p className="photo-error">
        {message.split("\n").map((line, i) => (
          <span key={i}>
            {line}
            <br />
          </span>
        ))}
      </p>
      <div className="cond-actions-main">
        <button type="button" className="close-btn ghost" onClick={onClose}>
          閉じる
        </button>
        {showSettings ? (
          <button type="button" className="close-btn" onClick={onOpenSettings}>
            AI接続設定を開く
          </button>
        ) : (
          <button type="button" className="close-btn" onClick={onRetry}>
            もう一度
          </button>
        )}
      </div>
    </>
  );
}

// --- 認識結果の確認・修正(仕様 6, 8) ---
function ReviewView({
  stones,
  setStones,
  selectedId,
  setSelectedId,
  advisory,
  lowCount,
  onRetry,
  onClose,
  onAdopt,
}: {
  stones: DetectedStone[];
  setStones: React.Dispatch<React.SetStateAction<DetectedStone[]>>;
  selectedId: string | null;
  setSelectedId: (id: string | null) => void;
  advisory?: string;
  lowCount: number;
  onRetry: () => void;
  onClose: () => void;
  onAdopt: () => void;
}) {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const dragRef = useRef<{ id: string; moved: boolean } | null>(null);
  // 追加モードで置くチーム色。
  const [addTeam, setAddTeam] = useState<Team>("own");
  const [addMode, setAddMode] = useState(false);

  const ownCount = stones.filter((s) => s.team === "own").length;
  const oppCount = stones.filter((s) => s.team === "opp").length;

  function clientToBoard(clientX: number, clientY: number) {
    const svg = svgRef.current;
    if (!svg) return { x: 50, y: 40 };
    const rect = svg.getBoundingClientRect();
    const x = ((clientX - rect.left) / rect.width) * 100;
    const y = ((clientY - rect.top) / rect.height) * 100;
    return {
      x: Math.max(0, Math.min(100, x)),
      y: Math.max(0, Math.min(100, y)),
    };
  }

  function onStonePointerDown(e: React.PointerEvent, st: DetectedStone) {
    e.stopPropagation();
    (e.target as Element).setPointerCapture?.(e.pointerId);
    setSelectedId(st.id);
    dragRef.current = { id: st.id, moved: false };
  }

  function onStonePointerMove(e: React.PointerEvent) {
    if (!dragRef.current) return;
    const p = clientToBoard(e.clientX, e.clientY);
    dragRef.current.moved = true;
    const id = dragRef.current.id;
    setStones((prev) =>
      prev.map((s) => (s.id === id ? { ...s, x: p.x, y: p.y } : s))
    );
  }

  function onStonePointerUp() {
    dragRef.current = null;
  }

  // 空きをタップ: 追加モードなら石を追加、そうでなければ選択解除(仕様 6)。
  function onSurfacePointerDown(e: React.PointerEvent) {
    if (!addMode) {
      setSelectedId(null);
      return;
    }
    const count = stones.filter((s) => s.team === addTeam).length;
    if (count >= MAX_STONES_PER_TEAM) return;
    const p = clientToBoard(e.clientX, e.clientY);
    const st: DetectedStone = {
      id: makeDetectedId(),
      team: addTeam,
      x: p.x,
      y: p.y,
      confidence: 1, // 手動追加は確定扱い
    };
    setStones((prev) => [...prev, st]);
    setSelectedId(st.id);
  }

  // 選択中ストーンの色を切り替える(仕様 6 色変更)。
  function toggleColor() {
    if (!selectedId) return;
    setStones((prev) =>
      prev.map((s) =>
        s.id === selectedId
          ? { ...s, team: s.team === "own" ? "opp" : "own", confidence: 1 }
          : s
      )
    );
  }

  function deleteSelected() {
    if (!selectedId) return;
    setStones((prev) => prev.filter((s) => s.id !== selectedId));
    setSelectedId(null);
  }

  return (
    <>
      <h2>認識結果の確認</h2>
      <p className="result-note">
        {stones.length}個のストーンを検出しました（赤{ownCount}・黄{oppCount}）。
        タップで選択し、ドラッグで位置を修正できます。
      </p>
      {advisory && <p className="advisory">{advisory}</p>}
      {lowCount > 0 && (
        <p className="low-conf-warn">
          ⚠ 認識に自信のないストーンが{lowCount}個あります（点線）。確認してください。
        </p>
      )}

      <div className="review-board">
        <svg
          ref={svgRef}
          className="sheet-svg"
          viewBox="0 0 100 100"
          preserveAspectRatio="xMidYMid meet"
          onPointerDown={onSurfacePointerDown}
          style={{ cursor: addMode ? "copy" : "default" }}
        >
          <SheetBackground />

          {/* ハウス中心マーカー(仕様 5) */}
          <circle
            cx={SHEET.houseCenterX}
            cy={SHEET.houseCenterY}
            r={0.9}
            fill="#111"
            opacity={0.6}
            pointerEvents="none"
          />

          {stones.map((s, i) => {
            const selected = s.id === selectedId;
            const low = s.confidence < LOW_CONFIDENCE_THRESHOLD;
            const fill = s.team === "own" ? "#d0402f" : "#e6b800";
            const stroke = s.team === "own" ? "#7c1f14" : "#8a6d00";
            return (
              <g
                key={s.id}
                onPointerDown={(e) => onStonePointerDown(e, s)}
                onPointerMove={onStonePointerMove}
                onPointerUp={onStonePointerUp}
                style={{ cursor: "grab" }}
              >
                <circle
                  cx={s.x}
                  cy={s.y}
                  r={SHEET.stoneRadius}
                  fill={fill}
                  stroke={selected ? "#111" : stroke}
                  strokeWidth={selected ? 1.2 : 0.6}
                  strokeDasharray={low && !selected ? "1 0.8" : undefined}
                />
                {/* ストーン番号(仕様 5) */}
                <text
                  x={s.x}
                  y={s.y + 1.1}
                  textAnchor="middle"
                  fontSize={3}
                  fontWeight={700}
                  fill={s.team === "own" ? "#fff" : "#4a3b00"}
                  pointerEvents="none"
                >
                  {i + 1}
                </text>
                {/* 低信頼マーク */}
                {low && (
                  <text
                    x={s.x + SHEET.stoneRadius}
                    y={s.y - SHEET.stoneRadius}
                    textAnchor="middle"
                    fontSize={3.4}
                    pointerEvents="none"
                  >
                    ⚠
                  </text>
                )}
              </g>
            );
          })}
        </svg>
      </div>

      {/* 修正ツール(仕様 6) */}
      <div className="review-tools">
        <button
          type="button"
          className={`chip ${addMode ? "active-chip" : ""}`}
          onClick={() => setAddMode((v) => !v)}
        >
          {addMode ? "追加中…" : "＋ 石を追加"}
        </button>
        {addMode && (
          <div className="add-team-toggle">
            <button
              type="button"
              className={`team-btn own ${addTeam === "own" ? "active" : ""}`}
              onClick={() => setAddTeam("own")}
            >
              赤
            </button>
            <button
              type="button"
              className={`team-btn opp ${addTeam === "opp" ? "active" : ""}`}
              onClick={() => setAddTeam("opp")}
            >
              黄
            </button>
          </div>
        )}
        <button
          type="button"
          className="chip"
          onClick={toggleColor}
          disabled={!selectedId}
        >
          色を変更
        </button>
        <button
          type="button"
          className="chip danger-chip"
          onClick={deleteSelected}
          disabled={!selectedId}
        >
          削除
        </button>
      </div>

      <div className="cond-actions-main">
        <button type="button" className="close-btn ghost" onClick={onRetry}>
          撮り直す
        </button>
        <button
          type="button"
          className="close-btn"
          onClick={onAdopt}
          disabled={stones.length === 0}
        >
          この配置を使う
        </button>
      </div>
      <button
        type="button"
        className="close-btn ghost photo-cancel"
        onClick={onClose}
      >
        キャンセル
      </button>
    </>
  );
}

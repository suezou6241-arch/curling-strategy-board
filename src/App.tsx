import { useCallback, useEffect, useMemo, useState } from "react";
import { BoardView, type Tool } from "./BoardView";
import { useHistory } from "./useHistory";
import {
  addTeamName,
  deleteBoard,
  listBoards,
  listTeamNames,
  removeTeamName,
  saveBoard,
} from "./storage";
import { TeamNameInput } from "./TeamNameInput";
import {
  createEmptyBoard,
  MAX_STONES_PER_TEAM,
  newId,
  SHOT_COLORS,
  SHOT_LABELS,
  STONES_PER_END,
  type Board,
  type BoardState,
  type Direction,
  type Hammer,
  type MaxEnds,
  type Shot,
  type ShotType,
  type Stone,
  type Team,
} from "./types";
import { ConditionModal } from "./strategy/ConditionModal";
import { ResultModal } from "./strategy/ResultModal";
import { SettingsModal } from "./strategy/SettingsModal";
import { requestStrategy, StrategyError } from "./strategy/client";
import { PhotoModal } from "./vision/PhotoModal";
import type { DetectedStone } from "./vision/types";
import {
  computeRemainingStones,
  type StrategyConditions,
  type StrategyProposal,
  type StrategyResult,
} from "./strategy/types";

function stateFromBoard(b: Board): BoardState {
  return {
    stones: b.stones,
    shots: b.shots,
    end: b.end,
    hammer: b.hammer,
  };
}

export default function App() {
  // 保存メタ情報(履歴対象外)
  const [boardId, setBoardId] = useState<string>(() => createEmptyBoard().id);
  const [team, setTeam] = useState("Team A");
  const [opponent, setOpponent] = useState("Team B");
  const [direction, setDirection] = useState<Direction>("down");
  const [createdAt, setCreatedAt] = useState<string>(() =>
    new Date().toISOString()
  );

  // 局面状態(履歴対象)
  const initial: BoardState = useMemo(
    () => stateFromBoard(createEmptyBoard()),
    []
  );
  const history = useHistory<BoardState>(initial);
  const { state, set, replace, undo, redo, reset, canUndo, canRedo } = history;

  const [tool, setTool] = useState<Tool>("stone");
  const [activeTeam, setActiveTeam] = useState<Team>("own");
  const [selectedStoneId, setSelectedStoneId] = useState<string | null>(null);
  const [shotType, setShotType] = useState<ShotType>("draw");
  const [showBoards, setShowBoards] = useState(false);
  const [savedBoards, setSavedBoards] = useState<Board[]>([]);
  const [toast, setToast] = useState<string | null>(null);
  const [teamNames, setTeamNames] = useState<string[]>(() => listTeamNames());

  // --- 作戦提案機能 ---
  const [strategyStage, setStrategyStage] = useState<
    "closed" | "condition" | "result"
  >("closed");
  const [strategyLoading, setStrategyLoading] = useState(false);
  const [strategyResult, setStrategyResult] = useState<StrategyResult | null>(
    null
  );
  const [showAiSettings, setShowAiSettings] = useState(false);

  // --- 写真からの配置自動生成機能 ---
  const [showPhoto, setShowPhoto] = useState(false);

  const flash = useCallback((msg: string) => {
    setToast(msg);
    window.setTimeout(() => setToast(null), 1800);
  }, []);

  // チームごとの石数(各チーム最大8個)
  const ownCount = state.stones.filter((s) => s.team === "own").length;
  const oppCount = state.stones.filter((s) => s.team === "opp").length;

  const handleLimitReached = useCallback(
    (team: Team) => {
      flash(
        `${team === "own" ? "自チーム" : "相手"}の石は${MAX_STONES_PER_TEAM}個までです`
      );
    },
    [flash]
  );

  // --- 局面状態の更新ヘルパ ---
  const commitStones = useCallback(
    (updater: (prev: Stone[]) => Stone[]) =>
      set((prev) => ({ ...prev, stones: updater(prev.stones) })),
    [set]
  );
  const previewStones = useCallback(
    (updater: (prev: Stone[]) => Stone[]) =>
      replace((prev) => ({ ...prev, stones: updater(prev.stones) })),
    [replace]
  );
  const commitShots = useCallback(
    (updater: (prev: BoardState["shots"]) => BoardState["shots"]) =>
      set((prev) => ({ ...prev, shots: updater(prev.shots) })),
    [set]
  );

  // --- 各操作 ---
  function deleteSelectedStone() {
    if (!selectedStoneId) {
      flash("ストーンを選択してください");
      return;
    }
    const id = selectedStoneId;
    set((prev) => ({ ...prev, stones: prev.stones.filter((s) => s.id !== id) }));
    setSelectedStoneId(null);
  }

  function clearAll() {
    if (state.stones.length === 0 && state.shots.length === 0) return;
    if (!window.confirm("盤面のストーンと軌道をすべて消去しますか?")) return;
    set((prev) => ({ ...prev, stones: [], shots: [] }));
    setSelectedStoneId(null);
  }

  function deleteLastShot() {
    if (state.shots.length === 0) {
      flash("軌道がありません");
      return;
    }
    set((prev) => ({ ...prev, shots: prev.shots.slice(0, -1) }));
  }

  function flipDirection() {
    // 方向反転は表示設定。局面状態は変えず Undo/Redo 対象外。
    setDirection((d) => (d === "down" ? "up" : "down"));
  }

  function changeEnd(delta: number) {
    set((prev) => ({ ...prev, end: Math.max(1, prev.end + delta) }));
  }

  function toggleHammer() {
    set((prev) => ({
      ...prev,
      hammer: prev.hammer === "own" ? ("opp" as Hammer) : ("own" as Hammer),
    }));
  }

  // --- 保存 / 読み込み ---
  function buildBoard(): Board {
    return {
      id: boardId,
      team,
      opponent,
      end: state.end,
      hammer: state.hammer,
      direction,
      stones: state.stones,
      shots: state.shots,
      createdAt,
      updatedAt: new Date().toISOString(),
    };
  }

  function handleSave() {
    saveBoard(buildBoard());
    // 使ったチーム名を履歴に追加
    addTeamName(team);
    addTeamName(opponent);
    setTeamNames(listTeamNames());
    flash("局面を保存しました");
  }

  function handleRemoveTeamName(name: string) {
    removeTeamName(name);
    setTeamNames(listTeamNames());
  }

  function openBoards() {
    setSavedBoards(listBoards());
    setShowBoards(true);
  }

  function handleLoad(b: Board) {
    setBoardId(b.id);
    setTeam(b.team);
    setOpponent(b.opponent);
    setDirection(b.direction);
    setCreatedAt(b.createdAt);
    reset(stateFromBoard(b));
    setSelectedStoneId(null);
    setShowBoards(false);
    flash("局面を読み込みました");
  }

  function handleNew() {
    const b = createEmptyBoard();
    setBoardId(b.id);
    setTeam("Team A");
    setOpponent("Team B");
    setDirection("down");
    setCreatedAt(b.createdAt);
    reset(stateFromBoard(b));
    setSelectedStoneId(null);
    setShowBoards(false);
    flash("新規局面を作成しました");
  }

  function handleDelete(id: string) {
    if (!window.confirm("この局面を削除しますか?")) return;
    deleteBoard(id);
    setSavedBoards(listBoards());
  }

  // --- 作戦提案 ---
  // 条件ポップアップの初期値を現在の局面から推定する。
  function buildInitialConditions(): StrategyConditions {
    // 何投目かは盤面の配置済み石数から推定(自チームが次に投げる投数)。
    const placed = Math.max(ownCount, oppCount);
    const shotNumber = Math.min(
      STONES_PER_END,
      Math.max(1, placed + 1)
    );
    const maxEnds: MaxEnds = 8; // 既定は8エンド制
    return {
      maxEnds,
      end: Math.min(maxEnds, state.end),
      score: { own: 0, opponent: 0 },
      hammer: state.hammer,
      shotNumber,
      remainingStones: computeRemainingStones(shotNumber, state.hammer),
      objective: "auto",
      riskLevel: "normal",
      ice: { curl: "unknown", weight: "unknown" },
    };
  }

  function openStrategy() {
    if (state.stones.length === 0) {
      flash("先にストーンを配置してください");
      return;
    }
    setStrategyStage("condition");
  }

  async function handleStrategySubmit(cond: StrategyConditions) {
    setStrategyLoading(true);
    try {
      const result = await requestStrategy(state.stones, cond);
      setStrategyResult(result);
      setStrategyStage("result");
    } catch (e) {
      if (e instanceof StrategyError) {
        flash(e.message.replace(/\n/g, " "));
      } else {
        flash("作戦提案を取得できませんでした");
      }
    } finally {
      setStrategyLoading(false);
    }
  }

  // 提案をボードへ反映(仕様 17)。from→target の軌道を1本追加する。
  function applyProposal(p: StrategyProposal) {
    const target = p.target ?? { x: 50, y: 40 };
    const from = p.from ?? { x: 50, y: 98 };
    const shot: Shot = {
      id: newId("shot"),
      type: p.shotType,
      points: [from, target],
    };
    commitShots((prev) => [...prev, shot]);
    setStrategyStage("closed");
    setStrategyResult(null);
    flash(`「${p.title}」をボードに表示しました`);
  }

  // 写真解析で確認・修正した配置を作戦ボードへ反映する(仕様 9)。
  // 既存の配置を、検出したストーンで置き換える。軌道はそのまま残す。
  function adoptDetectedStones(detected: DetectedStone[]) {
    const stones: Stone[] = detected.map((d) => ({
      id: newId("stone"),
      team: d.team,
      x: d.x,
      y: d.y,
    }));
    set((prev) => ({ ...prev, stones }));
    setSelectedStoneId(null);
    setShowPhoto(false);
    flash(`${stones.length}個のストーンを配置しました`);
  }

  // キーボードショートカット(PC確認用)
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z") {
        e.preventDefault();
        if (e.shiftKey) redo();
        else undo();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [undo, redo]);

  return (
    <div className="app">
      {/* ① ヘッダー */}
      <header className="header">
        <div className="header-row">
          <TeamNameInput
            value={team}
            onChange={setTeam}
            options={teamNames}
            onRemoveOption={handleRemoveTeamName}
            ariaLabel="自チーム名"
            variant="own"
          />
          <span className="vs">vs</span>
          <TeamNameInput
            value={opponent}
            onChange={setOpponent}
            options={teamNames}
            onRemoveOption={handleRemoveTeamName}
            ariaLabel="対戦相手名"
            variant="opp"
          />
        </div>
        <div className="header-row">
          <div className="end-ctrl">
            <button className="mini" onClick={() => changeEnd(-1)} aria-label="前のエンド">
              −
            </button>
            <span className="end-label">END {state.end}</span>
            <button className="mini" onClick={() => changeEnd(1)} aria-label="次のエンド">
              ＋
            </button>
          </div>
          <button className="chip" onClick={toggleHammer}>
            {state.hammer === "own" ? "後攻" : "先攻"}
          </button>
          <button className="chip" onClick={flipDirection}>
            投球方向 {direction === "down" ? "↓" : "↑"}
          </button>
        </div>
      </header>

      {/* ② カーリングシート */}
      <main className="sheet-area">
        <div className="sheet-frame">
          {/* シート(ハウスの箱)の右上のカメラアイコン(写真から配置) */}
          <button
            type="button"
            className="corner-cam-btn"
            onClick={() => setShowPhoto(true)}
            aria-label="写真から配置"
            title="写真から配置"
          >
            📷
          </button>
          <BoardView
          stones={state.stones}
          shots={state.shots}
          direction={direction}
          tool={tool}
          activeTeam={activeTeam}
          currentShotType={shotType}
          selectedStoneId={selectedStoneId}
          commitStones={commitStones}
          commitShots={commitShots}
          previewStones={previewStones}
          onSelectStone={setSelectedStoneId}
          onLimitReached={handleLimitReached}
          />
        </div>
      </main>

      {/* ツール選択 */}
      <div className="tool-tabs">
        <button
          className={`tool-tab ${tool === "stone" ? "active" : ""}`}
          onClick={() => setTool("stone")}
        >
          石を置く
        </button>
        <button
          className={`tool-tab ${tool === "select" ? "active" : ""}`}
          onClick={() => setTool("select")}
        >
          選択/移動
        </button>
        <button
          className={`tool-tab ${tool === "shot" ? "active" : ""}`}
          onClick={() => setTool("shot")}
        >
          軌道を描く
        </button>
      </div>

      {/* ショット種類(軌道モード時) */}
      {tool === "shot" && (
        <div className="shot-select">
          <span
            className="shot-swatch"
            style={{ background: SHOT_COLORS[shotType] }}
            aria-hidden="true"
          />
          <select
            value={shotType}
            onChange={(e) => setShotType(e.target.value as ShotType)}
            aria-label="ショット種類"
          >
            {(Object.keys(SHOT_LABELS) as ShotType[]).map((k) => (
              <option key={k} value={k}>
                {SHOT_LABELS[k]}
              </option>
            ))}
          </select>
          <span className="hint">ドラッグで軌道を描画(種別ごとに色分け)</span>
        </div>
      )}

      {/* チーム選択(石を置くモード時のみ) */}
      {tool === "stone" && (
        <div className="team-toggle">
          <button
            className={`team-btn own ${activeTeam === "own" ? "active" : ""}`}
            onClick={() => setActiveTeam("own")}
          >
            自チーム(赤) {ownCount}/{MAX_STONES_PER_TEAM}
          </button>
          <button
            className={`team-btn opp ${activeTeam === "opp" ? "active" : ""}`}
            onClick={() => setActiveTeam("opp")}
          >
            相手(黄) {oppCount}/{MAX_STONES_PER_TEAM}
          </button>
        </div>
      )}

      {/* ③ 操作ツールバー */}
      <footer className="toolbar">
        <button className="tb" onClick={deleteSelectedStone}>
          <span className="ico">🗑</span>石削除
        </button>
        <button className="tb" onClick={deleteLastShot}>
          <span className="ico">〜</span>軌道削除
        </button>
        <button className="tb" onClick={clearAll}>
          <span className="ico">✕</span>全消去
        </button>
        <button className="tb" onClick={undo} disabled={!canUndo}>
          <span className="ico">↶</span>Undo
        </button>
        <button className="tb" onClick={redo} disabled={!canRedo}>
          <span className="ico">↷</span>Redo
        </button>
        <button className="tb primary" onClick={handleSave}>
          <span className="ico">💾</span>保存
        </button>
        <button className="tb" onClick={openBoards}>
          <span className="ico">📂</span>呼出
        </button>
        <button className="tb strategy" onClick={openStrategy}>
          <span className="ico">🧠</span>作戦提案
        </button>
      </footer>

      {/* 局面一覧モーダル */}
      {showBoards && (
        <div className="modal-backdrop" onClick={() => setShowBoards(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h2>保存した局面</h2>
            <div className="modal-actions-top">
              <button className="chip" onClick={handleNew}>
                ＋ 新規局面
              </button>
            </div>
            {savedBoards.length === 0 ? (
              <p className="empty">保存された局面はありません</p>
            ) : (
              <ul className="board-list">
                {savedBoards.map((b) => (
                  <li key={b.id}>
                    <button className="board-item" onClick={() => handleLoad(b)}>
                      <strong>
                        {b.team} vs {b.opponent}
                      </strong>
                      <span>
                        END {b.end} / {b.hammer === "own" ? "後攻" : "先攻"} /
                        石{b.stones.length} 軌道{b.shots.length}
                      </span>
                      <small>{new Date(b.updatedAt).toLocaleString()}</small>
                    </button>
                    <button
                      className="del-btn"
                      onClick={() => handleDelete(b.id)}
                      aria-label="削除"
                    >
                      削除
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <button className="close-btn" onClick={() => setShowBoards(false)}>
              閉じる
            </button>
          </div>
        </div>
      )}

      {/* 作戦提案: 条件設定 */}
      {strategyStage === "condition" && (
        <ConditionModal
          initial={buildInitialConditions()}
          loading={strategyLoading}
          onCancel={() => setStrategyStage("closed")}
          onSubmit={handleStrategySubmit}
          onOpenSettings={() => setShowAiSettings(true)}
        />
      )}

      {/* 作戦提案: 結果 */}
      {strategyStage === "result" && strategyResult && (
        <ResultModal
          result={strategyResult}
          onClose={() => {
            setStrategyStage("closed");
            setStrategyResult(null);
          }}
          onApply={applyProposal}
        />
      )}

      {/* 写真から配置 */}
      {showPhoto && (
        <PhotoModal
          onClose={() => setShowPhoto(false)}
          onAdopt={adoptDetectedStones}
          onOpenSettings={() => {
            setShowPhoto(false);
            setShowAiSettings(true);
          }}
        />
      )}

      {/* AI接続設定 */}
      {showAiSettings && (
        <SettingsModal
          onClose={() => setShowAiSettings(false)}
          onSaved={() => {
            setShowAiSettings(false);
            flash("AI接続設定を保存しました");
          }}
        />
      )}

      {toast && <div className="toast">{toast}</div>}
    </div>
  );
}

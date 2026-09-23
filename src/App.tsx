import { useCallback, useEffect, useMemo, useState } from "react";
import { BoardView, type Tool } from "./BoardView";
import { useHistory } from "./useHistory";
import { deleteBoard, listBoards, saveBoard } from "./storage";
import {
  createEmptyBoard,
  MAX_STONES_PER_TEAM,
  SHOT_COLORS,
  SHOT_LABELS,
  type Board,
  type BoardState,
  type Direction,
  type Hammer,
  type ShotType,
  type Stone,
  type Team,
} from "./types";

function stateFromBoard(b: Board): BoardState {
  return {
    stones: b.stones,
    shots: b.shots,
    comment: b.comment,
    shotTitle: b.shotTitle,
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
  const [showComment, setShowComment] = useState(false);
  const [savedBoards, setSavedBoards] = useState<Board[]>([]);
  const [toast, setToast] = useState<string | null>(null);

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
      comment: state.comment,
      shotTitle: state.shotTitle,
      createdAt,
      updatedAt: new Date().toISOString(),
    };
  }

  function handleSave() {
    saveBoard(buildBoard());
    flash("局面を保存しました");
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
          <input
            className="team-input"
            value={team}
            onChange={(e) => setTeam(e.target.value)}
            aria-label="自チーム名"
          />
          <span className="vs">vs</span>
          <input
            className="team-input"
            value={opponent}
            onChange={(e) => setOpponent(e.target.value)}
            aria-label="対戦相手名"
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
            {state.hammer === "own" ? "後攻(ハンマー)" : "先攻"}
          </button>
          <button className="chip" onClick={flipDirection}>
            投球方向 {direction === "down" ? "↓" : "↑"}
          </button>
        </div>
      </header>

      {/* チーム選択(石を置く対象) */}
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

      {/* ② カーリングシート */}
      <main className="sheet-area">
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
        <button className="tb" onClick={() => setShowComment(true)}>
          <span className="ico">📝</span>作戦
        </button>
        <button className="tb primary" onClick={handleSave}>
          <span className="ico">💾</span>保存
        </button>
        <button className="tb" onClick={openBoards}>
          <span className="ico">📂</span>呼出
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
                      {b.shotTitle && <small>作戦: {b.shotTitle}</small>}
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

      {/* 作戦コメントモーダル */}
      {showComment && (
        <div className="modal-backdrop" onClick={() => setShowComment(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h2>作戦コメント</h2>
            <label className="field">
              作戦タイトル
              <input
                value={state.shotTitle}
                onChange={(e) =>
                  set((prev) => ({ ...prev, shotTitle: e.target.value }))
                }
                placeholder="例: センターガード"
              />
            </label>
            <label className="field">
              メモ
              <textarea
                rows={5}
                value={state.comment}
                onChange={(e) =>
                  set((prev) => ({ ...prev, comment: e.target.value }))
                }
                placeholder="例: 相手の2投目が弱いので次にフリーズを狙う"
              />
            </label>
            <button className="close-btn" onClick={() => setShowComment(false)}>
              閉じる
            </button>
          </div>
        </div>
      )}

      {toast && <div className="toast">{toast}</div>}
    </div>
  );
}

// 作戦提案条件設定ポップアップ(仕様 5〜9, 21)
import { useState } from "react";
import { MAX_ENDS_OPTIONS, STONES_PER_END, type Hammer, type MaxEnds } from "../types";
import {
  computeRemainingStones,
  CURL_LABELS,
  OBJECTIVE_LABELS,
  RISK_LABELS,
  WEIGHT_LABELS,
  type CurlLevel,
  type Objective,
  type RiskLevel,
  type StrategyConditions,
  type WeightLevel,
} from "./types";

interface Props {
  initial: StrategyConditions;
  loading: boolean;
  onCancel: () => void;
  onSubmit: (cond: StrategyConditions) => void;
  onOpenSettings: () => void;
}

// +/- 付きの数値ステッパー
function Stepper({
  label,
  value,
  min = 0,
  max,
  onChange,
  ariaLabel,
}: {
  label?: string;
  value: number;
  min?: number;
  max?: number;
  onChange: (v: number) => void;
  ariaLabel: string;
}) {
  const atMin = value <= min;
  const atMax = max !== undefined && value >= max;
  return (
    <div className="stepper">
      {label && <span className="stepper-label">{label}</span>}
      <button
        type="button"
        className="mini"
        onClick={() => onChange(Math.max(min, value - 1))}
        disabled={atMin}
        aria-label={`${ariaLabel}を減らす`}
      >
        −
      </button>
      <span className="stepper-value" aria-label={ariaLabel}>
        {value}
      </span>
      <button
        type="button"
        className="mini"
        onClick={() => onChange(max !== undefined ? Math.min(max, value + 1) : value + 1)}
        disabled={atMax}
        aria-label={`${ariaLabel}を増やす`}
      >
        ＋
      </button>
    </div>
  );
}

export function ConditionModal({
  initial,
  loading,
  onCancel,
  onSubmit,
  onOpenSettings,
}: Props) {
  const [maxEnds, setMaxEnds] = useState<MaxEnds>(initial.maxEnds);
  const [end, setEnd] = useState(initial.end);
  const [ownScore, setOwnScore] = useState(initial.score.own);
  const [oppScore, setOppScore] = useState(initial.score.opponent);
  const [hammer, setHammer] = useState<Hammer>(initial.hammer);
  const [shotNumber, setShotNumber] = useState(initial.shotNumber);
  const [objective, setObjective] = useState<Objective>(initial.objective);

  // 残り石は「何投目か」と先攻/後攻から算出する(入力欄は持たない)。
  const remain = computeRemainingStones(shotNumber, hammer);

  // エンドは最大エンド数以内に収める。
  function changeMaxEnds(v: MaxEnds) {
    setMaxEnds(v);
    if (end > v) setEnd(v);
  }
  function changeEnd(v: number) {
    setEnd(Math.min(maxEnds, Math.max(1, v)));
  }
  const [risk, setRisk] = useState<RiskLevel>(initial.riskLevel);
  const [curl, setCurl] = useState<CurlLevel>(initial.ice.curl);
  const [weight, setWeight] = useState<WeightLevel>(initial.ice.weight);
  const [note, setNote] = useState(initial.note ?? "");
  const [showIce, setShowIce] = useState(false);

  function submit() {
    onSubmit({
      maxEnds,
      end,
      score: { own: ownScore, opponent: oppScore },
      hammer,
      shotNumber,
      remainingStones: remain,
      objective,
      riskLevel: risk,
      ice: { curl, weight },
      note: note.trim() || undefined,
    });
  }

  return (
    <div className="modal-backdrop" onClick={onCancel}>
      <div
        className="modal cond-modal"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label="作戦提案条件設定"
      >
        <h2>作戦提案条件</h2>

        {/* 基本条件 */}
        <section className="cond-section">
          <div className="cond-row">
            <span className="cond-key">試合形式</span>
            <div className="seg">
              {MAX_ENDS_OPTIONS.map((v) => (
                <button
                  key={v}
                  type="button"
                  className={`seg-btn ${maxEnds === v ? "active" : ""}`}
                  onClick={() => changeMaxEnds(v)}
                >
                  {v}エンド
                </button>
              ))}
            </div>
          </div>
          <div className="cond-row">
            <span className="cond-key">エンド</span>
            <Stepper
              value={end}
              min={1}
              max={maxEnds}
              onChange={changeEnd}
              ariaLabel="エンド"
            />
          </div>
          <div className="cond-row">
            <span className="cond-key">スコア</span>
            <div className="cond-score">
              <Stepper label="自" value={ownScore} onChange={setOwnScore} ariaLabel="自チーム得点" />
              <Stepper label="相手" value={oppScore} onChange={setOppScore} ariaLabel="相手得点" />
            </div>
          </div>
          <div className="cond-row">
            <span className="cond-key">先攻/後攻</span>
            <div className="seg">
              <button
                type="button"
                className={`seg-btn ${hammer === "opp" ? "active" : ""}`}
                onClick={() => setHammer("opp")}
              >
                先攻
              </button>
              <button
                type="button"
                className={`seg-btn ${hammer === "own" ? "active" : ""}`}
                onClick={() => setHammer("own")}
              >
                後攻
              </button>
            </div>
          </div>
          <div className="cond-row">
            <span className="cond-key">何投目</span>
            <Stepper
              value={shotNumber}
              min={1}
              max={STONES_PER_END}
              onChange={setShotNumber}
              ariaLabel="何投目"
            />
          </div>
          <div className="cond-row">
            <span className="cond-key">残り石(自動)</span>
            <span className="cond-remain">
              自 {remain.own} / 相手 {remain.opponent}
            </span>
          </div>
        </section>

        {/* 目的 */}
        <section className="cond-section">
          <h3>目的</h3>
          <select
            className="objective-select"
            value={objective}
            onChange={(e) => setObjective(e.target.value as Objective)}
            aria-label="作戦目的"
          >
            {(Object.keys(OBJECTIVE_LABELS) as Objective[]).map((k) => (
              <option key={k} value={k}>
                {OBJECTIVE_LABELS[k]}
              </option>
            ))}
          </select>
        </section>

        {/* リスク許容度 */}
        <section className="cond-section">
          <h3>リスク許容度</h3>
          <div className="seg">
            {(Object.keys(RISK_LABELS) as RiskLevel[]).map((k) => (
              <button
                key={k}
                type="button"
                className={`seg-btn ${risk === k ? "active" : ""}`}
                onClick={() => setRisk(k)}
              >
                {RISK_LABELS[k]}
              </button>
            ))}
          </div>
        </section>

        {/* アイスコンディション(任意・折りたたみ) */}
        <section className="cond-section">
          <button
            type="button"
            className="disclosure"
            onClick={() => setShowIce((v) => !v)}
            aria-expanded={showIce}
          >
            {showIce ? "▼" : "▶"} アイスコンディション(任意)
          </button>
          {showIce && (
            <div className="ice-grid">
              <label>
                曲がり
                <select value={curl} onChange={(e) => setCurl(e.target.value as CurlLevel)}>
                  {(Object.keys(CURL_LABELS) as CurlLevel[]).map((k) => (
                    <option key={k} value={k}>
                      {CURL_LABELS[k]}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                ウェイト
                <select value={weight} onChange={(e) => setWeight(e.target.value as WeightLevel)}>
                  {(Object.keys(WEIGHT_LABELS) as WeightLevel[]).map((k) => (
                    <option key={k} value={k}>
                      {WEIGHT_LABELS[k]}
                    </option>
                  ))}
                </select>
              </label>
              <label className="ice-note">
                補足コメント
                <input
                  type="text"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="例: 相手の2投目が弱い など"
                />
              </label>
            </div>
          )}
        </section>

        <div className="cond-actions">
          <button type="button" className="link-btn" onClick={onOpenSettings}>
            AI接続設定
          </button>
          <div className="cond-actions-main">
            <button type="button" className="close-btn ghost" onClick={onCancel} disabled={loading}>
              キャンセル
            </button>
            <button type="button" className="close-btn" onClick={submit} disabled={loading}>
              {loading ? "提案中…" : "作戦を提案"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

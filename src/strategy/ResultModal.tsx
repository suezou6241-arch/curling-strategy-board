// AI作戦提案結果 + 作戦詳細(仕様 15,16,18)
import { useState } from "react";
import { SHOT_LABELS } from "../types";
import type { StrategyProposal, StrategyResult } from "./types";

interface Props {
  result: StrategyResult;
  onClose: () => void;
  // 選択した作戦をボードへ反映する(仕様 17)
  onApply: (p: StrategyProposal) => void;
}

function RiskStars({ n }: { n: number }) {
  const full = Math.min(5, Math.max(0, n));
  return (
    <span className="risk-stars" aria-label={`リスク ${full} / 5`}>
      {"★".repeat(full)}
      {"☆".repeat(5 - full)}
    </span>
  );
}

export function ResultModal({ result, onClose, onApply }: Props) {
  const [openId, setOpenId] = useState<string | null>(null);
  const { proposals, advisory } = result;

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal result-modal"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label="AI作戦提案"
      >
        <h2>作戦提案</h2>
        <p className="result-note">
          いずれも「正解」ではなく、目的別の候補です。メリットとリスクを比べて選んでください。
        </p>
        {advisory && <p className="advisory">{advisory}</p>}

        {proposals.length === 0 ? (
          <p className="empty">提案を生成できませんでした。条件を変えてお試しください。</p>
        ) : (
          <ul className="proposal-list">
            {proposals.map((p, i) => {
              const open = openId === p.id;
              return (
                <li key={p.id} className="proposal-card">
                  <button
                    type="button"
                    className="proposal-head"
                    onClick={() => setOpenId(open ? null : p.id)}
                    aria-expanded={open}
                  >
                    <div className="proposal-head-main">
                      <span className="proposal-index">{i + 1}</span>
                      <div>
                        <div className="proposal-cat">{p.category}</div>
                        <div className="proposal-title">{p.title}</div>
                      </div>
                    </div>
                    <div className="proposal-head-side">
                      <RiskStars n={p.riskStars} />
                      <span className="chev">{open ? "▲" : "▼"}</span>
                    </div>
                  </button>

                  {open && (
                    <div className="proposal-detail">
                      <Detail label="ショット種類" value={SHOT_LABELS[p.shotType]} />
                      <Detail label="狙い" value={p.aim} />
                      <Detail label="推奨ウェイト" value={p.weight} />
                      {p.target && (
                        <Detail
                          label="狙う位置"
                          value={`x:${Math.round(p.target.x)} / y:${Math.round(p.target.y)}`}
                        />
                      )}
                      <Detail label="期待結果" value={p.expectedResult} />
                      <Detail label="メリット" value={p.merit} />
                      <Detail label="リスク" value={p.risk} />
                      <button
                        type="button"
                        className="close-btn apply-btn"
                        onClick={() => onApply(p)}
                      >
                        この作戦をボードに表示
                      </button>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}

        <button type="button" className="close-btn ghost" onClick={onClose}>
          閉じる
        </button>
      </div>
    </div>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  if (!value) return null;
  return (
    <div className="detail-row">
      <span className="detail-label">{label}</span>
      <span className="detail-value">{value}</span>
    </div>
  );
}

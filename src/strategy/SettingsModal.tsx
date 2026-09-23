// AI接続設定モーダル。未設定でもオフラインの簡易ロジックで動作する旨を明記する。
import { useState } from "react";
import { loadAiSettings, saveAiSettings, type AiSettings } from "./settings";

interface Props {
  onClose: () => void;
  onSaved: () => void;
}

export function SettingsModal({ onClose, onSaved }: Props) {
  const [s, setS] = useState<AiSettings>(() => loadAiSettings());

  function save() {
    saveAiSettings({
      baseUrl: s.baseUrl.trim(),
      apiKey: s.apiKey.trim(),
      model: s.model.trim(),
    });
    onSaved();
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal settings-modal"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label="AI接続設定"
      >
        <h2>AI接続設定</h2>
        <p className="result-note">
          OpenAI互換のAPIに接続します。未設定の場合は端末内の簡易ロジックで提案します。
          キーはこの端末のブラウザにのみ保存されます。
        </p>

        <label className="field">
          ベースURL
          <input
            type="text"
            value={s.baseUrl}
            onChange={(e) => setS({ ...s, baseUrl: e.target.value })}
            placeholder="https://api.openai.com/v1"
          />
        </label>
        <label className="field">
          モデル
          <input
            type="text"
            value={s.model}
            onChange={(e) => setS({ ...s, model: e.target.value })}
            placeholder="gpt-4o-mini"
          />
        </label>
        <label className="field">
          APIキー
          <input
            type="password"
            value={s.apiKey}
            onChange={(e) => setS({ ...s, apiKey: e.target.value })}
            placeholder="sk-..."
            autoComplete="off"
          />
        </label>

        <div className="cond-actions-main">
          <button type="button" className="close-btn ghost" onClick={onClose}>
            キャンセル
          </button>
          <button type="button" className="close-btn" onClick={save}>
            保存
          </button>
        </div>
      </div>
    </div>
  );
}

import { useEffect, useRef, useState } from "react";

interface Props {
  value: string;
  onChange: (name: string) => void;
  // 履歴候補(呼び出し側で listTeamNames() を渡す)
  options: string[];
  // 履歴から削除
  onRemoveOption: (name: string) => void;
  ariaLabel: string;
  // 石の色に合わせた見た目(own=赤 / opp=黄)
  variant: "own" | "opp";
}

// チーム名の入力欄 + 履歴ドロップダウン(選択・削除可能)のコンボボックス。
export function TeamNameInput({
  value,
  onChange,
  options,
  onRemoveOption,
  ariaLabel,
  variant,
}: Props) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);

  // 外側クリックで閉じる
  useEffect(() => {
    if (!open) return;
    function onDocPointer(e: PointerEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("pointerdown", onDocPointer);
    return () => document.removeEventListener("pointerdown", onDocPointer);
  }, [open]);

  function select(name: string) {
    onChange(name);
    setOpen(false);
  }

  return (
    <div className={`team-name ${variant}`} ref={rootRef}>
      <input
        className="team-input"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-label={ariaLabel}
      />
      <button
        type="button"
        className="team-dropdown-btn"
        aria-label="チーム名の履歴を開く"
        onClick={() => setOpen((o) => !o)}
        disabled={options.length === 0}
      >
        ▼
      </button>
      {open && options.length > 0 && (
        <ul className="team-options">
          {options.map((name) => (
            <li key={name}>
              <button
                type="button"
                className="team-option"
                onClick={() => select(name)}
              >
                {name}
              </button>
              <button
                type="button"
                className="team-option-del"
                aria-label={`${name} を履歴から削除`}
                onClick={(e) => {
                  e.stopPropagation();
                  onRemoveOption(name);
                }}
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

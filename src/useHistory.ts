import { useCallback, useRef, useState } from "react";

// 汎用の Undo/Redo 履歴フック。
// present を現在値として保持し、set で新しい状態を積む。
export function useHistory<T>(initial: T) {
  const [present, setPresent] = useState<T>(initial);
  const past = useRef<T[]>([]);
  const future = useRef<T[]>([]);
  // past/future の長さを UI に反映するためのトリガ
  const [, force] = useState(0);
  const rerender = useCallback(() => force((n) => n + 1), []);

  // 履歴に積んで新しい状態へ移行する
  const set = useCallback(
    (updater: T | ((prev: T) => T)) => {
      setPresent((prev) => {
        const next =
          typeof updater === "function"
            ? (updater as (p: T) => T)(prev)
            : updater;
        past.current.push(prev);
        future.current = [];
        rerender();
        return next;
      });
    },
    [rerender]
  );

  // 履歴に積まずに現在値だけ差し替える(ドラッグ中のプレビュー等)
  const replace = useCallback((updater: T | ((prev: T) => T)) => {
    setPresent((prev) =>
      typeof updater === "function"
        ? (updater as (p: T) => T)(prev)
        : updater
    );
  }, []);

  const undo = useCallback(() => {
    setPresent((prev) => {
      if (past.current.length === 0) return prev;
      const previous = past.current.pop() as T;
      future.current.unshift(prev);
      rerender();
      return previous;
    });
  }, [rerender]);

  const redo = useCallback(() => {
    setPresent((prev) => {
      if (future.current.length === 0) return prev;
      const next = future.current.shift() as T;
      past.current.push(prev);
      rerender();
      return next;
    });
  }, [rerender]);

  // 履歴をリセットして新しい状態を初期値にする(局面読み込み/新規作成時)
  const reset = useCallback(
    (value: T) => {
      past.current = [];
      future.current = [];
      setPresent(value);
      rerender();
    },
    [rerender]
  );

  return {
    state: present,
    set,
    replace,
    undo,
    redo,
    reset,
    canUndo: past.current.length > 0,
    canRedo: future.current.length > 0,
  };
}

import type { Board } from "./types";

// localStorage による局面の保存/読み込み。オフラインで動作する。
const STORAGE_KEY = "curling_boards_v1";

interface StoreShape {
  boards: Board[];
}

function read(): StoreShape {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { boards: [] };
    const parsed = JSON.parse(raw) as StoreShape;
    if (!parsed || !Array.isArray(parsed.boards)) return { boards: [] };
    return parsed;
  } catch {
    return { boards: [] };
  }
}

function write(store: StoreShape): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
}

export function listBoards(): Board[] {
  return read().boards.sort((a, b) =>
    b.updatedAt.localeCompare(a.updatedAt)
  );
}

// 同じ id があれば上書き、なければ追加。
export function saveBoard(board: Board): void {
  const store = read();
  const idx = store.boards.findIndex((b) => b.id === board.id);
  const toSave: Board = { ...board, updatedAt: new Date().toISOString() };
  if (idx >= 0) {
    store.boards[idx] = toSave;
  } else {
    store.boards.push(toSave);
  }
  write(store);
}

export function loadBoard(id: string): Board | undefined {
  return read().boards.find((b) => b.id === id);
}

export function deleteBoard(id: string): void {
  const store = read();
  store.boards = store.boards.filter((b) => b.id !== id);
  write(store);
}

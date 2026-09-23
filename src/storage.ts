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

// --- チーム名の履歴 ---
// 自チーム/相手を区別せず、過去に使ったチーム名を共通リストとして保持する。
const TEAM_NAMES_KEY = "curling_team_names_v1";

export function listTeamNames(): string[] {
  try {
    const raw = localStorage.getItem(TEAM_NAMES_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((v): v is string => typeof v === "string");
  } catch {
    return [];
  }
}

function writeTeamNames(names: string[]): void {
  localStorage.setItem(TEAM_NAMES_KEY, JSON.stringify(names));
}

// 名前を履歴に追加(重複は除き、最近使ったものを先頭に)。空文字は無視。
export function addTeamName(name: string): void {
  const trimmed = name.trim();
  if (!trimmed) return;
  const current = listTeamNames().filter((n) => n !== trimmed);
  writeTeamNames([trimmed, ...current].slice(0, 50));
}

export function removeTeamName(name: string): void {
  writeTeamNames(listTeamNames().filter((n) => n !== name));
}

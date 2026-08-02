import { HistoryEntry } from "./types";

const KEY = "ai-data-cleaning-agent:history";

export function getHistory(): HistoryEntry[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as HistoryEntry[]) : [];
  } catch {
    return [];
  }
}

export function addHistoryEntry(entry: HistoryEntry) {
  if (typeof window === "undefined") return;
  const current = getHistory();
  const updated = [entry, ...current].slice(0, 50);
  window.localStorage.setItem(KEY, JSON.stringify(updated));
}

export function deleteHistoryEntry(id: string) {
  if (typeof window === "undefined") return;
  const current = getHistory().filter((h) => h.id !== id);
  window.localStorage.setItem(KEY, JSON.stringify(current));
}

export function clearHistory() {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(KEY);
}

// frontend/lib/workspace.ts
// Data model for per-user workspaces.
// Settings are persisted locally (localStorage) so they survive page reloads.

// The modular agents ("tools") a user picks for a workspace.
// Only the chosen agents show in the dashboard and are available to run.
export type WorkTool =
  | "clean" // وكيل التنظيف
  | "analyze" // وكيل التحليل
  | "charts" // وكيل الرسوم البيانية
  | "reports" // وكيل التقارير
  | "merge"; // وكيل تجميع الملفات

export const ALL_TOOLS: WorkTool[] = [
  "clean",
  "analyze",
  "charts",
  "reports",
  "merge",
];

export const MAX_FILES_PER_UPLOAD = 15;

export type DeliveryMode = "manual" | "auto";

export interface DeliverySettings {
  mode: DeliveryMode;
  email?: string;
  telegram?: string;
}

export interface Workspace {
  id: string;
  name: string;
  description: string;
  createdAt: number;
  color: string; // gradient classes for the avatar
  tools: WorkTool[]; // which agents were selected for this workspace
  delivery?: DeliverySettings; // how results are delivered (manual vs auto)
}

let counter = 0;
function uid(prefix: string): string {
  counter = (counter + 1) % 1000;
  return `${prefix}_${Date.now().toString(36)}_${Math.random()
    .toString(36)
    .slice(2, 7)}_${counter}`;
}

const WS_COLORS = [
  "from-[#4f7cff] to-[#8b5cf6]",
  "from-emerald-500 to-teal-400",
  "from-sky-500 to-blue-400",
  "from-violet-500 to-fuchsia-400",
  "from-rose-500 to-pink-400",
  "from-amber-500 to-yellow-400",
];

export function workspaceColor(index: number): string {
  return WS_COLORS[index % WS_COLORS.length];
}

// ----- Persistence keys -----
const WORKSPACES_KEY = "oqzaro:ws:workspaces";
const ACTIVE_KEY = "oqzaro:ws:active";
const SETUP_KEY = "oqzaro:ws:setup";

export interface Workstate {
  workspaces: Workspace[];
  activeWorkId: string | null;
  setupDone: boolean; // whether the user created a workspace yet
}

export function readWorkstate(): Workstate {
  if (typeof window === "undefined") {
    return { workspaces: [], activeWorkId: null, setupDone: false };
  }
  try {
    const workspacesRaw = window.localStorage.getItem(WORKSPACES_KEY);
    const activeRaw = window.localStorage.getItem(ACTIVE_KEY);
    const setupRaw = window.localStorage.getItem(SETUP_KEY);

    const workspaces: Workspace[] = (
      workspacesRaw ? JSON.parse(workspacesRaw) : []
    ).map((w: Workspace) => ({
      ...w,
      tools:
        Array.isArray(w.tools) && w.tools.length ? w.tools : [...ALL_TOOLS],
    }));
    const activeWorkId =
      activeRaw && workspaces.some((w) => w.id === activeRaw)
        ? activeRaw
        : workspaces[0]?.id ?? null;

    return {
      workspaces,
      activeWorkId,
      setupDone: setupRaw === "1",
    };
  } catch {
    return { workspaces: [], activeWorkId: null, setupDone: false };
  }
}

export function writeWorkspaces(workspaces: Workspace[]) {
  try {
    window.localStorage.setItem(WORKSPACES_KEY, JSON.stringify(workspaces));
  } catch {
    // ignore
  }
}

export function writeActive(id: string | null) {
  try {
    if (id) window.localStorage.setItem(ACTIVE_KEY, id);
    else window.localStorage.removeItem(ACTIVE_KEY);
  } catch {
    // ignore
  }
}

export function markSetupDone() {
  try {
    window.localStorage.setItem(SETUP_KEY, "1");
  } catch {
    // ignore
  }
}

// ----- Workspace CRUD helpers -----
export function createWorkspace(
  workspaces: Workspace[],
  name: string,
  description: string,
  tools?: WorkTool[],
  delivery?: DeliverySettings,
): Workspace {
  const ws: Workspace = {
    id: uid("ws"),
    name: name.trim() || "مساحة عمل جديدة",
    description: description.trim(),
    createdAt: Date.now(),
    color: workspaceColor(workspaces.length),
    tools: tools && tools.length ? tools : [...ALL_TOOLS],
    delivery,
  };
  return ws;
}

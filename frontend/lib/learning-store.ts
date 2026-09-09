"use client";

/* ═══════════════════════════════════════════════════════════════
   LEARNING / MEMORY STORE
   Remembers the user's projects, working style and preferences so
   the agent can anticipate their next action without being told.
   Persists in localStorage under "oqzaro:ai:memory".
   ═══════════════════════════════════════════════════════════════ */

export interface ProjectMemory {
  id: string;
  fileName: string;
  createdAt: number;
  lastOpenedAt: number;
  rows: number;
  columns: number;
  headers: string[];
  // what the user did with this dataset
  actions: {
    type:
      | "view"
      | "edit"
      | "formula"
      | "chart"
      | "export"
      | "analyze"
      | "clean"
      | "sql";
    detail: string;
    at: number;
  }[];
  // formulas the user used/accepted
  formulasUsed: string[];
  // chart preferences
  chartPreference?: string;
}

export interface UserProfile {
  favoriteFormulas: { formula: string; count: number }[];
  preferredChartTypes: { chart: string; count: number }[];
  topColumns: { column: string; count: number }[];
  avgRowsPerProject: number;
  totalProjects: number;
  mostActiveHours: number; // 0-23
  preferredFlow: "explore-first" | "analyze-first";
  formulaForms: { form: string; count: number }[];
}

const KEY = "oqzaro:ai:memory";

const recentProjectsKey = (): ProjectMemory[] => {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem(KEY) || "[]");
  } catch {
    return [];
  }
};

const writeProjects = (projects: ProjectMemory[]) => {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(KEY, JSON.stringify(projects.slice(0, 40)));
  } catch {
    /* ignore */
  }
};

/* ─── Find a project by file name ─── */
export function findProject(fileName: string): ProjectMemory | null {
  const all = recentProjectsKey();
  return all.find((p) => p.fileName === fileName) || null;
}

/* ─── Record opening a dataset ─── */
export function rememberProject(params: {
  fileName: string;
  rows: number;
  headers: string[];
}): ProjectMemory {
  const all = recentProjectsKey();
  let project = all.find((p) => p.fileName === params.fileName);
  if (!project) {
    project = {
      id: `mem_${Date.now().toString(36)}`,
      fileName: params.fileName,
      createdAt: Date.now(),
      lastOpenedAt: Date.now(),
      rows: params.rows,
      columns: params.headers.length,
      headers: params.headers,
      actions: [],
      formulasUsed: [],
    };
    all.push(project);
  } else {
    project.lastOpenedAt = Date.now();
    project.rows = params.rows;
    project.columns = params.headers.length;
    project.headers = params.headers;
  }
  writeProjects(all);
  return project;
}

/* ─── Record an action on a dataset ─── */
export function rememberAction(
  fileName: string,
  action: ProjectMemory["actions"][0],
) {
  const all = recentProjectsKey();
  const p = all.find((x) => x.fileName === fileName);
  if (!p) return;
  p.actions = [...(p.actions || []), action].slice(-50);
  writeProjects(all);
}

/* ─── Record using a formula (with user acceptance = strong signal) ─── */
export function rememberFormula(fileName: string, formula: string) {
  const all = recentProjectsKey();
  const p = all.find((x) => x.fileName === fileName);
  if (!p) return;
  if (!p.formulasUsed.includes(formula)) p.formulasUsed.push(formula);
  writeProjects(all);
}

/* ─── Record chart type preference ─── */
export function rememberChart(fileName: string, chartType: string) {
  const all = recentProjectsKey();
  const p = all.find((x) => x.fileName === fileName);
  if (!p) return;
  p.chartPreference = chartType;
  p.actions = [
    ...(p.actions || []),
    { type: "chart" as const, detail: chartType, at: Date.now() },
  ].slice(-50);
  writeProjects(all);
}

/* ─── Build user profile from all remembered work ─── */
export function buildUserProfile(): UserProfile {
  const all = recentProjectsKey();
  const formulaCount: Record<string, number> = {};
  const chartCount: Record<string, number> = {};
  const columnCount: Record<string, number> = {};
  let totalRows = 0;

  for (const p of all) {
    totalRows += p.rows || 0;
    for (const f of p.formulasUsed || [])
      formulaCount[f] = (formulaCount[f] || 0) + 1;
    for (const h of p.headers || []) columnCount[h] = (columnCount[h] || 0) + 1;
    for (const a of p.actions || []) {
      if (a.type === "chart")
        chartCount[a.detail] = (chartCount[a.detail] || 0) + 1;
    }
  }

  return {
    favoriteFormulas: Object.entries(formulaCount)
      .map(([formula, count]) => ({ formula, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5),
    preferredChartTypes: Object.entries(chartCount)
      .map(([chart, count]) => ({ chart, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5),
    topColumns: Object.entries(columnCount)
      .map(([column, count]) => ({ column, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5),
    avgRowsPerProject: all.length && totalRows / all.length,
    totalProjects: all.length,
    mostActiveHours: new Date().getHours(),
    preferredFlow: all.length > 0 ? "analyze-first" : "explore-first",
    formulaForms: [],
  };
}

/* ─── Personalized greeting / suggestion based on memory ─── */
export function getPersonalizedHints(
  profile: UserProfile,
  headers: string[],
): { title: string; body: string; tag: string }[] {
  const hints: { title: string; body: string; tag: string }[] = [];
  if (profile.totalProjects === 0) {
    hints.push({
      title: "بداية ذكية",
      body: "هذا أول مشروع لك. سأتعلم طريقة عملك مع مرور الوقت وأقترح لك دائماً أفضل الخطوات التالية.",
      tag: "مرحبا",
    });
    return hints;
  }
  hints.push({
    title: "أهلاً بعودتك 👋",
    body: `رأيت أنك عملت على ${profile.totalProjects} مشروع سابقاً بمتوسط ${Math.round(profile.avgRowsPerProject).toLocaleString()} صف لكل مشروع. سآخذ ذلك في الاعتبار.`,
    tag: "ذاكرة",
  });
  if (profile.favoriteFormulas.length > 0) {
    hints.push({
      title: "معادلاتك المفضلة",
      body: `أكثر ما تستخدمه: ${profile.favoriteFormulas.map((f) => `"${f.formula}"`).join("، ")}. جاهز لإدراجها بنقرة واحدة.`,
      tag: "اقتراح",
    });
  }
  // Match columns
  const shared = headers.filter((h) =>
    profile.topColumns.some((c) => c.column === h),
  );
  if (shared.length > 0) {
    hints.push({
      title: "أعمدة مألوفة",
      body: `لاحظت أنك تعمل على أعمدة مشابهة لمشاريعك السابقة: ${shared.slice(0, 3).join("، ")}. سأركّز التحليل عليها.`,
      tag: "تعلّم",
    });
  }
  return hints;
}

export function clearAllMemory() {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}

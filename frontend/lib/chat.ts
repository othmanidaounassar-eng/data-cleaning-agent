// Shared helpers for the agent chat context (frontend/lib/chat.ts)

export interface ChatContextLogEntry {
  action?: string;
  description?: string;
  details?: string;
  status?: string;
}

export interface ChatContext {
  file_name?: string;
  rows_before?: number;
  rows_after?: number;
  duplicates_removed?: number;
  missing_values_filled?: number;
  outliers_detected?: number;
  quality_score?: number;
  summary?: string;
  recommendations?: string[];
  alerts?: string[];
  column_data_types?: Record<string, string>;
  cleaning_log?: ChatContextLogEntry[];
  sample?: Array<Record<string, unknown>>;
}

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

const STORAGE_KEY = "oqzaro:chat_context";

export function saveChatContext(ctx: ChatContext) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(ctx));
  } catch (error) {
    console.warn("Failed to save chat context:", error);
  }
}

export function loadChatContext(): ChatContext | null {
  try {
    const data = localStorage.getItem(STORAGE_KEY);
    if (!data) return null;
    return JSON.parse(data) as ChatContext;
  } catch {
    return null;
  }
}

export function clearChatContext() {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}

export const SUGGESTED_PROMPTS: string[] = [
  "ما رأيك في جودة بياناتي؟",
  "ما العمليات التي تم تنفيذها ولماذا؟",
  "هل هناك أعمدة تحتاج تحسيناً إضافياً؟",
  "كيف يمكنني حماية نفسي من القيم الشاذة؟",
];

const SUGGESTED_EN: string[] = [
  "What do you think of my data quality?",
  "What operations were performed and why?",
  "Are there columns that need more improvement?",
  "How can I protect against outliers?",
];

const SUGGESTED_FR: string[] = [
  "Que pensez-vous de la qualité de mes données ?",
  "Quelles opérations ont été effectuées et pourquoi ?",
  "Y a-t-il des colonnes à améliorer davantage ?",
  "Comment me protéger contre les valeurs aberrantes ?",
];

export function suggestedPrompts(lang: string): string[] {
  if (lang === "ar") return SUGGESTED_PROMPTS;
  if (lang === "fr") return SUGGESTED_FR;
  return SUGGESTED_EN;
}

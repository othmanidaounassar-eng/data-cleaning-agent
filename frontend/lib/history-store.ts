import { HistoryEntry } from "@/lib/types";

const STORAGE_KEY = "ai-data-cleaning-agent:history";
const MAX_HISTORY_ITEMS = 20; // الحد الأقصى لعدد العناصر المخزنة

// استرجاع التاريخ من localStorage
export function getHistory(): HistoryEntry[] {
  try {
    const data = localStorage.getItem(STORAGE_KEY);
    if (!data) return [];
    return JSON.parse(data);
  } catch {
    return [];
  }
}

// حفظ التاريخ مع التحكم في الحجم
export function saveHistory(history: HistoryEntry[]) {
  try {
    // الاحتفاظ بآخر MAX_HISTORY_ITEMS فقط
    const trimmed = history.slice(0, MAX_HISTORY_ITEMS);

    // تنظيف البيانات من الحقول الكبيرة قبل التخزين
    const dataToStore = trimmed.map((entry) => ({
      ...entry,
      report: {
        ...entry.report,
        sample: [], // تجاهل العينة الكبيرة
        alerts: [], // تجاهل التنبيهات
        // احتفظ فقط بالبيانات الأساسية
      },
    }));

    localStorage.setItem(STORAGE_KEY, JSON.stringify(dataToStore));
  } catch (error) {
    // إذا فشل التخزين (QuotaExceededError)، احذف نصف العناصر وحاول مرة أخرى
    console.warn("Storage quota exceeded, clearing old history...");
    const current = getHistory();
    const reduced = current.slice(0, Math.floor(current.length / 2));
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(reduced));
    } catch {
      // إذا فشل حتى بعد التخفيض، احذف الكل
      localStorage.removeItem(STORAGE_KEY);
    }
  }
}

// إضافة إدخال جديد إلى التاريخ
export function addHistoryEntry(entry: HistoryEntry) {
  const history = getHistory();
  // إزالة أي إدخال مكرر (نفس id)
  const filtered = history.filter((item) => item.id !== entry.id);
  // إضافة الإدخال الجديد في البداية
  const updated = [entry, ...filtered];
  saveHistory(updated);
}

// حذف إدخال من التاريخ
export function deleteHistoryEntry(id: string) {
  const history = getHistory();
  const filtered = history.filter((item) => item.id !== id);
  saveHistory(filtered);
}

// مسح التاريخ بالكامل
export function clearHistory() {
  localStorage.removeItem(STORAGE_KEY);
}

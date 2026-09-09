// frontend/lib/scheduler.ts
// Client-side scheduled reports: persist schedules in localStorage and
// provide a small hook to run them while the dashboard is open. Delivery
// preferences (email / telegram) live on the workspace (see workspace.ts).

export type ScheduleFrequency = "daily" | "weekly" | "monthly";

export interface ScheduledReport {
  id: string;
  workspaceId: string;
  name: string;
  frequency: ScheduleFrequency;
  format: "excel" | "ppt" | "pdf";
  email?: string;
  telegram?: string;
  createdAt: number;
  nextRunAt: number;
}

export type ScheduleInput = Omit<
  ScheduledReport,
  "id" | "createdAt" | "nextRunAt"
>;

const SCHED_KEY = "oqzaro:sched:reports";

function uid(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random()
    .toString(36)
    .slice(2, 8)}`;
}

export function nextRunFor(frequency: ScheduleFrequency, from: number): number {
  const d = new Date(from);
  switch (frequency) {
    case "daily":
      return d.setDate(d.getDate() + 1);
    case "weekly":
      return d.setDate(d.getDate() + 7);
    case "monthly":
      return d.setTime(d.getTime() + 30 * 24 * 60 * 60 * 1000);
  }
}

export function readScheduled(): ScheduledReport[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(SCHED_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function writeScheduled(items: ScheduledReport[]) {
  try {
    window.localStorage.setItem(SCHED_KEY, JSON.stringify(items));
  } catch {
    // ignore storage failures (private mode etc.)
  }
}

export function addSchedule(input: ScheduleInput): ScheduledReport {
  const item: ScheduledReport = {
    ...input,
    id: uid("sched"),
    createdAt: Date.now(),
    nextRunAt: nextRunFor(input.frequency, Date.now()),
  };
  writeScheduled([...readScheduled(), item]);
  return item;
}

export function removeSchedule(id: string) {
  writeScheduled(readScheduled().filter((s) => s.id !== id));
}

export function postponeSchedule(id: string) {
  writeScheduled(
    readScheduled().map((s) =>
      s.id === id
        ? { ...s, nextRunAt: nextRunFor(s.frequency, Date.now()) }
        : s,
    ),
  );
}

export function frequencyLabelKey(frequency: ScheduleFrequency): string {
  switch (frequency) {
    case "daily":
      return "sched.daily";
    case "weekly":
      return "sched.weekly";
    case "monthly":
      return "sched.monthly";
  }
}

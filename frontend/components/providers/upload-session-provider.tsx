"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

export type UploadStatus =
  | "idle"
  | "selected"
  | "analyzing"
  | "cleaning"
  | "accepted"
  | "rejected";

export interface FileMeta {
  name: string;
  size: number;
}

export interface UploadJob {
  jobId: string;
  files: FileMeta[];
  mode: "auto" | "manual" | "full";
  progress: number; // 0-100
  currentIndex: number;
  total: number;
  running: boolean;
}

interface UploadSession {
  status: UploadStatus;
  meta: FileMeta | null;
  error: string | null;
  fileRef: File | null;
  jobs: UploadJob[];
  setFile: (file: File | null) => void;
  setStatus: (status: UploadStatus, error?: string | null) => void;
  setError: (error: string | null) => void;
  updateJob: (job: UploadJob) => void;
  clear: () => void;
}

const META_KEY = "oqzaro:upload:meta";
const STATUS_KEY = "oqzaro:upload:status";
const PROGRESS_KEY = "oqzaro:upload:progress";

const UploadSessionContext = createContext<UploadSession | null>(null);

// The File object cannot be stored in localStorage (too large / not
// serializable), so we keep it in module scope. It survives client-side
// navigation between dashboard pages but not a full page reload.
let moduleFile: File | null = null;
let moduleJobs: UploadJob[] = [];

function readMeta(): FileMeta | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(META_KEY);
    return raw ? (JSON.parse(raw) as FileMeta) : null;
  } catch {
    return null;
  }
}

function readStatus(): UploadStatus {
  if (typeof window === "undefined") return "idle";
  try {
    const raw = window.localStorage.getItem(STATUS_KEY);
    return (raw as UploadStatus) || "idle";
  } catch {
    return "idle";
  }
}

function readProgress(): number {
  if (typeof window === "undefined") return 0;
  try {
    const raw = window.localStorage.getItem(PROGRESS_KEY);
    return raw ? Number(raw) : 0;
  } catch {
    return 0;
  }
}

export function UploadSessionProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [status, setStatus] = useState<UploadStatus>("idle");
  const [meta, setMeta] = useState<FileMeta | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [jobs, setJobs] = useState<UploadJob[]>(moduleJobs);
  const init = useRef(false);

  useEffect(() => {
    if (!init.current) {
      init.current = true;
      setMeta(readMeta());
      setStatus(readStatus());
    }
    // When we reload the page the File is gone; if a file was selected but
    // there is no module File available, downgrade to "selected".
    if (!moduleFile && readMeta()) {
      setStatus((s) => (s === "accepted" || s === "rejected" ? s : "selected"));
    }
  }, []);

  const setFile = useCallback((file: File | null) => {
    moduleFile = file;
    if (file) {
      const m = { name: file.name, size: file.size };
      setMeta(m);
      setStatus("selected");
      setError(null);
      try {
        window.localStorage.setItem(META_KEY, JSON.stringify(m));
        window.localStorage.setItem(STATUS_KEY, "selected");
      } catch {
        // ignore
      }
    } else {
      setMeta(null);
      setStatus("idle");
      setError(null);
      try {
        window.localStorage.removeItem(META_KEY);
        window.localStorage.removeItem(STATUS_KEY);
      } catch {
        // ignore
      }
    }
  }, []);

  const setStatusCb = useCallback((next: UploadStatus, err?: string | null) => {
    setStatus(next);
    if (err !== undefined) setError(err);
    try {
      window.localStorage.setItem(STATUS_KEY, next);
    } catch {
      // ignore
    }
  }, []);

  const setErrorCb = useCallback((err: string | null) => {
    setError(err);
    if (err) setStatus("rejected");
  }, []);

  const updateJob = useCallback((job: UploadJob) => {
    moduleJobs = moduleJobs.filter((j) => j.jobId !== job.jobId);
    moduleJobs = [job, ...moduleJobs];
    setJobs(moduleJobs);
    try {
      window.localStorage.setItem(PROGRESS_KEY, String(job.progress));
    } catch {
      // ignore
    }
  }, []);

  const clear = useCallback(() => {
    moduleFile = null;
    moduleJobs = [];
    setMeta(null);
    setStatus("idle");
    setError(null);
    setJobs([]);
    try {
      window.localStorage.removeItem(META_KEY);
      window.localStorage.removeItem(STATUS_KEY);
      window.localStorage.removeItem(PROGRESS_KEY);
    } catch {
      // ignore
    }
  }, []);

  const value = useMemo<UploadSession>(
    () => ({
      status,
      meta,
      error,
      fileRef: moduleFile,
      jobs,
      setFile,
      setStatus: setStatusCb,
      setError: setErrorCb,
      updateJob,
      clear,
    }),
    [
      status,
      meta,
      error,
      jobs,
      setFile,
      setStatusCb,
      setErrorCb,
      updateJob,
      clear,
    ],
  );

  return (
    <UploadSessionContext.Provider value={value}>
      {children}
    </UploadSessionContext.Provider>
  );
}

export function useUploadSession(): UploadSession {
  const ctx = useContext(UploadSessionContext);
  if (!ctx) {
    throw new Error(
      "useUploadSession must be used within <UploadSessionProvider>",
    );
  }
  return ctx;
}

export { readProgress };

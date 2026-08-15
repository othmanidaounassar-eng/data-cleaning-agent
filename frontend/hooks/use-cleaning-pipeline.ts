"use client";

import { useCallback, useRef, useState } from "react";
import {
  DatasetInfo,
  PipelineStep,
  PipelineStepId,
  ValidationResult,
  CleaningReport,
} from "@/lib/types";
import {
  getFileKind,
  validateFileBasics,
  validateParsedData,
} from "@/lib/validate-file";
import { parseFile } from "@/lib/parse-file";
import {
  uploadDatasetToBackend,
  ApiError,
  apiErrorTitle,
} from "@/lib/api-client";
import { adaptBackendReport } from "@/lib/adapt-backend-report";
import { addHistoryEntry } from "@/lib/history-store";
import { uid } from "@/lib/utils";

const STEP_DEFS: { id: PipelineStepId; label: string }[] = [
  { id: "missingValues", label: "Missing Values" },
  { id: "duplicates", label: "Duplicates" },
  { id: "whitespace", label: "Whitespace" },
  { id: "specialCharacters", label: "Special Characters" },
  { id: "dataTypes", label: "Data Types" },
  { id: "outliers", label: "Outliers" },
  { id: "validation", label: "Validation" },
  { id: "finalReport", label: "Final Report" },
];

// The last real pipeline step ("Final Report") only completes once the
// backend actually responds — the other seven track upload progress so the
// visualization stays honest about what's actually happening.
const PROGRESS_STEP_COUNT = STEP_DEFS.length - 1;

export type Phase =
  "idle" | "validating" | "invalid" | "uploading" | "error" | "done";

export interface UploadErrorInfo {
  title: string;
  message: string;
  kind: ApiError["kind"];
}

export function useCleaningPipeline() {
  const [phase, setPhase] = useState<Phase>("idle");
  const [validation, setValidation] = useState<ValidationResult | null>(null);
  const [datasetInfo, setDatasetInfo] = useState<DatasetInfo | null>(null);
  const [steps, setSteps] = useState<PipelineStep[]>(
    STEP_DEFS.map((s) => ({ ...s, status: "waiting" as const })),
  );
  const [uploadProgress, setUploadProgress] = useState(0);
  const [report, setReport] = useState<CleaningReport | null>(null);
  const [uploadError, setUploadError] = useState<UploadErrorInfo | null>(null);

  const lastFile = useRef<File | null>(null);
  const abortController = useRef<AbortController | null>(null);

  const setStepsFromProgress = useCallback((percent: number) => {
    const completedCount = Math.min(
      PROGRESS_STEP_COUNT,
      Math.floor((percent / 100) * PROGRESS_STEP_COUNT),
    );
    setSteps((prev) =>
      prev.map((s, i) => {
        if (s.id === "finalReport") return s;
        if (i < completedCount) return { ...s, status: "completed" };
        if (i === completedCount) return { ...s, status: "running" };
        return { ...s, status: "waiting" };
      }),
    );
  }, []);

  const reset = useCallback(() => {
    setPhase("idle");
    setValidation(null);
    setDatasetInfo(null);
    setReport(null);
    setUploadProgress(0);
    setUploadError(null);
    setSteps(STEP_DEFS.map((s) => ({ ...s, status: "waiting" as const })));
  }, []);

  const runUpload = useCallback(
    async (file: File) => {
      setPhase("uploading");
      setUploadProgress(0);
      setSteps(STEP_DEFS.map((s) => ({ ...s, status: "waiting" as const })));

      abortController.current = new AbortController();

      try {
        const raw = await uploadDatasetToBackend(file, {
          onProgress: (percent) => {
            setUploadProgress(percent);
            setStepsFromProgress(percent);
          },
          signal: abortController.current.signal,
        });

        setSteps((prev) =>
          prev.map((s) =>
            s.id === "finalReport"
              ? { ...s, status: "running" }
              : { ...s, status: "completed" },
          ),
        );

        const adapted = adaptBackendReport(raw, file.name);

        setSteps((prev) =>
          prev.map((s) => ({ ...s, status: "completed" as const })),
        );
        setReport(adapted);

        addHistoryEntry({
          id: uid(),
          originalFileName: file.name,
          cleanedFileName: adapted.cleanedFileName,
          cleaningDate: adapted.cleaningDate,
          processingTimeMs: adapted.stats.processingTimeMs,
          qualityScore: adapted.stats.qualityScore,
          report: adapted,
          cleanedRows: [],
          columns: [],
        });

        setPhase("done");
      } catch (err) {
        setSteps((prev) =>
          prev.map((s) =>
            s.status === "running" ? { ...s, status: "error" } : s,
          ),
        );

        if (err instanceof ApiError) {
          if (err.kind === "aborted") {
            setPhase("idle");
            return;
          }
          setUploadError({
            title: apiErrorTitle(err.kind),
            message: err.message,
            kind: err.kind,
          });
        } else {
          setUploadError({
            title: "Unexpected Error",
            message:
              err instanceof Error
                ? err.message
                : "Something went wrong during upload.",
            kind: "server",
          });
        }
        setPhase("error");
      }
    },
    [setStepsFromProgress],
  );

  const processFile = useCallback(
    async (file: File) => {
      reset();
      setPhase("validating");
      lastFile.current = file;

      const basics = validateFileBasics(file);
      if (!basics.valid) {
        setValidation(basics);
        setPhase("invalid");
        return;
      }

      const kind = getFileKind(file.name)!;

      // Parsed client-side purely to populate the Dataset Information card —
      // the raw file (not this parsed data) is what actually gets uploaded.
      try {
        const parsed = await parseFile(file, kind);
        const fullValidation = validateParsedData(
          parsed.headers,
          parsed.rows.length,
          parsed.encoding,
          basics.checks,
        );
        setValidation(fullValidation);

        if (!fullValidation.valid) {
          setPhase("invalid");
          return;
        }

        setDatasetInfo({
          fileName: file.name,
          fileKind: kind,
          sizeBytes: file.size,
          uploadedAt: new Date().toISOString(),
          rows: parsed.rows.length,
          columns: parsed.headers.length,
          encoding: parsed.encoding,
        });
      } catch {
        // If local parsing fails we still let the backend try — it may
        // handle encodings or formats the browser parser doesn't.
        setDatasetInfo({
          fileName: file.name,
          fileKind: kind,
          sizeBytes: file.size,
          uploadedAt: new Date().toISOString(),
          rows: 0,
          columns: 0,
          encoding: "Unknown (validated server-side)",
        });
      }

      await runUpload(file);
    },
    [reset, runUpload],
  );

  const retry = useCallback(() => {
    if (lastFile.current) {
      void runUpload(lastFile.current);
    }
  }, [runUpload]);

  const cancel = useCallback(() => {
    abortController.current?.abort();
  }, []);

  return {
    phase,
    validation,
    datasetInfo,
    steps,
    uploadProgress,
    report,
    uploadError,
    processFile,
    retry,
    cancel,
    reset,
  };
}

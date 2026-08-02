"use client";

import { AnimatePresence, motion } from "framer-motion";
import { RotateCcw, X } from "lucide-react";
import { Topbar } from "@/components/dashboard/topbar";
import { Dropzone } from "@/components/upload/dropzone";
import { ValidationDashboard, DatasetInfoCard } from "@/components/upload/dataset-info-card";
import { CleaningPipeline } from "@/components/upload/cleaning-pipeline";
import { CleaningResultStats, AiReportCard } from "@/components/upload/cleaning-report";
import { DownloadSection } from "@/components/upload/download-section";
import { UploadErrorState } from "@/components/upload/error-state";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { useCleaningPipeline } from "@/hooks/use-cleaning-pipeline";

export default function UploadPage() {
  const {
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
  } = useCleaningPipeline();

  const showPipelineArea =
    (phase === "uploading" || phase === "done" || phase === "error") && datasetInfo;

  return (
    <>
      <Topbar title="Upload Dataset" subtitle="CSV and Excel files are validated and cleaned by the AI Agent backend." />

      <main className="p-6 max-w-4xl mx-auto space-y-6">
        {(phase === "idle" || phase === "validating") && (
          <Dropzone onFile={processFile} validationError={null} />
        )}

        {phase === "invalid" && validation && (
          <>
            <Dropzone onFile={processFile} validationError={validation} />
            {validation.checks.length > 0 && <ValidationDashboard result={validation} />}
          </>
        )}

        <AnimatePresence>
          {showPipelineArea && (
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-6"
            >
              <div className="flex items-center justify-between">
                <p className="text-xs text-ink-500">
                  {phase === "uploading" ? "Uploading & cleaning" : "Processed"}{" "}
                  <span className="text-ink-100 font-medium">{datasetInfo!.fileName}</span>
                </p>
                {phase === "uploading" ? (
                  <Button variant="ghost" size="sm" onClick={cancel}>
                    <X className="h-3.5 w-3.5" />
                    Cancel
                  </Button>
                ) : (
                  <Button variant="ghost" size="sm" onClick={reset}>
                    <RotateCcw className="h-3.5 w-3.5" />
                    Start over
                  </Button>
                )}
              </div>

              <DatasetInfoCard info={datasetInfo!} />

              {phase === "uploading" && (
                <Card>
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-xs font-medium text-ink-300">Uploading to cleaning service…</p>
                    <p className="text-xs font-mono text-ink-500 tabular-nums">{uploadProgress}%</p>
                  </div>
                  <Progress value={uploadProgress} />
                </Card>
              )}

              {phase !== "error" && <CleaningPipeline steps={steps} />}

              {phase === "error" && uploadError && (
                <UploadErrorState
                  title={uploadError.title}
                  message={uploadError.message}
                  kind={uploadError.kind === "aborted" ? "server" : uploadError.kind}
                  onRetry={retry}
                />
              )}

              {phase === "done" && report && (
                <motion.div
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.15 }}
                  className="space-y-6"
                >
                  <CleaningResultStats report={report} />
                  <AiReportCard report={report} />
                  <DownloadSection report={report} headers={[]} rows={[]} />
                </motion.div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </>
  );
}

"use client";

import { motion, AnimatePresence } from "framer-motion";
import {
  Droplets,
  Copy,
  Eraser,
  Hash,
  Binary,
  TrendingUp,
  ShieldCheck,
  FileCheck2,
  Loader2,
  Check,
  X,
} from "lucide-react";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { PipelineStep } from "@/lib/types";
import { cn } from "@/lib/utils";

const ICONS = {
  missingValues: Droplets,
  duplicates: Copy,
  whitespace: Eraser,
  specialCharacters: Hash,
  dataTypes: Binary,
  outliers: TrendingUp,
  validation: ShieldCheck,
  finalReport: FileCheck2,
};

export function CleaningPipeline({ steps }: { steps: PipelineStep[] }) {
  const completedCount = steps.filter((s) => s.status === "completed").length;

  return (
    <Card>
      <CardHeader>
        <div>
          <CardTitle>Cleaning pipeline</CardTitle>
          <CardDescription>
            {completedCount} of {steps.length} stages complete
          </CardDescription>
        </div>
      </CardHeader>

      {/* Flow line */}
      <div className="relative mb-6 hidden sm:block">
        <svg width="100%" height="4" className="overflow-visible">
          <line
            x1="0"
            y1="2"
            x2="100%"
            y2="2"
            stroke="rgba(255,255,255,0.08)"
            strokeWidth="2"
          />
          <motion.line
            x1="0"
            y1="2"
            x2="100%"
            y2="2"
            stroke="url(#flowGradient)"
            strokeWidth="2"
            strokeDasharray="6 6"
            initial={{ pathLength: 0 }}
            animate={{ pathLength: completedCount / steps.length }}
            transition={{ duration: 0.6, ease: "easeInOut" }}
            className="animate-flow-dash"
          />
          <defs>
            <linearGradient id="flowGradient" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="#4F7CFF" />
              <stop offset="100%" stopColor="#8B5CF6" />
            </linearGradient>
          </defs>
        </svg>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {steps.map((step, i) => {
          const Icon = ICONS[step.id];
          return (
            <motion.div
              key={step.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.03 }}
              className={cn(
                "relative flex flex-col items-center gap-2 rounded-xl2 border px-3 py-4 text-center transition-colors duration-300",
                step.status === "completed" &&
                  "border-signal-good/25 bg-signal-good/[0.05]",
                step.status === "running" &&
                  "border-accent-blue/40 bg-accent-blue/[0.06]",
                step.status === "error" &&
                  "border-signal-bad/30 bg-signal-bad/[0.06]",
                step.status === "waiting" &&
                  "border-white/[0.05] bg-white/[0.02]",
              )}
            >
              <div
                className={cn(
                  "flex h-9 w-9 items-center justify-center rounded-xl",
                  step.status === "completed" && "bg-signal-good/15",
                  step.status === "running" && "bg-accent-blue/15",
                  step.status === "error" && "bg-signal-bad/15",
                  step.status === "waiting" && "bg-white/[0.04]",
                )}
              >
                <AnimatePresence mode="wait">
                  {step.status === "running" ? (
                    <motion.div
                      key="loader"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                    >
                      <Loader2 className="h-4 w-4 text-accent-blue animate-spin" />
                    </motion.div>
                  ) : step.status === "completed" ? (
                    <motion.div
                      key="check"
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                    >
                      <Check className="h-4 w-4 text-signal-good" />
                    </motion.div>
                  ) : step.status === "error" ? (
                    <motion.div
                      key="x"
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                    >
                      <X className="h-4 w-4 text-signal-bad" />
                    </motion.div>
                  ) : (
                    <Icon className="h-4 w-4 text-ink-500" />
                  )}
                </AnimatePresence>
              </div>
              <span
                className={cn(
                  "text-[11px] font-medium leading-tight",
                  step.status === "waiting" ? "text-ink-500" : "text-ink-100",
                )}
              >
                {step.label}
              </span>
            </motion.div>
          );
        })}
      </div>
    </Card>
  );
}

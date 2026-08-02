"use client";

import Link from "next/link";
import { Files, Clock, CopyX, ShieldCheck, ArrowUpRight } from "lucide-react";
import { Topbar } from "@/components/dashboard/topbar";
import { StatCard } from "@/components/dashboard/stat-card";
import {
  FilesProcessedChart,
  IssuesPieChart,
  CleaningVolumeBarChart,
} from "@/components/dashboard/charts";
import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

const filesData = [
  { day: "Mon", files: 4 },
  { day: "Tue", files: 7 },
  { day: "Wed", files: 5 },
  { day: "Thu", files: 9 },
  { day: "Fri", files: 12 },
  { day: "Sat", files: 6 },
  { day: "Sun", files: 8 },
];

const issuesData = [
  { name: "Missing values", value: 42 },
  { name: "Duplicates", value: 18 },
  { name: "Outliers", value: 9 },
  { name: "Type mismatches", value: 14 },
];

const volumeData = [
  { day: "Mon", duplicates: 3, missing: 12 },
  { day: "Tue", duplicates: 5, missing: 8 },
  { day: "Wed", duplicates: 2, missing: 14 },
  { day: "Thu", duplicates: 7, missing: 6 },
  { day: "Fri", duplicates: 4, missing: 10 },
];

export default function DashboardPage() {
  return (
    <>
      <Topbar title="AI Data Cleaning Agent" subtitle="Automatically clean your datasets before analysis." />

      <main className="p-6 space-y-6">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 glass rounded-xl2 p-6 bg-grad-radial-glow">
          <div>
            <p className="text-xs font-medium text-accent-blue mb-2">Ready when you are</p>
            <h2 className="font-display text-2xl font-semibold text-ink-100 max-w-lg">
              Upload a dataset and the agent handles validation, cleaning, and reporting end to end.
            </h2>
            <p className="text-sm text-ink-500 mt-2 max-w-md">
              CSV and Excel supported. Nothing leaves your browser during processing.
            </p>
          </div>
          <Link href="/dashboard/upload">
            <Button size="lg" className="whitespace-nowrap">
              Upload Dataset
              <ArrowUpRight className="h-4 w-4" />
            </Button>
          </Link>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          <StatCard label="Files Processed" value="146" icon={Files} trend="+12 this week" tone="good" />
          <StatCard label="Avg. Cleaning Time" value="2.4s" icon={Clock} trend="−0.3s vs last week" tone="good" />
          <StatCard label="Duplicates Removed" value="1,208" icon={CopyX} trend="Across all datasets" />
          <StatCard label="Avg. Quality Score" value="94/100" icon={ShieldCheck} trend="Enterprise-ready" tone="good" />
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
          <Card className="xl:col-span-2">
            <CardHeader>
              <div>
                <CardTitle>Files processed</CardTitle>
                <CardDescription>Last 7 days</CardDescription>
              </div>
            </CardHeader>
            <FilesProcessedChart data={filesData} />
          </Card>

          <Card>
            <CardHeader>
              <div>
                <CardTitle>Issue breakdown</CardTitle>
                <CardDescription>Across all cleaned datasets</CardDescription>
              </div>
            </CardHeader>
            <IssuesPieChart data={issuesData} />
          </Card>
        </div>

        <Card>
          <CardHeader>
            <div>
              <CardTitle>Cleaning volume</CardTitle>
              <CardDescription>Duplicates vs. missing values fixed per day</CardDescription>
            </div>
          </CardHeader>
          <CleaningVolumeBarChart data={volumeData} />
        </Card>
      </main>
    </>
  );
}

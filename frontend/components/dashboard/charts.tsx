"use client";

import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
} from "recharts";

const tooltipStyle = {
  background: "#10141F",
  border: "1px solid rgba(255,255,255,0.08)",
  borderRadius: 12,
  fontSize: 12,
  color: "#EDEFF5",
};

export function FilesProcessedChart({
  data,
}: {
  data: { day: string; files: number }[];
}) {
  return (
    <ResponsiveContainer width="100%" height={220}>
      <AreaChart data={data}>
        <defs>
          <linearGradient id="filesGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#4F7CFF" stopOpacity={0.45} />
            <stop offset="100%" stopColor="#4F7CFF" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
        <XAxis dataKey="day" tick={{ fill: "#8891A5", fontSize: 11 }} axisLine={false} tickLine={false} />
        <YAxis tick={{ fill: "#8891A5", fontSize: 11 }} axisLine={false} tickLine={false} width={28} />
        <Tooltip contentStyle={tooltipStyle} />
        <Area type="monotone" dataKey="files" stroke="#4F7CFF" strokeWidth={2} fill="url(#filesGradient)" />
      </AreaChart>
    </ResponsiveContainer>
  );
}

const PIE_COLORS = ["#4F7CFF", "#8B5CF6", "#34D399", "#F5A623"];

export function IssuesPieChart({
  data,
}: {
  data: { name: string; value: number }[];
}) {
  return (
    <ResponsiveContainer width="100%" height={220}>
      <PieChart>
        <Pie
          data={data}
          dataKey="value"
          nameKey="name"
          innerRadius={55}
          outerRadius={85}
          paddingAngle={3}
        >
          {data.map((_, i) => (
            <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} stroke="transparent" />
          ))}
        </Pie>
        <Tooltip contentStyle={tooltipStyle} />
      </PieChart>
    </ResponsiveContainer>
  );
}

export function CleaningVolumeBarChart({
  data,
}: {
  data: { day: string; duplicates: number; missing: number }[];
}) {
  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={data}>
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
        <XAxis dataKey="day" tick={{ fill: "#8891A5", fontSize: 11 }} axisLine={false} tickLine={false} />
        <YAxis tick={{ fill: "#8891A5", fontSize: 11 }} axisLine={false} tickLine={false} width={28} />
        <Tooltip contentStyle={tooltipStyle} cursor={{ fill: "rgba(255,255,255,0.03)" }} />
        <Bar dataKey="duplicates" stackId="a" fill="#4F7CFF" radius={[4, 4, 0, 0]} />
        <Bar dataKey="missing" stackId="a" fill="#8B5CF6" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

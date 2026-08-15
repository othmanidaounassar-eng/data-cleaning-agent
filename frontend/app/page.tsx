"use client";

import { useState } from "react";
import Link from "next/link";
import { UploadCloud, Download, FileText } from "lucide-react";
import { API_BASE } from "@/lib/api";

export default function UploadPage() {
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState("");

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
    }
  };

  const handleUpload = async () => {
    if (!file) return;
    setLoading(true);
    setError("");
    setResult(null);

    try {
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch(`${API_BASE}/clean`, {
        method: "POST",
        body: formData,
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Upload failed");
      setResult(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-dark-blue-900 p-6">
      <div className="max-w-4xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold text-white">Upload & Clean</h1>
          <Link href="/" className="text-orange-500 hover:underline">← Back Home</Link>
        </div>

        <div className="bg-dark-blue-800 p-8 rounded-lg border border-orange-500/20">
          <div className="border-2 border-dashed border-orange-500/40 rounded-lg p-12 text-center">
            <UploadCloud className="w-16 h-16 text-orange-500 mx-auto mb-4" />
            <p className="text-white text-lg mb-2">Drag & drop your file here</p>
            <p className="text-white/60 text-sm mb-4">or click to browse</p>
            <input
              type="file"
              id="fileInput"
              className="hidden"
              onChange={handleFileChange}
              accept=".csv,.xlsx,.xls"
            />
            <label
              htmlFor="fileInput"
              className="bg-orange-500 hover:bg-orange-600 text-white px-6 py-2 rounded-lg cursor-pointer transition inline-block"
            >
              Choose File
            </label>
            {file && (
              <p className="text-white/80 mt-4">Selected: {file.name} ({(file.size / 1024).toFixed(1)} KB)</p>
            )}
          </div>

          <button
            onClick={handleUpload}
            disabled={!file || loading}
            className="w-full bg-orange-500 hover:bg-orange-600 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold py-3 px-6 rounded-lg mt-6 transition"
          >
            {loading ? "Cleaning..." : "Upload & Clean"}
          </button>

          {error && (
            <div className="bg-red-500/10 text-red-400 p-4 rounded-lg mt-6 border border-red-500/20">
              {error}
            </div>
          )}

          {result && (
            <div className="mt-8 bg-dark-blue-900 p-6 rounded-lg border border-orange-500/20">
              <h2 className="text-xl font-bold text-white mb-4">Cleaning Report</h2>
              <div className="grid grid-cols-2 gap-4 text-white/80">
                <div>Rows Before: {result.rows_before}</div>
                <div>Rows After: {result.rows_after}</div>
                <div>Duplicates Removed: {result.duplicates_removed}</div>
                <div>Missing Values Filled: {result.missing_values_filled}</div>
              </div>
              {result.download_url && (
                <div className="mt-6 flex gap-4">
                  <a
                    href={result.download_url}
                    download
                    className="bg-orange-500 hover:bg-orange-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 transition"
                  >
                    <Download className="w-4 h-4" /> Download Cleaned File
                  </a>
                  <button className="border border-orange-500 text-orange-500 hover:bg-orange-500/10 px-4 py-2 rounded-lg flex items-center gap-2 transition">
                    <FileText className="w-4 h-4" /> Download Report
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
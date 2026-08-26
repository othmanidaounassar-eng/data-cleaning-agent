"use client";

import { useState } from "react";
import Link from "next/link";
import { UploadCloud, Download, FileText, Loader2 } from "lucide-react";
import { API_ENDPOINTS } from "@/lib/api";

// ============================================
// ✅ تعريف الواجهة الكاملة للنتيجة (بدون any)
// ============================================
interface CleaningResult {
  rows_before: number;
  rows_after: number;
  duplicates_removed: number;
  missing_values_filled: number;
  outliers_detected?: number;
  quality_score?: number;
  execution_time_seconds?: number;
  download_url?: string;
  cleaned_file_name?: string;
  cleaning_log?: Array<{
    action: string;
    description: string;
    details: string;
    rows_affected: number;
    status: "completed" | "skipped";
  }>;
  ai_explanation?: string;
  alerts?: string[];
  recommendations?: string[];
  summary?: string;
  // ✅ تم استبدال any[] بنوع أكثر تحديداً
  sample?: Array<Record<string, unknown>>;
  column_data_types?: Record<string, string>;
}

export default function UploadPage() {
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<CleaningResult | null>(null);
  const [error, setError] = useState("");
  const [progress, setProgress] = useState(0);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const selectedFile = e.target.files[0];
      setFile(selectedFile);
      setError("");
      setResult(null);
      console.log(
        "📁 File selected:",
        selectedFile.name,
        selectedFile.size,
        "bytes",
      );
    }
  };

  const handleUpload = async () => {
    if (!file) {
      setError("Please select a file first.");
      return;
    }

    setLoading(true);
    setError("");
    setResult(null);
    setProgress(0);

    try {
      const formData = new FormData();
      formData.append("file", file);

      const url = API_ENDPOINTS.UPLOAD;
      console.log("🔍 Sending request to proxy:", url);
      console.log("📁 File:", file.name, file.size, "bytes");

      const xhr = new XMLHttpRequest();
      xhr.open("POST", url, true);

      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable) {
          const percent = Math.round((event.loaded / event.total) * 100);
          setProgress(percent);
        }
      };

      xhr.onload = () => {
        console.log("📦 Response status:", xhr.status);
        console.log(
          "📄 Response text (first 200 chars):",
          xhr.responseText.substring(0, 200),
        );

        if (xhr.status >= 200 && xhr.status < 300) {
          try {
            const data = JSON.parse(xhr.responseText);
            setResult(data);
            setProgress(100);
            console.log("✅ Upload successful:", data);
          } catch (parseError) {
            console.error("❌ Failed to parse JSON:", parseError);
            setError(
              `Server returned non-JSON: ${xhr.responseText.substring(0, 200)}`,
            );
          }
        } else {
          let errorMsg = `Upload failed with status ${xhr.status}`;
          try {
            const errorData = JSON.parse(xhr.responseText);
            if (errorData.detail) {
              errorMsg = errorData.detail;
            }
          } catch {
            errorMsg = `Server error: ${xhr.responseText.substring(0, 200)}`;
          }
          setError(errorMsg);
          console.error("❌ Upload failed:", errorMsg);
        }
        setLoading(false);
      };

      xhr.onerror = () => {
        console.error("❌ Network error");
        setError("Network error - could not reach the server.");
        setLoading(false);
      };

      xhr.ontimeout = () => {
        console.error("❌ Request timeout");
        setError("Request timed out. The server took too long to respond.");
        setLoading(false);
      };

      xhr.timeout = 300000;
      xhr.send(formData);
    } catch (err) {
      console.error("❌ Unexpected error:", err);
      const errorMessage =
        err instanceof Error ? err.message : "An unexpected error occurred.";
      setError(errorMessage);
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-dark-blue-900 p-6">
      <div className="max-w-4xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold text-white">Upload & Clean</h1>
          <Link href="/" className="text-orange-500 hover:underline">
            ← Back Home
          </Link>
        </div>

        <div className="bg-dark-blue-800 p-8 rounded-lg border border-orange-500/20">
          <div className="border-2 border-dashed border-orange-500/40 rounded-lg p-12 text-center">
            <UploadCloud className="w-16 h-16 text-orange-500 mx-auto mb-4" />
            <p className="text-white text-lg mb-2">
              Drag & drop your file here
            </p>
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
              <p className="text-white/80 mt-4">
                Selected: {file.name} ({(file.size / 1024).toFixed(1)} KB)
              </p>
            )}
          </div>

          {loading && (
            <div className="mt-4">
              <div className="w-full bg-dark-blue-900 rounded-full h-2.5">
                <div
                  className="bg-orange-500 h-2.5 rounded-full transition-all duration-300"
                  style={{ width: `${progress}%` }}
                />
              </div>
              <p className="text-white/60 text-sm mt-1">{progress}% uploaded</p>
            </div>
          )}

          <button
            onClick={handleUpload}
            disabled={!file || loading}
            className="w-full bg-orange-500 hover:bg-orange-600 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold py-3 px-6 rounded-lg mt-6 transition flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                Cleaning...
              </>
            ) : (
              "Upload & Clean"
            )}
          </button>

          {error && (
            <div className="bg-red-500/10 text-red-400 p-4 rounded-lg mt-6 border border-red-500/20">
              <p className="font-semibold">Error</p>
              <p className="text-sm break-words">{error}</p>
            </div>
          )}

          {result && (
            <div className="mt-8 bg-dark-blue-900 p-6 rounded-lg border border-orange-500/20">
              <h2 className="text-xl font-bold text-white mb-4">
                Cleaning Report
              </h2>

              {/* الإحصائيات الأساسية */}
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-white/80">
                <div>Rows Before: {result.rows_before ?? 0}</div>
                <div>Rows After: {result.rows_after ?? 0}</div>
                <div>Duplicates Removed: {result.duplicates_removed ?? 0}</div>
                <div>Missing Values Filled: {result.missing_values_filled ?? 0}</div>
                <div>Outliers Detected: {result.outliers_detected ?? 0}</div>
                <div>Quality Score: {result.quality_score ?? 0}/100</div>
                {result.execution_time_seconds && (
                  <div>Execution Time: {result.execution_time_seconds}s</div>
                )}
              </div>

              {/* ✅ أنواع البيانات لكل عمود */}
              {result.column_data_types && Object.keys(result.column_data_types).length > 0 && (
                <div className="mt-4 p-3 bg-gray-500/10 border border-gray-500/20 rounded-lg">
                  <p className="text-white font-semibold">📊 Column Data Types:</p>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-2 mt-2">
                    {Object.entries(result.column_data_types).map(([col, dtype]) => (
                      <div key={col} className="text-white/80 text-sm">
                        <span className="font-mono">{col}</span>: <span className="text-orange-400">{dtype}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* ✅ الشرح الذكي (إن وجد) */}
              {result.ai_explanation && (
                <div className="mt-4 p-4 bg-blue-500/10 border border-blue-500/20 rounded-lg">
                  <p className="text-blue-400 font-semibold">🤖 AI Explanation:</p>
                  <p className="text-white/90 text-sm leading-relaxed">
                    {result.ai_explanation}
                  </p>
                </div>
              )}

              {/* ✅ السجل التفصيلي للتغييرات */}
              {result.cleaning_log && result.cleaning_log.length > 0 && (
                <div className="mt-6">
                  <h3 className="text-lg font-bold text-white mb-3">
                    📋 Detailed Change Log
                  </h3>
                  <div className="space-y-3 max-h-96 overflow-y-auto pr-2">
                    {result.cleaning_log.map((entry, index) => {
                      let bgColor = "bg-gray-500/10";
                      let borderColor = "border-gray-500/20";
                      let icon = "⏭️";
                      if (entry.status === "completed") {
                        bgColor = "bg-green-500/10";
                        borderColor = "border-green-500/20";
                        icon = "✅";
                      } else if (entry.status === "skipped") {
                        bgColor = "bg-gray-500/10";
                        borderColor = "border-gray-500/20";
                        icon = "⏭️";
                      }
                      return (
                        <div
                          key={index}
                          className={`p-3 rounded-lg border ${bgColor} ${borderColor}`}
                        >
                          <div className="flex items-start gap-3">
                            <span className="text-xl">{icon}</span>
                            <div className="flex-1">
                              <p className="text-white font-medium">
                                {entry.description}
                              </p>
                              <p className="text-white/70 text-sm">
                                {entry.details}
                              </p>
                              {entry.rows_affected > 0 && (
                                <p className="text-white/60 text-xs mt-1">
                                  Rows affected: {entry.rows_affected}
                                </p>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* التوصيات والتنبيهات */}
              {result.recommendations && result.recommendations.length > 0 && (
                <div className="mt-4 p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-lg">
                  <p className="text-yellow-400 font-semibold">💡 Recommendations:</p>
                  <ul className="list-disc list-inside text-white/80 text-sm">
                    {result.recommendations.map((rec, i) => (
                      <li key={i}>{rec}</li>
                    ))}
                  </ul>
                </div>
              )}

              {result.alerts && result.alerts.length > 0 && (
                <div className="mt-2 p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
                  <p className="text-red-400 font-semibold">⚠️ Alerts:</p>
                  <ul className="list-disc list-inside text-white/80 text-sm">
                    {result.alerts.map((alert, i) => (
                      <li key={i}>{alert}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* خلاصة عامة */}
              {result.summary && (
                <div className="mt-4 p-3 bg-gray-500/10 border border-gray-500/20 rounded-lg">
                  <p className="text-white/80 text-sm">{result.summary}</p>
                </div>
              )}

              {/* أزرار التحميل */}
              {result.download_url && (
                <div className="mt-6 flex flex-wrap gap-4">
                  <a
                    href={result.download_url}
                    download
                    className="bg-orange-500 hover:bg-orange-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 transition"
                  >
                    <Download className="w-4 h-4" /> Download Cleaned File
                  </a>
                  <button
                    className="border border-orange-500 text-orange-500 hover:bg-orange-500/10 px-4 py-2 rounded-lg flex items-center gap-2 transition"
                    onClick={() => {
                      const blob = new Blob([JSON.stringify(result, null, 2)], {
                        type: "application/json",
                      });
                      const url = URL.createObjectURL(blob);
                      const a = document.createElement("a");
                      a.href = url;
                      a.download = "report.json";
                      a.click();
                      URL.revokeObjectURL(url);
                    }}
                  >
                    <FileText className="w-4 h-4" /> Download Report (JSON)
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
export type ApiErrorKind = "network" | "timeout" | "server" | "parse" | "aborted";

export class ApiError extends Error {
  kind: ApiErrorKind;
  status?: number;

  constructor(kind: ApiErrorKind, message: string, status?: number) {
    super(message);
    this.name = "ApiError";
    this.kind = kind;
    this.status = status;
  }
}

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

const UPLOAD_TIMEOUT_MS = 60_000;

export interface UploadOptions {
  onProgress?: (percent: number) => void;
  signal?: AbortSignal;
}

/**
 * POSTs a dataset to the FastAPI backend's `/clean` endpoint as
 * multipart/form-data and resolves with the parsed JSON report.
 *
 * Uses XMLHttpRequest instead of fetch so we can report real upload
 * progress, which fetch does not support natively.
 */
export function uploadDatasetToBackend(
  file: File,
  { onProgress, signal }: UploadOptions = {}
): Promise<Record<string, unknown>> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    const formData = new FormData();
    formData.append("file", file);

    // ✅ تم التصحيح: استخدام API_BASE بدلاً من API_BASE_URL
    xhr.open("POST", `${API_BASE}/clean`, true);
    xhr.timeout = UPLOAD_TIMEOUT_MS;

    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) {
        onProgress?.(Math.round((event.loaded / event.total) * 100));
      }
    };

    xhr.onload = () => {
      const isSuccess = xhr.status >= 200 && xhr.status < 300;

      if (!isSuccess) {
        let message = `The cleaning service returned an error (status ${xhr.status}).`;
        try {
          const body = JSON.parse(xhr.responseText);
          if (typeof body?.detail === "string") message = body.detail;
        } catch {
          // response wasn't JSON — keep the default message
        }
        reject(new ApiError("server", message, xhr.status));
        return;
      }

      try {
        resolve(JSON.parse(xhr.responseText));
      } catch {
        reject(new ApiError("parse", "The server response could not be read as JSON."));
      }
    };

    xhr.onerror = () => {
      reject(
        new ApiError(
          "network",
          // ✅ تم التصحيح: استخدام API_BASE بدلاً من API_BASE_URL
          `Could not reach the cleaning service at ${API_BASE}. Make sure the backend is running.`
        )
      );
    };

    xhr.ontimeout = () => {
      reject(new ApiError("timeout", "The backend took too long to respond. Try a smaller file."));
    };

    xhr.onabort = () => {
      reject(new ApiError("aborted", "Upload cancelled."));
    };

    signal?.addEventListener("abort", () => xhr.abort());

    xhr.send(formData);
  });
}

export function apiErrorTitle(kind: ApiErrorKind): string {
  switch (kind) {
    case "network":
      return "Can't Reach the Cleaning Service";
    case "timeout":
      return "Request Timed Out";
    case "server":
      return "Backend Error";
    case "parse":
      return "Unexpected Response";
    case "aborted":
      return "Upload Cancelled";
    default:
      return "Something Went Wrong";
  }
}
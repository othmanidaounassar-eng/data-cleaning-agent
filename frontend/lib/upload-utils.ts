// frontend/lib/upload-utils.ts

import { authHeaders } from "@/lib/auth";
import { API_BASE } from "@/lib/api";

export interface UploadPayload {
  body: ArrayBuffer;
  contentType: string;
  headers: Record<string, string>;
  compressed: boolean;
}

const MIN_GZIP_BYTES = 128 * 1024;

// Builds a multipart payload (file + plan). When the browser supports
// CompressionStream and the payload is big enough, the whole multipart body is
// gzip-compressed so it sneaks under Vercel's ~4.5 MB function body limit.
// The Next proxies (/api/analyze, /api/upload) transparently decompress it.
export async function buildUploadPayload(
  file: File,
  plan: string,
): Promise<UploadPayload> {
  const fd = new FormData();
  fd.append("file", file, file.name);
  fd.append("plan", plan);

  return compressFormData(fd);
}

// Compress any FormData with gzip when the browser supports CompressionStream
// and the payload exceeds MIN_GZIP_BYTES. Returns the body, the original
// multipart content-type (boundary included), and headers to merge into the
// fetch request (Content-Encoding: gzip when compressed).
export async function compressFormData(form: FormData): Promise<UploadPayload> {
  const serialized = new Response(form);
  const contentType = serialized.headers.get("content-type") || "";
  const bytes = new Uint8Array(await serialized.arrayBuffer());

  const canCompress = typeof CompressionStream !== "undefined";
  if (!canCompress || bytes.byteLength < MIN_GZIP_BYTES) {
    return {
      body: bytes.buffer,
      contentType,
      headers: {},
      compressed: false,
    };
  }

  const compressed = await new Response(
    new Blob([bytes]).stream().pipeThrough(new CompressionStream("gzip")),
  ).arrayBuffer();

  return {
    body: compressed,
    contentType,
    headers: { "Content-Encoding": "gzip" },
    compressed: true,
  };
}

export interface UploadErrorLabels {
  generic?: string;
  conn?: string;
  timeout?: string;
  tooLarge?: string;
}

// Single XHR upload helper used by analyze / pipeline / upload pages: builds
// the (possibly gzipped) payload, forwards auth + content-encoding headers,
// and resolves with the parsed JSON response. Rejects with the backend's own
// detail message so callers can surface it verbatim.
export function cleanFileViaUpload(
  file: File,
  plan: string,
  options?: {
    onProgress?: (pct: number) => void;
    timeoutMs?: number;
    label?: UploadErrorLabels;
  },
): Promise<unknown> {
  const labels = options?.label ?? {};
  return buildUploadPayload(file, plan).then(
    (payload) =>
      new Promise<unknown>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open("POST", `${API_BASE}/upload`, true);
        xhr.setRequestHeader("Content-Type", payload.contentType);
        for (const [key, value] of Object.entries(payload.headers)) {
          xhr.setRequestHeader(key, value);
        }
        for (const [key, value] of Object.entries(authHeaders())) {
          xhr.setRequestHeader(key, value);
        }
        xhr.timeout = options?.timeoutMs ?? 300000;
        if (options?.onProgress && "upload" in xhr) {
          xhr.upload.onprogress = (event) => {
            if (event.lengthComputable) {
              options.onProgress?.(
                Math.round((event.loaded / event.total) * 100),
              );
            }
          };
        }
        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            try {
              resolve(JSON.parse(xhr.responseText || "{}"));
            } catch {
              reject(new Error(labels.generic ?? "Clean failed."));
            }
            return;
          }
          let message = `Upload failed (${xhr.status})`;
          try {
            const err = JSON.parse(xhr.responseText || "{}");
            if (err.detail) message = err.detail;
            else if (err.error) message = err.error;
          } catch {
            if (/Request Entity Too Large/i.test(xhr.responseText)) {
              message = labels.tooLarge ?? message;
            }
          }
          reject(new Error(message));
        };
        xhr.onerror = () =>
          reject(new Error(labels.conn ?? "Connection failed."));
        xhr.ontimeout = () =>
          reject(new Error(labels.timeout ?? "The request timed out."));
        xhr.send(payload.body);
      }),
  );
}

// POST a FormData to a proxy route, gzip-compressing it when big enough.
// Returns the parsed payload regardless of HTTP status so callers keep their
// own error mapping.
export async function postCompressedForm(
  url: string,
  form: FormData,
  extraHeaders?: Record<string, string>,
): Promise<{ ok: boolean; status: number; data: unknown }> {
  const { body, headers, contentType } = await compressFormData(form);
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": contentType, ...extraHeaders, ...headers },
    body,
  });
  let data: unknown = null;
  try {
    data = await res.json();
  } catch {
    data = null;
  }
  return { ok: res.ok, status: res.status, data };
}

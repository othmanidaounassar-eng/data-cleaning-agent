// frontend/lib/proxy-body.ts
// Shared body handling for the Vercel -> FastAPI proxy routes (/api/analyze,
// /api/analyze-data, /api/upload). Gzip-encoded multipart bodies are inflated
// with a hard output bound so a few small "decompression bombs" cannot exhaust
// a serverless function's memory before the size check runs.

import { gunzip } from "zlib";
import { promisify } from "util";

const gunzipAsync = promisify(gunzip);

// Decompressed cap. Kept at the backend's MAX_FILE_SIZE horizon so we never
// allocate more than one legitimate maximum-size upload.
export const MAX_DECOMPRESSED_BYTES = 128 * 1024 * 1024;

export class ProxyPayloadError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.name = "ProxyPayloadError";
    this.status = status;
  }
}

export interface ProxyBody {
  body: BodyInit;
  contentType: string;
}

// Returns null when the request is NOT gzip-encoded (caller falls back to its
// own multipart handling, e.g. rebuilding the form or extracting filters).
// Throws ProxyPayloadError(413) when the inflated body exceeds the cap.
export async function decompressGzipBody(
  request: Request,
): Promise<ProxyBody | null> {
  const encoding = request.headers.get("content-encoding") || "";
  if (!encoding.toLowerCase().includes("gzip")) return null;

  const compressed = Buffer.from(await request.arrayBuffer());
  let raw: Buffer;
  try {
    raw = await gunzipAsync(compressed, {
      maxOutputLength: MAX_DECOMPRESSED_BYTES,
    });
  } catch (error) {
    if (
      error &&
      typeof error === "object" &&
      "code" in error &&
      (error as { code?: string }).code === "ERR_BUFFER_TOO_LARGE"
    ) {
      throw new ProxyPayloadError(
        413,
        "File exceeds the maximum supported size.",
      );
    }
    throw error;
  }

  // Keep the original multipart boundary so FastAPI parses the raw bytes.
  return {
    body: new Uint8Array(raw),
    contentType: request.headers.get("content-type") || "",
  };
}

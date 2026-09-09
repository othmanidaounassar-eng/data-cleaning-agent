// frontend/lib/upload-utils.ts

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

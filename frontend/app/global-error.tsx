"use client";

import { useEffect } from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <html lang="en">
      <body
        style={{
          background: "#07090F",
          color: "#EDEFF5",
          fontFamily: "system-ui, sans-serif",
        }}
      >
        <div
          style={{
            minHeight: "100vh",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 24,
          }}
        >
          <div style={{ textAlign: "center", maxWidth: 360 }}>
            <h1 style={{ fontSize: 18, fontWeight: 600, marginBottom: 8 }}>
              The app failed to load
            </h1>
            <p style={{ fontSize: 13, color: "#8891A5", marginBottom: 20 }}>
              A critical error occurred outside the normal error boundary.
            </p>
            <button
              onClick={reset}
              style={{
                background: "linear-gradient(135deg, #4F7CFF 0%, #8B5CF6 100%)",
                color: "white",
                border: "none",
                borderRadius: 12,
                padding: "10px 20px",
                fontSize: 13,
                fontWeight: 500,
                cursor: "pointer",
              }}
            >
              Reload
            </button>
          </div>
        </div>
      </body>
    </html>
  );
}

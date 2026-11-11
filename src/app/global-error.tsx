"use client";

import { useEffect } from "react";

/**
 * Error boundary root (menggantikan layout root saat terjadi error tak tertangani).
 * Wajib merender <html> dan <body> sendiri.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[global] error boundary:", error);
  }, [error]);

  return (
    <html lang="id">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#F6F5F0",
          color: "#0f172a",
          fontFamily:
            'ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
          padding: 16,
        }}
      >
        <div
          role="alert"
          style={{
            maxWidth: 480,
            width: "100%",
            background: "#fffbeb",
            border: "1px solid #fcd34d",
            borderRadius: 16,
            padding: 20,
          }}
        >
          <h1 style={{ fontSize: 18, fontWeight: 700, margin: 0 }}>
            Layanan sedang gangguan
          </h1>
          <p style={{ fontSize: 14, color: "#92400e", marginTop: 6 }}>
            Terjadi kesalahan yang tidak terduga. Coba muat ulang halaman beberapa
            saat lagi. Jika berlanjut, hubungi tim teknis.
          </p>
          <button
            type="button"
            onClick={() => reset()}
            style={{
              marginTop: 14,
              background: "#059669",
              color: "#fff",
              border: 0,
              borderRadius: 12,
              padding: "8px 16px",
              fontSize: 14,
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Coba lagi
          </button>
          {error.digest && (
            <div style={{ marginTop: 10, fontSize: 11, color: "#94a3b8" }}>
              Ref: {error.digest}
            </div>
          )}
        </div>
      </body>
    </html>
  );
}

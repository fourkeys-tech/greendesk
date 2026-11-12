import { describe, expect, it } from "vitest";
import {
  assertSafeUploadUrl,
  assertSafeUploadUrls,
  isSafeLocalUploadUrl,
  sanitizeInternalHref,
  sanitizeMediaHref,
} from "../url-safety";

describe("URL safety", () => {
  it("allows safe local upload paths, rejects traversal and external upload paths", () => {
    expect(isSafeLocalUploadUrl("/uploads/reports/photo-1.jpg")).toBe(true);
    expect(isSafeLocalUploadUrl("/uploads/../secret")).toBe(false);
    expect(isSafeLocalUploadUrl("/uploads\\secret.jpg")).toBe(false);
    expect(isSafeLocalUploadUrl("https://example.com/photo.jpg")).toBe(false);
    expect(() => assertSafeUploadUrl("/uploads/a/../../secret")).toThrow();
    expect(assertSafeUploadUrls(["/uploads/a.jpg", " "])).toEqual([
      "/uploads/a.jpg",
    ]);
  });

  it("only renders valid HTTP(S) or local media URLs", () => {
    expect(sanitizeMediaHref("/uploads/reports/a.jpg")).toBe(
      "/uploads/reports/a.jpg"
    );
    expect(sanitizeMediaHref("https://example.com/a.jpg")).toBe(
      "https://example.com/a.jpg"
    );
    for (const url of [
      "javascript:alert(1)",
      "data:image/svg+xml,<svg>",
      "//evil.example/a.png",
      "/uploads/../secret",
      "/uploads\\secret",
    ]) {
      expect(sanitizeMediaHref(url)).toBeNull();
    }
  });

  it("only accepts same-origin relative internal links", () => {
    expect(sanitizeInternalHref("/dashboard/laporan?q=1")).toBe(
      "/dashboard/laporan?q=1"
    );
    for (const url of [
      null,
      "https://evil.example",
      "//evil.example",
      "/\\evil.example",
      "/dashboard/../login",
      "/dashboard\nmalicious",
      "javascript:alert(1)",
    ]) {
      expect(sanitizeInternalHref(url)).toBeNull();
    }
  });
});

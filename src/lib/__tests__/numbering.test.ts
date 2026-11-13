import { describe, expect, it } from "vitest";
import { yearMonth } from "../numbering";

describe("yearMonth (prefix nomor TKT/SPK/PGV) mengikuti WIB", () => {
  it("tanggal 1 dini hari WIB sudah masuk bulan baru walau UTC masih bulan lalu", () => {
    // 1 Des 2026 03:00 WIB = 30 Nov 2026 20:00 UTC
    expect(yearMonth(new Date("2026-11-30T20:00:00Z"))).toBe("202612");
  });

  it("akhir bulan malam WIB tetap bulan berjalan", () => {
    // 30 Nov 2026 23:59 WIB = 30 Nov 2026 16:59 UTC
    expect(yearMonth(new Date("2026-11-30T16:59:00Z"))).toBe("202611");
  });

  it("pergantian tahun mengikuti WIB", () => {
    // 1 Jan 2027 00:30 WIB = 31 Des 2026 17:30 UTC
    expect(yearMonth(new Date("2026-12-31T17:30:00Z"))).toBe("202701");
  });
});

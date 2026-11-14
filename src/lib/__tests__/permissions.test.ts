import { describe, expect, it } from "vitest";
import {
  getNavigationForRole,
  hasPermission,
  validateStatusTransition,
} from "../permissions";

describe("Fase 0 – Matriks Hak Akses & Transisi Status", () => {
  it("memastikan Admin TIDAK dapat memverifikasi laporan, memutuskan perbaikan, atau membuat SPK", () => {
    expect(hasPermission("ADMIN", "VERIFY_AND_PRIORITIZE")).toBe(false);
    expect(hasPermission("ADMIN", "DECIDE_REPAIR")).toBe(false);
    expect(hasPermission("ADMIN", "CREATE_SPK")).toBe(false);
    expect(hasPermission("ADMIN", "MANAGE_MASTER_DATA")).toBe(true);
    expect(hasPermission("ADMIN", "VIEW_AUDIT_LOGS")).toBe(true);
  });

  it("memastikan hanya ADMIN dan OWNER yang bisa melihat Riwayat Perubahan Data (AuditLog)", () => {
    expect(hasPermission("ADMIN", "VIEW_AUDIT_LOGS")).toBe(true);
    expect(hasPermission("OWNER", "VIEW_AUDIT_LOGS")).toBe(true);
    expect(hasPermission("MANAGER", "VIEW_AUDIT_LOGS")).toBe(false);
    expect(hasPermission("PENGELOLA", "VIEW_AUDIT_LOGS")).toBe(false);
    expect(hasPermission("PENGGUNA", "VIEW_AUDIT_LOGS")).toBe(false);
    expect(hasPermission("PIC_VENDOR", "VIEW_AUDIT_LOGS")).toBe(false);
    expect(hasPermission("TEKNISI", "VIEW_AUDIT_LOGS")).toBe(false);
  });

  it("menampilkan menu navigasi yang spesifik sesuai masing-masing 7 role", () => {
    const adminMenus = getNavigationForRole("ADMIN").map((m) => m.href);
    expect(adminMenus).toContain("/dashboard/wilayah");
    expect(adminMenus).toContain("/dashboard/penanggung-jawab");
    expect(adminMenus).toContain("/dashboard/audit");
    expect(adminMenus).not.toContain("/dashboard/lapor");

    const penggunaMenus = getNavigationForRole("PENGGUNA").map((m) => m.href);
    expect(penggunaMenus).toContain("/beranda");
    expect(penggunaMenus).toContain("/beranda/lapor");
    expect(penggunaMenus).toContain("/beranda/laporan");
    expect(penggunaMenus).toContain("/beranda/profil");
    expect(penggunaMenus).not.toContain("/dashboard/audit");
    expect(penggunaMenus).not.toContain("/dashboard/wilayah");

    const teknisiMenus = getNavigationForRole("TEKNISI").map((m) => m.href);
    expect(teknisiMenus).toContain("/dashboard/profil-teknisi");
    expect(teknisiMenus).not.toContain("/dashboard/wilayah");
  });

  it("memvalidasi aturan transisi status laporan sesuai Bagian 7 PRD", () => {
    // Pengguna boleh membatalkan saat BARU
    expect(
      validateStatusTransition("BARU", "DIBATALKAN", "PENGGUNA").valid
    ).toBe(true);

    // Pengguna tidak boleh membatalkan setelah MENUNGGU_KEPUTUSAN
    expect(
      validateStatusTransition("MENUNGGU_KEPUTUSAN", "DIBATALKAN", "PENGGUNA")
        .valid
    ).toBe(false);

    // Pengelola menandai TIDAK_VALID wajib mengisi alasan
    expect(
      validateStatusTransition("BARU", "TIDAK_VALID", "PENGELOLA", "").valid
    ).toBe(false);
    expect(
      validateStatusTransition(
        "BARU",
        "TIDAK_VALID",
        "PENGELOLA",
        "Foto buram dan bukan aset taman"
      ).valid
    ).toBe(true);

    // Admin tidak boleh mengubah status apa pun
    expect(
      validateStatusTransition("BARU", "MENUNGGU_KEPUTUSAN", "ADMIN").valid
    ).toBe(false);
  });
});


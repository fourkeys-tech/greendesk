import { describe, expect, it } from "vitest";
import { parseScannedAssetCode } from "../qr-scan";

describe("parseScannedAssetCode (isi QR hasil scan kamera)", () => {
  it("mengambil kode aset dari shortlink /r/{kode} (format QR cetakan)", () => {
    expect(parseScannedAssetCode("https://greenpark.id/r/AST-BGV-001")).toBe("AST-BGV-001");
    expect(parseScannedAssetCode("http://localhost:3000/r/GPR-BGN-TMU-LMP-001")).toBe("GPR-BGN-TMU-LMP-001");
    expect(parseScannedAssetCode("https://greenpark.id/r/ast-bgv-001/")).toBe("AST-BGV-001");
    expect(parseScannedAssetCode("https://greenpark.id/r/AST-BGV-001?utm=x#a")).toBe("AST-BGV-001");
    expect(parseScannedAssetCode("  https://greenpark.id/r/AST%2DBGV%2D001  ")).toBe("AST-BGV-001");
  });

  it("menerima kode aset polos bersegmen", () => {
    expect(parseScannedAssetCode("AST-BGV-001")).toBe("AST-BGV-001");
    expect(parseScannedAssetCode("gpr-bgn-tmu-lmp-001")).toBe("GPR-BGN-TMU-LMP-001");
  });

  it("menolak QR yang bukan QR aset (phishing, path lain, teks acak)", () => {
    expect(parseScannedAssetCode("https://evil.example/login")).toBeNull();
    expect(parseScannedAssetCode("https://greenpark.id/dashboard")).toBeNull();
    expect(parseScannedAssetCode("https://greenpark.id/r/AST-001/extra")).toBeNull();
    expect(parseScannedAssetCode("https://greenpark.id/x/r/AST-001")).toBeNull();
    expect(parseScannedAssetCode("javascript:alert(1)")).toBeNull();
    expect(parseScannedAssetCode("WIFI:S:taman;T:WPA;P:rahasia;;")).toBeNull();
    expect(parseScannedAssetCode("Halo dunia")).toBeNull();
    expect(parseScannedAssetCode("12345")).toBeNull();
    expect(parseScannedAssetCode("")).toBeNull();
  });

  it("menolak kode berisi karakter berbahaya atau terlalu panjang", () => {
    expect(parseScannedAssetCode("https://greenpark.id/r/%2E%2E%2Fadmin")).toBeNull();
    expect(parseScannedAssetCode("https://greenpark.id/r/AST%3Cscript%3E")).toBeNull();
    expect(parseScannedAssetCode("https://greenpark.id/r/%E0%A4%A")).toBeNull();
    expect(parseScannedAssetCode(`https://greenpark.id/r/${"A".repeat(65)}`)).toBeNull();
    expect(parseScannedAssetCode(`${"A-".repeat(40)}1`)).toBeNull();
  });
});

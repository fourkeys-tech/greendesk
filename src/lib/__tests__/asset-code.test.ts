import { describe, expect, it } from "vitest";
import { abbreviateEntity, buildAssetPrefix } from "../asset-code";

describe("Asset Code & Abbreviation Generator (Hierarki 5 Tingkat)", () => {
  it("menghasilkan singkatan 2-4 huruf dari satu atau multi kata", () => {
    // Multi-kata (Inisial huruf pertama tiap kata)
    expect(abbreviateEntity("GreenPark Residence")).toBe("GPR");
    expect(abbreviateEntity("Taman Utama")).toBe("TMU");
    expect(abbreviateEntity("Lampu Taman")).toBe("LMP");
    expect(abbreviateEntity("Playground Anak")).toBe("PGA");

    // Kata dengan prefix Cluster/Klaster diabaikan jika ada kata lain
    expect(abbreviateEntity("Cluster Bougenville")).toBe("BGN");
    expect(abbreviateEntity("Klaster Edelweiss")).toBe("EDL");

    // Satu kata
    expect(abbreviateEntity("Bougenville")).toBe("BGN");
    expect(abbreviateEntity("Lampu")).toBe("LMP");
  });

  it("membangun prefix aset 4 tingkat sesuai hierarki Komplek-Cluster-Taman-Kategori", () => {
    const prefix = buildAssetPrefix(
      "GreenPark Residence",
      "Cluster Bougenville",
      "Taman Utama",
      "Lampu Taman"
    );
    expect(prefix).toBe("GPR-BGN-TMU-LMP");
  });

  it("mengabaikan kata 'Komplek/Kompleks' seperti 'Cluster' saat ada kata lain", () => {
    expect(abbreviateEntity("Komplek Alam Mutiara Residence")).toBe("AMR");
    expect(abbreviateEntity("Kompleks Taman Sari")).toBe("TS");
    expect(abbreviateEntity("Komplek Melati")).toBe("MLT");
    // Hanya kata "Komplek" saja tetap menghasilkan singkatan, bukan kosong
    expect(abbreviateEntity("Komplek")).toBe("KMP");
    expect(
      buildAssetPrefix(
        "Komplek Alam Mutiara Residence",
        "cluster buffalo",
        "Taman Buffalo",
        "Penerangan & Lampu Taman"
      )
    ).toBe("AMR-BFF-TB-PLT");
  });

  it("menangani nama kosong atau karakter khusus dengan aman", () => {
    expect(abbreviateEntity("")).toBe("AST");
    expect(abbreviateEntity("   ")).toBe("AST");
    expect(abbreviateEntity("!@#$%^&*()")).toBe("AST");
    expect(abbreviateEntity("Fasilitas & Olahraga (Outdoor)")).toBe("FO");
  });
});

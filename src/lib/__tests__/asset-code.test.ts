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

  it("menangani nama kosong atau karakter khusus dengan aman", () => {
    expect(abbreviateEntity("")).toBe("AST");
    expect(abbreviateEntity("   ")).toBe("AST");
    expect(abbreviateEntity("!@#$%^&*()")).toBe("AST");
    expect(abbreviateEntity("Fasilitas & Olahraga (Outdoor)")).toBe("FO");
  });
});

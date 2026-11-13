import { describe, expect, it } from "vitest";
import type { Role } from "../db-types";
import { canAccessSpkFile, type SpkFileAccessRow } from "../services/spk-file";
import { parsePrivateStorageRef, toPrivateStorageRef } from "../storage-config";

const row: SpkFileAccessRow = {
  id: "wo-1",
  spkNo: "SPK/2026/11/001",
  companyId: "co-1",
  spkFileUrl: "private://spk/SPK-1-abc.pdf",
  spkFileName: "SPK.pdf",
  spkFileMime: "application/pdf",
  clusterId: "cl-1",
  vendorPicUserId: "pic-1",
  vendorActive: true,
  techUserId: "tech-1",
  techStatus: "ACTIVE",
  techApprovalStatus: "APPROVED",
};

const user = (id: string, role: Role, companyId = "co-1") => ({ id, role, companyId });

describe("SPK private file reference", () => {
  it("parses only safe private:// refs", () => {
    expect(toPrivateStorageRef("spk/a.pdf")).toBe("private://spk/a.pdf");
    expect(parsePrivateStorageRef("private://spk/SPK-1-ab.pdf")).toBe("spk/SPK-1-ab.pdf");
    for (const ref of [
      null,
      "",
      "/uploads/spk/a.pdf",
      "https://x.supabase.co/storage/v1/object/public/uploads/spk/a.pdf",
      "private://../secret",
      "private://spk/../../etc",
      "private:///spk/a.pdf",
      "private://spk/a b.pdf",
    ]) {
      expect(parsePrivateStorageRef(ref)).toBeNull();
    }
  });
});

describe("SPK file access scope", () => {
  it("allows admin/owner of same company only", () => {
    expect(canAccessSpkFile(user("a", "ADMIN"), row)).toBe(true);
    expect(canAccessSpkFile(user("o", "OWNER"), row)).toBe(true);
    expect(canAccessSpkFile(user("a", "ADMIN", "co-2"), row)).toBe(false);
  });

  it("allows manager only on assigned cluster", () => {
    expect(canAccessSpkFile(user("m", "MANAGER"), row, ["cl-1"])).toBe(true);
    expect(canAccessSpkFile(user("m", "MANAGER"), row, ["cl-2"])).toBe(false);
    expect(canAccessSpkFile(user("m", "MANAGER"), row, [])).toBe(false);
  });

  it("allows PIC only for own active vendor", () => {
    expect(canAccessSpkFile(user("pic-1", "PIC_VENDOR"), row)).toBe(true);
    expect(canAccessSpkFile(user("pic-2", "PIC_VENDOR"), row)).toBe(false);
    expect(canAccessSpkFile(user("pic-1", "PIC_VENDOR"), { ...row, vendorActive: false })).toBe(false);
  });

  it("allows technician only when assigned, active and approved", () => {
    expect(canAccessSpkFile(user("tech-1", "TEKNISI"), row)).toBe(true);
    expect(canAccessSpkFile(user("tech-2", "TEKNISI"), row)).toBe(false);
    expect(canAccessSpkFile(user("tech-1", "TEKNISI"), { ...row, techStatus: "INACTIVE" })).toBe(false);
    expect(canAccessSpkFile(user("tech-1", "TEKNISI"), { ...row, techApprovalStatus: "PENDING" })).toBe(false);
    expect(canAccessSpkFile(user("tech-1", "TEKNISI"), { ...row, techUserId: null })).toBe(false);
  });

  it("denies citizens and pengelola", () => {
    expect(canAccessSpkFile(user("u", "PENGGUNA"), row)).toBe(false);
    expect(canAccessSpkFile(user("p", "PENGELOLA"), row)).toBe(false);
  });
});

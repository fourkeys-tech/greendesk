"use client";

import React, { useState } from "react";
import { ChevronDown, ChevronUp, Sparkles, Building } from "lucide-react";
import type { Role } from "@prisma/client";

interface RoleOption {
  role: Role;
  email: string;
  label: string;
}

interface DevRoleSwitcherProps {
  currentEmail: string;
  currentRole: Role;
  onSwitchAction: (email: string) => Promise<void>;
}

const ROLES: RoleOption[] = [
  { role: "PENGGUNA", email: "warga@greenpark.id", label: "1. Pengguna" },
  {
    role: "PENGELOLA",
    email: "pengelola.bgv@greenpark.id",
    label: "2. Pengelola",
  },
  { role: "MANAGER", email: "manager@greenpark.id", label: "3. Manager" },
  { role: "PIC_VENDOR", email: "pic@vendorjaya.id", label: "4. PIC Vendor" },
  {
    role: "TEKNISI",
    email: "teknisi.budi@vendorjaya.id",
    label: "5. Teknisi",
  },
  { role: "ADMIN", email: "admin@greenpark.id", label: "6. Admin" },
  { role: "OWNER", email: "owner@greenpark.id", label: "7. Owner" },
];

export function DevRoleSwitcher({
  currentEmail,
  currentRole,
  onSwitchAction,
}: DevRoleSwitcherProps) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="bg-slate-900 text-slate-200 border-b border-slate-800 transition-all text-xs">
      <div className="max-w-7xl mx-auto px-4 py-1.5 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-bold border border-emerald-500/30 text-[11px]">
            <Sparkles className="w-3 h-3 text-emerald-400" />
            Mode Uji Coba (Fase 0)
          </span>
          <span className="text-slate-400 hidden sm:inline text-xs">
            Role Aktif: <strong className="text-white">{currentRole}</strong> ({currentEmail})
          </span>
        </div>

        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white font-medium transition cursor-pointer text-xs"
        >
          <span>{isOpen ? "Tutup Selector Role" : "Pindah Role Cepat"}</span>
          {isOpen ? (
            <ChevronUp className="w-3.5 h-3.5" />
          ) : (
            <ChevronDown className="w-3.5 h-3.5" />
          )}
        </button>
      </div>

      {isOpen && (
        <div className="max-w-7xl mx-auto px-4 pb-3 pt-1 border-t border-slate-800/80 animate-in fade-in duration-150">
          <div className="text-[11px] text-slate-400 mb-2">
            Pilih akun demo untuk menguji visibilitas menu dan hak akses PRD:
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            {ROLES.map((r) => {
              const isCurrent =
                currentEmail.toLowerCase() === r.email.toLowerCase();
              return (
                <form
                  key={r.email}
                  action={onSwitchAction.bind(null, r.email)}
                >
                  <button
                    type="submit"
                    className={`px-2.5 py-1 rounded-md text-xs font-medium transition cursor-pointer ${
                      isCurrent
                        ? "bg-emerald-500 text-slate-950 font-bold shadow-xs ring-2 ring-emerald-400/50"
                        : "bg-slate-800 text-slate-300 hover:bg-slate-700 hover:text-white"
                    }`}
                  >
                    {r.label}
                  </button>
                </form>
              );
            })}

            <form
              action={onSwitchAction.bind(null, "admin@griyaasri.id")}
            >
              <button
                type="submit"
                className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium transition cursor-pointer ${
                  currentEmail === "admin@griyaasri.id"
                    ? "bg-amber-400 text-slate-950 font-bold shadow-xs ring-2 ring-amber-300/50"
                    : "bg-slate-800 text-amber-300 hover:bg-slate-700 hover:text-amber-200"
                }`}
              >
                <Building className="w-3 h-3" />
                <span>Uji Multi-Perusahaan B</span>
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

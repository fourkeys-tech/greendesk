"use client";

import Link from "next/link";
import { LogOut } from "lucide-react";

export default function AdminPage() {
  return (
    <div className="min-h-screen bg-[#F6F5F0] flex items-center justify-center p-4">
      <Link
        href="/"
        className="btn btn-outline border-rose-200 text-rose-600 hover:bg-rose-50 rounded-2xl flex items-center gap-2 text-sm font-bold px-6"
      >
        <LogOut className="w-4 h-4" />
        <span>Logout</span>
      </Link>
    </div>
  );
}


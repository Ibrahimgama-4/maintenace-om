"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import clsx from "clsx";
import {
  LayoutDashboard,
  Wrench,
  Repeat,
  Cpu,
  CalendarCheck,
  Package,
  FileText,
  Bot,
  BookOpen,
  ShieldCheck,
  LogOut,
  X,
  Info,
  AlertTriangle,
  UserCircle,
  Megaphone,
  CalendarDays,
  Library,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { InstallAppButton } from "./InstallAppButton";

const NAV_ITEMS = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/breakdowns", label: "Breakdowns", icon: Wrench },
  { href: "/handover", label: "Shift Handover", icon: Repeat },
  { href: "/shift-roster", label: "Shift Roster", icon: CalendarDays },
  { href: "/drawing-book", label: "Machine Drawing Book", icon: Library },
  { href: "/announcements", label: "Announcements", icon: Megaphone },
  { href: "/equipment", label: "Equipment", icon: Cpu },
  { href: "/pm-calibration", label: "PM & Calibration", icon: CalendarCheck },
  { href: "/spare-parts", label: "Spare Parts", icon: Package },
  { href: "/reports", label: "Reports", icon: FileText },
  { href: "/ai-assistant", label: "AI Assistant", icon: Bot },
  { href: "/knowledge-base", label: "Knowledge Base", icon: BookOpen },
  { href: "/profile", label: "My Profile", icon: UserCircle },
  { href: "/admin/users", label: "Admin: Users", icon: ShieldCheck },
];

export function Sidebar({
  userName,
  role,
  userEmail,
  userId,
  debugError,
  onNavigate,
}: {
  userName: string;
  role: string;
  userEmail: string;
  userId: string;
  debugError: string | null;
  onNavigate?: () => void;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const supabase = createClient();
  const [showDebug, setShowDebug] = useState(false);

  async function handleLogout() {
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "not set";

  return (
    <div className="flex h-full flex-col bg-white">
      <div className="flex items-center justify-between border-b border-gray-100 bg-gradient-to-br from-brand-700 to-brand-900 p-4">
        <div>
          <p className="text-sm font-semibold text-white">Instrumentation O&amp;M</p>
          <p className="mt-0.5 text-xs text-blue-100">
            {userName} <span className="opacity-60">·</span> <span className="capitalize">{role}</span>
          </p>
        </div>
        <button
          onClick={onNavigate}
          className="rounded-md p-1 text-white/80 hover:bg-white/10 lg:hidden"
          aria-label="Close menu"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      {debugError && (
        <div className="flex items-start gap-1.5 border-b border-red-100 bg-red-50 p-2.5 text-[10px] leading-snug text-red-700">
          <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" />
          <span className="break-all">Role lookup failed: {debugError}</span>
        </div>
      )}

      <nav className="flex-1 space-y-0.5 overflow-y-auto p-3">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const active = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onNavigate}
              className={clsx(
                "group flex items-center gap-2.5 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                active ? "bg-brand-50 text-brand-700" : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
              )}
            >
              <Icon className={clsx("h-4 w-4 shrink-0", active ? "text-brand-600" : "text-gray-400 group-hover:text-gray-600")} />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-gray-100 p-3">
        <div className="mb-2">
          <InstallAppButton />
        </div>

        <button
          onClick={() => setShowDebug((v) => !v)}
          className="flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-left text-xs font-medium text-gray-400 hover:bg-gray-50"
        >
          <Info className="h-3.5 w-3.5" />
          Account & connection info
        </button>

        {showDebug && (
          <div className="mb-2 space-y-1 rounded-md bg-gray-50 p-2.5 text-[10px] leading-relaxed text-gray-500">
            <p>
              <span className="font-semibold text-gray-600">Email:</span> {userEmail}
            </p>
            <p className="break-all">
              <span className="font-semibold text-gray-600">User ID:</span> {userId}
            </p>
            <p>
              <span className="font-semibold text-gray-600">Role:</span> {role}
            </p>
            <p className="break-all">
              <span className="font-semibold text-gray-600">Supabase URL:</span> {supabaseUrl}
            </p>
            {debugError && (
              <p className="break-all text-red-600">
                <span className="font-semibold">Error:</span> {debugError}
              </p>
            )}
          </div>
        )}

        <button
          onClick={handleLogout}
          className="flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-left text-sm font-medium text-gray-600 hover:bg-gray-50"
        >
          <LogOut className="h-4 w-4 text-gray-400" />
          Sign out
        </button>
      </div>
    </div>
  );
}

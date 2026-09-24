"use client";

import { useState } from "react";
import { Menu } from "lucide-react";
import { Sidebar } from "./Sidebar";

interface UnreadCounts {
  breakdowns: number;
  announcements: number;
}

export function DashboardShell({
  userName,
  role,
  userEmail,
  userId,
  debugError,
  unreadCounts,
  children,
}: {
  userName: string;
  role: string;
  userEmail: string;
  userId: string;
  debugError: string | null;
  unreadCounts: UnreadCounts;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="flex min-h-screen bg-gray-50">
      {/* Desktop sidebar */}
      <div className="hidden w-64 shrink-0 border-r border-gray-200 lg:block">
        <div className="sticky top-0 h-screen">
          <Sidebar
            userName={userName}
            role={role}
            userEmail={userEmail}
            userId={userId}
            debugError={debugError}
            unreadCounts={unreadCounts}
          />
        </div>
      </div>

      {/* Mobile sidebar overlay */}
      {open && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-black/40" onClick={() => setOpen(false)} />
          <div className="absolute inset-y-0 left-0 w-72 max-w-[80%] shadow-xl">
            <Sidebar
              userName={userName}
              role={role}
              userEmail={userEmail}
              userId={userId}
              debugError={debugError}
              unreadCounts={unreadCounts}
              onNavigate={() => setOpen(false)}
            />
          </div>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Mobile topbar */}
        <div className="flex items-center gap-3 border-b border-gray-200 bg-white p-3 lg:hidden">
          <button
            onClick={() => setOpen(true)}
            className="rounded-md p-1.5 text-gray-600 hover:bg-gray-100"
            aria-label="Open menu"
          >
            <Menu className="h-5 w-5" />
          </button>
          <p className="text-sm font-semibold text-brand-700">Instrumentation O&amp;M</p>
        </div>

        <main className="flex-1 overflow-y-auto p-4 sm:p-6">{children}</main>
      </div>
    </div>
  );
}

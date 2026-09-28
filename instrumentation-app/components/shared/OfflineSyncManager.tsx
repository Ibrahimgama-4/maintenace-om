"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { CloudOff, RefreshCw, WifiOff } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { countPending } from "@/lib/offline/db";
import { syncPendingBreakdowns } from "@/lib/offline/sync";

export function OfflineSyncManager() {
  const router = useRouter();
  const supabase = createClient();
  const [pendingCount, setPendingCount] = useState(0);
  const [online, setOnline] = useState(true);
  const [syncing, setSyncing] = useState(false);

  const refreshCount = useCallback(async () => {
    try {
      setPendingCount(await countPending());
    } catch {
      // IndexedDB unavailable (e.g. private browsing) — just show nothing.
    }
  }, []);

  const runSync = useCallback(async () => {
    if (!navigator.onLine) return;
    setSyncing(true);
    try {
      const { synced } = await syncPendingBreakdowns(supabase);
      await refreshCount();
      if (synced > 0) router.refresh();
    } finally {
      setSyncing(false);
    }
  }, [supabase, refreshCount, router]);

  useEffect(() => {
    setOnline(navigator.onLine);
    refreshCount();
    if (navigator.onLine) runSync();

    const handleOnline = () => {
      setOnline(true);
      runSync();
    };
    const handleOffline = () => setOnline(false);
    const handleChanged = () => refreshCount();

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    window.addEventListener("pending-breakdowns-changed", handleChanged);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      window.removeEventListener("pending-breakdowns-changed", handleChanged);
    };
  }, [refreshCount, runSync]);

  if (online && pendingCount === 0) return null;

  return (
    <div
      className={`flex items-center justify-between gap-3 px-4 py-2 text-xs font-medium ${
        online ? "bg-amber-50 text-amber-800" : "bg-gray-800 text-white"
      }`}
    >
      <div className="flex items-center gap-2">
        {online ? <CloudOff className="h-3.5 w-3.5" /> : <WifiOff className="h-3.5 w-3.5" />}
        <span>
          {!online
            ? `You're offline${pendingCount > 0 ? ` — ${pendingCount} report${pendingCount > 1 ? "s" : ""} saved and waiting to sync` : ""}`
            : `${pendingCount} report${pendingCount > 1 ? "s" : ""} waiting to sync`}
        </span>
      </div>
      {online && pendingCount > 0 && (
        <button
          onClick={runSync}
          disabled={syncing}
          className="flex items-center gap-1 rounded bg-amber-200 px-2 py-1 text-amber-900 disabled:opacity-60"
        >
          <RefreshCw className={`h-3 w-3 ${syncing ? "animate-spin" : ""}`} />
          {syncing ? "Syncing..." : "Sync now"}
        </button>
      )}
    </div>
  );
}

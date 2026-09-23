"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Search } from "lucide-react";
import { Button } from "@/components/ui/Button";

export function KBSearchForm({ initialQuery }: { initialQuery: string }) {
  const router = useRouter();
  const [q, setQ] = useState(initialQuery);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    router.push(`/knowledge-base?q=${encodeURIComponent(q)}`);
  }

  return (
    <form onSubmit={handleSubmit} className="flex gap-2">
      <input
        className="flex-1 rounded-md border border-gray-300 px-3 py-2 text-sm"
        placeholder="e.g. Packer 1 underweight, level pendulum, VFD trip..."
        value={q}
        onChange={(e) => setQ(e.target.value)}
      />
      <Button type="submit" className="gap-1.5">
        <Search className="h-4 w-4" />
        Search
      </Button>
    </form>
  );
}

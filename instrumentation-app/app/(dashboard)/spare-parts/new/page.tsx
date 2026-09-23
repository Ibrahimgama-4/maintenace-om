"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";

export default function NewSparePartPage() {
  const router = useRouter();
  const supabase = createClient();
  const [form, setForm] = useState({
    part_number: "",
    name: "",
    stock_qty: "0",
    min_stock_qty: "0",
  });
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const { error } = await supabase.from("spare_parts").insert({
      part_number: form.part_number,
      name: form.name,
      stock_qty: Number(form.stock_qty),
      min_stock_qty: Number(form.min_stock_qty),
    });

    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }

    router.push("/spare-parts");
  }

  return (
    <div className="max-w-xl space-y-4">
      <h1 className="text-xl font-semibold text-gray-900">Add Spare Part</h1>
      <Card>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Part Number *</label>
            <input
              required
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
              value={form.part_number}
              onChange={(e) => setForm({ ...form, part_number: e.target.value })}
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Name *</label>
            <input
              required
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Stock Quantity</label>
              <input
                type="number"
                min={0}
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                value={form.stock_qty}
                onChange={(e) => setForm({ ...form, stock_qty: e.target.value })}
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Minimum Stock</label>
              <input
                type="number"
                min={0}
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                value={form.min_stock_qty}
                onChange={(e) => setForm({ ...form, min_stock_qty: e.target.value })}
              />
            </div>
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <Button type="submit" disabled={loading}>
            {loading ? "Saving..." : "Save Part"}
          </Button>
        </form>
      </Card>
    </div>
  );
}

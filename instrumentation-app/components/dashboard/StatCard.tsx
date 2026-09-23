import { Card } from "@/components/ui/Card";
import type { LucideIcon } from "lucide-react";
import clsx from "clsx";

export function StatCard({
  label,
  value,
  icon: Icon,
  tone = "default",
}: {
  label: string;
  value: string | number;
  icon: LucideIcon;
  tone?: "default" | "critical";
}) {
  return (
    <Card className="flex items-start justify-between">
      <div>
        <p className="text-xs font-medium uppercase tracking-wide text-gray-500">{label}</p>
        <p className={clsx("mt-2 text-2xl font-semibold", tone === "critical" ? "text-red-600" : "text-gray-900")}>
          {value}
        </p>
      </div>
      <div
        className={clsx(
          "flex h-9 w-9 items-center justify-center rounded-lg",
          tone === "critical" ? "bg-red-50 text-red-600" : "bg-brand-50 text-brand-600"
        )}
      >
        <Icon className="h-4.5 w-4.5" />
      </div>
    </Card>
  );
}

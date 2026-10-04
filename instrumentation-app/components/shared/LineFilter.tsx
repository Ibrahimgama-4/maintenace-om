import Link from "next/link";
import clsx from "clsx";
import { PLANT_LOCATIONS } from "@/lib/constants";
import { NO_LINE, shortLine } from "@/lib/utils/lines";

/** Chips that filter a page by production line via ?line=. */
export function LineFilter({
  basePath,
  active,
  counts,
  total,
  noLineLabel,
  noLineCount = 0,
}: {
  basePath: string;
  active?: string;
  counts: Record<string, number>;
  total: number;
  noLineLabel?: string;
  noLineCount?: number;
}) {
  const chip = (href: string, label: string, n: number, on: boolean, key: string) => (
    <Link
      key={key}
      href={href}
      className={clsx(
        "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-medium transition-colors",
        on ? "border-brand-600 bg-brand-600 text-white" : "border-gray-200 bg-white text-gray-700 hover:bg-gray-50"
      )}
    >
      {label}
      <span className={clsx("rounded-full px-1.5 text-xs", on ? "bg-white/25" : "bg-gray-100 text-gray-500")}>{n}</span>
    </Link>
  );
  return (
    <div className="flex flex-wrap gap-2">
      {chip(basePath, "All lines", total, !active, "all")}
      {PLANT_LOCATIONS.map((l) => chip(`${basePath}?line=${encodeURIComponent(l)}`, shortLine(l), counts[l] ?? 0, active === l, l))}
      {noLineLabel && noLineCount > 0 && chip(`${basePath}?line=${NO_LINE}`, noLineLabel, noLineCount, active === NO_LINE, NO_LINE)}
    </div>
  );
}

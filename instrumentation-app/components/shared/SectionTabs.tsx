import Link from "next/link";
import clsx from "clsx";

export function SectionTabs({ items, active }: { items: { href: string; label: string }[]; active: string }) {
  return (
    <div className="flex gap-1 rounded-lg bg-gray-100 p-1 text-sm">
      {items.map((i) => (
        <Link
          key={i.href}
          href={i.href}
          className={clsx(
            "flex-1 rounded-md px-3 py-1.5 text-center font-medium transition-colors",
            active === i.href ? "bg-white text-brand-700 shadow-sm" : "text-gray-600 hover:text-gray-900"
          )}
        >
          {i.label}
        </Link>
      ))}
    </div>
  );
}

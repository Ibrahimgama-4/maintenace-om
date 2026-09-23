import clsx from "clsx";
import { ButtonHTMLAttributes } from "react";

export function Button({
  className,
  variant = "primary",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "secondary" | "danger" }) {
  return (
    <button
      className={clsx(
        "inline-flex items-center justify-center rounded-lg px-4 py-2 text-sm font-medium shadow-sm transition-all active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50 disabled:active:scale-100",
        variant === "primary" && "bg-brand-600 text-white hover:bg-brand-700 hover:shadow-md",
        variant === "secondary" &&
          "border border-gray-300 bg-white text-gray-700 hover:border-gray-400 hover:bg-gray-50",
        variant === "danger" && "bg-red-600 text-white hover:bg-red-700 hover:shadow-md",
        className
      )}
      {...props}
    />
  );
}

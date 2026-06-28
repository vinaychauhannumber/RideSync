import React from "react";
import { cn } from "../../lib/utils";

interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: "default" | "secondary" | "success" | "warning" | "destructive" | "info" | "outline";
}

export const Badge: React.FC<BadgeProps> = ({ className, variant = "default", ...props }) => {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 select-none",
        {
          "bg-slate-900 text-white hover:bg-slate-900/80": variant === "default",
          "bg-slate-100 text-slate-900 hover:bg-slate-100/80 border border-slate-200": variant === "secondary",
          "bg-emerald-100 text-emerald-800 border border-emerald-200/50": variant === "success",
          "bg-amber-100 text-amber-800 border border-amber-200/50": variant === "warning",
          "bg-red-100 text-red-800 border border-red-200/50": variant === "destructive",
          "bg-blue-100 text-blue-800 border border-blue-200/50": variant === "info",
          "border border-slate-200 text-slate-700 bg-transparent": variant === "outline",
        },
        className
      )}
      {...props}
    />
  );
};

import React from "react";
import { cn } from "../../lib/utils";

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "outline" | "ghost" | "link" | "destructive" | "success";
  size?: "sm" | "md" | "lg";
  loading?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "primary", size = "md", loading, children, disabled, ...props }, ref) => {
    return (
      <button
        ref={ref}
        disabled={disabled || loading}
        className={cn(
          "inline-flex items-center justify-center rounded-xl font-semibold transition-all duration-200 active:scale-[0.98] focus:outline-none focus:ring-2 focus:ring-blue-500/20 disabled:pointer-events-none disabled:opacity-50",
          {
            "bg-blue-600 text-white hover:bg-blue-700 shadow-sm shadow-blue-600/10": variant === "primary",
            "bg-cyan-500 text-white hover:bg-cyan-600 shadow-sm shadow-cyan-500/10": variant === "secondary",
            "bg-emerald-500 text-white hover:bg-emerald-600 shadow-sm shadow-emerald-500/10": variant === "success",
            "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 hover:text-slate-900": variant === "outline",
            "bg-red-500 text-white hover:bg-red-600 shadow-sm shadow-red-500/10": variant === "destructive",
            "text-slate-600 hover:bg-slate-100 hover:text-slate-950": variant === "ghost",
            "text-blue-600 hover:underline underline-offset-4 bg-transparent p-0": variant === "link",
            "px-3 py-1.5 text-xs": size === "sm",
            "px-4 py-2.5 text-sm": size === "md",
            "px-6 py-3.5 text-base": size === "lg",
          },
          className
        )}
        {...props}
      >
        {loading && (
          <svg
            className="mr-2 h-4 w-4 animate-spin text-current"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
          >
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            />
          </svg>
        )}
        {children}
      </button>
    );
  }
);

Button.displayName = "Button";

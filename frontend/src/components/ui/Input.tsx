import React from "react";
import { cn } from "../../lib/utils";

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  error?: string;
  label?: string;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type = "text", error, label, id, ...props }, ref) => {
    return (
      <div className="w-full">
        {label && (
          <label htmlFor={id} className="block text-sm font-semibold text-slate-700 mb-1.5">
            {label}
          </label>
        )}
        <input
          type={type}
          id={id}
          ref={ref}
          className={cn(
            "flex w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 transition-all placeholder:text-slate-400 focus:border-blue-500 focus:outline-none focus:ring-4 focus:ring-blue-500/10 disabled:cursor-not-allowed disabled:opacity-50",
            {
              "border-red-500 focus:border-red-500 focus:ring-red-500/10": error,
            },
            className
          )}
          {...props}
        />
        {error && <p className="mt-1.5 text-xs font-medium text-red-500">{error}</p>}
      </div>
    );
  }
);

Input.displayName = "Input";

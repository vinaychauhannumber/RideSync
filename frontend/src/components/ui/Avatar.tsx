import React from "react";
import { cn } from "../../lib/utils";

interface AvatarProps {
  src?: string | null;
  fallback: string;
  size?: "xs" | "sm" | "md" | "lg" | "xl";
  className?: string;
}

export const Avatar: React.FC<AvatarProps> = ({ src, fallback, size = "md", className }) => {
  const [error, setError] = React.useState(false);

  const initials = fallback
    .split(" ")
    .map((n) => n[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  const sizeClasses = {
    xs: "h-6 w-6 text-[10px]",
    sm: "h-8 w-8 text-xs",
    md: "h-10 w-10 text-sm",
    lg: "h-14 w-14 text-base",
    xl: "h-20 w-20 text-xl",
  };

  return (
    <div
      className={cn(
        "relative flex shrink-0 overflow-hidden rounded-full bg-slate-100 font-semibold text-slate-600 justify-center items-center select-none border border-slate-100",
        sizeClasses[size],
        className
      )}
    >
      {src && !error ? (
        <img
          src={src}
          alt={fallback}
          onError={() => setError(true)}
          className="h-full w-full object-cover"
        />
      ) : (
        <span>{initials || "?"}</span>
      )}
    </div>
  );
};

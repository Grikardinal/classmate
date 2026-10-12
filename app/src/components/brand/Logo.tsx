import * as React from "react";
import { cn } from "@/lib/utils";

/** Classmate logosu: "C" harfi ve yanında bir nokta — öğrenci ile kurumun yan yana durması. */
export function LogoMark({ className }: { className?: string }) {
  const id = React.useId().replace(/:/g, "");
  return (
    <svg viewBox="0 0 32 32" fill="none" className={cn("size-8 drop-shadow-[0_4px_10px_rgb(91_76_240/0.35)]", className)} aria-hidden>
      <defs>
        <linearGradient id={`cm-${id}`} x1="0" y1="0" x2="32" y2="32" gradientUnits="userSpaceOnUse">
          <stop stopColor="#5B4CF0" />
          <stop offset="1" stopColor="#A347F0" />
        </linearGradient>
      </defs>
      <rect width="32" height="32" rx="9" fill={`url(#cm-${id})`} />
      <path d="M21.14 9.87A8 8 0 1 0 21.14 22.13" stroke="#fff" strokeWidth="3.5" strokeLinecap="round" />
      <circle cx="24.6" cy="16" r="2.6" fill="#fff" />
    </svg>
  );
}

export function Logo({ className, collapsed }: { className?: string; collapsed?: boolean }) {
  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <LogoMark />
      {!collapsed && <span className="font-display text-[18px] font-extrabold tracking-tight">Classmate</span>}
    </span>
  );
}

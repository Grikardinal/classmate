import { cn } from "@/lib/utils";

/** Classmate logosu: "C" harfi ve yanında bir nokta — öğrenci ile kurumun yan yana durması. */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" fill="none" className={cn("size-8", className)} aria-hidden>
      <rect width="32" height="32" rx="8" className="fill-primary" />
      <path d="M21.14 9.87A8 8 0 1 0 21.14 22.13" stroke="#fff" strokeWidth="3.5" strokeLinecap="round" />
      <circle cx="24.6" cy="16" r="2.6" fill="#fff" />
    </svg>
  );
}

export function Logo({ className, collapsed }: { className?: string; collapsed?: boolean }) {
  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <LogoMark />
      {!collapsed && <span className="text-[17px] font-semibold tracking-tight">Classmate</span>}
    </span>
  );
}

/**
 * Temel arayüz bileşenleri — shadcn/ui ve 21st.dev ile aynı API ve sınıf yapısında.
 * 21st.dev'den eklenen bileşenler (npx shadcn add ...) bu dosyadakilerle birlikte kullanılabilir.
 */
import * as React from "react";
import { cn } from "@/lib/utils";

/* Button */
type ButtonVariant = "default" | "outline" | "ghost" | "secondary" | "destructive";
type ButtonSize = "default" | "sm" | "icon";

const buttonVariants: Record<ButtonVariant, string> = {
  default: "bg-marka text-primary-foreground shadow-glow hover:brightness-110 hover:-translate-y-px active:translate-y-0",
  outline: "border bg-card shadow-xs hover:border-primary/40 hover:bg-accent/40",
  ghost: "hover:bg-muted",
  secondary: "bg-muted hover:bg-muted/70",
  destructive: "bg-danger text-white shadow-[0_8px_20px_-8px_rgb(229_72_77/0.6)] hover:brightness-110",
};
const buttonSizes: Record<ButtonSize, string> = {
  default: "h-10 px-4",
  sm: "h-8 px-3 text-[13px]",
  icon: "size-9",
};

export const Button = React.forwardRef<
  HTMLButtonElement,
  React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant; size?: ButtonSize }
>(({ className, variant = "default", size = "default", ...props }, ref) => (
  <button
    ref={ref}
    className={cn(
      "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl text-sm font-semibold transition-all duration-200",
      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50 [&_svg]:size-4",
      buttonVariants[variant],
      buttonSizes[size],
      className,
    )}
    {...props}
  />
));
Button.displayName = "Button";

/* Card */
export function Card({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("rounded-2xl border border-border/70 bg-card shadow-soft", className)} {...props} />;
}
export function CardHeader({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("flex flex-col gap-1 p-5 pb-3", className)} {...props} />;
}
export function CardTitle({ className, ...props }: React.HTMLAttributes<HTMLHeadingElement>) {
  return <h3 className={cn("font-display text-[15px] font-bold leading-none tracking-tight", className)} {...props} />;
}
export function CardDescription({ className, ...props }: React.HTMLAttributes<HTMLParagraphElement>) {
  return <p className={cn("text-sm text-muted-foreground", className)} {...props} />;
}
export function CardContent({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("p-5 pt-0", className)} {...props} />;
}

/* Badge */
type BadgeVariant = "default" | "secondary" | "outline" | "success" | "warning" | "danger";
const badgeVariants: Record<BadgeVariant, string> = {
  default: "bg-accent text-accent-foreground",
  secondary: "bg-muted text-muted-foreground",
  outline: "border text-foreground",
  success: "bg-success/12 text-success ring-1 ring-inset ring-success/20",
  warning: "bg-warning/12 text-warning ring-1 ring-inset ring-warning/25",
  danger: "bg-danger/10 text-danger ring-1 ring-inset ring-danger/20",
};
export function Badge({
  className,
  variant = "default",
  ...props
}: React.HTMLAttributes<HTMLSpanElement> & { variant?: BadgeVariant }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold",
        badgeVariants[variant],
        className,
      )}
      {...props}
    />
  );
}

/* Input / Select / Label */
const fieldBase =
  "h-10 w-full rounded-xl border border-input bg-card px-3 text-sm shadow-xs outline-none transition placeholder:text-muted-foreground hover:border-primary/40 focus-visible:border-primary focus-visible:ring-4 focus-visible:ring-primary/15 disabled:cursor-not-allowed disabled:opacity-60";

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...props }, ref) => <input ref={ref} className={cn(fieldBase, className)} {...props} />,
);
Input.displayName = "Input";

export const Select = React.forwardRef<HTMLSelectElement, React.SelectHTMLAttributes<HTMLSelectElement>>(
  ({ className, ...props }, ref) => <select ref={ref} className={cn(fieldBase, "pr-8", className)} {...props} />,
);
Select.displayName = "Select";

export function Label({ className, ...props }: React.LabelHTMLAttributes<HTMLLabelElement>) {
  return <label className={cn("text-sm font-medium", className)} {...props} />;
}

export function Field({ label, children, hint }: { label: string; children: React.ReactNode; hint?: string }) {
  return (
    <label className="grid gap-1.5">
      <span className="text-[13px] font-semibold">{label}</span>
      {children}
      {hint && <span className="text-xs text-muted-foreground">{hint}</span>}
    </label>
  );
}

/* Switch */
export function Switch({
  checked,
  onCheckedChange,
  disabled,
  label,
}: {
  checked: boolean;
  onCheckedChange: (v: boolean) => void;
  disabled?: boolean;
  label?: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onCheckedChange(!checked)}
      className={cn(
        "relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors disabled:opacity-50",
        checked ? "bg-marka shadow-[0_2px_8px_-2px_rgb(91_76_240/0.6)]" : "bg-input",
      )}
    >
      <span
        className={cn(
          "inline-block size-4 rounded-full bg-white shadow transition-transform",
          checked ? "translate-x-[18px]" : "translate-x-0.5",
        )}
      />
    </button>
  );
}

/* Tabs (kontrollü, basit) */
export function Tabs<T extends string>({
  value,
  onChange,
  items,
}: {
  value: T;
  onChange: (v: T) => void;
  items: { value: T; label: string; icon?: React.ReactNode }[];
}) {
  return (
    <div className="no-scrollbar -mx-1 overflow-x-auto">
      <div className="inline-flex gap-1 rounded-2xl border border-border/70 bg-card/70 p-1 shadow-xs backdrop-blur">
        {items.map((it) => (
          <button
            key={it.value}
            onClick={() => onChange(it.value)}
            className={cn(
              "inline-flex items-center gap-1.5 whitespace-nowrap rounded-xl px-3.5 py-2 text-sm font-semibold transition-all duration-200 [&_svg]:size-4",
              value === it.value
                ? "bg-marka text-white shadow-glow"
                : "text-muted-foreground hover:bg-muted hover:text-foreground",
            )}
          >
            {it.icon}
            {it.label}
          </button>
        ))}
      </div>
    </div>
  );
}

/* Table */
export function Table({ className, ...props }: React.TableHTMLAttributes<HTMLTableElement>) {
  return (
    <div className="w-full overflow-x-auto">
      <table className={cn("w-full text-sm", className)} {...props} />
    </div>
  );
}
export function Th({ className, ...props }: React.ThHTMLAttributes<HTMLTableCellElement>) {
  return (
    <th
      className={cn("h-10 border-b bg-muted/50 px-4 text-left align-middle text-[11px] font-bold uppercase tracking-wider text-muted-foreground first:pl-5 last:pr-5", className)}
      {...props}
    />
  );
}
export function Td({ className, ...props }: React.TdHTMLAttributes<HTMLTableCellElement>) {
  return <td className={cn("border-b border-border/60 px-4 py-3 align-middle transition-colors first:pl-5 last:pr-5 [tr:hover>&]:bg-accent/30 [tr:last-child>&]:border-b-0", className)} {...props} />;
}

/* Dialog (sade modal) */
export function Dialog({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  wide,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  wide?: boolean;
}) {
  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    if (open) window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 grid place-items-center overflow-y-auto p-4">
      <div className="fixed inset-0 animate-belir bg-[#14142b]/40 backdrop-blur-sm" onClick={onClose} />
      <div role="dialog" aria-modal aria-label={title} className={cn("relative w-full animate-buyu rounded-3xl border bg-card p-6 shadow-lift", wide ? "max-w-2xl" : "max-w-md")}>
        <h2 className="text-lg font-bold">{title}</h2>
        {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
        <div className="mt-5 grid gap-4">{children}</div>
        {footer && <div className="mt-6 flex justify-end gap-2">{footer}</div>}
      </div>
    </div>
  );
}

/* Sayfa başlığı */
export function PageHeader({
  code,
  title,
  description,
  actions,
}: {
  code?: string;
  title: string;
  description?: string;
  actions?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div>
        {code && (
          <p className="mb-2 inline-flex items-center gap-1.5 rounded-full bg-accent px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider text-accent-foreground">
            <span className="size-1.5 rounded-full bg-marka" />
            Bölüm {code}
          </p>
        )}
        <h1 className="text-[28px] font-extrabold leading-tight tracking-tight">{title}</h1>
        {description && <p className="mt-1.5 max-w-2xl text-sm text-muted-foreground">{description}</p>}
      </div>
      {actions && <div className="flex gap-2">{actions}</div>}
    </div>
  );
}

/* Textarea */
export const Textarea = React.forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>(
  ({ className, ...props }, ref) => (
    <textarea
      ref={ref}
      className={cn(
        "min-h-20 w-full rounded-xl border border-input bg-card px-3 py-2 text-sm shadow-xs outline-none transition placeholder:text-muted-foreground hover:border-primary/40 focus-visible:border-primary focus-visible:ring-4 focus-visible:ring-primary/15",
        className,
      )}
      {...props}
    />
  ),
);
Textarea.displayName = "Textarea";

/* Checkbox */
export function Checkbox({
  checked,
  onChange,
  label,
  description,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: React.ReactNode;
  description?: string;
}) {
  return (
    <label className="flex cursor-pointer items-start gap-2.5 text-sm">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-0.5 size-4 shrink-0 rounded border-input accent-[var(--color-primary)]"
      />
      <span>
        {label}
        {description && <span className="block text-xs text-muted-foreground">{description}</span>}
      </span>
    </label>
  );
}

/* İstatistik kartı */
export function StatCard({
  label,
  value,
  hint,
  icon,
  tone = "default",
  onClick,
}: {
  label: string;
  value: React.ReactNode;
  hint?: React.ReactNode;
  icon?: React.ReactNode;
  tone?: "default" | "success" | "warning" | "danger";
  onClick?: () => void;
}) {
  // Anlamı olmayan (varsayılan) kartlar etiketlerine göre birkaç canlı tondan birini alır
  const notr = [
    { kutu: "from-primary to-primary-2", isik: "bg-primary/25" },
    { kutu: "from-sky-500 to-cyan-400", isik: "bg-sky-400/25" },
    { kutu: "from-fuchsia-500 to-pink-400", isik: "bg-fuchsia-400/25" },
  ];
  const ozet = [...label].reduce((t, c) => t + c.charCodeAt(0), 0);
  const tonlar = {
    default: notr[ozet % notr.length],
    success: { kutu: "from-emerald-500 to-teal-400", isik: "bg-emerald-400/25" },
    warning: { kutu: "from-amber-500 to-orange-400", isik: "bg-amber-400/25" },
    danger: { kutu: "from-rose-500 to-pink-500", isik: "bg-rose-400/25" },
  }[tone];
  const Kok = onClick ? "button" : "div";
  return (
    <Kok
      onClick={onClick}
      className={cn(
        "group relative overflow-hidden rounded-2xl border border-border/70 bg-card p-4 text-left shadow-soft transition-all duration-300",
        onClick && "hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-lift",
      )}
    >
      <span className={cn("pointer-events-none absolute -right-8 -top-8 size-28 rounded-full blur-2xl transition-opacity duration-300 group-hover:opacity-100", tonlar.isik, onClick ? "opacity-60" : "opacity-50")} />
      <div className="relative flex items-center justify-between gap-2">
        <p className="text-[13px] font-semibold text-muted-foreground">{label}</p>
        {icon && (
          <span className={cn("grid size-9 shrink-0 place-items-center rounded-xl bg-gradient-to-br text-white shadow-md [&_svg]:size-[18px]", tonlar.kutu)}>{icon}</span>
        )}
      </div>
      <p className="relative mt-2 font-display text-[26px] font-extrabold tabular-nums tracking-tight">{value}</p>
      {hint && <p className="relative mt-0.5 text-xs text-muted-foreground">{hint}</p>}
    </Kok>
  );
}

/* Avatar (baş harfler) */
export function Avatar({ ad, className }: { ad: string; className?: string }) {
  const bas = ad
    .split(" ")
    .filter(Boolean)
    .map((x) => x[0])
    .slice(0, 2)
    .join("")
    .toLocaleUpperCase("tr-TR");
  let h = 0;
  for (const c of ad) h = (h * 31 + c.charCodeAt(0)) % 360;
  return (
    <span
      className={cn("grid size-9 shrink-0 place-items-center rounded-full text-xs font-semibold text-white", className)}
      style={{ background: `hsl(${h} 55% 50%)` }}
      aria-hidden
    >
      {bas}
    </span>
  );
}

/* Yan panel (sheet) */
export function Sheet({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  wide,
}: {
  open: boolean;
  onClose: () => void;
  title: React.ReactNode;
  description?: React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
  wide?: boolean;
}) {
  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    if (open) window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 animate-belir bg-[#14142b]/40 backdrop-blur-sm" onClick={onClose} />
      <div
        role="dialog"
        aria-modal
        className={cn("absolute inset-y-0 right-0 flex w-full animate-kay flex-col rounded-l-3xl border-l bg-card shadow-lift", wide ? "max-w-2xl" : "max-w-lg")}
      >
        <div className="flex items-start justify-between gap-3 border-b p-5">
          <div className="min-w-0">
            <h2 className="text-lg font-bold">{title}</h2>
            {description && <div className="mt-0.5 text-sm text-muted-foreground">{description}</div>}
          </div>
          <button onClick={onClose} className="rounded-md p-1 text-muted-foreground hover:bg-muted" aria-label="Kapat">
            <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-5">{children}</div>
        {footer && <div className="flex justify-end gap-2 border-t p-4">{footer}</div>}
      </div>
    </div>
  );
}

/* Toast (kısa bilgi balonu) */
type ToastItem = { id: number; metin: string; tur: "basari" | "uyari" | "hata" };
let toastlar: ToastItem[] = [];
const toastDinleyici = new Set<() => void>();
export function toast(metin: string, tur: ToastItem["tur"] = "basari") {
  const id = Date.now() + Math.random();
  toastlar = [...toastlar, { id, metin, tur }];
  toastDinleyici.forEach((l) => l());
  setTimeout(() => {
    toastlar = toastlar.filter((t) => t.id !== id);
    toastDinleyici.forEach((l) => l());
  }, 3500);
}
export function Toaster() {
  const liste = React.useSyncExternalStore(
    (l) => {
      toastDinleyici.add(l);
      return () => toastDinleyici.delete(l);
    },
    () => toastlar,
  );
  return (
    <div className="pointer-events-none fixed bottom-4 right-4 z-[60] flex w-[min(24rem,calc(100vw-2rem))] flex-col gap-2" aria-live="polite">
      {liste.map((t) => (
        <div
          key={t.id}
          role="status"
          className={cn(
            "pointer-events-auto animate-buyu rounded-2xl border bg-card/95 px-4 py-3 text-sm font-medium shadow-lift backdrop-blur",
            t.tur === "basari" && "border-l-4 border-l-success",
            t.tur === "uyari" && "border-l-4 border-l-warning",
            t.tur === "hata" && "border-l-4 border-l-danger",
          )}
        >
          {t.metin}
        </div>
      ))}
    </div>
  );
}

/* Uyarı kutusu */
export function Alert({
  tone = "info",
  icon,
  children,
  className,
}: {
  tone?: "info" | "warning" | "danger" | "success";
  icon?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  const t = {
    info: "border-primary/15 bg-accent/60 text-foreground [&>svg]:text-primary",
    warning: "border-warning/30 bg-warning/10",
    danger: "border-danger/30 bg-danger/10",
    success: "border-success/30 bg-success/10",
  };
  return (
    <div className={cn("flex items-start gap-3 rounded-2xl border p-3.5 text-sm [&>svg]:mt-0.5 [&>svg]:size-4 [&>svg]:shrink-0", t[tone], className)}>
      {icon}
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}

export function EmptyState({ icon, title, text }: { icon: React.ReactNode; title: string; text: string }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed bg-card/50 px-6 py-14 text-center">
      <div className="mb-3 grid size-12 place-items-center rounded-2xl bg-marka text-white shadow-glow [&_svg]:size-5">
        {icon}
      </div>
      <p className="font-medium">{title}</p>
      <p className="mt-1 max-w-sm text-sm text-muted-foreground">{text}</p>
    </div>
  );
}

import { cn } from "@/lib/utils";

export const YAPIMCI = { ad: "Keskin Bilişim", telefon: "0532 783 76 95", telefonBag: "tel:+905327837695" } as const;

/** Uygulama yapımcısı ve iletişim bilgisi: giriş ekranlarının ve yönetim panelinin altında görünür */
export function YapimciBilgisi({ className }: { className?: string }) {
  return (
    <p className={cn("text-center text-xs text-muted-foreground", className)}>
      {YAPIMCI.ad} ·{" "}
      <a href={YAPIMCI.telefonBag} className="whitespace-nowrap underline-offset-2 hover:underline">
        {YAPIMCI.telefon}
      </a>
    </p>
  );
}

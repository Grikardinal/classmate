/**
 * Tek serili çubuk grafik. Tek seri → tek renk (primary), lejant yok; başlık seriyi adlandırır.
 * İnce çubuklar, üstte 4px yuvarlatma, çubuklar arası boşluk, sönük eksen; üzerine gelince değer balonu.
 * Erişilebilirlik: her çubuk aria-label taşır, altında gizli tablo vardır.
 */
import * as React from "react";
import { cn } from "@/lib/utils";

export type CubukVeri = { etiket: string; deger: number; ipucu?: string; vurgu?: boolean };

export function BarChart({ veri, yukseklik = 180, birim = "", className }: { veri: CubukVeri[]; yukseklik?: number; birim?: string; className?: string }) {
  const [aktif, setAktif] = React.useState<number | null>(null);
  const enBuyuk = Math.max(1, ...veri.map((v) => v.deger));
  const maxIdx = veri.findIndex((v) => v.deger === enBuyuk);
  // Yatay kılavuz çizgileri: 0, yarı, tam
  const kilavuz = [0, 0.5, 1];
  return (
    <div className={cn("relative pt-6", className)}>
      <div className="relative flex items-end gap-2 border-b border-border pl-8" style={{ height: yukseklik }}>
        {kilavuz.map((k) => (
          <div key={k} className="pointer-events-none absolute inset-x-0 border-t border-dashed border-border/70" style={{ bottom: `${k * 100}%` }}>
            <span className="absolute -top-2 left-0 w-7 text-right text-[10px] tabular-nums text-muted-foreground">{Math.round(enBuyuk * k)}</span>
          </div>
        ))}
        {veri.map((v, i) => (
          <button
            key={v.etiket}
            type="button"
            className="group relative flex h-full flex-1 items-end justify-center focus:outline-none"
            onMouseEnter={() => setAktif(i)}
            onMouseLeave={() => setAktif(null)}
            onFocus={() => setAktif(i)}
            onBlur={() => setAktif(null)}
            aria-label={`${v.etiket}: ${v.deger}${birim}`}
          >
            <span
              className={cn("relative w-full max-w-10 rounded-t-[4px] bg-primary transition-opacity", aktif !== null && aktif !== i && "opacity-40", v.vurgu === false && "bg-primary/40")}
              style={{ height: `${(v.deger / enBuyuk) * 100}%`, minHeight: v.deger > 0 ? 2 : 0 }}
            />
            {(i === maxIdx || aktif === i) && (
              <span className="absolute text-[11px] font-medium tabular-nums text-foreground" style={{ bottom: `calc(${(v.deger / enBuyuk) * 100}% + 4px)` }}>
                {aktif === i ? "" : v.deger}
              </span>
            )}
            {aktif === i && (
              <span className="absolute z-10 whitespace-nowrap rounded-md border bg-card px-2 py-1 text-xs shadow-lg" style={{ bottom: `calc(${(v.deger / enBuyuk) * 100}% + 8px)` }}>
                <b className="tabular-nums">{v.deger}{birim}</b> <span className="text-muted-foreground">· {v.ipucu ?? v.etiket}</span>
              </span>
            )}
          </button>
        ))}
      </div>
      <div className="flex gap-2 pl-8 pt-1.5">
        {veri.map((v) => (
          <span key={v.etiket} className="flex-1 truncate text-center text-[11px] text-muted-foreground">{v.etiket}</span>
        ))}
      </div>
      <table className="sr-only">
        <tbody>{veri.map((v) => <tr key={v.etiket}><th>{v.etiket}</th><td>{v.deger}</td></tr>)}</tbody>
      </table>
    </div>
  );
}

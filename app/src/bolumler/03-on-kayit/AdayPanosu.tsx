/** Pano: durum sütunları arasında sürükle-bırak. "Kayıt oldu" sütununa ve oradan dışarı taşıma yapılamaz. */
import * as React from "react";
import { Badge, toast } from "@/components/ui";
import { useOturum } from "@/context/AppContext";
import { guncelle, simdiZaman, sube, type Aday, type AdayDurum } from "@/data/store";
import { cn } from "@/lib/utils";
import { ADAY_DURUMLARI, durumBilgisi, durumGecisEngeli } from "./kurallar";
import { AksiyonTarihi, useAdayDenetimi } from "./ortak";

export function AdayPanosu({ adaylar, onSec }: { adaylar: Aday[]; onSec: (id: string) => void }) {
  const { ad: oturumAd } = useOturum();
  const denetle = useAdayDenetimi();
  const [hedef, setHedef] = React.useState<AdayDurum | null>(null);
  const tasi = (id: string, durum: AdayDurum) => {
    const a = adaylar.find((x) => x.id === id);
    if (!a || a.durum === durum) return;
    const gecis = durumGecisEngeli(a.durum, durum);
    if (gecis) {
      toast(gecis, "uyari");
      if (durum === "kayit") onSec(id);
      return;
    }
    const yeni: Aday = {
      ...a,
      durum,
      vazgecmeNedeni: durum === "vazgecti" ? a.vazgecmeNedeni ?? "Diğer" : null,
      notlar: [...a.notlar, { tarih: simdiZaman(), yazar: oturumAd, metin: `Durum: ${durumBilgisi(durum).ad}` }],
    };
    const hata = denetle(yeni, a);
    if (hata) {
      toast(hata, "hata");
      return;
    }
    guncelle((x) => {
      x.adaylar = x.adaylar.map((y) => (y.id === id ? yeni : y));
    });
  };
  return (
    <div className="no-scrollbar -mx-4 overflow-x-auto px-4">
      <div className="grid min-w-[1000px] grid-cols-6 gap-3">
        {ADAY_DURUMLARI.map((s) => {
          const liste = adaylar.filter((a) => a.durum === s.key);
          return (
            <div
              key={s.key}
              onDragOver={(e) => {
                e.preventDefault();
                setHedef(s.key);
              }}
              onDragLeave={() => setHedef(null)}
              onDrop={(e) => {
                tasi(e.dataTransfer.getData("text/plain"), s.key);
                setHedef(null);
              }}
              className={cn("flex min-h-64 flex-col gap-2 rounded-lg bg-muted/60 p-2 transition", hedef === s.key && "ring-2 ring-primary/50")}
            >
              <div className="flex items-center justify-between px-1.5 py-1">
                <span className="text-sm font-medium">{s.ad}</span>
                <Badge variant="secondary">{liste.length}</Badge>
              </div>
              {liste.map((a) => (
                <button
                  key={a.id}
                  draggable={a.durum !== "kayit"}
                  onDragStart={(e) => e.dataTransfer.setData("text/plain", a.id)}
                  onClick={() => onSec(a.id)}
                  className="rounded-md border bg-card p-2.5 text-left text-sm shadow-xs transition hover:border-primary/40"
                >
                  <p className="font-medium">{a.ogrenciAd}</p>
                  <p className="text-xs text-muted-foreground">{a.seviye}. sınıf · {sube(a.subeId)?.kod}</p>
                  <p className="mt-1.5 text-xs"><AksiyonTarihi a={a} /></p>
                </button>
              ))}
            </div>
          );
        })}
      </div>
      <p className="mt-2 text-xs text-muted-foreground">Kartları sürükleyerek durumunu değiştirin. Kesin kayıt aday kartından yapılır ve geri alınamaz.</p>
    </div>
  );
}

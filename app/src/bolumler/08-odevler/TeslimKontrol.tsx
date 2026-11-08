/** Teslim kontrol ekranı: yoklama gibi hızlı işaretleme, "yapmadı" bildirimi */
import * as React from "react";
import { CheckCheck } from "lucide-react";
import { Avatar, Button, Input, Sheet, toast } from "@/components/ui";
import { useOturum } from "@/context/AppContext";
import { BUGUN, bildirimEkle, dersAdi, grupEtiket, guncelle, islemYaz, tamAd, useDb, type Odev, type TeslimDurumu } from "@/data/store";
import { cn } from "@/lib/utils";
import { NOT_UZUNLUK, notlarTemizle, odevKontrolListesi, yeniYapmayanlar } from "./kurallar";
import { tarihKisa, teslimSecenek } from "./ortak";

export default function TeslimKontrol({ o, onClose }: { o: Odev; onClose: () => void }) {
  const d = useDb();
  const { ad } = useOturum();
  const ogrenciler = odevKontrolListesi(d, o);
  const [durum, setDurum] = React.useState<Record<string, TeslimDurumu>>(() => Object.fromEntries(ogrenciler.map((x) => [x.id, o.teslimler[x.id] ?? "yapti"])));
  const [notlar, setNotlar] = React.useState<Record<string, string>>(o.notlar);
  const kaydet = () => {
    let n = 0;
    guncelle((x) => {
      x.odevler = x.odevler.map((y) => (y.id === o.id ? { ...y, teslimler: { ...y.teslimler, ...durum }, notlar: notlarTemizle(notlar, durum), kontrolEdildi: true, kontrolTarihi: y.kontrolTarihi ?? (y.kontrolEdildi ? undefined : BUGUN) } : y));
      for (const ogrId of yeniYapmayanlar(durum, o.teslimler)) n += bildirimEkle(x, "odevYapmadi", ogrId, { ders: dersAdi(o.dersId), baslik: o.baslik }, undefined, true);
      islemYaz(x, ad, "Ödev kontrolü", `${grupEtiket(x, o.grupId)} — ${o.baslik}`);
    });
    toast(n ? `Kaydedildi; ${n} veliye “ödev yapılmadı” bilgisi gönderildi.` : "Teslim durumu kaydedildi.");
    onClose();
  };
  return (
    <Sheet
      open
      onClose={onClose}
      title={o.baslik}
      description={`${grupEtiket(d, o.grupId)} · teslim ${tarihKisa(o.teslim)}`}
      footer={<><Button variant="outline" onClick={onClose}>Vazgeç</Button><Button onClick={kaydet}><CheckCheck /> Kaydet</Button></>}
    >
      <div className="mb-3 flex justify-end">
        <Button variant="ghost" size="sm" onClick={() => setDurum(Object.fromEntries(ogrenciler.map((x) => [x.id, "yapti" as TeslimDurumu])))}>Hepsi yaptı</Button>
      </div>
      <ul className="divide-y rounded-lg border">
        {ogrenciler.map((x) => (
          <li key={x.id} className="grid gap-2 p-3">
            <div className="flex items-center gap-3">
              <Avatar ad={tamAd(x)} className="size-8" />
              <span className="min-w-0 flex-1 truncate font-medium">{tamAd(x)}</span>
              <div className="flex gap-1">
                {teslimSecenek.map((s) => (
                  <button
                    key={s.key}
                    onClick={() => setDurum({ ...durum, [x.id]: s.key })}
                    aria-pressed={durum[x.id] === s.key}
                    className={cn("h-8 rounded-md border px-2.5 text-xs font-medium", durum[x.id] === s.key ? s.sinif + " border-transparent" : "text-muted-foreground hover:bg-muted")}
                  >
                    {s.ad}
                  </button>
                ))}
              </div>
            </div>
            {durum[x.id] !== "yapti" && (
              <Input placeholder="Kısa geri bildirim (veli görür)" maxLength={NOT_UZUNLUK} value={notlar[x.id] ?? ""} onChange={(e) => setNotlar({ ...notlar, [x.id]: e.target.value })} />
            )}
          </li>
        ))}
      </ul>
    </Sheet>
  );
}

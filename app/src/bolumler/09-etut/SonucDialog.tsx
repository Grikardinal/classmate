import * as React from "react";
import { Button, Dialog, Field, Input, Select, toast } from "@/components/ui";
import { useOturum } from "@/context/AppContext";
import { guncelle, islemYaz, tamAd, useDb, type Randevu, type RandevuSonucu } from "@/data/store";
import { kalanHakUygula, ogrenciSonucu, sonucHakFarklari, sonuclardanDurum } from "./kurallar";
import { durumRozet, tarihKisa } from "./ortak";

/** Grup etüdünde öğrenci bazında sonuç; yönetici için sonuç düzeltme (kim ve ne zaman sunucudan) */
export function SonucDialog({ r, duzeltme, onClose }: { r: Randevu; duzeltme: boolean; onClose: () => void }) {
  const d = useDb();
  const { ad } = useOturum();
  const ilk = (id: string): RandevuSonucu => (ogrenciSonucu(r, id) === "gelmedi" ? "gelmedi" : "yapildi");
  const [sonuclar, setSonuclar] = React.useState<Record<string, RandevuSonucu>>(() => Object.fromEntries(r.ogrenciIds.map((id) => [id, ilk(id)])));
  const [neden, setNeden] = React.useState("");
  const degisti = r.ogrenciIds.some((id) => sonuclar[id] !== ogrenciSonucu(r, id));
  const gecerli = !duzeltme || (degisti && neden.trim().length >= 3);

  const kaydet = () => {
    if (!gecerli) return;
    const durum = sonuclardanDurum(sonuclar);
    const yeni: Pick<Randevu, "durum" | "sonuclar"> = r.ogrenciIds.length > 1 ? { durum, sonuclar } : { durum };
    guncelle((x) => {
      const fark = sonucHakFarklari(r, yeni, x.ayarlar.gelmeyenHakDussun);
      x.randevular = x.randevular.map((y) =>
        y.id === r.id ? { ...y, ...yeni, ...(duzeltme ? { duzeltmeler: [...(y.duzeltmeler ?? []), { neden: neden.trim(), kullanici: ad, zaman: "", onceki: { durum: y.durum, sonuclar: y.sonuclar ?? null } }] } : {}) } : y,
      );
      x.paketler = x.paketler.map((p) => (fark.has(p.id) ? { ...p, kalan: kalanHakUygula(p, fark.get(p.id)!) } : p));
      if (!duzeltme) islemYaz(x, ad, "Etüt", `${r.tarih} ${r.bas} randevu: ${durumRozet[durum].ad}`, r.subeId);
    });
    toast(duzeltme ? "Sonuç düzeltildi." : "Sonuçlar kaydedildi.");
    onClose();
  };

  return (
    <Dialog
      open
      onClose={onClose}
      title={duzeltme ? "Sonucu düzelt" : "Etüt sonucu"}
      description={`${tarihKisa(r.tarih)} ${r.bas}${duzeltme ? " · paket hakkı sonuca göre iade edilir veya düşülür" : ""}`}
      footer={<><Button variant="outline" onClick={onClose}>Vazgeç</Button><Button onClick={kaydet} disabled={!gecerli}>Kaydet</Button></>}
    >
      <div className="grid gap-2">
        {r.ogrenciIds.map((id) => (
          <Field key={id} label={tamAd(d.ogrenciler.find((o) => o.id === id))}>
            <Select value={sonuclar[id]} onChange={(e) => setSonuclar({ ...sonuclar, [id]: e.target.value as RandevuSonucu })}>
              <option value="yapildi">Yapıldı</option>
              <option value="gelmedi">Gelmedi</option>
            </Select>
          </Field>
        ))}
      </div>
      {duzeltme && <Field label="Düzeltme gerekçesi (en az 3 karakter)"><Input value={neden} onChange={(e) => setNeden(e.target.value)} /></Field>}
    </Dialog>
  );
}

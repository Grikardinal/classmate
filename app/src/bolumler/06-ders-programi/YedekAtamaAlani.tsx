import * as React from "react";
import { Alert, Button, Field, Select, toast } from "@/components/ui";
import { useOturum } from "@/context/AppContext";
import { BUGUN, dersAdi, grup, grupEtiket, guncelle, islemYaz, personelAdi, useDb, type ProgramSatiri } from "@/data/store";
import { bransDisiOgretmenler, oturumYedegi, uygunOgretmenler, yedekAtamaEngeli, yedekKaldirmaEngeli } from "./kurallar";

/** Tek oturumluk yedek öğretmen (karar 2026-11-09): haftalık satırı değiştirmez, veliye bildirim gitmez */
export function YedekAtamaAlani({ satir, tarih }: { satir: ProgramSatiri; tarih: string }) {
  const d = useDb();
  const { ad, rol } = useOturum();
  const oturumId = `${satir.id}_${tarih}`;
  const mevcut = oturumYedegi(d, oturumId);
  const [secim, setSecim] = React.useState("");
  const subeId = grup(d, satir.grupId)!.subeId;
  const adaylar = [...uygunOgretmenler(d.personel, satir.dersId, subeId), ...bransDisiOgretmenler(d.personel, satir.dersId, subeId)].filter((p) => p.id !== mevcut?.ogretmenId && !yedekAtamaEngeli({ oturumId, ogretmenId: p.id }, d, BUGUN, rol));
  const genelEngel = mevcut ? yedekKaldirmaEngeli(oturumId, d, BUGUN, rol) : yedekAtamaEngeli({ oturumId, ogretmenId: "__secim" }, d, BUGUN, rol);
  // "__secim" yalnızca oturum kurallarını sınar; öğretmen seçilmeden gelen uygunluk mesajı engel sayılmaz
  const engel = genelEngel === "Seçilen kişi öğretmen değil." ? null : genelEngel;
  const etiket = `${grupEtiket(d, satir.grupId)} ${tarih} ${dersAdi(satir.dersId)}`;

  const ata = () => {
    if (!secim || engel) return;
    guncelle((x) => {
      x.yedekAtamalari = [...(x.yedekAtamalari ?? []).filter((y) => y.oturumId !== oturumId), { oturumId, ogretmenId: secim, atayan: "", zaman: "" }];
      islemYaz(x, ad, "Yedek öğretmen", `${etiket}: ${personelAdi(x, secim)}`, subeId);
    });
    toast("Yedek öğretmen atandı.");
    setSecim("");
  };
  const kaldir = () => {
    if (engel) return;
    guncelle((x) => {
      x.yedekAtamalari = (x.yedekAtamalari ?? []).filter((y) => y.oturumId !== oturumId);
      islemYaz(x, ad, "Yedek öğretmen", `${etiket}: yedek kaldırıldı`, subeId);
    });
    toast("Yedek kaldırıldı.");
  };

  return (
    <div className="grid gap-2 rounded-md border p-3">
      <p className="text-sm font-medium">Bu oturum için yedek · {tarih}</p>
      {mevcut && <p className="text-sm">Yedek: <b>{personelAdi(d, mevcut.ogretmenId)}</b></p>}
      {engel ? (
        <Alert>{engel}</Alert>
      ) : (
        <div className="flex flex-wrap items-end gap-2">
          <Field label="Yedek öğretmen">
            <Select value={secim} onChange={(e) => setSecim(e.target.value)}>
              <option value="">Seçiniz</option>
              {adaylar.map((p) => <option key={p.id} value={p.id}>{p.ad} {p.soyad}{p.dersIds.includes(satir.dersId) ? "" : " (branş dışı)"}</option>)}
            </Select>
          </Field>
          <Button variant="outline" onClick={ata} disabled={!secim}>{mevcut ? "Değiştir" : "Yedek ata"}</Button>
          {mevcut && <Button variant="ghost" onClick={kaldir}>Yedeği kaldır</Button>}
        </div>
      )}
    </div>
  );
}

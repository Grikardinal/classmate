import * as React from "react";
import { Button, Dialog, Field, Input, Select, toast } from "@/components/ui";
import { useOturum } from "@/context/AppContext";
import { BUGUN, guncelle, islemYaz, tamAd, yeniId, type Personel } from "@/data/store";
import { tl } from "@/lib/kurallar";
import { tutarCoz, tutarGecerli } from "../05-finans/kurallar";
import { MAAS_KATEGORISI } from "./kurallar";

export function AvansDialog({ open, onClose, ogretmenler }: { open: boolean; onClose: () => void; ogretmenler: Personel[] }) {
  const { ad } = useOturum();
  const [f, setF] = React.useState({ personelId: "", tutar: "", aciklama: "" });
  const personelId = f.personelId || ogretmenler[0]?.id || "";
  const tutar = tutarCoz(f.tutar);
  const gecerli = tutarGecerli(tutar) && !!personelId;
  const kaydet = () => {
    if (!gecerli) return;
    guncelle((x) => {
      const p = x.personel.find((y) => y.id === personelId)!;
      const giderId = yeniId("gd");
      x.avanslar.push({ id: yeniId("av"), personelId: p.id, tarih: BUGUN, tutar, aciklama: f.aciklama.trim() || "Avans", subeId: p.anaSubeId, giderId });
      x.giderler.push({ id: giderId, tarih: BUGUN, subeId: p.anaSubeId, kategori: MAAS_KATEGORISI, aciklama: `${tamAd(p)} avans`, tutar, kasa: "nakit" });
      islemYaz(x, ad, "Avans", `${tamAd(p)} — ${tl(tutar)}`, p.anaSubeId);
    });
    toast("Avans kaydedildi.");
    setF({ personelId: "", tutar: "", aciklama: "" });
    onClose();
  };
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Avans girişi"
      footer={
        <>
          <Button variant="outline" onClick={onClose}>Vazgeç</Button>
          <Button onClick={kaydet} disabled={!gecerli}>Kaydet</Button>
        </>
      }
    >
      <Field label="Öğretmen">
        <Select value={personelId} onChange={(e) => setF({ ...f, personelId: e.target.value })}>
          {ogretmenler.map((p) => <option key={p.id} value={p.id}>{tamAd(p)}</option>)}
        </Select>
      </Field>
      <Field label="Tutar (₺)"><Input inputMode="decimal" value={f.tutar} onChange={(e) => setF({ ...f, tutar: e.target.value })} /></Field>
      <Field label="Açıklama"><Input maxLength={200} value={f.aciklama} onChange={(e) => setF({ ...f, aciklama: e.target.value })} /></Field>
    </Dialog>
  );
}

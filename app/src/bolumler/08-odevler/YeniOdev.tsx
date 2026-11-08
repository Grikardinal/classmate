/** Yeni ödev formu. Grup ve ders listesi sunucu kurallarıyla aynı hesaptan gelir. */
import * as React from "react";
import { Button, Checkbox, Dialog, Field, Input, Select, Textarea, toast } from "@/components/ui";
import { useOturum } from "@/context/AppContext";
import { BUGUN, bildirimEkle, dersAdi, grupEtiket, guncelle, islemYaz, tamAd, tanimlar, useDb, yeniId, type Odev } from "@/data/store";
import { tarihEkle } from "@/lib/kurallar";
import { ACIKLAMA_UZUNLUK, BASLIK_UZUNLUK, KAYNAK_UZUNLUK, odevDersleri, odevHedefleri, odevOgretmeni } from "./kurallar";
import { tarihKisa } from "./ortak";

export default function YeniOdev({ open, onClose }: { open: boolean; onClose: () => void }) {
  const d = useDb();
  const { grupGorunur, ogretmenMi, personel, ad } = useOturum();
  const sahip = ogretmenMi ? personel.id : null;
  const gruplar = d.gruplar.filter((g) => grupGorunur(g.id) && odevDersleri(d, g.id, BUGUN, sahip).length > 0);
  const bos = () => ({ grupId: "", dersId: "", tumGrup: true, secili: [] as string[], baslik: "", aciklama: "", kaynak: "", teslim: tarihEkle(BUGUN, 3), dosya: "" });
  const [f, setF] = React.useState(bos);
  // Seçim listede yoksa (ilk açılış, grup değişimi) ilk seçenek geçerlidir
  const grupId = gruplar.some((g) => g.id === f.grupId) ? f.grupId : (gruplar[0]?.id ?? "");
  const dersIds = grupId ? odevDersleri(d, grupId, BUGUN, sahip) : [];
  const dersId = dersIds.includes(f.dersId) ? f.dersId : (dersIds[0] ?? "");
  const hedef = grupId ? { grupId, ogrenciIds: null, teslim: f.teslim >= BUGUN ? f.teslim : BUGUN } : null;
  const ogrenciler = hedef ? odevHedefleri(d, hedef) : [];
  const gecerli = !!grupId && !!dersId && !!f.baslik.trim() && f.teslim >= BUGUN && (f.tumGrup || f.secili.length > 0);

  const kaydet = () => {
    if (!gecerli) return;
    let n = 0;
    guncelle((x) => {
      const odev: Odev = {
        id: yeniId("od"), ogretmenId: sahip ?? odevOgretmeni(x, grupId, dersId, BUGUN) ?? personel.id,
        dersId, grupId, ogrenciIds: f.tumGrup ? null : f.secili, baslik: f.baslik.trim(), aciklama: f.aciklama.trim(),
        kaynak: [f.kaynak.trim(), f.dosya].filter(Boolean).join(" · "), verilis: BUGUN, teslim: f.teslim, teslimler: {}, notlar: {}, kontrolEdildi: false,
      };
      x.odevler.push(odev);
      for (const o of odevHedefleri(x, odev))
        n += bildirimEkle(x, "yeniOdev", o.id, { ders: dersAdi(dersId), baslik: odev.baslik, teslim: tarihKisa(f.teslim) }, undefined, true);
      islemYaz(x, ad, "Ödev", `${grupEtiket(x, grupId)} — ${odev.baslik}`);
    });
    toast(`Ödev verildi; ${n} veliye bildirim gönderildi.`);
    setF(bos());
    onClose();
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      wide
      title="Yeni ödev"
      footer={<><Button variant="outline" onClick={onClose}>Vazgeç</Button><Button onClick={kaydet} disabled={!gecerli}>Ödevi ver</Button></>}
    >
      <div className="grid gap-3 sm:grid-cols-3">
        <Field label="Grup">
          <Select value={grupId} onChange={(e) => setF({ ...f, grupId: e.target.value, dersId: "", secili: [] })}>
            {gruplar.map((g) => <option key={g.id} value={g.id}>{grupEtiket(d, g.id)}</option>)}
          </Select>
        </Field>
        <Field label="Ders">
          <Select value={dersId} onChange={(e) => setF({ ...f, dersId: e.target.value })}>
            {dersIds.map((id) => <option key={id} value={id}>{tanimlar().dersler.find((x) => x.id === id)?.ad ?? id}</option>)}
          </Select>
        </Field>
        <Field label="Teslim tarihi"><Input type="date" min={BUGUN} value={f.teslim} onChange={(e) => setF({ ...f, teslim: e.target.value })} /></Field>
      </div>
      <Field label="Başlık"><Input maxLength={BASLIK_UZUNLUK} value={f.baslik} onChange={(e) => setF({ ...f, baslik: e.target.value })} placeholder="Kesirler alıştırması" /></Field>
      <Field label="Açıklama"><Textarea className="min-h-16" maxLength={ACIKLAMA_UZUNLUK} value={f.aciklama} onChange={(e) => setF({ ...f, aciklama: e.target.value })} /></Field>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Kaynak"><Input maxLength={KAYNAK_UZUNLUK - 120} value={f.kaynak} onChange={(e) => setF({ ...f, kaynak: e.target.value })} placeholder="Kitap s. 42–48" /></Field>
        <Field label="Ek dosya / fotoğraf"><Input type="file" className="pt-1.5" onChange={(e) => setF({ ...f, dosya: (e.target.files?.[0]?.name ?? "").slice(0, 100) })} /></Field>
      </div>
      <div className="grid gap-2">
        <Checkbox checked={f.tumGrup} onChange={(v) => setF({ ...f, tumGrup: v })} label="Tüm gruba ver" />
        {!f.tumGrup && (
          <div className="grid max-h-40 gap-1.5 overflow-y-auto rounded-md border p-3 sm:grid-cols-2">
            {ogrenciler.map((o) => (
              <Checkbox key={o.id} checked={f.secili.includes(o.id)} onChange={(v) => setF({ ...f, secili: v ? [...f.secili, o.id] : f.secili.filter((x) => x !== o.id) })} label={tamAd(o)} />
            ))}
          </div>
        )}
      </div>
    </Dialog>
  );
}

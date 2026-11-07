/** Hızlı ekle: telefonla arayan veli için 20 saniyelik form (yalnızca veli adı ve telefon zorunlu) */
import * as React from "react";
import { Plus } from "lucide-react";
import { Alert, Button, Checkbox, Dialog, Field, Input, Select, Textarea, toast } from "@/components/ui";
import { useApp, useOturum } from "@/context/AppContext";
import { BUGUN, guncelle, simdiZaman, tanimlar, useDb, yeniId, type Aday } from "@/data/store";
import { telefonNormalize } from "@/lib/kurallar";
import { ADAY_SEVIYELERI, KAYNAKLAR, NOT_EN_FAZLA, adTemizle, varsayilanSorumlu } from "./kurallar";
import { useAdayDenetimi } from "./ortak";

export function HizliEkle({ open, onClose }: { open: boolean; onClose: () => void }) {
  const d = useDb();
  const { subeId } = useApp();
  const { ad: oturumAd, personel, kapsam } = useOturum();
  const denetle = useAdayDenetimi();
  // Yalnızca kapsamdaki aktif şubeler (useOturum().kapsam zaten aktif şubelerdir)
  const subeler = tanimlar().subeler.filter((s) => s.aktif && kapsam.includes(s.id));
  const ilkSube = subeId !== "all" && subeler.some((s) => s.id === subeId) ? subeId : subeler[0]?.id ?? "";
  const [form, setForm] = React.useState({ veliAd: "", veliTelefon: "", ogrenciAd: "", seviye: 5, subeId: ilkSube, kaynak: "Tavsiye", not: "", riza: false });
  const tel = telefonNormalize(form.veliTelefon);

  const taslak = (): Aday => ({
    id: yeniId("a"), veliAd: adTemizle(form.veliAd), veliTelefon: tel ?? form.veliTelefon, ogrenciAd: adTemizle(form.ogrenciAd) || "—", seviye: form.seviye, okul: "",
    subeId: form.subeId,
    // Ekleyen kişi o şubede takip edebiliyorsa sorumlu odur; değilse şubenin sekreteri/müdürü
    sorumluId: varsayilanSorumlu(d.personel, form.subeId, personel.id) ?? personel.id,
    kaynak: form.kaynak, durum: "yeni", sonrakiAksiyon: BUGUN, denemeTarihi: null,
    olusturma: BUGUN, notlar: form.not.trim() ? [{ tarih: simdiZaman(), yazar: oturumAd, metin: form.not.trim() }] : [],
    vazgecmeNedeni: null, teklif: null, rizaVar: form.riza,
  });
  const hata = form.veliAd.trim() && form.veliTelefon.trim() ? denetle(taslak()) : null;
  const gecerli = !!form.veliAd.trim() && !!tel && !hata;

  const ekle = () => {
    if (!gecerli) return;
    const yeni = taslak();
    guncelle((x) => {
      x.adaylar.unshift(yeni);
    });
    toast(`${yeni.veliAd} aday listesine eklendi.`);
    onClose();
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Hızlı aday ekle"
      description="Telefonla arayan veli için 20 saniyelik form. Yalnızca veli adı ve telefon zorunlu."
      footer={
        <>
          <Button variant="outline" onClick={onClose}>Vazgeç</Button>
          <Button onClick={ekle} disabled={!gecerli}><Plus /> Ekle</Button>
        </>
      }
    >
      {subeler.length === 0 && <Alert tone="warning">Aday ekleyebileceğiniz aktif bir şube yok.</Alert>}
      {hata && tel && <Alert tone="warning">{hata}</Alert>}
      <div className="grid grid-cols-2 gap-3">
        <Field label="Veli adı soyadı *"><Input autoFocus maxLength={80} value={form.veliAd} onChange={(e) => setForm({ ...form, veliAd: e.target.value })} /></Field>
        <Field label="Telefon *" hint={form.veliTelefon && !tel ? "Geçersiz numara" : undefined}>
          <Input value={form.veliTelefon} onChange={(e) => setForm({ ...form, veliTelefon: e.target.value })} placeholder="05xx…" />
        </Field>
        <Field label="Öğrenci adı"><Input maxLength={80} value={form.ogrenciAd} onChange={(e) => setForm({ ...form, ogrenciAd: e.target.value })} /></Field>
        <Field label="Sınıf">
          <Select value={form.seviye} onChange={(e) => setForm({ ...form, seviye: Number(e.target.value) })}>
            {ADAY_SEVIYELERI.map((s) => <option key={s} value={s}>{s}. sınıf</option>)}
          </Select>
        </Field>
        <Field label="Şube">
          <Select value={form.subeId} onChange={(e) => setForm({ ...form, subeId: e.target.value })}>
            {subeler.map((s) => <option key={s.id} value={s.id}>{s.ad}</option>)}
          </Select>
        </Field>
        <Field label="Kaynak">
          <Select value={form.kaynak} onChange={(e) => setForm({ ...form, kaynak: e.target.value })}>
            {KAYNAKLAR.map((k) => <option key={k}>{k}</option>)}
          </Select>
        </Field>
      </div>
      <Field label="Not"><Textarea className="min-h-16" maxLength={NOT_EN_FAZLA} value={form.not} onChange={(e) => setForm({ ...form, not: e.target.value })} /></Field>
      <Checkbox checked={form.riza} onChange={(v) => setForm({ ...form, riza: v })} label="Veli, iletişim için sözlü onay verdi (KVKK açık rıza)" />
    </Dialog>
  );
}

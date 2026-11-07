/** Web formu önizlemesi (kurum sitesine / Instagram'a konacak ön kayıt linki). Açık rıza zorunlu. */
import * as React from "react";
import { Alert, Button, Checkbox, Dialog, Field, Input, Select, toast } from "@/components/ui";
import { useOturum } from "@/context/AppContext";
import { BUGUN, guncelle, simdiZaman, smsBoyuMaliyet, sube, tanimlar, useDb, yeniId, type Aday } from "@/data/store";
import { sablonDoldur, telefonNormalize, tl } from "@/lib/kurallar";
import { ADAY_SEVIYELERI, adTemizle, varsayilanSorumlu } from "./kurallar";
import { useAdayDenetimi } from "./ortak";

export function WebFormu({ open, onClose }: { open: boolean; onClose: () => void }) {
  const d = useDb();
  const { kapsam } = useOturum();
  const denetle = useAdayDenetimi();
  // Önizleme personel oturumuyla gönderilir: yalnızca kapsamdaki aktif şubeler seçilebilir
  const subeler = tanimlar().subeler.filter((s) => s.aktif && kapsam.includes(s.id));
  const [form, setForm] = React.useState({ veliAd: "", veliTelefon: "", ogrenciAd: "", seviye: 5, subeId: subeler[0]?.id ?? "", riza: false });
  const tel = telefonNormalize(form.veliTelefon);
  const sorumlu = varsayilanSorumlu(d.personel, form.subeId);

  const taslak = (): Aday => ({
    id: yeniId("a"), veliAd: adTemizle(form.veliAd), veliTelefon: tel ?? form.veliTelefon, ogrenciAd: adTemizle(form.ogrenciAd) || "—", seviye: form.seviye, okul: "",
    subeId: form.subeId, sorumluId: sorumlu ?? "", kaynak: "Web formu", durum: "yeni", sonrakiAksiyon: BUGUN,
    denemeTarihi: null, olusturma: BUGUN, notlar: [{ tarih: simdiZaman(), yazar: "Web formu", metin: "Ön kayıt formu dolduruldu." }],
    vazgecmeNedeni: null, teklif: null, rizaVar: form.riza,
  });
  const hata = form.veliAd.trim() && tel ? denetle(taslak()) : null;
  const gecerli = !!form.veliAd.trim() && !!tel && form.riza && !hata;

  const gonder = () => {
    if (!gecerli) return;
    const s = sube(form.subeId)!;
    const yeni = taslak();
    const olay = d.olaylar.find((o) => o.key === "onKayitTesekkur");
    guncelle((x) => {
      x.adaylar.unshift(yeni);
      if (olay?.aktif) {
        const metin = sablonDoldur(olay.sablon, { sube_adi: s.ad, sube_telefonu: s.telefon });
        // Durumu sunucu "bekliyor" yapar ve gönderim kuyruğu iletir
        x.gonderimler.push({
          id: yeniId("gn"), zaman: simdiZaman(), olay: "onKayitTesekkur", veliId: null, alici: `${yeni.veliAd} · ${tel}`, ogrenciId: null,
          subeId: form.subeId, kanal: "sms", metin, durum: "bekliyor", maliyet: smsBoyuMaliyet(x, metin),
        });
      }
    });
    toast(olay?.aktif ? "Form gönderildi; veliye teşekkür SMS'i kuyruğa alındı." : "Form gönderildi.");
    onClose();
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Ön kayıt formu (önizleme)"
      description="Bu form kurumun web sitesine ve Instagram profiline link olarak konur: classmate.app/on-kayit"
      footer={
        <>
          <Button variant="outline" onClick={onClose}>Kapat</Button>
          <Button onClick={gonder} disabled={!gecerli}>Formu gönder</Button>
        </>
      }
    >
      {hata && <Alert tone="warning">{hata}</Alert>}
      <div className="grid grid-cols-2 gap-3">
        <Field label="Adınız soyadınız"><Input maxLength={80} value={form.veliAd} onChange={(e) => setForm({ ...form, veliAd: e.target.value })} /></Field>
        <Field label="Cep telefonunuz" hint={form.veliTelefon && !tel ? "Geçersiz numara" : undefined}>
          <Input value={form.veliTelefon} onChange={(e) => setForm({ ...form, veliTelefon: e.target.value })} />
        </Field>
        <Field label="Öğrencinin adı"><Input maxLength={80} value={form.ogrenciAd} onChange={(e) => setForm({ ...form, ogrenciAd: e.target.value })} /></Field>
        <Field label="Sınıfı">
          <Select value={form.seviye} onChange={(e) => setForm({ ...form, seviye: Number(e.target.value) })}>
            {ADAY_SEVIYELERI.map((s) => <option key={s} value={s}>{s}. sınıf</option>)}
          </Select>
        </Field>
      </div>
      <Field label="Size en yakın şube">
        <Select value={form.subeId} onChange={(e) => setForm({ ...form, subeId: e.target.value })}>
          {subeler.map((s) => <option key={s.id} value={s.id}>{s.ad}{s.adres ? ` — ${s.adres}` : ""}</option>)}
        </Select>
      </Field>
      <Checkbox
        checked={form.riza}
        onChange={(v) => setForm({ ...form, riza: v })}
        label="Aydınlatma metnini okudum; bilgi verilmesi amacıyla benimle iletişime geçilmesine onay veriyorum."
      />
      <p className="text-xs text-muted-foreground">Gönderimden sonra veliye otomatik “Teşekkürler, sizi arayacağız” mesajı gider ({tl(d.ayarlar.smsBirimFiyat)} / SMS).</p>
    </Dialog>
  );
}

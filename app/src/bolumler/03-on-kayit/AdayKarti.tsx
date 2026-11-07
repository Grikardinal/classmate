/** Aday kartı: veli/öğrenci bilgisi, durum, şube devri, sorumlu, teklif, KVKK bilgisi, görüşme notları */
import * as React from "react";
import { useNavigate } from "react-router-dom";
import { MessageSquarePlus, PhoneCall, UserCheck } from "lucide-react";
import { Alert, Badge, Button, Field, Input, Select, Sheet, toast } from "@/components/ui";
import { useApp, useOturum } from "@/context/AppContext";
import { guncelle, islemYaz, personelAdi, simdiZaman, sube, tanimlar, useDb, type Aday, type AdayDurum } from "@/data/store";
import { telefonNormalize } from "@/lib/kurallar";
import {
  ADAY_DURUMLARI,
  ADAY_SEVIYELERI,
  KAYNAKLAR,
  NOT_EN_FAZLA,
  VAZGECME_NEDENLERI,
  adTemizle,
  anonimMi,
  durumBilgisi,
  kesinKayitEngeli,
  sorumluAdaylari,
  varsayilanSorumlu,
} from "./kurallar";
import { tarihKisa, useAdayDenetimi, useKapsamDisi } from "./ortak";

export function AdayKarti({ id, onClose }: { id: string; onClose: () => void }) {
  const d = useDb();
  const { moduller } = useApp();
  const { ad: oturumAd, yetki } = useOturum();
  const kapsamDisi = useKapsamDisi();
  const navigate = useNavigate();
  const denetle = useAdayDenetimi();
  const a = d.adaylar.find((x) => x.id === id);
  const [form, setForm] = React.useState(a);
  const [not, setNot] = React.useState("");
  if (!a || !form) return null;

  const anonim = anonimMi(a);
  const kapali = a.durum === "kayit" || anonim;
  const kesinKayitHatasi = kesinKayitEngeli(a);

  /** Formun kaydedilecek hali (telefon tek biçime, ad boşlukları temizlenir) */
  const sonHal = (): Aday => {
    const notlar = [...form.notlar];
    if (form.durum !== a.durum) notlar.push({ tarih: simdiZaman(), yazar: oturumAd, metin: `Durum: ${durumBilgisi(form.durum).ad}` });
    if (form.subeId !== a.subeId) notlar.push({ tarih: simdiZaman(), yazar: oturumAd, metin: `${sube(a.subeId)?.ad} → ${sube(form.subeId)?.ad} şubesine devredildi` });
    return {
      ...form,
      veliAd: adTemizle(form.veliAd),
      ogrenciAd: adTemizle(form.ogrenciAd) || "—",
      okul: form.okul.trim(),
      veliTelefon: telefonNormalize(form.veliTelefon) ?? form.veliTelefon,
      notlar,
      vazgecmeNedeni: form.durum === "vazgecti" ? form.vazgecmeNedeni ?? "Diğer" : null,
    };
  };
  const hata = kapali ? null : denetle(sonHal(), a);

  const disariDevir = form.subeId !== a.subeId && kapsamDisi(form.subeId);
  const kaydet = () => {
    const yeni = sonHal();
    const h = denetle(yeni, a);
    if (h) {
      toast(h, "hata");
      return;
    }
    if (disariDevir && !window.confirm(`Aday ${sube(yeni.subeId)?.ad} şubesine devredilecek. Devirden sonra bu adayı göremeyeceksiniz. Devam edilsin mi?`)) return;
    guncelle((x) => {
      // İşlem kaydı devreden şubeye yazılır (kapsam dışına devirde de devredenin kapsamında kalır)
      if (yeni.subeId !== a.subeId) islemYaz(x, oturumAd, "Aday devri", `${a.ogrenciAd}: ${sube(a.subeId)?.kod} → ${sube(yeni.subeId)?.kod}`, a.subeId);
      x.adaylar = x.adaylar.map((y) => (y.id === id ? yeni : y));
    });
    toast(disariDevir ? `Aday ${sube(yeni.subeId)?.ad} şubesine devredildi.` : "Aday kaydedildi.");
    onClose();
  };
  const notEkle = () => {
    const metin = not.trim();
    if (!metin || kapali) return;
    const yeniNot = { tarih: simdiZaman(), yazar: oturumAd, metin };
    const kayitli = { ...a, notlar: [...a.notlar, yeniNot] };
    const h = denetle(kayitli, a);
    if (h) {
      toast(h, "hata");
      return;
    }
    setForm({ ...form, notlar: [...form.notlar, yeniNot] });
    guncelle((x) => {
      x.adaylar = x.adaylar.map((y) => (y.id === id ? { ...y, notlar: [...y.notlar, yeniNot] } : y));
    });
    setNot("");
  };
  const sorumlular = sorumluAdaylari(d.personel, form.subeId);
  // Kapsam dışına devirde sorumlu hedef şubenin varsayılan sorumlusu olur (sunucu da bunu ister)
  const subeSec = (subeId: string) =>
    setForm({ ...form, subeId, sorumluId: varsayilanSorumlu(d.personel, subeId, subeId !== a.subeId && kapsamDisi(subeId) ? undefined : form.sorumluId) ?? form.sorumluId });
  // Devir hedefi: tüm aktif şubeler (karar 2026-11-07) ve mevcut şube
  const subeSecenekleri = tanimlar().subeler.filter((s) => s.aktif || s.id === a.subeId);

  return (
    <Sheet
      open
      onClose={onClose}
      wide
      title={a.ogrenciAd}
      description={
        <span className="flex flex-wrap items-center gap-2">
          <Badge variant={durumBilgisi(a.durum).renk}>{durumBilgisi(a.durum).ad}</Badge>
          {a.seviye}. sınıf{a.okul ? ` · ${a.okul}` : ""} · eklendi {tarihKisa(a.olusturma)}
        </span>
      }
      footer={
        <>
          {!kapali && yetki("04") && (
            <Button
              variant="outline"
              className="mr-auto"
              disabled={!!kesinKayitHatasi}
              title={kesinKayitHatasi ?? undefined}
              onClick={() => navigate(`/ogrenciler/yeni?aday=${a.id}`)}
            >
              <UserCheck /> Kesin kayda çevir
            </Button>
          )}
          <Button variant="outline" onClick={onClose}>Kapat</Button>
          {!kapali && <Button onClick={kaydet} disabled={!!hata}>{disariDevir ? "Devret" : "Kaydet"}</Button>}
        </>
      }
    >
      <div className="grid gap-6">
        {a.durum === "kayit" && (
          <Alert tone="success" icon={<UserCheck />}>
            Bu aday kesin kayda çevrildi; bilgileri artık öğrenci kartından yönetilir.{" "}
            {a.ogrenciId && (
              <button className="font-medium underline" onClick={() => navigate(`/ogrenciler/${a.ogrenciId}`)}>
                Öğrenci kartını aç
              </button>
            )}
          </Alert>
        )}
        {anonim && <Alert tone="warning">Bu adayın kişisel verileri KVKK saklama süresi dolduğu için anonimleştirildi.</Alert>}
        {hata && <Alert tone="danger">{hata}</Alert>}
        {disariDevir && !hata && (
          <Alert tone="warning">
            {sube(form.subeId)?.ad} şubesi yetki kapsamınız dışında: devirden sonra bu adayı göremeyeceksiniz. Devirde adayın diğer bilgileri değiştirilemez;
            sorumlu, hedef şubenin personelinden atanır.
          </Alert>
        )}
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Veli adı soyadı *">
            <Input value={form.veliAd} disabled={kapali} maxLength={80} onChange={(e) => setForm({ ...form, veliAd: e.target.value })} />
          </Field>
          <Field label="Telefon *" hint={!kapali && form.veliTelefon && !telefonNormalize(form.veliTelefon) ? "Geçersiz numara" : undefined}>
            <div className="flex gap-2">
              <Input value={form.veliTelefon} disabled={kapali} onChange={(e) => setForm({ ...form, veliTelefon: e.target.value })} />
              {!anonim && (
                <a href={`tel:${form.veliTelefon.replace(/\s/g, "")}`} className="grid size-9 shrink-0 place-items-center rounded-md border hover:bg-muted" aria-label="Ara">
                  <PhoneCall className="size-4" />
                </a>
              )}
            </div>
          </Field>
          <Field label="Öğrenci adı">
            <Input value={form.ogrenciAd === "—" ? "" : form.ogrenciAd} disabled={kapali} maxLength={80} onChange={(e) => setForm({ ...form, ogrenciAd: e.target.value })} />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Sınıf">
              <Select value={form.seviye} disabled={kapali} onChange={(e) => setForm({ ...form, seviye: Number(e.target.value) })}>
                {ADAY_SEVIYELERI.map((s) => (
                  <option key={s} value={s}>{s}. sınıf</option>
                ))}
              </Select>
            </Field>
            <Field label="Okulu">
              <Input value={form.okul} disabled={kapali} maxLength={120} onChange={(e) => setForm({ ...form, okul: e.target.value })} />
            </Field>
          </div>
          <Field label="Durum">
            <Select value={form.durum} disabled={kapali} onChange={(e) => setForm({ ...form, durum: e.target.value as AdayDurum })}>
              {ADAY_DURUMLARI.filter((x) => x.key !== "kayit" || a.durum === "kayit").map((x) => (
                <option key={x.key} value={x.key}>{x.ad}</option>
              ))}
            </Select>
          </Field>
          <Field label="Sonraki aksiyon tarihi" hint="Bu tarihte “Bugün aranacaklar” listesine düşer.">
            <Input type="date" disabled={kapali} value={form.sonrakiAksiyon ?? ""} onChange={(e) => setForm({ ...form, sonrakiAksiyon: e.target.value || null })} />
          </Field>
          {form.durum === "deneme" && (
            <Field label="Deneme dersi tarihi" hint="Bir gün önce veliye hatırlatma gider.">
              <Input type="date" disabled={kapali} value={form.denemeTarihi ?? ""} onChange={(e) => setForm({ ...form, denemeTarihi: e.target.value || null })} />
            </Field>
          )}
          {form.durum === "vazgecti" && (
            <Field label="Vazgeçme nedeni">
              <Select value={form.vazgecmeNedeni ?? "Diğer"} disabled={kapali} onChange={(e) => setForm({ ...form, vazgecmeNedeni: e.target.value })}>
                {VAZGECME_NEDENLERI.map((n) => (
                  <option key={n}>{n}</option>
                ))}
                {form.vazgecmeNedeni && !VAZGECME_NEDENLERI.includes(form.vazgecmeNedeni) && <option>{form.vazgecmeNedeni}</option>}
              </Select>
            </Field>
          )}
          <Field label="İlgilendiği şube" hint="Herhangi bir aktif şubeye devredilebilir.">
            <Select value={form.subeId} disabled={kapali} onChange={(e) => subeSec(e.target.value)}>
              {subeSecenekleri.map((s) => (
                <option key={s.id} value={s.id}>{s.ad}{s.aktif ? "" : " (pasif)"}</option>
              ))}
            </Select>
          </Field>
          <Field label="Sorumlu personel" hint={disariDevir ? "Devirde hedef şubenin sekreteri (yoksa müdürü) atanır." : undefined}>
            <Select value={form.sorumluId} disabled={kapali || disariDevir} onChange={(e) => setForm({ ...form, sorumluId: e.target.value })}>
              {sorumlular.map((p) => (
                <option key={p.id} value={p.id}>{p.ad} {p.soyad}</option>
              ))}
              {!sorumlular.some((p) => p.id === form.sorumluId) && <option value={form.sorumluId}>{personelAdi(d, form.sorumluId)}</option>}
            </Select>
          </Field>
          <Field label="Kaynak">
            <Select value={form.kaynak} disabled={kapali} onChange={(e) => setForm({ ...form, kaynak: e.target.value })}>
              {KAYNAKLAR.map((k) => (
                <option key={k}>{k}</option>
              ))}
              {!KAYNAKLAR.includes(form.kaynak) && <option>{form.kaynak}</option>}
            </Select>
          </Field>
          {moduller.finans && (
            <Field label="Verilen fiyat teklifi (₺)">
              <Input type="number" min={0} disabled={kapali} value={form.teklif ?? ""} onChange={(e) => setForm({ ...form, teklif: e.target.value ? Number(e.target.value) : null })} />
            </Field>
          )}
        </div>

        <div className="rounded-md border p-3 text-xs text-muted-foreground">
          KVKK: iletişim izni (açık rıza) {a.rizaVar ? <b className="text-success">alındı</b> : <b className="text-danger">alınmadı</b>}. Vazgeçen adayların verisi{" "}
          {d.ayarlar.saklamaAyAday} ay sonra anonimleştirilir.
        </div>

        <div>
          <p className="mb-3 text-sm font-medium">Görüşme notları</p>
          <ol className="relative grid gap-4 border-l pl-5">
            {[...form.notlar].reverse().map((n, i) => (
              <li key={i} className="relative">
                <span className="absolute -left-[25px] top-1 size-2.5 rounded-full border-2 border-card bg-primary" />
                <p className="text-sm">{n.metin}</p>
                <p className="text-xs text-muted-foreground">
                  {n.yazar} · {new Date(n.tarih).toLocaleString("tr-TR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                </p>
              </li>
            ))}
          </ol>
          {!kapali && (
            <div className="mt-4 flex gap-2">
              <Input
                placeholder="Not ekle (örn. Cumartesi tekrar aranacak)"
                maxLength={NOT_EN_FAZLA}
                value={not}
                onChange={(e) => setNot(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && notEkle()}
              />
              <Button variant="outline" onClick={notEkle} disabled={!not.trim()}>
                <MessageSquarePlus /> Ekle
              </Button>
            </div>
          )}
        </div>
      </div>
    </Sheet>
  );
}

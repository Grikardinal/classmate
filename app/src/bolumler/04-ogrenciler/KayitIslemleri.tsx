/** Kayıt işlemleri: grup değişikliği, şube nakli ve kayıt iptali (kurallar: ./kurallar.ts, sunucu: kayitDenetle) */
import * as React from "react";
import { AlertTriangle } from "lucide-react";
import { Alert, Button, Checkbox, Dialog, Field, Select, Textarea, toast } from "@/components/ui";
import { useApp, useOturum } from "@/context/AppContext";
import { BUGUN, grupDoluluk, grupEtiket, guncelle, islemYaz, simdiZaman, sube, taksitKalan, tamAd, tanimlar, useDb, type Db, type Kayit, type Ogrenci } from "@/data/store";
import { tl } from "@/lib/kurallar";
import { adayYenidenAc, bagliAday, grupDoluMu, iptalSonrasiOgrenciDurumu, kapasiteOnaylayabilir } from "./kurallar";

/* ---------- Grup değişikliği / şube nakli ---------- */
export function GrupDegistir({ k, o, nakil, onClose }: { k: Kayit; o: Ogrenci; nakil: boolean; onClose: () => void }) {
  const d = useDb();
  const { moduller } = useApp();
  const { ad, kapsam, rol } = useOturum();
  const [hedef, setHedef] = React.useState("");
  const [kapasiteOnay, setKapasiteOnay] = React.useState(false);
  // Aynı sezonun grupları; nakilde kapsamdaki diğer aktif şubeler (iki şubede de yetki gerekir)
  const aktifSube = (id: string) => !!tanimlar().subeler.find((s) => s.id === id)?.aktif;
  const adaylar = d.gruplar.filter(
    (g) => g.sezonId === k.sezonId && g.id !== k.grupId && aktifSube(g.subeId) && (nakil ? g.subeId !== k.subeId && kapsam.includes(g.subeId) : g.subeId === k.subeId),
  );
  const hedefGrup = adaylar.find((g) => g.id === hedef);
  const kalanTaksit = d.taksitler.filter((t) => t.kayitId === k.id && taksitKalan(t) > 0);
  // Dondurulmuş kayıt doluluğa sayılmaz
  const dolu = !!hedefGrup && k.durum === "aktif" && grupDoluMu(d, hedefGrup.id);
  const yonetici = kapasiteOnaylayabilir(rol);
  const engel = !hedefGrup ? "Yeni grup seçin." : dolu && !yonetici ? "Grup dolu; kapasite aşımını yalnızca şube müdürü veya genel yönetici onaylayabilir." : dolu && !kapasiteOnay ? "Kapasite aşımını onaylayın." : null;

  const uygula = () => {
    if (engel || !hedefGrup) return;
    guncelle((x) => {
      x.kayitlar = x.kayitlar.map((y) =>
        y.id === k.id ? { ...y, grupId: hedefGrup.id, subeId: hedefGrup.subeId, grupGecmisi: [...y.grupGecmisi, { grupId: hedefGrup.id, tarih: BUGUN }] } : y,
      );
      if (nakil) {
        // Kalan taksitler yeni şubeye devredilir; ödenmiş tutarlar eski şubenin kasasında kalır.
        x.taksitler = x.taksitler.map((t) => (t.kayitId === k.id && taksitKalan(t) > 0 ? { ...t, subeId: hedefGrup.subeId } : t));
      }
      if (dolu) islemYaz(x, ad, "Kapasite aşımı", `${grupEtiket(x, hedefGrup.id)} grubuna kapasite üstü geçiş onaylandı`, hedefGrup.subeId);
      const yer = nakil ? ` (${sube(k.subeId)?.kod} → ${sube(hedefGrup.subeId)?.kod})` : "";
      islemYaz(x, ad, nakil ? "Şube nakli" : "Grup değişikliği", `${tamAd(o)}: ${grupEtiket(x, k.grupId)} → ${grupEtiket(x, hedefGrup.id)}${yer}`, hedefGrup.subeId);
    });
    toast(nakil ? `Nakil tamamlandı: ${sube(hedefGrup.subeId)?.ad}` : "Grup değiştirildi.");
    onClose();
  };

  return (
    <Dialog
      open
      onClose={onClose}
      title={nakil ? "Şube nakli" : "Grup değiştir"}
      description={`${tamAd(o)} · şu an ${grupEtiket(d, k.grupId)}. Kayıt ve sözleşme numarası bozulmaz, tarihçe tutulur.`}
      footer={<><Button variant="outline" onClick={onClose}>Vazgeç</Button><Button onClick={uygula} disabled={!!engel}>Uygula</Button></>}
    >
      <Field label="Yeni grup">
        <Select value={hedef} onChange={(e) => { setHedef(e.target.value); setKapasiteOnay(false); }}>
          <option value="">Seçiniz</option>
          {adaylar.map((g) => (
            <option key={g.id} value={g.id}>{grupEtiket(d, g.id)} · {g.seviye}. sınıf ({grupDoluluk(d, g.id)}/{g.kapasite})</option>
          ))}
        </Select>
      </Field>
      {adaylar.length === 0 && <p className="text-sm text-muted-foreground">{nakil ? "Nakil için yetkili olduğunuz başka aktif şubede grup yok." : "Uygun grup yok."}</p>}
      {dolu && (
        <Alert tone="warning" icon={<AlertTriangle />}>
          <p>Bu grubun kontenjanı dolu. Kapasite üstü geçiş yalnızca şube müdürü veya genel yönetici onayıyla yapılır.</p>
          {yonetici && <div className="mt-2"><Checkbox checked={kapasiteOnay} onChange={setKapasiteOnay} label="Kapasite aşımını onaylıyorum (işlem kaydına yazılır)" /></div>}
        </Alert>
      )}
      {nakil && moduller.finans && kalanTaksit.length > 0 && (
        <Alert tone="warning" icon={<AlertTriangle />}>
          {kalanTaksit.length} açık taksit ({tl(kalanTaksit.reduce((s, t) => s + taksitKalan(t), 0))}) yeni şubeye devredilecek. Fiyat farkı varsa yönetici onayıyla düzeltme kalemi ekleyin.
        </Alert>
      )}
    </Dialog>
  );
}

/* ---------- Kayıt iptali ---------- */
export function KayitIptal({ k, o, onClose }: { k: Kayit; o: Ogrenci; onClose: () => void }) {
  const d = useDb();
  const { moduller } = useApp();
  const { ad } = useOturum();
  const [neden, setNeden] = React.useState("");
  const kalan = d.taksitler.filter((t) => t.kayitId === k.id).reduce((s, t) => s + taksitKalan(t), 0);
  const sonKayit = iptalSonrasiOgrenciDurumu(o.id, d.kayitlar.map((y) => (y.id === k.id ? { ...y, durum: "iptal" as const } : y))) === "ayrildi";
  const aday = sonKayit ? bagliAday(o.id, d.adaylar) : undefined;

  const iptal = () => {
    guncelle((x: Db) => {
      x.kayitlar = x.kayitlar.map((y) => (y.id === k.id ? { ...y, durum: "iptal" } : y));
      const durum = iptalSonrasiOgrenciDurumu(o.id, x.kayitlar);
      x.ogrenciler = x.ogrenciler.map((y) => (y.id === o.id ? { ...y, durum } : y));
      // Karar 2026-11-07: öğrencinin son kaydı iptal edilince adayı yeniden açılır (görünmüyorsa sunucu açar)
      const a = durum === "ayrildi" ? bagliAday(o.id, x.adaylar) : undefined;
      if (a) {
        const not = { tarih: simdiZaman(), yazar: ad, metin: `Kayıt iptal edildi (${k.sozlesmeNo}); aday yeniden açıldı.` };
        x.adaylar = x.adaylar.map((y) => (y.id === a.id ? adayYenidenAc(y, not, BUGUN) : y));
      }
      islemYaz(x, ad, "Kayıt iptali", `${tamAd(o)} — ${k.sozlesmeNo}. Neden: ${neden.trim()}`, k.subeId);
    });
    toast(aday ? "Kayıt iptal edildi; ön kayıt adayı yeniden açıldı (Görüşüldü)." : "Kayıt iptal edildi; öğrenci gruptan çıkarıldı, geçmiş korunuyor.");
    onClose();
  };
  return (
    <Dialog
      open
      onClose={onClose}
      title="Kaydı iptal et"
      description={`${tamAd(o)} · ${k.sozlesmeNo}. Öğrenci gruptan çıkar; yoklama ve ödeme geçmişi korunur. İptal geri alınamaz.`}
      footer={<><Button variant="outline" onClick={onClose}>Vazgeç</Button><Button variant="destructive" onClick={iptal} disabled={neden.trim().length < 3}>İptal et</Button></>}
    >
      <Field label="İptal nedeni (işlem kaydına yazılır)"><Textarea value={neden} onChange={(e) => setNeden(e.target.value)} /></Field>
      {aday && <Alert icon={<AlertTriangle />}>Bu öğrenci ön kayıttan geldi; aday “Görüşüldü” durumunda yeniden açılacak ve bugün aranacaklar listesine düşecek.</Alert>}
      {moduller.finans && kalan > 0 && (
        <Alert tone="warning" icon={<AlertTriangle />}>Kalan borç: <b>{tl(kalan)}</b>. İade / kalan borç hesabı Finans bölümünden yapılır.</Alert>
      )}
    </Dialog>
  );
}

/** Kayıt işlemleri: grup değişikliği, şube nakli ve kayıt iptali (kurallar: ./kurallar.ts, sunucu: kayitDenetle) */
import * as React from "react";
import { AlertTriangle } from "lucide-react";
import { Alert, Button, Checkbox, Dialog, Field, Input, Select, Textarea, toast } from "@/components/ui";
import { useApp, useOturum } from "@/context/AppContext";
import { useNavigate } from "react-router-dom";
import { AKTIF_SEZON, BUGUN, grupDoluluk, grupEtiket, guncelle, islemYaz, senkron, simdiZaman, sube, taksitKalan, tamAd, tanimlar, useDb, veriYukle, yeniId, type Db, type Iade, type Kayit, type Ogrenci } from "@/data/store";
import { tl } from "@/lib/kurallar";
import { YONTEMLER, hizmetBaslangici, iptalHesabiHesapla, iptalTaksitleri, kayitPlani, kurusa, tutarCoz, yeniMakbuzNo, yontemAdlari } from "../05-finans/kurallar";
import { adayYenidenAc, bagliAday, grupDoluMu, iptalSonrasiOgrenciDurumu, kapasiteOnaylayabilir } from "./kurallar";

/* ---------- Grup değişikliği / şube nakli ---------- */
export function GrupDegistir({ k, o, nakil, onClose }: { k: Kayit; o: Ogrenci; nakil: boolean; onClose: () => void }) {
  const d = useDb();
  const navigate = useNavigate();
  const { moduller } = useApp();
  const { ad, kapsam, rol } = useOturum();
  const [hedefSube, setHedefSube] = React.useState("");
  const [hedef, setHedef] = React.useState("");
  const [kapasiteOnay, setKapasiteOnay] = React.useState(false);
  const [disariOnay, setDisariOnay] = React.useState(false);
  // Nakilde hedef: kaydın şubesi dışındaki aktif şubeler (karar 2026-11-07: kapsam dışındakiler de)
  const subeler = tanimlar().subeler.filter((s) => s.aktif && s.id !== k.subeId);
  const grupSubesi = nakil ? hedefSube : k.subeId;
  // Kapsam dışına nakil: hedef şubenin grupları görünmez, grubu sunucu atar (aynı seviye, boş kontenjan)
  const disari = nakil && !!hedefSube && !kapsam.includes(hedefSube);
  const adaylar = disari ? [] : d.gruplar.filter((g) => g.sezonId === k.sezonId && g.id !== k.grupId && g.subeId === grupSubesi);
  const hedefGrup = adaylar.find((g) => g.id === hedef);
  const kalanTaksit = d.taksitler.filter((t) => t.kayitId === k.id && taksitKalan(t) > 0);
  // Dondurulmuş kayıt doluluğa sayılmaz
  const dolu = !!hedefGrup && k.durum === "aktif" && grupDoluMu(d, hedefGrup.id);
  const yonetici = kapasiteOnaylayabilir(rol);
  const engel = disari
    ? k.sezonId !== AKTIF_SEZON
      ? "Yalnızca aktif sezonun kaydı başka şubeye nakledilebilir."
      : !disariOnay
        ? "Nakilden sonra öğrenciyi göremeyeceğinizi onaylayın."
        : null
    : nakil && !hedefSube
      ? "Hedef şube seçin."
      : !hedefGrup
        ? "Yeni grup seçin."
        : dolu && !yonetici
          ? "Grup dolu; kapasite aşımını yalnızca sekreter, şube müdürü veya genel yönetici onaylayabilir."
          : dolu && !kapasiteOnay
            ? "Kapasite aşımını onaylayın."
            : null;

  const uygula = () => {
    if (engel) return;
    if (disari) {
      // Yalnızca şube değişir; grup, grup geçmişi ve kalan taksitlerin devri sunucuda yapılır.
      // İşlem kaydı devreden şubeye yazılır (Bölüm 03 aday devri gibi; devredenin kapsamında kalır).
      guncelle((x) => {
        x.kayitlar = x.kayitlar.map((y) => (y.id === k.id ? { ...y, subeId: hedefSube, grupId: "", grupGecmisi: [...y.grupGecmisi, { grupId: "", tarih: BUGUN }] } : y));
        islemYaz(x, ad, "Şube nakli", `${tamAd(o)}: ${grupEtiket(x, k.grupId)} → ${sube(hedefSube)?.ad} (${sube(k.subeId)?.kod} → ${sube(hedefSube)?.kod})`, k.subeId);
      });
      void senkron().then(() => veriYukle()).catch(() => undefined);
      toast(`Nakil tamamlandı: ${sube(hedefSube)?.ad}. Öğrenci artık kapsamınızda değil.`);
      onClose();
      navigate("/ogrenciler");
      return;
    }
    if (!hedefGrup) return;
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
      footer={<><Button variant="outline" onClick={onClose}>Vazgeç</Button><Button onClick={uygula} disabled={!!engel}>{disari ? "Nakledin" : "Uygula"}</Button></>}
    >
      {nakil && (
        <Field label="Hedef şube">
          <Select value={hedefSube} onChange={(e) => { setHedefSube(e.target.value); setHedef(""); setKapasiteOnay(false); setDisariOnay(false); }}>
            <option value="">Seçiniz</option>
            {subeler.map((s) => (
              <option key={s.id} value={s.id}>{s.ad}{kapsam.includes(s.id) ? "" : " (kapsamınız dışında)"}</option>
            ))}
          </Select>
        </Field>
      )}
      {nakil && subeler.length === 0 && <p className="text-sm text-muted-foreground">Nakil için başka aktif şube yok.</p>}
      {!disari && (!nakil || hedefSube) && (
        <Field label="Yeni grup">
          <Select value={hedef} onChange={(e) => { setHedef(e.target.value); setKapasiteOnay(false); }}>
            <option value="">Seçiniz</option>
            {adaylar.map((g) => (
              <option key={g.id} value={g.id}>{grupEtiket(d, g.id)} · {g.seviye}. sınıf ({grupDoluluk(d, g.id)}/{g.kapasite})</option>
            ))}
          </Select>
        </Field>
      )}
      {!disari && (!nakil || hedefSube) && adaylar.length === 0 && <p className="text-sm text-muted-foreground">Uygun grup yok.</p>}
      {disari && (
        <Alert tone="warning" icon={<AlertTriangle />}>
          <p>
            {sube(hedefSube)?.ad} şubesi yetki kapsamınız dışında: <b>nakilden sonra bu öğrenciyi göremeyeceksiniz.</b> Öğrenci hedef şubede aynı seviyedeki
            boş kontenjanlı gruba yerleştirilir; uygun grup yoksa nakil reddedilir. Kayıtta şube ve grup dışında bir şey değişmez.
          </p>
          <div className="mt-2"><Checkbox checked={disariOnay} onChange={setDisariOnay} label="Anladım, öğrenciyi nakledin" /></div>
        </Alert>
      )}
      {dolu && (
        <Alert tone="warning" icon={<AlertTriangle />}>
          <p>Bu grubun kontenjanı dolu. Kapasite üstü geçiş sekreter, şube müdürü veya genel yönetici onayıyla yapılır (işlem kaydına yazılır).</p>
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
  const { ad, rol } = useOturum();
  const [neden, setNeden] = React.useState("");
  const sonKayit = iptalSonrasiOgrenciDurumu(o.id, d.kayitlar.map((y) => (y.id === k.id ? { ...y, durum: "iptal" as const } : y))) === "ayrildi";
  const aday = sonKayit ? bagliAday(o.id, d.adaylar) : undefined;

  // Bölüm 05 (karar 2026-11-08): finans açıksa iptal hesabı — kullanılan (gün oranı) + cayma bedeli → iade veya kalan borç
  const yonetici = rol === "genel-yonetici" || rol === "sube-muduru";
  const plan = kayitPlani(d.taksitler, k.id);
  const hesapVar = moduller.finans && plan.length > 0;
  const sezon = d.sezonlar.find((z) => z.id === k.sezonId);
  const varsayilan = iptalHesabiHesapla(plan, k, sezon, d.kurum?.caymaBedeli, BUGUN);
  const [duz, setDuz] = React.useState({ kullanilan: String(varsayilan.kullanilan), cayma: String(varsayilan.cayma), neden: "", yontem: "nakit" as Iade["yontem"] });
  const ozel = { kullanilan: tutarCoz(duz.kullanilan), cayma: tutarCoz(duz.cayma) };
  const duzeltildi = yonetici && (kurusa(ozel.kullanilan) !== kurusa(varsayilan.kullanilan) || kurusa(ozel.cayma) !== kurusa(varsayilan.cayma));
  const hesap = duzeltildi ? iptalHesabiHesapla(plan, k, sezon, d.kurum?.caymaBedeli, BUGUN, ozel) : varsayilan;
  const hesapHata = !hesapVar
    ? null
    : duzeltildi && (Number.isNaN(ozel.kullanilan) || Number.isNaN(ozel.cayma))
      ? "Tutarlar geçerli sayı olmalı."
      : duzeltildi && duz.neden.trim().length < 3
        ? "Düzeltme gerekçesi en az 3 karakter olmalı."
        : hesap.iade > 0 && !yonetici
          ? `Bu iptalde ${tl(hesap.iade)} iade çıkıyor; iade gerektiren iptali yönetici (şube müdürü / genel yönetici) yapar.`
          : null;
  const ekKalanBorc = d.taksitler.filter((t) => t.kayitId === k.id && t.no >= 99).reduce((s, t) => s + taksitKalan(t), 0);

  const iptal = () => {
    if (hesapHata) return;
    guncelle((x: Db) => {
      const iptalHesabi = hesapVar ? { ...hesap, duzeltme: duzeltildi ? { neden: duz.neden.trim(), kullanici: ad, zaman: simdiZaman() } : null } : undefined;
      x.kayitlar = x.kayitlar.map((y) => (y.id === k.id ? { ...y, durum: "iptal", ...(iptalHesabi ? { iptalHesabi } : {}) } : y));
      if (iptalHesabi) {
        // Kalan borç kullanılan + cayma kadar kalır, geri kalan taksitler kapatılır; fazla ödenen iade edilir (kasadan çıkış)
        const yeni = iptalTaksitleri(plan, iptalHesabi.hak);
        x.taksitler = x.taksitler.map((t) => (yeni.has(t.id) && kurusa(yeni.get(t.id)!) !== kurusa(t.tutar) ? { ...t, tutar: yeni.get(t.id)! } : t));
        if (iptalHesabi.iade > 0) {
          const kod = sube(k.subeId)?.kod ?? "SUB";
          x.iadeler = [...(x.iadeler ?? []), {
            id: yeniId("ia"), makbuzNo: yeniMakbuzNo(kod, (x.iadeler ?? []).map((i) => i.makbuzNo), "I"), zaman: simdiZaman(), kayitId: k.id, ogrenciId: o.id,
            veliId: plan[0]?.veliId ?? o.birincilVeliId, subeId: k.subeId, yontem: duz.yontem, tutar: iptalHesabi.iade, kullanici: ad, iptal: null,
          }];
        }
        islemYaz(x, ad, "İptal hesabı", `${k.sozlesmeNo}: kullanılan ${tl(iptalHesabi.kullanilan)}, cayma ${tl(iptalHesabi.cayma)}, ödenen ${tl(iptalHesabi.odenen)} → ${iptalHesabi.iade > 0 ? `iade ${tl(iptalHesabi.iade)}` : `kalan borç ${tl(iptalHesabi.kalanBorc)}`}${duzeltildi ? ` (düzeltme: ${duz.neden.trim()})` : ""}`, k.subeId);
      }
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
      footer={<><Button variant="outline" onClick={onClose}>Vazgeç</Button><Button variant="destructive" onClick={iptal} disabled={neden.trim().length < 3 || !!hesapHata}>İptal et</Button></>}
    >
      <Field label="İptal nedeni (işlem kaydına yazılır)"><Textarea value={neden} onChange={(e) => setNeden(e.target.value)} /></Field>
      {aday && <Alert icon={<AlertTriangle />}>Bu öğrenci ön kayıttan geldi; aday “Görüşüldü” durumunda yeniden açılacak ve bugün aranacaklar listesine düşecek.</Alert>}
      {hesapVar && (
        <div className="grid gap-2 rounded-md border p-3 text-sm">
          <p className="font-medium">İptal hesabı</p>
          <p className="text-xs text-muted-foreground">
            Kullanılan tutar takvim günü oranıyla hesaplanır: hizmet başlangıcından ({hizmetBaslangici(k.tarih, sezon)}) sezon sonuna ({sezon?.bitis ?? "—"}) kadarki günlerin bugüne kadar geçen kısmı.
          </p>
          <table className="w-full tabular-nums">
            <tbody>
              <tr><td>Ödeme planı toplamı</td><td className="text-right">{tl(hesap.toplam)}</td></tr>
              <tr><td>Kullanılan</td><td className="text-right">{tl(hesap.kullanilan)}</td></tr>
              <tr><td>Cayma bedeli</td><td className="text-right">{tl(hesap.cayma)}</td></tr>
              <tr><td>Hak edilen (kullanılan + cayma)</td><td className="text-right">{tl(hesap.hak)}</td></tr>
              <tr><td>Ödenen</td><td className="text-right">{tl(hesap.odenen)}</td></tr>
              <tr className="font-medium">
                <td>{hesap.iade > 0 ? "İade edilecek" : "Kalan borç"}</td>
                <td className="text-right">{tl(hesap.iade > 0 ? hesap.iade : hesap.kalanBorc)}</td>
              </tr>
            </tbody>
          </table>
          {yonetici && (
            <div className="grid gap-2 sm:grid-cols-2">
              <Field label="Kullanılan (₺)"><Input inputMode="decimal" value={duz.kullanilan} onChange={(e) => setDuz({ ...duz, kullanilan: e.target.value })} /></Field>
              <Field label="Cayma bedeli (₺)"><Input inputMode="decimal" value={duz.cayma} onChange={(e) => setDuz({ ...duz, cayma: e.target.value })} /></Field>
              {duzeltildi && <div className="sm:col-span-2"><Field label="Düzeltme gerekçesi"><Input value={duz.neden} onChange={(e) => setDuz({ ...duz, neden: e.target.value })} /></Field></div>}
              {hesap.iade > 0 && (
                <Field label="İade yöntemi">
                  <Select value={duz.yontem} onChange={(e) => setDuz({ ...duz, yontem: e.target.value as Iade["yontem"] })}>
                    {YONTEMLER.map((y) => <option key={y} value={y}>{yontemAdlari[y]}</option>)}
                  </Select>
                </Field>
              )}
            </div>
          )}
          <p className="text-xs text-muted-foreground">
            {hesap.iade > 0 ? "Taksitler ödenen tutarda kapanır; iade kasadan çıkış olarak yazılır ve iade makbuzu numarası alır." : "Kalan borç en eski vadeli taksitlerde kalır, geri kalan taksitler kapatılır. Otomatik ödeme hatırlatması gönderilmez."}
            {ekKalanBorc > 0 && ` Ek kalemler (${tl(ekKalanBorc)}) bu hesaba girmez, borç olarak kalır.`}
          </p>
          {hesapHata && <p className="text-sm text-danger">{hesapHata}</p>}
        </div>
      )}
    </Dialog>
  );
}

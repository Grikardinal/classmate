/**
 * Kayıt sihirbazı: Öğrenci → Veli → Şube ve grup → (Ücret → Ödeme planı, Finans açıksa) → Kayıt formu.
 * ?aday=… ile ön kayıttan (Bölüm 03) doldurulur. Kurallar: ./kurallar.ts (sunucu aynı kuralları uygular).
 */
import * as React from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { AlertTriangle, ArrowLeft, Check, ChevronLeft, ChevronRight, Link2, Plus, Trash2, Users } from "lucide-react";
import { Alert, Button, Card, CardContent, Checkbox, Field, Input, PageHeader, Select, StatCard, Table, Td, Textarea, Th, toast } from "@/components/ui";
import { useApp, useOturum } from "@/context/AppContext";
import { ekHizmetler, indirimTurleri } from "@/data/mock";
import {
  AKTIF_SEZON,
  BUGUN,
  bildirimEkle,
  grupDoluluk,
  grupEtiket,
  guncelle,
  islemYaz,
  personelAdi,
  simdiZaman,
  sube,
  tamAd,
  tanimlar,
  useDb,
  yeniId,
  type Ogrenci,
  type Veli,
} from "@/data/store";
import { adSoyadBol, taksitPlani, telefonNormalize, tl } from "@/lib/kurallar";
import { esc, yazdir } from "@/lib/yazdir";
import { cn } from "@/lib/utils";
import { kesinKayitEngeli } from "../03-on-kayit/kurallar";
import { fiyatBul } from "../01-kurum-yapisi/kurallar";
import { kayitUcreti } from "../05-finans/kurallar";
import {
  EN_FAZLA_VELI,
  KVKK_SURUM,
  SEVIYELER,
  YAKINLIKLAR,
  grupDoluMu,
  kapasiteOnaylayabilir,
  mukerrerOgrenci,
  odemePlaniEngeli,
  ogrenciDogrula,
  seviyeUyumsuz,
  telefonSahibiVeli,
  veliDogrula,
  yeniSozlesmeNo,
  yenidenKayitEngeli,
} from "./kurallar";
import { bosVeli, tarihTR, type VeliForm } from "./ortak";

export function KayitSihirbazi() {
  const d = useDb();
  const { moduller, subeId: seciliSube } = useApp();
  const { ad: oturumAd, kapsam, rol } = useOturum();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  // Mevcut karttan yeniden kayıt (karar 2026-11-07): süren kaydı olmayan öğrencinin kartı ve veli bağları hazır gelir
  const mevcut = (() => {
    const o = d.ogrenciler.find((x) => x.id === params.get("ogrenci"));
    return o && !yenidenKayitEngeli(o, d.kayitlar) ? o : undefined;
  })();
  // Kayda dönüşmüş veya anonimleştirilmiş aday ikinci kez kayda çevrilmez (Bölüm 03 · kesinKayitEngeli)
  const aday = mevcut ? undefined : d.adaylar.find((a) => a.id === params.get("aday") && !kesinKayitEngeli(a));
  // Yalnızca kapsamdaki aktif şubelere kayıt yapılır (pasif şubeye kayıt sunucuda da reddedilir)
  const subeler = tanimlar().subeler.filter((s) => s.aktif && kapsam.includes(s.id));
  const ilkSube = [aday?.subeId, seciliSube].find((id) => id && subeler.some((s) => s.id === id)) ?? subeler[0]?.id ?? "";

  const [adim, setAdim] = React.useState(0);
  const [ogr, setOgr] = React.useState(() => {
    if (mevcut) {
      const son = d.kayitlar.filter((k) => k.ogrenciId === mevcut.id).at(-1);
      const seviye = d.gruplar.find((g) => g.id === son?.grupId)?.seviye ?? 5;
      return { ad: mevcut.ad, soyad: mevcut.soyad, dogum: mevcut.dogum, cinsiyet: mevcut.cinsiyet, seviye, okul: mevcut.okul, okulSinifi: mevcut.okulSinifi, saglikNotu: mevcut.saglikNotu };
    }
    const p = adSoyadBol((aday?.ogrenciAd ?? "").replace("—", ""));
    return { ad: p.ad, soyad: p.soyad, dogum: "", cinsiyet: "K" as "K" | "E", seviye: aday?.seviye ?? 5, okul: aday?.okul ?? "", okulSinifi: "", saglikNotu: "" };
  });
  const [veliler, setVeliler] = React.useState<VeliForm[]>(() => {
    if (mevcut) return mevcut.veliIds.filter((id) => d.veliler.some((v) => v.id === id)).map((id) => ({ ...bosVeli(), mevcutId: id }));
    if (!aday) return [bosVeli()];
    const p = adSoyadBol(aday.veliAd);
    return [{ ...bosVeli(), ad: p.ad, soyad: p.soyad, telefon: aday.veliTelefon }];
  });
  const [birincil, setBirincil] = React.useState(() => Math.max(0, veliler.findIndex((v) => v.mevcutId && v.mevcutId === mevcut?.birincilVeliId)));
  const [subeId, setSubeId] = React.useState(ilkSube);
  const [grupId, setGrupId] = React.useState("");
  const [hizmetler, setHizmetler] = React.useState<string[]>([]);
  const [indirimler, setIndirimler] = React.useState<string[]>([]);
  const [plan, setPlan] = React.useState({ pesinat: 0, taksit: 8, ilkVade: BUGUN });
  const [onay, setOnay] = React.useState({ aydinlatma: false, rizaFoto: false, rizaSms: true, yontem: "yazdir" as "yazdir" | "link" });
  const [kapasiteOnay, setKapasiteOnay] = React.useState(false);

  const adimlar = ["Öğrenci", "Veli", "Şube ve grup", ...(moduller.finans ? ["Ücret", "Ödeme planı"] : []), "Kayıt formu"];
  const sonAdim = adimlar.length - 1;
  const adimAdi = adimlar[adim];

  // Veli eşleştirme: telefon sistemde kayıtlıysa mevcut veliye bağlanabilir (sunucu kapsam dışındakini de bağlar)
  const veliEslesmeleri = veliler.map((v) => (v.mevcutId ? null : telefonSahibiVeli(v.telefon, d.veliler)));
  const veliTelefonu = (v: VeliForm) => (v.mevcutId ? d.veliler.find((x) => x.id === v.mevcutId)?.telefon ?? "" : v.telefon);
  const kardesler = [...new Set(veliler.map((v) => v.mevcutId).filter(Boolean))].flatMap((vid) => d.ogrenciler.filter((o) => o.veliIds.includes(vid!) && o.durum === "aktif"));
  // Mükerrer öğrenci: aynı ad (Türkçe harf duyarsız) + velilerden birinin telefonu
  const mukerrerOgr = mukerrerOgrenci({ id: mevcut?.id, ad: ogr.ad, soyad: ogr.soyad }, veliler.map(veliTelefonu), d);
  const mukerrerYenidenKayit = !!mukerrerOgr && !yenidenKayitEngeli(mukerrerOgr, d.kayitlar);

  React.useEffect(() => {
    if (kardesler.length && !indirimler.includes("Kardeş indirimi")) setIndirimler((x) => [...x, "Kardeş indirimi"]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kardesler.length]);

  const gruplar = d.gruplar.filter((g) => g.sezonId === AKTIF_SEZON && g.subeId === subeId).sort((a, b) => a.seviye - b.seviye);
  const secGrup = gruplar.find((g) => g.id === grupId);
  const dolu = secGrup ? grupDoluMu(d, secGrup.id) : false;
  const yonetici = kapasiteOnaylayabilir(rol);

  // Karar 2026-11-07: liste fiyatı sezon + şube + grubun seviyesine göre (Bölüm 01 · Fiyat listesi); tutarlar kuruş hassasiyetinde
  const tanimliFiyat = fiyatBul(tanimlar().fiyatListesi, AKTIF_SEZON, subeId, secGrup?.seviye);
  const liste = tanimliFiyat ?? 0;
  const seciliIndirimler = indirimTurleri.filter((i) => indirimler.includes(i.ad));
  // Karar 2026-11-08: sekreterin seçtiği indirim yönetici onayına gider; onaylanana kadar net ve plan indirimsiz
  const indirimYetkisi = rol === "genel-yonetici" || rol === "sube-muduru";
  const uygulananIndirimler = indirimYetkisi ? seciliIndirimler : [];
  const onayBekleyen = !indirimYetkisi && seciliIndirimler.length > 0;
  const { oran: indirimOran, net } = kayitUcreti(liste, uygulananIndirimler, hizmetler);
  const fiyatHata = moduller.finans && secGrup && tanimliFiyat === null ? `Bu sezon için ${sube(subeId)?.ad} ${secGrup.seviye}. sınıf fiyatı tanımlı değil (Ayarlar → Fiyat listesi).` : null;
  const planHata = odemePlaniEngeli(net, plan);
  const planOnizleme = planHata ? [] : taksitPlani(net, plan.pesinat, plan.taksit, plan.ilkVade);
  const sozNo = subeId ? yeniSozlesmeNo(tanimlar(), d.kayitlar.map((k) => k.sozlesmeNo), subeId, AKTIF_SEZON, BUGUN) : "";

  const taslakOgrenci = (): Ogrenci => ({
    id: "", ad: ogr.ad.trim(), soyad: ogr.soyad.trim(), dogum: ogr.dogum, cinsiyet: ogr.cinsiyet, okul: ogr.okul.trim(), okulSinifi: ogr.okulSinifi.trim(),
    saglikNotu: ogr.saglikNotu.trim(), veliIds: ["v"], birincilVeliId: "v", durum: "aktif", notlar: [],
  });
  const taslakVeli = (v: VeliForm): Veli => ({
    id: "", ad: v.ad.trim(), soyad: (v.soyad || ogr.soyad).trim(), telefon: telefonNormalize(v.telefon) ?? v.telefon, eposta: v.eposta.trim(), yakinlik: v.yakinlik,
    pushAcik: false, portalDavet: "gonderildi", izinSms: onay.rizaSms, izinTanitim: false,
  });

  const adimGecerli = (i: number): string | null => {
    const a = adimlar[i];
    if (a === "Öğrenci") return ogrenciDogrula(taslakOgrenci(), BUGUN);
    if (a === "Veli") {
      if (!veliler.length) return "En az bir veli girilmeli.";
      const teller = veliler.map((v) => telefonNormalize(veliTelefonu(v))).filter(Boolean);
      if (new Set(teller).size !== teller.length) return "Aynı telefon iki veliye girilemez.";
      if (new Set(veliler.map((v) => v.mevcutId).filter(Boolean)).size !== veliler.filter((v) => v.mevcutId).length) return "Aynı veli iki kez bağlanamaz.";
      for (const v of veliler) {
        if (v.mevcutId) continue; // mevcut veliye bağlandı
        const h = veliDogrula(taslakVeli(v));
        if (h) return h;
      }
      if (mukerrerOgr) return "Bu öğrenci zaten kayıtlı görünüyor.";
      return null;
    }
    if (a === "Şube ve grup") {
      if (!subeId) return "Kayıt yapılabilecek aktif şube yok.";
      if (!grupId || !secGrup) return "Grup seçin.";
      if (dolu && !yonetici) return "Grup dolu; kapasite aşımını yalnızca sekreter, şube müdürü veya genel yönetici onaylayabilir.";
      if (dolu && !kapasiteOnay) return "Grup dolu; devam etmek için kapasite aşımını onaylayın.";
      return null;
    }
    if (a === "Ücret") return fiyatHata;
    if (a === "Ödeme planı") return fiyatHata ?? planHata;
    if (a === "Kayıt formu" && !onay.aydinlatma) return "KVKK aydınlatma metninin okunduğu onaylanmalı.";
    return null;
  };
  const hata = adimGecerli(adim);
  const tumHata = adimlar.map((_, i) => adimGecerli(i)).find(Boolean) ?? null;

  const kayitFormuHtml = (no: string) => {
    const g = secGrup;
    const s = sube(subeId);
    return `
      <h1>Kayıt ve Muvafakat Formu</h1>
      <p class="kucuk">Sözleşme no: <b>${esc(no)}</b> · Sezon: ${esc(tanimlar().sezonlar.find((z) => z.id === AKTIF_SEZON)?.ad)} · Tarih: ${tarihTR(BUGUN)}</p>
      <h2>Öğrenci</h2>
      <table><tr><th>Ad soyad</th><td>${esc(ogr.ad)} ${esc(ogr.soyad)}</td><th>Doğum tarihi</th><td>${esc(tarihTR(ogr.dogum))}</td></tr>
      <tr><th>Okulu</th><td>${esc(ogr.okul)} ${esc(ogr.okulSinifi)}</td><th>Seviye</th><td>${ogr.seviye}. sınıf</td></tr>
      <tr><th>Sağlık notu</th><td colspan="3">${esc(ogr.saglikNotu || "—")}</td></tr></table>
      <h2>Veli(ler)</h2>
      <table><tr><th>Ad soyad</th><th>Yakınlık</th><th>Telefon</th><th>E-posta</th></tr>
      ${veliler
        .map((v, i) => {
          const m = v.mevcutId ? d.veliler.find((x) => x.id === v.mevcutId) : undefined;
          const x = m ?? taslakVeli(v);
          return `<tr><td>${esc(tamAd(x))}${i === birincil ? " (birincil)" : ""}</td><td>${esc(x.yakinlik)}</td><td>${esc(x.telefon)}</td><td>${esc(x.eposta || "—")}</td></tr>`;
        })
        .join("")}
      </table>
      <h2>Şube ve grup</h2>
      <table><tr><th>Şube</th><td>${esc(s?.ad)} — ${esc(s?.adres)} · ${esc(s?.telefon)}</td></tr><tr><th>Grup</th><td>${esc(g ? grupEtiket(d, g.id) : "")}</td></tr>
      ${hizmetler.length ? `<tr><th>Ek hizmetler</th><td>${esc(hizmetler.join(", "))}</td></tr>` : ""}</table>
      ${
        moduller.finans
          ? `<h2>Ücret ve ödeme planı</h2><table><tr><th>Liste fiyatı</th><td>${tl(liste)}</td><th>İndirim</th><td>%${indirimOran}</td><th>Net</th><td><b>${tl(net)}</b></td></tr></table>
             <table><tr><th>Taksit</th><th>Vade</th><th class="sag">Tutar</th></tr>${planOnizleme.map((p) => `<tr><td>${p.no === 0 ? "Peşinat" : p.no + ". taksit"}</td><td>${tarihTR(p.vade)}</td><td class="sag">${tl(p.tutar)}</td></tr>`).join("")}</table>`
          : ""
      }
      <h2>Onaylar</h2>
      <p>☑ KVKK aydınlatma metnini okudum, anladım (sürüm ${KVKK_SURUM}).<br/>${onay.rizaSms ? "☑" : "☐"} Bilgilendirme mesajları (devamsızlık, ders iptali) için SMS/uygulama bildirimi almayı kabul ediyorum.<br/>
      ${onay.rizaFoto ? "☑" : "☐"} Çocuğumun etkinlik fotoğraflarının kurum içi paylaşımlarda kullanılmasına izin veriyorum.</p>
      <p class="kucuk">Veli, çocuğunun kurum etkinliklerine katılmasına muvafakat eder. Kurum, öğrencinin ders saatleri içindeki gözetiminden sorumludur.</p>
      <div class="imza"><div>Veli adı soyadı / imza</div><div>Kurum yetkilisi / imza</div></div>`;
  };

  const tamamla = () => {
    if (tumHata || !secGrup) return;
    const no = sozNo;
    const ogrId = mevcut?.id ?? yeniId("o");
    const kayitId = yeniId("k");
    const veliIds: string[] = [];
    guncelle((x) => {
      for (const v of veliler) {
        if (v.mevcutId) {
          veliIds.push(v.mevcutId);
          continue;
        }
        const id = yeniId("v");
        veliIds.push(id);
        x.veliler.push({ ...taslakVeli(v), id });
      }
      const birincilId = veliIds[Math.min(birincil, veliIds.length - 1)];
      const veliBag = { veliIds: [birincilId, ...veliIds.filter((v) => v !== birincilId)], birincilVeliId: birincilId };
      const t = taslakOgrenci();
      if (mevcut)
        // Yeniden kayıt: mevcut kart güncellenir (notlar korunur), öğrenci yeniden aktif olur
        x.ogrenciler = x.ogrenciler.map((y) =>
          y.id === mevcut.id ? { ...y, ad: t.ad, soyad: t.soyad, dogum: t.dogum, cinsiyet: t.cinsiyet, okul: t.okul, okulSinifi: t.okulSinifi, saglikNotu: t.saglikNotu, ...veliBag, durum: "aktif" } : y,
        );
      else x.ogrenciler.push({ ...t, id: ogrId, ...veliBag });
      x.kayitlar.push({
        id: kayitId, ogrenciId: ogrId, sezonId: AKTIF_SEZON, subeId, grupId, sozlesmeNo: no, durum: "aktif", tarih: BUGUN,
        grupGecmisi: [{ grupId, tarih: BUGUN }], ekHizmetler: hizmetler, kvkkOnay: { tarih: BUGUN, surum: KVKK_SURUM },
        listeFiyati: moduller.finans ? liste : 0,
        indirimler: moduller.finans ? uygulananIndirimler : [],
        net: moduller.finans ? net : 0,
        ...(moduller.finans && onayBekleyen ? { bekleyenIndirim: { indirimler: seciliIndirimler, isteyen: oturumAd, zaman: simdiZaman() } } : {}),
      });
      if (moduller.finans)
        for (const p of planOnizleme)
          x.taksitler.push({ id: yeniId("tk"), kayitId, ogrenciId: ogrId, veliId: birincilId, subeId, no: p.no, vade: p.vade, tutar: p.tutar, odenen: 0 });
      if (aday) x.adaylar = x.adaylar.map((a) => (a.id === aday.id ? { ...a, durum: "kayit", ogrenciId: ogrId, sonrakiAksiyon: null, vazgecmeNedeni: null, notlar: [...a.notlar, { tarih: simdiZaman(), yazar: oturumAd, metin: `Kesin kayıt yapıldı (${no})` }] } : a));
      if (dolu) islemYaz(x, oturumAd, "Kapasite aşımı", `${grupEtiket(x, grupId)} grubuna kapasite üstü kayıt onaylandı`, subeId);
      islemYaz(x, oturumAd, "Kayıt", `${ogr.ad.trim()} ${ogr.soyad.trim()} — ${no}`, subeId);
      bildirimEkle(x, "hosgeldin", ogrId, {});
    });
    if (onay.yontem === "yazdir" && !yazdir(`Kayıt formu ${no}`, kayitFormuHtml(no), sube(subeId)?.ad))
      toast("Açılır pencere engellendi; formu öğrenci kartındaki Belgeler sekmesinden yazdırabilirsiniz.", "uyari");
    toast(`Kayıt tamamlandı (${no}). Veliye hoş geldiniz mesajı ve portal linki gönderildi.`);
    navigate(`/ogrenciler/${ogrId}`);
  };

  const veliGuncelle = (i: number, p: Partial<VeliForm>) => setVeliler(veliler.map((x, j) => (j === i ? { ...x, ...p } : x)));

  return (
    <div className="grid gap-6">
      <div>
        <Link to="/ogrenciler" className="mb-2 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="size-4" /> Öğrenciler
        </Link>
        <PageHeader code="04" title="Yeni kayıt" description={mevcut ? `Mevcut karttan yeniden kayıt: ${tamAd(mevcut)}` : aday ? `Ön kayıttan aktarılıyor: ${aday.veliAd}` : "Tek ekranda adım adım kayıt."} />
      </div>

      <ol className="flex flex-wrap gap-2">
        {adimlar.map((a, i) => (
          <li key={a}>
            <button
              onClick={() => i < adim && setAdim(i)}
              disabled={i > adim}
              className={cn(
                "flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm transition",
                i === adim && "border-primary bg-accent font-medium text-accent-foreground",
                i < adim && "hover:bg-muted",
                i > adim && "text-muted-foreground",
              )}
            >
              <span className={cn("grid size-5 place-items-center rounded-full text-[11px] font-semibold", i < adim ? "bg-primary text-primary-foreground" : "bg-muted")}>
                {i < adim ? <Check className="size-3" /> : i + 1}
              </span>
              {a}
            </button>
          </li>
        ))}
      </ol>

      <Card>
        <CardContent className="grid gap-5 p-5">
          {adimAdi === "Öğrenci" && (
            <>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Ad *"><Input autoFocus value={ogr.ad} onChange={(e) => setOgr({ ...ogr, ad: e.target.value })} /></Field>
                <Field label="Soyad *"><Input value={ogr.soyad} onChange={(e) => setOgr({ ...ogr, soyad: e.target.value })} /></Field>
                <Field label="Doğum tarihi"><Input type="date" max={BUGUN} value={ogr.dogum} onChange={(e) => setOgr({ ...ogr, dogum: e.target.value })} /></Field>
                <Field label="Cinsiyet">
                  <Select value={ogr.cinsiyet} onChange={(e) => setOgr({ ...ogr, cinsiyet: e.target.value as "K" | "E" })}>
                    <option value="K">Kız</option>
                    <option value="E">Erkek</option>
                  </Select>
                </Field>
                <Field label="Seviye">
                  <Select value={ogr.seviye} onChange={(e) => { setOgr({ ...ogr, seviye: Number(e.target.value) }); setGrupId(""); }}>
                    {SEVIYELER.map((s) => <option key={s} value={s}>{s}. sınıf</option>)}
                  </Select>
                </Field>
                <Field label="Okulu"><Input value={ogr.okul} onChange={(e) => setOgr({ ...ogr, okul: e.target.value })} /></Field>
                <Field label="Okuldaki sınıfı / şubesi"><Input placeholder="5-C" value={ogr.okulSinifi} onChange={(e) => setOgr({ ...ogr, okulSinifi: e.target.value })} /></Field>
              </div>
              <Field label="Sağlık notu (alerji, ilaç vb.)" hint="Yalnızca gerekiyorsa girin (KVKK: veri minimizasyonu). TCKN istenmez.">
                <Textarea className="min-h-16" value={ogr.saglikNotu} onChange={(e) => setOgr({ ...ogr, saglikNotu: e.target.value })} />
              </Field>
            </>
          )}

          {adimAdi === "Veli" && (
            <>
              {veliler.map((v, i) => {
                const es = veliEslesmeleri[i];
                const mevcut = v.mevcutId ? d.veliler.find((x) => x.id === v.mevcutId) : undefined;
                return (
                  <div key={i} className="grid gap-3 rounded-lg border p-4">
                    <div className="flex items-center justify-between">
                      <p className="font-medium">{i + 1}. veli</p>
                      <div className="flex items-center gap-3">
                        <label className="flex items-center gap-2 text-sm">
                          <input type="radio" name="birincil" checked={birincil === i} onChange={() => setBirincil(i)} className="accent-[var(--color-primary)]" />
                          Birincil iletişim
                        </label>
                        {veliler.length > 1 && (
                          <Button variant="ghost" size="icon" aria-label="Veliyi kaldır" onClick={() => { setVeliler(veliler.filter((_, j) => j !== i)); setBirincil(0); }}>
                            <Trash2 />
                          </Button>
                        )}
                      </div>
                    </div>
                    {v.mevcutId ? (
                      <Alert tone="success" icon={<Link2 />}>
                        Mevcut veliye bağlandı: <b>{tamAd(mevcut)}</b> ({mevcut?.telefon}).{" "}
                        <button className="underline" onClick={() => veliGuncelle(i, { mevcutId: null })}>Bağlantıyı kaldır</button>
                      </Alert>
                    ) : (
                      <div className="grid gap-3 sm:grid-cols-2">
                        <Field label="Ad *"><Input value={v.ad} onChange={(e) => veliGuncelle(i, { ad: e.target.value })} /></Field>
                        <Field label="Soyad"><Input placeholder={ogr.soyad} value={v.soyad} onChange={(e) => veliGuncelle(i, { soyad: e.target.value })} /></Field>
                        <Field label="Cep telefonu *" hint={v.telefon && !telefonNormalize(v.telefon) ? "Geçersiz numara" : "Veli portalına bu numarayla SMS koduyla girer."}>
                          <Input value={v.telefon} onChange={(e) => veliGuncelle(i, { telefon: e.target.value })} placeholder="05xx xxx xx xx" />
                        </Field>
                        <Field label="E-posta"><Input type="email" value={v.eposta} onChange={(e) => veliGuncelle(i, { eposta: e.target.value })} /></Field>
                        <Field label="Yakınlık">
                          <Select value={v.yakinlik} onChange={(e) => veliGuncelle(i, { yakinlik: e.target.value as Veli["yakinlik"] })}>
                            {YAKINLIKLAR.map((y) => <option key={y}>{y}</option>)}
                          </Select>
                        </Field>
                      </div>
                    )}
                    {es && (
                      <Alert tone="info" icon={<Users />}>
                        Bu telefon sistemde kayıtlı: <b>{tamAd(es)}</b> — çocuk(lar):{" "}
                        {d.ogrenciler.filter((o) => o.veliIds.includes(es.id)).map((o) => o.ad).join(", ")}.{" "}
                        <button className="font-medium text-primary underline" onClick={() => veliGuncelle(i, { mevcutId: es.id })}>
                          Kardeş olarak bağla
                        </button>
                      </Alert>
                    )}
                  </div>
                );
              })}
              {veliler.length < EN_FAZLA_VELI && (
                <Button variant="outline" className="justify-self-start" onClick={() => setVeliler([...veliler, { ...bosVeli(), yakinlik: "Baba" }])}>
                  <Plus /> Veli ekle
                </Button>
              )}
              {mukerrerOgr && (
                <Alert tone="danger" icon={<AlertTriangle />}>
                  Aynı ad ve veli telefonuyla kayıtlı bir öğrenci var. Öğrenci kurum genelinde tektir; yeni kart açılmaz.{" "}
                  {mukerrerYenidenKayit ? (
                    <><Link className="font-medium underline" to={`/ogrenciler/yeni?ogrenci=${mukerrerOgr.id}`}>Mevcut karttan yeniden kayıt</Link> (öğrencinin süren kaydı yok).</>
                  ) : (
                    <><Link className="font-medium underline" to={`/ogrenciler/${mukerrerOgr.id}`}>Mevcut kaydı aç</Link>; başka şubeye geçiş için öğrenci kartındaki “Şube nakli”ni kullanın.</>
                  )}
                </Alert>
              )}
              <p className="text-xs text-muted-foreground">
                Telefon başka şubedeki bir veliye kayıtlıysa kayıt sırasında mevcut veliye bağlanır; aynı ad ve telefonla başka şubede kayıtlı öğrenci varsa kayıt reddedilir.
              </p>
            </>
          )}

          {adimAdi === "Şube ve grup" && (
            <>
              <Field label="Şube">
                <Select value={subeId} onChange={(e) => { setSubeId(e.target.value); setGrupId(""); setKapasiteOnay(false); }}>
                  {subeler.map((s) => <option key={s.id} value={s.id}>{s.ad}</option>)}
                </Select>
              </Field>
              <div className="grid gap-2">
                <span className="text-sm font-medium">Grup ({ogr.seviye}. sınıf grupları önde)</span>
                <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  {[...gruplar].sort((a, b) => Number(b.seviye === ogr.seviye) - Number(a.seviye === ogr.seviye)).map((g) => {
                    const k = grupDoluluk(d, g.id);
                    const oran = g.kapasite ? k / g.kapasite : 1;
                    return (
                      <button
                        key={g.id}
                        onClick={() => { setGrupId(g.id); setKapasiteOnay(false); }}
                        className={cn(
                          "rounded-lg border p-3 text-left transition hover:border-primary/50",
                          grupId === g.id && "border-primary ring-2 ring-primary/30",
                          g.seviye !== ogr.seviye && "opacity-60",
                        )}
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-medium">{grupEtiket(d, g.id)}</span>
                          <span className={cn("text-xs tabular-nums", oran >= 1 ? "text-danger" : "text-muted-foreground")}>{k}/{g.kapasite}</span>
                        </div>
                        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted">
                          <div className={cn("h-full rounded-full", oran >= 1 ? "bg-danger" : oran >= 0.8 ? "bg-warning" : "bg-primary")} style={{ width: `${Math.min(oran, 1) * 100}%` }} />
                        </div>
                        <p className="mt-2 text-xs text-muted-foreground">Rehber: {personelAdi(d, g.rehberId)}</p>
                      </button>
                    );
                  })}
                  {gruplar.length === 0 && <p className="text-sm text-muted-foreground">Bu şubede aktif sezona ait grup yok. Bölüm 01'den grup ekleyin.</p>}
                </div>
              </div>
              {seviyeUyumsuz(ogr.seviye, secGrup) && (
                <Alert tone="warning" icon={<AlertTriangle />}>Seçilen grup {secGrup!.seviye}. sınıf grubu; öğrenci {ogr.seviye}. sınıf olarak girildi.</Alert>
              )}
              {dolu && (
                <Alert tone="warning" icon={<AlertTriangle />}>
                  <p>Bu grubun kontenjanı dolu. Kapasite üstü kayıt sekreter, şube müdürü veya genel yönetici onayıyla yapılır (işlem kaydına yazılır).</p>
                  {yonetici && (
                    <div className="mt-2"><Checkbox checked={kapasiteOnay} onChange={setKapasiteOnay} label="Kapasite aşımını onaylıyorum (işlem kaydına yazılır)" /></div>
                  )}
                </Alert>
              )}
              <div className="grid gap-2">
                <span className="text-sm font-medium">Ek hizmetler</span>
                {ekHizmetler.map((h) => (
                  <Checkbox
                    key={h.ad}
                    checked={hizmetler.includes(h.ad)}
                    onChange={(v) => setHizmetler(v ? [...hizmetler, h.ad] : hizmetler.filter((x) => x !== h.ad))}
                    label={h.ad}
                    description={moduller.finans ? tl(h.fiyat) : undefined}
                  />
                ))}
              </div>
            </>
          )}

          {adimAdi === "Ücret" && (
            <>
              {fiyatHata && <Alert tone="warning" icon={<AlertTriangle />}>{fiyatHata}</Alert>}
              <div className="grid gap-3 sm:grid-cols-3">
                <StatCard label={`Liste fiyatı (${sube(subeId)?.kod} · ${secGrup?.seviye ?? "—"}. sınıf)`} value={tanimliFiyat === null ? "—" : tl(liste)} />
                <StatCard label="Ek hizmetler" value={tl(kayitUcreti(0, [], hizmetler).hizmetTutari)} />
                <StatCard label="Net tutar" value={tl(net)} tone="success" hint={indirimOran ? `%${indirimOran} indirim uygulandı` : undefined} />
              </div>
              <div className="grid gap-2">
                <span className="text-sm font-medium">İndirimler</span>
                {indirimTurleri.map((i) => (
                  <Checkbox
                    key={i.ad}
                    checked={indirimler.includes(i.ad)}
                    onChange={(v) => setIndirimler(v ? [...indirimler, i.ad] : indirimler.filter((x) => x !== i.ad))}
                    label={`${i.ad} (%${i.oran})`}
                    description={i.ad === "Kardeş indirimi" && kardesler.length ? `Kardeş: ${kardesler.map((k) => k.ad).join(", ")} — şube fark etmeksizin` : undefined}
                  />
                ))}
              </div>
              {onayBekleyen && (
                <Alert icon={<AlertTriangle />}>
                  Seçilen indirim ({seciliIndirimler.map((i) => `${i.ad} %${i.oran}`).join(", ")}) yönetici onayına gönderilir. Onaylanana kadar net tutar ve
                  ödeme planı indirimsiz hesaplanır; onayda ödenmemiş taksitler yeni nete göre yeniden dağıtılır.
                </Alert>
              )}
            </>
          )}

          {adimAdi === "Ödeme planı" && (
            <>
              <div className="grid gap-3 sm:grid-cols-3">
                <Field label="Peşinat (₺)"><Input type="number" min={0} max={net} value={plan.pesinat} onChange={(e) => setPlan({ ...plan, pesinat: Number(e.target.value) })} /></Field>
                <Field label="Taksit sayısı"><Input type="number" min={0} max={12} step={1} value={plan.taksit} onChange={(e) => setPlan({ ...plan, taksit: Number(e.target.value) })} /></Field>
                <Field label="İlk vade"><Input type="date" value={plan.ilkVade} onChange={(e) => setPlan({ ...plan, ilkVade: e.target.value })} /></Field>
              </div>
              <Table>
                <thead><tr><Th>Taksit</Th><Th>Vade</Th><Th className="text-right">Tutar</Th></tr></thead>
                <tbody>
                  {planOnizleme.map((p) => (
                    <tr key={p.no}><Td>{p.no === 0 ? "Peşinat" : `${p.no}. taksit`}</Td><Td>{tarihTR(p.vade)}</Td><Td className="text-right tabular-nums">{tl(p.tutar)}</Td></tr>
                  ))}
                  <tr><Td className="font-medium">Toplam</Td><Td /><Td className="text-right font-medium tabular-nums">{tl(planOnizleme.reduce((t, p) => t + p.tutar, 0))}</Td></tr>
                </tbody>
              </Table>
            </>
          )}

          {adimAdi === "Kayıt formu" && (
            <>
              <div className="grid gap-3 rounded-lg border p-4 text-sm sm:grid-cols-2">
                <div><span className="text-muted-foreground">Öğrenci:</span> <b>{ogr.ad} {ogr.soyad}</b> · {ogr.seviye}. sınıf</div>
                <div><span className="text-muted-foreground">Grup:</span> <b>{secGrup ? grupEtiket(d, secGrup.id) : "—"}</b></div>
                <div><span className="text-muted-foreground">Birincil veli:</span> {veliler[birincil]?.mevcutId ? tamAd(d.veliler.find((x) => x.id === veliler[birincil].mevcutId)) : `${veliler[birincil]?.ad} ${veliler[birincil]?.soyad || ogr.soyad}`}</div>
                <div><span className="text-muted-foreground">Sözleşme no:</span> <span className="font-mono">{sozNo}</span></div>
                {moduller.finans && <div><span className="text-muted-foreground">Net tutar:</span> <b>{tl(net)}</b> · {plan.taksit} taksit</div>}
              </div>
              {!moduller.finans && (
                <p className="text-xs text-muted-foreground">Finans modülü kapalı: ücret maddesi olmayan kayıt ve muvafakat formu üretilir.</p>
              )}
              <div className="grid gap-3">
                <Checkbox checked={onay.aydinlatma} onChange={(v) => setOnay({ ...onay, aydinlatma: v })} label="KVKK aydınlatma metni veliye okutuldu / iletildi *" description={`Sürüm ${KVKK_SURUM} · onay tarihi kayda yazılır`} />
                <Checkbox checked={onay.rizaSms} onChange={(v) => setOnay({ ...onay, rizaSms: v })} label="Bilgilendirme mesajları (SMS / uygulama bildirimi) izni" />
                <Checkbox checked={onay.rizaFoto} onChange={(v) => setOnay({ ...onay, rizaFoto: v })} label="Etkinlik fotoğrafı kullanım izni (açık rıza)" />
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                {([
                  ["yazdir", "Yazdır ve imzalat", "Form PDF olarak açılır; veli kurumda imzalar."],
                  ["link", "Veliye linkle onaylat", "Veli, portaldaki form linkini açıp SMS koduyla onaylar."],
                ] as const).map(([k, b, a]) => (
                  <button
                    key={k}
                    onClick={() => setOnay({ ...onay, yontem: k })}
                    className={cn("rounded-lg border p-3 text-left transition", onay.yontem === k && "border-primary ring-2 ring-primary/30")}
                  >
                    <p className="font-medium">{b}</p>
                    <p className="text-xs text-muted-foreground">{a}</p>
                  </button>
                ))}
              </div>
            </>
          )}

          {hata && <p className="text-sm text-danger">{hata}</p>}

          <div className="flex justify-between border-t pt-4">
            <Button variant="outline" onClick={() => (adim === 0 ? navigate(-1) : setAdim(adim - 1))}>
              <ChevronLeft /> {adim === 0 ? "Vazgeç" : "Geri"}
            </Button>
            {adim < sonAdim ? (
              <Button onClick={() => setAdim(adim + 1)} disabled={!!hata}>
                İleri <ChevronRight />
              </Button>
            ) : (
              <Button onClick={tamamla} disabled={!!tumHata}>
                <Check /> Kaydı tamamla
              </Button>
            )}
          </div>
          {!hata && tumHata && adim === sonAdim && <p className="text-sm text-danger">{tumHata}</p>}
        </CardContent>
      </Card>
    </div>
  );
}

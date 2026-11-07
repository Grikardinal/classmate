/**
 * Bölüm 04 · Öğrenci, veli ve kayıt (sözleşme)
 * Doküman: docs/bolumler/04-ogrenci-ve-kayit.md
 *
 * /ogrenciler          → öğrenci listesi
 * /ogrenciler/yeni     → kayıt sihirbazı (?aday=… ile ön kayıttan doldurulur)
 * /ogrenciler/:id      → öğrenci kartı
 */
import * as React from "react";
import { Link, Route, Routes, useNavigate, useParams, useSearchParams } from "react-router-dom";
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRightLeft,
  Ban,
  Check,
  ChevronLeft,
  ChevronRight,
  FileSpreadsheet,
  FileText,
  GraduationCap,
  HeartPulse,
  Link2,
  PauseCircle,
  Phone,
  PlayCircle,
  Plus,
  Printer,
  Search,
  Trash2,
  UserPlus,
  Users,
} from "lucide-react";
import {
  Alert,
  Avatar,
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Checkbox,
  Dialog,
  EmptyState,
  Field,
  Input,
  PageHeader,
  Select,
  StatCard,
  Switch,
  Table,
  Tabs,
  Td,
  Textarea,
  Th,
  toast,
} from "@/components/ui";
import { useApp, useOturum } from "@/context/AppContext";
import { ekHizmetler, indirimTurleri } from "@/data/mock";
import { tanimlar } from "@/data/store";
import {
  AKTIF_SEZON,
  BUGUN,
  aktifKayit,
  bildirimEkle,
  dersAdi,
  grup,
  grupDoluluk,
  grupEtiket,
  guncelle,
  islemYaz,
  ogrenciVelileri,
  ogrenciYoklamalari,
  personelAdi,
  simdiZaman,
  sube,
  tamAd,
  taksitAdi,
  taksitKalan,
  useDb,
  yeniId,
  type Db,
  type Kayit,
  type Ogrenci,
  type Veli,
} from "@/data/store";
import { devamsizlikOzeti, mukerrerMi, normalAd, sozlesmeNo, taksitPlani, telefonNormalize, tl } from "@/lib/kurallar";
import { esc, yazdir } from "@/lib/yazdir";
import { cn } from "@/lib/utils";

export default function Ogrenciler() {
  return (
    <Routes>
      <Route index element={<OgrenciListesi />} />
      <Route path="yeni" element={<KayitSihirbazi />} />
      <Route path=":id" element={<OgrenciKarti />} />
    </Routes>
  );
}

const tarihTR = (iso: string) => (iso ? new Date(iso.slice(0, 10) + "T00:00:00").toLocaleDateString("tr-TR") : "—");
const durumEtiket: Record<Kayit["durum"], { ad: string; v: "success" | "warning" | "danger" }> = {
  aktif: { ad: "Aktif", v: "success" },
  dondurulmus: { ad: "Dondurulmuş", v: "warning" },
  iptal: { ad: "İptal", v: "danger" },
};

/* =========================== Liste =========================== */
function OgrenciListesi() {
  const d = useDb();
  const { subeGorunur } = useOturum();
  const navigate = useNavigate();
  const [ara, setAra] = React.useState("");
  const [grupId, setGrupId] = React.useState("all");
  const [durum, setDurum] = React.useState<"aktif" | "dondurulmus" | "iptal" | "all">("aktif");

  const gruplar = d.gruplar.filter((g) => g.sezonId === AKTIF_SEZON && subeGorunur(g.subeId));
  const satirlar = d.kayitlar
    .filter((k) => k.sezonId === AKTIF_SEZON && subeGorunur(k.subeId))
    .filter((k) => (durum === "all" || k.durum === durum) && (grupId === "all" || k.grupId === grupId))
    .map((k) => ({ k, o: d.ogrenciler.find((o) => o.id === k.ogrenciId)! }))
    .filter(({ o }) => {
      if (!o) return false;
      const q = normalAd(ara);
      if (!q) return true;
      const veliler = ogrenciVelileri(d, o);
      return normalAd(`${o.ad} ${o.soyad} ${veliler.map((v) => `${v.ad} ${v.soyad} ${v.telefon.replace(/\s/g, "")}`).join(" ")}`).includes(q.replace(/\s(?=\d)/g, ""));
    })
    .sort((a, b) => a.o.ad.localeCompare(b.o.ad, "tr"));

  const aktifSayi = d.kayitlar.filter((k) => k.sezonId === AKTIF_SEZON && k.durum === "aktif" && subeGorunur(k.subeId)).length;
  const kapasite = gruplar.reduce((t, g) => t + g.kapasite, 0);

  return (
    <div className="grid gap-6">
      <PageHeader
        code="04"
        title="Öğrenciler"
        description="Öğrenci ve veli kurum genelinde tektir; kayıt şubeye bağlıdır."
        actions={
          <>
            <Button variant="outline" onClick={() => navigate("/altyapi?sekme=ice")}>
              <FileSpreadsheet /> Excel'den aktar
            </Button>
            <Button onClick={() => navigate("/ogrenciler/yeni")}>
              <UserPlus /> Yeni kayıt
            </Button>
          </>
        }
      />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Aktif öğrenci" value={aktifSayi} icon={<GraduationCap />} />
        <StatCard label="Doluluk" value={`%${kapasite ? Math.round((aktifSayi / kapasite) * 100) : 0}`} hint={`${aktifSayi} / ${kapasite} kontenjan`} icon={<Users />} />
        <StatCard label="Bu ay yeni kayıt" value={d.kayitlar.filter((k) => k.tarih.startsWith(BUGUN.slice(0, 7)) && subeGorunur(k.subeId)).length} icon={<UserPlus />} tone="success" />
        <StatCard label="Dondurulmuş" value={d.kayitlar.filter((k) => k.durum === "dondurulmus" && subeGorunur(k.subeId)).length} icon={<PauseCircle />} tone="warning" />
      </div>
      <Card>
        <CardContent className="flex flex-wrap gap-2 p-4">
          <div className="relative min-w-52 flex-1">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input placeholder="Öğrenci, veli adı veya telefon" className="pl-8" value={ara} onChange={(e) => setAra(e.target.value)} />
          </div>
          <Select aria-label="Grup" className="w-40" value={grupId} onChange={(e) => setGrupId(e.target.value)}>
            <option value="all">Tüm gruplar</option>
            {gruplar.map((g) => (
              <option key={g.id} value={g.id}>{grupEtiket(d, g.id)}</option>
            ))}
          </Select>
          <Select aria-label="Durum" className="w-40" value={durum} onChange={(e) => setDurum(e.target.value as typeof durum)}>
            <option value="aktif">Aktif</option>
            <option value="dondurulmus">Dondurulmuş</option>
            <option value="iptal">İptal</option>
            <option value="all">Tümü</option>
          </Select>
        </CardContent>
        {satirlar.length === 0 ? (
          <CardContent>
            <EmptyState icon={<GraduationCap />} title="Öğrenci bulunamadı" text="Aramayı veya filtreleri değiştirin." />
          </CardContent>
        ) : (
          <Table>
            <thead>
              <tr>
                <Th>Öğrenci</Th>
                <Th>Grup</Th>
                <Th>Veli</Th>
                <Th>Devamsızlık</Th>
                <Th>Durum</Th>
              </tr>
            </thead>
            <tbody>
              {satirlar.map(({ k, o }) => {
                const v = d.veliler.find((x) => x.id === o.birincilVeliId);
                const oz = devamsizlikOzeti(ogrenciYoklamalari(d, o.id).map((x) => x.durum));
                return (
                  <tr key={k.id} className="cursor-pointer hover:bg-muted/50" onClick={() => navigate(`/ogrenciler/${o.id}`)}>
                    <Td>
                      <div className="flex items-center gap-3">
                        <Avatar ad={tamAd(o)} className="size-8" />
                        <div>
                          <p className="font-medium">
                            {tamAd(o)} {o.saglikNotu && <HeartPulse className="inline size-3.5 text-danger" aria-label="Sağlık notu var" />}
                          </p>
                          <p className="text-xs text-muted-foreground">{o.okul}</p>
                        </div>
                      </div>
                    </Td>
                    <Td className="whitespace-nowrap">{grupEtiket(d, k.grupId)}</Td>
                    <Td>
                      <p>{tamAd(v)}</p>
                      <p className="font-mono text-xs text-muted-foreground">{v?.telefon}</p>
                    </Td>
                    <Td>
                      <span className={cn("tabular-nums", oz.oran >= 0.15 ? "font-medium text-danger" : oz.oran >= 0.08 ? "text-warning" : "")}>
                        %{Math.round(oz.oran * 100)}
                      </span>
                      <span className="ml-1 text-xs text-muted-foreground">({oz.gelmedi}/{oz.toplam})</span>
                    </Td>
                    <Td><Badge variant={durumEtiket[k.durum].v}>{durumEtiket[k.durum].ad}</Badge></Td>
                  </tr>
                );
              })}
            </tbody>
          </Table>
        )}
      </Card>
    </div>
  );
}

/* =========================== Kayıt sihirbazı =========================== */
type VeliForm = { mevcutId: string | null; ad: string; soyad: string; telefon: string; eposta: string; yakinlik: Veli["yakinlik"] };
const bosVeli = (): VeliForm => ({ mevcutId: null, ad: "", soyad: "", telefon: "", eposta: "", yakinlik: "Anne" });

function KayitSihirbazi() {
  const d = useDb();
  const { moduller, subeId: seciliSube } = useApp();
  const { ad: oturumAd, kapsam } = useOturum();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const aday = d.adaylar.find((a) => a.id === params.get("aday"));

  const [adim, setAdim] = React.useState(0);
  const [ogr, setOgr] = React.useState(() => {
    const parca = (aday?.ogrenciAd ?? "").replace("—", "").trim().split(/\s+/);
    return {
      ad: parca.length > 1 ? parca.slice(0, -1).join(" ") : parca[0] ?? "",
      soyad: parca.length > 1 ? parca[parca.length - 1] : "",
      dogum: "",
      cinsiyet: "K" as "K" | "E",
      seviye: aday?.seviye ?? 5,
      okul: aday?.okul ?? "",
      okulSinifi: "",
      saglikNotu: "",
    };
  });
  const [veliler, setVeliler] = React.useState<VeliForm[]>(() => {
    if (!aday) return [bosVeli()];
    const p = aday.veliAd.trim().split(/\s+/);
    return [{ ...bosVeli(), ad: p.slice(0, -1).join(" ") || p[0], soyad: p.length > 1 ? p[p.length - 1] : "", telefon: aday.veliTelefon }];
  });
  const [birincil, setBirincil] = React.useState(0);
  const [subeId, setSubeId] = React.useState(aday?.subeId ?? (seciliSube !== "all" ? seciliSube : kapsam[0]));
  const [grupId, setGrupId] = React.useState("");
  const [hizmetler, setHizmetler] = React.useState<string[]>([]);
  const [indirimler, setIndirimler] = React.useState<string[]>([]);
  const [plan, setPlan] = React.useState({ pesinat: 0, taksit: 8, ilkVade: "2026-11-05" });
  const [onay, setOnay] = React.useState({ aydinlatma: false, rizaFoto: false, rizaSms: true, yontem: "yazdir" as "yazdir" | "link" });
  const [kapasiteOnay, setKapasiteOnay] = React.useState(false);

  const adimlar = [
    "Öğrenci",
    "Veli",
    "Şube ve grup",
    ...(moduller.finans ? ["Ücret", "Ödeme planı"] : []),
    "Kayıt formu",
  ];
  const sonAdim = adimlar.length - 1;
  const adimAdi = adimlar[adim];

  // Kardeş: veli telefonu sistemde varsa mevcut veliye bağlanabilir
  const veliEslesmeleri = veliler.map((v) => {
    const tel = telefonNormalize(v.telefon);
    return tel ? d.veliler.find((x) => x.telefon === tel) ?? null : null;
  });
  const kardesler = [...new Set(veliler.map((v) => v.mevcutId).filter(Boolean))].flatMap((vid) =>
    d.ogrenciler.filter((o) => o.veliIds.includes(vid!) && o.durum === "aktif"),
  );
  const mukerrer = mukerrerMi(
    { ad: ogr.ad, soyad: ogr.soyad, veliTelefon: veliler[0]?.telefon ?? "" },
    d.ogrenciler.map((o) => ({ ad: o.ad, soyad: o.soyad, veliTelefonlari: ogrenciVelileri(d, o).map((v) => v.telefon) })),
  );
  const mukerrerOgr = mukerrer
    ? d.ogrenciler.find((o) => normalAd(`${o.ad} ${o.soyad}`) === normalAd(`${ogr.ad} ${ogr.soyad}`))
    : undefined;

  React.useEffect(() => {
    if (kardesler.length && !indirimler.includes("Kardeş indirimi")) setIndirimler((x) => [...x, "Kardeş indirimi"]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kardesler.length]);

  const gruplar = d.gruplar.filter((g) => g.sezonId === AKTIF_SEZON && g.subeId === subeId).sort((a, b) => a.seviye - b.seviye);
  const secGrup = gruplar.find((g) => g.id === grupId);
  const dolu = secGrup ? grupDoluluk(d, secGrup.id) >= secGrup.kapasite : false;

  const liste = tanimlar().fiyatListesi[subeId] ?? 0;
  const hizmetTutar = ekHizmetler.filter((h) => hizmetler.includes(h.ad)).reduce((t, h) => t + h.fiyat, 0);
  const indirimOran = indirimTurleri.filter((i) => indirimler.includes(i.ad)).reduce((t, i) => t + i.oran, 0);
  const net = Math.round(liste * (1 - Math.min(indirimOran, 100) / 100)) + hizmetTutar;
  const planOnizleme = taksitPlani(net, plan.pesinat, plan.taksit, plan.ilkVade);

  const adimGecerli = (i: number): string | null => {
    const a = adimlar[i];
    if (a === "Öğrenci") {
      if (!ogr.ad.trim() || !ogr.soyad.trim()) return "Ad ve soyad zorunlu.";
      return null;
    }
    if (a === "Veli") {
      if (!veliler.length) return "En az bir veli girilmeli.";
      for (const v of veliler) {
        if (v.mevcutId) continue; // mevcut veliye bağlandı
        if (!v.ad.trim()) return "Veli adı zorunlu.";
        if (!telefonNormalize(v.telefon)) return "Geçerli bir veli telefonu girin (05xx…).";
      }
      if (mukerrer) return "Bu öğrenci zaten kayıtlı görünüyor.";
      return null;
    }
    if (a === "Şube ve grup") {
      if (!grupId) return "Grup seçin.";
      if (dolu && !kapasiteOnay) return "Grup dolu; devam etmek için yönetici onayını işaretleyin.";
      return null;
    }
    if (a === "Ödeme planı") {
      if (plan.pesinat > net) return "Peşinat net tutardan büyük olamaz.";
      if (plan.taksit < 0 || plan.taksit > 12) return "Taksit sayısı 0–12 arası olmalı.";
      return null;
    }
    if (a === "Kayıt formu" && !onay.aydinlatma) return "KVKK aydınlatma metninin okunduğu onaylanmalı.";
    return null;
  };
  const hata = adimGecerli(adim);

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
      ${veliler.map((v, i) => `<tr><td>${esc(v.ad)} ${esc(v.soyad)}${i === birincil ? " (birincil)" : ""}</td><td>${esc(v.yakinlik)}</td><td>${esc(telefonNormalize(v.telefon))}</td><td>${esc(v.eposta || "—")}</td></tr>`).join("")}
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
      <p>☑ KVKK aydınlatma metnini okudum, anladım (sürüm v1.2).<br/>${onay.rizaSms ? "☑" : "☐"} Bilgilendirme mesajları (devamsızlık, ders iptali) için SMS/uygulama bildirimi almayı kabul ediyorum.<br/>
      ${onay.rizaFoto ? "☑" : "☐"} Çocuğumun etkinlik fotoğraflarının kurum içi paylaşımlarda kullanılmasına izin veriyorum.</p>
      <p class="kucuk">Veli, çocuğunun kurum etkinliklerine katılmasına muvafakat eder. Kurum, öğrencinin ders saatleri içindeki gözetiminden sorumludur.</p>
      <div class="imza"><div>Veli adı soyadı / imza</div><div>Kurum yetkilisi / imza</div></div>`;
  };

  const tamamla = () => {
    const subeKod = sube(subeId)!.kod;
    const no = sozlesmeNo(subeKod, Number(BUGUN.slice(0, 4)), d.kayitlar.map((k) => k.sozlesmeNo));
    const ogrId = yeniId("o");
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
        x.veliler.push({
          id, ad: v.ad.trim(), soyad: (v.soyad || ogr.soyad).trim(), telefon: telefonNormalize(v.telefon)!, eposta: v.eposta, yakinlik: v.yakinlik,
          pushAcik: false, portalDavet: "gonderildi", izinSms: onay.rizaSms, izinTanitim: false,
        });
      }
      const birincilId = veliIds[Math.min(birincil, veliIds.length - 1)];
      x.ogrenciler.push({
        id: ogrId, ad: ogr.ad.trim(), soyad: ogr.soyad.trim(), dogum: ogr.dogum, cinsiyet: ogr.cinsiyet, okul: ogr.okul, okulSinifi: ogr.okulSinifi,
        saglikNotu: ogr.saglikNotu, veliIds: [birincilId, ...veliIds.filter((v) => v !== birincilId)], birincilVeliId: birincilId, durum: "aktif", notlar: [],
      });
      x.kayitlar.push({
        id: kayitId, ogrenciId: ogrId, sezonId: AKTIF_SEZON, subeId, grupId, sozlesmeNo: no, durum: "aktif", tarih: BUGUN,
        grupGecmisi: [{ grupId, tarih: BUGUN }], ekHizmetler: hizmetler, kvkkOnay: { tarih: BUGUN, surum: "v1.2" },
        listeFiyati: moduller.finans ? liste : 0,
        indirimler: moduller.finans ? indirimTurleri.filter((i) => indirimler.includes(i.ad)) : [],
        net: moduller.finans ? net : 0,
      });
      if (moduller.finans)
        for (const p of planOnizleme)
          x.taksitler.push({ id: yeniId("tk"), kayitId, ogrenciId: ogrId, veliId: birincilId, subeId, no: p.no, vade: p.vade, tutar: p.tutar, odenen: 0 });
      if (aday) x.adaylar = x.adaylar.map((a) => (a.id === aday.id ? { ...a, durum: "kayit", ogrenciId: ogrId, sonrakiAksiyon: null, notlar: [...a.notlar, { tarih: simdiZaman(), yazar: oturumAd, metin: `Kesin kayıt yapıldı (${no})` }] } : a));
      if (dolu) islemYaz(x, oturumAd, "Kapasite aşımı", `${grupEtiket(x, grupId)} grubuna kapasite üstü kayıt onaylandı`, subeId);
      islemYaz(x, oturumAd, "Kayıt", `${ogr.ad} ${ogr.soyad} — ${no}`, subeId);
      bildirimEkle(x, "hosgeldin", ogrId, {});
    });
    if (onay.yontem === "yazdir") yazdir(`Kayıt formu ${no}`, kayitFormuHtml(no), sube(subeId)?.ad);
    toast(`Kayıt tamamlandı (${no}). Veliye hoş geldiniz mesajı ve portal linki gönderildi.`);
    navigate(`/ogrenciler/${ogrId}`);
  };

  return (
    <div className="grid gap-6">
      <div>
        <Link to="/ogrenciler" className="mb-2 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="size-4" /> Öğrenciler
        </Link>
        <PageHeader code="04" title="Yeni kayıt" description={aday ? `Ön kayıttan aktarılıyor: ${aday.veliAd}` : "Tek ekranda adım adım kayıt."} />
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
                <Field label="Doğum tarihi"><Input type="date" value={ogr.dogum} onChange={(e) => setOgr({ ...ogr, dogum: e.target.value })} /></Field>
                <Field label="Cinsiyet">
                  <Select value={ogr.cinsiyet} onChange={(e) => setOgr({ ...ogr, cinsiyet: e.target.value as "K" | "E" })}>
                    <option value="K">Kız</option>
                    <option value="E">Erkek</option>
                  </Select>
                </Field>
                <Field label="Seviye">
                  <Select value={ogr.seviye} onChange={(e) => { setOgr({ ...ogr, seviye: Number(e.target.value) }); setGrupId(""); }}>
                    {[3, 4, 5, 6, 7, 8].map((s) => <option key={s} value={s}>{s}. sınıf</option>)}
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
                        Mevcut veliye bağlandı: <b>{tamAd(d.veliler.find((x) => x.id === v.mevcutId))}</b> ({d.veliler.find((x) => x.id === v.mevcutId)?.telefon}).{" "}
                        <button className="underline" onClick={() => setVeliler(veliler.map((x, j) => (j === i ? { ...x, mevcutId: null } : x)))}>Bağlantıyı kaldır</button>
                      </Alert>
                    ) : (
                      <div className="grid gap-3 sm:grid-cols-2">
                        <Field label="Ad *"><Input value={v.ad} onChange={(e) => setVeliler(veliler.map((x, j) => (j === i ? { ...x, ad: e.target.value } : x)))} /></Field>
                        <Field label="Soyad"><Input placeholder={ogr.soyad} value={v.soyad} onChange={(e) => setVeliler(veliler.map((x, j) => (j === i ? { ...x, soyad: e.target.value } : x)))} /></Field>
                        <Field label="Cep telefonu *" hint={v.telefon && !telefonNormalize(v.telefon) ? "Geçersiz numara" : "Veli portalına bu numarayla SMS koduyla girer."}>
                          <Input value={v.telefon} onChange={(e) => setVeliler(veliler.map((x, j) => (j === i ? { ...x, telefon: e.target.value } : x)))} placeholder="05xx xxx xx xx" />
                        </Field>
                        <Field label="E-posta"><Input type="email" value={v.eposta} onChange={(e) => setVeliler(veliler.map((x, j) => (j === i ? { ...x, eposta: e.target.value } : x)))} /></Field>
                        <Field label="Yakınlık">
                          <Select value={v.yakinlik} onChange={(e) => setVeliler(veliler.map((x, j) => (j === i ? { ...x, yakinlik: e.target.value as Veli["yakinlik"] } : x)))}>
                            <option>Anne</option>
                            <option>Baba</option>
                            <option>Diğer</option>
                          </Select>
                        </Field>
                      </div>
                    )}
                    {!v.mevcutId && es && (
                      <Alert tone="info" icon={<Users />}>
                        Bu telefon sistemde kayıtlı: <b>{tamAd(es)}</b> — çocuk(lar):{" "}
                        {d.ogrenciler.filter((o) => o.veliIds.includes(es.id)).map((o) => o.ad).join(", ")}.{" "}
                        <button className="font-medium text-primary underline" onClick={() => setVeliler(veliler.map((x, j) => (j === i ? { ...x, mevcutId: es.id } : x)))}>
                          Kardeş olarak bağla
                        </button>
                      </Alert>
                    )}
                  </div>
                );
              })}
              {veliler.length < 3 && (
                <Button variant="outline" className="justify-self-start" onClick={() => setVeliler([...veliler, { ...bosVeli(), yakinlik: "Baba" }])}>
                  <Plus /> Veli ekle
                </Button>
              )}
              {mukerrer && (
                <Alert tone="danger" icon={<AlertTriangle />}>
                  Aynı ad ve veli telefonuyla kayıtlı bir öğrenci var.{" "}
                  {mukerrerOgr && <Link className="font-medium underline" to={`/ogrenciler/${mukerrerOgr.id}`}>Mevcut kaydı aç</Link>}
                  . Öğrenci kurum genelinde tektir; başka şubeye geçiş için öğrenci kartındaki “Şube nakli”ni kullanın.
                </Alert>
              )}
            </>
          )}

          {adimAdi === "Şube ve grup" && (
            <>
              <Field label="Şube">
                <Select value={subeId} onChange={(e) => { setSubeId(e.target.value); setGrupId(""); }}>
                  {tanimlar().subeler.filter((s) => kapsam.includes(s.id)).map((s) => <option key={s.id} value={s.id}>{s.ad}</option>)}
                </Select>
              </Field>
              <div className="grid gap-2">
                <span className="text-sm font-medium">Grup ({ogr.seviye}. sınıf grupları önde)</span>
                <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  {[...gruplar].sort((a, b) => Number(b.seviye === ogr.seviye) - Number(a.seviye === ogr.seviye)).map((g) => {
                    const k = grupDoluluk(d, g.id);
                    const oran = k / g.kapasite;
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
                  {gruplar.length === 0 && <p className="text-sm text-muted-foreground">Bu şubede grup yok. Bölüm 01'den grup ekleyin.</p>}
                </div>
              </div>
              {dolu && (
                <Alert tone="warning" icon={<AlertTriangle />}>
                  <p>Bu grubun kontenjanı dolu. Kayıt engellenmez; yönetici onayı gerekir.</p>
                  <div className="mt-2"><Checkbox checked={kapasiteOnay} onChange={setKapasiteOnay} label="Kapasite aşımını onaylıyorum (işlem kaydına yazılır)" /></div>
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
              <div className="grid gap-3 sm:grid-cols-3">
                <StatCard label={`Liste fiyatı (${sube(subeId)?.kod})`} value={tl(liste)} />
                <StatCard label="Ek hizmetler" value={tl(hizmetTutar)} />
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
            </>
          )}

          {adimAdi === "Ödeme planı" && (
            <>
              <div className="grid gap-3 sm:grid-cols-3">
                <Field label="Peşinat (₺)"><Input type="number" min={0} value={plan.pesinat} onChange={(e) => setPlan({ ...plan, pesinat: Number(e.target.value) })} /></Field>
                <Field label="Taksit sayısı"><Input type="number" min={0} max={12} value={plan.taksit} onChange={(e) => setPlan({ ...plan, taksit: Number(e.target.value) })} /></Field>
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
                <div><span className="text-muted-foreground">Sözleşme no:</span> <span className="font-mono">{sozlesmeNo(sube(subeId)!.kod, 2026, d.kayitlar.map((k) => k.sozlesmeNo))}</span></div>
                {moduller.finans && <div><span className="text-muted-foreground">Net tutar:</span> <b>{tl(net)}</b> · {plan.taksit} taksit</div>}
              </div>
              {!moduller.finans && (
                <p className="text-xs text-muted-foreground">Finans modülü kapalı: ücret maddesi olmayan kayıt ve muvafakat formu üretilir.</p>
              )}
              <div className="grid gap-3">
                <Checkbox checked={onay.aydinlatma} onChange={(v) => setOnay({ ...onay, aydinlatma: v })} label="KVKK aydınlatma metni veliye okutuldu / iletildi *" description="Sürüm v1.2 · onay tarihi kayda yazılır" />
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

          {hata && adim <= sonAdim && <p className="text-sm text-danger">{hata}</p>}

          <div className="flex justify-between border-t pt-4">
            <Button variant="outline" onClick={() => (adim === 0 ? navigate(-1) : setAdim(adim - 1))}>
              <ChevronLeft /> {adim === 0 ? "Vazgeç" : "Geri"}
            </Button>
            {adim < sonAdim ? (
              <Button onClick={() => setAdim(adim + 1)} disabled={!!hata}>
                İleri <ChevronRight />
              </Button>
            ) : (
              <Button onClick={tamamla} disabled={!!hata}>
                <Check /> Kaydı tamamla
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

/* =========================== Öğrenci kartı =========================== */
type KartSekme = "genel" | "veliler" | "kayitlar" | "odemeler" | "yoklama" | "odevler" | "etut" | "notlar" | "belgeler";

function OgrenciKarti() {
  const { id } = useParams();
  const d = useDb();
  const { moduller } = useApp();
  const { subeGorunur } = useOturum();
  const [sekme, setSekme] = React.useState<KartSekme>("genel");
  const [islem, setIslem] = React.useState<null | "grup" | "nakil" | "iptal">(null);
  const o = d.ogrenciler.find((x) => x.id === id);
  const kayitlar = d.kayitlar.filter((k) => k.ogrenciId === id);
  const k = aktifKayit(d, id ?? "") ?? kayitlar[kayitlar.length - 1];

  if (!o || !k || !subeGorunur(k.subeId))
    return <EmptyState icon={<GraduationCap />} title="Öğrenci bulunamadı" text="Kayıt silinmiş veya şube kapsamınız dışında olabilir." />;

  const g = grup(d, k.grupId);
  const oz = devamsizlikOzeti(ogrenciYoklamalari(d, o.id).map((x) => x.durum));
  const sekmeler: { value: KartSekme; label: string }[] = [
    { value: "genel", label: "Genel" },
    { value: "veliler", label: "Veliler" },
    { value: "kayitlar", label: "Kayıtlar" },
    ...(moduller.finans ? [{ value: "odemeler" as const, label: "Ödemeler" }] : []),
    { value: "yoklama", label: "Yoklama" },
    ...(moduller.odev ? [{ value: "odevler" as const, label: "Ödevler" }] : []),
    ...(moduller.etut ? [{ value: "etut" as const, label: "Etüt" }] : []),
    { value: "notlar", label: "Notlar" },
    { value: "belgeler", label: "Belgeler" },
  ];

  const dondur = () => {
    const yeni = k.durum === "dondurulmus" ? "aktif" : "dondurulmus";
    guncelle((x) => {
      x.kayitlar = x.kayitlar.map((y) => (y.id === k.id ? { ...y, durum: yeni } : y));
      islemYaz(x, "Kullanıcı", yeni === "aktif" ? "Kayıt aktifleştirildi" : "Kayıt donduruldu", `${tamAd(o)} — ${k.sozlesmeNo}`, k.subeId);
    });
    toast(yeni === "aktif" ? "Kayıt yeniden aktif." : "Kayıt donduruldu; öğrenci yoklama listelerinde görünmez.");
  };

  return (
    <div className="grid gap-6">
      <Link to="/ogrenciler" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" /> Öğrenciler
      </Link>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          <Avatar ad={tamAd(o)} className="size-14 text-base" />
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">{tamAd(o)}</h1>
            <p className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
              <span>{g ? grupEtiket(d, g.id) : "—"}</span>·<span className="font-mono">{k.sozlesmeNo}</span>
              <Badge variant={durumEtiket[k.durum].v}>{durumEtiket[k.durum].ad}</Badge>
            </p>
          </div>
        </div>
        {k.durum !== "iptal" && (
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={() => setIslem("grup")}><Users /> Grup değiştir</Button>
            <Button variant="outline" size="sm" onClick={() => setIslem("nakil")}><ArrowRightLeft /> Şube nakli</Button>
            <Button variant="outline" size="sm" onClick={dondur}>{k.durum === "dondurulmus" ? <><PlayCircle /> Aktifleştir</> : <><PauseCircle /> Dondur</>}</Button>
            <Button variant="outline" size="sm" className="text-danger" onClick={() => setIslem("iptal")}><Ban /> Kaydı iptal et</Button>
          </div>
        )}
      </div>

      {o.saglikNotu && (
        <Alert tone="danger" icon={<HeartPulse />}>
          <b>Sağlık notu:</b> {o.saglikNotu}
        </Alert>
      )}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Devamsızlık" value={`%${Math.round(oz.oran * 100)}`} hint={`${oz.gelmedi} ders · ${oz.izinli} izinli · ${oz.gec} geç`} tone={oz.oran >= 0.15 ? "danger" : "default"} />
        <StatCard label="İşlenen ders" value={oz.toplam} hint="Bu sezon" />
        <StatCard label="Şube" value={sube(k.subeId)?.ad} hint={sube(k.subeId)?.telefon} />
        {moduller.finans ? (
          <StatCard label="Kalan borç" value={tl(d.taksitler.filter((t) => t.kayitId === k.id).reduce((s, t) => s + taksitKalan(t), 0))} />
        ) : (
          <StatCard label="Kayıt tarihi" value={tarihTR(k.tarih)} />
        )}
      </div>

      <Tabs value={sekme} onChange={setSekme} items={sekmeler} />
      {sekme === "genel" && <GenelBilgi o={o} />}
      {sekme === "veliler" && <VelilerSekmesi o={o} />}
      {sekme === "kayitlar" && <KayitlarSekmesi o={o} />}
      {sekme === "odemeler" && <OdemelerSekmesi o={o} />}
      {sekme === "yoklama" && <YoklamaSekmesi o={o} />}
      {sekme === "odevler" && <OdevlerSekmesi o={o} grupId={k.grupId} />}
      {sekme === "etut" && <EtutSekmesi o={o} />}
      {sekme === "notlar" && <NotlarSekmesi o={o} />}
      {sekme === "belgeler" && <BelgelerSekmesi o={o} />}

      {islem === "grup" && <GrupDegistir k={k} o={o} nakil={false} onClose={() => setIslem(null)} />}
      {islem === "nakil" && <GrupDegistir k={k} o={o} nakil onClose={() => setIslem(null)} />}
      {islem === "iptal" && <KayitIptal k={k} o={o} onClose={() => setIslem(null)} />}
    </div>
  );
}

function GenelBilgi({ o }: { o: Ogrenci }) {
  const [form, setForm] = React.useState(o);
  React.useEffect(() => setForm(o), [o]);
  const kaydet = () => {
    guncelle((x) => {
      x.ogrenciler = x.ogrenciler.map((y) => (y.id === o.id ? { ...y, ...form } : y));
    });
    toast("Öğrenci bilgileri kaydedildi.");
  };
  return (
    <Card>
      <CardContent className="grid gap-3 p-5 sm:grid-cols-2">
        <Field label="Ad"><Input value={form.ad} onChange={(e) => setForm({ ...form, ad: e.target.value })} /></Field>
        <Field label="Soyad"><Input value={form.soyad} onChange={(e) => setForm({ ...form, soyad: e.target.value })} /></Field>
        <Field label="Doğum tarihi"><Input type="date" value={form.dogum} onChange={(e) => setForm({ ...form, dogum: e.target.value })} /></Field>
        <Field label="Cinsiyet">
          <Select value={form.cinsiyet} onChange={(e) => setForm({ ...form, cinsiyet: e.target.value as "K" | "E" })}>
            <option value="K">Kız</option>
            <option value="E">Erkek</option>
          </Select>
        </Field>
        <Field label="Okulu"><Input value={form.okul} onChange={(e) => setForm({ ...form, okul: e.target.value })} /></Field>
        <Field label="Okuldaki sınıfı"><Input value={form.okulSinifi} onChange={(e) => setForm({ ...form, okulSinifi: e.target.value })} /></Field>
        <div className="sm:col-span-2">
          <Field label="Sağlık notu"><Textarea className="min-h-16" value={form.saglikNotu} onChange={(e) => setForm({ ...form, saglikNotu: e.target.value })} /></Field>
        </div>
        <div className="flex justify-end sm:col-span-2">
          <Button onClick={kaydet} disabled={!form.ad.trim() || !form.soyad.trim()}>Kaydet</Button>
        </div>
      </CardContent>
    </Card>
  );
}

function VelilerSekmesi({ o }: { o: Ogrenci }) {
  const d = useDb();
  const veliler = ogrenciVelileri(d, o);
  const [ekle, setEkle] = React.useState(false);
  const [yeni, setYeni] = React.useState(bosVeli());
  const tel = telefonNormalize(yeni.telefon);
  const mevcut = tel ? d.veliler.find((v) => v.telefon === tel) : undefined;

  const veliGuncelle = (id: string, p: Partial<Veli>) =>
    guncelle((x) => {
      x.veliler = x.veliler.map((v) => (v.id === id ? { ...v, ...p } : v));
    });
  const birincilYap = (id: string) =>
    guncelle((x) => {
      x.ogrenciler = x.ogrenciler.map((y) => (y.id === o.id ? { ...y, birincilVeliId: id } : y));
    });
  const veliEkle = () => {
    if (!yeni.ad.trim() || !tel) return;
    guncelle((x) => {
      let vid = mevcut?.id;
      if (!vid) {
        vid = yeniId("v");
        x.veliler.push({ id: vid, ad: yeni.ad.trim(), soyad: yeni.soyad.trim() || o.soyad, telefon: tel, eposta: yeni.eposta, yakinlik: yeni.yakinlik, pushAcik: false, portalDavet: "gonderildi", izinSms: true, izinTanitim: false });
      }
      x.ogrenciler = x.ogrenciler.map((y) => (y.id === o.id && !y.veliIds.includes(vid!) ? { ...y, veliIds: [...y.veliIds, vid!] } : y));
    });
    toast(mevcut ? "Mevcut veli bu öğrenciye bağlandı." : "Veli eklendi; portal davet SMS'i gönderilecek.");
    setYeni(bosVeli());
    setEkle(false);
  };

  return (
    <div className="grid gap-3 md:grid-cols-2">
      {veliler.map((v) => {
        const cocuklar = d.ogrenciler.filter((x) => x.veliIds.includes(v.id) && x.id !== o.id);
        return (
          <Card key={v.id}>
            <CardHeader>
              <div className="flex items-start justify-between gap-2">
                <div>
                  <CardTitle className="text-base">{tamAd(v)}</CardTitle>
                  <CardDescription>{v.yakinlik}</CardDescription>
                </div>
                {o.birincilVeliId === v.id ? <Badge>Birincil</Badge> : <Button variant="ghost" size="sm" onClick={() => birincilYap(v.id)}>Birincil yap</Button>}
              </div>
            </CardHeader>
            <CardContent className="grid gap-3 text-sm">
              <a href={`tel:${v.telefon.replace(/\s/g, "")}`} className="flex items-center gap-2 font-mono hover:text-primary"><Phone className="size-4" /> {v.telefon}</a>
              {cocuklar.length > 0 && (
                <p className="text-muted-foreground">
                  Kardeş: {cocuklar.map((c, i) => <React.Fragment key={c.id}>{i > 0 && ", "}<Link className="text-foreground underline" to={`/ogrenciler/${c.id}`}>{c.ad}</Link></React.Fragment>)}
                </p>
              )}
              <div className="grid gap-2 border-t pt-3">
                <div className="flex items-center justify-between"><span>Uygulama bildirimi</span><Badge variant={v.pushAcik ? "success" : "secondary"}>{v.pushAcik ? "Açık" : "Kapalı (SMS'e düşer)"}</Badge></div>
                <div className="flex items-center justify-between"><span>Bilgilendirme SMS izni</span><Switch label="SMS izni" checked={v.izinSms} onCheckedChange={(x) => veliGuncelle(v.id, { izinSms: x })} /></div>
                <div className="flex items-center justify-between"><span>Tanıtım mesajı izni (İYS)</span><Switch label="Tanıtım izni" checked={v.izinTanitim} onCheckedChange={(x) => veliGuncelle(v.id, { izinTanitim: x })} /></div>
              </div>
            </CardContent>
          </Card>
        );
      })}
      <button onClick={() => setEkle(true)} className="grid min-h-40 place-items-center rounded-lg border border-dashed text-sm text-muted-foreground hover:border-primary hover:text-primary">
        <span className="flex items-center gap-2"><Plus className="size-4" /> Veli ekle</span>
      </button>
      <Dialog
        open={ekle}
        onClose={() => setEkle(false)}
        title="Veli ekle"
        footer={<><Button variant="outline" onClick={() => setEkle(false)}>Vazgeç</Button><Button onClick={veliEkle} disabled={!yeni.ad.trim() || !tel}>{mevcut ? "Bağla" : "Ekle"}</Button></>}
      >
        <div className="grid grid-cols-2 gap-3">
          <Field label="Ad"><Input value={yeni.ad} onChange={(e) => setYeni({ ...yeni, ad: e.target.value })} /></Field>
          <Field label="Soyad"><Input value={yeni.soyad} placeholder={o.soyad} onChange={(e) => setYeni({ ...yeni, soyad: e.target.value })} /></Field>
        </div>
        <Field label="Telefon"><Input value={yeni.telefon} onChange={(e) => setYeni({ ...yeni, telefon: e.target.value })} /></Field>
        <Field label="Yakınlık">
          <Select value={yeni.yakinlik} onChange={(e) => setYeni({ ...yeni, yakinlik: e.target.value as Veli["yakinlik"] })}>
            <option>Anne</option><option>Baba</option><option>Diğer</option>
          </Select>
        </Field>
        {mevcut && <Alert icon={<Link2 />}>Bu numara <b>{tamAd(mevcut)}</b> adına kayıtlı; mevcut veli bağlanacak.</Alert>}
      </Dialog>
    </div>
  );
}

function KayitlarSekmesi({ o }: { o: Ogrenci }) {
  const d = useDb();
  const { moduller } = useApp();
  const kayitlar = d.kayitlar.filter((k) => k.ogrenciId === o.id);
  return (
    <div className="grid gap-3">
      {kayitlar.map((k) => (
        <Card key={k.id}>
          <CardHeader className="flex-row items-start justify-between">
            <div>
              <CardTitle className="text-base">{tanimlar().sezonlar.find((z) => z.id === k.sezonId)?.ad} · <span className="font-mono">{k.sozlesmeNo}</span></CardTitle>
              <CardDescription className="mt-1">{sube(k.subeId)?.ad} · {grupEtiket(d, k.grupId)} · kayıt {tarihTR(k.tarih)}</CardDescription>
            </div>
            <Badge variant={durumEtiket[k.durum].v}>{durumEtiket[k.durum].ad}</Badge>
          </CardHeader>
          <CardContent className="grid gap-3 text-sm">
            {k.ekHizmetler.length > 0 && <p><span className="text-muted-foreground">Ek hizmetler:</span> {k.ekHizmetler.join(", ")}</p>}
            {moduller.finans && k.net > 0 && (
              <p><span className="text-muted-foreground">Ücret:</span> {tl(k.listeFiyati)} {k.indirimler.map((i) => `− %${i.oran} ${i.ad}`).join(" ")} → <b>{tl(k.net)}</b></p>
            )}
            <div>
              <p className="mb-1 text-muted-foreground">Grup geçmişi</p>
              <ol className="flex flex-wrap items-center gap-2">
                {k.grupGecmisi.map((gg, i) => (
                  <li key={i} className="flex items-center gap-2">
                    {i > 0 && <ChevronRight className="size-3.5 text-muted-foreground" />}
                    <Badge variant="outline">{grupEtiket(d, gg.grupId)} · {tarihTR(gg.tarih)}</Badge>
                  </li>
                ))}
              </ol>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function OdemelerSekmesi({ o }: { o: Ogrenci }) {
  const d = useDb();
  const navigate = useNavigate();
  const taksitler = d.taksitler.filter((t) => t.ogrenciId === o.id).sort((a, b) => a.vade.localeCompare(b.vade));
  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between">
        <CardTitle className="text-base">Ödeme planı</CardTitle>
        <Button size="sm" onClick={() => navigate(`/finans?veli=${o.birincilVeliId}`)}>Tahsilat al</Button>
      </CardHeader>
      <Table>
        <thead><tr><Th>Taksit</Th><Th>Vade</Th><Th className="text-right">Tutar</Th><Th className="text-right">Ödenen</Th><Th>Durum</Th></tr></thead>
        <tbody>
          {taksitler.map((t) => {
            const kalan = taksitKalan(t);
            const gecikti = kalan > 0 && t.vade < BUGUN;
            return (
              <tr key={t.id}>
                <Td>{taksitAdi(t.no)}</Td>
                <Td>{tarihTR(t.vade)}</Td>
                <Td className="text-right tabular-nums">{tl(t.tutar)}</Td>
                <Td className="text-right tabular-nums">{tl(t.odenen)}</Td>
                <Td>{kalan <= 0 ? <Badge variant="success">Ödendi</Badge> : gecikti ? <Badge variant="danger">Gecikti</Badge> : t.odenen > 0 ? <Badge variant="warning">Kısmi</Badge> : <Badge variant="secondary">Bekliyor</Badge>}</Td>
              </tr>
            );
          })}
        </tbody>
      </Table>
      {taksitler.length === 0 && <CardContent><p className="text-sm text-muted-foreground">Ödeme planı yok.</p></CardContent>}
    </Card>
  );
}

const yoklamaRozet: Record<string, { ad: string; v: "success" | "danger" | "warning" | "secondary" }> = {
  geldi: { ad: "Geldi", v: "success" },
  gelmedi: { ad: "Gelmedi", v: "danger" },
  gec: { ad: "Geç geldi", v: "warning" },
  izinli: { ad: "İzinli", v: "secondary" },
};

function YoklamaSekmesi({ o }: { o: Ogrenci }) {
  const d = useDb();
  const liste = ogrenciYoklamalari(d, o.id);
  return (
    <Card>
      <Table>
        <thead><tr><Th>Tarih</Th><Th>Ders</Th><Th>İşlenen konu</Th><Th>Durum</Th></tr></thead>
        <tbody>
          {liste.slice(0, 40).map(({ y, durum }) => {
            const satir = d.program.find((p) => p.id === y.satirId);
            return (
              <tr key={y.oturumId}>
                <Td className="whitespace-nowrap tabular-nums">{tarihTR(y.tarih)}</Td>
                <Td>{satir ? dersAdi(satir.dersId) : "—"} <span className="text-xs text-muted-foreground">· {personelAdi(d, y.ogretmenId)}</span></Td>
                <Td className="text-muted-foreground">{y.konu || "—"}</Td>
                <Td><Badge variant={yoklamaRozet[durum].v}>{yoklamaRozet[durum].ad}</Badge></Td>
              </tr>
            );
          })}
        </tbody>
      </Table>
      {liste.length === 0 && <CardContent><p className="p-4 text-sm text-muted-foreground">Henüz yoklama yok.</p></CardContent>}
    </Card>
  );
}

function OdevlerSekmesi({ o, grupId }: { o: Ogrenci; grupId: string }) {
  const d = useDb();
  const odevler = d.odevler.filter((x) => x.grupId === grupId && (!x.ogrenciIds || x.ogrenciIds.includes(o.id))).sort((a, b) => b.teslim.localeCompare(a.teslim));
  const rozet = { yapti: ["Yaptı", "success"], eksik: ["Eksik", "warning"], yapmadi: ["Yapmadı", "danger"] } as const;
  return (
    <Card>
      <Table>
        <thead><tr><Th>Ödev</Th><Th>Ders</Th><Th>Teslim</Th><Th>Durum</Th></tr></thead>
        <tbody>
          {odevler.map((x) => {
            const t = x.teslimler[o.id];
            return (
              <tr key={x.id}>
                <Td className="font-medium">{x.baslik}</Td>
                <Td>{dersAdi(x.dersId)}</Td>
                <Td className="tabular-nums">{tarihTR(x.teslim)}</Td>
                <Td>{t ? <Badge variant={rozet[t][1]}>{rozet[t][0]}</Badge> : <Badge variant="secondary">{x.teslim >= BUGUN ? "Bekliyor" : "Kontrol edilmedi"}</Badge>}</Td>
              </tr>
            );
          })}
        </tbody>
      </Table>
      {odevler.length === 0 && <CardContent><p className="p-4 text-sm text-muted-foreground">Ödev yok.</p></CardContent>}
    </Card>
  );
}

function EtutSekmesi({ o }: { o: Ogrenci }) {
  const d = useDb();
  const randevular = d.randevular.filter((r) => r.ogrenciIds.includes(o.id)).sort((a, b) => b.tarih.localeCompare(a.tarih));
  const paketler = d.paketler.filter((p) => p.ogrenciId === o.id);
  return (
    <div className="grid gap-3">
      {paketler.map((p) => (
        <Alert key={p.id} icon={<FileText />}>
          Özel ders paketi: <b>{dersAdi(p.dersId)}</b> ({personelAdi(d, p.ogretmenId)}) — kalan hak <b>{p.kalan}/{p.toplam}</b>
        </Alert>
      ))}
      <Card>
        <Table>
          <thead><tr><Th>Tarih</Th><Th>Saat</Th><Th>Öğretmen</Th><Th>Tür</Th><Th>Durum</Th></tr></thead>
          <tbody>
            {randevular.map((r) => (
              <tr key={r.id}>
                <Td className="tabular-nums">{tarihTR(r.tarih)}</Td>
                <Td className="tabular-nums">{r.bas}–{r.bit}</Td>
                <Td>{personelAdi(d, r.ogretmenId)}</Td>
                <Td className="capitalize">{r.tur}</Td>
                <Td><Badge variant={r.durum === "yapildi" ? "success" : r.durum === "planli" ? "default" : r.durum === "gelmedi" ? "danger" : "secondary"}>{r.durum}</Badge></Td>
              </tr>
            ))}
          </tbody>
        </Table>
        {randevular.length === 0 && <CardContent><p className="p-4 text-sm text-muted-foreground">Etüt randevusu yok.</p></CardContent>}
      </Card>
    </div>
  );
}

function NotlarSekmesi({ o }: { o: Ogrenci }) {
  const { ad } = useOturum();
  const [not, setNot] = React.useState("");
  const ekle = () => {
    if (!not.trim()) return;
    guncelle((x) => {
      x.ogrenciler = x.ogrenciler.map((y) => (y.id === o.id ? { ...y, notlar: [{ tarih: simdiZaman(), yazar: ad, metin: not.trim() }, ...y.notlar] } : y));
    });
    setNot("");
  };
  return (
    <Card>
      <CardContent className="grid gap-4 p-5">
        <div className="flex gap-2">
          <Textarea className="min-h-16" placeholder="Öğrenciyle ilgili not (yalnızca personel görür)" value={not} onChange={(e) => setNot(e.target.value)} />
          <Button className="self-end" onClick={ekle} disabled={!not.trim()}>Ekle</Button>
        </div>
        {o.notlar.length === 0 && <p className="text-sm text-muted-foreground">Not yok.</p>}
        {o.notlar.map((n, i) => (
          <div key={i} className="rounded-md border p-3 text-sm">
            <p>{n.metin}</p>
            <p className="mt-1 text-xs text-muted-foreground">{n.yazar} · {new Date(n.tarih).toLocaleString("tr-TR", { dateStyle: "medium", timeStyle: "short" })}</p>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

function BelgelerSekmesi({ o }: { o: Ogrenci }) {
  const d = useDb();
  const kayitlar = d.kayitlar.filter((k) => k.ogrenciId === o.id);
  const veliler = ogrenciVelileri(d, o);
  const yazdirForm = (k: Kayit) => {
    const ok = yazdir(
      `Kayıt formu ${k.sozlesmeNo}`,
      `<h1>Kayıt ve Muvafakat Formu</h1><p class="kucuk">Sözleşme no: <b>${esc(k.sozlesmeNo)}</b> · Kayıt tarihi: ${tarihTR(k.tarih)}</p>
       <table><tr><th>Öğrenci</th><td>${esc(tamAd(o))}</td><th>Grup</th><td>${esc(grupEtiket(d, k.grupId))}</td></tr>
       <tr><th>Okul</th><td>${esc(o.okul)} ${esc(o.okulSinifi)}</td><th>Doğum</th><td>${esc(tarihTR(o.dogum))}</td></tr></table>
       <h2>Veliler</h2><table>${veliler.map((v) => `<tr><td>${esc(tamAd(v))}</td><td>${esc(v.yakinlik)}</td><td>${esc(v.telefon)}</td></tr>`).join("")}</table>
       <p>KVKK onayı: ${k.kvkkOnay ? `${esc(k.kvkkOnay.surum)} · ${tarihTR(k.kvkkOnay.tarih)}` : "alınmadı"}</p>
       <div class="imza"><div>Veli / imza</div><div>Kurum yetkilisi / imza</div></div>`,
      sube(k.subeId)?.ad,
    );
    if (!ok) toast("Açılır pencere engellendi; tarayıcı ayarlarından izin verin.", "uyari");
  };
  return (
    <Card>
      <Table>
        <thead><tr><Th>Belge</Th><Th>Sürüm / tarih</Th><Th className="text-right">İşlem</Th></tr></thead>
        <tbody>
          {kayitlar.map((k) => (
            <React.Fragment key={k.id}>
              <tr>
                <Td className="font-medium">Kayıt ve muvafakat formu · {k.sozlesmeNo}</Td>
                <Td>{tarihTR(k.tarih)}</Td>
                <Td className="text-right"><Button variant="outline" size="sm" onClick={() => yazdirForm(k)}><Printer /> Yazdır / PDF</Button></Td>
              </tr>
              <tr>
                <Td>KVKK aydınlatma ve açık rıza</Td>
                <Td>{k.kvkkOnay ? `${k.kvkkOnay.surum} · ${tarihTR(k.kvkkOnay.tarih)}` : <Badge variant="danger">Alınmadı</Badge>}</Td>
                <Td />
              </tr>
            </React.Fragment>
          ))}
        </tbody>
      </Table>
    </Card>
  );
}

/* ---------- Grup değişikliği / şube nakli ---------- */
function GrupDegistir({ k, o, nakil, onClose }: { k: Kayit; o: Ogrenci; nakil: boolean; onClose: () => void }) {
  const d = useDb();
  const { moduller } = useApp();
  const { ad, kapsam } = useOturum();
  const [hedef, setHedef] = React.useState("");
  const adaylar = d.gruplar.filter((g) => g.sezonId === AKTIF_SEZON && g.id !== k.grupId && (nakil ? g.subeId !== k.subeId && kapsam.includes(g.subeId) : g.subeId === k.subeId));
  const hedefGrup = adaylar.find((g) => g.id === hedef);
  const kalanTaksit = d.taksitler.filter((t) => t.kayitId === k.id && taksitKalan(t) > 0);

  const uygula = () => {
    if (!hedefGrup) return;
    guncelle((x) => {
      x.kayitlar = x.kayitlar.map((y) =>
        y.id === k.id ? { ...y, grupId: hedefGrup.id, subeId: hedefGrup.subeId, grupGecmisi: [...y.grupGecmisi, { grupId: hedefGrup.id, tarih: BUGUN }] } : y,
      );
      if (nakil) {
        // Kalan taksitler yeni şubeye devredilir; ödenmiş tutarlar eski şubenin kasasında kalır.
        x.taksitler = x.taksitler.map((t) => (t.kayitId === k.id && taksitKalan(t) > 0 ? { ...t, subeId: hedefGrup.subeId } : t));
      }
      islemYaz(x, ad, nakil ? "Şube nakli" : "Grup değişikliği", `${tamAd(o)}: ${grupEtiket(x, k.grupId)} → ${grupEtiket(x, hedefGrup.id)}`, hedefGrup.subeId);
    });
    toast(nakil ? `Nakil tamamlandı: ${sube(hedefGrup.subeId)?.ad}` : "Grup değiştirildi.");
    onClose();
  };

  return (
    <Dialog
      open
      onClose={onClose}
      title={nakil ? "Şube nakli" : "Grup değiştir"}
      description={`${tamAd(o)} · şu an ${grupEtiket(d, k.grupId)}. Kayıt bozulmaz, tarihçe tutulur.`}
      footer={<><Button variant="outline" onClick={onClose}>Vazgeç</Button><Button onClick={uygula} disabled={!hedefGrup}>Uygula</Button></>}
    >
      <Field label="Yeni grup">
        <Select value={hedef} onChange={(e) => setHedef(e.target.value)}>
          <option value="">Seçiniz</option>
          {adaylar.map((g) => (
            <option key={g.id} value={g.id}>{grupEtiket(d, g.id)} ({grupDoluluk(d, g.id)}/{g.kapasite})</option>
          ))}
        </Select>
      </Field>
      {adaylar.length === 0 && <p className="text-sm text-muted-foreground">Uygun grup yok.</p>}
      {nakil && moduller.finans && kalanTaksit.length > 0 && (
        <Alert tone="warning" icon={<AlertTriangle />}>
          {kalanTaksit.length} açık taksit ({tl(kalanTaksit.reduce((s, t) => s + taksitKalan(t), 0))}) yeni şubeye devredilecek. Fiyat farkı varsa yönetici onayıyla düzeltme kalemi ekleyin.
        </Alert>
      )}
    </Dialog>
  );
}

function KayitIptal({ k, o, onClose }: { k: Kayit; o: Ogrenci; onClose: () => void }) {
  const d = useDb();
  const { moduller } = useApp();
  const { ad } = useOturum();
  const [neden, setNeden] = React.useState("");
  const kalan = d.taksitler.filter((t) => t.kayitId === k.id).reduce((s, t) => s + taksitKalan(t), 0);
  const iptal = () => {
    guncelle((x: Db) => {
      x.kayitlar = x.kayitlar.map((y) => (y.id === k.id ? { ...y, durum: "iptal" } : y));
      x.ogrenciler = x.ogrenciler.map((y) => (y.id === o.id ? { ...y, durum: "ayrildi" } : y));
      islemYaz(x, ad, "Kayıt iptali", `${tamAd(o)} — ${k.sozlesmeNo}. Neden: ${neden}`, k.subeId);
    });
    toast("Kayıt iptal edildi; öğrenci gruptan çıkarıldı, geçmiş korunuyor.");
    onClose();
  };
  return (
    <Dialog
      open
      onClose={onClose}
      title="Kaydı iptal et"
      description={`${tamAd(o)} · ${k.sozlesmeNo}. Öğrenci gruptan çıkar; yoklama ve ödeme geçmişi korunur.`}
      footer={<><Button variant="outline" onClick={onClose}>Vazgeç</Button><Button variant="destructive" onClick={iptal} disabled={neden.trim().length < 3}>İptal et</Button></>}
    >
      <Field label="İptal nedeni (işlem kaydına yazılır)"><Textarea value={neden} onChange={(e) => setNeden(e.target.value)} /></Field>
      {moduller.finans && kalan > 0 && (
        <Alert tone="warning" icon={<AlertTriangle />}>Kalan borç: <b>{tl(kalan)}</b>. İade / kalan borç hesabı Finans bölümünden yapılır.</Alert>
      )}
    </Dialog>
  );
}

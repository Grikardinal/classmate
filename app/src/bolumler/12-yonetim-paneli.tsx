/**
 * Bölüm 12 · Yönetim paneli (dashboard) ve raporlar
 * Doküman: docs/bolumler/12-yonetim-paneli-ve-raporlar.md
 */
import * as React from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  AlarmClock,
  BookOpenCheck,
  CalendarCheck2,
  ClipboardCheck,
  ClipboardX,
  Clock,
  Download,
  FileBarChart,
  GraduationCap,
  LayoutDashboard,
  PhoneCall,
  Printer,
  TrendingDown,
  TrendingUp,
  UserPlus,
  Users,
  Wallet,
} from "lucide-react";
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Checkbox,
  PageHeader,
  StatCard,
  Table,
  Tabs,
  Td,
  Th,
} from "@/components/ui";
import { BarChart } from "@/components/ui/chart";
import { useApp, useOturum } from "@/context/AppContext";
import {
  AKTIF_SEZON,
  BUGUN,
  SIMDI,
  dersAdi,
  grupDoluluk,
  grupEtiket,
  ogrenciYoklamalari,
  oturumlar,
  personelAdi,
  sube,
  tamAd,
  taksitAdi,
  taksitKalan,
  useDb,
  type Db,
} from "@/data/store";
import { csvOlustur, devamsizlikOzeti, gecikmeGunu, haftaBasi, tarihEkle, tl, yoklamaGecikti } from "@/lib/kurallar";
import { dosyaIndir, esc, yazdir } from "@/lib/yazdir";
import { cn } from "@/lib/utils";

export default function YonetimPaneli() {
  const { ogretmenMi } = useOturum();
  const [sekme, setSekme] = React.useState<"panel" | "rapor">("panel");
  if (ogretmenMi) return <OgretmenPaneli />;
  return (
    <div className="grid gap-6">
      <PageHeader code="12" title="Yönetim paneli" description="Kurumun durumunu 10 saniyede görün; bugün yapılacakları kaçırmayın." />
      <Tabs
        value={sekme}
        onChange={setSekme}
        items={[
          { value: "panel", label: "Panel", icon: <LayoutDashboard /> },
          { value: "rapor", label: "Raporlar", icon: <FileBarChart /> },
        ]}
      />
      {sekme === "panel" ? <Panel /> : <Raporlar />}
    </div>
  );
}

/** Bu haftaki ders oturumları (bugüne kadar) */
function haftaOturumlari(d: Db, grupGorunur: (g: string) => boolean) {
  const bas = haftaBasi(BUGUN);
  const l = [];
  for (let t = bas; t <= BUGUN; t = tarihEkle(t, 1)) l.push(...oturumlar(d, t).filter((o) => grupGorunur(o.satir.grupId) && !o.iptal && !o.tatil));
  return l;
}

function Panel() {
  const d = useDb();
  const { moduller } = useApp();
  const { subeGorunur, grupGorunur, seciliSubeler, rol } = useOturum();
  const navigate = useNavigate();

  const kayitlar = d.kayitlar.filter((k) => k.sezonId === AKTIF_SEZON && subeGorunur(k.subeId));
  const aktif = kayitlar.filter((k) => k.durum === "aktif");
  const gecenAySonu = BUGUN.slice(0, 8) + "01";
  const gecenAyAktif = aktif.filter((k) => k.tarih < gecenAySonu).length;
  const degisim = aktif.length - gecenAyAktif;
  const gruplar = d.gruplar.filter((g) => g.sezonId === AKTIF_SEZON && subeGorunur(g.subeId));
  const kapasite = gruplar.reduce((s, g) => s + g.kapasite, 0);

  const hafta = haftaOturumlari(d, grupGorunur);
  const islenen = hafta.filter((o) => d.yoklamalar[o.id]).length;
  const alinmayan = hafta.filter((o) => !d.yoklamalar[o.id] && (o.tarih < BUGUN || yoklamaGecikti(o.bas, SIMDI, d.ayarlar.yoklamaHatirlatmaDk)));
  const haftaDurum = hafta.flatMap((o) => Object.values(d.yoklamalar[o.id]?.durumlar ?? {}));
  const devam = devamsizlikOzeti(haftaDurum);

  const adaylar = d.adaylar.filter((a) => subeGorunur(a.subeId) && a.durum !== "kayit" && a.durum !== "vazgecti");
  const aranacak = adaylar.filter((a) => a.sonrakiAksiyon && a.sonrakiAksiyon <= BUGUN);
  const etutler = d.randevular.filter((r) => r.tarih === BUGUN && r.durum === "planli" && subeGorunur(r.subeId));

  const finansGorur = moduller.finans && (rol === "genel-yonetici" || rol === "sube-muduru");
  const taksitler = d.taksitler.filter((t) => subeGorunur(t.subeId));
  const buAy = taksitler.filter((t) => t.vade.startsWith(BUGUN.slice(0, 7)));
  const beklenen = buAy.reduce((s, t) => s + t.tutar, 0);
  const tahsil = buAy.reduce((s, t) => s + t.odenen, 0);
  const geciken = taksitler.filter((t) => t.vade < BUGUN && taksitKalan(t) > 0);
  const vadesiBugun = taksitler.filter((t) => t.vade === BUGUN && taksitKalan(t) > 0);

  // Aylık yeni kayıt (son 6 ay)
  const aylar = Array.from({ length: 6 }, (_, i) => {
    const t = new Date(Number(BUGUN.slice(0, 4)), Number(BUGUN.slice(5, 7)) - 1 - (5 - i), 1);
    return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, "0")}`;
  });
  const aylikKayit = aylar.map((a) => ({
    etiket: new Date(a + "-01T00:00:00").toLocaleDateString("tr-TR", { month: "short" }),
    deger: kayitlar.filter((k) => k.tarih.startsWith(a)).length,
    ipucu: new Date(a + "-01T00:00:00").toLocaleDateString("tr-TR", { month: "long", year: "numeric" }) + " yeni kayıt",
  }));
  const seviyeler = [3, 4, 5, 6, 7, 8].map((s) => ({
    etiket: `${s}. sınıf`,
    deger: aktif.filter((k) => d.gruplar.find((g) => g.id === k.grupId)?.seviye === s).length,
    ipucu: `${s}. sınıf öğrenci`,
  }));

  return (
    <div className="grid gap-6">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard
          label="Aktif öğrenci"
          value={aktif.length}
          icon={<GraduationCap />}
          hint={<span className={cn("inline-flex items-center gap-1", degisim > 0 && "text-success")}>{degisim > 0 ? <TrendingUp className="size-3" /> : <TrendingDown className="size-3" />}{degisim >= 0 ? "+" : ""}{degisim} bu ay</span>}
          onClick={() => navigate("/ogrenciler")}
        />
        <StatCard label="Devamsızlık (bu hafta)" value={`%${Math.round(devam.oran * 1000) / 10}`} icon={<ClipboardX />} tone={devam.oran > 0.1 ? "danger" : "default"} hint={`${devam.gelmedi} gelmedi · ${devam.izinli} izinli`} onClick={() => navigate("/yoklama")} />
        <StatCard label="Doluluk" value={`%${kapasite ? Math.round((aktif.length / kapasite) * 100) : 0}`} icon={<Users />} hint={`${aktif.length} / ${kapasite} kontenjan`} />
        {finansGorur ? (
          <StatCard label="Bu ay tahsilat" value={`%${beklenen ? Math.round((tahsil / beklenen) * 100) : 0}`} icon={<Wallet />} tone="success" hint={`${tl(tahsil)} / ${tl(beklenen)}`} onClick={() => navigate("/finans")} />
        ) : (
          <StatCard label="Bu hafta işlenen ders" value={`${islenen}/${hafta.length}`} icon={<CalendarCheck2 />} hint="Yoklaması alınan / planlanan" />
        )}
        {finansGorur && (
          <StatCard label="Vadesi geçen" value={tl(geciken.reduce((s, t) => s + taksitKalan(t), 0))} icon={<AlarmClock />} tone="danger" hint={`${new Set(geciken.map((t) => t.veliId)).size} veli`} onClick={() => navigate("/finans")} />
        )}
        {finansGorur && <StatCard label="Bu hafta işlenen ders" value={`${islenen}/${hafta.length}`} icon={<CalendarCheck2 />} />}
        <StatCard label="Yoklaması alınmayan ders" value={alinmayan.length} icon={<ClipboardCheck />} tone={alinmayan.length ? "warning" : "default"} hint="Bu hafta" onClick={() => navigate("/yoklama")} />
        {moduller.onKayit && <StatCard label="Bekleyen ön kayıt" value={adaylar.length} icon={<UserPlus />} hint={`${aranacak.length} kişi bugün aranacak`} onClick={() => navigate("/on-kayit")} />}
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_1.2fr]">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Bugün yapılacaklar</CardTitle>
            <CardDescription>{new Date(BUGUN + "T00:00:00").toLocaleDateString("tr-TR", { weekday: "long", day: "numeric", month: "long" })}</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-2">
            {moduller.onKayit && <Yapilacak ikon={<PhoneCall />} baslik="Aranacak adaylar" sayi={aranacak.length} alt={aranacak.slice(0, 3).map((a) => a.veliAd).join(", ")} to="/on-kayit" />}
            {finansGorur && <Yapilacak ikon={<AlarmClock />} baslik="Vadesi gelen / geciken ödemeler" sayi={vadesiBugun.length + new Set(geciken.map((t) => t.veliId)).size} alt={`${vadesiBugun.length} bugün · ${new Set(geciken.map((t) => t.veliId)).size} geciken veli`} to="/finans" />}
            <Yapilacak ikon={<ClipboardCheck />} baslik="Yoklaması alınmamış dersler" sayi={alinmayan.length} alt={alinmayan.slice(0, 3).map((o) => `${grupEtiket(d, o.satir.grupId)} ${o.bas}`).join(", ")} to="/yoklama" />
            {moduller.etut && <Yapilacak ikon={<Clock />} baslik="Bugünkü etüt randevuları" sayi={etutler.length} alt={etutler.map((r) => `${r.bas} ${personelAdi(d, r.ogretmenId)}`).join(", ")} to="/etut" />}
            {moduller.odev && (
              <Yapilacak ikon={<BookOpenCheck />} baslik="Kontrol bekleyen ödevler" sayi={d.odevler.filter((o) => grupGorunur(o.grupId) && o.teslim <= BUGUN && !o.kontrolEdildi).length} to="/odevler" />
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Aylık yeni kayıt</CardTitle>
            <CardDescription>Son 6 ay · {AKTIF_SEZON === "z2" ? "2026-2027 sezonu" : ""}</CardDescription>
          </CardHeader>
          <CardContent><BarChart veri={aylikKayit} /></CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Seviyeye göre öğrenci</CardTitle>
            <CardDescription>Aktif kayıtlar, 3–8. sınıf</CardDescription>
          </CardHeader>
          <CardContent><BarChart veri={seviyeler} yukseklik={160} /></CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Son işlemler</CardTitle>
          </CardHeader>
          <ul className="divide-y">
            {d.islemler.filter((i) => !i.subeId || subeGorunur(i.subeId)).slice(0, 7).map((i) => (
              <li key={i.id} className="flex items-start gap-3 px-5 py-2.5 text-sm">
                <Badge variant="outline" className="mt-0.5 shrink-0">{i.islem}</Badge>
                <span className="min-w-0 flex-1 truncate" title={i.detay}>{i.detay}</span>
                <span className="shrink-0 text-xs text-muted-foreground">{new Date(i.zaman).toLocaleString("tr-TR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</span>
              </li>
            ))}
          </ul>
        </Card>
      </div>

      {seciliSubeler.length > 1 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Şube karşılaştırma</CardTitle>
            <CardDescription>“Tüm şubeler” görünümünde</CardDescription>
          </CardHeader>
          <Table>
            <thead>
              <tr>
                <Th>Şube</Th>
                <Th className="text-right">Öğrenci</Th>
                <Th className="text-right">Doluluk</Th>
                <Th className="text-right">Devamsızlık (sezon)</Th>
                {finansGorur && <Th className="text-right">Tahsilat oranı</Th>}
                {moduller.onKayit && <Th className="text-right">Açık aday</Th>}
              </tr>
            </thead>
            <tbody>
              {seciliSubeler.map((s) => {
                const sk = aktif.filter((k) => k.subeId === s);
                const kap = gruplar.filter((g) => g.subeId === s).reduce((t, g) => t + g.kapasite, 0);
                const oz = devamsizlikOzeti(Object.values(d.yoklamalar).filter((y) => d.gruplar.find((g) => g.id === y.grupId)?.subeId === s).flatMap((y) => Object.values(y.durumlar)));
                const ts = d.taksitler.filter((t) => t.subeId === s && t.vade <= BUGUN);
                const vb = ts.reduce((t, x) => t + x.tutar, 0);
                return (
                  <tr key={s}>
                    <Td className="font-medium">{sube(s)?.ad}</Td>
                    <Td className="text-right tabular-nums">{sk.length}</Td>
                    <Td className="text-right tabular-nums">%{kap ? Math.round((sk.length / kap) * 100) : 0}</Td>
                    <Td className="text-right tabular-nums">%{Math.round(oz.oran * 1000) / 10}</Td>
                    {finansGorur && <Td className="text-right tabular-nums">%{vb ? Math.round((ts.reduce((t, x) => t + x.odenen, 0) / vb) * 100) : 0}</Td>}
                    {moduller.onKayit && <Td className="text-right tabular-nums">{adaylar.filter((a) => a.subeId === s).length}</Td>}
                  </tr>
                );
              })}
            </tbody>
          </Table>
        </Card>
      )}
    </div>
  );
}

function Yapilacak({ ikon, baslik, sayi, alt, to }: { ikon: React.ReactNode; baslik: string; sayi: number; alt?: string; to: string }) {
  return (
    <Link to={to} className="flex items-center gap-3 rounded-md border p-3 transition hover:border-primary/40">
      <span className={cn("grid size-9 shrink-0 place-items-center rounded-md [&_svg]:size-4", sayi ? "bg-accent text-accent-foreground" : "bg-muted text-muted-foreground")}>{ikon}</span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-medium">{baslik}</span>
        {alt && <span className="block truncate text-xs text-muted-foreground">{alt}</span>}
      </span>
      <span className={cn("text-lg font-semibold tabular-nums", !sayi && "text-muted-foreground")}>{sayi}</span>
    </Link>
  );
}

/* ---------- Öğretmen paneli ---------- */
function OgretmenPaneli() {
  const d = useDb();
  const { moduller } = useApp();
  const { personel } = useOturum();
  const bugun = oturumlar(d, BUGUN).filter((o) => o.satir.ogretmenId === personel.id);
  const alinmayan: ReturnType<typeof oturumlar> = [];
  for (let i = 0; i <= 7; i++) {
    const t = tarihEkle(BUGUN, -i);
    alinmayan.push(...oturumlar(d, t).filter((o) => o.satir.ogretmenId === personel.id && !o.iptal && !o.tatil && !d.yoklamalar[o.id] && (t < BUGUN || yoklamaGecikti(o.bas, SIMDI, d.ayarlar.yoklamaHatirlatmaDk))));
  }
  const odevler = d.odevler.filter((o) => o.ogretmenId === personel.id && o.teslim <= BUGUN && !o.kontrolEdildi);
  const etutler = d.randevular.filter((r) => r.ogretmenId === personel.id && r.tarih >= BUGUN && r.durum === "planli").sort((a, b) => a.tarih.localeCompare(b.tarih));
  return (
    <div className="grid gap-6">
      <PageHeader code="12" title={`Merhaba ${personel.ad}`} description="Bugünkü dersleriniz, alınmamış yoklamalar ve ödev kontrolleri." />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Bugünkü ders" value={bugun.length} icon={<CalendarCheck2 />} />
        <StatCard label="Alınmamış yoklama" value={alinmayan.length} icon={<ClipboardCheck />} tone={alinmayan.length ? "danger" : "default"} />
        {moduller.odev && <StatCard label="Kontrol bekleyen ödev" value={odevler.length} icon={<BookOpenCheck />} tone={odevler.length ? "warning" : "default"} />}
        {moduller.etut && <StatCard label="Yaklaşan etüt" value={etutler.length} icon={<Clock />} />}
      </div>
      <Card>
        <CardHeader><CardTitle className="text-base">Bugünkü derslerim</CardTitle></CardHeader>
        <CardContent className="grid gap-2">
          {bugun.length === 0 && <p className="text-sm text-muted-foreground">Bugün dersiniz yok.</p>}
          {bugun.map((o) => (
            <Link key={o.id} to="/yoklama" className="flex items-center justify-between rounded-md border p-3 text-sm hover:border-primary/40">
              <span><b className="tabular-nums">{o.bas}</b> · {grupEtiket(d, o.satir.grupId)} · {dersAdi(o.satir.dersId)} <span className="text-muted-foreground">({sube(o.subeId)?.ad})</span></span>
              {d.yoklamalar[o.id] ? <Badge variant="success">Yoklama alındı</Badge> : <Badge variant="warning">Yoklama al</Badge>}
            </Link>
          ))}
        </CardContent>
      </Card>
      {alinmayan.length > 0 && (
        <Card>
          <CardHeader><CardTitle className="text-base">Alınmamış yoklamalar</CardTitle></CardHeader>
          <CardContent className="grid gap-1 text-sm">
            {alinmayan.map((o) => <p key={o.id}>{new Date(o.tarih + "T00:00:00").toLocaleDateString("tr-TR", { day: "numeric", month: "short" })} {o.bas} · {grupEtiket(d, o.satir.grupId)}</p>)}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

/* ---------- Raporlar ---------- */
type Rapor = { key: string; ad: string; bolum: string; kosul?: (m: Record<string, boolean>) => boolean; uret: (d: Db, subeGorunur: (s: string) => boolean) => { basliklar: string[]; satirlar: (string | number)[][]; subeSutun: number } };

const raporlar: Rapor[] = [
  {
    key: "ogrenci", ad: "Öğrenci listesi", bolum: "04",
    uret: (d, sg) => ({
      basliklar: ["Öğrenci", "Şube", "Grup", "Seviye", "Okul", "Birincil veli", "Telefon", "Durum", "Sözleşme no"],
      subeSutun: 1,
      satirlar: d.kayitlar.filter((k) => k.sezonId === AKTIF_SEZON && sg(k.subeId)).map((k) => {
        const o = d.ogrenciler.find((x) => x.id === k.ogrenciId)!;
        const v = d.veliler.find((x) => x.id === o.birincilVeliId);
        return [tamAd(o), sube(k.subeId)?.ad ?? "", grupEtiket(d, k.grupId), d.gruplar.find((g) => g.id === k.grupId)?.seviye ?? "", o.okul, tamAd(v), v?.telefon ?? "", k.durum, k.sozlesmeNo];
      }),
    }),
  },
  {
    key: "doluluk", ad: "Grup doluluk raporu", bolum: "01",
    uret: (d, sg) => ({
      basliklar: ["Grup", "Şube", "Seviye", "Kapasite", "Kayıtlı", "Doluluk %", "Rehber"],
      subeSutun: 1,
      satirlar: d.gruplar.filter((g) => g.sezonId === AKTIF_SEZON && sg(g.subeId)).map((g) => {
        const n = grupDoluluk(d, g.id);
        return [grupEtiket(d, g.id), sube(g.subeId)?.ad ?? "", g.seviye, g.kapasite, n, Math.round((n / g.kapasite) * 100), personelAdi(d, g.rehberId)];
      }),
    }),
  },
  {
    key: "devamsizlik", ad: "Devamsızlık raporu (sezon)", bolum: "07",
    uret: (d, sg) => ({
      basliklar: ["Öğrenci", "Şube", "Grup", "Ders", "Gelmedi", "İzinli", "Geç", "Devamsızlık %"],
      subeSutun: 1,
      satirlar: d.kayitlar.filter((k) => k.durum === "aktif" && sg(k.subeId)).map((k) => {
        const o = d.ogrenciler.find((x) => x.id === k.ogrenciId)!;
        const z = devamsizlikOzeti(ogrenciYoklamalari(d, o.id).map((x) => x.durum));
        return [tamAd(o), sube(k.subeId)?.ad ?? "", grupEtiket(d, k.grupId), z.toplam, z.gelmedi, z.izinli, z.gec, Math.round(z.oran * 1000) / 10];
      }),
    }),
  },
  {
    key: "dersKayit", ad: "Öğretmen ders kayıtları", bolum: "06–07",
    uret: (d, sg) => ({
      basliklar: ["Tarih", "Şube", "Grup", "Ders", "Öğretmen", "Konu", "Katılım"],
      subeSutun: 1,
      satirlar: Object.values(d.yoklamalar).map((y) => ({ y, s: d.gruplar.find((g) => g.id === y.grupId)?.subeId ?? "" })).filter(({ s }) => sg(s)).sort((a, b) => b.y.tarih.localeCompare(a.y.tarih)).map(({ y, s }) => {
        const v = Object.values(y.durumlar);
        return [y.tarih, sube(s)?.ad ?? "", grupEtiket(d, y.grupId), dersAdi(d.program.find((p) => p.id === y.satirId)?.dersId ?? ""), personelAdi(d, y.ogretmenId), y.konu, `${v.filter((x) => x !== "gelmedi").length}/${v.length}`];
      }),
    }),
  },
  {
    key: "onKayit", ad: "Ön kayıt dönüşüm raporu", bolum: "03", kosul: (m) => m.onKayit,
    uret: (d, sg) => {
      const kaynaklar = [...new Set(d.adaylar.map((a) => a.kaynak))];
      const satirlar: (string | number)[][] = [];
      for (const s of [...new Set(d.adaylar.filter((a) => sg(a.subeId)).map((a) => a.subeId))])
        for (const k of kaynaklar) {
          const l = d.adaylar.filter((a) => a.subeId === s && a.kaynak === k);
          if (!l.length) continue;
          const kayit = l.filter((a) => a.durum === "kayit").length;
          satirlar.push([k, sube(s)?.ad ?? "", l.length, kayit, l.filter((a) => a.durum === "vazgecti").length, Math.round((kayit / l.length) * 100)]);
        }
      return { basliklar: ["Kaynak", "Şube", "Aday", "Kayıt", "Vazgeçen", "Dönüşüm %"], subeSutun: 1, satirlar };
    },
  },
  {
    key: "odev", ad: "Ödev teslim oranları", bolum: "08", kosul: (m) => m.odev,
    uret: (d, sg) => ({
      basliklar: ["Ödev", "Şube", "Grup", "Öğretmen", "Teslim", "Yaptı", "Eksik", "Yapmadı"],
      subeSutun: 1,
      satirlar: d.odevler.filter((o) => sg(d.gruplar.find((g) => g.id === o.grupId)?.subeId ?? "")).map((o) => {
        const t = Object.values(o.teslimler);
        return [o.baslik, sube(d.gruplar.find((g) => g.id === o.grupId)?.subeId)?.ad ?? "", grupEtiket(d, o.grupId), personelAdi(d, o.ogretmenId), o.teslim, t.filter((x) => x === "yapti").length, t.filter((x) => x === "eksik").length, t.filter((x) => x === "yapmadi").length];
      }),
    }),
  },
  {
    key: "mesaj", ad: "Gönderilen mesajlar ve maliyet", bolum: "10",
    uret: (d, sg) => ({
      basliklar: ["Zaman", "Şube", "Olay", "Kanal", "Alıcı", "Durum", "Maliyet (₺)"],
      subeSutun: 1,
      satirlar: d.gonderimler.filter((g) => sg(g.subeId)).sort((a, b) => b.zaman.localeCompare(a.zaman)).map((g) => [g.zaman.replace("T", " "), sube(g.subeId)?.ad ?? "", d.olaylar.find((o) => o.key === g.olay)?.ad ?? g.olay, g.kanal === "sms" ? "SMS" : "Uygulama", g.alici, g.durum, Math.round(g.maliyet * 100) / 100]),
    }),
  },
  {
    key: "borc", ad: "Ödeme planları ve borç durumu", bolum: "05", kosul: (m) => m.finans,
    uret: (d, sg) => ({
      basliklar: ["Öğrenci", "Şube", "Taksit", "Vade", "Tutar", "Ödenen", "Kalan"],
      subeSutun: 1,
      satirlar: d.taksitler.filter((t) => sg(t.subeId)).map((t) => [tamAd(d.ogrenciler.find((o) => o.id === t.ogrenciId)), sube(t.subeId)?.ad ?? "", taksitAdi(t.no), t.vade, t.tutar, t.odenen, taksitKalan(t)]),
    }),
  },
  {
    key: "geciken", ad: "Vadesi geçenler", bolum: "05", kosul: (m) => m.finans,
    uret: (d, sg) => ({
      basliklar: ["Veli", "Telefon", "Öğrenci", "Şube", "Vade", "Gecikme (gün)", "Kalan"],
      subeSutun: 3,
      satirlar: d.taksitler.filter((t) => sg(t.subeId) && t.vade < BUGUN && taksitKalan(t) > 0).map((t) => {
        const v = d.veliler.find((x) => x.id === t.veliId);
        return [tamAd(v), v?.telefon ?? "", tamAd(d.ogrenciler.find((o) => o.id === t.ogrenciId)), sube(t.subeId)?.ad ?? "", t.vade, gecikmeGunu(t.vade, BUGUN), taksitKalan(t)];
      }),
    }),
  },
  {
    key: "kasa", ad: "Kasa / gelir-gider", bolum: "05", kosul: (m) => m.finans,
    uret: (d, sg) => ({
      basliklar: ["Tarih", "Şube", "Tür", "Açıklama", "Giriş", "Çıkış"],
      subeSutun: 1,
      satirlar: [
        ...d.tahsilatlar.filter((t) => !t.iptal && sg(t.subeId)).map((t) => [t.zaman.slice(0, 10), sube(t.subeId)?.ad ?? "", "Tahsilat", t.makbuzNo, t.tutar, 0]),
        ...d.giderler.filter((g) => g.subeId === "merkez" || sg(g.subeId)).map((g) => [g.tarih, g.subeId === "merkez" ? "Genel Merkez" : sube(g.subeId)?.ad ?? "", g.kategori, g.aciklama, 0, g.tutar]),
      ].sort((a, b) => String(b[0]).localeCompare(String(a[0]))),
    }),
  },
];

function Raporlar() {
  const d = useDb();
  const { moduller } = useApp();
  const { subeGorunur, rol } = useOturum();
  const finansYetkisi = rol === "genel-yonetici" || rol === "sube-muduru";
  const liste = raporlar.filter((r) => (!r.kosul || r.kosul(moduller)) && (r.bolum !== "05" || finansYetkisi));
  const [secili, setSecili] = React.useState(liste[0].key);
  const [grupla, setGrupla] = React.useState(false);
  const rapor = liste.find((r) => r.key === secili) ?? liste[0];
  const sonuc = React.useMemo(() => {
    const s = rapor.uret(d, subeGorunur);
    if (grupla) s.satirlar = [...s.satirlar].sort((a, b) => String(a[s.subeSutun]).localeCompare(String(b[s.subeSutun]), "tr"));
    return s;
  }, [rapor, d, subeGorunur, grupla]);

  const csv = () => dosyaIndir(`${rapor.key}-${BUGUN}.csv`, csvOlustur([sonuc.basliklar, ...sonuc.satirlar]));
  const pdf = () =>
    yazdir(
      rapor.ad,
      `<h1>${esc(rapor.ad)}</h1><p class="kucuk">${BUGUN} · ${sonuc.satirlar.length} satır</p>
       <table><tr>${sonuc.basliklar.map((b) => `<th>${esc(b)}</th>`).join("")}</tr>
       ${sonuc.satirlar.map((r) => `<tr>${r.map((c) => `<td>${esc(c)}</td>`).join("")}</tr>`).join("")}</table>`,
    );

  return (
    <div className="grid gap-4 lg:grid-cols-[16rem_1fr]">
      <Card className="self-start">
        <CardContent className="grid gap-1 p-2">
          {liste.map((r) => (
            <button key={r.key} onClick={() => setSecili(r.key)} className={cn("flex items-center justify-between rounded-md px-3 py-2 text-left text-sm", r.key === rapor.key ? "bg-accent font-medium text-accent-foreground" : "hover:bg-muted")}>
              {r.ad}
              <span className="font-mono text-[10px] text-muted-foreground">{r.bolum}</span>
            </button>
          ))}
        </CardContent>
      </Card>
      <Card className="min-w-0">
        <CardHeader className="flex-row flex-wrap items-center justify-between gap-3">
          <div>
            <CardTitle className="text-base">{rapor.ad}</CardTitle>
            <CardDescription className="mt-1">{sonuc.satirlar.length} satır · şube seçicisine göre filtrelenir</CardDescription>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Checkbox checked={grupla} onChange={setGrupla} label="Şubeye göre grupla" />
            <Button variant="outline" size="sm" onClick={csv}><Download /> Excel (CSV)</Button>
            <Button variant="outline" size="sm" onClick={pdf}><Printer /> PDF</Button>
          </div>
        </CardHeader>
        <Table>
          <thead><tr>{sonuc.basliklar.map((b) => <Th key={b}>{b}</Th>)}</tr></thead>
          <tbody>
            {sonuc.satirlar.slice(0, 25).map((r, i) => (
              <tr key={i}>{r.map((c, j) => <Td key={j} className={cn(typeof c === "number" && "text-right tabular-nums")}>{c}</Td>)}</tr>
            ))}
          </tbody>
        </Table>
        {sonuc.satirlar.length > 25 && <p className="p-3 text-center text-xs text-muted-foreground">Önizlemede ilk 25 satır; indirilen dosyada tümü var.</p>}
        {sonuc.satirlar.length === 0 && <p className="p-6 text-center text-sm text-muted-foreground">Kayıt yok.</p>}
      </Card>
    </div>
  );
}

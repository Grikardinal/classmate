/** Bölüm 12 · Yönetim paneli: kartlar, bugün yapılacaklar, grafikler, son işlemler, şube karşılaştırma. */
import * as React from "react";
import { Link, useNavigate } from "react-router-dom";
import { AlarmClock, BookOpenCheck, CalendarCheck2, ClipboardCheck, ClipboardX, Clock, GraduationCap, PhoneCall, TrendingUp, UserPlus, Users, Wallet } from "lucide-react";
import { Badge, Card, CardContent, CardDescription, CardHeader, CardTitle, StatCard, Table, Td, Th } from "@/components/ui";
import { BarChart } from "@/components/ui/chart";
import { useApp, useOturum } from "@/context/AppContext";
import { AKTIF_SEZON, BUGUN, SIMDI, grupEtiket, oturumlar, personelAdi, sube, useDb } from "@/data/store";
import { haftaBasi, tarihEkle, tl } from "@/lib/kurallar";
import { cn } from "@/lib/utils";
import { aylikYeniKayit, finansOzeti, finansPanelGorur, haftaOzeti, kayitOzeti, kontrolBekleyenOdevler, oranYuzde, seviyeDagilimi, sonAylar, sonIslemler, subeKarsilastirma } from "./kurallar";

const ayEtiketi = (a: string, s: Intl.DateTimeFormatOptions) => new Date(a + "-01T00:00:00").toLocaleDateString("tr-TR", s);

export function Panel() {
  const d = useDb();
  const { moduller } = useApp();
  const { subeGorunur, grupGorunur, seciliSubeler, kapsam, rol, yetki } = useOturum();
  const navigate = useNavigate();

  const finansGorur = finansPanelGorur(rol, moduller.finans, yetki("05"));
  const onKayitGorur = moduller.onKayit && yetki("03");
  const etutGorur = moduller.etut && yetki("09");
  const odevGorur = moduller.odev && yetki("08");
  const yoklamaGorur = yetki("07");
  const git = (yol: string, kod: string) => (yetki(kod) ? () => navigate(yol) : undefined);

  const subeAnahtari = seciliSubeler.join(",");
  const tumKapsam = seciliSubeler.length === kapsam.length;
  const h = React.useMemo(() => {
    const k = kayitOzeti(d, { sezonId: AKTIF_SEZON, sg: subeGorunur, bugun: BUGUN });
    const hOturum = [];
    for (let t = haftaBasi(BUGUN); t <= BUGUN; t = tarihEkle(t, 1)) hOturum.push(...oturumlar(d, t).filter((o) => grupGorunur(o.satir.grupId) && !o.iptal && !o.tatil));
    const adaylar = d.adaylar.filter((a) => subeGorunur(a.subeId) && a.durum !== "kayit" && a.durum !== "vazgecti");
    const aylar = sonAylar(BUGUN);
    const yeni = aylikYeniKayit(k.kayitlar, aylar);
    return {
      k,
      hafta: haftaOzeti(hOturum, d.yoklamalar, BUGUN, SIMDI, d.ayarlar.yoklamaHatirlatmaDk),
      adaylar,
      aranacak: adaylar.filter((a) => a.sonrakiAksiyon && a.sonrakiAksiyon <= BUGUN),
      etutler: d.randevular.filter((r) => r.tarih === BUGUN && r.durum === "planli" && subeGorunur(r.subeId)),
      odevSayisi: kontrolBekleyenOdevler(d.odevler, d.gruplar, { sezonId: AKTIF_SEZON, gorunur: grupGorunur, bugun: BUGUN }),
      finans: finansOzeti(d.taksitler.filter((t) => subeGorunur(t.subeId)), BUGUN),
      aylikKayit: aylar.map((a, i) => ({ etiket: ayEtiketi(a, { month: "short" }), deger: yeni[i], ipucu: `${ayEtiketi(a, { month: "long", year: "numeric" })} yeni kayıt` })),
      seviyeler: seviyeDagilimi(k.aktif, k.gruplar).map((s) => ({ etiket: `${s.seviye}. sınıf`, deger: s.adet, ipucu: `${s.seviye}. sınıf öğrenci` })),
      islemler: sonIslemler(d.islemler, { sg: subeGorunur, tumKapsam, finans: finansGorur }),
      subeler: seciliSubeler.length > 1 ? subeKarsilastirma(seciliSubeler, { aktif: k.aktif, gruplar: k.gruplar, yoklamalar: d.yoklamalar, taksitler: d.taksitler, adaylar }, BUGUN) : [],
    };
    // subeGorunur / grupGorunur her render'da yeni; seçili şubeler anahtarıyla izlenir
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [d, subeAnahtari, tumKapsam, finansGorur, BUGUN, SIMDI, AKTIF_SEZON]);

  const { k, hafta, adaylar, aranacak, etutler, finans } = h;
  const sezonAdi = d.sezonlar.find((s) => s.id === AKTIF_SEZON)?.ad;
  const islenenKart = <StatCard label="Bu hafta işlenen ders" value={`${hafta.islenen}/${hafta.planlanan}`} icon={<CalendarCheck2 />} hint="Yoklaması alınan / planlanan" />;

  return (
    <div className="grid gap-6">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard
          label="Aktif öğrenci"
          value={k.aktif.length}
          icon={<GraduationCap />}
          hint={<span className={cn("inline-flex items-center gap-1", k.buAyYeni > 0 && "text-success")}>{k.buAyYeni > 0 && <TrendingUp className="size-3" />}+{k.buAyYeni} bu ay</span>}
          onClick={git("/ogrenciler", "04")}
        />
        <StatCard label="Devamsızlık (bu hafta)" value={`%${oranYuzde(hafta.devam.oran)}`} icon={<ClipboardX />} tone={hafta.devam.oran > 0.1 ? "danger" : "default"} hint={`${hafta.devam.gelmedi} gelmedi · ${hafta.devam.izinli} izinli`} onClick={git("/yoklama", "07")} />
        <StatCard label="Doluluk" value={`%${k.doluluk}`} icon={<Users />} hint={`${k.aktif.length} / ${k.kapasite} kontenjan`} />
        {finansGorur && <StatCard label="Bu ay tahsilat" value={`%${finans.oran}`} icon={<Wallet />} tone="success" hint={`${tl(finans.tahsil)} / ${tl(finans.beklenen)}`} onClick={() => navigate("/finans")} />}
        {finansGorur && <StatCard label="Vadesi geçen" value={tl(finans.gecikenTutar)} icon={<AlarmClock />} tone="danger" hint={`${finans.gecikenVeli} veli`} onClick={() => navigate("/finans")} />}
        {islenenKart}
        <StatCard label="Yoklaması alınmayan ders" value={hafta.alinmayan.length} icon={<ClipboardCheck />} tone={hafta.alinmayan.length ? "warning" : "default"} hint="Bu hafta" onClick={git("/yoklama", "07")} />
        {onKayitGorur && <StatCard label="Bekleyen ön kayıt" value={adaylar.length} icon={<UserPlus />} hint={`${aranacak.length} kişi bugün aranacak`} onClick={() => navigate("/on-kayit")} />}
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_1.2fr]">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Bugün yapılacaklar</CardTitle>
            <CardDescription>{new Date(BUGUN + "T00:00:00").toLocaleDateString("tr-TR", { weekday: "long", day: "numeric", month: "long" })}</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-2">
            {onKayitGorur && <Yapilacak ikon={<PhoneCall />} baslik="Aranacak adaylar" sayi={aranacak.length} alt={aranacak.slice(0, 3).map((a) => a.veliAd).join(", ")} to="/on-kayit" />}
            {finansGorur && <Yapilacak ikon={<AlarmClock />} baslik="Vadesi gelen / geciken ödemeler" sayi={finans.takipVeli} alt={`${finans.bugunVeli} veli bugün · ${finans.gecikenVeli} veli geciken`} to="/finans" />}
            {yoklamaGorur && <Yapilacak ikon={<ClipboardCheck />} baslik="Yoklaması alınmamış dersler" sayi={hafta.alinmayan.length} alt={hafta.alinmayan.slice(0, 3).map((o) => `${grupEtiket(d, o.satir.grupId)} ${o.bas}`).join(", ")} to="/yoklama" />}
            {etutGorur && <Yapilacak ikon={<Clock />} baslik="Bugünkü etüt randevuları" sayi={etutler.length} alt={etutler.map((r) => `${r.bas} ${personelAdi(d, r.ogretmenId)}`).join(", ")} to="/etut" />}
            {odevGorur && <Yapilacak ikon={<BookOpenCheck />} baslik="Kontrol bekleyen ödevler" sayi={h.odevSayisi} to="/odevler" />}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Aylık yeni kayıt</CardTitle>
            <CardDescription>Son 6 ay{sezonAdi ? ` · ${sezonAdi} sezonu` : ""}</CardDescription>
          </CardHeader>
          <CardContent><BarChart veri={h.aylikKayit} /></CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Seviyeye göre öğrenci</CardTitle>
            <CardDescription>Aktif kayıtlar, 3–8. sınıf</CardDescription>
          </CardHeader>
          <CardContent><BarChart veri={h.seviyeler} yukseklik={160} /></CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Son işlemler</CardTitle>
          </CardHeader>
          {h.islemler.length === 0 && <p className="px-5 pb-5 text-sm text-muted-foreground">Henüz işlem yok.</p>}
          <ul className="divide-y">
            {h.islemler.map((i) => (
              <li key={i.id} className="flex items-start gap-3 px-5 py-2.5 text-sm">
                <Badge variant="outline" className="mt-0.5 shrink-0">{i.islem}</Badge>
                <span className="min-w-0 flex-1 truncate" title={i.detay}>{i.detay}</span>
                <span className="shrink-0 text-xs text-muted-foreground">{new Date(i.zaman).toLocaleString("tr-TR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</span>
              </li>
            ))}
          </ul>
        </Card>
      </div>

      {h.subeler.length > 1 && (
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
                {onKayitGorur && <Th className="text-right">Açık aday</Th>}
              </tr>
            </thead>
            <tbody>
              {h.subeler.map((s) => (
                <tr key={s.subeId}>
                  <Td className="font-medium">{sube(s.subeId)?.ad}</Td>
                  <Td className="text-right tabular-nums">{s.ogrenci}</Td>
                  <Td className="text-right tabular-nums">%{s.doluluk}</Td>
                  <Td className="text-right tabular-nums">%{s.devamsizlik}</Td>
                  {finansGorur && <Td className="text-right tabular-nums">%{s.tahsilat}</Td>}
                  {onKayitGorur && <Td className="text-right tabular-nums">{s.acikAday}</Td>}
                </tr>
              ))}
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

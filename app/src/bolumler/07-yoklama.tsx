/**
 * Bölüm 07 · Yoklama ve devamsızlık
 * Doküman: docs/bolumler/07-yoklama.md
 */
import * as React from "react";
import {
  AlertTriangle,
  ArrowLeft,
  BellRing,
  CheckCircle2,
  ClipboardCheck,
  Clock,
  Download,
  FileBarChart,
  HeartPulse,
  NotebookPen,
  ChevronLeft,
  ChevronRight,
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
  EmptyState,
  Field,
  Input,
  PageHeader,
  Select,
  StatCard,
  Table,
  Tabs,
  Td,
  Th,
  toast,
} from "@/components/ui";
import { useOturum } from "@/context/AppContext";
import {
  BUGUN,
  SIMDI,
  bildirimEkle,
  ders,
  dersAdi,
  derslikAdi,
  grupEtiket,
  grupOgrencileri,
  guncelle,
  islemYaz,
  konular,
  oturumlar,
  ogrenciYoklamalari,
  personelAdi,
  sube,
  tamAd,
  useDb,
  type Db,
  type Oturum,
} from "@/data/store";
import { csvOlustur, devamsizlikOzeti, haftaBasi, sonrakiDurum, tarihEkle, yoklamaGecikti, type YoklamaDurumu } from "@/lib/kurallar";
import { dosyaIndir } from "@/lib/yazdir";
import { cn } from "@/lib/utils";

const durumlar: { key: YoklamaDurumu; ad: string; kisa: string; sinif: string }[] = [
  { key: "geldi", ad: "Geldi", kisa: "✓", sinif: "bg-success text-white" },
  { key: "gelmedi", ad: "Gelmedi", kisa: "Yok", sinif: "bg-danger text-white" },
  { key: "gec", ad: "Geç", kisa: "Geç", sinif: "bg-warning text-white" },
  { key: "izinli", ad: "İzinli", kisa: "İzin", sinif: "bg-muted-foreground text-white" },
];
const tarihUzun = (iso: string) => new Date(iso + "T00:00:00").toLocaleDateString("tr-TR", { weekday: "long", day: "numeric", month: "long" });

type OturumDurumu = "alindi" | "gecikti" | "devam" | "planli" | "iptal";
function oturumDurumu(d: Db, o: Oturum): OturumDurumu {
  if (o.iptal || o.tatil) return "iptal";
  if (d.yoklamalar[o.id]) return "alindi";
  if (o.tarih < BUGUN) return "gecikti";
  if (o.tarih > BUGUN) return "planli";
  if (yoklamaGecikti(o.bas, SIMDI, d.ayarlar.yoklamaHatirlatmaDk)) return "gecikti";
  return SIMDI >= o.bas ? "devam" : "planli";
}

export default function Yoklama() {
  const [sekme, setSekme] = React.useState<"bugun" | "rapor" | "kayitlar">("bugun");
  const [acikOturum, setAcikOturum] = React.useState<{ id: string; tarih: string } | null>(null);
  if (acikOturum) return <YoklamaEkrani {...acikOturum} onKapat={() => setAcikOturum(null)} />;
  return (
    <div className="grid gap-6">
      <PageHeader code="07" title="Yoklama" description="Öğretmen 30 saniyede yoklama alır; gelmeyen öğrencinin velisi anında haberdar olur." />
      <Tabs
        value={sekme}
        onChange={setSekme}
        items={[
          { value: "bugun", label: "Dersler", icon: <ClipboardCheck /> },
          { value: "rapor", label: "Devamsızlık raporu", icon: <FileBarChart /> },
          { value: "kayitlar", label: "Öğretmen ders kayıtları", icon: <NotebookPen /> },
        ]}
      />
      {sekme === "bugun" && <GunlukDersler onAc={(id, tarih) => setAcikOturum({ id, tarih })} />}
      {sekme === "rapor" && <DevamsizlikRaporu />}
      {sekme === "kayitlar" && <DersKayitlari />}
    </div>
  );
}

/* ---------- Günün dersleri ---------- */
function GunlukDersler({ onAc }: { onAc: (id: string, tarih: string) => void }) {
  const d = useDb();
  const { grupGorunur, ogretmenMi, personel, ad } = useOturum();
  const [tarih, setTarih] = React.useState(BUGUN);
  const liste = oturumlar(d, tarih).filter((o) => grupGorunur(o.satir.grupId) && (!ogretmenMi || o.satir.ogretmenId === personel.id));
  const sayac = (s: OturumDurumu) => liste.filter((o) => oturumDurumu(d, o) === s).length;
  const gecikenler = liste.filter((o) => oturumDurumu(d, o) === "gecikti");

  // Geçmiş günlerde alınmamış yoklamalar (son 7 gün)
  const eskiEksik = React.useMemo(() => {
    const l: Oturum[] = [];
    for (let i = 1; i <= 7; i++) {
      const t = tarihEkle(BUGUN, -i);
      l.push(...oturumlar(d, t).filter((o) => grupGorunur(o.satir.grupId) && (!ogretmenMi || o.satir.ogretmenId === personel.id) && oturumDurumu(d, o) === "gecikti"));
    }
    return l;
  }, [d, grupGorunur, ogretmenMi, personel.id]);

  const hatirlat = () => {
    const ogretmenler = [...new Set(gecikenler.map((o) => o.satir.ogretmenId))];
    guncelle((x) => islemYaz(x, ad, "Yoklama hatırlatma", `${ogretmenler.map((p) => personelAdi(x, p)).join(", ")} için hatırlatma gönderildi`));
    toast(`${ogretmenler.length} öğretmene yoklama hatırlatması gönderildi.`);
  };

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="ghost" size="icon" aria-label="Önceki gün" onClick={() => setTarih(tarihEkle(tarih, -1))}><ChevronLeft /></Button>
        <Input type="date" className="w-44" value={tarih} onChange={(e) => setTarih(e.target.value || BUGUN)} />
        <Button variant="ghost" size="icon" aria-label="Sonraki gün" onClick={() => setTarih(tarihEkle(tarih, 1))}><ChevronRight /></Button>
        <span className="text-sm font-medium capitalize">{tarihUzun(tarih)}</span>
        {tarih !== BUGUN && <Button variant="ghost" size="sm" onClick={() => setTarih(BUGUN)}>Bugün</Button>}
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Toplam ders" value={liste.length} icon={<ClipboardCheck />} />
        <StatCard label="Yoklama alındı" value={sayac("alindi")} icon={<CheckCircle2 />} tone="success" />
        <StatCard label="Alınmadı (gecikti)" value={sayac("gecikti")} icon={<AlertTriangle />} tone={sayac("gecikti") ? "danger" : "default"} hint={`Dersin başlamasından ${d.ayarlar.yoklamaHatirlatmaDk} dk sonra`} />
        <StatCard label="Devam eden / planlı" value={sayac("devam") + sayac("planli")} icon={<Clock />} />
      </div>

      {gecikenler.length > 0 && !ogretmenMi && (
        <Alert tone="danger" icon={<AlertTriangle />}>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span>{gecikenler.length} dersin yoklaması alınmadı: {gecikenler.map((o) => `${grupEtiket(d, o.satir.grupId)} ${o.bas}`).join(", ")}</span>
            <Button size="sm" variant="outline" onClick={hatirlat}><BellRing /> Öğretmenlere hatırlat</Button>
          </div>
        </Alert>
      )}
      {tarih === BUGUN && eskiEksik.length > 0 && (
        <Alert tone="warning" icon={<AlertTriangle />}>
          Son 7 günde {eskiEksik.length} dersin yoklaması eksik:{" "}
          {eskiEksik.slice(0, 5).map((o, i) => (
            <React.Fragment key={o.id}>
              {i > 0 && ", "}
              <button className="underline" onClick={() => onAc(o.id, o.tarih)}>{grupEtiket(d, o.satir.grupId)} ({new Date(o.tarih + "T00:00:00").toLocaleDateString("tr-TR", { day: "numeric", month: "short" })})</button>
            </React.Fragment>
          ))}
        </Alert>
      )}

      {liste.length === 0 ? (
        <EmptyState icon={<ClipboardCheck />} title="Bu gün ders yok" text="Ders programında bu güne ait ders bulunmuyor." />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {liste.map((o) => {
            const s = oturumDurumu(d, o);
            const y = d.yoklamalar[o.id];
            const ds = ders(o.satir.dersId)!;
            const ogrSayi = grupOgrencileri(d, o.satir.grupId).length;
            const gelmeyen = y ? Object.values(y.durumlar).filter((x) => x === "gelmedi").length : 0;
            return (
              <button
                key={o.id}
                onClick={() => s !== "iptal" && s !== "planli" && onAc(o.id, o.tarih)}
                disabled={s === "iptal" || (s === "planli" && o.tarih > BUGUN)}
                className={cn(
                  "rounded-lg border bg-card p-4 text-left shadow-xs transition hover:border-primary/40 disabled:cursor-default disabled:hover:border-border",
                  s === "gecikti" && "border-danger/40",
                )}
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-xs tabular-nums text-muted-foreground">{o.bas}–{o.bit} · {sube(o.subeId)?.kod} · {derslikAdi(o.satir.derslikId)}</p>
                    <p className="mt-1 font-semibold">{grupEtiket(d, o.satir.grupId)}</p>
                    <p className="text-sm" style={{ color: ds.renk }}>{ds.ad}</p>
                  </div>
                  {s === "alindi" && <Badge variant="success">Alındı</Badge>}
                  {s === "gecikti" && <Badge variant="danger">Alınmadı</Badge>}
                  {s === "devam" && <Badge variant="warning">Derste</Badge>}
                  {s === "planli" && <Badge variant="secondary">Planlı</Badge>}
                  {s === "iptal" && <Badge variant="secondary">{o.tatil ? o.tatil.ad : "İptal"}</Badge>}
                </div>
                <div className="mt-3 flex items-center justify-between border-t pt-3 text-xs text-muted-foreground">
                  <span>{personelAdi(d, o.satir.ogretmenId)}</span>
                  <span>{y ? <><b className={gelmeyen ? "text-danger" : "text-success"}>{gelmeyen} yok</b> / {ogrSayi}</> : `${ogrSayi} öğrenci`}</span>
                </div>
                {y?.konu && <p className="mt-2 truncate text-xs">Konu: {y.konu}</p>}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ---------- Yoklama ekranı (telefonda hızlı) ---------- */
function YoklamaEkrani({ id, tarih, onKapat }: { id: string; tarih: string; onKapat: () => void }) {
  const d = useDb();
  const { ogretmenMi, ad } = useOturum();
  const o = oturumlar(d, tarih).find((x) => x.id === id);
  const mevcut = d.yoklamalar[id];
  const ogrenciler = o ? grupOgrencileri(d, o.satir.grupId) : [];
  const izinler = d.izinler.filter((i) => i.tarih === tarih);
  const [durum, setDurum] = React.useState<Record<string, YoklamaDurumu>>(() =>
    Object.fromEntries(ogrenciler.map((x) => [x.id, mevcut?.durumlar[x.id] ?? (izinler.some((i) => i.ogrenciId === x.id) ? "izinli" : "geldi")])),
  );
  const [konu, setKonu] = React.useState(mevcut?.konu ?? "");
  if (!o) return null;

  // Geçmişe dönük düzeltme: aynı gün öğretmen, sonrasında yalnızca yönetici
  const kilitli = (ogretmenMi && tarih !== BUGUN && !!mevcut) || tarih > BUGUN;
  const sayim = (k: YoklamaDurumu) => Object.values(durum).filter((x) => x === k).length;
  const oneriler = konular[o.satir.dersId] ?? [];

  const kaydet = () => {
    let bildirilen = 0;
    const uyarilanlar: string[] = [];
    guncelle((x) => {
      x.yoklamalar = { ...x.yoklamalar, [id]: { oturumId: id, tarih, satirId: o.satir.id, grupId: o.satir.grupId, ogretmenId: o.satir.ogretmenId, durumlar: durum, konu: konu.trim(), kayitZamani: `${BUGUN}T${SIMDI}` } };
      for (const [ogrId, s] of Object.entries(durum)) {
        // Yalnızca yeni "gelmedi" işaretlenenlere bildirim gider (düzeltmede tekrar gitmez)
        if (s === "gelmedi" && mevcut?.durumlar[ogrId] !== "gelmedi") {
          bildirilen += bildirimEkle(x, "devamsizlik", ogrId, { saat: o.bas, ders: dersAdi(o.satir.dersId) });
          const hafta = haftaBasi(tarih);
          const n = ogrenciYoklamalari(x, ogrId, hafta, tarihEkle(hafta, 6)).filter((y) => y.durum === "gelmedi").length;
          if (n >= x.ayarlar.devamsizlikEsigi) {
            const ogr = x.ogrenciler.find((z) => z.id === ogrId);
            uyarilanlar.push(tamAd(ogr));
            islemYaz(x, "Sistem", "Devamsızlık uyarısı", `${tamAd(ogr)} bu hafta ${n} derse katılmadı`, o.subeId);
          }
        }
      }
      if (mevcut) islemYaz(x, ad, "Yoklama düzeltme", `${grupEtiket(x, o.satir.grupId)} ${tarih} ${o.bas}`, o.subeId);
    });
    toast(bildirilen ? `Yoklama kaydedildi; ${bildirilen} veliye devamsızlık bildirimi gönderildi.` : "Yoklama kaydedildi.");
    if (uyarilanlar.length) toast(`Haftalık devamsızlık eşiği aşıldı: ${uyarilanlar.join(", ")} — yöneticiye uyarı düştü.`, "uyari");
    onKapat();
  };

  return (
    <div className="mx-auto grid w-full max-w-2xl gap-4">
      <button onClick={onKapat} className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" /> Dersler
      </button>
      <div>
        <p className="text-sm text-muted-foreground">{tarihUzun(tarih)} · {o.bas}–{o.bit} · {derslikAdi(o.satir.derslikId)}</p>
        <h1 className="text-2xl font-semibold tracking-tight">{grupEtiket(d, o.satir.grupId)} · {dersAdi(o.satir.dersId)}</h1>
        <p className="text-sm text-muted-foreground">{personelAdi(d, o.satir.ogretmenId)}</p>
      </div>

      {kilitli && <Alert tone="warning" icon={<AlertTriangle />}>{tarih > BUGUN ? "Gelecek tarihli dersin yoklaması alınamaz." : "Geçmiş günün yoklamasını yalnızca yönetici düzeltebilir."}</Alert>}

      <div className="flex flex-wrap gap-2 text-sm">
        {durumlar.map((s) => (
          <span key={s.key} className="rounded-full border px-3 py-1">{s.ad}: <b className="tabular-nums">{sayim(s.key)}</b></span>
        ))}
        {!kilitli && (
          <Button variant="ghost" size="sm" className="ml-auto" onClick={() => setDurum(Object.fromEntries(ogrenciler.map((x) => [x.id, "geldi" as YoklamaDurumu])))}>
            Hepsi geldi
          </Button>
        )}
      </div>

      <Card>
        <ul className="divide-y">
          {ogrenciler.map((x) => {
            const s = durum[x.id];
            const izin = izinler.find((i) => i.ogrenciId === x.id);
            return (
              <li key={x.id} className="grid gap-2 p-3 sm:flex sm:items-center sm:gap-3">
                <button
                  disabled={kilitli}
                  onClick={() => setDurum({ ...durum, [x.id]: sonrakiDurum(s) })}
                  className="flex min-w-0 flex-1 items-center gap-3 text-left"
                  aria-label={`${tamAd(x)}: ${durumlar.find((z) => z.key === s)?.ad}. Değiştirmek için dokunun.`}
                >
                  <Avatar ad={tamAd(x)} className={cn("size-10 ring-2 ring-offset-2 ring-offset-card", s === "geldi" ? "ring-success/60" : s === "gelmedi" ? "ring-danger" : s === "gec" ? "ring-warning" : "ring-muted-foreground/40")} />
                  <span className="min-w-0">
                    <span className="block truncate font-medium">{tamAd(x)} {x.saglikNotu && <HeartPulse className="inline size-3.5 text-danger" aria-label={x.saglikNotu} />}</span>
                    {izin && <span className="block truncate text-xs text-muted-foreground">Veli izni: {izin.not}</span>}
                  </span>
                </button>
                <div className="grid grid-cols-4 gap-1 sm:flex sm:shrink-0">
                  {durumlar.map((z) => (
                    <button
                      key={z.key}
                      disabled={kilitli}
                      onClick={() => setDurum({ ...durum, [x.id]: z.key })}
                      className={cn("h-10 min-w-11 rounded-md border px-2 text-xs font-medium transition sm:h-9",s === z.key ? z.sinif + " border-transparent" : "text-muted-foreground hover:bg-muted")}
                      aria-pressed={s === z.key}
                    >
                      {z.kisa}
                    </button>
                  ))}
                </div>
              </li>
            );
          })}
        </ul>
      </Card>

      <Card>
        <CardContent className="grid gap-2 p-4">
          <Field label="İşlenen konu (veliler görür)">
            <Input value={konu} disabled={kilitli} onChange={(e) => setKonu(e.target.value)} placeholder="Örn. Kesirlerde toplama" />
          </Field>
          {!kilitli && (
            <div className="flex flex-wrap gap-1.5">
              {oneriler.map((k) => (
                <button key={k} onClick={() => setKonu(k)} className="rounded-full border px-2.5 py-0.5 text-xs text-muted-foreground hover:border-primary hover:text-primary">{k}</button>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {!kilitli && (
        <div className="sticky bottom-4 flex justify-end gap-2">
          <Button variant="outline" onClick={onKapat}>Vazgeç</Button>
          <Button onClick={kaydet} className="shadow-lg">
            <CheckCircle2 /> Kaydet {sayim("gelmedi") > 0 && `· ${sayim("gelmedi")} gelmeyenin velisine bildir`}
          </Button>
        </div>
      )}
    </div>
  );
}

/* ---------- Devamsızlık raporu ---------- */
function DevamsizlikRaporu() {
  const d = useDb();
  const { grupGorunur } = useOturum();
  const [donem, setDonem] = React.useState<"hafta" | "ay" | "sezon">("ay");
  const [grupId, setGrupId] = React.useState("all");
  const bas = donem === "hafta" ? haftaBasi(BUGUN) : donem === "ay" ? BUGUN.slice(0, 8) + "01" : "2026-09-01";
  const gruplar = d.gruplar.filter((g) => grupGorunur(g.id));
  const satirlar = d.kayitlar
    .filter((k) => k.durum === "aktif" && grupGorunur(k.grupId) && (grupId === "all" || k.grupId === grupId))
    .map((k) => {
      const o = d.ogrenciler.find((x) => x.id === k.ogrenciId)!;
      const oz = devamsizlikOzeti(ogrenciYoklamalari(d, o.id, bas, BUGUN).map((x) => x.durum));
      const buHafta = ogrenciYoklamalari(d, o.id, haftaBasi(BUGUN), BUGUN).filter((x) => x.durum === "gelmedi").length;
      return { k, o, oz, buHafta };
    })
    .sort((a, b) => b.oz.oran - a.oz.oran || b.oz.gelmedi - a.oz.gelmedi);
  const esik = satirlar.filter((s) => s.buHafta >= d.ayarlar.devamsizlikEsigi);
  const toplam = devamsizlikOzeti(satirlar.flatMap((s) => ogrenciYoklamalari(d, s.o.id, bas, BUGUN).map((x) => x.durum)));

  const indir = () =>
    dosyaIndir(
      `devamsizlik-${donem}-${BUGUN}.csv`,
      csvOlustur([
        ["Öğrenci", "Şube", "Grup", "Ders sayısı", "Gelmedi", "İzinli", "Geç", "Devamsızlık %"],
        ...satirlar.map((s) => [tamAd(s.o), sube(s.k.subeId)?.ad ?? "", grupEtiket(d, s.k.grupId), s.oz.toplam, s.oz.gelmedi, s.oz.izinli, s.oz.gec, Math.round(s.oz.oran * 1000) / 10]),
      ]),
    );

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <Select aria-label="Dönem" className="w-40" value={donem} onChange={(e) => setDonem(e.target.value as typeof donem)}>
          <option value="hafta">Bu hafta</option>
          <option value="ay">Bu ay</option>
          <option value="sezon">Sezon başından</option>
        </Select>
        <Select aria-label="Grup" className="w-40" value={grupId} onChange={(e) => setGrupId(e.target.value)}>
          <option value="all">Tüm gruplar</option>
          {gruplar.map((g) => <option key={g.id} value={g.id}>{grupEtiket(d, g.id)}</option>)}
        </Select>
        <Button variant="outline" className="ml-auto" onClick={indir}><Download /> Excel (CSV)</Button>
      </div>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Devamsızlık oranı" value={`%${Math.round(toplam.oran * 1000) / 10}`} hint="İzinliler hariç" />
        <StatCard label="Gelmedi" value={toplam.gelmedi} tone="danger" />
        <StatCard label="İzinli" value={toplam.izinli} hint={`%${Math.round(toplam.izinliOran * 1000) / 10}`} />
        <StatCard label="Geç geldi" value={toplam.gec} tone="warning" />
      </div>
      {esik.length > 0 && (
        <Alert tone="danger" icon={<AlertTriangle />}>
          Bu hafta {d.ayarlar.devamsizlikEsigi}+ derse gelmeyenler: {esik.map((s) => `${tamAd(s.o)} (${s.buHafta})`).join(", ")}
        </Alert>
      )}
      <Card>
        <Table>
          <thead><tr><Th>Öğrenci</Th><Th>Grup</Th><Th className="text-right">Ders</Th><Th className="text-right">Gelmedi</Th><Th className="text-right">İzinli</Th><Th className="text-right">Geç</Th><Th className="w-40">Oran</Th></tr></thead>
          <tbody>
            {satirlar.map((s) => (
              <tr key={s.k.id}>
                <Td className="font-medium">{tamAd(s.o)}</Td>
                <Td>{grupEtiket(d, s.k.grupId)}</Td>
                <Td className="text-right tabular-nums">{s.oz.toplam}</Td>
                <Td className="text-right tabular-nums">{s.oz.gelmedi}</Td>
                <Td className="text-right tabular-nums">{s.oz.izinli}</Td>
                <Td className="text-right tabular-nums">{s.oz.gec}</Td>
                <Td>
                  <div className="flex items-center gap-2">
                    <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                      <div className={cn("h-full rounded-full", s.oz.oran >= 0.15 ? "bg-danger" : s.oz.oran >= 0.08 ? "bg-warning" : "bg-primary")} style={{ width: `${Math.min(s.oz.oran * 4, 1) * 100}%` }} />
                    </div>
                    <span className="w-10 text-right text-xs tabular-nums">%{Math.round(s.oz.oran * 100)}</span>
                  </div>
                </Td>
              </tr>
            ))}
          </tbody>
        </Table>
      </Card>
    </div>
  );
}

/* ---------- Öğretmen ders kayıtları ---------- */
function DersKayitlari() {
  const d = useDb();
  const { grupGorunur, ogretmenMi, personel } = useOturum();
  const [ogretmenId, setOgretmenId] = React.useState(ogretmenMi ? personel.id : "all");
  const [bas, setBas] = React.useState(tarihEkle(BUGUN, -13));
  const kayitlar = Object.values(d.yoklamalar)
    .filter((y) => y.tarih >= bas && grupGorunur(y.grupId) && (ogretmenId === "all" || y.ogretmenId === ogretmenId))
    .sort((a, b) => b.tarih.localeCompare(a.tarih) || b.kayitZamani.localeCompare(a.kayitZamani));
  const ogretmenler = d.personel.filter((p) => p.gorev === "ogretmen");
  const indir = () =>
    dosyaIndir(
      `ders-kayitlari-${BUGUN}.csv`,
      csvOlustur([
        ["Tarih", "Grup", "Ders", "Öğretmen", "Konu", "Katılım"],
        ...kayitlar.map((y) => {
          const p = d.program.find((x) => x.id === y.satirId);
          const v = Object.values(y.durumlar);
          return [y.tarih, grupEtiket(d, y.grupId), p ? dersAdi(p.dersId) : "", personelAdi(d, y.ogretmenId), y.konu, `${v.filter((x) => x !== "gelmedi").length}/${v.length}`];
        }),
      ]),
    );
  return (
    <Card>
      <CardHeader className="flex-row flex-wrap items-end justify-between gap-3">
        <div>
          <CardTitle className="text-base">Öğretmen ders kayıtları</CardTitle>
          <CardDescription className="mt-1">Hangi ders işlendi, hangi konu anlatıldı. Hak ediş hesabı bu kayıtlara dayanır (Bölüm 13).</CardDescription>
        </div>
        <div className="flex flex-wrap gap-2">
          <Select aria-label="Öğretmen" className="w-44" value={ogretmenId} disabled={ogretmenMi} onChange={(e) => setOgretmenId(e.target.value)}>
            <option value="all">Tüm öğretmenler</option>
            {ogretmenler.map((p) => <option key={p.id} value={p.id}>{p.ad} {p.soyad}</option>)}
          </Select>
          <Input type="date" aria-label="Başlangıç" className="w-40" value={bas} onChange={(e) => setBas(e.target.value)} />
          <Button variant="outline" onClick={indir}><Download /> CSV</Button>
        </div>
      </CardHeader>
      <Table>
        <thead><tr><Th>Tarih</Th><Th>Grup / ders</Th><Th>Öğretmen</Th><Th>Konu</Th><Th className="text-right">Katılım</Th></tr></thead>
        <tbody>
          {kayitlar.slice(0, 80).map((y) => {
            const p = d.program.find((x) => x.id === y.satirId);
            const v = Object.values(y.durumlar);
            return (
              <tr key={y.oturumId}>
                <Td className="whitespace-nowrap tabular-nums">{new Date(y.tarih + "T00:00:00").toLocaleDateString("tr-TR", { day: "numeric", month: "short", weekday: "short" })}</Td>
                <Td>{grupEtiket(d, y.grupId)} · {p ? dersAdi(p.dersId) : ""}</Td>
                <Td>{personelAdi(d, y.ogretmenId)}</Td>
                <Td className="text-muted-foreground">{y.konu || "—"}</Td>
                <Td className="text-right tabular-nums">{v.filter((x) => x !== "gelmedi").length}/{v.length}</Td>
              </tr>
            );
          })}
        </tbody>
      </Table>
      {kayitlar.length === 0 && <CardContent><p className="p-4 text-sm text-muted-foreground">Kayıt yok.</p></CardContent>}
    </Card>
  );
}

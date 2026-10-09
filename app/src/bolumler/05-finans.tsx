/**
 * Bölüm 05 · Finans: ödeme planı, tahsilat ve kasa
 * Doküman: docs/bolumler/05-finans.md — modül varsayılan KAPALI (Bölüm 01 → Modüller)
 */
import * as React from "react";
import { useSearchParams } from "react-router-dom";
import {
  AlarmClock,
  ArrowLeftRight,
  Banknote,
  BellRing,
  CircleDollarSign,
  CreditCard,
  Landmark,
  PieChart,
  Plus,
  Printer,
  Receipt,
  Search,
  Undo2,
  Wallet,
} from "lucide-react";
import {
  Alert,
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Dialog,
  EmptyState,
  Field,
  Input,
  PageHeader,
  Select,
  StatCard,
  Table,
  Tabs,
  Td,
  Textarea,
  Th,
  toast,
} from "@/components/ui";
import { useApp, useOturum } from "@/context/AppContext";
import { tanimlar } from "@/data/store";
import {
  BUGUN,
  aktifKayit,
  bildirimEkle,
  grupEtiket,
  guncelle,
  islemYaz,
  simdiZaman,
  sube,
  tamAd,
  taksitAdi,
  taksitKalan,
  useDb,
  yeniId,
  type Db,
  type Gider,
  type Tahsilat,
  type Taksit,
} from "@/data/store";
import { gecikmeGunu, tahsilatDagit, tarihEkle, tl } from "@/lib/kurallar";
import { esc, yazdir } from "@/lib/yazdir";
import { cn } from "@/lib/utils";

type Sekme = "ozet" | "tahsilat" | "geciken" | "kasa";
const tarihTR = (iso: string) => new Date(iso.slice(0, 10) + "T00:00:00").toLocaleDateString("tr-TR", { day: "numeric", month: "short", year: "numeric" });
const yontemAd = { nakit: "Nakit", havale: "Havale/EFT", pos: "Kredi kartı (POS)" } as const;
const kasaAd = { nakit: "Nakit kasa", pos: "POS", banka: "Banka" } as const;
const yontemKasa = (y: Tahsilat["yontem"]): Gider["kasa"] => (y === "havale" ? "banka" : y);

export default function Finans() {
  const [params] = useSearchParams();
  const [sekme, setSekme] = React.useState<Sekme>(params.get("veli") ? "tahsilat" : "ozet");
  return (
    <div className="grid gap-6">
      <PageHeader code="05" title="Finans" description="Kim ne kadar borçlu, kim gecikti, kasada ne var — tek bakışta." />
      <Tabs
        value={sekme}
        onChange={setSekme}
        items={[
          { value: "ozet", label: "Özet", icon: <PieChart /> },
          { value: "tahsilat", label: "Hızlı tahsilat", icon: <Receipt /> },
          { value: "geciken", label: "Vadesi geçenler", icon: <AlarmClock /> },
          { value: "kasa", label: "Kasa ve gider", icon: <Wallet /> },
        ]}
      />
      {sekme === "ozet" && <Ozet onGit={setSekme} />}
      {sekme === "tahsilat" && <HizliTahsilat baslangicVeli={params.get("veli")} />}
      {sekme === "geciken" && <Gecikenler />}
      {sekme === "kasa" && <Kasa />}
    </div>
  );
}

function aktifTahsilatlar(d: Db) {
  return d.tahsilatlar.filter((t) => !t.iptal);
}

/* ---------- Özet ---------- */
function Ozet({ onGit }: { onGit: (s: Sekme) => void }) {
  const d = useDb();
  const { subeGorunur, seciliSubeler } = useOturum();
  const ay = BUGUN.slice(0, 7);
  const taksitler = d.taksitler.filter((t) => subeGorunur(t.subeId));
  const buAy = taksitler.filter((t) => t.vade.startsWith(ay));
  const beklenen = buAy.reduce((s, t) => s + t.tutar, 0);
  const tahsil = buAy.reduce((s, t) => s + t.odenen, 0);
  const geciken = taksitler.filter((t) => t.vade < BUGUN && taksitKalan(t) > 0);
  const gecikenTutar = geciken.reduce((s, t) => s + taksitKalan(t), 0);
  const gecikenVeli = new Set(geciken.map((t) => t.veliId)).size;
  const haftaSonu = tarihEkle(BUGUN, 7);
  const yaklasan = taksitler.filter((t) => t.vade >= BUGUN && t.vade <= haftaSonu && taksitKalan(t) > 0);

  // Aylık beklenen vs tahsil edilen (sezon)
  const aylar = ["2026-09", "2026-10", "2026-11", "2026-12", "2027-01", "2027-02"];
  const aylik = aylar.map((a) => {
    const l = taksitler.filter((t) => t.vade.startsWith(a));
    return { a, beklenen: l.reduce((s, t) => s + t.tutar, 0), tahsil: l.reduce((s, t) => s + t.odenen, 0) };
  });
  const enBuyuk = Math.max(1, ...aylik.map((x) => x.beklenen));

  return (
    <div className="grid gap-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Bu ay beklenen" value={tl(beklenen)} icon={<CircleDollarSign />} />
        <StatCard label="Bu ay tahsil edilen" value={tl(tahsil)} icon={<Banknote />} tone="success" hint={`Tahsilat oranı %${beklenen ? Math.round((tahsil / beklenen) * 100) : 0}`} />
        <StatCard label="Vadesi geçen" value={tl(gecikenTutar)} icon={<AlarmClock />} tone="danger" hint={`${gecikenVeli} veli`} onClick={() => onGit("geciken")} />
        <StatCard label="7 gün içinde vadesi gelen" value={yaklasan.length} icon={<BellRing />} tone="warning" hint={tl(yaklasan.reduce((s, t) => s + taksitKalan(t), 0))} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Aylık beklenen ve tahsil edilen</CardTitle>
          <CardDescription>Açık renk beklenen, koyu renk tahsil edilen tutar</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex h-48 items-end gap-3">
            {aylik.map((x) => (
              <div key={x.a} className="flex flex-1 flex-col items-center gap-2">
                <div className="relative flex h-40 w-full max-w-16 items-end">
                  <div className="absolute bottom-0 w-full rounded-t-md bg-primary/20" style={{ height: `${(x.beklenen / enBuyuk) * 100}%` }} title={`Beklenen ${tl(x.beklenen)}`} />
                  <div className="absolute bottom-0 w-full rounded-t-md bg-primary" style={{ height: `${(x.tahsil / enBuyuk) * 100}%` }} title={`Tahsil ${tl(x.tahsil)}`} />
                </div>
                <span className="text-xs text-muted-foreground">{new Date(x.a + "-01T00:00:00").toLocaleDateString("tr-TR", { month: "short" })}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {seciliSubeler.length > 1 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Şube karşılaştırma</CardTitle>
          </CardHeader>
          <Table>
            <thead>
              <tr><Th>Şube</Th><Th className="text-right">Sezon tahsilatı</Th><Th className="text-right">Tahsilat oranı (vadesi gelen)</Th><Th className="text-right">Ekim gideri</Th><Th className="text-right">Öğrenci başı gelir</Th></tr>
            </thead>
            <tbody>
              {seciliSubeler.map((sid) => {
                const t = d.taksitler.filter((x) => x.subeId === sid && x.vade <= BUGUN);
                const vadesiGelen = t.reduce((s, x) => s + x.tutar, 0);
                const odenen = t.reduce((s, x) => s + x.odenen, 0);
                const ciro = aktifTahsilatlar(d).filter((x) => x.subeId === sid).reduce((s, x) => s + x.tutar, 0);
                const gider = d.giderler.filter((g) => g.subeId === sid && g.tarih.startsWith(BUGUN.slice(0, 7))).reduce((s, g) => s + g.tutar, 0);
                const ogr = d.kayitlar.filter((k) => k.subeId === sid && k.durum === "aktif").length;
                return (
                  <tr key={sid}>
                    <Td className="font-medium">{sube(sid)?.ad}</Td>
                    <Td className="text-right tabular-nums">{tl(ciro)}</Td>
                    <Td className="text-right tabular-nums">%{vadesiGelen ? Math.round((odenen / vadesiGelen) * 100) : 0}</Td>
                    <Td className="text-right tabular-nums">{tl(gider)}</Td>
                    <Td className="text-right tabular-nums">{tl(ogr ? ciro / ogr : 0)}</Td>
                  </tr>
                );
              })}
            </tbody>
          </Table>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Bu hafta vadesi gelenler</CardTitle>
        </CardHeader>
        {yaklasan.length === 0 ? (
          <CardContent><p className="text-sm text-muted-foreground">Önümüzdeki 7 günde vadesi gelen taksit yok.</p></CardContent>
        ) : (
          <TaksitTablosu taksitler={yaklasan} />
        )}
      </Card>
    </div>
  );
}

function TaksitTablosu({ taksitler }: { taksitler: Taksit[] }) {
  const d = useDb();
  return (
    <Table>
      <thead><tr><Th>Öğrenci</Th><Th>Veli</Th><Th>Taksit</Th><Th>Vade</Th><Th className="text-right">Kalan</Th></tr></thead>
      <tbody>
        {taksitler.slice(0, 50).map((t) => {
          const o = d.ogrenciler.find((x) => x.id === t.ogrenciId);
          const v = d.veliler.find((x) => x.id === t.veliId);
          return (
            <tr key={t.id}>
              <Td className="font-medium">{tamAd(o)}</Td>
              <Td>{tamAd(v)} <span className="font-mono text-xs text-muted-foreground">{v?.telefon}</span></Td>
              <Td>{taksitAdi(t.no)}</Td>
              <Td className="tabular-nums">{tarihTR(t.vade)}</Td>
              <Td className="text-right tabular-nums">{tl(taksitKalan(t))}</Td>
            </tr>
          );
        })}
      </tbody>
    </Table>
  );
}

/* ---------- Hızlı tahsilat + cari hesap ---------- */
function makbuzYazdir(d: Db, liste: Tahsilat[]) {
  const ilk = liste[0];
  const v = d.veliler.find((x) => x.id === ilk.veliId);
  const s = sube(ilk.alinanSubeId);
  const satirlar = liste
    .flatMap((t) => t.dagilim.map((x) => ({ t, x, tk: d.taksitler.find((y) => y.id === x.taksitId) })))
    .map(({ x, tk }) => {
      const o = d.ogrenciler.find((y) => y.id === tk?.ogrenciId);
      return `<tr><td>${esc(tamAd(o))}</td><td>${tk ? taksitAdi(tk.no) : ""}</td><td>${tk ? tarihTR(tk.vade) : ""}</td><td class="sag">${tl(x.tutar)}</td></tr>`;
    })
    .join("");
  const toplam = liste.reduce((t, x) => t + x.tutar, 0);
  return yazdir(
    `Makbuz ${ilk.makbuzNo}`,
    `<h1>Tahsilat Makbuzu</h1>
     <p class="kucuk">Makbuz no: <b>${esc(liste.map((x) => x.makbuzNo).join(", "))}</b> · ${new Date(ilk.zaman).toLocaleString("tr-TR")} · ${esc(s?.ad)}</p>
     <table><tr><th>Ödeyen</th><td>${esc(tamAd(v))} (${esc(v?.telefon)})</td><th>Yöntem</th><td>${yontemAd[ilk.yontem]}</td></tr></table>
     <table><tr><th>Öğrenci</th><th>Taksit</th><th>Vade</th><th class="sag">Tutar</th></tr>${satirlar}
     <tr><th colspan="3">Toplam</th><th class="sag">${tl(toplam)}</th></tr></table>
     <div class="imza"><div>Tahsil eden: ${esc(ilk.kullanici)}</div><div>Kaşe / imza</div></div>`,
    `${s?.ad} · ${s?.adres}`,
  );
}

function HizliTahsilat({ baslangicVeli }: { baslangicVeli: string | null }) {
  const d = useDb();
  const { subeId } = useApp();
  const { subeGorunur, ad, rol, kapsam } = useOturum();
  const [ara, setAra] = React.useState("");
  const [veliId, setVeliId] = React.useState<string | null>(baslangicVeli);
  const [tutar, setTutar] = React.useState("");
  const [yontem, setYontem] = React.useState<Tahsilat["yontem"]>("nakit");
  const [alinanSube, setAlinanSube] = React.useState(subeId !== "all" ? subeId : kapsam[0]);
  const [iptalEdilen, setIptalEdilen] = React.useState<Tahsilat | null>(null);

  // Veli arama: veli adı/telefonu veya öğrenci adı
  const sonuclar = React.useMemo(() => {
    const q = ara.toLocaleLowerCase("tr").trim();
    if (q.length < 2) return [];
    return d.veliler
      .map((v) => ({ v, cocuklar: d.ogrenciler.filter((o) => o.veliIds.includes(v.id)) }))
      .filter(({ v, cocuklar }) =>
        cocuklar.some((o) => subeGorunur(aktifKayit(d, o.id)?.subeId)) &&
        `${tamAd(v)} ${v.telefon.replace(/\s/g, "")} ${cocuklar.map((o) => tamAd(o)).join(" ")}`.toLocaleLowerCase("tr").includes(q.replace(/\s(?=\d)/g, "")),
      )
      .slice(0, 8);
  }, [ara, d, subeGorunur]);

  const v = d.veliler.find((x) => x.id === veliId);
  // Kardeşlerin borçları veli bazında birlikte görülür (şube fark etmeksizin)
  const cocuklar = v ? d.ogrenciler.filter((o) => o.veliIds.includes(v.id)) : [];
  const acik = d.taksitler
    .filter((t) => cocuklar.some((o) => o.id === t.ogrenciId) && taksitKalan(t) > 0)
    .sort((a, b) => a.vade.localeCompare(b.vade) || a.no - b.no);
  const toplamBorc = acik.reduce((s, t) => s + taksitKalan(t), 0);
  const vadesiGelen = acik.filter((t) => t.vade <= BUGUN).reduce((s, t) => s + taksitKalan(t), 0);
  const gecmis = d.tahsilatlar.filter((t) => cocuklar.length && d.taksitler.some((tk) => t.dagilim.some((x) => x.taksitId === tk.id) && cocuklar.some((o) => o.id === tk.ogrenciId))).sort((a, b) => b.zaman.localeCompare(a.zaman));

  const sayi = Number(tutar.replace(",", "."));
  const onizleme = sayi > 0 ? tahsilatDagit(sayi, acik.map((t) => ({ id: t.id, kalan: taksitKalan(t) }))) : null;
  const hata = !sayi || sayi <= 0 ? null : sayi > toplamBorc + 0.001 ? `Tutar toplam borçtan (${tl(toplamBorc)}) fazla olamaz.` : null;

  React.useEffect(() => {
    if (v) setTutar(vadesiGelen > 0 ? String(vadesiGelen) : acik[0] ? String(taksitKalan(acik[0])) : "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [veliId]);

  const tahsilEt = () => {
    if (!v || !onizleme || hata || !onizleme.dagilim.length) return;
    const olusan: Tahsilat[] = [];
    guncelle((x) => {
      // Tahsilat öğrencinin kayıtlı olduğu şubenin kasasına yazılır; hangi şubede alındığı ayrıca tutulur.
      const subeGruplari = new Map<string, { taksitId: string; tutar: number }[]>();
      for (const dg of onizleme.dagilim) {
        const tk = x.taksitler.find((t) => t.id === dg.taksitId)!;
        subeGruplari.set(tk.subeId, [...(subeGruplari.get(tk.subeId) ?? []), dg]);
      }
      for (const [sid, dagilim] of subeGruplari) {
        const no = `${sube(sid)?.kod}-M-${String(x.tahsilatlar.length + 1).padStart(5, "0")}`;
        const t: Tahsilat = {
          id: yeniId("th"), makbuzNo: no, zaman: simdiZaman(), veliId: v.id, subeId: sid, alinanSubeId: alinanSube, yontem,
          tutar: Math.round(dagilim.reduce((s, z) => s + z.tutar, 0) * 100) / 100, dagilim, iptal: null, kullanici: ad,
        };
        x.tahsilatlar.push(t);
        olusan.push(t);
      }
      x.taksitler = x.taksitler.map((t) => {
        const dg = onizleme.dagilim.find((z) => z.taksitId === t.id);
        return dg ? { ...t, odenen: Math.round((t.odenen + dg.tutar) * 100) / 100 } : t;
      });
      const ogr = cocuklar[0];
      if (ogr) bildirimEkle(x, "odemeAlindi", ogr.id, { tutar: tl(sayi), makbuz: olusan.map((z) => z.makbuzNo).join(", ") }, undefined, true);
      islemYaz(x, ad, "Tahsilat", `${tamAd(v)} — ${tl(sayi)} (${yontemAd[yontem]})`, alinanSube);
    });
    toast(`${tl(sayi)} tahsil edildi. Veliye “ödemeniz alındı” mesajı gönderildi.`);
    if (!makbuzYazdir({ ...d, tahsilatlar: [...d.tahsilatlar, ...olusan] } as Db, olusan)) toast("Makbuz penceresi engellendi.", "uyari");
  };

  return (
    <div className="grid gap-4 lg:grid-cols-[22rem_1fr]">
      <Card className="self-start">
        <CardHeader>
          <CardTitle className="text-base">Veli / öğrenci ara</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-2">
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input autoFocus placeholder="En az 2 harf veya telefon" className="pl-8" value={ara} onChange={(e) => setAra(e.target.value)} />
          </div>
          {sonuclar.map(({ v: vv, cocuklar: c }) => (
            <button
              key={vv.id}
              onClick={() => setVeliId(vv.id)}
              className={cn("rounded-md border p-2.5 text-left text-sm transition hover:border-primary/50", veliId === vv.id && "border-primary bg-accent/50")}
            >
              <p className="font-medium">{tamAd(vv)}</p>
              <p className="text-xs text-muted-foreground">{c.map((o) => o.ad).join(", ")} · {vv.telefon}</p>
            </button>
          ))}
          {ara.length >= 2 && sonuclar.length === 0 && <p className="text-sm text-muted-foreground">Sonuç yok.</p>}
        </CardContent>
      </Card>

      {!v ? (
        <EmptyState icon={<Receipt />} title="Veli seçin" text="Soldan veli veya öğrenci arayın. Kardeşlerin borçları birlikte gösterilir ve tek tahsilatla ödenebilir." />
      ) : (
        <div className="grid gap-4">
          <Card>
            <CardHeader className="flex-row flex-wrap items-start justify-between gap-2">
              <div>
                <CardTitle>{tamAd(v)}</CardTitle>
                <CardDescription className="mt-1">
                  {cocuklar.map((o) => `${o.ad} (${grupEtiket(d, aktifKayit(d, o.id)?.grupId ?? "")})`).join(" · ")}
                </CardDescription>
              </div>
              <div className="text-right">
                <p className="text-xs text-muted-foreground">Toplam borç</p>
                <p className="text-xl font-semibold tabular-nums">{tl(toplamBorc)}</p>
                {vadesiGelen > 0 && <p className="text-xs text-danger">Vadesi gelen: {tl(vadesiGelen)}</p>}
              </div>
            </CardHeader>
            <Table>
              <thead><tr><Th>Öğrenci</Th><Th>Taksit</Th><Th>Vade</Th><Th className="text-right">Kalan</Th><Th className="text-right">Bu ödeme</Th></tr></thead>
              <tbody>
                {acik.map((t) => {
                  const o = cocuklar.find((x) => x.id === t.ogrenciId);
                  const pay = onizleme?.dagilim.find((x) => x.taksitId === t.id)?.tutar;
                  return (
                    <tr key={t.id} className={cn(pay && "bg-success/5")}>
                      <Td>{o?.ad} <span className="text-xs text-muted-foreground">{sube(t.subeId)?.kod}</span></Td>
                      <Td>{taksitAdi(t.no)}</Td>
                      <Td className={cn("tabular-nums", t.vade < BUGUN && "text-danger")}>{tarihTR(t.vade)}{t.vade < BUGUN && ` · ${gecikmeGunu(t.vade, BUGUN)} gün`}</Td>
                      <Td className="text-right tabular-nums">{tl(taksitKalan(t))}</Td>
                      <Td className="text-right tabular-nums font-medium text-success">{pay ? tl(pay) : ""}</Td>
                    </tr>
                  );
                })}
                {acik.length === 0 && (
                  <tr><Td colSpan={5} className="text-center text-muted-foreground">Açık taksit yok. 🎉</Td></tr>
                )}
              </tbody>
            </Table>
            {acik.length > 0 && (
              <CardContent className="grid gap-3 pt-4 sm:grid-cols-[1fr_1fr_1fr_auto] sm:items-end">
                <Field label="Tutar (₺)"><Input inputMode="decimal" value={tutar} onChange={(e) => setTutar(e.target.value)} /></Field>
                <Field label="Yöntem">
                  <Select value={yontem} onChange={(e) => setYontem(e.target.value as Tahsilat["yontem"])}>
                    {Object.entries(yontemAd).map(([k, a]) => <option key={k} value={k}>{a}</option>)}
                  </Select>
                </Field>
                <Field label="Alındığı şube">
                  <Select value={alinanSube} onChange={(e) => setAlinanSube(e.target.value)}>
                    {tanimlar().subeler.filter((s) => kapsam.includes(s.id)).map((s) => <option key={s.id} value={s.id}>{s.ad}</option>)}
                  </Select>
                </Field>
                <Button onClick={tahsilEt} disabled={!onizleme?.dagilim.length || !!hata}>
                  <Receipt /> Tahsil et
                </Button>
                {hata && <p className="text-sm text-danger sm:col-span-4">{hata}</p>}
                <p className="text-xs text-muted-foreground sm:col-span-4">
                  Ödeme en eski vadeli taksitten başlayarak dağıtılır; kısmi ödeme desteklenir, fazlası sonraki taksite aktarılır. Makbuz otomatik açılır.
                </p>
              </CardContent>
            )}
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-base">Tahsilat geçmişi</CardTitle></CardHeader>
            <Table>
              <thead><tr><Th>Makbuz</Th><Th>Tarih</Th><Th>Yöntem</Th><Th className="text-right">Tutar</Th><Th /></tr></thead>
              <tbody>
                {gecmis.map((t) => (
                  <tr key={t.id} className={cn(t.iptal && "text-muted-foreground line-through")}>
                    <Td className="font-mono text-xs">{t.makbuzNo}</Td>
                    <Td className="tabular-nums">{tarihTR(t.zaman)}</Td>
                    <Td>{yontemAd[t.yontem]}</Td>
                    <Td className="text-right tabular-nums">{tl(t.tutar)}</Td>
                    <Td className="text-right">
                      {t.iptal ? (
                        <Badge variant="danger" className="no-underline">İptal: {t.iptal.neden}</Badge>
                      ) : (
                        <div className="flex justify-end gap-1">
                          <Button variant="ghost" size="sm" onClick={() => makbuzYazdir(d, [t])} title="Makbuzu yazdır"><Printer /></Button>
                          {(rol === "genel-yonetici" || rol === "sube-muduru") && (
                            <Button variant="ghost" size="sm" onClick={() => setIptalEdilen(t)} title="İptal et"><Undo2 /></Button>
                          )}
                        </div>
                      )}
                    </Td>
                  </tr>
                ))}
                {gecmis.length === 0 && <tr><Td colSpan={5} className="text-center text-muted-foreground">Tahsilat yok.</Td></tr>}
              </tbody>
            </Table>
          </Card>
        </div>
      )}
      {iptalEdilen && <TahsilatIptal t={iptalEdilen} onClose={() => setIptalEdilen(null)} />}
    </div>
  );
}

function TahsilatIptal({ t, onClose }: { t: Tahsilat; onClose: () => void }) {
  const { ad } = useOturum();
  const [neden, setNeden] = React.useState("");
  const iptal = () => {
    guncelle((x) => {
      // Tahsilat silinmez, yalnızca iptal edilir (gerekçe + kullanıcı kaydı)
      x.tahsilatlar = x.tahsilatlar.map((y) => (y.id === t.id ? { ...y, iptal: { neden: neden.trim(), kullanici: ad, zaman: simdiZaman() } } : y));
      x.taksitler = x.taksitler.map((tk) => {
        const dg = t.dagilim.find((z) => z.taksitId === tk.id);
        return dg ? { ...tk, odenen: Math.max(0, Math.round((tk.odenen - dg.tutar) * 100) / 100) } : tk;
      });
      islemYaz(x, ad, "Tahsilat iptali", `${t.makbuzNo} — ${tl(t.tutar)}. Neden: ${neden.trim()}`, t.subeId);
    });
    toast("Tahsilat iptal edildi; taksitler yeniden açıldı.");
    onClose();
  };
  return (
    <Dialog
      open
      onClose={onClose}
      title={`${t.makbuzNo} iptali`}
      description={`${tl(t.tutar)} · tahsilat silinmez, iptal olarak işaretlenir ve işlem kaydına yazılır.`}
      footer={<><Button variant="outline" onClick={onClose}>Vazgeç</Button><Button variant="destructive" onClick={iptal} disabled={neden.trim().length < 3}>İptal et</Button></>}
    >
      <Field label="Gerekçe"><Textarea value={neden} onChange={(e) => setNeden(e.target.value)} /></Field>
    </Dialog>
  );
}

/* ---------- Vadesi geçenler ---------- */
function Gecikenler() {
  const d = useDb();
  const { subeGorunur, ad } = useOturum();
  const geciken = d.taksitler.filter((t) => subeGorunur(t.subeId) && t.vade < BUGUN && taksitKalan(t) > 0);
  const veliler = [...new Set(geciken.map((t) => t.veliId))].map((vid) => {
    const l = geciken.filter((t) => t.veliId === vid);
    const enEski = l.reduce((m, t) => (t.vade < m ? t.vade : m), l[0].vade);
    const son = d.gonderimler.filter((g) => g.olay === "gecikmisOdeme" && g.veliId === vid).sort((a, b) => b.zaman.localeCompare(a.zaman))[0];
    return { vid, l, toplam: l.reduce((s, t) => s + taksitKalan(t), 0), enEski, son };
  }).sort((a, b) => a.enEski.localeCompare(b.enEski));

  const hatirlat = (liste: typeof veliler) => {
    guncelle((x) => {
      for (const r of liste) {
        const t = r.l[0];
        bildirimEkle(x, "gecikmisOdeme", t.ogrenciId, { tutar: tl(r.toplam), vade: tarihTR(r.enEski) }, undefined, true);
      }
      islemYaz(x, ad, "Ödeme hatırlatma", `${liste.length} veliye gecikmiş ödeme hatırlatması gönderildi`);
    });
    toast(`${liste.length} veliye nazik hatırlatma gönderildi.`);
  };

  return (
    <Card>
      <CardHeader className="flex-row flex-wrap items-center justify-between gap-3">
        <div>
          <CardTitle>Vadesi geçenler</CardTitle>
          <CardDescription className="mt-1">
            Otomatik hatırlatma: vadeden 3 gün önce, vade günü, gecikmede 3. ve 10. gün ({d.ayarlar.hatirlatmaGunleri.join(", ")}). Toplam {tl(veliler.reduce((s, r) => s + r.toplam, 0))}.
          </CardDescription>
        </div>
        {veliler.length > 0 && <Button size="sm" variant="outline" onClick={() => hatirlat(veliler)}><BellRing /> Hepsine hatırlat</Button>}
      </CardHeader>
      {veliler.length === 0 ? (
        <CardContent><EmptyState icon={<AlarmClock />} title="Geciken ödeme yok" text="Tüm vadesi gelen taksitler ödenmiş." /></CardContent>
      ) : (
        <Table>
          <thead><tr><Th>Veli</Th><Th>Öğrenci(ler)</Th><Th>En eski vade</Th><Th className="text-right">Tutar</Th><Th>Son hatırlatma</Th><Th /></tr></thead>
          <tbody>
            {veliler.map((r) => {
              const v = d.veliler.find((x) => x.id === r.vid);
              const gun = gecikmeGunu(r.enEski, BUGUN);
              return (
                <tr key={r.vid}>
                  <Td>
                    <p className="font-medium">{tamAd(v)}</p>
                    <p className="font-mono text-xs text-muted-foreground">{v?.telefon}</p>
                  </Td>
                  <Td>{[...new Set(r.l.map((t) => d.ogrenciler.find((o) => o.id === t.ogrenciId)?.ad))].join(", ")}</Td>
                  <Td><span className={cn("tabular-nums", gun >= 10 && "font-medium text-danger")}>{tarihTR(r.enEski)} · {gun} gün</span></Td>
                  <Td className="text-right tabular-nums font-medium">{tl(r.toplam)}</Td>
                  <Td className="text-muted-foreground">{r.son ? `${tarihTR(r.son.zaman)} · ${r.son.kanal === "sms" ? "SMS" : "uygulama"}` : "—"}</Td>
                  <Td className="text-right"><Button variant="ghost" size="sm" onClick={() => hatirlat([r])}><BellRing /> Hatırlat</Button></Td>
                </tr>
              );
            })}
          </tbody>
        </Table>
      )}
    </Card>
  );
}

/* ---------- Kasa ve gider ---------- */
type Hareket = { id: string; tarih: string; kasa: string; aciklama: string; giris: number; cikis: number };

function kasaHareketleri(d: Db): Hareket[] {
  const h: Hareket[] = [];
  for (const t of aktifTahsilatlar(d))
    h.push({ id: t.id, tarih: t.zaman, kasa: `${t.subeId}:${yontemKasa(t.yontem)}`, aciklama: `Tahsilat ${t.makbuzNo} · ${tamAd(d.veliler.find((v) => v.id === t.veliId))}`, giris: t.tutar, cikis: 0 });
  for (const g of d.giderler) h.push({ id: g.id, tarih: g.tarih, kasa: `${g.subeId}:${g.kasa}`, aciklama: `${g.kategori} · ${g.aciklama}`, giris: 0, cikis: g.tutar });
  for (const v of d.virmanlar) {
    h.push({ id: v.id + "c", tarih: v.tarih, kasa: v.kaynak, aciklama: `Virman → ${kasaEtiket(v.hedef)} · ${v.aciklama}`, giris: 0, cikis: v.tutar });
    h.push({ id: v.id + "g", tarih: v.tarih, kasa: v.hedef, aciklama: `Virman ← ${kasaEtiket(v.kaynak)} · ${v.aciklama}`, giris: v.tutar, cikis: 0 });
  }
  return h.sort((a, b) => b.tarih.localeCompare(a.tarih));
}
function kasaEtiket(k: string) {
  const [s, tur] = k.split(":");
  return `${s === "merkez" ? "Genel Merkez" : sube(s)?.kod} ${kasaAd[tur as keyof typeof kasaAd] ?? tur}`;
}

function Kasa() {
  const d = useDb();
  const { subeGorunur, seciliSubeler, ad, rol } = useOturum();
  const [giderAcik, setGiderAcik] = React.useState(false);
  const [virmanAcik, setVirmanAcik] = React.useState(false);
  const merkezGorur = rol === "genel-yonetici";
  const hareketler = kasaHareketleri(d).filter((h) => {
    const s = h.kasa.split(":")[0];
    return s === "merkez" ? merkezGorur : subeGorunur(s);
  });
  const kasalar = [...seciliSubeler.flatMap((s) => (["nakit", "pos", "banka"] as const).map((k) => `${s}:${k}`)), ...(merkezGorur ? ["merkez:banka"] : [])];
  const bakiye = (k: string) => kasaHareketleri(d).filter((h) => h.kasa === k).reduce((s, h) => s + h.giris - h.cikis, 0);
  const bugun = hareketler.filter((h) => h.tarih.startsWith(BUGUN));

  const gunSonu = () =>
    yazdir(
      `Gün sonu ${BUGUN}`,
      `<h1>Gün sonu kasa raporu — ${tarihTR(BUGUN)}</h1>
       <table><tr><th>Kasa</th><th class="sag">Bakiye</th></tr>${kasalar.map((k) => `<tr><td>${esc(kasaEtiket(k))}</td><td class="sag">${tl(bakiye(k))}</td></tr>`).join("")}</table>
       <h2>Bugünkü hareketler</h2><table><tr><th>Kasa</th><th>Açıklama</th><th class="sag">Giriş</th><th class="sag">Çıkış</th></tr>
       ${bugun.map((h) => `<tr><td>${esc(kasaEtiket(h.kasa))}</td><td>${esc(h.aciklama)}</td><td class="sag">${h.giris ? tl(h.giris) : ""}</td><td class="sag">${h.cikis ? tl(h.cikis) : ""}</td></tr>`).join("") || `<tr><td colspan="4">Hareket yok</td></tr>`}</table>
       <div class="imza"><div>Hazırlayan: ${esc(ad)}</div><div>Kontrol eden</div></div>`,
    );

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap justify-end gap-2">
        <Button variant="outline" onClick={gunSonu}><Printer /> Gün sonu raporu</Button>
        <Button variant="outline" onClick={() => setVirmanAcik(true)}><ArrowLeftRight /> Virman</Button>
        <Button onClick={() => setGiderAcik(true)}><Plus /> Gider gir</Button>
      </div>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
        {kasalar.map((k) => (
          <StatCard key={k} label={kasaEtiket(k)} value={tl(bakiye(k))} icon={k.endsWith("nakit") ? <Banknote /> : k.endsWith("pos") ? <CreditCard /> : <Landmark />} tone={bakiye(k) < 0 ? "danger" : "default"} />
        ))}
      </div>
      <Card>
        <CardHeader><CardTitle className="text-base">Kasa hareketleri</CardTitle></CardHeader>
        <Table>
          <thead><tr><Th>Tarih</Th><Th>Kasa</Th><Th>Açıklama</Th><Th className="text-right">Giriş</Th><Th className="text-right">Çıkış</Th></tr></thead>
          <tbody>
            {hareketler.slice(0, 60).map((h) => (
              <tr key={h.id}>
                <Td className="whitespace-nowrap tabular-nums">{tarihTR(h.tarih)}</Td>
                <Td className="whitespace-nowrap text-xs">{kasaEtiket(h.kasa)}</Td>
                <Td>{h.aciklama}</Td>
                <Td className="text-right tabular-nums text-success">{h.giris ? tl(h.giris) : ""}</Td>
                <Td className="text-right tabular-nums text-danger">{h.cikis ? tl(h.cikis) : ""}</Td>
              </tr>
            ))}
          </tbody>
        </Table>
      </Card>
      <GiderDialog open={giderAcik} onClose={() => setGiderAcik(false)} merkez={merkezGorur} />
      <VirmanDialog open={virmanAcik} onClose={() => setVirmanAcik(false)} kasalar={kasalar} />
    </div>
  );
}

function GiderDialog({ open, onClose, merkez }: { open: boolean; onClose: () => void; merkez: boolean }) {
  const { seciliSubeler, ad } = useOturum();
  const bos = { tarih: BUGUN, subeId: seciliSubeler[0] as string, kategori: "Kırtasiye", aciklama: "", tutar: "", kasa: "nakit" as Gider["kasa"] };
  const [f, setF] = React.useState(bos);
  const tutar = Number(f.tutar.replace(",", "."));
  const kaydet = () => {
    if (!(tutar > 0) || !f.aciklama.trim()) return;
    guncelle((x) => {
      x.giderler.push({ id: yeniId("gd"), tarih: f.tarih, subeId: f.subeId, kategori: f.kategori, aciklama: f.aciklama.trim(), tutar, kasa: f.kasa });
      islemYaz(x, ad, "Gider", `${f.kategori}: ${f.aciklama} — ${tl(tutar)}`, f.subeId === "merkez" ? null : f.subeId);
    });
    toast("Gider kaydedildi.");
    setF(bos);
    onClose();
  };
  return (
    <Dialog open={open} onClose={onClose} title="Gider girişi" footer={<><Button variant="outline" onClick={onClose}>Vazgeç</Button><Button onClick={kaydet} disabled={!(tutar > 0) || !f.aciklama.trim()}>Kaydet</Button></>}>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Tarih"><Input type="date" value={f.tarih} onChange={(e) => setF({ ...f, tarih: e.target.value })} /></Field>
        <Field label="Şube">
          <Select value={f.subeId} onChange={(e) => setF({ ...f, subeId: e.target.value })}>
            {seciliSubeler.map((s) => <option key={s} value={s}>{sube(s)?.ad}</option>)}
            {merkez && <option value="merkez">Genel Merkez (ortak gider)</option>}
          </Select>
        </Field>
        <Field label="Kategori">
          <Select value={f.kategori} onChange={(e) => setF({ ...f, kategori: e.target.value })}>
            {["Kira", "Fatura", "Maaş", "Kırtasiye", "Yazılım", "Reklam", "Temizlik", "Diğer"].map((k) => <option key={k}>{k}</option>)}
          </Select>
        </Field>
        <Field label="Kasa">
          <Select value={f.kasa} onChange={(e) => setF({ ...f, kasa: e.target.value as Gider["kasa"] })}>
            {Object.entries(kasaAd).map(([k, a]) => <option key={k} value={k}>{a}</option>)}
          </Select>
        </Field>
      </div>
      <Field label="Açıklama"><Input value={f.aciklama} onChange={(e) => setF({ ...f, aciklama: e.target.value })} /></Field>
      <Field label="Tutar (₺)"><Input inputMode="decimal" value={f.tutar} onChange={(e) => setF({ ...f, tutar: e.target.value })} /></Field>
      <Field label="Belge fotoğrafı" hint="Fatura / fiş görseli (isteğe bağlı)"><Input type="file" accept="image/*,application/pdf" className="pt-1.5" /></Field>
    </Dialog>
  );
}

function VirmanDialog({ open, onClose, kasalar }: { open: boolean; onClose: () => void; kasalar: string[] }) {
  const { ad } = useOturum();
  const [f, setF] = React.useState({ kaynak: kasalar[0] ?? "", hedef: kasalar[kasalar.length - 1] ?? "", tutar: "", aciklama: "" });
  const tutar = Number(f.tutar.replace(",", "."));
  const gecerli = tutar > 0 && f.kaynak !== f.hedef;
  const kaydet = () => {
    if (!gecerli) return;
    guncelle((x) => {
      x.virmanlar.push({ id: yeniId("vr"), tarih: BUGUN, kaynak: f.kaynak, hedef: f.hedef, tutar, aciklama: f.aciklama || "Virman" });
      islemYaz(x, ad, "Virman", `${kasaEtiket(f.kaynak)} → ${kasaEtiket(f.hedef)}: ${tl(tutar)}`);
    });
    toast("Virman kaydedildi.");
    onClose();
  };
  return (
    <Dialog open={open} onClose={onClose} title="Kasalar arası virman" footer={<><Button variant="outline" onClick={onClose}>Vazgeç</Button><Button onClick={kaydet} disabled={!gecerli}>Kaydet</Button></>}>
      <Field label="Kaynak kasa"><Select value={f.kaynak} onChange={(e) => setF({ ...f, kaynak: e.target.value })}>{kasalar.map((k) => <option key={k} value={k}>{kasaEtiket(k)}</option>)}</Select></Field>
      <Field label="Hedef kasa"><Select value={f.hedef} onChange={(e) => setF({ ...f, hedef: e.target.value })}>{kasalar.map((k) => <option key={k} value={k}>{kasaEtiket(k)}</option>)}</Select></Field>
      {f.kaynak === f.hedef && <Alert tone="warning">Kaynak ve hedef aynı olamaz.</Alert>}
      <Field label="Tutar (₺)"><Input inputMode="decimal" value={f.tutar} onChange={(e) => setF({ ...f, tutar: e.target.value })} /></Field>
      <Field label="Açıklama"><Input value={f.aciklama} onChange={(e) => setF({ ...f, aciklama: e.target.value })} /></Field>
    </Dialog>
  );
}

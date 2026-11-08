import * as React from "react";
import { Printer, Receipt, Search, Undo2 } from "lucide-react";
import { Badge, Button, Card, CardContent, CardDescription, CardHeader, CardTitle, Dialog, EmptyState, Field, Input, Select, Table, Td, Textarea, Th, toast } from "@/components/ui";
import { useApp, useOturum } from "@/context/AppContext";
import {
  BUGUN,
  aktifKayit,
  bildirimEkle,
  grupEtiket,
  guncelle,
  islemYaz,
  simdiZaman,
  sube,
  taksitAdi,
  tamAd,
  tanimlar,
  useDb,
  yeniId,
  type Db,
  type Tahsilat,
} from "@/data/store";
import { gecikmeGunu, tahsilatDagit, tl } from "@/lib/kurallar";
import { esc, yazdir } from "@/lib/yazdir";
import { cn } from "@/lib/utils";
import { kalan, kurusa, tutarCoz, yeniMakbuzNo, yontemAdlari, YONTEMLER } from "./kurallar";
import { KayitDurumEtiketi, tarihTR } from "./ortak";

/* ---------- Makbuz ---------- */
function makbuzYazdir(d: Db, liste: Tahsilat[]) {
  const ilk = liste[0];
  const v = d.veliler.find((x) => x.id === ilk.veliId);
  const s = sube(ilk.alinanSubeId);
  const satirlar = liste
    .flatMap((t) => t.dagilim.map((x) => ({ x, tk: d.taksitler.find((y) => y.id === x.taksitId) })))
    .map(({ x, tk }) => {
      const o = d.ogrenciler.find((y) => y.id === tk?.ogrenciId);
      return `<tr><td>${esc(tamAd(o))}</td><td>${tk ? taksitAdi(tk.no) : ""}</td><td>${tk ? tarihTR(tk.vade) : ""}</td><td class="sag">${tl(x.tutar)}</td></tr>`;
    })
    .join("");
  const toplam = liste.reduce((t, x) => t + kurusa(x.tutar), 0) / 100;
  return yazdir(
    `Makbuz ${ilk.makbuzNo}`,
    `<h1>Tahsilat Makbuzu</h1>
     <p class="kucuk">Makbuz no: <b>${esc(liste.map((x) => x.makbuzNo).join(", "))}</b> · ${new Date(ilk.zaman).toLocaleString("tr-TR")} · ${esc(s?.ad)}</p>
     <table><tr><th>Ödeyen</th><td>${esc(tamAd(v))} (${esc(v?.telefon)})</td><th>Yöntem</th><td>${yontemAdlari[ilk.yontem]}</td></tr></table>
     <table><tr><th>Öğrenci</th><th>Taksit</th><th>Vade</th><th class="sag">Tutar</th></tr>${satirlar}
     <tr><th colspan="3">Toplam</th><th class="sag">${tl(toplam)}</th></tr></table>
     <div class="imza"><div>Tahsil eden: ${esc(ilk.kullanici)}</div><div>Kaşe / imza</div></div>`,
    `${s?.ad} · ${s?.adres}`,
  );
}

/* ---------- Hızlı tahsilat + cari hesap ---------- */
export function HizliTahsilat({ baslangicVeli }: { baslangicVeli: string | null }) {
  const d = useDb();
  const { subeId } = useApp();
  const { subeGorunur, ad, rol, kapsam } = useOturum();
  const [ara, setAra] = React.useState("");
  const [veliId, setVeliId] = React.useState<string | null>(baslangicVeli);
  const [tutar, setTutar] = React.useState("");
  const [yontem, setYontem] = React.useState<Tahsilat["yontem"]>("nakit");
  const alinabilir = tanimlar().subeler.filter((s) => s.aktif && kapsam.includes(s.id));
  const [alinanSube, setAlinanSube] = React.useState(subeId !== "all" && kapsam.includes(subeId) ? subeId : (alinabilir[0]?.id ?? ""));
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
  // Kardeşlerin borçları veli bazında birlikte görülür (görülebilen şubelerde)
  const cocuklar = v ? d.ogrenciler.filter((o) => o.veliIds.includes(v.id)) : [];
  const cocukIds = new Set(cocuklar.map((o) => o.id));
  const acik = d.taksitler
    .filter((t) => cocukIds.has(t.ogrenciId) && kalan(t) > 0)
    .sort((a, b) => a.vade.localeCompare(b.vade) || a.no - b.no);
  const toplamBorc = acik.reduce((s, t) => s + kurusa(kalan(t)), 0) / 100;
  const vadesiGelen = acik.filter((t) => t.vade <= BUGUN).reduce((s, t) => s + kurusa(kalan(t)), 0) / 100;
  const gecmis = d.tahsilatlar
    .filter((t) => t.dagilim.some((x) => cocukIds.has(d.taksitler.find((tk) => tk.id === x.taksitId)?.ogrenciId ?? "")))
    .sort((a, b) => b.zaman.localeCompare(a.zaman));

  const sayi = tutarCoz(tutar);
  const onizleme = sayi > 0 ? tahsilatDagit(sayi, acik.map((t) => ({ id: t.id, kalan: kalan(t) }))) : null;
  const hata = !tutar.trim()
    ? null
    : Number.isNaN(sayi) || sayi <= 0
      ? "Tutar sıfırdan büyük, en fazla iki ondalıklı olmalı (örn. 1.250,50)."
      : kurusa(sayi) > kurusa(toplamBorc)
        ? `Tutar toplam borçtan (${tl(toplamBorc)}) fazla olamaz.`
        : !alinanSube
          ? "Tahsilatın alındığı şube seçilmeli."
          : null;

  React.useEffect(() => {
    if (v) setTutar(vadesiGelen > 0 ? String(vadesiGelen).replace(".", ",") : acik[0] ? String(kalan(acik[0])).replace(".", ",") : "");
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
      const nolar = x.tahsilatlar.map((t) => t.makbuzNo);
      for (const [sid, dagilim] of subeGruplari) {
        // Makbuz no şube koduna göre sıradaki numara; sunucu çakışmada yeniden numaralar
        const no = yeniMakbuzNo(sube(sid)?.kod ?? "SUB", nolar);
        nolar.push(no);
        const t: Tahsilat = {
          id: yeniId("th"), makbuzNo: no, zaman: simdiZaman(), veliId: v.id, subeId: sid, alinanSubeId: alinanSube, yontem,
          tutar: dagilim.reduce((s, z) => s + kurusa(z.tutar), 0) / 100, dagilim, iptal: null, kullanici: ad,
        };
        x.tahsilatlar.push(t);
        olusan.push(t);
      }
      x.taksitler = x.taksitler.map((t) => {
        const dg = onizleme.dagilim.find((z) => z.taksitId === t.id);
        return dg ? { ...t, odenen: (kurusa(t.odenen) + kurusa(dg.tutar)) / 100 } : t;
      });
      const ogr = cocuklar[0];
      if (ogr) bildirimEkle(x, "odemeAlindi", ogr.id, { tutar: tl(sayi), makbuz: olusan.map((z) => z.makbuzNo).join(", ") }, undefined, true);
      islemYaz(x, ad, "Tahsilat", `${tamAd(v)} — ${tl(sayi)} (${yontemAdlari[yontem]})`, alinanSube);
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
                      <Td>{o?.ad} <span className="text-xs text-muted-foreground">{sube(t.subeId)?.kod}</span> <KayitDurumEtiketi kayitId={t.kayitId} /></Td>
                      <Td>{taksitAdi(t.no)}</Td>
                      <Td className={cn("tabular-nums", t.vade < BUGUN && "text-danger")}>{tarihTR(t.vade)}{t.vade < BUGUN && ` · ${gecikmeGunu(t.vade, BUGUN)} gün`}</Td>
                      <Td className="text-right tabular-nums">{tl(kalan(t))}</Td>
                      <Td className="text-right tabular-nums font-medium text-success">{pay ? tl(pay) : ""}</Td>
                    </tr>
                  );
                })}
                {acik.length === 0 && (
                  <tr><Td colSpan={5} className="text-center text-muted-foreground">Açık taksit yok.</Td></tr>
                )}
              </tbody>
            </Table>
            {acik.length > 0 && (
              <CardContent className="grid gap-3 pt-4 sm:grid-cols-[1fr_1fr_1fr_auto] sm:items-end">
                <Field label="Tutar (₺)"><Input inputMode="decimal" value={tutar} onChange={(e) => setTutar(e.target.value)} /></Field>
                <Field label="Yöntem">
                  <Select value={yontem} onChange={(e) => setYontem(e.target.value as Tahsilat["yontem"])}>
                    {YONTEMLER.map((k) => <option key={k} value={k}>{yontemAdlari[k]}</option>)}
                  </Select>
                </Field>
                <Field label="Alındığı şube">
                  <Select value={alinanSube} onChange={(e) => setAlinanSube(e.target.value)}>
                    {alinabilir.map((s) => <option key={s.id} value={s.id}>{s.ad}</option>)}
                  </Select>
                </Field>
                <Button onClick={tahsilEt} disabled={!onizleme?.dagilim.length || !!hata}>
                  <Receipt /> Tahsil et
                </Button>
                {hata && <p className="text-sm text-danger sm:col-span-4">{hata}</p>}
                <p className="text-xs text-muted-foreground sm:col-span-4">
                  Ödeme en eski vadeli taksitten başlayarak dağıtılır; kısmi ödeme desteklenir, fazlası sonraki taksite aktarılır. Tahsilat
                  öğrencinin kayıtlı olduğu şubenin kasasına yazılır. Makbuz otomatik açılır.
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
                    <Td>{yontemAdlari[t.yontem]}</Td>
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

/** Tahsilat silinmez, değiştirilmez; yalnızca iptal edilir (gerekçe + kullanıcı kaydı). Kasada iptal günü ters kayıt olarak görünür. */
function TahsilatIptal({ t, onClose }: { t: Tahsilat; onClose: () => void }) {
  const { ad } = useOturum();
  const [neden, setNeden] = React.useState("");
  const iptal = () => {
    guncelle((x) => {
      x.tahsilatlar = x.tahsilatlar.map((y) => (y.id === t.id ? { ...y, iptal: { neden: neden.trim(), kullanici: ad, zaman: simdiZaman() } } : y));
      x.taksitler = x.taksitler.map((tk) => {
        const dg = t.dagilim.find((z) => z.taksitId === tk.id);
        return dg ? { ...tk, odenen: (kurusa(tk.odenen) - kurusa(dg.tutar)) / 100 } : tk;
      });
      islemYaz(x, ad, "Tahsilat iptali", `${t.makbuzNo} — ${tl(t.tutar)}. Neden: ${neden.trim()}`, t.subeId);
    });
    toast("Tahsilat iptal edildi; taksitler yeniden açıldı, kasaya ters kayıt düşüldü.");
    onClose();
  };
  return (
    <Dialog
      open
      onClose={onClose}
      title={`${t.makbuzNo} iptali`}
      description={`${tl(t.tutar)} · tahsilat silinmez, iptal olarak işaretlenir; kasada bugünün tarihiyle ters kayıt görünür. İptal geri alınamaz.`}
      footer={<><Button variant="outline" onClick={onClose}>Vazgeç</Button><Button variant="destructive" onClick={iptal} disabled={neden.trim().length < 3}>İptal et</Button></>}
    >
      <Field label="Gerekçe"><Textarea value={neden} onChange={(e) => setNeden(e.target.value)} /></Field>
    </Dialog>
  );
}

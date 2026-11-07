/**
 * Bölüm 06 · Ders programı
 * Doküman: docs/bolumler/06-ders-programi.md
 */
import * as React from "react";
import {
  AlertTriangle,
  CalendarDays,
  CalendarOff,
  ChevronLeft,
  ChevronRight,
  DoorOpen,
  Plus,
  Printer,
  Trash2,
  Users,
  User,
  XCircle,
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
  Checkbox,
  Dialog,
  EmptyState,
  Field,
  Input,
  PageHeader,
  Select,
  Table,
  Tabs,
  Td,
  Th,
  toast,
} from "@/components/ui";
import { useApp, useOturum } from "@/context/AppContext";
import { gunAdlari, gunKisa, type DersSaati } from "@/data/mock";
import { tanimlar } from "@/data/store";
import {
  BUGUN,
  bildirimEkle,
  ders,
  dersAdi,
  derslikAdi,
  grup,
  grupEtiket,
  grupOgrencileri,
  guncelle,
  islemYaz,
  oturumlar,
  personelAdi,
  saat,
  sube,
  useDb,
  yeniId,
  type Db,
  type ProgramSatiri,
} from "@/data/store";
import { cakismaBul, dakika, haftaBasi, haftaGunu, subeGecisUyarisi, tarihEkle, type Slot } from "@/lib/kurallar";
import { esc, yazdir } from "@/lib/yazdir";
import { cn } from "@/lib/utils";

type Gorunum = "grup" | "ogretmen" | "derslik";
const tarihKisa = (iso: string) => new Date(iso + "T00:00:00").toLocaleDateString("tr-TR", { day: "numeric", month: "short" });

function satirSlot(d: Db, p: ProgramSatiri): Slot {
  const h = saat(p.saatId)!;
  return { id: p.id, gun: p.gun, bas: dakika(h.baslangic), bit: dakika(h.bitis), ogretmenId: p.ogretmenId, derslikId: p.derslikId, grupId: p.grupId, subeId: grup(d, p.grupId)?.subeId ?? "" };
}

/** Belirli bir tarihte geçerli program satırları */
function gecerliSatirlar(d: Db, tarih: string) {
  return d.program.filter((p) => p.baslangic <= tarih && (!p.bitis || p.bitis >= tarih));
}

export default function DersProgrami() {
  const [sekme, setSekme] = React.useState<"program" | "tatil">("program");
  return (
    <div className="grid gap-6">
      <PageHeader code="06" title="Ders programı" description="Haftalık şablondan her gün için ders oturumları üretilir; yoklama bu oturumlara bağlanır." />
      <Tabs
        value={sekme}
        onChange={setSekme}
        items={[
          { value: "program", label: "Haftalık program", icon: <CalendarDays /> },
          { value: "tatil", label: "Tatil ve iptaller", icon: <CalendarOff /> },
        ]}
      />
      {sekme === "program" ? <HaftalikProgram /> : <TatilIptal />}
    </div>
  );
}

/* =========================== Haftalık program =========================== */
function HaftalikProgram() {
  const d = useDb();
  const { subeId } = useApp();
  const { grupGorunur, subeGorunur, ogretmenMi, personel, yetki, seciliSubeler } = useOturum();
  const duzenleyebilir = yetki("06") && !ogretmenMi;
  const [gorunum, setGorunum] = React.useState<Gorunum>(ogretmenMi ? "ogretmen" : "grup");
  const gruplar = d.gruplar.filter((g) => grupGorunur(g.id)).sort((a, b) => a.subeId.localeCompare(b.subeId) || a.seviye - b.seviye);
  const ogretmenler = d.personel.filter((p) => p.gorev === "ogretmen" && p.aktif && (ogretmenMi ? p.id === personel.id : p.subeIds.some((s) => subeGorunur(s))));
  const dersliklerim = tanimlar().derslikler.filter((x) => subeGorunur(x.subeId));
  const [secim, setSecim] = React.useState<Record<Gorunum, string>>({
    grup: gruplar[0]?.id ?? "",
    ogretmen: ogretmenMi ? personel.id : ogretmenler[0]?.id ?? "",
    derslik: dersliklerim[0]?.id ?? "",
  });
  const [hafta, setHafta] = React.useState(haftaBasi(BUGUN));
  const [duzenle, setDuzenle] = React.useState<{ satir?: ProgramSatiri; gun: number; saatId: string; grupId: string } | null>(null);

  // Şube seçici değişince seçimi kapsam içinde tut
  React.useEffect(() => {
    setSecim((s) => ({
      grup: gruplar.some((g) => g.id === s.grup) ? s.grup : gruplar[0]?.id ?? "",
      ogretmen: ogretmenler.some((o) => o.id === s.ogretmen) ? s.ogretmen : ogretmenler[0]?.id ?? "",
      derslik: dersliklerim.some((x) => x.id === s.derslik) ? s.derslik : dersliklerim[0]?.id ?? "",
    }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [subeId, d.gruplar.length]);

  const secili = secim[gorunum];
  const gunTarihi = (gun: number) => tarihEkle(hafta, gun - 1);

  const yazdirProgram = () => {
    const baslik =
      gorunum === "grup" ? `${grupEtiket(d, secili)} ders programı` : gorunum === "ogretmen" ? `${personelAdi(d, secili)} — öğretmen programı` : `${derslikAdi(secili)} — derslik programı`;
    const satirlar = gecerliSatirlar(d, gunTarihi(1))
      .filter((p) => (gorunum === "grup" ? p.grupId === secili : gorunum === "ogretmen" ? p.ogretmenId === secili : p.derslikId === secili))
      .sort((a, b) => a.gun - b.gun || dakika(saat(a.saatId)!.baslangic) - dakika(saat(b.saatId)!.baslangic));
    yazdir(
      baslik,
      `<h1>${esc(baslik)}</h1><p class="kucuk">${tarihKisa(hafta)} haftasından itibaren geçerli</p>
       <table><tr><th>Gün</th><th>Saat</th><th>Ders</th><th>Grup</th><th>Öğretmen</th><th>Şube / derslik</th></tr>
       ${satirlar.map((p) => `<tr><td>${gunAdlari[p.gun]}</td><td>${saat(p.saatId)!.baslangic}–${saat(p.saatId)!.bitis}</td><td>${esc(dersAdi(p.dersId))}</td><td>${esc(grupEtiket(d, p.grupId))}</td><td>${esc(personelAdi(d, p.ogretmenId))}</td><td>${esc(sube(grup(d, p.grupId)?.subeId)?.ad)} · ${esc(derslikAdi(p.derslikId))}</td></tr>`).join("")}
       </table>`,
    );
  };

  return (
    <div className="grid gap-4">
      <Card>
        <CardContent className="flex flex-wrap items-center gap-2 p-4">
          <div className="inline-flex rounded-md border p-0.5">
            {([
              ["grup", "Grup", <Users key="g" />],
              ["ogretmen", "Öğretmen", <User key="o" />],
              ["derslik", "Derslik", <DoorOpen key="d" />],
            ] as const).map(([k, a, ikon]) => (
              <button
                key={k}
                onClick={() => setGorunum(k)}
                disabled={ogretmenMi && k !== "ogretmen"}
                className={cn("flex items-center gap-1.5 rounded px-3 py-1.5 text-sm [&_svg]:size-4 disabled:opacity-40", gorunum === k ? "bg-accent font-medium text-accent-foreground" : "text-muted-foreground hover:text-foreground")}
              >
                {ikon}
                {a}
              </button>
            ))}
          </div>
          <Select aria-label="Seçim" className="w-52" value={secili} onChange={(e) => setSecim({ ...secim, [gorunum]: e.target.value })} disabled={ogretmenMi && gorunum === "ogretmen"}>
            {gorunum === "grup" && gruplar.map((g) => <option key={g.id} value={g.id}>{grupEtiket(d, g.id)}</option>)}
            {gorunum === "ogretmen" && ogretmenler.map((o) => <option key={o.id} value={o.id}>{o.ad} {o.soyad}</option>)}
            {gorunum === "derslik" && dersliklerim.map((x) => <option key={x.id} value={x.id}>{sube(x.subeId)?.kod} · {x.ad}</option>)}
          </Select>
          <div className="ml-auto flex items-center gap-1">
            <Button variant="ghost" size="icon" aria-label="Önceki hafta" onClick={() => setHafta(tarihEkle(hafta, -7))}><ChevronLeft /></Button>
            <button className="min-w-36 text-center text-sm font-medium" onClick={() => setHafta(haftaBasi(BUGUN))} title="Bu haftaya dön">
              {tarihKisa(hafta)} – {tarihKisa(tarihEkle(hafta, 6))}
            </button>
            <Button variant="ghost" size="icon" aria-label="Sonraki hafta" onClick={() => setHafta(tarihEkle(hafta, 7))}><ChevronRight /></Button>
            <Button variant="outline" size="sm" onClick={yazdirProgram} disabled={!secili}><Printer /> Yazdır</Button>
          </div>
        </CardContent>
      </Card>

      {!secili ? (
        <EmptyState icon={<CalendarDays />} title="Gösterilecek kayıt yok" text="Şube kapsamınızda grup, öğretmen veya derslik bulunamadı." />
      ) : gorunum === "ogretmen" ? (
        <OgretmenAjandasi ogretmenId={secili} hafta={hafta} />
      ) : (
        (["hafta-ici", "hafta-sonu"] as const).map((tip) => {
          const subeIdx = gorunum === "grup" ? grup(d, secili)?.subeId : tanimlar().derslikler.find((x) => x.id === secili)?.subeId;
          const saatler = tanimlar().dersSaatleri.filter((h) => h.subeId === subeIdx && h.gunTipi === tip).sort((a, b) => a.sira - b.sira);
          const gunler = tip === "hafta-ici" ? [1, 2, 3, 4, 5] : [6, 7];
          if (!saatler.length) return null;
          return (
            <Card key={tip}>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">{tip === "hafta-ici" ? "Hafta içi" : "Hafta sonu"}</CardTitle>
              </CardHeader>
              <div className="overflow-x-auto px-3 pb-3">
                <ProgramGrid
                  gunler={gunler}
                  saatler={saatler}
                  gorunum={gorunum}
                  secili={secili}
                  gunTarihi={gunTarihi}
                  duzenleyebilir={duzenleyebilir}
                  onHucre={(gun, saatId, satir) =>
                    duzenleyebilir && setDuzenle({ satir, gun, saatId, grupId: satir?.grupId ?? (gorunum === "grup" ? secili : "") })
                  }
                />
              </div>
            </Card>
          );
        })
      )}
      {gorunum !== "ogretmen" && secili && seciliSubeler.length > 0 && (
        <p className="text-xs text-muted-foreground">
          {duzenleyebilir
            ? "Boş hücreye tıklayıp ders ekleyin; dersi sürükleyip başka saate taşıyın. Değişiklik seçilen tarihten itibaren geçerli olur, geçmiş oturumlar etkilenmez."
            : "Programı yalnızca yönetim düzenleyebilir."}
        </p>
      )}
      {duzenle && <DersDialog {...duzenle} onClose={() => setDuzenle(null)} />}
    </div>
  );
}

function ProgramGrid({
  gunler,
  saatler,
  gorunum,
  secili,
  gunTarihi,
  duzenleyebilir,
  onHucre,
}: {
  gunler: number[];
  saatler: DersSaati[];
  gorunum: "grup" | "derslik";
  secili: string;
  gunTarihi: (gun: number) => string;
  duzenleyebilir: boolean;
  onHucre: (gun: number, saatId: string, satir?: ProgramSatiri) => void;
}) {
  const d = useDb();
  const { ad } = useOturum();
  const [surukle, setSurukle] = React.useState<string | null>(null);

  const tasi = (satirId: string, gun: number, saatId: string) => {
    const s = d.program.find((p) => p.id === satirId);
    if (!s || (s.gun === gun && s.saatId === saatId)) return;
    const yeni = { ...s, gun, saatId };
    const slot = satirSlot(d, yeni);
    const cak = cakismaBul(slot, gecerliSatirlar(d, gunTarihi(gun)).filter((p) => p.id !== s.id).map((p) => satirSlot(d, p)));
    if (cak.length) {
      toast(`Taşınamadı: ${cak[0].tur === "ogretmen" ? "öğretmen" : cak[0].tur === "derslik" ? "derslik" : "grup"} o saatte dolu.`, "hata");
      return;
    }
    guncelle((x) => {
      programDegistir(x, s, yeni, BUGUN);
      islemYaz(x, ad, "Program", `${grupEtiket(x, s.grupId)} ${dersAdi(s.dersId)}: ${gunKisa[s.gun]} → ${gunKisa[gun]} ${saat(saatId)?.baslangic}`, grup(x, s.grupId)?.subeId);
      bildirimGrubaDersDegisikligi(x, s.grupId, `${gunAdlari[gun]} ${saat(saatId)?.baslangic}`, dersAdi(s.dersId), "Ders saati değişti");
    });
    toast("Ders taşındı; grup velilerine bildirim gönderildi.");
  };

  return (
    <table className="w-full min-w-[640px] table-fixed border-separate border-spacing-1 text-sm">
      <thead>
        <tr>
          <th className="w-20" />
          {gunler.map((g) => {
            const t = gunTarihi(g);
            return (
              <th key={g} className={cn("rounded-md py-1.5 text-xs font-medium", t === BUGUN ? "bg-accent text-accent-foreground" : "text-muted-foreground")}>
                {gunAdlari[g]} <span className="font-normal">{tarihKisa(t)}</span>
              </th>
            );
          })}
        </tr>
      </thead>
      <tbody>
        {saatler.map((h) => (
          <tr key={h.id}>
            <td className="pr-1 text-right align-top text-xs tabular-nums text-muted-foreground">
              {h.baslangic}
              <br />
              {h.bitis}
            </td>
            {gunler.map((g) => {
              const t = gunTarihi(g);
              const satir = gecerliSatirlar(d, t).find((p) => p.gun === g && p.saatId === h.id && (gorunum === "grup" ? p.grupId === secili : p.derslikId === secili));
              const oturum = satir ? oturumlar(d, t).find((o) => o.satir.id === satir.id) : undefined;
              const tatil = d.tatiller.find((x) => x.tarih === t && (!x.subeId || x.subeId === h.subeId));
              const ds = satir ? ders(satir.dersId) : undefined;
              return (
                <td
                  key={g}
                  onDragOver={(e) => duzenleyebilir && !satir && e.preventDefault()}
                  onDrop={(e) => {
                    e.preventDefault();
                    if (surukle) tasi(surukle, g, h.id);
                    setSurukle(null);
                  }}
                  className="h-16 align-top"
                >
                  {satir && ds ? (
                    <button
                      draggable={duzenleyebilir}
                      onDragStart={() => setSurukle(satir.id)}
                      onClick={() => onHucre(g, h.id, satir)}
                      className={cn("relative h-full w-full overflow-hidden rounded-md border-l-4 p-1.5 text-left transition hover:brightness-95", (oturum?.iptal || tatil) && "opacity-50")}
                      style={{ borderLeftColor: ds.renk, background: `color-mix(in oklab, ${ds.renk} 12%, var(--color-card))` }}
                    >
                      <p className="truncate font-medium">{ds.ad}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {gorunum === "grup" ? personelAdi(d, satir.ogretmenId) : grupEtiket(d, satir.grupId)}
                      </p>
                      <p className="truncate text-xs text-muted-foreground">{gorunum === "grup" ? derslikAdi(satir.derslikId) : personelAdi(d, satir.ogretmenId)}</p>
                      {(oturum?.iptal || tatil) && (
                        <span className="absolute right-1 top-1 rounded bg-danger px-1 text-[10px] font-medium text-white">{tatil ? "Tatil" : "İptal"}</span>
                      )}
                    </button>
                  ) : (
                    <button
                      onClick={() => onHucre(g, h.id)}
                      disabled={!duzenleyebilir || gorunum !== "grup"}
                      className={cn(
                        "grid h-full w-full place-items-center rounded-md border border-dashed text-muted-foreground/0 transition",
                        duzenleyebilir && gorunum === "grup" && "hover:border-primary/50 hover:text-primary",
                        tatil && "bg-muted/60",
                      )}
                      aria-label={`${gunAdlari[g]} ${h.baslangic} ders ekle`}
                    >
                      {tatil ? <span className="text-[10px] text-muted-foreground">{tatil.ad}</span> : <Plus className="size-4" />}
                    </button>
                  )}
                </td>
              );
            })}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/** Değişiklik belirtilen tarihten itibaren geçerli; geçmiş oturumlar etkilenmez. */
function programDegistir(x: Db, eski: ProgramSatiri, yeni: ProgramSatiri | null, gecerlilik: string) {
  if (eski.baslangic >= gecerlilik) {
    x.program = yeni ? x.program.map((p) => (p.id === eski.id ? { ...yeni, id: eski.id } : p)) : x.program.filter((p) => p.id !== eski.id);
    return;
  }
  x.program = x.program.map((p) => (p.id === eski.id ? { ...p, bitis: tarihEkle(gecerlilik, -1) } : p));
  if (yeni) x.program.push({ ...yeni, id: yeniId("ps"), baslangic: gecerlilik, bitis: null });
}

function bildirimGrubaDersDegisikligi(x: Db, grupId: string, zaman: string, dersAd: string, neden: string) {
  for (const o of grupOgrencileri(x, grupId))
    bildirimEkle(x, "dersIptal", o.id, { tarih: "yeni saat", saat: zaman, ders: dersAd, neden: neden.toLocaleLowerCase("tr-TR") }, undefined, true);
}

function DersDialog({ satir, gun, saatId, grupId, onClose }: { satir?: ProgramSatiri; gun: number; saatId: string; grupId: string; onClose: () => void }) {
  const d = useDb();
  const { ad } = useOturum();
  const g = grup(d, grupId)!;
  const h = saat(saatId)!;
  const [form, setForm] = React.useState({
    dersId: satir?.dersId ?? tanimlar().dersler.find((x) => x.aktif)!.id,
    ogretmenId: satir?.ogretmenId ?? "",
    derslikId: satir?.derslikId ?? g.derslikId,
    gecerlilik: BUGUN,
    gecisOnay: false,
    bildir: true,
  });
  const ogretmenler = d.personel.filter((p) => p.gorev === "ogretmen" && p.aktif && p.subeIds.includes(g.subeId));
  const uygun = ogretmenler.filter((p) => p.dersIds.includes(form.dersId));
  const yeni: ProgramSatiri = { id: satir?.id ?? "yeni", grupId, gun, saatId, dersId: form.dersId, ogretmenId: form.ogretmenId, derslikId: form.derslikId, baslangic: form.gecerlilik, bitis: null };
  const mevcut = gecerliSatirlar(d, form.gecerlilik).filter((p) => p.id !== satir?.id).map((p) => satirSlot(d, p));
  const slot = satirSlot(d, yeni);
  const cakismalar = form.ogretmenId ? cakismaBul(slot, mevcut) : [];
  const gecisler = form.ogretmenId ? subeGecisUyarisi(slot, mevcut, d.ayarlar.subeGecisDk) : [];
  const engel = !form.ogretmenId || cakismalar.length > 0 || (gecisler.length > 0 && !form.gecisOnay);

  const kaydet = () => {
    if (engel) return;
    guncelle((x) => {
      if (satir) programDegistir(x, satir, yeni, form.gecerlilik);
      else x.program.push({ ...yeni, id: yeniId("ps") });
      islemYaz(x, ad, "Program", `${grupEtiket(x, grupId)}: ${gunKisa[gun]} ${h.baslangic} ${dersAdi(form.dersId)} (${personelAdi(x, form.ogretmenId)})`, g.subeId);
      if (satir && form.bildir) bildirimGrubaDersDegisikligi(x, grupId, `${gunAdlari[gun]} ${h.baslangic}`, dersAdi(form.dersId), "Ders programı güncellendi");
    });
    // İlk geçerli oturum tarihi: geçerlilik başlangıcından sonraki ilk aynı gün
    let ilk = form.gecerlilik;
    while (haftaGunu(ilk) !== gun) ilk = tarihEkle(ilk, 1);
    toast(`${satir ? "Program güncellendi" : "Ders eklendi"}; ${tarihKisa(ilk)} ${gunAdlari[gun]} gününden itibaren geçerli.`);
    onClose();
  };
  const sil = () => {
    if (!satir) return;
    guncelle((x) => {
      programDegistir(x, satir, null, form.gecerlilik);
      islemYaz(x, ad, "Program", `${grupEtiket(x, grupId)}: ${gunKisa[gun]} ${h.baslangic} ${dersAdi(satir.dersId)} kaldırıldı`, g.subeId);
    });
    toast("Ders programdan kaldırıldı.");
    onClose();
  };

  const turAd = { ogretmen: "Öğretmen", derslik: "Derslik", grup: "Grup" };
  return (
    <Dialog
      open
      onClose={onClose}
      title={satir ? "Dersi düzenle" : "Ders ekle"}
      description={`${grupEtiket(d, grupId)} · ${gunAdlari[gun]} ${h.baslangic}–${h.bitis}`}
      footer={
        <>
          {satir && <Button variant="ghost" className="mr-auto text-danger" onClick={sil}><Trash2 /> Kaldır</Button>}
          <Button variant="outline" onClick={onClose}>Vazgeç</Button>
          <Button onClick={kaydet} disabled={engel}>Kaydet</Button>
        </>
      }
    >
      <Field label="Ders">
        <Select value={form.dersId} onChange={(e) => setForm({ ...form, dersId: e.target.value, ogretmenId: "" })}>
          {tanimlar().dersler.filter((x) => x.aktif).map((x) => <option key={x.id} value={x.id}>{x.ad}</option>)}
        </Select>
      </Field>
      <Field label="Öğretmen" hint={uygun.length === 0 ? "Bu şubede bu dersi veren öğretmen yok; tüm öğretmenler listelendi." : undefined}>
        <Select value={form.ogretmenId} onChange={(e) => setForm({ ...form, ogretmenId: e.target.value, gecisOnay: false })}>
          <option value="">Seçiniz</option>
          {(uygun.length ? uygun : ogretmenler).map((p) => <option key={p.id} value={p.id}>{p.ad} {p.soyad}</option>)}
        </Select>
      </Field>
      <Field label="Derslik">
        <Select value={form.derslikId} onChange={(e) => setForm({ ...form, derslikId: e.target.value })}>
          {tanimlar().derslikler.filter((x) => x.subeId === g.subeId).map((x) => <option key={x.id} value={x.id}>{x.ad} ({x.kapasite})</option>)}
        </Select>
      </Field>
      <Field label="Geçerlilik başlangıcı" hint="Değişiklik bu tarihten itibaren uygulanır; geçmiş oturumlar ve yoklamalar korunur.">
        <Input type="date" value={form.gecerlilik} min={BUGUN} onChange={(e) => setForm({ ...form, gecerlilik: e.target.value || BUGUN })} />
      </Field>
      {cakismalar.map((c, i) => {
        const p = d.program.find((x) => x.id === c.slot.id)!;
        return (
          <Alert key={i} tone="danger" icon={<XCircle />}>
            <b>{turAd[c.tur]} çakışması:</b> {grupEtiket(d, p.grupId)} · {dersAdi(p.dersId)} · {personelAdi(d, p.ogretmenId)} · {derslikAdi(p.derslikId)}
          </Alert>
        );
      })}
      {gecisler.map((s) => {
        const p = d.program.find((x) => x.id === s.id)!;
        return (
          <Alert key={s.id} tone="warning" icon={<AlertTriangle />}>
            <p>
              <b>Şubeler arası geçiş:</b> öğretmenin {sube(s.subeId)?.ad} şubesinde {saat(p.saatId)?.baslangic}–{saat(p.saatId)?.bitis} dersi var; arada {d.ayarlar.subeGecisDk} dakikadan az süre kalıyor.
            </p>
            <div className="mt-2"><Checkbox checked={form.gecisOnay} onChange={(v) => setForm({ ...form, gecisOnay: v })} label="Yine de kaydet" /></div>
          </Alert>
        );
      })}
      {satir && <Checkbox checked={form.bildir} onChange={(v) => setForm({ ...form, bildir: v })} label="Grup velilerine değişiklik bildirimi gönder" />}
    </Dialog>
  );
}

function OgretmenAjandasi({ ogretmenId, hafta }: { ogretmenId: string; hafta: string }) {
  const d = useDb();
  const gunler = [1, 2, 3, 4, 5, 6, 7];
  const toplamDk = gecerliSatirlar(d, hafta).filter((p) => p.ogretmenId === ogretmenId).reduce((s, p) => s + dakika(saat(p.saatId)!.bitis) - dakika(saat(p.saatId)!.baslangic), 0);
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{personelAdi(d, ogretmenId)}</CardTitle>
        <CardDescription>Tüm şubeler birlikte · haftalık {Math.round(toplamDk / 40)} ders ({Math.round((toplamDk / 60) * 10) / 10} saat)</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7">
        {gunler.map((g) => {
          const t = tarihEkle(hafta, g - 1);
          const liste = oturumlar(d, t).filter((o) => o.satir.ogretmenId === ogretmenId);
          const slotlar = liste.map((o) => satirSlot(d, o.satir));
          return (
            <div key={g} className={cn("rounded-lg border p-2", t === BUGUN && "border-primary/50 bg-accent/30")}>
              <p className="mb-2 text-xs font-medium text-muted-foreground">{gunAdlari[g]} · {tarihKisa(t)}</p>
              <div className="grid gap-1.5">
                {liste.length === 0 && <p className="py-2 text-center text-xs text-muted-foreground">—</p>}
                {liste.map((o, i) => {
                  const ds = ders(o.satir.dersId)!;
                  const gecis = subeGecisUyarisi(slotlar[i], slotlar, d.ayarlar.subeGecisDk).length > 0;
                  return (
                    <div key={o.id} className={cn("rounded-md border-l-4 p-1.5 text-xs", (o.iptal || o.tatil) && "opacity-50 line-through")} style={{ borderLeftColor: ds.renk, background: `color-mix(in oklab, ${ds.renk} 10%, var(--color-card))` }}>
                      <p className="font-medium tabular-nums">{o.bas}–{o.bit}</p>
                      <p>{ds.ad} · {grupEtiket(d, o.satir.grupId)}</p>
                      <p className="text-muted-foreground">{sube(o.subeId)?.ad} · {derslikAdi(o.satir.derslikId)}</p>
                      {gecis && <p className="mt-0.5 flex items-center gap-1 text-warning"><AlertTriangle className="size-3" /> Şube geçişi kısa</p>}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}

/* =========================== Tatil ve iptaller =========================== */
function TatilIptal() {
  const d = useDb();
  const { subeGorunur, grupGorunur, ad, rol, kapsam, ogretmenMi } = useOturum();
  const [tatilAcik, setTatilAcik] = React.useState(false);
  const [iptalAcik, setIptalAcik] = React.useState(false);
  const tatiller = d.tatiller.filter((t) => !t.subeId || subeGorunur(t.subeId)).sort((a, b) => a.tarih.localeCompare(b.tarih));
  const iptaller = d.iptaller.filter((i) => grupGorunur(d.program.find((p) => i.oturumId.startsWith(p.id + "_"))?.grupId ?? "")).sort((a, b) => b.tarih.localeCompare(a.tarih));
  const tatilSil = (id: string) =>
    guncelle((x) => {
      x.tatiller = x.tatiller.filter((t) => t.id !== id);
      islemYaz(x, ad, "Takvim", "Tatil günü kaldırıldı");
    });

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <div>
            <CardTitle className="text-base">Tatil günleri</CardTitle>
            <CardDescription className="mt-1">Resmi tatiller kurum genelinde, şubeye özel kapanışlar şube bazında.</CardDescription>
          </div>
          {!ogretmenMi && <Button size="sm" onClick={() => setTatilAcik(true)}><Plus /> Ekle</Button>}
        </CardHeader>
        <Table>
          <thead><tr><Th>Tarih</Th><Th>Ad</Th><Th>Kapsam</Th><Th>Etkilenen ders</Th><Th /></tr></thead>
          <tbody>
            {tatiller.map((t) => (
              <tr key={t.id} className={cn(t.tarih < BUGUN && "text-muted-foreground")}>
                <Td className="whitespace-nowrap tabular-nums">{tarihKisa(t.tarih)}</Td>
                <Td>{t.ad}</Td>
                <Td>{t.subeId ? <Badge variant="outline">{sube(t.subeId)?.kod}</Badge> : <Badge>Tüm şubeler</Badge>}</Td>
                <Td className="tabular-nums">{oturumlar(d, t.tarih).filter((o) => o.tatil?.id === t.id).length}</Td>
                <Td className="text-right">
                  {(rol === "genel-yonetici" || (t.subeId && kapsam.includes(t.subeId))) && !ogretmenMi && (
                    <Button variant="ghost" size="icon" aria-label="Kaldır" onClick={() => tatilSil(t.id)}><Trash2 /></Button>
                  )}
                </Td>
              </tr>
            ))}
          </tbody>
        </Table>
      </Card>
      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <div>
            <CardTitle className="text-base">Ders iptalleri ve telafiler</CardTitle>
            <CardDescription className="mt-1">İptalde grubun velilerine otomatik bildirim gider.</CardDescription>
          </div>
          {!ogretmenMi && <Button size="sm" onClick={() => setIptalAcik(true)}><XCircle /> Ders iptal et</Button>}
        </CardHeader>
        <Table>
          <thead><tr><Th>Ders</Th><Th>Neden</Th><Th>Telafi</Th></tr></thead>
          <tbody>
            {iptaller.map((i) => {
              const [pid, tarih] = i.oturumId.split("_");
              const p = d.program.find((x) => x.id === pid);
              return (
                <tr key={i.oturumId}>
                  <Td>
                    <p className="font-medium">{p ? `${grupEtiket(d, p.grupId)} · ${dersAdi(p.dersId)}` : "—"}</p>
                    <p className="text-xs text-muted-foreground">{tarihKisa(tarih)} {p && saat(p.saatId)?.baslangic}</p>
                  </Td>
                  <Td>{i.neden}</Td>
                  <Td className="tabular-nums">{i.telafi ? tarihKisa(i.telafi) : "—"}</Td>
                </tr>
              );
            })}
            {iptaller.length === 0 && <tr><Td colSpan={3} className="text-center text-muted-foreground">İptal yok.</Td></tr>}
          </tbody>
        </Table>
      </Card>
      <TatilDialog open={tatilAcik} onClose={() => setTatilAcik(false)} />
      <IptalDialog open={iptalAcik} onClose={() => setIptalAcik(false)} />
    </div>
  );
}

function TatilDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { ad, rol, kapsam } = useOturum();
  const [f, setF] = React.useState({ tarih: tarihEkle(BUGUN, 7), ad: "", subeId: rol === "genel-yonetici" ? "" : kapsam[0] });
  const kaydet = () => {
    if (!f.ad.trim()) return;
    guncelle((x) => {
      x.tatiller.push({ id: yeniId("t"), tarih: f.tarih, ad: f.ad.trim(), subeId: f.subeId || null });
      islemYaz(x, ad, "Takvim", `${f.tarih} ${f.ad} tatil olarak eklendi`, f.subeId || null);
    });
    toast("Tatil eklendi. Velilere duyuru göndermeyi unutmayın (Bölüm 10).");
    onClose();
  };
  return (
    <Dialog open={open} onClose={onClose} title="Tatil / kapanış ekle" footer={<><Button variant="outline" onClick={onClose}>Vazgeç</Button><Button onClick={kaydet} disabled={!f.ad.trim()}>Ekle</Button></>}>
      <Field label="Tarih"><Input type="date" value={f.tarih} onChange={(e) => setF({ ...f, tarih: e.target.value })} /></Field>
      <Field label="Ad"><Input placeholder="Ara tatil, tadilat…" value={f.ad} onChange={(e) => setF({ ...f, ad: e.target.value })} /></Field>
      <Field label="Kapsam">
        <Select value={f.subeId} onChange={(e) => setF({ ...f, subeId: e.target.value })}>
          {rol === "genel-yonetici" && <option value="">Tüm şubeler (resmi tatil)</option>}
          {tanimlar().subeler.filter((s) => kapsam.includes(s.id)).map((s) => <option key={s.id} value={s.id}>{s.ad}</option>)}
        </Select>
      </Field>
    </Dialog>
  );
}

function IptalDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const d = useDb();
  const { grupGorunur, ad } = useOturum();
  const [tarih, setTarih] = React.useState(BUGUN);
  const [oturumId, setOturumId] = React.useState("");
  const [neden, setNeden] = React.useState("");
  const [telafi, setTelafi] = React.useState("");
  const liste = oturumlar(d, tarih).filter((o) => grupGorunur(o.satir.grupId) && !o.iptal && !o.tatil && !d.yoklamalar[o.id]);
  const secili = liste.find((o) => o.id === oturumId);
  const kaydet = () => {
    if (!secili || !neden.trim()) return;
    let n = 0;
    guncelle((x) => {
      x.iptaller.push({ oturumId: secili.id, neden: neden.trim(), tarih: BUGUN, telafi: telafi || undefined });
      for (const o of grupOgrencileri(x, secili.satir.grupId))
        n += bildirimEkle(x, "dersIptal", o.id, {
          tarih: tarihKisa(tarih), saat: secili.bas, ders: dersAdi(secili.satir.dersId),
          neden: `iptal edilmiştir (${neden.trim()})` + (telafi ? `, telafi dersi ${tarihKisa(telafi)}` : ""),
        });
      islemYaz(x, ad, "Ders iptali", `${grupEtiket(x, secili.satir.grupId)} ${tarih} ${secili.bas} — ${neden}`, secili.subeId);
    });
    toast(`Ders iptal edildi; ${n} veliye bildirim gönderildi.`);
    setOturumId("");
    setNeden("");
    setTelafi("");
    onClose();
  };
  return (
    <Dialog open={open} onClose={onClose} title="Ders iptali" description="Tek seferlik iptal; haftalık şablon değişmez." footer={<><Button variant="outline" onClick={onClose}>Vazgeç</Button><Button variant="destructive" onClick={kaydet} disabled={!secili || !neden.trim()}>İptal et ve bildir</Button></>}>
      <Field label="Tarih"><Input type="date" value={tarih} min={BUGUN} onChange={(e) => { setTarih(e.target.value || BUGUN); setOturumId(""); }} /></Field>
      <Field label="Ders" hint={liste.length === 0 ? "Bu tarihte iptal edilebilecek ders yok (yoklaması alınmış tanimlar().dersler iptal edilemez)." : undefined}>
        <Select value={oturumId} onChange={(e) => setOturumId(e.target.value)}>
          <option value="">Seçiniz</option>
          {liste.map((o) => <option key={o.id} value={o.id}>{o.bas} · {grupEtiket(d, o.satir.grupId)} · {dersAdi(o.satir.dersId)} ({personelAdi(d, o.satir.ogretmenId)})</option>)}
        </Select>
      </Field>
      <Field label="Neden"><Input placeholder="Öğretmen rahatsız" value={neden} onChange={(e) => setNeden(e.target.value)} /></Field>
      <Field label="Telafi tarihi (isteğe bağlı)"><Input type="date" value={telafi} min={tarih} onChange={(e) => setTelafi(e.target.value)} /></Field>
    </Dialog>
  );
}

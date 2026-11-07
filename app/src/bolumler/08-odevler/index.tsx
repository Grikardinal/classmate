/**
 * Bölüm 08 · Ödev takibi (v2) — Ödev modülü açıkken görünür
 * Doküman: docs/bolumler/08-odev-takibi.md
 */
import * as React from "react";
import { BarChart3, BellRing, BookOpenCheck, CheckCheck, ClipboardList, Paperclip, Plus, Trash2 } from "lucide-react";
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
  Sheet,
  StatCard,
  Table,
  Tabs,
  Td,
  Textarea,
  Th,
  toast,
} from "@/components/ui";
import { useOturum } from "@/context/AppContext";
import { tanimlar } from "@/data/store";
import {
  BUGUN,
  bildirimEkle,
  ders,
  dersAdi,
  grupEtiket,
  grupOgrencileri,
  guncelle,
  islemYaz,
  personelAdi,
  tamAd,
  useDb,
  yeniId,
  type Odev,
  type TeslimDurumu,
} from "@/data/store";
import { tarihEkle } from "@/lib/kurallar";
import { cn } from "@/lib/utils";

const tarihKisa = (iso: string) => new Date(iso + "T00:00:00").toLocaleDateString("tr-TR", { day: "numeric", month: "short" });
const teslimSecenek: { key: TeslimDurumu; ad: string; sinif: string }[] = [
  { key: "yapti", ad: "Yaptı", sinif: "bg-success text-white" },
  { key: "eksik", ad: "Eksik", sinif: "bg-warning text-white" },
  { key: "yapmadi", ad: "Yapmadı", sinif: "bg-danger text-white" },
];

function hedefOgrenciler(d: ReturnType<typeof useDb>, o: Odev) {
  const g = grupOgrencileri(d, o.grupId);
  return o.ogrenciIds ? g.filter((x) => o.ogrenciIds!.includes(x.id)) : g;
}

export default function Odevler() {
  const [sekme, setSekme] = React.useState<"liste" | "oran">("liste");
  const [yeni, setYeni] = React.useState(false);
  const { ogretmenMi, yetki } = useOturum();
  return (
    <div className="grid gap-6">
      <PageHeader
        code="08"
        title="Ödevler"
        description="Öğretmenin verdiği ödevi veli görür; teslim durumu derste hızlıca işaretlenir. Puanlama yok."
        actions={(ogretmenMi || yetki("08")) && <Button onClick={() => setYeni(true)}><Plus /> Yeni ödev</Button>}
      />
      <Tabs
        value={sekme}
        onChange={setSekme}
        items={[
          { value: "liste", label: "Ödevler", icon: <ClipboardList /> },
          { value: "oran", label: "Teslim oranları", icon: <BarChart3 /> },
        ]}
      />
      {sekme === "liste" ? <OdevListesi /> : <TeslimOranlari />}
      <YeniOdev open={yeni} onClose={() => setYeni(false)} />
    </div>
  );
}

function OdevListesi() {
  const d = useDb();
  const { grupGorunur, ogretmenMi, personel, ad } = useOturum();
  const [filtre, setFiltre] = React.useState<"aktif" | "kontrol" | "bitti" | "all">("all");
  const [kontrol, setKontrol] = React.useState<string | null>(null);
  const odevler = d.odevler
    .filter((o) => grupGorunur(o.grupId) && (!ogretmenMi || o.ogretmenId === personel.id))
    .filter((o) => {
      if (filtre === "aktif") return o.teslim >= BUGUN && !o.kontrolEdildi;
      if (filtre === "kontrol") return o.teslim <= BUGUN && !o.kontrolEdildi;
      if (filtre === "bitti") return o.kontrolEdildi;
      return true;
    })
    .sort((a, b) => b.teslim.localeCompare(a.teslim));
  const kontrolBekleyen = d.odevler.filter((o) => grupGorunur(o.grupId) && (!ogretmenMi || o.ogretmenId === personel.id) && o.teslim <= BUGUN && !o.kontrolEdildi).length;
  const yarin = d.odevler.filter((o) => grupGorunur(o.grupId) && o.teslim === tarihEkle(BUGUN, 1));

  const hatirlat = () => {
    let n = 0;
    guncelle((x) => {
      for (const o of yarin) for (const ogr of hedefOgrenciler(x, o)) n += bildirimEkle(x, "odevHatirlatma", ogr.id, { ders: dersAdi(o.dersId), baslik: o.baslik }, undefined, true);
      islemYaz(x, ad, "Ödev hatırlatma", `${yarin.length} ödev için hatırlatma gönderildi`);
    });
    toast(`${n} veliye “yarın teslim” hatırlatması gönderildi.`);
  };
  const sil = (o: Odev) =>
    guncelle((x) => {
      x.odevler = x.odevler.filter((y) => y.id !== o.id);
      islemYaz(x, ad, "Ödev silindi", `${grupEtiket(x, o.grupId)} — ${o.baslik}`);
    });

  return (
    <div className="grid gap-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Aktif ödev" value={d.odevler.filter((o) => grupGorunur(o.grupId) && o.teslim >= BUGUN && !o.kontrolEdildi).length} icon={<BookOpenCheck />} />
        <StatCard label="Kontrol bekleyen" value={kontrolBekleyen} icon={<CheckCheck />} tone={kontrolBekleyen ? "warning" : "default"} onClick={() => setFiltre("kontrol")} />
        <StatCard label="Yarın teslim" value={yarin.length} icon={<BellRing />} />
        <StatCard label="Bu ay verilen" value={d.odevler.filter((o) => grupGorunur(o.grupId) && o.verilis.startsWith(BUGUN.slice(0, 7))).length} />
      </div>
      {yarin.length > 0 && (
        <Alert icon={<BellRing />}>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span>Teslimden 1 gün önce velilere otomatik hatırlatma gider (her akşam 19:00). Yarın teslim: {yarin.map((o) => o.baslik).join(", ")}</span>
            <Button size="sm" variant="outline" onClick={hatirlat}>Şimdi gönder</Button>
          </div>
        </Alert>
      )}
      <div className="flex gap-2">
        <Select aria-label="Filtre" className="w-52" value={filtre} onChange={(e) => setFiltre(e.target.value as typeof filtre)}>
          <option value="all">Tüm ödevler</option>
          <option value="aktif">Teslimi gelmemiş</option>
          <option value="kontrol">Kontrol bekleyen</option>
          <option value="bitti">Kontrol edilmiş</option>
        </Select>
      </div>
      {odevler.length === 0 ? (
        <EmptyState icon={<BookOpenCheck />} title="Ödev yok" text="Bu filtreye uyan ödev bulunamadı." />
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {odevler.map((o) => {
            const hedef = hedefOgrenciler(d, o);
            const t = Object.values(o.teslimler);
            const ds = ders(o.dersId);
            const bekliyor = o.teslim <= BUGUN && !o.kontrolEdildi;
            return (
              <Card key={o.id} className={cn(bekliyor && "border-warning/40")}>
                <CardHeader>
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-xs font-medium" style={{ color: ds?.renk }}>{ds?.ad} · {grupEtiket(d, o.grupId)}{o.ogrenciIds && ` · ${o.ogrenciIds.length} öğrenci`}</p>
                      <CardTitle className="mt-1 text-base">{o.baslik}</CardTitle>
                    </div>
                    {o.kontrolEdildi ? <Badge variant="success">Kontrol edildi</Badge> : bekliyor ? <Badge variant="warning">Kontrol bekliyor</Badge> : <Badge>Teslim {tarihKisa(o.teslim)}</Badge>}
                  </div>
                </CardHeader>
                <CardContent className="grid gap-3 text-sm">
                  <p className="text-muted-foreground">{o.aciklama}</p>
                  {o.kaynak && <p className="flex items-center gap-1.5"><Paperclip className="size-3.5" /> {o.kaynak}</p>}
                  {o.kontrolEdildi && (
                    <div className="flex h-2 overflow-hidden rounded-full bg-muted">
                      {teslimSecenek.map((s) => (
                        <div key={s.key} className={s.sinif.split(" ")[0]} style={{ width: `${(t.filter((x) => x === s.key).length / Math.max(1, hedef.length)) * 100}%` }} title={s.ad} />
                      ))}
                    </div>
                  )}
                  <div className="flex items-center justify-between border-t pt-3">
                    <span className="text-xs text-muted-foreground">{personelAdi(d, o.ogretmenId)} · verildi {tarihKisa(o.verilis)}</span>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" aria-label="Sil" onClick={() => sil(o)}><Trash2 /></Button>
                      <Button size="sm" variant={bekliyor ? "default" : "outline"} onClick={() => setKontrol(o.id)}>Teslim kontrol</Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
      {kontrol && <TeslimKontrol id={kontrol} onClose={() => setKontrol(null)} />}
    </div>
  );
}

function TeslimKontrol({ id, onClose }: { id: string; onClose: () => void }) {
  const d = useDb();
  const { ad } = useOturum();
  const o = d.odevler.find((x) => x.id === id)!;
  const ogrenciler = hedefOgrenciler(d, o);
  const [durum, setDurum] = React.useState<Record<string, TeslimDurumu>>(() => Object.fromEntries(ogrenciler.map((x) => [x.id, o.teslimler[x.id] ?? "yapti"])));
  const [notlar, setNotlar] = React.useState<Record<string, string>>(o.notlar);
  const kaydet = () => {
    let n = 0;
    guncelle((x) => {
      x.odevler = x.odevler.map((y) => (y.id === id ? { ...y, teslimler: durum, notlar, kontrolEdildi: true } : y));
      for (const [ogrId, s] of Object.entries(durum))
        if (s === "yapmadi" && o.teslimler[ogrId] !== "yapmadi") n += bildirimEkle(x, "odevYapmadi", ogrId, { ders: dersAdi(o.dersId), baslik: o.baslik }, undefined, true);
      islemYaz(x, ad, "Ödev kontrolü", `${grupEtiket(x, o.grupId)} — ${o.baslik}`);
    });
    toast(n ? `Kaydedildi; ${n} veliye “ödev yapılmadı” bilgisi gönderildi.` : "Teslim durumu kaydedildi.");
    onClose();
  };
  return (
    <Sheet
      open
      onClose={onClose}
      title={o.baslik}
      description={`${grupEtiket(d, o.grupId)} · teslim ${tarihKisa(o.teslim)}`}
      footer={<><Button variant="outline" onClick={onClose}>Vazgeç</Button><Button onClick={kaydet}><CheckCheck /> Kaydet</Button></>}
    >
      <div className="mb-3 flex justify-end">
        <Button variant="ghost" size="sm" onClick={() => setDurum(Object.fromEntries(ogrenciler.map((x) => [x.id, "yapti" as TeslimDurumu])))}>Hepsi yaptı</Button>
      </div>
      <ul className="divide-y rounded-lg border">
        {ogrenciler.map((x) => (
          <li key={x.id} className="grid gap-2 p-3">
            <div className="flex items-center gap-3">
              <Avatar ad={tamAd(x)} className="size-8" />
              <span className="min-w-0 flex-1 truncate font-medium">{tamAd(x)}</span>
              <div className="flex gap-1">
                {teslimSecenek.map((s) => (
                  <button
                    key={s.key}
                    onClick={() => setDurum({ ...durum, [x.id]: s.key })}
                    aria-pressed={durum[x.id] === s.key}
                    className={cn("h-8 rounded-md border px-2.5 text-xs font-medium", durum[x.id] === s.key ? s.sinif + " border-transparent" : "text-muted-foreground hover:bg-muted")}
                  >
                    {s.ad}
                  </button>
                ))}
              </div>
            </div>
            {durum[x.id] !== "yapti" && (
              <Input placeholder="Kısa geri bildirim (veli görür)" value={notlar[x.id] ?? ""} onChange={(e) => setNotlar({ ...notlar, [x.id]: e.target.value })} />
            )}
          </li>
        ))}
      </ul>
    </Sheet>
  );
}

function YeniOdev({ open, onClose }: { open: boolean; onClose: () => void }) {
  const d = useDb();
  const { grupGorunur, ogretmenMi, personel, ad } = useOturum();
  const gruplar = d.gruplar.filter((g) => grupGorunur(g.id));
  const bos = () => ({
    grupId: gruplar[0]?.id ?? "",
    dersId: (ogretmenMi && personel.dersIds[0]) || tanimlar().dersler[1].id,
    tumGrup: true,
    secili: [] as string[],
    baslik: "",
    aciklama: "",
    kaynak: "",
    teslim: tarihEkle(BUGUN, 3),
    dosya: "",
  });
  const [f, setF] = React.useState(bos);
  const ogrenciler = f.grupId ? grupOgrencileri(d, f.grupId) : [];
  const gecerli = f.grupId && f.baslik.trim() && f.teslim >= BUGUN && (f.tumGrup || f.secili.length > 0);

  const kaydet = () => {
    if (!gecerli) return;
    let n = 0;
    guncelle((x) => {
      const odev: Odev = {
        id: yeniId("od"), ogretmenId: ogretmenMi ? personel.id : x.program.find((p) => p.grupId === f.grupId && p.dersId === f.dersId)?.ogretmenId ?? personel.id,
        dersId: f.dersId, grupId: f.grupId, ogrenciIds: f.tumGrup ? null : f.secili, baslik: f.baslik.trim(), aciklama: f.aciklama.trim(),
        kaynak: [f.kaynak.trim(), f.dosya].filter(Boolean).join(" · "), verilis: BUGUN, teslim: f.teslim, teslimler: {}, notlar: {}, kontrolEdildi: false,
      };
      x.odevler.push(odev);
      for (const o of f.tumGrup ? ogrenciler : ogrenciler.filter((y) => f.secili.includes(y.id)))
        n += bildirimEkle(x, "yeniOdev", o.id, { ders: dersAdi(f.dersId), baslik: odev.baslik, teslim: tarihKisa(f.teslim) }, undefined, true);
      islemYaz(x, ad, "Ödev", `${grupEtiket(x, f.grupId)} — ${odev.baslik}`);
    });
    toast(`Ödev verildi; ${n} veliye bildirim gönderildi.`);
    setF(bos());
    onClose();
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      wide
      title="Yeni ödev"
      footer={<><Button variant="outline" onClick={onClose}>Vazgeç</Button><Button onClick={kaydet} disabled={!gecerli}>Ödevi ver</Button></>}
    >
      <div className="grid gap-3 sm:grid-cols-3">
        <Field label="Grup">
          <Select value={f.grupId} onChange={(e) => setF({ ...f, grupId: e.target.value, secili: [] })}>
            {gruplar.map((g) => <option key={g.id} value={g.id}>{grupEtiket(d, g.id)}</option>)}
          </Select>
        </Field>
        <Field label="Ders">
          <Select value={f.dersId} onChange={(e) => setF({ ...f, dersId: e.target.value })}>
            {tanimlar().dersler.filter((x) => x.aktif).map((x) => <option key={x.id} value={x.id}>{x.ad}</option>)}
          </Select>
        </Field>
        <Field label="Teslim tarihi"><Input type="date" min={BUGUN} value={f.teslim} onChange={(e) => setF({ ...f, teslim: e.target.value })} /></Field>
      </div>
      <Field label="Başlık"><Input value={f.baslik} onChange={(e) => setF({ ...f, baslik: e.target.value })} placeholder="Kesirler alıştırması" /></Field>
      <Field label="Açıklama"><Textarea className="min-h-16" value={f.aciklama} onChange={(e) => setF({ ...f, aciklama: e.target.value })} /></Field>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Kaynak"><Input value={f.kaynak} onChange={(e) => setF({ ...f, kaynak: e.target.value })} placeholder="Kitap s. 42–48" /></Field>
        <Field label="Ek dosya / fotoğraf"><Input type="file" className="pt-1.5" onChange={(e) => setF({ ...f, dosya: e.target.files?.[0]?.name ?? "" })} /></Field>
      </div>
      <div className="grid gap-2">
        <Checkbox checked={f.tumGrup} onChange={(v) => setF({ ...f, tumGrup: v })} label="Tüm gruba ver" />
        {!f.tumGrup && (
          <div className="grid max-h-40 gap-1.5 overflow-y-auto rounded-md border p-3 sm:grid-cols-2">
            {ogrenciler.map((o) => (
              <Checkbox key={o.id} checked={f.secili.includes(o.id)} onChange={(v) => setF({ ...f, secili: v ? [...f.secili, o.id] : f.secili.filter((x) => x !== o.id) })} label={tamAd(o)} />
            ))}
          </div>
        )}
      </div>
    </Dialog>
  );
}

function TeslimOranlari() {
  const d = useDb();
  const { grupGorunur } = useOturum();
  const odevler = d.odevler.filter((o) => grupGorunur(o.grupId));
  const ozet = (liste: Odev[]) => {
    const t = liste.filter((o) => o.kontrolEdildi).flatMap((o) => Object.values(o.teslimler));
    return { verilen: liste.length, kontrol: liste.filter((o) => o.kontrolEdildi).length, oran: t.length ? t.filter((x) => x === "yapti").length / t.length : 0, eksik: t.filter((x) => x === "eksik").length, yapmadi: t.filter((x) => x === "yapmadi").length };
  };
  const ogretmenler = [...new Set(odevler.map((o) => o.ogretmenId))];
  const gruplar = [...new Set(odevler.map((o) => o.grupId))];
  const Satir = ({ ad, o }: { ad: string; o: ReturnType<typeof ozet> }) => (
    <tr>
      <Td className="font-medium">{ad}</Td>
      <Td className="text-right tabular-nums">{o.verilen}</Td>
      <Td className="text-right tabular-nums">{o.kontrol}</Td>
      <Td className="text-right tabular-nums">{o.eksik}</Td>
      <Td className="text-right tabular-nums">{o.yapmadi}</Td>
      <Td className="text-right tabular-nums font-medium">%{Math.round(o.oran * 100)}</Td>
    </tr>
  );
  const Baslik = ({ ilk }: { ilk: string }) => (
    <thead><tr><Th>{ilk}</Th><Th className="text-right">Verilen</Th><Th className="text-right">Kontrol</Th><Th className="text-right">Eksik</Th><Th className="text-right">Yapmadı</Th><Th className="text-right">Tam teslim</Th></tr></thead>
  );
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card>
        <CardHeader><CardTitle className="text-base">Öğretmen bazında</CardTitle><CardDescription>Verilen ödev sayısı ve teslim oranları</CardDescription></CardHeader>
        <Table><Baslik ilk="Öğretmen" /><tbody>{ogretmenler.map((p) => <Satir key={p} ad={personelAdi(d, p)} o={ozet(odevler.filter((o) => o.ogretmenId === p))} />)}</tbody></Table>
      </Card>
      <Card>
        <CardHeader><CardTitle className="text-base">Grup bazında</CardTitle></CardHeader>
        <Table><Baslik ilk="Grup" /><tbody>{gruplar.map((g) => <Satir key={g} ad={grupEtiket(d, g)} o={ozet(odevler.filter((o) => o.grupId === g))} />)}</tbody></Table>
      </Card>
    </div>
  );
}

/**
 * Bölüm 09 · Etüt ve birebir (özel) ders (v2) — Etüt modülü açıkken görünür
 * Doküman: docs/bolumler/09-etut-ve-birebir-ders.md
 */
import * as React from "react";
import { CalendarClock, ChevronLeft, ChevronRight, Clock, Package, Plus, Trash2, Video, CalendarRange, ListChecks, BellRing } from "lucide-react";
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
  StatCard,
  Table,
  Tabs,
  Td,
  Th,
  toast,
} from "@/components/ui";
import { useApp, useOturum } from "@/context/AppContext";
import { gunAdlari, gunKisa } from "@/data/mock";
import { tanimlar } from "@/data/store";
import {
  BUGUN,
  SIMDI,
  aktifKayit,
  bildirimEkle,
  dersAdi,
  guncelle,
  islemYaz,
  personelAdi,
  sube,
  tamAd,
  useDb,
  yeniId,
  type Db,
  type EtutTuru,
  type Musaitlik,
  type Randevu,
} from "@/data/store";
import { dakika, haftaBasi, haftaGunu, tarihEkle, tl } from "@/lib/kurallar";
import { cn } from "@/lib/utils";

export const etutTurAd: Record<EtutTuru, string> = { bireysel: "Bireysel etüt", grup: "Grup etüdü", online: "Online etüt", ozel: "Özel ders" };
const durumRozet: Record<Randevu["durum"], { ad: string; v: "default" | "success" | "danger" | "secondary" }> = {
  planli: { ad: "Planlı", v: "default" },
  yapildi: { ad: "Yapıldı", v: "success" },
  gelmedi: { ad: "Gelmedi", v: "danger" },
  iptal: { ad: "İptal", v: "secondary" },
};
const SLOT_DK = 40;
const tarihKisa = (iso: string) => new Date(iso + "T00:00:00").toLocaleDateString("tr-TR", { day: "numeric", month: "short" });
const hhmm = (dk: number) => `${String(Math.floor(dk / 60)).padStart(2, "0")}:${String(dk % 60).padStart(2, "0")}`;

/** Öğretmenin bir tarihteki boş etüt slotları (müsaitlik − dolu randevular) */
export function bosSlotlar(d: Db, tarih: string, ogretmenId?: string, subeId?: string) {
  const gun = haftaGunu(tarih);
  const sonuc: { m: Musaitlik; bas: string; bit: string }[] = [];
  for (const m of d.musaitlikler.filter((x) => x.gun === gun && (!ogretmenId || x.ogretmenId === ogretmenId) && (!subeId || x.subeId === subeId))) {
    if (d.tatiller.some((t) => t.tarih === tarih && (!t.subeId || t.subeId === m.subeId))) continue;
    for (let s = dakika(m.bas); s + SLOT_DK <= dakika(m.bit); s += SLOT_DK) {
      const bas = hhmm(s);
      const bit = hhmm(s + SLOT_DK);
      const dolu = d.randevular.some((r) => r.ogretmenId === m.ogretmenId && r.tarih === tarih && r.durum !== "iptal" && dakika(r.bas) < s + SLOT_DK && s < dakika(r.bit));
      const gecmis = tarih < BUGUN || (tarih === BUGUN && bas <= SIMDI);
      if (!dolu && !gecmis) sonuc.push({ m, bas, bit });
    }
  }
  return sonuc;
}

export default function Etut() {
  const [sekme, setSekme] = React.useState<"takvim" | "randevu" | "musait" | "paket">("takvim");
  return (
    <div className="grid gap-6">
      <PageHeader code="09" title="Etüt ve birebir ders" description="Öğretmen müsaitliği şube ile girilir; yönetim veya veli portalından boş slotlara randevu alınır." />
      <Tabs
        value={sekme}
        onChange={setSekme}
        items={[
          { value: "takvim", label: "Takvim", icon: <CalendarRange /> },
          { value: "randevu", label: "Randevular", icon: <ListChecks /> },
          { value: "musait", label: "Müsaitlik", icon: <Clock /> },
          { value: "paket", label: "Özel ders paketleri", icon: <Package /> },
        ]}
      />
      {sekme === "takvim" && <Takvim />}
      {sekme === "randevu" && <Randevular />}
      {sekme === "musait" && <Musaitlikler />}
      {sekme === "paket" && <Paketler />}
    </div>
  );
}

/* ---------- Takvim ---------- */
function Takvim() {
  const d = useDb();
  const { subeGorunur, ogretmenMi, personel } = useOturum();
  const [hafta, setHafta] = React.useState(haftaBasi(BUGUN));
  const [ogretmenId, setOgretmenId] = React.useState(ogretmenMi ? personel.id : "all");
  const [yeni, setYeni] = React.useState<{ m: Musaitlik; tarih: string; bas: string; bit: string } | null>(null);
  const ogretmenler = d.personel.filter((p) => d.musaitlikler.some((m) => m.ogretmenId === p.id && subeGorunur(m.subeId)));
  const gunler = [1, 2, 3, 4, 5, 6, 7].map((g) => tarihEkle(hafta, g - 1));

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <Select aria-label="Öğretmen" className="w-48" value={ogretmenId} disabled={ogretmenMi} onChange={(e) => setOgretmenId(e.target.value)}>
          <option value="all">Tüm öğretmenler</option>
          {ogretmenler.map((p) => <option key={p.id} value={p.id}>{p.ad} {p.soyad}</option>)}
        </Select>
        <div className="ml-auto flex items-center gap-1">
          <Button variant="ghost" size="icon" aria-label="Önceki hafta" onClick={() => setHafta(tarihEkle(hafta, -7))}><ChevronLeft /></Button>
          <span className="min-w-36 text-center text-sm font-medium">{tarihKisa(hafta)} – {tarihKisa(tarihEkle(hafta, 6))}</span>
          <Button variant="ghost" size="icon" aria-label="Sonraki hafta" onClick={() => setHafta(tarihEkle(hafta, 7))}><ChevronRight /></Button>
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7">
        {gunler.map((t) => {
          const randevular = d.randevular
            .filter((r) => r.tarih === t && subeGorunur(r.subeId) && (ogretmenId === "all" || r.ogretmenId === ogretmenId))
            .sort((a, b) => a.bas.localeCompare(b.bas));
          const bos = bosSlotlar(d, t, ogretmenId === "all" ? undefined : ogretmenId).filter((s) => subeGorunur(s.m.subeId));
          return (
            <div key={t} className={cn("rounded-lg border bg-card p-2", t === BUGUN && "border-primary/50")}>
              <p className="mb-2 text-xs font-medium text-muted-foreground">{gunKisa[haftaGunu(t)]} · {tarihKisa(t)}</p>
              <div className="grid gap-1.5">
                {randevular.map((r) => (
                  <div key={r.id} className={cn("rounded-md border-l-4 bg-accent/40 p-1.5 text-xs", r.durum === "iptal" && "opacity-50 line-through")} style={{ borderLeftColor: "var(--color-primary)" }}>
                    <p className="font-medium tabular-nums">{r.bas}–{r.bit} {r.tur === "online" && <Video className="inline size-3" />}</p>
                    <p className="truncate">{r.ogrenciIds.map((id) => d.ogrenciler.find((o) => o.id === id)?.ad).join(", ")}</p>
                    <p className="truncate text-muted-foreground">{personelAdi(d, r.ogretmenId)} · {sube(r.subeId)?.kod}</p>
                  </div>
                ))}
                {bos.map((s) => (
                  <button
                    key={`${s.m.id}${s.bas}`}
                    onClick={() => setYeni({ m: s.m, tarih: t, bas: s.bas, bit: s.bit })}
                    className="rounded-md border border-dashed p-1.5 text-left text-xs text-muted-foreground transition hover:border-primary hover:text-primary"
                  >
                    <span className="tabular-nums">{s.bas}</span> · boş · {d.personel.find((p) => p.id === s.m.ogretmenId)?.ad}
                  </button>
                ))}
                {!randevular.length && !bos.length && <p className="py-2 text-center text-xs text-muted-foreground">—</p>}
              </div>
            </div>
          );
        })}
      </div>
      <p className="text-xs text-muted-foreground">Boş slota tıklayarak randevu oluşturun. Randevudan 1 saat önce veli ve öğretmene otomatik hatırlatma gider.</p>
      {yeni && <RandevuDialog {...yeni} onClose={() => setYeni(null)} />}
    </div>
  );
}

function RandevuDialog({ m, tarih, bas, bit, onClose }: { m: Musaitlik; tarih: string; bas: string; bit: string; onClose: () => void }) {
  const d = useDb();
  const { ad } = useOturum();
  const ogretmen = d.personel.find((p) => p.id === m.ogretmenId)!;
  const [tur, setTur] = React.useState<EtutTuru>("bireysel");
  const [secili, setSecili] = React.useState<string[]>([]);
  const [ara, setAra] = React.useState("");
  const [dersId, setDersId] = React.useState(ogretmen.dersIds[0] ?? tanimlar().dersler[1].id);
  const [link, setLink] = React.useState("");
  const adaylar = d.ogrenciler
    .filter((o) => o.durum === "aktif" && aktifKayit(d, o.id)?.subeId === m.subeId)
    .filter((o) => !ara || tamAd(o).toLocaleLowerCase("tr").includes(ara.toLocaleLowerCase("tr")))
    .slice(0, 30);
  const paket = secili.length === 1 ? d.paketler.find((p) => p.ogrenciId === secili[0] && p.ogretmenId === m.ogretmenId && p.kalan > 0) : undefined;
  const coklu = tur === "grup";
  const gecerli = secili.length > 0 && (coklu || secili.length === 1) && (tur !== "online" || /^https?:\/\//.test(link)) && (tur !== "ozel" || !!paket);

  const kaydet = () => {
    if (!gecerli) return;
    guncelle((x) => {
      x.randevular.push({ id: yeniId("r"), ogretmenId: m.ogretmenId, subeId: m.subeId, tarih, bas, bit, tur, ogrenciIds: secili, dersId, durum: "planli", link, paketId: tur === "ozel" || paket ? paket?.id ?? null : null, olusturan: "yonetim" });
      for (const o of secili) bildirimEkle(x, "etutHatirlatma", o, { tarih: tarihKisa(tarih), saat: bas, ogretmen: tamAd(ogretmen) }, undefined, true);
      islemYaz(x, ad, "Etüt randevusu", `${tarih} ${bas} ${tamAd(ogretmen)} — ${secili.length} öğrenci`, m.subeId);
    });
    toast("Randevu oluşturuldu; veliye onay bildirimi gönderildi.");
    onClose();
  };

  return (
    <Dialog
      open
      onClose={onClose}
      title="Etüt randevusu"
      description={`${tamAd(ogretmen)} · ${gunAdlari[haftaGunu(tarih)]} ${tarihKisa(tarih)} ${bas}–${bit} · ${sube(m.subeId)?.ad}`}
      footer={<><Button variant="outline" onClick={onClose}>Vazgeç</Button><Button onClick={kaydet} disabled={!gecerli}>Oluştur</Button></>}
    >
      <div className="grid grid-cols-2 gap-3">
        <Field label="Tür">
          <Select value={tur} onChange={(e) => { setTur(e.target.value as EtutTuru); if (e.target.value !== "grup") setSecili(secili.slice(0, 1)); }}>
            {Object.entries(etutTurAd).map(([k, a]) => <option key={k} value={k}>{a}</option>)}
          </Select>
        </Field>
        <Field label="Ders">
          <Select value={dersId} onChange={(e) => setDersId(e.target.value)}>
            {tanimlar().dersler.filter((x) => x.aktif).map((x) => <option key={x.id} value={x.id}>{x.ad}</option>)}
          </Select>
        </Field>
      </div>
      {tur === "online" && <Field label="Görüşme linki (Zoom / Meet)"><Input placeholder="https://meet.google.com/…" value={link} onChange={(e) => setLink(e.target.value)} /></Field>}
      <Field label={coklu ? "Öğrenciler (küçük grup)" : "Öğrenci"}>
        <Input placeholder="Ara" value={ara} onChange={(e) => setAra(e.target.value)} />
      </Field>
      <div className="grid max-h-48 gap-1.5 overflow-y-auto rounded-md border p-3">
        {adaylar.map((o) => (
          <Checkbox
            key={o.id}
            checked={secili.includes(o.id)}
            onChange={(v) => setSecili(v ? (coklu ? [...secili, o.id] : [o.id]) : secili.filter((x) => x !== o.id))}
            label={tamAd(o)}
            description={d.paketler.some((p) => p.ogrenciId === o.id && p.ogretmenId === m.ogretmenId && p.kalan > 0) ? "Özel ders paketi var" : undefined}
          />
        ))}
      </div>
      {paket && <Alert icon={<Package />}>Özel ders paketinden düşülecek: kalan {paket.kalan}/{paket.toplam}</Alert>}
      {tur === "ozel" && secili.length === 1 && !paket && <Alert tone="warning">Bu öğrencinin bu öğretmenle aktif özel ders paketi yok. “Özel ders paketleri” sekmesinden paket tanımlayın.</Alert>}
    </Dialog>
  );
}

/* ---------- Randevular ---------- */
function Randevular() {
  const d = useDb();
  const { subeGorunur, ogretmenMi, personel, ad } = useOturum();
  const [filtre, setFiltre] = React.useState<"gelecek" | "gecmis" | "all">("gelecek");
  const liste = d.randevular
    .filter((r) => subeGorunur(r.subeId) && (!ogretmenMi || r.ogretmenId === personel.id))
    .filter((r) => (filtre === "gelecek" ? r.tarih >= BUGUN : filtre === "gecmis" ? r.tarih < BUGUN : true))
    .sort((a, b) => (filtre === "gecmis" ? b.tarih.localeCompare(a.tarih) : a.tarih.localeCompare(b.tarih)) || a.bas.localeCompare(b.bas));

  const durumDegistir = (r: Randevu, durum: Randevu["durum"]) => {
    guncelle((x) => {
      x.randevular = x.randevular.map((y) => (y.id === r.id ? { ...y, durum } : y));
      // Paket hakkı: yapıldıysa düşer; gelmediyse kurum ayarına göre düşer
      const dus = r.paketId && r.durum === "planli" && (durum === "yapildi" || (durum === "gelmedi" && x.ayarlar.gelmeyenHakDussun));
      if (dus) x.paketler = x.paketler.map((p) => (p.id === r.paketId ? { ...p, kalan: Math.max(0, p.kalan - 1) } : p));
      islemYaz(x, ad, "Etüt", `${r.tarih} ${r.bas} randevu: ${durumRozet[durum].ad}`, r.subeId);
    });
    toast(`Randevu “${durumRozet[durum].ad}” olarak işaretlendi.`);
  };

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between">
        <CardTitle className="text-base">Randevular</CardTitle>
        <Select aria-label="Filtre" className="w-40" value={filtre} onChange={(e) => setFiltre(e.target.value as typeof filtre)}>
          <option value="gelecek">Yaklaşan</option>
          <option value="gecmis">Geçmiş</option>
          <option value="all">Tümü</option>
        </Select>
      </CardHeader>
      {liste.length === 0 ? (
        <CardContent><EmptyState icon={<CalendarClock />} title="Randevu yok" text="Takvimden boş slota tıklayarak randevu oluşturun." /></CardContent>
      ) : (
        <Table>
          <thead><tr><Th>Tarih</Th><Th>Öğrenci</Th><Th>Öğretmen</Th><Th>Tür</Th><Th>Durum</Th><Th className="text-right">İşlem</Th></tr></thead>
          <tbody>
            {liste.map((r) => (
              <tr key={r.id}>
                <Td className="whitespace-nowrap tabular-nums">{tarihKisa(r.tarih)} {r.bas}</Td>
                <Td>
                  {r.ogrenciIds.map((id) => tamAd(d.ogrenciler.find((o) => o.id === id))).join(", ")}
                  {r.olusturan === "veli" && <Badge variant="outline" className="ml-2">Veli aldı</Badge>}
                </Td>
                <Td>{personelAdi(d, r.ogretmenId)} <span className="text-xs text-muted-foreground">· {dersAdi(r.dersId)}</span></Td>
                <Td>{etutTurAd[r.tur]} {r.link && <a className="ml-1 text-primary underline" href={r.link} target="_blank" rel="noreferrer">link</a>}</Td>
                <Td><Badge variant={durumRozet[r.durum].v}>{durumRozet[r.durum].ad}</Badge></Td>
                <Td className="text-right">
                  {r.durum === "planli" && (
                    <div className="flex justify-end gap-1">
                      {r.tarih <= BUGUN && <Button size="sm" variant="outline" onClick={() => durumDegistir(r, "yapildi")}>Yapıldı</Button>}
                      {r.tarih <= BUGUN && <Button size="sm" variant="ghost" onClick={() => durumDegistir(r, "gelmedi")}>Gelmedi</Button>}
                      <Button size="sm" variant="ghost" className="text-danger" onClick={() => durumDegistir(r, "iptal")}>İptal</Button>
                    </div>
                  )}
                </Td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}
      <CardContent className="pt-4 text-xs text-muted-foreground">
        Veli, randevuyu en geç {d.ayarlar.etutIptalSaat} saat öncesine kadar portaldan iptal edebilir. Gelmeyen öğrencinin özel ders hakkı {d.ayarlar.gelmeyenHakDussun ? "düşer" : "düşmez"} (kurum ayarı, Bölüm 14).
      </CardContent>
    </Card>
  );
}

/* ---------- Müsaitlik ---------- */
function Musaitlikler() {
  const d = useDb();
  const { subeGorunur, ogretmenMi, personel, kapsam, ad } = useOturum();
  const ogretmenler = d.personel.filter((p) => p.gorev === "ogretmen" && p.aktif && (ogretmenMi ? p.id === personel.id : p.subeIds.some((s) => subeGorunur(s))));
  const [f, setF] = React.useState({ ogretmenId: ogretmenler[0]?.id ?? "", subeId: "", gun: 1, bas: "14:00", bit: "16:00" });
  const ogr = d.personel.find((p) => p.id === f.ogretmenId);
  const subeSecenek = tanimlar().subeler.filter((s) => ogr?.subeIds.includes(s.id) && kapsam.includes(s.id));
  const subeId = f.subeId || subeSecenek[0]?.id || "";
  const gecerli = f.ogretmenId && subeId && dakika(f.bit) - dakika(f.bas) >= SLOT_DK;
  const liste = d.musaitlikler.filter((m) => subeGorunur(m.subeId) && (!ogretmenMi || m.ogretmenId === personel.id)).sort((a, b) => a.gun - b.gun || a.bas.localeCompare(b.bas));

  const ekle = () => {
    if (!gecerli) return;
    const cakisan = d.musaitlikler.some((m) => m.ogretmenId === f.ogretmenId && m.gun === f.gun && dakika(m.bas) < dakika(f.bit) && dakika(f.bas) < dakika(m.bit));
    if (cakisan) return toast("Bu öğretmenin o gün çakışan bir müsaitliği var.", "hata");
    guncelle((x) => {
      x.musaitlikler.push({ id: yeniId("mu"), ogretmenId: f.ogretmenId, subeId, gun: f.gun, bas: f.bas, bit: f.bit });
      islemYaz(x, ad, "Müsaitlik", `${personelAdi(x, f.ogretmenId)} ${gunKisa[f.gun]} ${f.bas}–${f.bit} ${sube(subeId)?.kod}`, subeId);
    });
    toast("Müsaitlik eklendi.");
  };
  const sil = (id: string) => guncelle((x) => { x.musaitlikler = x.musaitlikler.filter((m) => m.id !== id); });

  return (
    <div className="grid gap-4 lg:grid-cols-[22rem_1fr]">
      <Card className="self-start">
        <CardHeader><CardTitle className="text-base">Müsaitlik ekle</CardTitle><CardDescription>Örn. Salı 17–19, Merkez</CardDescription></CardHeader>
        <CardContent className="grid gap-3">
          <Field label="Öğretmen">
            <Select value={f.ogretmenId} disabled={ogretmenMi} onChange={(e) => setF({ ...f, ogretmenId: e.target.value, subeId: "" })}>
              {ogretmenler.map((p) => <option key={p.id} value={p.id}>{p.ad} {p.soyad}</option>)}
            </Select>
          </Field>
          <Field label="Şube">
            <Select value={subeId} onChange={(e) => setF({ ...f, subeId: e.target.value })}>
              {subeSecenek.map((s) => <option key={s.id} value={s.id}>{s.ad}</option>)}
            </Select>
          </Field>
          <Field label="Gün">
            <Select value={f.gun} onChange={(e) => setF({ ...f, gun: Number(e.target.value) })}>
              {[1, 2, 3, 4, 5, 6, 7].map((g) => <option key={g} value={g}>{gunAdlari[g]}</option>)}
            </Select>
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Başlangıç"><Input type="time" value={f.bas} onChange={(e) => setF({ ...f, bas: e.target.value })} /></Field>
            <Field label="Bitiş"><Input type="time" value={f.bit} onChange={(e) => setF({ ...f, bit: e.target.value })} /></Field>
          </div>
          {!gecerli && f.ogretmenId && <p className="text-xs text-danger">Süre en az {SLOT_DK} dakika olmalı.</p>}
          <Button onClick={ekle} disabled={!gecerli}><Plus /> Ekle</Button>
        </CardContent>
      </Card>
      <Card>
        <Table>
          <thead><tr><Th>Öğretmen</Th><Th>Gün</Th><Th>Saat</Th><Th>Şube</Th><Th className="text-right">Slot</Th><Th /></tr></thead>
          <tbody>
            {liste.map((m) => (
              <tr key={m.id}>
                <Td className="font-medium">{personelAdi(d, m.ogretmenId)}</Td>
                <Td>{gunAdlari[m.gun]}</Td>
                <Td className="tabular-nums">{m.bas}–{m.bit}</Td>
                <Td>{sube(m.subeId)?.ad}</Td>
                <Td className="text-right tabular-nums">{Math.floor((dakika(m.bit) - dakika(m.bas)) / SLOT_DK)}</Td>
                <Td className="text-right"><Button variant="ghost" size="icon" aria-label="Sil" onClick={() => sil(m.id)}><Trash2 /></Button></Td>
              </tr>
            ))}
          </tbody>
        </Table>
      </Card>
    </div>
  );
}

/* ---------- Paketler ---------- */
function Paketler() {
  const d = useDb();
  const { moduller } = useApp();
  const { subeGorunur, ad } = useOturum();
  const [acik, setAcik] = React.useState(false);
  const liste = d.paketler.filter((p) => subeGorunur(aktifKayit(d, p.ogrenciId)?.subeId));
  const bitiyor = liste.filter((p) => p.kalan <= 1);
  const bilgiVer = () => {
    guncelle((x) => {
      for (const p of bitiyor) bildirimEkle(x, "duyuru", p.ogrenciId, { baslik: "Özel ders paketi", metin: `${dersAdi(p.dersId)} paketinizde ${p.kalan} ders hakkı kaldı.` }, undefined, true);
      islemYaz(x, ad, "Paket bildirimi", `${bitiyor.length} veliye paket bitiyor bilgisi`);
    });
    toast(`${bitiyor.length} veliye “paket bitmek üzere” bilgisi gönderildi.`);
  };
  return (
    <div className="grid gap-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
        <StatCard label="Aktif paket" value={liste.filter((p) => p.kalan > 0).length} icon={<Package />} />
        <StatCard label="Kalan toplam hak" value={liste.reduce((s, p) => s + p.kalan, 0)} />
        <StatCard label="Bitmek üzere" value={bitiyor.length} tone={bitiyor.length ? "warning" : "default"} />
      </div>
      {bitiyor.length > 0 && (
        <Alert tone="warning" icon={<BellRing />}>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span>{bitiyor.map((p) => tamAd(d.ogrenciler.find((o) => o.id === p.ogrenciId))).join(", ")} — paket bitmek üzere.</span>
            <Button size="sm" variant="outline" onClick={bilgiVer}>Veliye bilgi ver</Button>
          </div>
        </Alert>
      )}
      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <CardTitle className="text-base">Özel ders paketleri</CardTitle>
          <Button size="sm" onClick={() => setAcik(true)}><Plus /> Paket tanımla</Button>
        </CardHeader>
        <Table>
          <thead><tr><Th>Öğrenci</Th><Th>Ders / öğretmen</Th><Th>Başlangıç</Th>{moduller.finans && <Th className="text-right">Ücret</Th>}<Th className="w-48">Kalan hak</Th></tr></thead>
          <tbody>
            {liste.map((p) => (
              <tr key={p.id}>
                <Td className="font-medium">{tamAd(d.ogrenciler.find((o) => o.id === p.ogrenciId))}</Td>
                <Td>{dersAdi(p.dersId)} · {personelAdi(d, p.ogretmenId)}</Td>
                <Td className="tabular-nums">{tarihKisa(p.tarih)}</Td>
                {moduller.finans && <Td className="text-right tabular-nums">{tl(p.fiyat)}</Td>}
                <Td>
                  <div className="flex items-center gap-2">
                    <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted"><div className={cn("h-full rounded-full", p.kalan <= 1 ? "bg-warning" : "bg-primary")} style={{ width: `${(p.kalan / p.toplam) * 100}%` }} /></div>
                    <span className="w-10 text-right text-xs tabular-nums">{p.kalan}/{p.toplam}</span>
                  </div>
                </Td>
              </tr>
            ))}
          </tbody>
        </Table>
      </Card>
      <PaketDialog open={acik} onClose={() => setAcik(false)} />
    </div>
  );
}

function PaketDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const d = useDb();
  const { moduller } = useApp();
  const { subeGorunur, ad } = useOturum();
  const ogrenciler = d.ogrenciler.filter((o) => o.durum === "aktif" && subeGorunur(aktifKayit(d, o.id)?.subeId)).sort((a, b) => a.ad.localeCompare(b.ad, "tr"));
  const ogretmenler = d.personel.filter((p) => p.gorev === "ogretmen" && p.aktif);
  const [f, setF] = React.useState({ ogrenciId: "", ogretmenId: ogretmenler[0]?.id ?? "", dersId: ogretmenler[0]?.dersIds[0] ?? "l2", toplam: 8, fiyat: 3600 });
  const gecerli = f.ogrenciId && f.ogretmenId && f.toplam > 0;
  const kaydet = () => {
    if (!gecerli) return;
    guncelle((x) => {
      x.paketler.push({ id: yeniId("pk"), ogrenciId: f.ogrenciId, ogretmenId: f.ogretmenId, dersId: f.dersId, toplam: f.toplam, kalan: f.toplam, fiyat: moduller.finans ? f.fiyat : 0, tarih: BUGUN });
      // Finans açıksa paket satışı öğrencinin ödeme planına ek kalem olarak düşer
      if (moduller.finans && f.fiyat > 0) {
        const k = aktifKayit(x, f.ogrenciId)!;
        const o = x.ogrenciler.find((y) => y.id === f.ogrenciId)!;
        x.taksitler.push({ id: yeniId("tk"), kayitId: k.id, ogrenciId: o.id, veliId: o.birincilVeliId, subeId: k.subeId, no: 99, vade: BUGUN, tutar: f.fiyat, odenen: 0 });
      }
      islemYaz(x, ad, "Özel ders paketi", `${tamAd(x.ogrenciler.find((o) => o.id === f.ogrenciId))} — ${f.toplam} ders`);
    });
    toast(moduller.finans ? "Paket tanımlandı; ücret ödeme planına eklendi." : "Paket tanımlandı.");
    onClose();
  };
  return (
    <Dialog open={open} onClose={onClose} title="Özel ders paketi" description={moduller.finans ? "Paket ücreti öğrencinin ödeme planına ek kalem olarak düşer." : "Finans kapalı: paket yalnızca ders hakkı sayısıdır."} footer={<><Button variant="outline" onClick={onClose}>Vazgeç</Button><Button onClick={kaydet} disabled={!gecerli}>Kaydet</Button></>}>
      <Field label="Öğrenci">
        <Select value={f.ogrenciId} onChange={(e) => setF({ ...f, ogrenciId: e.target.value })}>
          <option value="">Seçiniz</option>
          {ogrenciler.map((o) => <option key={o.id} value={o.id}>{tamAd(o)}</option>)}
        </Select>
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Öğretmen">
          <Select value={f.ogretmenId} onChange={(e) => { const p = ogretmenler.find((x) => x.id === e.target.value); setF({ ...f, ogretmenId: e.target.value, dersId: p?.dersIds[0] ?? f.dersId }); }}>
            {ogretmenler.map((p) => <option key={p.id} value={p.id}>{p.ad} {p.soyad}</option>)}
          </Select>
        </Field>
        <Field label="Ders">
          <Select value={f.dersId} onChange={(e) => setF({ ...f, dersId: e.target.value })}>
            {tanimlar().dersler.filter((x) => x.aktif).map((x) => <option key={x.id} value={x.id}>{x.ad}</option>)}
          </Select>
        </Field>
        <Field label="Ders hakkı"><Input type="number" min={1} value={f.toplam} onChange={(e) => setF({ ...f, toplam: Number(e.target.value) })} /></Field>
        {moduller.finans && <Field label="Ücret (₺)"><Input type="number" min={0} value={f.fiyat} onChange={(e) => setF({ ...f, fiyat: Number(e.target.value) })} /></Field>}
      </div>
    </Dialog>
  );
}

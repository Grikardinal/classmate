/**
 * Bölüm 01 · Kurum yapısı ve tanımlar
 * Doküman: docs/bolumler/01-kurum-yapisi-ve-tanimlar.md
 * Tüm tanımlar sunucuda saklanır; kurum geneli tanımları yalnızca genel yönetici değiştirebilir.
 */
import * as React from "react";
import {
  AlertTriangle,
  ArrowRight,
  BookOpen,
  Building2,
  CalendarRange,
  Check,
  Clock,
  Coins,
  Copy,
  DoorOpen,
  Lock,
  MapPin,
  Pencil,
  Phone,
  Plus,
  ToggleRight,
  Trash2,
  Users,
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
  Switch,
  Table,
  Tabs,
  Td,
  Th,
  toast,
} from "@/components/ui";
import { modulTanimlari, subeKodu, useApp, useOturum, useSubeFiltre } from "@/context/AppContext";
import {
  AKTIF_SEZON,
  derslikAdi,
  grupDoluluk,
  grupEtiket,
  guncelle,
  islemYaz,
  personelAdi,
  useDb,
  yeniId,
  type Db,
  type Derslik,
  type DersSaati,
  type Grup,
  type Sube,
} from "@/data/store";
import { dakika, tl } from "@/lib/kurallar";
import { cn } from "@/lib/utils";

type Sekme = "kurum" | "subeler" | "sezonlar" | "gruplar" | "dersler" | "derslikler" | "saatler" | "fiyat" | "moduller";

const tarih = (iso: string) => new Date(iso + "T00:00:00").toLocaleDateString("tr-TR", { day: "numeric", month: "short", year: "numeric" });

export default function KurumYapisi() {
  const { moduller } = useApp();
  const [sekme, setSekme] = React.useState<Sekme>("kurum");
  return (
    <div className="grid gap-6">
      <PageHeader code="01" title="Kurum ve tanımlar" description="Şubeler, sezonlar, gruplar, dersler ve derslikler. Diğer tüm bölümler bu tanımları kullanır." />
      <Tabs
        value={sekme}
        onChange={setSekme}
        items={[
          { value: "kurum", label: "Kurum", icon: <Building2 /> },
          { value: "subeler", label: "Şubeler", icon: <MapPin /> },
          { value: "sezonlar", label: "Sezonlar", icon: <CalendarRange /> },
          { value: "gruplar", label: "Gruplar", icon: <Users /> },
          { value: "dersler", label: "Dersler", icon: <BookOpen /> },
          { value: "derslikler", label: "Derslikler", icon: <DoorOpen /> },
          { value: "saatler", label: "Ders saatleri", icon: <Clock /> },
          ...(moduller.finans ? [{ value: "fiyat" as const, label: "Fiyat listesi", icon: <Coins /> }] : []),
          { value: "moduller", label: "Modüller", icon: <ToggleRight /> },
        ]}
      />
      {sekme === "kurum" && <KurumBilgileri />}
      {sekme === "subeler" && <Subeler />}
      {sekme === "sezonlar" && <Sezonlar />}
      {sekme === "gruplar" && <Gruplar />}
      {sekme === "dersler" && <Dersler />}
      {sekme === "derslikler" && <Derslikler />}
      {sekme === "saatler" && <DersSaatleri />}
      {sekme === "fiyat" && <FiyatListesi />}
      {sekme === "moduller" && <Moduller />}
    </div>
  );
}

function useGenel() {
  return useOturum().rol === "genel-yonetici";
}
function SadeceGenel() {
  return <Alert icon={<Lock />}>Kurum geneli tanımları yalnızca genel yönetici değiştirebilir.</Alert>;
}

/* ---------- Kurum bilgileri ---------- */
function KurumBilgileri() {
  const d = useDb();
  const genel = useGenel();
  const { ad } = useOturum();
  const [f, setF] = React.useState(d.kurum);
  const [logoHata, setLogoHata] = React.useState("");
  const logoSec = (dosya?: File) => {
    setLogoHata("");
    if (!dosya) return;
    if (dosya.size > 200 * 1024) return setLogoHata("Logo en fazla 200 KB olmalı.");
    const r = new FileReader();
    r.onload = () => setF((x) => ({ ...x, logo: String(r.result) }));
    r.readAsDataURL(dosya);
  };
  const kaydet = (e: React.FormEvent) => {
    e.preventDefault();
    guncelle((x) => {
      x.kurum = { ...f, ad: f.ad.trim() || x.kurum.ad };
      islemYaz(x, ad, "Kurum bilgileri", "Kurum bilgileri güncellendi");
    });
    toast("Kurum bilgileri kaydedildi.");
  };
  return (
    <Card>
      <CardHeader>
        <CardTitle>Kurum bilgileri</CardTitle>
        <CardDescription>Kayıt formu, makbuz ve bildirimlerde kullanılır. Kurum genelinde tek tanımdır.</CardDescription>
      </CardHeader>
      <CardContent>
        <form className="grid gap-4 sm:grid-cols-2" onSubmit={kaydet}>
          <Field label="Kurum adı"><Input disabled={!genel} value={f.ad} onChange={(e) => setF({ ...f, ad: e.target.value })} /></Field>
          <Field label="E-posta"><Input disabled={!genel} type="email" value={f.eposta} onChange={(e) => setF({ ...f, eposta: e.target.value })} /></Field>
          <Field label="Vergi no" hint="Yalnızca makbuz/fatura başlığında görünür."><Input disabled={!genel} value={f.vergiNo} onChange={(e) => setF({ ...f, vergiNo: e.target.value })} /></Field>
          <div className="grid gap-1.5">
            <span className="text-sm font-medium">Logo (belgelerde)</span>
            <div className="flex items-center gap-3">
              {f.logo ? <img src={f.logo} alt="Kurum logosu" className="size-9 rounded-md border object-contain" /> : <span className="grid size-9 place-items-center rounded-md border text-xs text-muted-foreground">—</span>}
              <Input type="file" disabled={!genel} accept="image/png,image/jpeg,image/svg+xml" className="pt-1.5" onChange={(e) => logoSec(e.target.files?.[0])} />
              {f.logo && genel && <Button type="button" variant="ghost" size="icon" aria-label="Logoyu kaldır" onClick={() => setF({ ...f, logo: undefined })}><Trash2 /></Button>}
            </div>
            {logoHata && <span className="text-xs text-danger">{logoHata}</span>}
          </div>
          <div className="sm:col-span-2">
            <Field label="Kayıt formu / makbuz başlığı"><Input disabled={!genel} value={f.makbuzBasligi} onChange={(e) => setF({ ...f, makbuzBasligi: e.target.value })} /></Field>
          </div>
          {genel ? (
            <div className="flex justify-end sm:col-span-2"><Button type="submit"><Check /> Kaydet</Button></div>
          ) : (
            <div className="sm:col-span-2"><SadeceGenel /></div>
          )}
        </form>
      </CardContent>
    </Card>
  );
}

/* ---------- Şubeler ---------- */
function Subeler() {
  const d = useDb();
  const genel = useGenel();
  const { ad } = useOturum();
  const [duzenle, setDuzenle] = React.useState<Sube | null>(null);
  const [yeni, setYeni] = React.useState(false);
  const aktifDegistir = (s: Sube) => {
    const aktifKayit = d.kayitlar.some((k) => k.subeId === s.id && k.durum === "aktif");
    if (s.aktif && aktifKayit) return toast("Aktif öğrencisi olan şube pasife alınamaz. Önce öğrencileri nakledin.", "uyari");
    guncelle((x) => {
      x.subeler = x.subeler.map((y) => (y.id === s.id ? { ...y, aktif: !y.aktif } : y));
      islemYaz(x, ad, "Şube", `${s.ad} ${s.aktif ? "pasife alındı" : "aktifleştirildi"}`, s.id);
    });
  };
  return (
    <div className="grid gap-4">
      {genel && (
        <div className="flex justify-end">
          <Button onClick={() => setYeni(true)}><Plus /> Yeni şube aç</Button>
        </div>
      )}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {d.subeler.map((s) => {
          const subeGruplari = d.gruplar.filter((g) => g.subeId === s.id && g.sezonId === AKTIF_SEZON);
          const ogrenci = subeGruplari.reduce((t, g) => t + grupDoluluk(d, g.id), 0);
          return (
            <Card key={s.id} className={cn(!s.aktif && "opacity-70")}>
              <CardHeader>
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <CardTitle>{s.ad}</CardTitle>
                    <p className="mt-1 font-mono text-xs text-muted-foreground">{s.kod}</p>
                  </div>
                  <Badge variant={s.aktif ? "success" : "secondary"}>{s.aktif ? "Aktif" : "Pasif"}</Badge>
                </div>
              </CardHeader>
              <CardContent className="grid gap-2 text-sm">
                <p className="flex gap-2 text-muted-foreground"><MapPin className="mt-0.5 size-4 shrink-0" />{s.adres || "—"}</p>
                <p className="flex gap-2 text-muted-foreground"><Phone className="mt-0.5 size-4 shrink-0" />{s.telefon || "—"}</p>
                <p className="text-muted-foreground">Müdür: <span className="text-foreground">{s.mudur || "—"}</span></p>
                <div className="mt-2 grid grid-cols-2 gap-2 border-t pt-3">
                  <div><p className="text-lg font-semibold">{subeGruplari.length}</p><p className="text-xs text-muted-foreground">grup</p></div>
                  <div><p className="text-lg font-semibold">{ogrenci}</p><p className="text-xs text-muted-foreground">öğrenci</p></div>
                </div>
                {genel && (
                  <div className="flex justify-end gap-1 border-t pt-3">
                    <Button variant="ghost" size="sm" onClick={() => aktifDegistir(s)}>{s.aktif ? "Pasife al" : "Aktifleştir"}</Button>
                    <Button variant="outline" size="sm" onClick={() => setDuzenle(s)}><Pencil /> Düzenle</Button>
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
      {duzenle && <SubeDialog sube={duzenle} onClose={() => setDuzenle(null)} />}
      {yeni && <SubeDialog onClose={() => setYeni(false)} />}
    </div>
  );
}

function SubeDialog({ sube, onClose }: { sube?: Sube; onClose: () => void }) {
  const d = useDb();
  const { ad } = useOturum();
  const [f, setF] = React.useState({ ad: sube?.ad ?? "", kod: sube?.kod ?? "", adres: sube?.adres ?? "", telefon: sube?.telefon ?? "", mudur: sube?.mudur ?? "" });
  const [kopyaKaynak, setKopyaKaynak] = React.useState(d.subeler[0]?.id ?? "");
  const [kopya, setKopya] = React.useState({ derslik: true, saat: true });
  const kod = f.kod.trim().toLocaleUpperCase("tr-TR");
  const kodCakisiyor = d.subeler.some((s) => s.kod === kod && s.id !== sube?.id);
  const gecerli = f.ad.trim() && /^[A-ZÇĞİÖŞÜ]{2,5}$/.test(kod) && !kodCakisiyor;

  const kaydet = () => {
    if (!gecerli) return;
    guncelle((x) => {
      if (sube) {
        x.subeler = x.subeler.map((s) => (s.id === sube.id ? { ...s, ...f, ad: f.ad.trim(), kod } : s));
        islemYaz(x, ad, "Şube", `${f.ad} bilgileri güncellendi`, sube.id);
        return;
      }
      const id = yeniId("s");
      x.subeler.push({ id, ad: f.ad.trim(), kod, adres: f.adres, telefon: f.telefon, mudur: f.mudur, aktif: true });
      // Yeni şube açma sihirbazı: derslik ve ders saatleri başka şubeden kopyalanabilir
      if (kopya.derslik) for (const dl of x.derslikler.filter((y) => y.subeId === kopyaKaynak)) x.derslikler.push({ ...dl, id: yeniId("d"), subeId: id });
      if (kopya.saat) for (const h of x.dersSaatleri.filter((y) => y.subeId === kopyaKaynak)) x.dersSaatleri.push({ ...h, id: yeniId("h"), subeId: id });
      x.fiyatListesi = { ...x.fiyatListesi, [id]: x.fiyatListesi[kopyaKaynak] ?? 0 };
      // Genel yöneticinin kapsamına otomatik girer; diğer personel Bölüm 02'den atanır
      islemYaz(x, ad, "Şube", `${f.ad} (${kod}) şubesi açıldı`, id);
    });
    toast(sube ? "Şube güncellendi." : `${f.ad} şubesi açıldı. Personeli Bölüm 02'den bu şubeye atayın.`);
    onClose();
  };
  return (
    <Dialog
      open
      onClose={onClose}
      wide
      title={sube ? `${sube.ad} — düzenle` : "Yeni şube aç"}
      footer={<><Button variant="outline" onClick={onClose}>Vazgeç</Button><Button onClick={kaydet} disabled={!gecerli}>{sube ? "Kaydet" : "Şubeyi aç"}</Button></>}
    >
      <div className="grid gap-3 sm:grid-cols-[1fr_8rem]">
        <Field label="Şube adı"><Input value={f.ad} onChange={(e) => setF({ ...f, ad: e.target.value })} placeholder="Batı Şubesi" /></Field>
        <Field label="Kısa kod" hint={kodCakisiyor ? "Bu kod kullanılıyor." : "2–5 harf; sözleşme no başı"}>
          <Input value={f.kod} maxLength={5} onChange={(e) => setF({ ...f, kod: e.target.value })} placeholder="BTI" />
        </Field>
      </div>
      <Field label="Adres"><Input value={f.adres} onChange={(e) => setF({ ...f, adres: e.target.value })} /></Field>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Telefon" hint="Velilere giden mesajlarda {sube_telefonu}"><Input value={f.telefon} onChange={(e) => setF({ ...f, telefon: e.target.value })} /></Field>
        <Field label="Şube müdürü"><Input value={f.mudur} onChange={(e) => setF({ ...f, mudur: e.target.value })} /></Field>
      </div>
      {!sube && (
        <div className="grid gap-2 rounded-lg border p-3">
          <p className="flex items-center gap-2 text-sm font-medium"><Copy className="size-4" /> Başka şubeden kopyala</p>
          <Select value={kopyaKaynak} onChange={(e) => setKopyaKaynak(e.target.value)}>
            {d.subeler.map((s) => <option key={s.id} value={s.id}>{s.ad}</option>)}
          </Select>
          <Checkbox checked={kopya.derslik} onChange={(v) => setKopya({ ...kopya, derslik: v })} label={`Derslikler (${d.derslikler.filter((x) => x.subeId === kopyaKaynak).length})`} />
          <Checkbox checked={kopya.saat} onChange={(v) => setKopya({ ...kopya, saat: v })} label={`Ders saatleri (${d.dersSaatleri.filter((x) => x.subeId === kopyaKaynak).length})`} />
        </div>
      )}
    </Dialog>
  );
}

/* ---------- Sezonlar ---------- */
function Sezonlar() {
  const d = useDb();
  const genel = useGenel();
  const { ad } = useOturum();
  const [acik, setAcik] = React.useState(false);
  const [gecis, setGecis] = React.useState(false);
  const [form, setForm] = React.useState({ ad: "", baslangic: "", bitis: "" });
  const gecerli = form.ad.trim() && form.baslangic && form.bitis && form.bitis > form.baslangic && !d.sezonlar.some((s) => s.ad === form.ad.trim());

  const aktifYap = (id: string) =>
    guncelle((x) => {
      x.sezonlar = x.sezonlar.map((s) => ({ ...s, aktif: s.id === id }));
      islemYaz(x, ad, "Sezon", `Aktif sezon: ${x.sezonlar.find((s) => s.id === id)?.ad}`);
    });
  const ekle = () => {
    if (!gecerli) return;
    guncelle((x) => {
      x.sezonlar.push({ id: yeniId("z"), ad: form.ad.trim(), baslangic: form.baslangic, bitis: form.bitis, aktif: false });
      islemYaz(x, ad, "Sezon", `${form.ad} sezonu eklendi`);
    });
    setForm({ ad: "", baslangic: "", bitis: "" });
    setAcik(false);
  };

  return (
    <Card>
      <CardHeader className="flex-row flex-wrap items-center justify-between gap-3">
        <div>
          <CardTitle>Sezonlar</CardTitle>
          <CardDescription className="mt-1">Kurum geneli: tüm şubeler aynı takvimi kullanır. Aynı anda tek aktif sezon olur.</CardDescription>
        </div>
        {genel && (
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={() => setGecis(true)}><ArrowRight /> Yeni sezona geçiş</Button>
            <Button size="sm" onClick={() => setAcik(true)}><Plus /> Sezon ekle</Button>
          </div>
        )}
      </CardHeader>
      <Table>
        <thead><tr><Th>Sezon</Th><Th>Başlangıç</Th><Th>Bitiş</Th><Th className="text-right">Grup</Th><Th>Durum</Th><Th className="text-right">İşlem</Th></tr></thead>
        <tbody>
          {d.sezonlar.map((s) => (
            <tr key={s.id}>
              <Td className="font-medium">{s.ad}</Td>
              <Td>{tarih(s.baslangic)}</Td>
              <Td>{tarih(s.bitis)}</Td>
              <Td className="text-right tabular-nums">{d.gruplar.filter((g) => g.sezonId === s.id).length}</Td>
              <Td>{s.aktif ? <Badge variant="success">Aktif sezon</Badge> : <Badge variant="secondary">—</Badge>}</Td>
              <Td className="text-right">{!s.aktif && genel && <Button variant="outline" size="sm" onClick={() => aktifYap(s.id)}>Aktif yap</Button>}</Td>
            </tr>
          ))}
        </tbody>
      </Table>
      <div className="flex items-start gap-2 p-4 text-xs text-muted-foreground">
        <AlertTriangle className="size-4 shrink-0 text-warning" />
        İçinde kayıt olan sezon silinemez. Yeni sezona geçişte gruplar kopyalanır ve seviye bir artırılır (8. sınıflar mezun olur).
      </div>

      <Dialog
        open={acik}
        onClose={() => setAcik(false)}
        title="Yeni sezon"
        description="Örn. 2027-2028 veya Yaz Okulu 2027"
        footer={<><Button variant="outline" onClick={() => setAcik(false)}>Vazgeç</Button><Button onClick={ekle} disabled={!gecerli}>Ekle</Button></>}
      >
        <Field label="Sezon adı"><Input value={form.ad} onChange={(e) => setForm({ ...form, ad: e.target.value })} placeholder="2027-2028" /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Başlangıç"><Input type="date" value={form.baslangic} onChange={(e) => setForm({ ...form, baslangic: e.target.value })} /></Field>
          <Field label="Bitiş"><Input type="date" value={form.bitis} onChange={(e) => setForm({ ...form, bitis: e.target.value })} /></Field>
        </div>
      </Dialog>
      {gecis && <SezonGecisi onClose={() => setGecis(false)} />}
    </Card>
  );
}

/** Önceki sezonun gruplarını kopyala + seviyeyi bir artır (öğrenciler 5'ten 6'ya geçer) */
function SezonGecisi({ onClose }: { onClose: () => void }) {
  const d = useDb();
  const { ad } = useOturum();
  const kaynak = d.sezonlar.find((s) => s.aktif)!;
  const hedefler = d.sezonlar.filter((s) => s.id !== kaynak.id && s.baslangic > kaynak.baslangic);
  const [hedef, setHedef] = React.useState(hedefler[0]?.id ?? "");
  const [ogrenciTasi, setOgrenciTasi] = React.useState(true);
  const [aktifYap, setAktifYap] = React.useState(true);
  const kaynakGruplar = d.gruplar.filter((g) => g.sezonId === kaynak.id);
  const tasinacak = kaynakGruplar.filter((g) => g.seviye < 8);
  const hedefteVar = d.gruplar.some((g) => g.sezonId === hedef);

  const uygula = () => {
    let ogrSayi = 0;
    guncelle((x) => {
      const eslesme = new Map<string, string>();
      for (const g of tasinacak) {
        const id = yeniId("g");
        eslesme.set(g.id, id);
        x.gruplar.push({ ...g, id, sezonId: hedef, seviye: g.seviye + 1, ad: g.ad.replace(/^\d+/, String(g.seviye + 1)) });
      }
      if (ogrenciTasi)
        for (const k of x.kayitlar.filter((y) => y.sezonId === kaynak.id && y.durum === "aktif" && eslesme.has(y.grupId))) {
          const grupId = eslesme.get(k.grupId)!;
          x.kayitlar.push({
            ...k, id: yeniId("k"), sezonId: hedef, grupId, tarih: x.sezonlar.find((s) => s.id === hedef)!.baslangic,
            grupGecmisi: [{ grupId, tarih: x.sezonlar.find((s) => s.id === hedef)!.baslangic }], kvkkOnay: k.kvkkOnay,
            sozlesmeNo: k.sozlesmeNo.replace(/-(\d{4})-/, (_, y) => `-${Number(y) + 1}-`),
          });
          ogrSayi++;
        }
      if (aktifYap) x.sezonlar = x.sezonlar.map((s) => ({ ...s, aktif: s.id === hedef }));
      islemYaz(x, ad, "Sezon geçişi", `${kaynak.ad} → ${x.sezonlar.find((s) => s.id === hedef)?.ad}: ${tasinacak.length} grup, ${ogrSayi} öğrenci`);
    });
    toast(`Sezon geçişi tamamlandı: ${tasinacak.length} grup${ogrenciTasi ? `, ${ogrSayi} öğrenci` : ""}.`);
    onClose();
  };

  return (
    <Dialog
      open
      onClose={onClose}
      wide
      title="Yeni sezona geçiş"
      description={`Kaynak: ${kaynak.ad} (aktif sezon)`}
      footer={<><Button variant="outline" onClick={onClose}>Vazgeç</Button><Button onClick={uygula} disabled={!hedef || hedefteVar}>Geçişi başlat</Button></>}
    >
      {hedefler.length === 0 ? (
        <Alert tone="warning" icon={<AlertTriangle />}>Önce “Sezon ekle” ile yeni sezonu tanımlayın.</Alert>
      ) : (
        <>
          <Field label="Hedef sezon">
            <Select value={hedef} onChange={(e) => setHedef(e.target.value)}>
              {hedefler.map((s) => <option key={s.id} value={s.id}>{s.ad}</option>)}
            </Select>
          </Field>
          {hedefteVar && <Alert tone="warning" icon={<AlertTriangle />}>Hedef sezonda zaten grup var; geçiş iki kez yapılamaz.</Alert>}
          <div className="grid gap-1 rounded-md border p-3 text-sm">
            {kaynakGruplar.map((g) => (
              <p key={g.id} className="flex items-center gap-2">
                <span className="w-24">{grupEtiket(d, g.id)}</span>
                {g.seviye < 8 ? <><ArrowRight className="size-3.5 text-muted-foreground" /> {g.ad.replace(/^\d+/, String(g.seviye + 1))} <span className="text-xs text-muted-foreground">({grupDoluluk(d, g.id)} öğrenci)</span></> : <Badge variant="secondary">Mezun</Badge>}
              </p>
            ))}
          </div>
          <Checkbox checked={ogrenciTasi} onChange={setOgrenciTasi} label="Aktif öğrencilerin kayıtlarını yeni gruplara taşı" description="Ödeme planı ve KVKK onayı yeni sezonda yeniden alınmalıdır." />
          <Checkbox checked={aktifYap} onChange={setAktifYap} label="Hedef sezonu aktif sezon yap" />
        </>
      )}
    </Dialog>
  );
}

/* ---------- Gruplar ---------- */
function Gruplar() {
  const filtre = useSubeFiltre();
  const { subeId } = useApp();
  const { kapsam, ad } = useOturum();
  const d = useDb();
  const liste = d.gruplar.filter((g) => g.sezonId === AKTIF_SEZON);
  const [seviye, setSeviye] = React.useState<number | "all">("all");
  const [duzenle, setDuzenle] = React.useState<Grup | "yeni" | null>(null);
  const aktifSezon = d.sezonlar.find((s) => s.aktif)!;
  const gorunen = liste.filter((g) => filtre(g.subeId) && (seviye === "all" || g.seviye === seviye));

  return (
    <Card>
      <CardHeader className="flex-row flex-wrap items-center justify-between gap-3">
        <div>
          <CardTitle>Gruplar · {aktifSezon.ad}</CardTitle>
          <CardDescription className="mt-1">Doluluk dolunca kayıtta uyarı verilir; yönetici onayıyla aşılabilir.</CardDescription>
        </div>
        <div className="flex gap-2">
          <Select aria-label="Seviye" className="w-40" value={seviye} onChange={(e) => setSeviye(e.target.value === "all" ? "all" : Number(e.target.value))}>
            <option value="all">Tüm seviyeler</option>
            {[3, 4, 5, 6, 7, 8].map((s) => <option key={s} value={s}>{s}. sınıf</option>)}
          </Select>
          <Button size="sm" className="h-9" onClick={() => setDuzenle("yeni")}><Plus /> Grup</Button>
        </div>
      </CardHeader>
      {gorunen.length === 0 ? (
        <CardContent><EmptyState icon={<Users />} title="Grup yok" text="Bu şube ve seviye için henüz grup tanımlanmamış." /></CardContent>
      ) : (
        <Table>
          <thead><tr><Th>Grup</Th><Th>Seviye</Th><Th>Derslik</Th><Th>Rehber öğretmen</Th><Th className="w-48">Doluluk</Th><Th /></tr></thead>
          <tbody>
            {gorunen.map((g) => {
              const kayitli = grupDoluluk(d, g.id);
              const oran = kayitli / g.kapasite;
              return (
                <tr key={g.id}>
                  <Td className="font-medium"><span className="mr-1.5 font-mono text-xs text-muted-foreground">{subeKodu(d, g.subeId)}</span>{g.ad}</Td>
                  <Td>{g.seviye}. sınıf</Td>
                  <Td>{derslikAdi(g.derslikId)}</Td>
                  <Td>{personelAdi(d, g.rehberId)}</Td>
                  <Td>
                    <div className="flex items-center gap-2">
                      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                        <div className={cn("h-full rounded-full", oran >= 1 ? "bg-danger" : oran >= 0.8 ? "bg-warning" : "bg-primary")} style={{ width: `${Math.min(oran, 1) * 100}%` }} />
                      </div>
                      <span className="w-12 text-right text-xs tabular-nums text-muted-foreground">{kayitli}/{g.kapasite}</span>
                    </div>
                  </Td>
                  <Td className="text-right"><Button variant="ghost" size="icon" aria-label="Düzenle" onClick={() => setDuzenle(g)}><Pencil /></Button></Td>
                </tr>
              );
            })}
          </tbody>
        </Table>
      )}
      {duzenle && (
        <GrupDialog
          grup={duzenle === "yeni" ? undefined : duzenle}
          varsayilanSube={subeId === "all" ? kapsam[0] : subeId}
          onClose={() => setDuzenle(null)}
          onKaydet={(g) => {
            guncelle((x) => {
              if (duzenle === "yeni") x.gruplar.push({ ...g, id: yeniId("g"), sezonId: aktifSezon.id });
              else x.gruplar = x.gruplar.map((y) => (y.id === g.id ? { ...y, ...g } : y));
              islemYaz(x, ad, "Grup", `${grupEtiket(x, g.id) === "—" ? g.ad : grupEtiket(x, g.id)} ${duzenle === "yeni" ? "eklendi" : "güncellendi"}`, g.subeId);
            });
            setDuzenle(null);
          }}
        />
      )}
    </Card>
  );
}

function GrupDialog({ grup, varsayilanSube, onClose, onKaydet }: { grup?: Grup; varsayilanSube: string; onClose: () => void; onKaydet: (g: Grup) => void }) {
  const d = useDb();
  const { kapsam } = useOturum();
  const [f, setF] = React.useState<Grup>(grup ?? { id: "", subeId: varsayilanSube, sezonId: AKTIF_SEZON, seviye: 5, ad: "", kapasite: 14, derslikId: "", rehberId: "" });
  const adCakisiyor = d.gruplar.some((g) => g.id !== f.id && g.sezonId === f.sezonId && g.subeId === f.subeId && g.ad.toLowerCase() === f.ad.trim().toLowerCase());
  const ogretmenler = d.personel.filter((p) => p.gorev === "ogretmen" && p.aktif && p.subeIds.includes(f.subeId));
  const derslikler = d.derslikler.filter((x) => x.subeId === f.subeId);
  const kayitli = grup ? grupDoluluk(d, grup.id) : 0;
  const gecerli = f.ad.trim() && !adCakisiyor && f.kapasite >= 1;
  return (
    <Dialog
      open
      onClose={onClose}
      title={grup ? `${grup.ad} — düzenle` : "Yeni grup"}
      footer={<><Button variant="outline" onClick={onClose}>Vazgeç</Button><Button onClick={() => onKaydet({ ...f, ad: f.ad.trim(), derslikId: f.derslikId || derslikler[0]?.id || "", rehberId: f.rehberId || ogretmenler[0]?.id || "" })} disabled={!gecerli}>Kaydet</Button></>}
    >
      <div className="grid grid-cols-2 gap-3">
        <Field label="Şube">
          <Select value={f.subeId} disabled={!!grup} onChange={(e) => setF({ ...f, subeId: e.target.value, derslikId: "", rehberId: "" })}>
            {d.subeler.filter((s) => s.aktif && kapsam.includes(s.id)).map((s) => <option key={s.id} value={s.id}>{s.ad}</option>)}
          </Select>
        </Field>
        <Field label="Seviye">
          <Select value={f.seviye} disabled={!!grup && kayitli > 0} onChange={(e) => setF({ ...f, seviye: Number(e.target.value) })}>
            {[3, 4, 5, 6, 7, 8].map((s) => <option key={s} value={s}>{s}. sınıf</option>)}
          </Select>
        </Field>
        <Field label="Grup adı" hint={adCakisiyor ? "Bu şubede aynı adlı grup var." : undefined}>
          <Input value={f.ad} onChange={(e) => setF({ ...f, ad: e.target.value })} placeholder={`${f.seviye}-B`} />
        </Field>
        <Field label="Kapasite" hint={kayitli > f.kapasite ? `Kayıtlı ${kayitli} öğrenci var.` : undefined}>
          <Input type="number" min={1} value={f.kapasite} onChange={(e) => setF({ ...f, kapasite: Number(e.target.value) })} />
        </Field>
      </div>
      <Field label="Varsayılan derslik">
        <Select value={f.derslikId} onChange={(e) => setF({ ...f, derslikId: e.target.value })}>
          <option value="">Seçiniz</option>
          {derslikler.map((x) => <option key={x.id} value={x.id}>{x.ad} ({x.kapasite})</option>)}
        </Select>
      </Field>
      <Field label="Rehber öğretmen">
        <Select value={f.rehberId} onChange={(e) => setF({ ...f, rehberId: e.target.value })}>
          <option value="">Seçiniz</option>
          {ogretmenler.map((p) => <option key={p.id} value={p.id}>{p.ad} {p.soyad}</option>)}
        </Select>
      </Field>
    </Dialog>
  );
}

/* ---------- Dersler ---------- */
function Dersler() {
  const d = useDb();
  const genel = useGenel();
  const { ad } = useOturum();
  const [yeni, setYeni] = React.useState({ ad: "", kisaAd: "", renk: "#0d9488" });
  const kisa = yeni.kisaAd.trim().toLocaleUpperCase("tr-TR") || yeni.ad.trim().slice(0, 3).toLocaleUpperCase("tr-TR");
  const gecerli = yeni.ad.trim() && !d.dersler.some((x) => x.ad.toLowerCase() === yeni.ad.trim().toLowerCase());
  const ekle = () => {
    if (!gecerli) return;
    guncelle((x) => {
      x.dersler.push({ id: yeniId("l"), ad: yeni.ad.trim(), kisaAd: kisa, renk: yeni.renk, aktif: true });
      islemYaz(x, ad, "Ders", `${yeni.ad} eklendi`);
    });
    setYeni({ ad: "", kisaAd: "", renk: "#0d9488" });
  };
  return (
    <Card>
      <CardHeader>
        <CardTitle>Dersler</CardTitle>
        <CardDescription>Kurum geneli. Renk, ders programında hücre rengi olarak kullanılır. Kullanılan ders silinmez, pasife alınır.</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4">
        <div className="grid gap-2 sm:grid-cols-2">
          {d.dersler.map((x) => (
            <div key={x.id} className="flex items-center gap-3 rounded-md border p-3">
              <span className="grid size-9 place-items-center rounded-md text-[11px] font-semibold text-white" style={{ background: x.renk }}>{x.kisaAd}</span>
              <span className={cn("flex-1 text-sm font-medium", !x.aktif && "text-muted-foreground line-through")}>{x.ad}</span>
              <input
                type="color"
                aria-label={`${x.ad} rengi`}
                disabled={!genel}
                value={x.renk}
                onChange={(e) => guncelle((y) => (y.dersler = y.dersler.map((z) => (z.id === x.id ? { ...z, renk: e.target.value } : z))))}
                className="size-7 cursor-pointer rounded border-0 bg-transparent p-0 disabled:cursor-not-allowed"
              />
              <Switch label={`${x.ad} aktif`} disabled={!genel} checked={x.aktif} onCheckedChange={(v) => guncelle((y) => (y.dersler = y.dersler.map((z) => (z.id === x.id ? { ...z, aktif: v } : z))))} />
            </div>
          ))}
        </div>
        {genel ? (
          <div className="grid gap-2 rounded-md border border-dashed p-3 sm:grid-cols-[1fr_7rem_3rem_auto] sm:items-end">
            <Field label="Yeni ders"><Input value={yeni.ad} onChange={(e) => setYeni({ ...yeni, ad: e.target.value })} placeholder="Okuma ve anlama" /></Field>
            <Field label="Kısa ad"><Input value={yeni.kisaAd} maxLength={4} placeholder={kisa || "OKU"} onChange={(e) => setYeni({ ...yeni, kisaAd: e.target.value })} /></Field>
            <Field label="Renk"><input type="color" value={yeni.renk} onChange={(e) => setYeni({ ...yeni, renk: e.target.value })} className="h-9 w-12 cursor-pointer rounded border bg-transparent" /></Field>
            <Button onClick={ekle} disabled={!gecerli}><Plus /> Ekle</Button>
          </div>
        ) : (
          <SadeceGenel />
        )}
      </CardContent>
    </Card>
  );
}

/* ---------- Derslikler ---------- */
function Derslikler() {
  const filtre = useSubeFiltre();
  const { kapsam, ad, rol } = useOturum();
  const d = useDb();
  const yazabilir = rol === "genel-yonetici";
  const liste = d.derslikler.filter((x) => filtre(x.subeId));
  const [f, setF] = React.useState({ subeId: kapsam[0], ad: "", kapasite: 14 });
  const kullanimda = (dl: Derslik) => d.gruplar.some((g) => g.derslikId === dl.id) || d.program.some((p) => p.derslikId === dl.id && !p.bitis);
  const ekle = () => {
    if (!f.ad.trim()) return;
    guncelle((x) => {
      x.derslikler.push({ id: yeniId("d"), subeId: f.subeId, ad: f.ad.trim(), kapasite: f.kapasite });
      islemYaz(x, ad, "Derslik", `${f.ad} eklendi`, f.subeId);
    });
    setF({ ...f, ad: "" });
  };
  const sil = (dl: Derslik) => {
    if (kullanimda(dl)) return toast("Bu derslik bir grupta veya ders programında kullanılıyor.", "uyari");
    guncelle((x) => {
      x.derslikler = x.derslikler.filter((y) => y.id !== dl.id);
      islemYaz(x, ad, "Derslik", `${dl.ad} silindi`, dl.subeId);
    });
  };
  return (
    <Card>
      <CardHeader>
        <CardTitle>Derslikler</CardTitle>
        <CardDescription>Şubeye özel. Üst bardaki şube seçicisine göre filtrelenir.</CardDescription>
      </CardHeader>
      <Table>
        <thead><tr><Th>Şube</Th><Th>Derslik</Th><Th>Kapasite</Th><Th>Kullanan gruplar</Th><Th /></tr></thead>
        <tbody>
          {liste.map((x) => (
            <tr key={x.id}>
              <Td className="font-mono text-xs text-muted-foreground">{subeKodu(d, x.subeId)}</Td>
              <Td className="font-medium">{x.ad}</Td>
              <Td>
                <Input type="number" min={1} disabled={!yazabilir} className="h-8 w-20" value={x.kapasite} onChange={(e) => guncelle((y) => (y.derslikler = y.derslikler.map((z) => (z.id === x.id ? { ...z, kapasite: Number(e.target.value) || 1 } : z))))} />
              </Td>
              <Td><div className="flex flex-wrap gap-1">{d.gruplar.filter((g) => g.derslikId === x.id).map((g) => <Badge key={g.id} variant="outline">{g.ad}</Badge>)}</div></Td>
              <Td className="text-right">{yazabilir && <Button variant="ghost" size="icon" aria-label="Sil" onClick={() => sil(x)}><Trash2 /></Button>}</Td>
            </tr>
          ))}
        </tbody>
      </Table>
      {yazabilir && (
        <CardContent className="grid gap-2 pt-4 sm:grid-cols-[10rem_1fr_6rem_auto] sm:items-end">
          <Field label="Şube"><Select value={f.subeId} onChange={(e) => setF({ ...f, subeId: e.target.value })}>{d.subeler.filter((s) => kapsam.includes(s.id)).map((s) => <option key={s.id} value={s.id}>{s.ad}</option>)}</Select></Field>
          <Field label="Yeni derslik"><Input value={f.ad} onChange={(e) => setF({ ...f, ad: e.target.value })} placeholder="Derslik 3" /></Field>
          <Field label="Kapasite"><Input type="number" min={1} value={f.kapasite} onChange={(e) => setF({ ...f, kapasite: Number(e.target.value) })} /></Field>
          <Button onClick={ekle} disabled={!f.ad.trim()}><Plus /> Ekle</Button>
        </CardContent>
      )}
    </Card>
  );
}

/* ---------- Ders saatleri ---------- */
function DersSaatleri() {
  const { subeId } = useApp();
  const { kapsam, ad, rol } = useOturum();
  const d = useDb();
  const yazabilir = rol === "genel-yonetici";
  const [secili, setSecili] = React.useState(subeId === "all" ? kapsam[0] : subeId);
  React.useEffect(() => {
    if (subeId !== "all") setSecili(subeId);
  }, [subeId]);
  const [yeni, setYeni] = React.useState<{ gunTipi: DersSaati["gunTipi"]; baslangic: string; bitis: string }>({ gunTipi: "hafta-ici", baslangic: "18:30", bitis: "19:10" });
  const saatler = d.dersSaatleri.filter((h) => h.subeId === secili);
  const cakisiyor = saatler.some((h) => h.gunTipi === yeni.gunTipi && dakika(h.baslangic) < dakika(yeni.bitis) && dakika(yeni.baslangic) < dakika(h.bitis));
  const gecerli = dakika(yeni.bitis) > dakika(yeni.baslangic) && !cakisiyor;

  const yenidenSirala = (x: Db, sId: string) => {
    for (const tip of ["hafta-ici", "hafta-sonu"] as const) {
      const l = x.dersSaatleri.filter((h) => h.subeId === sId && h.gunTipi === tip).sort((a, b) => dakika(a.baslangic) - dakika(b.baslangic));
      x.dersSaatleri = x.dersSaatleri.map((h) => (h.subeId === sId && h.gunTipi === tip ? { ...h, sira: l.findIndex((y) => y.id === h.id) + 1 } : h));
    }
  };
  const ekle = () => {
    if (!gecerli) return;
    guncelle((x) => {
      x.dersSaatleri.push({ id: yeniId("h"), subeId: secili, gunTipi: yeni.gunTipi, sira: 0, baslangic: yeni.baslangic, bitis: yeni.bitis });
      yenidenSirala(x, secili);
      islemYaz(x, ad, "Ders saati", `${yeni.baslangic}–${yeni.bitis} eklendi`, secili);
    });
  };
  const sil = (h: DersSaati) => {
    if (d.program.some((p) => p.saatId === h.id && !p.bitis)) return toast("Bu ders saatinde programda ders var; önce dersi taşıyın.", "uyari");
    guncelle((x) => {
      x.dersSaatleri = x.dersSaatleri.filter((y) => y.id !== h.id);
      yenidenSirala(x, secili);
      islemYaz(x, ad, "Ders saati", `${h.baslangic}–${h.bitis} silindi`, secili);
    });
  };

  return (
    <Card>
      <CardHeader className="flex-row flex-wrap items-center justify-between gap-3">
        <div>
          <CardTitle>Ders saatleri</CardTitle>
          <CardDescription className="mt-1">Şubelerin çalışma saatleri farklı olabilir. Ders programı bu dilimleri kullanır.</CardDescription>
        </div>
        <Select aria-label="Şube" className="w-44" value={secili} onChange={(e) => setSecili(e.target.value)}>
          {d.subeler.filter((s) => s.aktif && kapsam.includes(s.id)).map((s) => <option key={s.id} value={s.id}>{s.ad}</option>)}
        </Select>
      </CardHeader>
      <CardContent className="grid gap-4 sm:grid-cols-2">
        {(["hafta-ici", "hafta-sonu"] as const).map((tip) => (
          <div key={tip} className="rounded-md border">
            <p className="border-b px-4 py-2.5 text-sm font-medium">{tip === "hafta-ici" ? "Hafta içi" : "Hafta sonu"}</p>
            <ul className="divide-y">
              {saatler.filter((h) => h.gunTipi === tip).sort((a, b) => a.sira - b.sira).map((h) => (
                <li key={h.id} className="flex items-center gap-3 px-4 py-2 text-sm">
                  <span className="grid size-6 place-items-center rounded-full bg-muted text-xs font-medium">{h.sira}</span>
                  <span className="flex-1 tabular-nums">{h.baslangic} – {h.bitis}</span>
                  {yazabilir && <Button variant="ghost" size="icon" aria-label="Sil" onClick={() => sil(h)}><Trash2 /></Button>}
                </li>
              ))}
              {saatler.filter((h) => h.gunTipi === tip).length === 0 && <li className="px-4 py-6 text-center text-sm text-muted-foreground">Tanımlı saat yok</li>}
            </ul>
          </div>
        ))}
        {yazabilir && (
          <div className="grid gap-2 rounded-md border border-dashed p-3 sm:col-span-2 sm:grid-cols-[10rem_7rem_7rem_auto] sm:items-end">
            <Field label="Gün tipi"><Select value={yeni.gunTipi} onChange={(e) => setYeni({ ...yeni, gunTipi: e.target.value as DersSaati["gunTipi"] })}><option value="hafta-ici">Hafta içi</option><option value="hafta-sonu">Hafta sonu</option></Select></Field>
            <Field label="Başlangıç"><Input type="time" value={yeni.baslangic} onChange={(e) => setYeni({ ...yeni, baslangic: e.target.value })} /></Field>
            <Field label="Bitiş"><Input type="time" value={yeni.bitis} onChange={(e) => setYeni({ ...yeni, bitis: e.target.value })} /></Field>
            <Button onClick={ekle} disabled={!gecerli}><Plus /> Ekle</Button>
            {cakisiyor && <p className="text-xs text-danger sm:col-span-4">Bu saat aralığı mevcut bir dilimle çakışıyor.</p>}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

/* ---------- Fiyat listesi (Finans açıksa) ---------- */
function FiyatListesi() {
  const d = useDb();
  const genel = useGenel();
  const { ad } = useOturum();
  const [f, setF] = React.useState(d.fiyatListesi);
  return (
    <Card>
      <CardHeader>
        <CardTitle>Fiyat listesi</CardTitle>
        <CardDescription>Sezonluk liste fiyatı; şube bazında farklılaşabilir. Kayıt sihirbazı bu fiyattan başlar, indirimler ayrıca uygulanır.</CardDescription>
      </CardHeader>
      <Table>
        <thead><tr><Th>Şube</Th><Th className="w-48">Liste fiyatı (₺)</Th><Th className="text-right">Görünüm</Th></tr></thead>
        <tbody>
          {d.subeler.map((s) => (
            <tr key={s.id}>
              <Td className="font-medium">{s.ad}</Td>
              <Td><Input type="number" min={0} disabled={!genel} value={f[s.id] ?? 0} onChange={(e) => setF({ ...f, [s.id]: Number(e.target.value) })} /></Td>
              <Td className="text-right tabular-nums">{tl(f[s.id] ?? 0)}</Td>
            </tr>
          ))}
        </tbody>
      </Table>
      {genel && (
        <CardContent className="flex justify-end pt-4">
          <Button onClick={() => { guncelle((x) => { x.fiyatListesi = f; islemYaz(x, ad, "Fiyat listesi", "Liste fiyatları güncellendi"); }); toast("Fiyat listesi kaydedildi."); }}><Check /> Kaydet</Button>
        </CardContent>
      )}
    </Card>
  );
}

/* ---------- Modüller ---------- */
function Moduller() {
  const { moduller, setModul } = useApp();
  const genel = useGenel();
  return (
    <div className="grid gap-4">
      <Alert icon={<Lock />}>
        Kapalı modülün menüleri, ekranları, bildirimleri ve panel kartları <b>görünmez</b>. Veri silinmez; modül tekrar açıldığında kaldığı yerden çalışır.
        Ayar kurum geneli olarak sunucuda saklanır{genel ? "" : "; yalnızca genel yönetici değiştirebilir"}.
      </Alert>
      <div className="grid gap-3 sm:grid-cols-2">
        {modulTanimlari.map((m) => (
          <Card key={m.key} className={cn("transition", moduller[m.key] && "border-primary/40")}>
            <CardContent className="flex items-start gap-4 p-5">
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <p className="font-medium">{m.ad}</p>
                  <Badge variant="secondary">{m.surum}</Badge>
                </div>
                <p className="mt-1 text-sm text-muted-foreground">{m.aciklama}</p>
              </div>
              <Switch label={m.ad} disabled={!genel} checked={moduller[m.key]} onCheckedChange={(v) => setModul(m.key, v)} />
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

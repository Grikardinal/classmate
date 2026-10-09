/**
 * Bölüm 14 · Teknik altyapı, güvenlik ve KVKK
 * Doküman: docs/bolumler/14-altyapi-guvenlik-kvkk.md
 * Excel'den içe aktarma sihirbazı (MVP), dışa aktarma, işlem kaydı, KVKK araçları ve sistem ayarları.
 */
import * as React from "react";
import { useSearchParams } from "react-router-dom";
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  DatabaseBackup,
  Download,
  FileSpreadsheet,
  FileUp,
  History,
  Lock,
  RotateCcw,
  Search,
  Settings2,
  ShieldCheck,
  Trash2,
  Upload,
  UserX,
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
  StatCard,
  Switch,
  Table,
  Tabs,
  Td,
  Th,
  toast,
} from "@/components/ui";
import { useOturum } from "@/context/AppContext";
import { tanimlar } from "@/data/store";
import {
  AKTIF_SEZON,
  BUGUN,
  getDb,
  grupEtiket,
  guncelle,
  islemYaz,
  ogrenciVelileri,
  senkron,
  veriYukle,
  simdiZaman,
  sube,
  tamAd,
  useDb,
  yeniId,
  rolAdlari,
  type Ayarlar,
  type Rol,
  type Db,
} from "@/data/store";
import {
  adSoyadBol,
  anonimlestir,
  basliklariEslestir,
  epostaGecerli,
  gorevCoz,
  personelAlanlari,
  telefonNormalize,
  type PersonelAlani,
  csvCoz,
  csvOlustur,
  gunFarki,
  iceAktarmaAlanlari,
  mukerrerMi,
  normalAd,
  satirCoz,
  sozlesmeNo,
  sutunEslestir,
  type IceAktarmaAlani,
  type IceAktarmaSatiri,
} from "@/lib/kurallar";
import { xlsxOku } from "@/lib/xlsx";
import { api, type SunucuDurumu } from "@/lib/api";
import { dosyaIndir } from "@/lib/yazdir";
import { cn } from "@/lib/utils";

type Sekme = "ice" | "disa" | "islem" | "kvkk" | "ayar";

export default function Altyapi() {
  const [params] = useSearchParams();
  const [sekme, setSekme] = React.useState<Sekme>((params.get("sekme") as Sekme) || "ice");
  return (
    <div className="grid gap-6">
      <PageHeader code="14" title="Veri, güvenlik ve KVKK" description="Excel'den içe aktarma, yedek ve dışa aktarma, işlem kaydı, kişisel veri araçları ve sistem ayarları." />
      <Tabs
        value={sekme}
        onChange={setSekme}
        items={[
          { value: "ice", label: "Excel'den aktar", icon: <FileUp /> },
          { value: "disa", label: "Yedek ve dışa aktarma", icon: <DatabaseBackup /> },
          { value: "islem", label: "İşlem kaydı", icon: <History /> },
          { value: "kvkk", label: "KVKK", icon: <ShieldCheck /> },
          { value: "ayar", label: "Sistem ayarları", icon: <Settings2 /> },
        ]}
      />
      {sekme === "ice" && <AktarmaSecici />}
      {sekme === "disa" && <DisaAktarma />}
      {sekme === "islem" && <IslemKaydi />}
      {sekme === "kvkk" && <Kvkk />}
      {sekme === "ayar" && <SistemAyarlari />}
    </div>
  );
}

/* =========================== Excel'den içe aktarma =========================== */
function AktarmaSecici() {
  const [tur, setTur] = React.useState<"ogrenci" | "personel">("ogrenci");
  return (
    <div className="grid gap-4">
      <div className="inline-flex w-fit rounded-md border p-0.5">
        {([["ogrenci", "Öğrenci listesi"], ["personel", "Personel listesi"]] as const).map(([k, a]) => (
          <button key={k} onClick={() => setTur(k)} className={cn("rounded px-3 py-1.5 text-sm", tur === k ? "bg-accent font-medium text-accent-foreground" : "text-muted-foreground hover:text-foreground")}>{a}</button>
        ))}
      </div>
      {tur === "ogrenci" ? <IceAktarma /> : <PersonelAktarma />}
    </div>
  );
}
const sablonBasliklar = ["Öğrenci Adı Soyadı", "Sınıf", "Okul", "Doğum Tarihi", "Veli Adı Soyadı", "Veli Tel", "Grup", "Şube"];
const ornekSatirlar = [
  ["Deniz Yalçın", "5", "Fatih Ortaokulu", "2015-04-12", "Selma Yalçın", "0532 410 11 22", "5-A", "Merkez"],
  ["Toprak Yalçın", "3", "Atatürk İlkokulu", "2017-09-01", "Selma Yalçın", "05324101122", "3-A", "Merkez"],
  ["Lara Şen", "6. sınıf", "Gazi Ortaokulu", "", "Gökhan Şen", "+90 533 555 66 77", "6-A", "Merkez"],
  ["Kaan Özer", "7", "Cumhuriyet Ortaokulu", "", "Nil Özer", "0544 222 33 4", "7-A", "Kuzey Şubesi"],
  ["", "4", "Yunus Emre İlkokulu", "", "Ece Durmaz", "0545 777 88 99", "4-A", "Kuzey Şubesi"],
  ["Ilgaz Tan", "9", "Gazi Ortaokulu", "", "Ozan Tan", "0546 101 20 30", "", "Merkez"],
  ["Mavi Er", "4", "Atatürk İlkokulu", "", "Sevgi Er", "0547 121 31 41", "4-C", "Kuzey Şubesi"],
  ["Rüzgar Koç", "8", "Mimar Sinan Ortaokulu", "", "Melek Koç", "0548 151 61 71", "8-A", "Merkez"],
];

type OnizlemeSatiri = IceAktarmaSatiri & { subeId: string | null; grupId: string | null; mukerrer: boolean; kardesVeliId: string | null };
const adimAdlari = ["Dosya", "Sütun eşleştirme", "Şube ve grup", "Önizleme", "Rapor"];

function IceAktarma() {
  const d = useDb();
  const { ad, kapsam } = useOturum();
  const [adim, setAdim] = React.useState(0);
  const [dosyaAdi, setDosyaAdi] = React.useState("");
  const [tablo, setTablo] = React.useState<string[][]>([]);
  const [eslesme, setEslesme] = React.useState<Partial<Record<IceAktarmaAlani, number>>>({});
  const [subeModu, setSubeModu] = React.useState<"sabit" | "sutun">("sabit");
  const [sabitSube, setSabitSube] = React.useState(kapsam[0]);
  const [grupModu, setGrupModu] = React.useState<"sutun" | "seviye">("sutun");
  const [sadeceHatali, setSadeceHatali] = React.useState(false);
  const [rapor, setRapor] = React.useState<{ id: string; eklenen: number; atlanan: OnizlemeSatiri[] } | null>(null);
  const [hata, setHata] = React.useState("");

  const basliklar = tablo[0] ?? [];
  const veri = tablo.slice(1);

  const yukle = async (f: File) => {
    setHata("");
    try {
      const t = /\.xlsx$/i.test(f.name) ? await xlsxOku(f) : csvCoz(await f.text());
      if (t.length < 2) throw new Error("Dosyada başlık satırı ve en az bir veri satırı olmalı.");
      setTablo(t);
      setDosyaAdi(f.name);
      const e = sutunEslestir(t[0]);
      setEslesme(e);
      setSubeModu(e.sube !== undefined ? "sutun" : "sabit");
      setGrupModu(e.grup !== undefined ? "sutun" : "seviye");
      setAdim(1);
    } catch (err) {
      setHata(err instanceof Error ? err.message : "Dosya okunamadı.");
    }
  };
  const ornekleDene = () => {
    const t = [sablonBasliklar, ...ornekSatirlar];
    setTablo(t);
    setDosyaAdi("ornek-ogrenci-listesi.csv");
    setEslesme(sutunEslestir(t[0]));
    setSubeModu("sutun");
    setGrupModu("sutun");
    setAdim(1);
  };

  // Önizleme ve doğrulama
  const onizleme: OnizlemeSatiri[] = React.useMemo(() => {
    if (adim < 3) return [];
    const mevcut = d.ogrenciler.map((o) => ({ ad: o.ad, soyad: o.soyad, veliTelefonlari: ogrenciVelileri(d, o).map((v) => v.telefon) }));
    const dosyadaki: { ad: string; soyad: string; veliTelefonlari: string[] }[] = [];
    return veri.map((satir, i) => {
      const s = satirCoz(satir, eslesme, i + 2);
      let subeId: string | null = subeModu === "sabit" ? sabitSube : null;
      if (subeModu === "sutun") {
        const n = normalAd(s.subeAdi);
        subeId = tanimlar().subeler.find((x) => normalAd(x.ad) === n || normalAd(x.kod) === n || (n && normalAd(x.ad).startsWith(n)))?.id ?? null;
        if (!subeId) s.hatalar.push(s.subeAdi ? `Tanımsız şube: ${s.subeAdi}` : "Şube boş");
        else if (!kapsam.includes(subeId)) {
          s.hatalar.push("Şube kapsamınız dışında");
          subeId = null;
        }
      }
      let grupId: string | null = null;
      if (subeId) {
        const gruplar = d.gruplar.filter((g) => g.subeId === subeId && g.sezonId === AKTIF_SEZON);
        if (grupModu === "sutun") {
          const n = normalAd(s.grupAdi.replace(/^[a-zçğıöşü]{3}\s+/i, ""));
          grupId = gruplar.find((g) => normalAd(g.ad) === n)?.id ?? null;
          if (!grupId) s.hatalar.push(s.grupAdi ? `Tanımsız grup: ${s.grupAdi}` : "Grup boş");
          else if (s.seviye && gruplar.find((g) => g.id === grupId)!.seviye !== s.seviye) s.uyarilar.push("Grup seviyesi sınıfla uyuşmuyor");
        } else if (s.seviye) {
          grupId = gruplar.find((g) => g.seviye === s.seviye)?.id ?? null;
          if (!grupId) s.hatalar.push(`${sube(subeId)?.kod} şubesinde ${s.seviye}. sınıf grubu yok`);
        }
      }
      const aday = { ad: s.ad, soyad: s.soyad, veliTelefon: s.veliTelefon ?? "" };
      const mukerrer = !!s.ad && !!s.veliTelefon && (mukerrerMi(aday, mevcut) || mukerrerMi(aday, dosyadaki));
      if (mukerrer) s.hatalar.push("Mükerrer öğrenci (aynı ad + veli telefonu)");
      if (s.ad && s.veliTelefon) dosyadaki.push({ ad: s.ad, soyad: s.soyad, veliTelefonlari: [s.veliTelefon] });
      const kardesVeliId = s.veliTelefon ? d.veliler.find((v) => v.telefon === s.veliTelefon)?.id ?? null : null;
      return { ...s, subeId, grupId, mukerrer, kardesVeliId };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [adim, tablo, eslesme, subeModu, sabitSube, grupModu, d.ogrenciler.length]);

  const gecerli = onizleme.filter((s) => !s.hatalar.length);
  const hatali = onizleme.filter((s) => s.hatalar.length);

  const aktar = () => {
    const partiId = yeniId("ia");
    const ogrIds: string[] = [];
    const veliIds: string[] = [];
    const kayitIds: string[] = [];
    guncelle((x) => {
      const telVeli = new Map(x.veliler.map((v) => [v.telefon, v.id]));
      for (const s of gecerli) {
        // Kardeşler aynı veli telefonundan otomatik eşleşir
        let vid = telVeli.get(s.veliTelefon!);
        if (!vid) {
          vid = yeniId("v");
          x.veliler.push({ id: vid, ad: s.veliAd || "Veli", soyad: s.veliSoyad, telefon: s.veliTelefon!, eposta: "", yakinlik: "Diğer", pushAcik: false, portalDavet: "bekliyor", izinSms: true, izinTanitim: false });
          telVeli.set(s.veliTelefon!, vid);
          veliIds.push(vid);
        }
        const oid = yeniId("o");
        x.ogrenciler.push({ id: oid, ad: s.ad, soyad: s.soyad, dogum: /^\d{4}-\d{2}-\d{2}$/.test(s.dogum) ? s.dogum : "", cinsiyet: "K", okul: s.okul, okulSinifi: "", saglikNotu: "", veliIds: [vid], birincilVeliId: vid, durum: "aktif", notlar: [], iceAktarmaId: partiId });
        const kid = yeniId("k");
        x.kayitlar.push({
          id: kid, ogrenciId: oid, sezonId: AKTIF_SEZON, subeId: s.subeId!, grupId: s.grupId!, sozlesmeNo: sozlesmeNo(sube(s.subeId)!.kod, 2026, x.kayitlar.map((k) => k.sozlesmeNo)),
          durum: "aktif", tarih: BUGUN, grupGecmisi: [{ grupId: s.grupId!, tarih: BUGUN }], ekHizmetler: [], kvkkOnay: null, listeFiyati: 0, indirimler: [], net: 0, iceAktarmaId: partiId,
        });
        ogrIds.push(oid);
        kayitIds.push(kid);
      }
      x.iceAktarmalar.unshift({ id: partiId, zaman: simdiZaman(), dosya: dosyaAdi, ogrenciIds: ogrIds, veliIds, kayitIds, atlanan: hatali.length, geriAlindi: false });
      islemYaz(x, ad, "Excel içe aktarma", `${dosyaAdi}: ${ogrIds.length} öğrenci eklendi, ${hatali.length} satır atlandı`);
    });
    setRapor({ id: partiId, eklenen: ogrIds.length, atlanan: hatali });
    setAdim(4);
    toast(`${ogrIds.length} öğrenci aktarıldı.`);
  };

  const sifirla = () => {
    setAdim(0);
    setTablo([]);
    setRapor(null);
    setDosyaAdi("");
  };

  return (
    <div className="grid gap-4">
      <ol className="flex flex-wrap gap-2">
        {adimAdlari.map((a, i) => (
          <li key={a} className={cn("flex items-center gap-2 rounded-full border px-3 py-1 text-sm", i === adim ? "border-primary bg-accent font-medium text-accent-foreground" : i < adim ? "" : "text-muted-foreground")}>
            <span className={cn("grid size-5 place-items-center rounded-full text-[11px] font-semibold", i < adim ? "bg-primary text-primary-foreground" : "bg-muted")}>{i < adim ? "✓" : i + 1}</span>
            {a}
          </li>
        ))}
      </ol>

      {adim === 0 && (
        <div className="grid gap-4 lg:grid-cols-[1fr_20rem]">
          <Card>
            <CardContent className="p-5">
              <label
                className="flex cursor-pointer flex-col items-center justify-center gap-3 rounded-lg border-2 border-dashed px-6 py-14 text-center transition hover:border-primary"
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  const f = e.dataTransfer.files[0];
                  if (f) yukle(f);
                }}
              >
                <FileSpreadsheet className="size-10 text-primary" />
                <span className="font-medium">Excel (.xlsx) veya CSV dosyasını sürükleyin ya da seçin</span>
                <span className="max-w-md text-sm text-muted-foreground">Mevcut listenizi olduğu gibi yükleyebilirsiniz; sütunları bir sonraki adımda eşleştireceğiz.</span>
                <input type="file" accept=".xlsx,.csv,text/csv" className="sr-only" onChange={(e) => e.target.files?.[0] && yukle(e.target.files[0])} />
                <span className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground">Dosya seç</span>
              </label>
              {hata && <p className="mt-3 text-sm text-danger">{hata}</p>}
            </CardContent>
          </Card>
          <div className="grid content-start gap-3">
            <Button variant="outline" onClick={() => dosyaIndir("classmate-ogrenci-sablonu.csv", csvOlustur([sablonBasliklar, ornekSatirlar[0]]))}><Download /> Şablonu indir</Button>
            <Button variant="outline" onClick={ornekleDene}><FileSpreadsheet /> Örnek dosyayla dene</Button>
            <Alert icon={<RotateCcw />}>Aktarım geri alınabilir: aynı partiden gelen kayıtlar tek tıkla silinir. Deneme yapmak güvenli.</Alert>
            <OncekiAktarimlar />
          </div>
        </div>
      )}

      {adim === 1 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Sütun eşleştirme · {dosyaAdi}</CardTitle>
            <CardDescription>{veri.length} veri satırı. Otomatik öneriler işaretlendi; gerekirse düzeltin. Ad-soyad tek sütundaysa otomatik bölünür.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-2">
            {iceAktarmaAlanlari.map((a) => (
              <Field key={a.key} label={`${a.ad}${a.zorunlu ? " *" : ""}`}>
                <Select value={eslesme[a.key] ?? ""} onChange={(e) => setEslesme({ ...eslesme, [a.key]: e.target.value === "" ? undefined : Number(e.target.value) })}>
                  <option value="">— eşleştirme yok —</option>
                  {basliklar.map((b, i) => <option key={i} value={i}>{b || `Sütun ${i + 1}`} {veri[0]?.[i] ? `(örn. ${String(veri[0][i]).slice(0, 20)})` : ""}</option>)}
                </Select>
              </Field>
            ))}
          </CardContent>
          <CardContent className="flex justify-between border-t pt-4">
            <Button variant="outline" onClick={sifirla}><ArrowLeft /> Başka dosya</Button>
            <Button onClick={() => setAdim(2)} disabled={(eslesme.adSoyad === undefined && eslesme.ad === undefined) || eslesme.veliTelefon === undefined || eslesme.seviye === undefined}>
              İleri <ArrowRight />
            </Button>
          </CardContent>
        </Card>
      )}

      {adim === 2 && (
        <Card>
          <CardHeader><CardTitle className="text-base">Şube, sezon ve grup</CardTitle><CardDescription>Kayıtlar aktif sezona ({AKTIF_SEZON === "z2" ? "2026-2027" : AKTIF_SEZON}) eklenir.</CardDescription></CardHeader>
          <CardContent className="grid gap-5">
            <div className="grid gap-2">
              <span className="text-sm font-medium">Şube</span>
              <label className="flex items-center gap-2 text-sm"><input type="radio" checked={subeModu === "sabit"} onChange={() => setSubeModu("sabit")} className="accent-[var(--color-primary)]" /> Dosyanın tamamı tek şubeye ait:</label>
              {subeModu === "sabit" && (
                <Select className="ml-6 w-56" value={sabitSube} onChange={(e) => setSabitSube(e.target.value)}>
                  {tanimlar().subeler.filter((s) => kapsam.includes(s.id)).map((s) => <option key={s.id} value={s.id}>{s.ad}</option>)}
                </Select>
              )}
              <label className={cn("flex items-center gap-2 text-sm", eslesme.sube === undefined && "opacity-50")}>
                <input type="radio" disabled={eslesme.sube === undefined} checked={subeModu === "sutun"} onChange={() => setSubeModu("sutun")} className="accent-[var(--color-primary)]" /> Şube dosyadaki sütundan okunsun
              </label>
            </div>
            <div className="grid gap-2">
              <span className="text-sm font-medium">Grup</span>
              <label className={cn("flex items-center gap-2 text-sm", eslesme.grup === undefined && "opacity-50")}>
                <input type="radio" disabled={eslesme.grup === undefined} checked={grupModu === "sutun"} onChange={() => setGrupModu("sutun")} className="accent-[var(--color-primary)]" /> Dosyadaki grup adına göre (örn. “5-A”)
              </label>
              <label className="flex items-center gap-2 text-sm"><input type="radio" checked={grupModu === "seviye"} onChange={() => setGrupModu("seviye")} className="accent-[var(--color-primary)]" /> Sınıf seviyesine göre şubenin ilk grubuna yerleştir</label>
            </div>
          </CardContent>
          <CardContent className="flex justify-between border-t pt-4">
            <Button variant="outline" onClick={() => setAdim(1)}><ArrowLeft /> Geri</Button>
            <Button onClick={() => setAdim(3)}>Önizle <ArrowRight /></Button>
          </CardContent>
        </Card>
      )}

      {adim === 3 && (
        <div className="grid gap-4">
          <div className="grid grid-cols-3 gap-3">
            <StatCard label="Toplam satır" value={onizleme.length} />
            <StatCard label="Aktarılacak" value={gecerli.length} tone="success" icon={<CheckCircle2 />} />
            <StatCard label="Hatalı (atlanacak)" value={hatali.length} tone={hatali.length ? "danger" : "default"} icon={<AlertTriangle />} />
          </div>
          <Card>
            <CardHeader className="flex-row flex-wrap items-center justify-between gap-2">
              <CardTitle className="text-base">Önizleme ve doğrulama</CardTitle>
              <Checkbox checked={sadeceHatali} onChange={setSadeceHatali} label="Yalnızca hatalı satırlar" />
            </CardHeader>
            <Table>
              <thead><tr><Th>Satır</Th><Th>Öğrenci</Th><Th>Sınıf</Th><Th>Veli / telefon</Th><Th>Şube · grup</Th><Th>Durum</Th></tr></thead>
              <tbody>
                {onizleme.filter((s) => !sadeceHatali || s.hatalar.length).map((s) => (
                  <tr key={s.satirNo} className={cn(s.hatalar.length && "bg-danger/5")}>
                    <Td className="tabular-nums text-muted-foreground">{s.satirNo}</Td>
                    <Td className="font-medium">{`${s.ad} ${s.soyad}`.trim() || "—"}</Td>
                    <Td>{s.seviye ?? "—"}</Td>
                    <Td>{`${s.veliAd} ${s.veliSoyad}`.trim()} <span className="font-mono text-xs text-muted-foreground">{s.veliTelefon ?? ""}</span></Td>
                    <Td className="whitespace-nowrap">{s.grupId ? grupEtiket(d, s.grupId) : s.subeId ? sube(s.subeId)?.kod : "—"}</Td>
                    <Td>
                      {s.hatalar.map((h) => <p key={h} className="text-xs text-danger">✕ {h}</p>)}
                      {s.uyarilar.map((h) => <p key={h} className="text-xs text-warning">! {h}</p>)}
                      {s.kardesVeliId && !s.hatalar.length && <p className="text-xs text-primary">Kardeş: mevcut veliye bağlanacak</p>}
                      {!s.hatalar.length && !s.uyarilar.length && !s.kardesVeliId && <Badge variant="success">Hazır</Badge>}
                    </Td>
                  </tr>
                ))}
              </tbody>
            </Table>
            <CardContent className="flex flex-wrap justify-between gap-2 border-t pt-4">
              <Button variant="outline" onClick={() => setAdim(2)}><ArrowLeft /> Geri</Button>
              <div className="flex gap-2">
                <Button variant="outline" onClick={sifirla}>Düzeltip tekrar yükle</Button>
                <Button onClick={aktar} disabled={!gecerli.length}><Upload /> {gecerli.length} öğrenciyi aktar</Button>
              </div>
            </CardContent>
          </Card>
          <p className="text-xs text-muted-foreground">Telefonlar tek formata çevrilir (05xx xxx xx xx). Veliye portal daveti otomatik gitmez; “Kullanıcılar → Veli hesapları”ndan gönderebilirsiniz.</p>
        </div>
      )}

      {adim === 4 && rapor && (
        <Card>
          <CardContent className="grid gap-4 p-6 text-center">
            <CheckCircle2 className="mx-auto size-12 text-success" />
            <div>
              <p className="text-lg font-semibold">{rapor.eklenen} öğrenci eklendi</p>
              <p className="text-sm text-muted-foreground">{rapor.atlanan.length} satır atlandı</p>
            </div>
            <div className="flex flex-wrap justify-center gap-2">
              {rapor.atlanan.length > 0 && (
                <Button variant="outline" onClick={() => dosyaIndir("atlanan-satirlar.csv", csvOlustur([[...basliklar, "Hata"], ...rapor.atlanan.map((s) => [...(veri[s.satirNo - 2] ?? []), s.hatalar.join("; ")])]))}>
                  <Download /> Atlananları indir
                </Button>
              )}
              <Button variant="outline" onClick={() => { geriAl(rapor.id, ad); sifirla(); }}><RotateCcw /> Aktarımı geri al</Button>
              <Button onClick={sifirla}>Yeni aktarım</Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function geriAl(id: string, kullanici: string) {
  const p = getDb().iceAktarmalar.find((x) => x.id === id);
  if (!p || p.geriAlindi) return;
  guncelle((x) => {
    const ogr = new Set(p.ogrenciIds);
    x.ogrenciler = x.ogrenciler.filter((o) => !ogr.has(o.id));
    x.kayitlar = x.kayitlar.filter((k) => !p.kayitIds.includes(k.id));
    // Yalnızca bu partide oluşturulan ve başka öğrenciye bağlanmamış veliler silinir
    x.veliler = x.veliler.filter((v) => !p.veliIds.includes(v.id) || x.ogrenciler.some((o) => o.veliIds.includes(v.id)));
    x.iceAktarmalar = x.iceAktarmalar.map((y) => (y.id === id ? { ...y, geriAlindi: true } : y));
    islemYaz(x, kullanici, "İçe aktarma geri alındı", `${p.dosya}: ${p.ogrenciIds.length} öğrenci silindi`);
  });
  toast("Aktarım geri alındı.");
}

function OncekiAktarimlar() {
  const d = useDb();
  const { ad } = useOturum();
  if (!d.iceAktarmalar.length) return null;
  return (
    <Card>
      <CardHeader><CardTitle className="text-sm">Önceki aktarımlar</CardTitle></CardHeader>
      <CardContent className="grid gap-2 text-sm">
        {d.iceAktarmalar.slice(0, 5).map((p) => (
          <div key={p.id} className="flex items-center justify-between gap-2 rounded-md border p-2">
            <div className="min-w-0">
              <p className="truncate font-medium">{p.dosya}</p>
              <p className="text-xs text-muted-foreground">{p.personelIds?.length ? `${p.personelIds.length} personel` : `${p.ogrenciIds.length} öğrenci`} · {new Date(p.zaman).toLocaleDateString("tr-TR")}</p>
            </div>
            {p.geriAlindi ? <Badge variant="secondary">Geri alındı</Badge> : <Button size="sm" variant="ghost" onClick={() => (p.personelIds?.length ? personelGeriAl(p.id, ad) : geriAl(p.id, ad))}><RotateCcw /> Geri al</Button>}
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

/* =========================== Personel içe aktarma =========================== */
const personelSablon = ["Ad Soyad", "Görev", "Cep Telefonu", "E-posta", "Şube", "Branş"];
const personelOrnek = [
  ["Hande Yurt", "Öğretmen", "0533 410 22 11", "hande@ornekkurum.com", "Merkez", "Matematik"],
  ["Kaan Sever", "Öğretmen", "0533 410 22 12", "kaan@ornekkurum.com", "Merkez, Kuzey Şubesi", "Fen Bilimleri"],
  ["Mine Tan", "Sekreter", "0533 410 22 13", "mine@ornekkurum.com", "KZY", ""],
  ["Okan Er", "Öğretmen", "0533 41", "okan@ornekkurum.com", "Merkez", "İngilizce"],
  ["Nil Ak", "Aşçı", "0533 410 22 15", "", "Merkez", ""],
  ["Ayşe Arslan", "Öğretmen", "0532 100 00 04", "ayse@ornekkurum.com", "Merkez", "Türkçe"],
];

type PersonelSatiri = {
  satirNo: number; ad: string; soyad: string; rol: Rol | null; telefon: string | null; eposta: string;
  subeIds: string[]; dersIds: string[]; hatalar: string[]; uyarilar: string[];
};

function PersonelAktarma() {
  const d = useDb();
  const { ad, kapsam } = useOturum();
  const [tablo, setTablo] = React.useState<string[][]>([]);
  const [dosyaAdi, setDosyaAdi] = React.useState("");
  const [eslesme, setEslesme] = React.useState<Partial<Record<PersonelAlani, number>>>({});
  const [hesapAc, setHesapAc] = React.useState(true);
  const [sonuc, setSonuc] = React.useState<{ id: string; eklenen: number; atlanan: number } | null>(null);
  const [hata, setHata] = React.useState("");
  const basliklar = tablo[0] ?? [];
  const veri = tablo.slice(1);

  const yukle = async (f: File) => {
    setHata("");
    try {
      const t = /\.xlsx$/i.test(f.name) ? await xlsxOku(f) : csvCoz(await f.text());
      if (t.length < 2) throw new Error("Dosyada başlık satırı ve en az bir veri satırı olmalı.");
      setTablo(t);
      setDosyaAdi(f.name);
      setEslesme(basliklariEslestir(t[0], personelAlanlari));
      setSonuc(null);
    } catch (e) {
      setHata(e instanceof Error ? e.message : "Dosya okunamadı.");
    }
  };

  const satirlar: PersonelSatiri[] = React.useMemo(() => {
    const al = (s: string[], k: PersonelAlani) => (eslesme[k] !== undefined ? String(s[eslesme[k]!] ?? "").trim() : "");
    const gorulenTel = new Set<string>();
    const gorulenEposta = new Set<string>();
    return veri.map((s, i) => {
      const { ad: a, soyad } = adSoyadBol(al(s, "adSoyad"));
      const rol = gorevCoz(al(s, "gorev"));
      const telHam = al(s, "telefon");
      const telefon = telefonNormalize(telHam);
      const eposta = al(s, "eposta").toLocaleLowerCase("tr-TR");
      const subeAdlari = al(s, "sube").split(/[,;/]/).map((x) => normalAd(x)).filter(Boolean);
      const subeIds = subeAdlari.map((n) => d.subeler.find((x) => normalAd(x.ad) === n || normalAd(x.kod) === n || normalAd(x.ad).startsWith(n))?.id).filter(Boolean) as string[];
      const bransAdlari = al(s, "brans").split(/[,;/]/).map((x) => normalAd(x)).filter(Boolean);
      const dersIds = bransAdlari.map((n) => d.dersler.find((x) => normalAd(x.ad) === n || normalAd(x.kisaAd) === n)?.id).filter(Boolean) as string[];
      const hatalar: string[] = [];
      const uyarilar: string[] = [];
      if (!a || !soyad) hatalar.push("Ad ve soyad gerekli");
      if (!rol) hatalar.push(al(s, "gorev") ? `Tanınmayan görev: ${al(s, "gorev")}` : "Görev boş");
      else if (rol === "genel-yonetici") hatalar.push("Genel yönetici içe aktarılamaz");
      if (!telHam) hatalar.push("Telefon boş");
      else if (!telefon) hatalar.push(`Hatalı telefon: ${telHam}`);
      if (eposta && !epostaGecerli(eposta)) hatalar.push(`Hatalı e-posta: ${eposta}`);
      if (hesapAc && !eposta) uyarilar.push("E-posta yok; kullanıcı hesabı açılmayacak");
      if (subeAdlari.length !== subeIds.length) hatalar.push("Tanımsız şube");
      if (!subeIds.length) subeIds.push(kapsam[0]);
      if (subeIds.some((x) => !kapsam.includes(x))) hatalar.push("Şube kapsamınız dışında");
      if (bransAdlari.length !== dersIds.length) uyarilar.push("Bazı branşlar tanınmadı");
      if (telefon && (gorulenTel.has(telefon) || d.personel.some((p) => p.telefon === telefon))) hatalar.push("Bu telefonla kayıtlı personel var");
      if (eposta && (gorulenEposta.has(eposta) || d.kullanicilar.some((k) => k.eposta.toLocaleLowerCase("tr-TR") === eposta) || d.personel.some((p) => p.eposta.toLocaleLowerCase("tr-TR") === eposta)))
        hatalar.push("Bu e-postayla kayıtlı personel var");
      if (telefon) gorulenTel.add(telefon);
      if (eposta) gorulenEposta.add(eposta);
      return { satirNo: i + 2, ad: a, soyad, rol, telefon, eposta, subeIds, dersIds, hatalar, uyarilar };
    });
  }, [veri, eslesme, d.subeler, d.dersler, d.personel, d.kullanicilar, kapsam, hesapAc]);

  const gecerli = satirlar.filter((s) => !s.hatalar.length);
  const aktar = () => {
    const partiId = yeniId("ia");
    const ids: string[] = [];
    guncelle((x) => {
      for (const s of gecerli) {
        const pid = yeniId("p");
        ids.push(pid);
        x.personel.push({
          id: pid, ad: s.ad, soyad: s.soyad, gorev: s.rol!, telefon: s.telefon!, eposta: s.eposta, subeIds: s.subeIds, anaSubeId: s.subeIds[0],
          dersIds: s.dersIds, baslangic: BUGUN, aktif: true, ucretTipi: s.rol === "ogretmen" ? "ders" : "sabit", dersUcreti: 0, sabitUcret: 0, iceAktarmaId: partiId,
        });
        if (hesapAc && s.eposta)
          x.kullanicilar.push({ id: yeniId("u"), personelId: pid, rol: s.rol!, subeIds: s.subeIds, eposta: s.eposta, aktif: true, sonGiris: null, ikiAdim: false });
      }
      x.iceAktarmalar.unshift({ id: partiId, zaman: simdiZaman(), dosya: dosyaAdi, ogrenciIds: [], veliIds: [], kayitIds: [], personelIds: ids, atlanan: satirlar.length - gecerli.length, geriAlindi: false });
      islemYaz(x, ad, "Excel içe aktarma", `${dosyaAdi}: ${ids.length} personel eklendi`);
    });
    setSonuc({ id: partiId, eklenen: ids.length, atlanan: satirlar.length - gecerli.length });
    toast(`${ids.length} personel aktarıldı. Parolaları Bölüm 02'den “Parola sıfırla” ile oluşturun.`);
  };

  if (sonuc)
    return (
      <Card>
        <CardContent className="grid gap-4 p-6 text-center">
          <CheckCircle2 className="mx-auto size-12 text-success" />
          <p className="text-lg font-semibold">{sonuc.eklenen} personel eklendi · {sonuc.atlanan} satır atlandı</p>
          <p className="text-sm text-muted-foreground">Kullanıcı hesaplarının parolası yoktur; Bölüm 02 → Personel hesapları → anahtar simgesiyle geçici parola üretin.</p>
          <div className="flex justify-center gap-2">
            <Button variant="outline" onClick={() => { personelGeriAl(sonuc.id, ad); setSonuc(null); setTablo([]); }}><RotateCcw /> Geri al</Button>
            <Button onClick={() => { setSonuc(null); setTablo([]); }}>Yeni aktarım</Button>
          </div>
        </CardContent>
      </Card>
    );

  return (
    <div className="grid gap-4">
      {!tablo.length ? (
        <div className="grid gap-4 lg:grid-cols-[1fr_20rem]">
          <Card>
            <CardContent className="p-5">
              <label className="flex cursor-pointer flex-col items-center justify-center gap-3 rounded-lg border-2 border-dashed px-6 py-14 text-center transition hover:border-primary">
                <FileSpreadsheet className="size-10 text-primary" />
                <span className="font-medium">Personel listesini (.xlsx veya CSV) seçin</span>
                <span className="max-w-md text-sm text-muted-foreground">Sütunlar: ad soyad, görev (öğretmen / sekreter / şube müdürü), cep telefonu, e-posta, şube(ler), branş(lar).</span>
                <input type="file" accept=".xlsx,.csv,text/csv" className="sr-only" onChange={(e) => e.target.files?.[0] && yukle(e.target.files[0])} />
                <span className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground">Dosya seç</span>
              </label>
              {hata && <p className="mt-3 text-sm text-danger">{hata}</p>}
            </CardContent>
          </Card>
          <div className="grid content-start gap-3">
            <Button variant="outline" onClick={() => dosyaIndir("classmate-personel-sablonu.csv", csvOlustur([personelSablon, personelOrnek[0]]))}><Download /> Şablonu indir</Button>
            <Button variant="outline" onClick={() => { const t = [personelSablon, ...personelOrnek]; setTablo(t); setDosyaAdi("ornek-personel.csv"); setEslesme(basliklariEslestir(t[0], personelAlanlari)); }}><FileSpreadsheet /> Örnek dosyayla dene</Button>
          </div>
        </div>
      ) : (
        <>
          <Card>
            <CardHeader><CardTitle className="text-base">Sütun eşleştirme · {dosyaAdi}</CardTitle></CardHeader>
            <CardContent className="grid gap-3 sm:grid-cols-3">
              {personelAlanlari.map((a) => (
                <Field key={a.key} label={`${a.ad}${a.zorunlu ? " *" : ""}`}>
                  <Select value={eslesme[a.key] ?? ""} onChange={(e) => setEslesme({ ...eslesme, [a.key]: e.target.value === "" ? undefined : Number(e.target.value) })}>
                    <option value="">— yok —</option>
                    {basliklar.map((b, i) => <option key={i} value={i}>{b || `Sütun ${i + 1}`}</option>)}
                  </Select>
                </Field>
              ))}
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex-row flex-wrap items-center justify-between gap-2">
              <CardTitle className="text-base">Önizleme · {gecerli.length}/{satirlar.length} aktarılacak</CardTitle>
              <Checkbox checked={hesapAc} onChange={setHesapAc} label="E-postası olanlara kullanıcı hesabı aç" />
            </CardHeader>
            <Table>
              <thead><tr><Th>Satır</Th><Th>Ad soyad</Th><Th>Görev</Th><Th>Telefon</Th><Th>Şube</Th><Th>Durum</Th></tr></thead>
              <tbody>
                {satirlar.map((s) => (
                  <tr key={s.satirNo} className={cn(s.hatalar.length && "bg-danger/5")}>
                    <Td className="tabular-nums text-muted-foreground">{s.satirNo}</Td>
                    <Td className="font-medium">{`${s.ad} ${s.soyad}`.trim() || "—"}</Td>
                    <Td>{s.rol ? rolAdlari[s.rol] : "—"}</Td>
                    <Td className="font-mono text-xs">{s.telefon ?? "—"}</Td>
                    <Td>{s.subeIds.map((x) => sube(x)?.kod).join(", ")}</Td>
                    <Td>
                      {s.hatalar.map((h) => <p key={h} className="text-xs text-danger">✕ {h}</p>)}
                      {s.uyarilar.map((h) => <p key={h} className="text-xs text-warning">! {h}</p>)}
                      {!s.hatalar.length && !s.uyarilar.length && <Badge variant="success">Hazır</Badge>}
                    </Td>
                  </tr>
                ))}
              </tbody>
            </Table>
            <CardContent className="flex justify-between border-t pt-4">
              <Button variant="outline" onClick={() => setTablo([])}><ArrowLeft /> Başka dosya</Button>
              <Button onClick={aktar} disabled={!gecerli.length || eslesme.adSoyad === undefined || eslesme.gorev === undefined || eslesme.telefon === undefined}><Upload /> {gecerli.length} personeli aktar</Button>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}

function personelGeriAl(id: string, kullanici: string) {
  const p = getDb().iceAktarmalar.find((x) => x.id === id);
  if (!p || p.geriAlindi) return;
  const ids = new Set(p.personelIds ?? []);
  if (getDb().program.some((x) => ids.has(x.ogretmenId))) return toast("Aktarılan öğretmenlerden biri ders programına atanmış; önce programdan çıkarın.", "uyari");
  guncelle((x) => {
    x.kullanicilar = x.kullanicilar.filter((k) => !ids.has(k.personelId));
    x.personel = x.personel.filter((y) => !ids.has(y.id));
    x.iceAktarmalar = x.iceAktarmalar.map((y) => (y.id === id ? { ...y, geriAlindi: true } : y));
    islemYaz(x, kullanici, "İçe aktarma geri alındı", `${p.dosya}: ${ids.size} personel silindi`);
  });
  toast("Personel aktarımı geri alındı.");
}

/* =========================== Yedek ve dışa aktarma =========================== */
function DisaAktarma() {
  const d = useDb();
  const { rol } = useOturum();
  const genel = rol === "genel-yonetici";
  const [geriYukle, setGeriYukle] = React.useState<Db | null>(null);
  const [sifirlaAcik, setSifirlaAcik] = React.useState(false);
  const [yedekler, setYedekler] = React.useState<{ ad: string; boyut: number; zaman: string }[] | null>(null);
  const [vtTuru, setVtTuru] = React.useState("");
  const [demo, setDemo] = React.useState(false);
  const yedekleriYukle = React.useCallback(() => {
    if (!genel) return;
    api<{ yedekler: { ad: string; boyut: number; zaman: string }[]; vt: string }>("/api/yedek/liste")
      .then((r) => {
        setYedekler(r.yedekler);
        setVtTuru(r.vt);
      })
      .catch(() => setYedekler([]));
  }, [genel]);
  React.useEffect(() => {
    yedekleriYukle();
    api<SunucuDurumu>("/api/durum").then((r) => setDemo(r.demo)).catch(() => undefined);
  }, [yedekleriYukle]);

  const tablolar: { ad: string; uret: () => (string | number)[][] }[] = [
    { ad: "Öğrenciler", uret: () => [["Ad", "Soyad", "Doğum", "Okul", "Durum", "Sağlık notu"], ...d.ogrenciler.map((o) => [o.ad, o.soyad, o.dogum, o.okul, o.durum, o.saglikNotu])] },
    { ad: "Veliler", uret: () => [["Ad", "Soyad", "Telefon", "Yakınlık", "Bildirim", "SMS izni"], ...d.veliler.map((v) => [v.ad, v.soyad, v.telefon, v.yakinlik, v.pushAcik ? "açık" : "kapalı", v.izinSms ? "evet" : "hayır"])] },
    { ad: "Kayıtlar", uret: () => [["Sözleşme no", "Öğrenci", "Şube", "Grup", "Durum", "Tarih"], ...d.kayitlar.map((k) => [k.sozlesmeNo, tamAd(d.ogrenciler.find((o) => o.id === k.ogrenciId)), sube(k.subeId)?.ad ?? "", grupEtiket(d, k.grupId), k.durum, k.tarih])] },
    { ad: "Yoklamalar", uret: () => [["Tarih", "Grup", "Öğrenci", "Durum", "Konu"], ...Object.values(d.yoklamalar).flatMap((y) => Object.entries(y.durumlar).map(([oid, s]) => [y.tarih, grupEtiket(d, y.grupId), tamAd(d.ogrenciler.find((o) => o.id === oid)), s, y.konu]))] },
    { ad: "Personel", uret: () => [["Ad", "Soyad", "Görev", "Telefon", "E-posta", "Aktif"], ...d.personel.map((p) => [p.ad, p.soyad, p.gorev, p.telefon, p.eposta, p.aktif ? "evet" : "hayır"])] },
    { ad: "Gönderimler", uret: () => [["Zaman", "Olay", "Kanal", "Alıcı", "Metin", "Durum", "Maliyet"], ...d.gonderimler.map((g) => [g.zaman, g.olay, g.kanal, g.alici, g.metin, g.durum, g.maliyet])] },
  ];
  const tamYedek = async () => {
    try {
      const y = await api<Db>("/api/yedek");
      dosyaIndir(`classmate-yedek-${BUGUN}.json`, JSON.stringify(y), "application/json");
    } catch (e) {
      toast(e instanceof Error ? e.message : "Yedek alınamadı.", "hata");
    }
  };
  const simdiYedekle = async () => {
    try {
      const r = await api<{ ad: string }>("/api/yedek/al", {});
      toast(`Sunucuda yedek alındı: ${r.ad}`);
      yedekleriYukle();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Yedek alınamadı.", "hata");
    }
  };
  const dosyaSec = async (f: File) => {
    try {
      const y = JSON.parse(await f.text()) as Db;
      if (!y.ogrenciler || !y.kayitlar || y.surum !== d.surum) throw new Error();
      setGeriYukle(y);
    } catch {
      toast("Geçerli bir Classmate yedeği değil (veya farklı sürüm).", "hata");
    }
  };
  const geriYukleOnay = async () => {
    try {
      await senkron();
      await api("/api/yedek", geriYukle);
      setGeriYukle(null);
      await veriYukle();
      toast("Yedek geri yüklendi.");
    } catch (e) {
      toast(e instanceof Error ? e.message : "Geri yüklenemedi.", "hata");
    }
  };
  const sifirla = async () => {
    try {
      await senkron();
      await api("/api/demo/sifirla", {});
      setSifirlaAcik(false);
      await veriYukle();
      toast("Örnek veri yeniden üretildi.");
    } catch (e) {
      toast(e instanceof Error ? e.message : "Sıfırlanamadı.", "hata");
    }
  };
  const boyut = (b: number) => (b > 1e6 ? `${(b / 1e6).toFixed(1)} MB` : `${Math.round(b / 1e3)} KB`);

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card>
        <CardHeader><CardTitle className="text-base">Excel olarak dışa aktar</CardTitle><CardDescription>Veri sizindir: yetkiniz dahilindeki tüm tablolar her zaman indirilebilir.</CardDescription></CardHeader>
        <CardContent className="grid gap-2 sm:grid-cols-2">
          {tablolar.map((t) => (
            <Button key={t.ad} variant="outline" className="justify-start" onClick={() => dosyaIndir(`${normalAd(t.ad)}-${BUGUN}.csv`, csvOlustur(t.uret()))}>
              <Download /> {t.ad}
            </Button>
          ))}
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Yedekleme</CardTitle>
          <CardDescription>Sunucu her gece 03:00'ten sonra tam yedek alır ve 30 gün saklar. Veritabanı: {vtTuru === "postgres" ? "PostgreSQL" : vtTuru === "pglite" ? "gömülü PostgreSQL (PGlite)" : "—"}.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3">
          {!genel ? (
            <Alert icon={<Lock />}>Yedek işlemlerini yalnızca genel yönetici yapabilir.</Alert>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-3">
                <StatCard label="Son yedek" value={yedekler?.[0] ? new Date(yedekler[0].zaman).toLocaleString("tr-TR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : "—"} hint={yedekler?.[0] ? boyut(yedekler[0].boyut) : "Henüz yedek yok"} tone={yedekler?.[0] ? "success" : "warning"} />
                <StatCard label="Saklanan yedek" value={yedekler?.length ?? "…"} hint="son 30 gün" />
              </div>
              {!!yedekler?.length && (
                <ul className="max-h-40 divide-y overflow-y-auto rounded-md border text-sm">
                  {yedekler.map((y) => (
                    <li key={y.ad} className="flex items-center justify-between gap-2 px-3 py-1.5">
                      <span className="truncate font-mono text-xs">{y.ad}</span>
                      <a className="text-xs text-primary underline" href={`/api/yedek/dosya/${y.ad}`}>İndir</a>
                    </li>
                  ))}
                </ul>
              )}
              <div className="grid gap-2 sm:grid-cols-2">
                <Button variant="outline" onClick={simdiYedekle}><DatabaseBackup /> Şimdi yedek al</Button>
                <Button variant="outline" onClick={tamYedek}><Download /> Yedeği bilgisayara indir</Button>
              </div>
              <label className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-md border px-4 py-2 text-sm font-medium hover:bg-muted">
                <Upload className="size-4" /> Yedekten geri yükle
                <input type="file" accept="application/json,.json" className="sr-only" onChange={(e) => e.target.files?.[0] && dosyaSec(e.target.files[0])} />
              </label>
              {demo && <Button variant="ghost" className="text-danger" onClick={() => setSifirlaAcik(true)}><Trash2 /> Örnek veriyi baştan üret (demo)</Button>}
            </>
          )}
        </CardContent>
      </Card>
      <Dialog
        open={!!geriYukle}
        onClose={() => setGeriYukle(null)}
        title="Yedekten geri yükle"
        description="Sunucudaki tüm veriler yedektekiyle değiştirilecek. Öncesinde otomatik yedek almanız önerilir."
        footer={<><Button variant="outline" onClick={() => setGeriYukle(null)}>Vazgeç</Button><Button variant="destructive" onClick={geriYukleOnay}>Geri yükle</Button></>}
      >
        {geriYukle && <p className="text-sm">Yedekte {geriYukle.ogrenciler.length} öğrenci, {geriYukle.kayitlar.length} kayıt, {Object.keys(geriYukle.yoklamalar).length} yoklama var.</p>}
      </Dialog>
      <Dialog
        open={sifirlaAcik}
        onClose={() => setSifirlaAcik(false)}
        title="Örnek veriyi sıfırla"
        description="Tüm demo verileri (yaptığınız değişiklikler dahil) silinip baştan üretilir."
        footer={<><Button variant="outline" onClick={() => setSifirlaAcik(false)}>Vazgeç</Button><Button variant="destructive" onClick={sifirla}>Sıfırla</Button></>}
      >
        <Alert tone="warning" icon={<AlertTriangle />}>Yalnızca demo kurulumunda kullanılabilir.</Alert>
      </Dialog>
    </div>
  );
}

/* =========================== İşlem kaydı =========================== */
function IslemKaydi() {
  const d = useDb();
  const { subeGorunur, rol } = useOturum();
  const [ara, setAra] = React.useState("");
  const [tur, setTur] = React.useState("all");
  const turler = [...new Set(d.islemler.map((i) => i.islem))].sort((a, b) => a.localeCompare(b, "tr"));
  const liste = d.islemler.filter(
    (i) => (rol === "genel-yonetici" ? true : !i.subeId || subeGorunur(i.subeId)) && (tur === "all" || i.islem === tur) && normalAd(`${i.kullanici} ${i.detay}`).includes(normalAd(ara)),
  );
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">İşlem kaydı (audit log)</CardTitle>
        <CardDescription>Kayıt iptali, tahsilat iptali, indirim, yetki ve program değişiklikleri gibi önemli işlemler. Kayıtlar değiştirilemez.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-wrap gap-2 pb-4">
        <div className="relative min-w-48 flex-1">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Kullanıcı veya detay ara" className="pl-8" value={ara} onChange={(e) => setAra(e.target.value)} />
        </div>
        <Select aria-label="İşlem türü" className="w-56" value={tur} onChange={(e) => setTur(e.target.value)}>
          <option value="all">Tüm işlemler</option>
          {turler.map((t) => <option key={t}>{t}</option>)}
        </Select>
        <Button variant="outline" onClick={() => dosyaIndir(`islem-kaydi-${BUGUN}.csv`, csvOlustur([["Zaman", "Kullanıcı", "İşlem", "Detay", "Şube"], ...liste.map((i) => [i.zaman, i.kullanici, i.islem, i.detay, sube(i.subeId)?.ad ?? "Genel"])]))}>
          <Download /> CSV
        </Button>
      </CardContent>
      {liste.length === 0 ? (
        <CardContent><EmptyState icon={<History />} title="Kayıt yok" text="Filtreye uyan işlem bulunamadı." /></CardContent>
      ) : (
        <Table>
          <thead><tr><Th>Zaman</Th><Th>Kullanıcı</Th><Th>İşlem</Th><Th>Detay</Th><Th>Şube</Th></tr></thead>
          <tbody>
            {liste.slice(0, 100).map((i) => (
              <tr key={i.id}>
                <Td className="whitespace-nowrap tabular-nums text-muted-foreground">{new Date(i.zaman).toLocaleString("tr-TR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</Td>
                <Td className="whitespace-nowrap">{i.kullanici}</Td>
                <Td><Badge variant="outline">{i.islem}</Badge></Td>
                <Td>{i.detay}</Td>
                <Td className="font-mono text-xs">{sube(i.subeId)?.kod ?? "—"}</Td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}
    </Card>
  );
}

/* =========================== KVKK =========================== */
function Kvkk() {
  const d = useDb();
  const { ad, rol } = useOturum();
  const [ara, setAra] = React.useState("");
  const [onay, setOnay] = React.useState<{ tur: "veli" | "ogrenci"; id: string } | null>(null);
  const q = normalAd(ara);
  const sonuc =
    q.length >= 2
      ? [
          ...d.ogrenciler.filter((o) => normalAd(tamAd(o)).includes(q)).map((o) => ({ tur: "ogrenci" as const, id: o.id, ad: tamAd(o), alt: `Öğrenci · ${o.durum === "aktif" ? "aktif" : "ayrıldı"}` })),
          ...d.veliler.filter((v) => normalAd(`${tamAd(v)} ${v.telefon.replace(/\s/g, "")}`).includes(q.replace(/\s/g, ""))).map((v) => ({ tur: "veli" as const, id: v.id, ad: tamAd(v), alt: `Veli · ${v.telefon}` })),
        ].slice(0, 10)
      : [];
  const saklamaSiniri = d.ayarlar.saklamaAyAday * 30;
  const eskiAdaylar = d.adaylar.filter((a) => a.durum === "vazgecti" && !a.veliAd.includes("***") && gunFarki(a.olusturma, BUGUN) > saklamaSiniri);
  const vazgecenler = d.adaylar.filter((a) => a.durum === "vazgecti" && !a.veliAd.includes("***"));

  const bilgiVer = (tur: "veli" | "ogrenci", id: string) => {
    const kisi = tur === "veli" ? d.veliler.find((v) => v.id === id) : d.ogrenciler.find((o) => o.id === id);
    const ilgili =
      tur === "veli"
        ? { veli: kisi, cocuklar: d.ogrenciler.filter((o) => o.veliIds.includes(id)), mesajlar: d.gonderimler.filter((g) => g.veliId === id) }
        : { ogrenci: kisi, kayitlar: d.kayitlar.filter((k) => k.ogrenciId === id), yoklama: Object.values(d.yoklamalar).filter((y) => y.durumlar[id]).map((y) => ({ tarih: y.tarih, durum: y.durumlar[id], konu: y.konu })) };
    dosyaIndir(`kvkk-bilgi-${id}.json`, JSON.stringify(ilgili, null, 2), "application/json");
    guncelle((x) => {
      x.kvkk.unshift({ id: yeniId("kv"), zaman: simdiZaman(), kisi: tamAd(kisi as { ad: string; soyad: string }), tur: "bilgi", durum: "tamamlandi", not: "Kişisel veri dökümü verildi." });
      islemYaz(x, ad, "KVKK bilgi talebi", tamAd(kisi as { ad: string; soyad: string }));
    });
  };
  const anonim = () => {
    if (!onay) return;
    guncelle((x) => {
      let kisiAd = "";
      if (onay.tur === "ogrenci") {
        x.ogrenciler = x.ogrenciler.map((o) => {
          if (o.id !== onay.id) return o;
          kisiAd = tamAd(o);
          return { ...o, ad: anonimlestir(o.ad), soyad: anonimlestir(o.soyad), dogum: "", okul: "", saglikNotu: "", notlar: [], durum: "ayrildi" };
        });
        x.kayitlar = x.kayitlar.map((k) => (k.ogrenciId === onay.id && k.durum !== "iptal" ? { ...k, durum: "iptal" } : k));
      } else {
        x.veliler = x.veliler.map((v) => {
          if (v.id !== onay.id) return v;
          kisiAd = tamAd(v);
          return { ...v, ad: anonimlestir(v.ad), soyad: anonimlestir(v.soyad), telefon: "*** *** ** **", eposta: "", pushAcik: false, izinSms: false, izinTanitim: false };
        });
      }
      x.kvkk.unshift({ id: yeniId("kv"), zaman: simdiZaman(), kisi: `${anonimlestir(kisiAd.split(" ")[0])} ${anonimlestir(kisiAd.split(" ").slice(-1)[0])}`, tur: "silme", durum: "tamamlandi", not: "Kişisel veriler anonimleştirildi; istatistikler korundu." });
      islemYaz(x, ad, "KVKK silme", `${onay.tur === "veli" ? "Veli" : "Öğrenci"} verisi anonimleştirildi`);
    });
    toast("Kişisel veriler anonimleştirildi.");
    setOnay(null);
    setAra("");
  };
  const adaylariAnonimlestir = (liste: typeof vazgecenler) => {
    guncelle((x) => {
      const ids = new Set(liste.map((a) => a.id));
      x.adaylar = x.adaylar.map((a) => (ids.has(a.id) ? { ...a, veliAd: `${anonimlestir(a.veliAd)} ***`, veliTelefon: "*** *** ** **", ogrenciAd: anonimlestir(a.ogrenciAd), notlar: [] } : a));
      x.kvkk.unshift({ id: yeniId("kv"), zaman: simdiZaman(), kisi: `${liste.length} vazgeçen aday`, tur: "silme", durum: "tamamlandi", not: "Saklama süresi dolan aday verileri anonimleştirildi." });
      islemYaz(x, ad, "KVKK saklama süresi", `${liste.length} vazgeçen aday anonimleştirildi`);
    });
    toast(`${liste.length} aday anonimleştirildi.`);
  };

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card>
        <CardHeader><CardTitle className="text-base">Veri sahibi başvurusu</CardTitle><CardDescription>Bilgi talebinde kişinin tüm verisini indirin; silme talebinde anonimleştirin (istatistikler bozulmaz).</CardDescription></CardHeader>
        <CardContent className="grid gap-3">
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input placeholder="Öğrenci / veli adı veya telefon" className="pl-8" value={ara} onChange={(e) => setAra(e.target.value)} />
          </div>
          {sonuc.map((s) => (
            <div key={`${s.tur}${s.id}`} className="flex items-center justify-between gap-2 rounded-md border p-2.5 text-sm">
              <div><p className="font-medium">{s.ad}</p><p className="text-xs text-muted-foreground">{s.alt}</p></div>
              <div className="flex gap-1">
                <Button size="sm" variant="outline" onClick={() => bilgiVer(s.tur, s.id)}><Download /> Döküm</Button>
                {rol === "genel-yonetici" && <Button size="sm" variant="ghost" className="text-danger" onClick={() => setOnay({ tur: s.tur, id: s.id })}><UserX /> Anonimleştir</Button>}
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle className="text-base">Saklama süreleri</CardTitle><CardDescription>Vazgeçen adaylar {d.ayarlar.saklamaAyAday} ay, ayrılan öğrenciler {d.ayarlar.saklamaAyOgrenci} ay sonra anonimleştirilir.</CardDescription></CardHeader>
        <CardContent className="grid gap-3">
          <div className="grid grid-cols-2 gap-3">
            <StatCard label="Süresi dolan aday" value={eskiAdaylar.length} tone={eskiAdaylar.length ? "warning" : "default"} />
            <StatCard label="Vazgeçen aday (toplam)" value={vazgecenler.length} />
          </div>
          <Button variant="outline" disabled={!eskiAdaylar.length} onClick={() => adaylariAnonimlestir(eskiAdaylar)}>Süresi dolanları anonimleştir</Button>
          {rol === "genel-yonetici" && vazgecenler.length > 0 && <Button variant="ghost" onClick={() => adaylariAnonimlestir(vazgecenler)}>Tüm vazgeçen adayları şimdi anonimleştir</Button>}
          <Alert icon={<Lock />}>
            Veri minimizasyonu: TCKN istenmez; sağlık notu yalnızca gerekirse girilir. Aydınlatma ve açık rıza kayıtta alınır, sürümü ve tarihi saklanır.
            Yurt dışına veri aktarımı (bulut, WhatsApp) ayrıca değerlendirilir.
          </Alert>
        </CardContent>
      </Card>
      <Card className="lg:col-span-2">
        <CardHeader><CardTitle className="text-base">Başvuru kayıtları</CardTitle></CardHeader>
        <Table>
          <thead><tr><Th>Zaman</Th><Th>Kişi</Th><Th>Tür</Th><Th>Not</Th><Th>Durum</Th></tr></thead>
          <tbody>
            {d.kvkk.map((k) => (
              <tr key={k.id}>
                <Td className="tabular-nums text-muted-foreground">{new Date(k.zaman).toLocaleDateString("tr-TR")}</Td>
                <Td>{k.kisi}</Td>
                <Td>{k.tur === "bilgi" ? "Bilgi talebi" : k.tur === "silme" ? "Silme" : "Düzeltme"}</Td>
                <Td className="text-muted-foreground">{k.not}</Td>
                <Td><Badge variant={k.durum === "tamamlandi" ? "success" : "warning"}>{k.durum === "tamamlandi" ? "Tamamlandı" : "Açık"}</Badge></Td>
              </tr>
            ))}
          </tbody>
        </Table>
      </Card>
      <Dialog
        open={!!onay}
        onClose={() => setOnay(null)}
        title="Kişisel veriyi anonimleştir"
        description="Ad, telefon, doğum tarihi, sağlık notu ve notlar kalıcı olarak silinir; yoklama ve ödeme istatistikleri kimliksiz olarak korunur. Geri alınamaz."
        footer={<><Button variant="outline" onClick={() => setOnay(null)}>Vazgeç</Button><Button variant="destructive" onClick={anonim}>Anonimleştir</Button></>}
      >
        <Alert tone="warning" icon={<AlertTriangle />}>Aktif kaydı olan öğrencinin kaydı iptal edilir.</Alert>
      </Dialog>
    </div>
  );
}

/* =========================== Sistem ayarları =========================== */
function SistemAyarlari() {
  const d = useDb();
  const { ad, rol } = useOturum();
  const [f, setF] = React.useState<Ayarlar>(d.ayarlar);
  const duzenler = rol === "genel-yonetici";
  const sayi = (k: keyof Ayarlar, etiket: string, ipucu?: string) => (
    <Field label={etiket} hint={ipucu}>
      <Input type="number" min={0} disabled={!duzenler} value={f[k] as number} onChange={(e) => setF({ ...f, [k]: Number(e.target.value) })} />
    </Field>
  );
  const kaydet = () => {
    guncelle((x) => {
      x.ayarlar = { ...f, hatirlatmaGunleri: f.hatirlatmaGunleri };
      islemYaz(x, ad, "Sistem ayarları", "Ayarlar güncellendi");
    });
    toast("Ayarlar kaydedildi.");
  };
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card>
        <CardHeader><CardTitle className="text-base">Kurallar</CardTitle><CardDescription>Bölümler bu eşikleri kullanır.</CardDescription></CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2">
          {sayi("devamsizlikEsigi", "Haftalık devamsızlık uyarı eşiği", "07 · yöneticiye uyarı")}
          {sayi("yoklamaHatirlatmaDk", "Yoklama hatırlatma (dk)", "07 · ders başlangıcından sonra")}
          {sayi("subeGecisDk", "Şubeler arası geçiş süresi (dk)", "06 · altındaysa uyarı")}
          {sayi("etutIptalSaat", "Etüt iptal süresi (saat)", "09 · veli en geç")}
          {sayi("saklamaAyAday", "Vazgeçen aday saklama (ay)", "14 · KVKK")}
          {sayi("saklamaAyOgrenci", "Ayrılan öğrenci saklama (ay)", "14 · KVKK")}
          {sayi("oturumGun", "Veli oturum süresi (gün)", "11 · SMS kodu maliyetini düşürür")}
          <Field label="Taksit hatırlatma günleri" hint="05 · vadeye göre (−3 = 3 gün önce)">
            <Input disabled={!duzenler} value={f.hatirlatmaGunleri.join(", ")} onChange={(e) => setF({ ...f, hatirlatmaGunleri: e.target.value.split(",").map((x) => Number(x.trim())).filter((x) => !Number.isNaN(x)) })} />
          </Field>
          <div className="flex items-center justify-between rounded-md border p-3 sm:col-span-2">
            <div><p className="text-sm font-medium">Gelmeyen öğrencinin özel ders hakkı düşsün</p><p className="text-xs text-muted-foreground">09 · kurum politikası</p></div>
            <Switch label="Hak düşsün" disabled={!duzenler} checked={f.gelmeyenHakDussun} onCheckedChange={(v) => setF({ ...f, gelmeyenHakDussun: v })} />
          </div>
          {duzenler && <Button className="justify-self-start" onClick={kaydet}>Kaydet</Button>}
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle className="text-base">Güvenlik</CardTitle><CardDescription>Sunucu tarafında uygulanacak kontroller (arka uç geliştirmesinde zorunlu).</CardDescription></CardHeader>
        <CardContent className="grid gap-2 text-sm">
          {[
            ["HTTPS ve güçlü parola politikası", true],
            ["Genel yönetici için iki adımlı doğrulama", d.kullanicilar.filter((k) => k.rol === "genel-yonetici").every((k) => k.ikiAdim)],
            ["Rol + şube kapsamı her sorguda sunucuda uygulanır (şube_id filtresi)", true],
            ["Veli SMS kodu deneme limiti (5 deneme / 15 dk)", true],
            ["Oturum zaman aşımı (personel 8 saat)", true],
            ["İşlem kaydı: finans, kayıt iptali, yetki değişiklikleri", true],
            ["Günlük yedek, 30 gün saklama, aylık geri dönüş testi", true],
          ].map(([m, ok]) => (
            <div key={String(m)} className="flex items-center gap-2 rounded-md border p-2.5">
              {ok ? <CheckCircle2 className="size-4 shrink-0 text-success" /> : <AlertTriangle className="size-4 shrink-0 text-warning" />}
              {m}
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

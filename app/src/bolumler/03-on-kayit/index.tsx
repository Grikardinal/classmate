/**
 * Bölüm 03 · Ön kayıt (aday öğrenci) yönetimi
 * Doküman: docs/bolumler/03-on-kayit.md
 */
import * as React from "react";
import { useNavigate } from "react-router-dom";
import {
  BarChart3,
  CalendarClock,
  Columns3,
  Globe,
  List,
  MessageSquarePlus,
  PhoneCall,
  Plus,
  Search,
  UserCheck,
  UserPlus,
  TrendingUp,
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
  Sheet,
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
  guncelle,
  islemYaz,
  personelAdi,
  simdiZaman,
  smsBoyuMaliyet,
  sube,
  useDb,
  yeniId,
  type Aday,
  type AdayDurum,
} from "@/data/store";
import { gunFarki, sablonDoldur, telefonNormalize, tl } from "@/lib/kurallar";
import { cn } from "@/lib/utils";

export const adayDurumlari: { key: AdayDurum; ad: string; renk: "default" | "secondary" | "success" | "warning" | "danger" | "outline" }[] = [
  { key: "yeni", ad: "Yeni aday", renk: "default" },
  { key: "gorusuldu", ad: "Görüşüldü", renk: "outline" },
  { key: "deneme", ad: "Deneme dersi", renk: "warning" },
  { key: "dusunuyor", ad: "Düşünüyor", renk: "secondary" },
  { key: "kayit", ad: "Kayıt oldu", renk: "success" },
  { key: "vazgecti", ad: "Vazgeçti", renk: "danger" },
];
const durumAd = (k: AdayDurum) => adayDurumlari.find((x) => x.key === k)!;
const kaynaklar = ["Tavsiye", "Instagram", "Google", "Tabela", "Eski öğrenci", "Web formu", "Diğer"];
const vazgecmeNedenleri = ["Fiyat", "Saat uymadı", "Başka kurum", "Ulaşım", "Diğer"];

const tarihKisa = (iso: string | null) => (iso ? new Date(iso.slice(0, 10) + "T00:00:00").toLocaleDateString("tr-TR", { day: "numeric", month: "short" }) : "—");

type Gorunum = "liste" | "pano" | "rapor";

export default function OnKayit() {
  const d = useDb();
  const { subeGorunur } = useOturum();
  const [gorunum, setGorunum] = React.useState<Gorunum>("liste");
  const [secili, setSecili] = React.useState<string | null>(null);
  const [hizliAcik, setHizliAcik] = React.useState(false);
  const [formAcik, setFormAcik] = React.useState(false);

  const adaylar = d.adaylar.filter((a) => subeGorunur(a.subeId));
  const acik = adaylar.filter((a) => a.durum !== "kayit" && a.durum !== "vazgecti");
  const bugunAranacak = acik.filter((a) => a.sonrakiAksiyon && a.sonrakiAksiyon <= BUGUN);
  const sonuclanan = adaylar.filter((a) => a.durum === "kayit" || a.durum === "vazgecti");
  const donusum = sonuclanan.length ? Math.round((adaylar.filter((a) => a.durum === "kayit").length / sonuclanan.length) * 100) : 0;

  return (
    <div className="grid gap-6">
      <PageHeader
        code="03"
        title="Ön kayıt"
        description="Bilgi almak için arayan veya formu dolduran velileri kaybetmeyin; kesin kayda dönüşümü takip edin."
        actions={
          <>
            <Button variant="outline" onClick={() => setFormAcik(true)}>
              <Globe /> Web formu
            </Button>
            <Button onClick={() => setHizliAcik(true)}>
              <UserPlus /> Hızlı ekle
            </Button>
          </>
        }
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Açık aday" value={acik.length} icon={<UserPlus />} />
        <StatCard label="Bugün aranacak" value={bugunAranacak.length} icon={<PhoneCall />} tone={bugunAranacak.length ? "warning" : "default"} hint="Sonraki aksiyon tarihi gelenler" />
        <StatCard label="Kayda dönen" value={adaylar.filter((a) => a.durum === "kayit").length} icon={<UserCheck />} tone="success" />
        <StatCard label="Dönüşüm oranı" value={`%${donusum}`} icon={<TrendingUp />} hint="Sonuçlanan adaylar içinde" />
      </div>

      {bugunAranacak.length > 0 && (
        <Alert tone="warning" icon={<CalendarClock />}>
          <b>Bugün aranacaklar:</b>{" "}
          {bugunAranacak.map((a, i) => (
            <React.Fragment key={a.id}>
              {i > 0 && ", "}
              <button className="underline underline-offset-2 hover:text-primary" onClick={() => setSecili(a.id)}>
                {a.veliAd}
              </button>
            </React.Fragment>
          ))}
        </Alert>
      )}

      <Tabs
        value={gorunum}
        onChange={setGorunum}
        items={[
          { value: "liste", label: "Liste", icon: <List /> },
          { value: "pano", label: "Pano", icon: <Columns3 /> },
          { value: "rapor", label: "Raporlar", icon: <BarChart3 /> },
        ]}
      />

      {gorunum === "liste" && <AdayListesi adaylar={adaylar} onSec={setSecili} />}
      {gorunum === "pano" && <AdayPanosu adaylar={adaylar} onSec={setSecili} />}
      {gorunum === "rapor" && <AdayRaporlari adaylar={adaylar} />}

      {secili && <AdayKarti id={secili} onClose={() => setSecili(null)} />}
      <HizliEkle open={hizliAcik} onClose={() => setHizliAcik(false)} />
      <WebFormu open={formAcik} onClose={() => setFormAcik(false)} />
    </div>
  );
}

function AksiyonTarihi({ a }: { a: Aday }) {
  if (!a.sonrakiAksiyon || a.durum === "kayit" || a.durum === "vazgecti") return <span className="text-muted-foreground">—</span>;
  const fark = gunFarki(BUGUN, a.sonrakiAksiyon);
  return (
    <span className={cn("tabular-nums", fark < 0 ? "font-medium text-danger" : fark === 0 ? "font-medium text-warning" : "")}>
      {fark === 0 ? "Bugün" : fark < 0 ? `${-fark} gün gecikti` : tarihKisa(a.sonrakiAksiyon)}
    </span>
  );
}

/* ---------- Liste ---------- */
function AdayListesi({ adaylar, onSec }: { adaylar: Aday[]; onSec: (id: string) => void }) {
  const d = useDb();
  const [ara, setAra] = React.useState("");
  const [durum, setDurum] = React.useState<AdayDurum | "acik" | "all">("acik");
  const [kaynak, setKaynak] = React.useState("all");
  const liste = adaylar
    .filter((a) => {
      if (durum === "acik" && (a.durum === "kayit" || a.durum === "vazgecti")) return false;
      if (durum !== "acik" && durum !== "all" && a.durum !== durum) return false;
      if (kaynak !== "all" && a.kaynak !== kaynak) return false;
      const q = ara.toLocaleLowerCase("tr");
      return !q || `${a.veliAd} ${a.ogrenciAd} ${a.veliTelefon.replace(/\s/g, "")}`.toLocaleLowerCase("tr").includes(q.replace(/\s/g, ""));
    })
    .sort((a, b) => (a.sonrakiAksiyon ?? "9999").localeCompare(b.sonrakiAksiyon ?? "9999"));

  return (
    <Card>
      <CardContent className="flex flex-wrap gap-2 p-4">
        <div className="relative min-w-48 flex-1">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Veli, öğrenci veya telefon" className="pl-8" value={ara} onChange={(e) => setAra(e.target.value)} />
        </div>
        <Select aria-label="Durum" className="w-40" value={durum} onChange={(e) => setDurum(e.target.value as typeof durum)}>
          <option value="acik">Açık adaylar</option>
          <option value="all">Tümü</option>
          {adayDurumlari.map((x) => (
            <option key={x.key} value={x.key}>{x.ad}</option>
          ))}
        </Select>
        <Select aria-label="Kaynak" className="w-40" value={kaynak} onChange={(e) => setKaynak(e.target.value)}>
          <option value="all">Tüm kaynaklar</option>
          {kaynaklar.map((k) => (
            <option key={k}>{k}</option>
          ))}
        </Select>
      </CardContent>
      {liste.length === 0 ? (
        <CardContent>
          <EmptyState icon={<UserPlus />} title="Aday bulunamadı" text="Filtreleri değiştirin veya yeni aday ekleyin." />
        </CardContent>
      ) : (
        <Table>
          <thead>
            <tr>
              <Th>Öğrenci</Th>
              <Th>Veli</Th>
              <Th>Şube</Th>
              <Th>Kaynak</Th>
              <Th>Durum</Th>
              <Th>Sonraki aksiyon</Th>
              <Th>Sorumlu</Th>
            </tr>
          </thead>
          <tbody>
            {liste.map((a) => (
              <tr key={a.id} className="cursor-pointer hover:bg-muted/50" onClick={() => onSec(a.id)}>
                <Td>
                  <p className="font-medium">{a.ogrenciAd}</p>
                  <p className="text-xs text-muted-foreground">{a.seviye}. sınıf · {a.okul}</p>
                </Td>
                <Td>
                  <p>{a.veliAd}</p>
                  <p className="font-mono text-xs text-muted-foreground">{a.veliTelefon}</p>
                </Td>
                <Td className="font-mono text-xs">{sube(a.subeId)?.kod}</Td>
                <Td>{a.kaynak}</Td>
                <Td><Badge variant={durumAd(a.durum).renk}>{durumAd(a.durum).ad}</Badge></Td>
                <Td><AksiyonTarihi a={a} /></Td>
                <Td className="text-muted-foreground">{personelAdi(d, a.sorumluId)}</Td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}
    </Card>
  );
}

/* ---------- Pano (sürükle-bırak) ---------- */
function AdayPanosu({ adaylar, onSec }: { adaylar: Aday[]; onSec: (id: string) => void }) {
  const { ad: oturumAd } = useOturum();
  const [hedef, setHedef] = React.useState<AdayDurum | null>(null);
  const tasi = (id: string, durum: AdayDurum) => {
    const a = adaylar.find((x) => x.id === id);
    if (!a || a.durum === durum) return;
    if (durum === "kayit") {
      toast("Kesin kayıt için aday kartındaki “Kesin kayda çevir” düğmesini kullanın.", "uyari");
      onSec(id);
      return;
    }
    guncelle((x) => {
      x.adaylar = x.adaylar.map((y) =>
        y.id === id
          ? {
              ...y,
              durum,
              vazgecmeNedeni: durum === "vazgecti" ? y.vazgecmeNedeni ?? "Diğer" : null,
              notlar: [...y.notlar, { tarih: simdiZaman(), yazar: oturumAd, metin: `Durum: ${durumAd(durum).ad}` }],
            }
          : y,
      );
    });
  };
  return (
    <div className="no-scrollbar -mx-4 overflow-x-auto px-4">
      <div className="grid min-w-[1000px] grid-cols-6 gap-3">
        {adayDurumlari.map((s) => {
          const liste = adaylar.filter((a) => a.durum === s.key);
          return (
            <div
              key={s.key}
              onDragOver={(e) => {
                e.preventDefault();
                setHedef(s.key);
              }}
              onDragLeave={() => setHedef(null)}
              onDrop={(e) => {
                tasi(e.dataTransfer.getData("text/plain"), s.key);
                setHedef(null);
              }}
              className={cn("flex min-h-64 flex-col gap-2 rounded-lg bg-muted/60 p-2 transition", hedef === s.key && "ring-2 ring-primary/50")}
            >
              <div className="flex items-center justify-between px-1.5 py-1">
                <span className="text-sm font-medium">{s.ad}</span>
                <Badge variant="secondary">{liste.length}</Badge>
              </div>
              {liste.map((a) => (
                <button
                  key={a.id}
                  draggable
                  onDragStart={(e) => e.dataTransfer.setData("text/plain", a.id)}
                  onClick={() => onSec(a.id)}
                  className="rounded-md border bg-card p-2.5 text-left text-sm shadow-xs transition hover:border-primary/40"
                >
                  <p className="font-medium">{a.ogrenciAd}</p>
                  <p className="text-xs text-muted-foreground">{a.seviye}. sınıf · {sube(a.subeId)?.kod}</p>
                  <p className="mt-1.5 text-xs"><AksiyonTarihi a={a} /></p>
                </button>
              ))}
            </div>
          );
        })}
      </div>
      <p className="mt-2 text-xs text-muted-foreground">Kartları sürükleyerek durumunu değiştirin.</p>
    </div>
  );
}

/* ---------- Raporlar ---------- */
function OranCubugu({ etiket, toplam, kayit }: { etiket: string; toplam: number; kayit: number }) {
  const oran = toplam ? kayit / toplam : 0;
  return (
    <div className="grid grid-cols-[7rem_1fr_6rem] items-center gap-3 text-sm">
      <span className="truncate">{etiket}</span>
      <div className="h-2 overflow-hidden rounded-full bg-muted">
        <div className="h-full rounded-full bg-primary" style={{ width: `${oran * 100}%` }} />
      </div>
      <span className="text-right tabular-nums text-muted-foreground">
        {kayit}/{toplam} · %{Math.round(oran * 100)}
      </span>
    </div>
  );
}

function AdayRaporlari({ adaylar }: { adaylar: Aday[] }) {
  const grupla = (anahtar: (a: Aday) => string) => {
    const m = new Map<string, { toplam: number; kayit: number }>();
    for (const a of adaylar) {
      const k = anahtar(a);
      const v = m.get(k) ?? { toplam: 0, kayit: 0 };
      v.toplam++;
      if (a.durum === "kayit") v.kayit++;
      m.set(k, v);
    }
    return [...m.entries()].sort((a, b) => b[1].toplam - a[1].toplam);
  };
  const nedenler = vazgecmeNedenleri
    .map((n) => [n, adaylar.filter((a) => a.durum === "vazgecti" && a.vazgecmeNedeni === n).length] as const)
    .filter(([, c]) => c > 0);
  const enCok = Math.max(1, ...nedenler.map(([, c]) => c));
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Kaynağa göre dönüşüm</CardTitle>
          <CardDescription>Kayıt olan / toplam aday</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3">
          {grupla((a) => a.kaynak).map(([k, v]) => (
            <OranCubugu key={k} etiket={k} {...v} />
          ))}
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Şubeye göre dönüşüm</CardTitle>
          <CardDescription>Adayı takip eden şube</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3">
          {grupla((a) => sube(a.subeId)?.ad ?? "—").map(([k, v]) => (
            <OranCubugu key={k} etiket={k} {...v} />
          ))}
        </CardContent>
      </Card>
      <Card className="lg:col-span-2">
        <CardHeader>
          <CardTitle className="text-base">Vazgeçme nedenleri</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-2">
          {nedenler.length === 0 && <p className="text-sm text-muted-foreground">Vazgeçen aday yok.</p>}
          {nedenler.map(([n, c]) => (
            <div key={n} className="grid grid-cols-[7rem_1fr_2rem] items-center gap-3 text-sm">
              <span>{n}</span>
              <div className="h-2 overflow-hidden rounded-full bg-muted">
                <div className="h-full rounded-full bg-danger/70" style={{ width: `${(c / enCok) * 100}%` }} />
              </div>
              <span className="text-right tabular-nums">{c}</span>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

/* ---------- Aday kartı ---------- */
function AdayKarti({ id, onClose }: { id: string; onClose: () => void }) {
  const d = useDb();
  const { moduller } = useApp();
  const { ad: oturumAd, kapsam } = useOturum();
  const navigate = useNavigate();
  const a = d.adaylar.find((x) => x.id === id);
  const [form, setForm] = React.useState(a);
  const [not, setNot] = React.useState("");
  if (!a || !form) return null;

  const kapali = a.durum === "kayit";
  const kaydet = () => {
    guncelle((x) => {
      const notlar = [...form.notlar];
      if (form.durum !== a.durum) notlar.push({ tarih: simdiZaman(), yazar: oturumAd, metin: `Durum: ${durumAd(form.durum).ad}` });
      if (form.subeId !== a.subeId) {
        notlar.push({ tarih: simdiZaman(), yazar: oturumAd, metin: `${sube(a.subeId)?.ad} → ${sube(form.subeId)?.ad} şubesine devredildi` });
        islemYaz(x, oturumAd, "Aday devri", `${a.ogrenciAd}: ${sube(a.subeId)?.kod} → ${sube(form.subeId)?.kod}`, form.subeId);
      }
      x.adaylar = x.adaylar.map((y) => (y.id === id ? { ...form, notlar, vazgecmeNedeni: form.durum === "vazgecti" ? form.vazgecmeNedeni ?? "Diğer" : null } : y));
    });
    toast("Aday kaydedildi.");
    onClose();
  };
  const notEkle = () => {
    if (!not.trim()) return;
    const yeni = { tarih: simdiZaman(), yazar: oturumAd, metin: not.trim() };
    setForm({ ...form, notlar: [...form.notlar, yeni] });
    guncelle((x) => {
      x.adaylar = x.adaylar.map((y) => (y.id === id ? { ...y, notlar: [...y.notlar, yeni] } : y));
    });
    setNot("");
  };
  const sorumlular = d.personel.filter((p) => p.aktif && p.subeIds.includes(form.subeId) && p.gorev !== "ogretmen");

  return (
    <Sheet
      open
      onClose={onClose}
      wide
      title={a.ogrenciAd}
      description={
        <span className="flex flex-wrap items-center gap-2">
          <Badge variant={durumAd(a.durum).renk}>{durumAd(a.durum).ad}</Badge>
          {a.seviye}. sınıf · {a.okul} · eklendi {tarihKisa(a.olusturma)}
        </span>
      }
      footer={
        <>
          {!kapali && (
            <Button variant="outline" className="mr-auto" onClick={() => navigate(`/ogrenciler/yeni?aday=${a.id}`)}>
              <UserCheck /> Kesin kayda çevir
            </Button>
          )}
          <Button variant="outline" onClick={onClose}>Kapat</Button>
          {!kapali && <Button onClick={kaydet}>Kaydet</Button>}
        </>
      }
    >
      <div className="grid gap-6">
        {kapali && (
          <Alert tone="success" icon={<UserCheck />}>
            Bu aday kesin kayda çevrildi.{" "}
            {a.ogrenciId && (
              <button className="font-medium underline" onClick={() => navigate(`/ogrenciler/${a.ogrenciId}`)}>
                Öğrenci kartını aç
              </button>
            )}
          </Alert>
        )}
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Veli">
            <Input value={form.veliAd} disabled={kapali} onChange={(e) => setForm({ ...form, veliAd: e.target.value })} />
          </Field>
          <Field label="Telefon">
            <div className="flex gap-2">
              <Input value={form.veliTelefon} disabled={kapali} onChange={(e) => setForm({ ...form, veliTelefon: e.target.value })} />
              <a href={`tel:${form.veliTelefon.replace(/\s/g, "")}`} className="grid size-9 shrink-0 place-items-center rounded-md border hover:bg-muted" aria-label="Ara">
                <PhoneCall className="size-4" />
              </a>
            </div>
          </Field>
          <Field label="Durum">
            <Select value={form.durum} disabled={kapali} onChange={(e) => setForm({ ...form, durum: e.target.value as AdayDurum })}>
              {adayDurumlari
                .filter((x) => x.key !== "kayit" || kapali)
                .map((x) => (
                  <option key={x.key} value={x.key}>{x.ad}</option>
                ))}
            </Select>
          </Field>
          <Field label="Sonraki aksiyon tarihi" hint="Bu tarihte “Bugün aranacaklar” listesine düşer.">
            <Input type="date" disabled={kapali} value={form.sonrakiAksiyon ?? ""} onChange={(e) => setForm({ ...form, sonrakiAksiyon: e.target.value || null })} />
          </Field>
          {form.durum === "deneme" && (
            <Field label="Deneme dersi tarihi" hint="Bir gün önce veliye hatırlatma gider.">
              <Input type="date" value={form.denemeTarihi ?? ""} onChange={(e) => setForm({ ...form, denemeTarihi: e.target.value || null })} />
            </Field>
          )}
          {form.durum === "vazgecti" && (
            <Field label="Vazgeçme nedeni">
              <Select value={form.vazgecmeNedeni ?? "Diğer"} onChange={(e) => setForm({ ...form, vazgecmeNedeni: e.target.value })}>
                {vazgecmeNedenleri.map((n) => (
                  <option key={n}>{n}</option>
                ))}
              </Select>
            </Field>
          )}
          <Field label="İlgilendiği şube" hint="Şubeler arası devredilebilir.">
            <Select value={form.subeId} disabled={kapali} onChange={(e) => setForm({ ...form, subeId: e.target.value })}>
              {tanimlar().subeler.filter((s) => s.aktif && kapsam.includes(s.id)).map((s) => (
                <option key={s.id} value={s.id}>{s.ad}</option>
              ))}
            </Select>
          </Field>
          <Field label="Sorumlu personel">
            <Select value={form.sorumluId} disabled={kapali} onChange={(e) => setForm({ ...form, sorumluId: e.target.value })}>
              {sorumlular.map((p) => (
                <option key={p.id} value={p.id}>{p.ad} {p.soyad}</option>
              ))}
              {!sorumlular.some((p) => p.id === form.sorumluId) && <option value={form.sorumluId}>{personelAdi(d, form.sorumluId)}</option>}
            </Select>
          </Field>
          <Field label="Kaynak">
            <Select value={form.kaynak} disabled={kapali} onChange={(e) => setForm({ ...form, kaynak: e.target.value })}>
              {kaynaklar.map((k) => (
                <option key={k}>{k}</option>
              ))}
            </Select>
          </Field>
          {moduller.finans && (
            <Field label="Verilen fiyat teklifi (₺)">
              <Input type="number" min={0} disabled={kapali} value={form.teklif ?? ""} onChange={(e) => setForm({ ...form, teklif: e.target.value ? Number(e.target.value) : null })} />
            </Field>
          )}
        </div>

        <div className="rounded-md border p-3 text-xs text-muted-foreground">
          KVKK: iletişim izni (açık rıza) {a.rizaVar ? <b className="text-success">alındı</b> : <b className="text-danger">alınmadı</b>}. Vazgeçen adayların verisi{" "}
          {d.ayarlar.saklamaAyAday} ay sonra anonimleştirilir.
        </div>

        <div>
          <p className="mb-3 text-sm font-medium">Görüşme notları</p>
          <ol className="relative grid gap-4 border-l pl-5">
            {[...form.notlar].reverse().map((n, i) => (
              <li key={i} className="relative">
                <span className="absolute -left-[25px] top-1 size-2.5 rounded-full border-2 border-card bg-primary" />
                <p className="text-sm">{n.metin}</p>
                <p className="text-xs text-muted-foreground">
                  {n.yazar} · {new Date(n.tarih).toLocaleString("tr-TR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                </p>
              </li>
            ))}
          </ol>
          {!kapali && (
            <div className="mt-4 flex gap-2">
              <Input placeholder="Not ekle (örn. Cumartesi tekrar aranacak)" value={not} onChange={(e) => setNot(e.target.value)} onKeyDown={(e) => e.key === "Enter" && notEkle()} />
              <Button variant="outline" onClick={notEkle} disabled={!not.trim()}>
                <MessageSquarePlus /> Ekle
              </Button>
            </div>
          )}
        </div>
      </div>
    </Sheet>
  );
}

/* ---------- Hızlı ekle (telefonla arayan veli için) ---------- */
function HizliEkle({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { subeId } = useApp();
  const { ad: oturumAd, personel, kapsam } = useOturum();
  const bos = { veliAd: "", veliTelefon: "", ogrenciAd: "", seviye: 5, subeId: subeId === "all" ? kapsam[0] : subeId, kaynak: "Tavsiye", not: "", riza: false };
  const [form, setForm] = React.useState(bos);
  const tel = telefonNormalize(form.veliTelefon);
  const gecerli = form.veliAd.trim() && tel;

  const ekle = () => {
    if (!gecerli) return;
    guncelle((x) => {
      x.adaylar.unshift({
        id: yeniId("a"), veliAd: form.veliAd.trim(), veliTelefon: tel!, ogrenciAd: form.ogrenciAd.trim() || "—", seviye: form.seviye, okul: "",
        subeId: form.subeId, sorumluId: personel.id, kaynak: form.kaynak, durum: "yeni", sonrakiAksiyon: BUGUN, denemeTarihi: null,
        olusturma: BUGUN, notlar: form.not.trim() ? [{ tarih: simdiZaman(), yazar: oturumAd, metin: form.not.trim() }] : [],
        vazgecmeNedeni: null, teklif: null, rizaVar: form.riza,
      });
    });
    toast(`${form.veliAd} aday listesine eklendi.`);
    setForm(bos);
    onClose();
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Hızlı aday ekle"
      description="Telefonla arayan veli için 20 saniyelik form. Yalnızca veli adı ve telefon zorunlu."
      footer={
        <>
          <Button variant="outline" onClick={onClose}>Vazgeç</Button>
          <Button onClick={ekle} disabled={!gecerli}><Plus /> Ekle</Button>
        </>
      }
    >
      <div className="grid grid-cols-2 gap-3">
        <Field label="Veli adı soyadı *"><Input autoFocus value={form.veliAd} onChange={(e) => setForm({ ...form, veliAd: e.target.value })} /></Field>
        <Field label="Telefon *" hint={form.veliTelefon && !tel ? "Geçersiz numara" : undefined}>
          <Input value={form.veliTelefon} onChange={(e) => setForm({ ...form, veliTelefon: e.target.value })} placeholder="05xx…" />
        </Field>
        <Field label="Öğrenci adı"><Input value={form.ogrenciAd} onChange={(e) => setForm({ ...form, ogrenciAd: e.target.value })} /></Field>
        <Field label="Sınıf">
          <Select value={form.seviye} onChange={(e) => setForm({ ...form, seviye: Number(e.target.value) })}>
            {[3, 4, 5, 6, 7, 8].map((s) => <option key={s} value={s}>{s}. sınıf</option>)}
          </Select>
        </Field>
        <Field label="Şube">
          <Select value={form.subeId} onChange={(e) => setForm({ ...form, subeId: e.target.value })}>
            {tanimlar().subeler.filter((s) => kapsam.includes(s.id)).map((s) => <option key={s.id} value={s.id}>{s.ad}</option>)}
          </Select>
        </Field>
        <Field label="Kaynak">
          <Select value={form.kaynak} onChange={(e) => setForm({ ...form, kaynak: e.target.value })}>
            {kaynaklar.map((k) => <option key={k}>{k}</option>)}
          </Select>
        </Field>
      </div>
      <Field label="Not"><Textarea className="min-h-16" value={form.not} onChange={(e) => setForm({ ...form, not: e.target.value })} /></Field>
      <Checkbox checked={form.riza} onChange={(v) => setForm({ ...form, riza: v })} label="Veli, iletişim için sözlü onay verdi (KVKK açık rıza)" />
    </Dialog>
  );
}

/* ---------- Web formu (kurum sitesine / Instagram'a konacak) ---------- */
function WebFormu({ open, onClose }: { open: boolean; onClose: () => void }) {
  const d = useDb();
  const bos = { veliAd: "", veliTelefon: "", ogrenciAd: "", seviye: 5, subeId: "s1", riza: false };
  const [form, setForm] = React.useState(bos);
  const tel = telefonNormalize(form.veliTelefon);
  const gecerli = form.veliAd.trim() && tel && form.riza;

  const gonder = () => {
    if (!gecerli) return;
    const s = sube(form.subeId)!;
    const olay = d.olaylar.find((o) => o.key === "onKayitTesekkur");
    guncelle((x) => {
      x.adaylar.unshift({
        id: yeniId("a"), veliAd: form.veliAd.trim(), veliTelefon: tel!, ogrenciAd: form.ogrenciAd.trim() || "—", seviye: form.seviye, okul: "",
        subeId: form.subeId, sorumluId: form.subeId === "s2" ? "p10" : "p9", kaynak: "Web formu", durum: "yeni", sonrakiAksiyon: BUGUN,
        denemeTarihi: null, olusturma: BUGUN, notlar: [{ tarih: simdiZaman(), yazar: "Web formu", metin: "Ön kayıt formu dolduruldu." }],
        vazgecmeNedeni: null, teklif: null, rizaVar: true,
      });
      if (olay?.aktif) {
        const metin = sablonDoldur(olay.sablon, { sube_adi: s.ad, sube_telefonu: s.telefon });
        x.gonderimler.push({
          id: yeniId("gn"), zaman: simdiZaman(), olay: "onKayitTesekkur", veliId: null, alici: `${form.veliAd} · ${tel}`, ogrenciId: null,
          subeId: form.subeId, kanal: "sms", metin, durum: "iletildi", maliyet: smsBoyuMaliyet(x, metin),
        });
      }
    });
    toast(olay?.aktif ? "Form gönderildi; veliye teşekkür SMS'i iletildi." : "Form gönderildi.");
    setForm(bos);
    onClose();
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Ön kayıt formu (önizleme)"
      description="Bu form kurumun web sitesine ve Instagram profiline link olarak konur: classmate.app/on-kayit"
      footer={
        <>
          <Button variant="outline" onClick={onClose}>Kapat</Button>
          <Button onClick={gonder} disabled={!gecerli}>Formu gönder</Button>
        </>
      }
    >
      <div className="grid grid-cols-2 gap-3">
        <Field label="Adınız soyadınız"><Input value={form.veliAd} onChange={(e) => setForm({ ...form, veliAd: e.target.value })} /></Field>
        <Field label="Cep telefonunuz"><Input value={form.veliTelefon} onChange={(e) => setForm({ ...form, veliTelefon: e.target.value })} /></Field>
        <Field label="Öğrencinin adı"><Input value={form.ogrenciAd} onChange={(e) => setForm({ ...form, ogrenciAd: e.target.value })} /></Field>
        <Field label="Sınıfı">
          <Select value={form.seviye} onChange={(e) => setForm({ ...form, seviye: Number(e.target.value) })}>
            {[3, 4, 5, 6, 7, 8].map((s) => <option key={s} value={s}>{s}. sınıf</option>)}
          </Select>
        </Field>
      </div>
      <Field label="Size en yakın şube">
        <Select value={form.subeId} onChange={(e) => setForm({ ...form, subeId: e.target.value })}>
          {tanimlar().subeler.filter((s) => s.aktif).map((s) => <option key={s.id} value={s.id}>{s.ad} — {s.adres}</option>)}
        </Select>
      </Field>
      <Checkbox
        checked={form.riza}
        onChange={(v) => setForm({ ...form, riza: v })}
        label="Aydınlatma metnini okudum; bilgi verilmesi amacıyla benimle iletişime geçilmesine onay veriyorum."
      />
      <p className="text-xs text-muted-foreground">Gönderimden sonra veliye otomatik “Teşekkürler, sizi arayacağız” mesajı gider ({tl(d.ayarlar.smsBirimFiyat)} / SMS).</p>
    </Dialog>
  );
}

/**
 * Bölüm 10 · İletişim ve bildirimler
 * Doküman: docs/bolumler/10-iletisim-ve-bildirimler.md
 * Kanal kararı: uygulama içi bildirim (push) ana kanal, SMS yalnızca kritik durumlar ve yedek; WhatsApp v2.
 */
import * as React from "react";
import { BellRing, History, Megaphone, MessageSquare, Pencil, Plus, RotateCcw, Send, Settings2, Smartphone, Info } from "lucide-react";
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
  Textarea,
  Th,
  toast,
} from "@/components/ui";
import { useApp, useOturum } from "@/context/AppContext";
import { tanimlar } from "@/data/store";
import {
  BUGUN,
  SIMDI,
  duyuruGonderimleri,
  grupEtiket,
  guncelle,
  hedefVeliler,
  islemYaz,
  simdiZaman,
  sube,
  useDb,
  yeniId,
  type BildirimOlayi,
  type Duyuru,
  type Gonderim,
} from "@/data/store";
import { gonderimSaatindeMi, sablonDoldur, smsBoyu, tl, type VarsayilanKanal } from "@/lib/kurallar";
import { cn } from "@/lib/utils";
import { useSunucuDurumu } from "@/layout/Giris";

const kanalAd: Record<VarsayilanKanal, string> = { push: "Uygulama", sms: "SMS", "push+sms": "Uygulama + SMS (yedek)" };
const olayAdi = (d: ReturnType<typeof useDb>, k: string) => (k === "otp" ? "Giriş kodu" : d.olaylar.find((o) => o.key === k)?.ad ?? k);
const zamanTR = (iso: string) => new Date(iso).toLocaleString("tr-TR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

const ornekDegiskenler: Record<string, string> = {
  ogrenci: "Ayşe", saat: "16:00", ders: "Matematik", sube_adi: "Merkez", sube_telefonu: "0212 555 10 10", grup: "MRK 5-A",
  tarih: "12 Eki", neden: "iptal edilmiştir (öğretmen rahatsız)", baslik: "Kesirler alıştırması", teslim: "14 Eki", metin: "…",
  tutar: "1.500,00 ₺", vade: "05.11.2026", makbuz: "MRK-M-00042", ogretmen: "Can Öztürk",
};

export default function Iletisim() {
  const [sekme, setSekme] = React.useState<"merkez" | "duyuru" | "kayit" | "ayar">("merkez");
  const { rol } = useOturum();
  return (
    <div className="grid gap-6">
      <PageHeader code="10" title="İletişim ve bildirimler" description="Olayları veliye doğru kanaldan, doğru metinle ve doğru zamanda ulaştırın." />
      <Tabs
        value={sekme}
        onChange={setSekme}
        items={[
          { value: "merkez", label: "Bildirim merkezi", icon: <BellRing /> },
          { value: "duyuru", label: "Duyurular", icon: <Megaphone /> },
          { value: "kayit", label: "Gönderim kaydı", icon: <History /> },
          ...(rol === "genel-yonetici" ? [{ value: "ayar" as const, label: "Ayarlar", icon: <Settings2 /> }] : []),
        ]}
      />
      {sekme === "merkez" && <BildirimMerkezi />}
      {sekme === "duyuru" && <Duyurular />}
      {sekme === "kayit" && <GonderimKaydi />}
      {sekme === "ayar" && <Ayarlar />}
    </div>
  );
}

/* ---------- Bildirim merkezi ---------- */
function BildirimMerkezi() {
  const d = useDb();
  const { moduller } = useApp();
  const { rol, ad } = useOturum();
  const [duzenle, setDuzenle] = React.useState<BildirimOlayi | null>(null);
  const yonetici = rol === "genel-yonetici";
  const olaylar = d.olaylar.filter((o) => (!o.finans || moduller.finans) && (!o.modul || moduller[o.modul]));
  const guncelleOlay = (key: string, p: Partial<BildirimOlayi>) =>
    guncelle((x) => {
      x.olaylar = x.olaylar.map((o) => (o.key === key ? { ...o, ...p } : o));
      islemYaz(x, ad, "Bildirim ayarı", `${x.olaylar.find((o) => o.key === key)?.ad}: ${JSON.stringify(p)}`);
    });
  const buAy = d.gonderimler.filter((g) => g.zaman.startsWith(BUGUN.slice(0, 7)));

  return (
    <div className="grid gap-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Bu ay gönderim" value={buAy.length} icon={<Send />} />
        <StatCard label="Uygulama bildirimi" value={buAy.filter((g) => g.kanal === "push").length} icon={<Smartphone />} tone="success" hint="Ücretsiz" />
        <StatCard label="SMS" value={buAy.filter((g) => g.kanal === "sms").length} icon={<MessageSquare />} hint={tl(buAy.reduce((s, g) => s + g.maliyet, 0))} />
        <StatCard label="Bildirimi açık veli" value={`%${Math.round((d.veliler.filter((v) => v.pushAcik).length / Math.max(1, d.veliler.length)) * 100)}`} hint="Arttıkça SMS maliyeti düşer" />
      </div>
      <Alert icon={<Info />}>
        <b>Uygulama + SMS:</b> önce uygulama bildirimi gönderilir; veli bildirimleri açmamışsa SMS gider. iPhone'da web bildirimi yalnızca portal ana ekrana eklenince çalışır,
        bu yüzden kritik mesajlarda SMS yedeği kullanılır. Bilgilendirme mesajları İYS izni gerektirmez; tanıtım mesajı gönderilmez.
      </Alert>
      <Card>
        <Table>
          <thead><tr><Th>Olay</Th><Th>Kanal</Th><Th>Şablon</Th><Th className="text-center">Açık</Th><Th /></tr></thead>
          <tbody>
            {olaylar.map((o) => (
              <tr key={o.key}>
                <Td className="font-medium">
                  {o.ad}
                  {o.finans && <Badge variant="outline" className="ml-2">Finans</Badge>}
                </Td>
                <Td>
                  <Select aria-label={`${o.ad} kanalı`} className="h-8 w-52 text-xs" value={o.kanal} disabled={!yonetici} onChange={(e) => guncelleOlay(o.key, { kanal: e.target.value as VarsayilanKanal })}>
                    {Object.entries(kanalAd).map(([k, a]) => <option key={k} value={k}>{a}</option>)}
                  </Select>
                </Td>
                <Td className="max-w-sm"><p className="line-clamp-2 text-xs text-muted-foreground">{o.sablon}</p></Td>
                <Td className="text-center"><div className="flex justify-center"><Switch label={`${o.ad} açık`} checked={o.aktif} disabled={!yonetici} onCheckedChange={(v) => guncelleOlay(o.key, { aktif: v })} /></div></Td>
                <Td className="text-right">{yonetici && <Button variant="ghost" size="sm" onClick={() => setDuzenle(o)}><Pencil /> Metin</Button>}</Td>
              </tr>
            ))}
          </tbody>
        </Table>
      </Card>
      {duzenle && <SablonDialog olay={duzenle} onClose={() => setDuzenle(null)} />}
    </div>
  );
}

function SablonDialog({ olay, onClose }: { olay: BildirimOlayi; onClose: () => void }) {
  const { ad } = useOturum();
  const [metin, setMetin] = React.useState(olay.sablon);
  const degiskenler = [...new Set([...olay.sablon.matchAll(/\{(\w+)\}/g)].map((m) => m[1]))];
  const onizleme = sablonDoldur(metin, ornekDegiskenler);
  const kaydet = () => {
    guncelle((x) => {
      x.olaylar = x.olaylar.map((o) => (o.key === olay.key ? { ...o, sablon: metin } : o));
      islemYaz(x, ad, "Bildirim şablonu", `${olay.ad} metni güncellendi`);
    });
    toast("Şablon kaydedildi.");
    onClose();
  };
  return (
    <Dialog open onClose={onClose} wide title={`Şablon: ${olay.ad}`} footer={<><Button variant="outline" onClick={onClose}>Vazgeç</Button><Button onClick={kaydet} disabled={!metin.trim()}>Kaydet</Button></>}>
      <Field label="Metin"><Textarea value={metin} onChange={(e) => setMetin(e.target.value)} /></Field>
      <div className="flex flex-wrap gap-1.5">
        {[...new Set([...degiskenler, "sube_adi", "sube_telefonu", "ogrenci"])].map((v) => (
          <button key={v} onClick={() => setMetin(metin + ` {${v}}`)} className="rounded-full border px-2 py-0.5 font-mono text-xs text-muted-foreground hover:border-primary hover:text-primary">{`{${v}}`}</button>
        ))}
      </div>
      <div className="rounded-lg bg-muted p-3 text-sm">
        <p className="mb-1 text-xs text-muted-foreground">Önizleme</p>
        {onizleme}
        <p className="mt-2 text-xs text-muted-foreground">{onizleme.length} karakter · {smsBoyu(onizleme)} SMS</p>
      </div>
    </Dialog>
  );
}

/* ---------- Duyurular ---------- */
function hedefMetni(d: ReturnType<typeof useDb>, h: Duyuru["hedef"]) {
  if (h.tur === "tum") return "Tüm veliler";
  if (h.tur === "sube") return `Şube: ${sube(h.deger)?.ad}`;
  if (h.tur === "seviye") return `${h.deger}. sınıflar`;
  return `Grup: ${grupEtiket(d, h.deger ?? "")}`;
}

function Duyurular() {
  const d = useDb();
  const { kapsam, rol, ad } = useOturum();
  const [yeni, setYeni] = React.useState(false);
  const gorunur = (du: Duyuru) =>
    rol === "genel-yonetici" ||
    du.hedef.tur === "tum" ||
    (du.hedef.tur === "sube" && kapsam.includes(du.hedef.deger ?? "")) ||
    (du.hedef.tur === "grup" && kapsam.includes(d.gruplar.find((g) => g.id === du.hedef.deger)?.subeId ?? "")) ||
    du.hedef.tur === "seviye";
  const liste = d.duyurular.filter(gorunur).sort((a, b) => b.zaman.localeCompare(a.zaman));
  const simdiGonder = (du: Duyuru) => {
    guncelle((x) => {
      const g = { ...du, zaman: simdiZaman(), zamanlanmis: false, aliciVeliIds: hedefVeliler(x, du.hedef) };
      x.duyurular = x.duyurular.map((y) => (y.id === du.id ? g : y));
      duyuruGonderimleri(x, g);
      islemYaz(x, ad, "Duyuru", `“${du.baslik}” gönderildi`);
    });
    toast("Duyuru gönderildi.");
  };
  return (
    <div className="grid gap-4">
      <div className="flex justify-end"><Button onClick={() => setYeni(true)}><Plus /> Yeni duyuru</Button></div>
      {liste.length === 0 && <EmptyState icon={<Megaphone />} title="Duyuru yok" text="Örn. “Cumartesi resmi tatil nedeniyle ders yapılmayacaktır.”" />}
      <div className="grid gap-3">
        {liste.map((du) => {
          const oran = du.aliciVeliIds.length ? du.okuyanVeliIds.length / du.aliciVeliIds.length : 0;
          return (
            <Card key={du.id}>
              <CardContent className="grid gap-3 p-5 sm:grid-cols-[1fr_auto] sm:items-center">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-semibold">{du.baslik}</p>
                    <Badge variant="outline">{hedefMetni(d, du.hedef)}</Badge>
                    <Badge variant={du.kanal === "push" ? "default" : "warning"}>{du.kanal === "push" ? "Uygulama" : "Uygulama + SMS"}</Badge>
                    {du.zamanlanmis && <Badge variant="secondary">Zamanlanmış · {zamanTR(du.zaman)}</Badge>}
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">{du.metin}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{du.gonderen} · {zamanTR(du.zaman)}</p>
                </div>
                {du.zamanlanmis ? (
                  <Button size="sm" variant="outline" onClick={() => simdiGonder(du)}><Send /> Şimdi gönder</Button>
                ) : (
                  <div className="w-44">
                    <div className="flex justify-between text-xs"><span className="text-muted-foreground">Okundu</span><span className="tabular-nums">{du.okuyanVeliIds.length}/{du.aliciVeliIds.length}</span></div>
                    <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-success" style={{ width: `${oran * 100}%` }} /></div>
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
      <YeniDuyuru open={yeni} onClose={() => setYeni(false)} />
    </div>
  );
}

function YeniDuyuru({ open, onClose }: { open: boolean; onClose: () => void }) {
  const d = useDb();
  const { kapsam, rol, ad } = useOturum();
  const genel = rol === "genel-yonetici";
  const bos = () => ({ baslik: "", metin: "", tur: (genel ? "tum" : "sube") as Duyuru["hedef"]["tur"], deger: genel ? "" : kapsam[0], kanal: "push" as Duyuru["kanal"], zamanla: false, zaman: `${BUGUN}T19:00` });
  const [f, setF] = React.useState(bos);
  const hedef: Duyuru["hedef"] = { tur: f.tur, deger: f.tur === "tum" ? null : f.deger };
  // Şube personeli yalnızca kendi şubesine duyuru gönderebilir
  const kapsamFiltre = (vid: string) =>
    genel || d.ogrenciler.some((o) => o.veliIds.includes(vid) && d.kayitlar.some((k) => k.ogrenciId === o.id && k.durum === "aktif" && kapsam.includes(k.subeId)));
  const alicilar = f.tur === "tum" || f.deger ? hedefVeliler(d, hedef).filter(kapsamFiltre) : [];
  const smsSayisi = f.kanal === "push+sms" ? alicilar.filter((v) => !d.veliler.find((x) => x.id === v)?.pushAcik).length : 0;
  const maliyet = smsSayisi * smsBoyu(`${f.baslik}: ${f.metin}`) * d.ayarlar.smsBirimFiyat;
  const saatDisi = !f.zamanla && !gonderimSaatindeMi(SIMDI, d.ayarlar.gonderimBas, d.ayarlar.gonderimBit);
  const gecerli = f.baslik.trim() && f.metin.trim() && alicilar.length > 0 && (!f.zamanla || f.zaman > `${BUGUN}T${SIMDI}`);

  const gonder = () => {
    if (!gecerli) return;
    guncelle((x) => {
      const du: Duyuru = {
        id: yeniId("du"), baslik: f.baslik.trim(), metin: f.metin.trim(), hedef, kanal: f.kanal, zaman: f.zamanla ? f.zaman : simdiZaman(),
        zamanlanmis: f.zamanla, gonderen: ad, aliciVeliIds: alicilar, okuyanVeliIds: [],
      };
      x.duyurular.push(du);
      if (!f.zamanla) duyuruGonderimleri(x, du);
      islemYaz(x, ad, "Duyuru", `“${du.baslik}” → ${hedefMetni(x, hedef)} (${alicilar.length} veli)`, f.tur === "sube" ? f.deger : null);
    });
    toast(f.zamanla ? "Duyuru zamanlandı." : `Duyuru ${alicilar.length} veliye gönderildi.`);
    setF(bos());
    onClose();
  };

  const gruplar = d.gruplar.filter((g) => kapsam.includes(g.subeId));
  return (
    <Dialog open={open} onClose={onClose} wide title="Yeni duyuru" footer={<><Button variant="outline" onClick={onClose}>Vazgeç</Button><Button onClick={gonder} disabled={!gecerli}><Send /> {f.zamanla ? "Zamanla" : "Gönder"}</Button></>}>
      <Field label="Başlık"><Input value={f.baslik} onChange={(e) => setF({ ...f, baslik: e.target.value })} placeholder="Cumartesi dersleri" /></Field>
      <Field label="Metin" hint="{sube_adi} ve {sube_telefonu} kullanılabilir; veli doğru şubeyi arar.">
        <Textarea value={f.metin} onChange={(e) => setF({ ...f, metin: e.target.value })} placeholder="Cumartesi resmi tatil nedeniyle ders yapılmayacaktır." />
      </Field>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Hedef">
          <Select value={f.tur} onChange={(e) => { const t = e.target.value as Duyuru["hedef"]["tur"]; setF({ ...f, tur: t, deger: t === "sube" ? kapsam[0] : t === "grup" ? gruplar[0]?.id ?? "" : t === "seviye" ? "5" : "" }); }}>
            {genel && <option value="tum">Tüm veliler</option>}
            <option value="sube">Şube</option>
            <option value="seviye">Seviye</option>
            <option value="grup">Grup</option>
          </Select>
        </Field>
        {f.tur !== "tum" && (
          <Field label="Seçim">
            <Select value={f.deger} onChange={(e) => setF({ ...f, deger: e.target.value })}>
              {f.tur === "sube" && tanimlar().subeler.filter((s) => kapsam.includes(s.id)).map((s) => <option key={s.id} value={s.id}>{s.ad}</option>)}
              {f.tur === "seviye" && [3, 4, 5, 6, 7, 8].map((s) => <option key={s} value={String(s)}>{s}. sınıf</option>)}
              {f.tur === "grup" && gruplar.map((g) => <option key={g.id} value={g.id}>{grupEtiket(d, g.id)}</option>)}
            </Select>
          </Field>
        )}
        <Field label="Kanal">
          <Select value={f.kanal} onChange={(e) => setF({ ...f, kanal: e.target.value as Duyuru["kanal"] })}>
            <option value="push">Yalnız uygulama (ücretsiz)</option>
            <option value="push+sms">Uygulama + bildirimi kapalılara SMS</option>
          </Select>
        </Field>
      </div>
      <Checkbox checked={f.zamanla} onChange={(v) => setF({ ...f, zamanla: v })} label="İleri bir zamana zamanla" />
      {f.zamanla && <Input type="datetime-local" value={f.zaman} onChange={(e) => setF({ ...f, zaman: e.target.value })} />}
      <Alert tone={alicilar.length ? "info" : "warning"} icon={<Megaphone />}>
        <b>{alicilar.length}</b> veliye gidecek{f.kanal === "push+sms" && <> · <b>{smsSayisi}</b> SMS (tahmini {tl(maliyet)})</>}.
      </Alert>
      {saatDisi && <Alert tone="warning">Şu an gönderim saat aralığı dışında ({d.ayarlar.gonderimBas}–{d.ayarlar.gonderimBit}); SMS'ler sabah gönderilir.</Alert>}
    </Dialog>
  );
}

/* ---------- Gönderim kaydı ---------- */
function GonderimKaydi() {
  const d = useDb();
  const { subeGorunur, seciliSubeler, ad } = useOturum();
  const [kanal, setKanal] = React.useState<"all" | "push" | "sms">("all");
  const [durum, setDurum] = React.useState<"all" | Gonderim["durum"]>("all");
  const [olay, setOlay] = React.useState("all");
  const liste = d.gonderimler
    .filter((g) => subeGorunur(g.subeId) && (kanal === "all" || g.kanal === kanal) && (durum === "all" || g.durum === durum) && (olay === "all" || g.olay === olay))
    .sort((a, b) => b.zaman.localeCompare(a.zaman));
  const buAy = d.gonderimler.filter((g) => g.zaman.startsWith(BUGUN.slice(0, 7)) && g.kanal === "sms");
  const tekrar = (g: Gonderim) => {
    guncelle((x) => {
      x.gonderimler = x.gonderimler.map((y) => (y.id === g.id ? { ...y, durum: "iletildi", zaman: simdiZaman() } : y));
      islemYaz(x, ad, "SMS tekrar", g.alici);
    });
    toast("Mesaj yeniden gönderim kuyruğuna alındı.");
  };
  return (
    <div className="grid gap-4">
      <Card>
        <CardHeader><CardTitle className="text-base">Bu ay SMS maliyeti (şube bazında)</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {seciliSubeler.map((s) => {
            const l = buAy.filter((g) => g.subeId === s);
            return <StatCard key={s} label={sube(s)?.ad ?? s} value={tl(l.reduce((t, g) => t + g.maliyet, 0))} hint={`${l.length} SMS`} />;
          })}
        </CardContent>
      </Card>
      <Card>
        <CardContent className="flex flex-wrap gap-2 p-4">
          <Select aria-label="Kanal" className="w-36" value={kanal} onChange={(e) => setKanal(e.target.value as typeof kanal)}>
            <option value="all">Tüm kanallar</option><option value="push">Uygulama</option><option value="sms">SMS</option>
          </Select>
          <Select aria-label="Olay" className="w-52" value={olay} onChange={(e) => setOlay(e.target.value)}>
            <option value="all">Tüm olaylar</option>
            {d.olaylar.map((o) => <option key={o.key} value={o.key}>{o.ad}</option>)}
          </Select>
          <Select aria-label="Durum" className="w-36" value={durum} onChange={(e) => setDurum(e.target.value as typeof durum)}>
            <option value="all">Tüm durumlar</option><option value="iletildi">İletildi</option><option value="basarisiz">Başarısız</option>
          </Select>
          <span className="ml-auto self-center text-sm text-muted-foreground">{liste.length} kayıt</span>
        </CardContent>
        <Table>
          <thead><tr><Th>Zaman</Th><Th>Alıcı</Th><Th>Olay</Th><Th>Kanal</Th><Th>Metin</Th><Th>Durum</Th><Th className="text-right">Maliyet</Th></tr></thead>
          <tbody>
            {liste.slice(0, 100).map((g) => (
              <tr key={g.id}>
                <Td className="whitespace-nowrap tabular-nums text-muted-foreground">{zamanTR(g.zaman)}</Td>
                <Td className="whitespace-nowrap">{g.alici}</Td>
                <Td className="whitespace-nowrap">{olayAdi(d, g.olay)}</Td>
                <Td><Badge variant={g.kanal === "sms" ? "warning" : "default"}>{g.kanal === "sms" ? "SMS" : "Uygulama"}</Badge></Td>
                <Td className="max-w-xs"><p className="truncate text-xs" title={g.metin}>{g.metin}</p></Td>
                <Td>
                  {g.durum === "basarisiz" ? (
                    <button onClick={() => tekrar(g)} className="inline-flex items-center gap-1 text-xs text-danger underline"><RotateCcw className="size-3" /> Başarısız · tekrar</button>
                  ) : (
                    <Badge variant="success">İletildi</Badge>
                  )}
                </Td>
                <Td className={cn("text-right tabular-nums", !g.maliyet && "text-muted-foreground")}>{g.maliyet ? tl(g.maliyet) : "—"}</Td>
              </tr>
            ))}
          </tbody>
        </Table>
        {liste.length > 100 && <p className="p-3 text-center text-xs text-muted-foreground">Son 100 kayıt gösteriliyor.</p>}
      </Card>
    </div>
  );
}

/* ---------- Ayarlar ---------- */
function Ayarlar() {
  const d = useDb();
  const { ad } = useOturum();
  const [f, setF] = React.useState({ bas: d.ayarlar.gonderimBas, bit: d.ayarlar.gonderimBit, fiyat: String(d.ayarlar.smsBirimFiyat) });
  const kaydet = () => {
    guncelle((x) => {
      x.ayarlar = { ...x.ayarlar, gonderimBas: f.bas, gonderimBit: f.bit, smsBirimFiyat: Number(f.fiyat.replace(",", ".")) || x.ayarlar.smsBirimFiyat };
      islemYaz(x, ad, "İletişim ayarları", `Gönderim aralığı ${f.bas}–${f.bit}, SMS ${f.fiyat} ₺`);
    });
    toast("Ayarlar kaydedildi.");
  };
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card>
        <CardHeader><CardTitle className="text-base">Gönderim kuralları</CardTitle><CardDescription>Aralık dışında oluşan SMS'ler bir sonraki uygun saate ertelenir.</CardDescription></CardHeader>
        <CardContent className="grid gap-3">
          <div className="grid grid-cols-2 gap-3">
            <Field label="En erken"><Input type="time" value={f.bas} onChange={(e) => setF({ ...f, bas: e.target.value })} /></Field>
            <Field label="En geç"><Input type="time" value={f.bit} onChange={(e) => setF({ ...f, bit: e.target.value })} /></Field>
          </div>
          <Field label="SMS birim fiyatı (₺)" hint="Maliyet raporları için"><Input inputMode="decimal" value={f.fiyat} onChange={(e) => setF({ ...f, fiyat: e.target.value })} /></Field>
          <Button className="justify-self-start" onClick={kaydet}>Kaydet</Button>
        </CardContent>
      </Card>
      <GonderimAltyapisi />
      <Card>
        <CardHeader><CardTitle className="text-base">Yasal notlar</CardTitle></CardHeader>
        <CardContent className="grid gap-2 text-sm text-muted-foreground">
          <p><b className="text-foreground">İYS:</b> tanıtım/kampanya mesajları için izin zorunlu; devamsızlık, ödeme gibi bilgilendirme mesajları muaftır.</p>
          <p><b className="text-foreground">SMS başlığı:</b> gönderici adı (originator) için operatör başvurusu gerekir.</p>
          <p><b className="text-foreground">WhatsApp (v2):</b> Meta işletme doğrulaması, onaylı şablonlar ve mesaj başı ücret gerektirir.</p>
          <p><b className="text-foreground">Giriş kodu:</b> SMS maliyetini düşürmek için veli oturumu {d.ayarlar.oturumGun} gün açık kalır.</p>
        </CardContent>
      </Card>
    </div>
  );
}

/** Sunucudaki gerçek gönderim altyapısı (SMS sağlayıcısı, web push) */
function GonderimAltyapisi() {
  const durum = useSunucuDurumu();
  const d = useDb();
  const bekleyen = d.gonderimler.filter((g) => g.durum === "bekliyor").length;
  return (
    <Card>
      <CardHeader><CardTitle className="text-base">Gönderim altyapısı</CardTitle><CardDescription>Sunucu ortam değişkenleriyle yapılandırılır (.env).</CardDescription></CardHeader>
      <CardContent className="grid gap-2 text-sm">
        <div className="flex items-center justify-between rounded-md border p-2.5">
          <span>SMS sağlayıcısı</span>
          {durum?.sms === "konsol" ? <Badge variant="warning">Test modu (gönderilmez, konsola yazılır)</Badge> : <Badge variant="success">{durum?.sms ?? "…"}</Badge>}
        </div>
        <div className="flex items-center justify-between rounded-md border p-2.5">
          <span>Uygulama bildirimi (web push)</span>
          <Badge variant={durum?.push ? "success" : "secondary"}>{durum?.push ? "Açık" : "Kapalı"}</Badge>
        </div>
        <div className="flex items-center justify-between rounded-md border p-2.5">
          <span>Kuyrukta bekleyen</span>
          <span className="tabular-nums">{bekleyen}</span>
        </div>
        {durum?.sms === "konsol" && <p className="text-xs text-muted-foreground">Gerçek SMS için sunucuda SMS_SAGLAYICI=netgsm ve Netgsm hesap bilgilerini tanımlayın; gönderim başlığı operatörce onaylı olmalıdır.</p>}
      </CardContent>
    </Card>
  );
}
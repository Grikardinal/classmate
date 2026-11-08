/** Öğrenci kartının sekmeleri: genel bilgi, veliler, kayıtlar, ödemeler, yoklama, ödevler, etüt, notlar, belgeler */
import * as React from "react";
import { Link, useNavigate } from "react-router-dom";
import { ChevronRight, FileText, Link2, Phone, Plus, Printer } from "lucide-react";
import { Alert, Badge, Button, Card, CardContent, CardDescription, CardHeader, CardTitle, Dialog, Field, Input, Select, Switch, Table, Td, Textarea, Th, toast } from "@/components/ui";
import { useApp, useOturum } from "@/context/AppContext";
import {
  BUGUN,
  dersAdi,
  grupEtiket,
  guncelle,
  ogrenciVelileri,
  ogrenciYoklamalari,
  personelAdi,
  simdiZaman,
  sube,
  taksitAdi,
  taksitKalan,
  tamAd,
  tanimlar,
  useDb,
  yeniId,
  type Kayit,
  type Ogrenci,
  type Veli,
} from "@/data/store";
import { telefonNormalize, tl } from "@/lib/kurallar";
import { esc, yazdir } from "@/lib/yazdir";
import { EN_FAZLA_VELI, YAKINLIKLAR, mukerrerOgrenci, ogrenciDogrula, telefonSahibiVeli, veliDogrula } from "./kurallar";
import { KayitDurumRozeti, bosVeli, tarihTR } from "./ortak";

/** Genel bilgi: yalnızca kişisel alanlar kaydedilir (veli bağları, durum ve notlar kendi işlemleriyle değişir) */
export function GenelBilgi({ o }: { o: Ogrenci }) {
  const d = useDb();
  const alanlar = (x: Ogrenci) => ({ ad: x.ad, soyad: x.soyad, dogum: x.dogum, cinsiyet: x.cinsiyet, okul: x.okul, okulSinifi: x.okulSinifi, saglikNotu: x.saglikNotu });
  const [form, setForm] = React.useState(() => alanlar(o));
  React.useEffect(() => setForm(alanlar(o)), [o]);
  const sonraki: Ogrenci = { ...o, ...form, ad: form.ad.trim(), soyad: form.soyad.trim(), okul: form.okul.trim(), okulSinifi: form.okulSinifi.trim(), saglikNotu: form.saglikNotu.trim() };
  const mukerrer = mukerrerOgrenci(sonraki, ogrenciVelileri(d, o).map((v) => v.telefon), d);
  const hata = ogrenciDogrula(sonraki, BUGUN) ?? (mukerrer ? "Bu ad ve veli telefonuyla kayıtlı başka bir öğrenci var." : null);
  const kaydet = () => {
    if (hata) return;
    guncelle((x) => {
      x.ogrenciler = x.ogrenciler.map((y) => (y.id === o.id ? { ...y, ...alanlar(sonraki) } : y));
    });
    toast("Öğrenci bilgileri kaydedildi.");
  };
  return (
    <Card>
      <CardContent className="grid gap-3 p-5 sm:grid-cols-2">
        <Field label="Ad"><Input value={form.ad} onChange={(e) => setForm({ ...form, ad: e.target.value })} /></Field>
        <Field label="Soyad"><Input value={form.soyad} onChange={(e) => setForm({ ...form, soyad: e.target.value })} /></Field>
        <Field label="Doğum tarihi"><Input type="date" max={BUGUN} value={form.dogum} onChange={(e) => setForm({ ...form, dogum: e.target.value })} /></Field>
        <Field label="Cinsiyet">
          <Select value={form.cinsiyet} onChange={(e) => setForm({ ...form, cinsiyet: e.target.value as "K" | "E" })}>
            <option value="K">Kız</option>
            <option value="E">Erkek</option>
          </Select>
        </Field>
        <Field label="Okulu"><Input value={form.okul} onChange={(e) => setForm({ ...form, okul: e.target.value })} /></Field>
        <Field label="Okuldaki sınıfı"><Input value={form.okulSinifi} onChange={(e) => setForm({ ...form, okulSinifi: e.target.value })} /></Field>
        <div className="sm:col-span-2">
          <Field label="Sağlık notu" hint="Kapsamdaki personel ve öğrencinin öğretmenleri görür; veli kendi çocuğununkini görür."><Textarea className="min-h-16" value={form.saglikNotu} onChange={(e) => setForm({ ...form, saglikNotu: e.target.value })} /></Field>
        </div>
        <div className="flex items-center justify-end gap-3 sm:col-span-2">
          {hata && <p className="text-sm text-danger">{hata}</p>}
          <Button onClick={kaydet} disabled={!!hata}>Kaydet</Button>
        </div>
      </CardContent>
    </Card>
  );
}

export function VelilerSekmesi({ o }: { o: Ogrenci }) {
  const d = useDb();
  const veliler = ogrenciVelileri(d, o);
  const [ekle, setEkle] = React.useState(false);
  const [yeni, setYeni] = React.useState(bosVeli());
  const tel = telefonNormalize(yeni.telefon);
  // Aynı telefonla kayıtlı veli varsa yeni veli açılmaz, mevcut veli bağlanır (görünmüyorsa sunucu bağlar)
  const mevcut = tel ? telefonSahibiVeli(tel, d.veliler) : null;
  const zatenBagli = !!mevcut && o.veliIds.includes(mevcut.id);
  const taslak: Veli = {
    id: "", ad: yeni.ad.trim(), soyad: yeni.soyad.trim() || o.soyad, telefon: tel ?? yeni.telefon, eposta: yeni.eposta.trim(), yakinlik: yeni.yakinlik,
    pushAcik: false, portalDavet: "gonderildi", izinSms: true, izinTanitim: false,
  };
  const hata = o.veliIds.length >= EN_FAZLA_VELI ? `Bir öğrenciye en fazla ${EN_FAZLA_VELI} veli bağlanabilir.` : zatenBagli ? "Bu veli zaten bu öğrenciye bağlı." : mevcut ? null : veliDogrula(taslak);

  const veliGuncelle = (id: string, p: Partial<Veli>) =>
    guncelle((x) => {
      x.veliler = x.veliler.map((v) => (v.id === id ? { ...v, ...p } : v));
    });
  const birincilYap = (id: string) =>
    guncelle((x) => {
      x.ogrenciler = x.ogrenciler.map((y) => (y.id === o.id ? { ...y, birincilVeliId: id } : y));
    });
  const veliEkle = () => {
    if (hata) return;
    guncelle((x) => {
      let vid = mevcut?.id;
      if (!vid) {
        vid = yeniId("v");
        x.veliler.push({ ...taslak, id: vid });
      }
      x.ogrenciler = x.ogrenciler.map((y) => (y.id === o.id && !y.veliIds.includes(vid!) ? { ...y, veliIds: [...y.veliIds, vid!] } : y));
    });
    toast(mevcut ? "Mevcut veli bu öğrenciye bağlandı." : "Veli eklendi; portal davet SMS'i gönderilecek.");
    setYeni(bosVeli());
    setEkle(false);
  };

  return (
    <div className="grid gap-3 md:grid-cols-2">
      {veliler.map((v) => {
        const cocuklar = d.ogrenciler.filter((x) => x.veliIds.includes(v.id) && x.id !== o.id);
        return (
          <Card key={v.id}>
            <CardHeader>
              <div className="flex items-start justify-between gap-2">
                <div>
                  <CardTitle className="text-base">{tamAd(v)}</CardTitle>
                  <CardDescription>{v.yakinlik}</CardDescription>
                </div>
                {o.birincilVeliId === v.id ? <Badge>Birincil</Badge> : <Button variant="ghost" size="sm" onClick={() => birincilYap(v.id)}>Birincil yap</Button>}
              </div>
            </CardHeader>
            <CardContent className="grid gap-3 text-sm">
              <a href={`tel:${v.telefon.replace(/\s/g, "")}`} className="flex items-center gap-2 font-mono hover:text-primary"><Phone className="size-4" /> {v.telefon}</a>
              {cocuklar.length > 0 && (
                <p className="text-muted-foreground">
                  Kardeş: {cocuklar.map((c, i) => <React.Fragment key={c.id}>{i > 0 && ", "}<Link className="text-foreground underline" to={`/ogrenciler/${c.id}`}>{c.ad}</Link></React.Fragment>)}
                </p>
              )}
              <div className="grid gap-2 border-t pt-3">
                <div className="flex items-center justify-between"><span>Uygulama bildirimi</span><Badge variant={v.pushAcik ? "success" : "secondary"}>{v.pushAcik ? "Açık" : "Kapalı (SMS'e düşer)"}</Badge></div>
                <div className="flex items-center justify-between"><span>Bilgilendirme SMS izni</span><Switch label="SMS izni" checked={v.izinSms} onCheckedChange={(x) => veliGuncelle(v.id, { izinSms: x })} /></div>
                <div className="flex items-center justify-between"><span>Tanıtım mesajı izni (İYS)</span><Switch label="Tanıtım izni" checked={v.izinTanitim} onCheckedChange={(x) => veliGuncelle(v.id, { izinTanitim: x })} /></div>
              </div>
            </CardContent>
          </Card>
        );
      })}
      {o.veliIds.length < EN_FAZLA_VELI && (
        <button onClick={() => setEkle(true)} className="grid min-h-40 place-items-center rounded-lg border border-dashed text-sm text-muted-foreground hover:border-primary hover:text-primary">
          <span className="flex items-center gap-2"><Plus className="size-4" /> Veli ekle</span>
        </button>
      )}
      <Dialog
        open={ekle}
        onClose={() => setEkle(false)}
        title="Veli ekle"
        footer={<><Button variant="outline" onClick={() => setEkle(false)}>Vazgeç</Button><Button onClick={veliEkle} disabled={!!hata}>{mevcut ? "Bağla" : "Ekle"}</Button></>}
      >
        <div className="grid grid-cols-2 gap-3">
          <Field label="Ad"><Input value={yeni.ad} onChange={(e) => setYeni({ ...yeni, ad: e.target.value })} /></Field>
          <Field label="Soyad"><Input value={yeni.soyad} placeholder={o.soyad} onChange={(e) => setYeni({ ...yeni, soyad: e.target.value })} /></Field>
        </div>
        <Field label="Telefon"><Input value={yeni.telefon} placeholder="05xx xxx xx xx" onChange={(e) => setYeni({ ...yeni, telefon: e.target.value })} /></Field>
        <Field label="E-posta"><Input type="email" value={yeni.eposta} onChange={(e) => setYeni({ ...yeni, eposta: e.target.value })} /></Field>
        <Field label="Yakınlık">
          <Select value={yeni.yakinlik} onChange={(e) => setYeni({ ...yeni, yakinlik: e.target.value as Veli["yakinlik"] })}>
            {YAKINLIKLAR.map((y) => <option key={y}>{y}</option>)}
          </Select>
        </Field>
        {mevcut && !zatenBagli && <Alert icon={<Link2 />}>Bu numara <b>{tamAd(mevcut)}</b> adına kayıtlı; mevcut veli bağlanacak.</Alert>}
        {hata && (yeni.ad || yeni.telefon) && <p className="text-sm text-danger">{hata}</p>}
      </Dialog>
    </div>
  );
}

export function KayitlarSekmesi({ o }: { o: Ogrenci }) {
  const d = useDb();
  const { moduller } = useApp();
  const kayitlar = d.kayitlar.filter((k) => k.ogrenciId === o.id);
  return (
    <div className="grid gap-3">
      {kayitlar.map((k) => (
        <Card key={k.id}>
          <CardHeader className="flex-row items-start justify-between">
            <div>
              <CardTitle className="text-base">{tanimlar().sezonlar.find((z) => z.id === k.sezonId)?.ad} · <span className="font-mono">{k.sozlesmeNo}</span></CardTitle>
              <CardDescription className="mt-1">{sube(k.subeId)?.ad} · {grupEtiket(d, k.grupId)} · kayıt {tarihTR(k.tarih)}</CardDescription>
            </div>
            <KayitDurumRozeti durum={k.durum} />
          </CardHeader>
          <CardContent className="grid gap-3 text-sm">
            {k.ekHizmetler.length > 0 && <p><span className="text-muted-foreground">Ek hizmetler:</span> {k.ekHizmetler.join(", ")}</p>}
            {moduller.finans && k.net > 0 && (
              <p><span className="text-muted-foreground">Ücret:</span> {tl(k.listeFiyati)} {k.indirimler.map((i) => `− %${i.oran} ${i.ad}`).join(" ")} → <b>{tl(k.net)}</b></p>
            )}
            {moduller.finans && k.bekleyenIndirim && (
              <p className="text-warning">İndirim yönetici onayı bekliyor: {k.bekleyenIndirim.indirimler.map((i) => `${i.ad} %${i.oran}`).join(", ")} (onay Finans → Özet'ten verilir)</p>
            )}
            {moduller.finans && k.iptalHesabi && (
              <p><span className="text-muted-foreground">İptal hesabı:</span> kullanılan {tl(k.iptalHesabi.kullanilan)} + cayma {tl(k.iptalHesabi.cayma)} · ödenen {tl(k.iptalHesabi.odenen)} →{" "}
                <b>{k.iptalHesabi.iade > 0 ? `iade ${tl(k.iptalHesabi.iade)}` : `kalan borç ${tl(k.iptalHesabi.kalanBorc)}`}</b>
                {k.iptalHesabi.duzeltme && ` (düzeltme: ${k.iptalHesabi.duzeltme.neden})`}</p>
            )}
            <div>
              <p className="mb-1 text-muted-foreground">Grup geçmişi</p>
              <ol className="flex flex-wrap items-center gap-2">
                {k.grupGecmisi.map((gg, i) => (
                  <li key={i} className="flex items-center gap-2">
                    {i > 0 && <ChevronRight className="size-3.5 text-muted-foreground" />}
                    <Badge variant="outline">{grupEtiket(d, gg.grupId)} · {tarihTR(gg.tarih)}</Badge>
                  </li>
                ))}
              </ol>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

export function OdemelerSekmesi({ o }: { o: Ogrenci }) {
  const d = useDb();
  const navigate = useNavigate();
  const taksitler = d.taksitler.filter((t) => t.ogrenciId === o.id).sort((a, b) => a.vade.localeCompare(b.vade));
  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between">
        <CardTitle className="text-base">Ödeme planı</CardTitle>
        <Button size="sm" onClick={() => navigate(`/finans?veli=${o.birincilVeliId}`)}>Tahsilat al</Button>
      </CardHeader>
      <Table>
        <thead><tr><Th>Taksit</Th><Th>Vade</Th><Th className="text-right">Tutar</Th><Th className="text-right">Ödenen</Th><Th>Durum</Th></tr></thead>
        <tbody>
          {taksitler.map((t) => {
            const kalan = taksitKalan(t);
            const gecikti = kalan > 0 && t.vade < BUGUN;
            return (
              <tr key={t.id}>
                <Td>{taksitAdi(t.no)}</Td>
                <Td>{tarihTR(t.vade)}</Td>
                <Td className="text-right tabular-nums">{tl(t.tutar)}</Td>
                <Td className="text-right tabular-nums">{tl(t.odenen)}</Td>
                <Td>{kalan <= 0 ? <Badge variant="success">Ödendi</Badge> : gecikti ? <Badge variant="danger">Gecikti</Badge> : t.odenen > 0 ? <Badge variant="warning">Kısmi</Badge> : <Badge variant="secondary">Bekliyor</Badge>}</Td>
              </tr>
            );
          })}
        </tbody>
      </Table>
      {taksitler.length === 0 && <CardContent><p className="text-sm text-muted-foreground">Ödeme planı yok.</p></CardContent>}
    </Card>
  );
}

const yoklamaRozet: Record<string, { ad: string; v: "success" | "danger" | "warning" | "secondary" }> = {
  geldi: { ad: "Geldi", v: "success" },
  gelmedi: { ad: "Gelmedi", v: "danger" },
  gec: { ad: "Geç geldi", v: "warning" },
  izinli: { ad: "İzinli", v: "secondary" },
};

export function YoklamaSekmesi({ o }: { o: Ogrenci }) {
  const d = useDb();
  const liste = ogrenciYoklamalari(d, o.id);
  return (
    <Card>
      <Table>
        <thead><tr><Th>Tarih</Th><Th>Ders</Th><Th>İşlenen konu</Th><Th>Durum</Th></tr></thead>
        <tbody>
          {liste.slice(0, 40).map(({ y, durum }) => {
            const satir = d.program.find((p) => p.id === y.satirId);
            return (
              <tr key={y.oturumId}>
                <Td className="whitespace-nowrap tabular-nums">{tarihTR(y.tarih)}</Td>
                <Td>{satir ? dersAdi(satir.dersId) : "—"} <span className="text-xs text-muted-foreground">· {personelAdi(d, y.ogretmenId)}</span></Td>
                <Td className="text-muted-foreground">{y.konu || "—"}</Td>
                <Td><Badge variant={yoklamaRozet[durum].v}>{yoklamaRozet[durum].ad}</Badge></Td>
              </tr>
            );
          })}
        </tbody>
      </Table>
      {liste.length === 0 && <CardContent><p className="p-4 text-sm text-muted-foreground">Henüz yoklama yok.</p></CardContent>}
    </Card>
  );
}

export function OdevlerSekmesi({ o, grupId }: { o: Ogrenci; grupId: string }) {
  const d = useDb();
  const odevler = d.odevler.filter((x) => x.grupId === grupId && (!x.ogrenciIds || x.ogrenciIds.includes(o.id))).sort((a, b) => b.teslim.localeCompare(a.teslim));
  const rozet = { yapti: ["Yaptı", "success"], eksik: ["Eksik", "warning"], yapmadi: ["Yapmadı", "danger"] } as const;
  return (
    <Card>
      <Table>
        <thead><tr><Th>Ödev</Th><Th>Ders</Th><Th>Teslim</Th><Th>Durum</Th></tr></thead>
        <tbody>
          {odevler.map((x) => {
            const t = x.teslimler[o.id];
            return (
              <tr key={x.id}>
                <Td className="font-medium">{x.baslik}</Td>
                <Td>{dersAdi(x.dersId)}</Td>
                <Td className="tabular-nums">{tarihTR(x.teslim)}</Td>
                <Td>{t ? <Badge variant={rozet[t][1]}>{rozet[t][0]}</Badge> : <Badge variant="secondary">{x.teslim >= BUGUN ? "Bekliyor" : "Kontrol edilmedi"}</Badge>}</Td>
              </tr>
            );
          })}
        </tbody>
      </Table>
      {odevler.length === 0 && <CardContent><p className="p-4 text-sm text-muted-foreground">Ödev yok.</p></CardContent>}
    </Card>
  );
}

export function EtutSekmesi({ o }: { o: Ogrenci }) {
  const d = useDb();
  const randevular = d.randevular.filter((r) => r.ogrenciIds.includes(o.id)).sort((a, b) => b.tarih.localeCompare(a.tarih));
  const paketler = d.paketler.filter((p) => p.ogrenciId === o.id);
  return (
    <div className="grid gap-3">
      {paketler.map((p) => (
        <Alert key={p.id} icon={<FileText />}>
          Özel ders paketi: <b>{dersAdi(p.dersId)}</b> ({personelAdi(d, p.ogretmenId)}) — kalan hak <b>{p.kalan}/{p.toplam}</b>
        </Alert>
      ))}
      <Card>
        <Table>
          <thead><tr><Th>Tarih</Th><Th>Saat</Th><Th>Öğretmen</Th><Th>Tür</Th><Th>Durum</Th></tr></thead>
          <tbody>
            {randevular.map((r) => (
              <tr key={r.id}>
                <Td className="tabular-nums">{tarihTR(r.tarih)}</Td>
                <Td className="tabular-nums">{r.bas}–{r.bit}</Td>
                <Td>{personelAdi(d, r.ogretmenId)}</Td>
                <Td className="capitalize">{r.tur}</Td>
                <Td><Badge variant={r.durum === "yapildi" ? "success" : r.durum === "planli" ? "default" : r.durum === "gelmedi" ? "danger" : "secondary"}>{r.durum}</Badge></Td>
              </tr>
            ))}
          </tbody>
        </Table>
        {randevular.length === 0 && <CardContent><p className="p-4 text-sm text-muted-foreground">Etüt randevusu yok.</p></CardContent>}
      </Card>
    </div>
  );
}

export function NotlarSekmesi({ o }: { o: Ogrenci }) {
  const { ad } = useOturum();
  const [not, setNot] = React.useState("");
  const ekle = () => {
    if (!not.trim()) return;
    guncelle((x) => {
      // Yeni not başa eklenir; yazar ve zaman sunucuda oturumdan yazılır
      x.ogrenciler = x.ogrenciler.map((y) => (y.id === o.id ? { ...y, notlar: [{ tarih: simdiZaman(), yazar: ad, metin: not.trim() }, ...y.notlar] } : y));
    });
    setNot("");
  };
  return (
    <Card>
      <CardContent className="grid gap-4 p-5">
        <div className="flex gap-2">
          <Textarea className="min-h-16" maxLength={2000} placeholder="Öğrenciyle ilgili not (personel görür, veli görmez)" value={not} onChange={(e) => setNot(e.target.value)} />
          <Button className="self-end" onClick={ekle} disabled={!not.trim()}>Ekle</Button>
        </div>
        {o.notlar.length === 0 && <p className="text-sm text-muted-foreground">Not yok.</p>}
        {o.notlar.map((n, i) => (
          <div key={i} className="rounded-md border p-3 text-sm">
            <p>{n.metin}</p>
            <p className="mt-1 text-xs text-muted-foreground">{n.yazar} · {new Date(n.tarih).toLocaleString("tr-TR", { dateStyle: "medium", timeStyle: "short" })}</p>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

export function BelgelerSekmesi({ o }: { o: Ogrenci }) {
  const d = useDb();
  const kayitlar = d.kayitlar.filter((k) => k.ogrenciId === o.id);
  const veliler = ogrenciVelileri(d, o);
  const yazdirForm = (k: Kayit) => {
    const ok = yazdir(
      `Kayıt formu ${k.sozlesmeNo}`,
      `<h1>Kayıt ve Muvafakat Formu</h1><p class="kucuk">Sözleşme no: <b>${esc(k.sozlesmeNo)}</b> · Kayıt tarihi: ${tarihTR(k.tarih)}</p>
       <table><tr><th>Öğrenci</th><td>${esc(tamAd(o))}</td><th>Grup</th><td>${esc(grupEtiket(d, k.grupId))}</td></tr>
       <tr><th>Okul</th><td>${esc(o.okul)} ${esc(o.okulSinifi)}</td><th>Doğum</th><td>${esc(tarihTR(o.dogum))}</td></tr></table>
       <h2>Veliler</h2><table>${veliler.map((v) => `<tr><td>${esc(tamAd(v))}</td><td>${esc(v.yakinlik)}</td><td>${esc(v.telefon)}</td></tr>`).join("")}</table>
       <p>KVKK onayı: ${k.kvkkOnay ? `${esc(k.kvkkOnay.surum)} · ${tarihTR(k.kvkkOnay.tarih)}` : "alınmadı"}</p>
       <div class="imza"><div>Veli / imza</div><div>Kurum yetkilisi / imza</div></div>`,
      sube(k.subeId)?.ad,
    );
    if (!ok) toast("Açılır pencere engellendi; tarayıcı ayarlarından izin verin.", "uyari");
  };
  return (
    <Card>
      <Table>
        <thead><tr><Th>Belge</Th><Th>Sürüm / tarih</Th><Th className="text-right">İşlem</Th></tr></thead>
        <tbody>
          {kayitlar.map((k) => (
            <React.Fragment key={k.id}>
              <tr>
                <Td className="font-medium">Kayıt ve muvafakat formu · {k.sozlesmeNo}</Td>
                <Td>{tarihTR(k.tarih)}</Td>
                <Td className="text-right"><Button variant="outline" size="sm" onClick={() => yazdirForm(k)}><Printer /> Yazdır / PDF</Button></Td>
              </tr>
              <tr>
                <Td>KVKK aydınlatma ve açık rıza</Td>
                <Td>{k.kvkkOnay ? `${k.kvkkOnay.surum} · ${tarihTR(k.kvkkOnay.tarih)}` : <Badge variant="danger">Alınmadı</Badge>}</Td>
                <Td />
              </tr>
            </React.Fragment>
          ))}
        </tbody>
      </Table>
    </Card>
  );
}

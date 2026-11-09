/** Bölüm 14 · Yedek ve dışa aktarma */
import * as React from "react";
import { AlertTriangle, DatabaseBackup, Download, Lock, Trash2, Upload } from "lucide-react";
import { Alert, Button, Card, CardContent, CardDescription, CardHeader, CardTitle, Dialog, StatCard, toast } from "@/components/ui";
import { useOturum } from "@/context/AppContext";
import { BUGUN, grupEtiket, senkron, sube, tamAd, useDb, veriYukle, type Db } from "@/data/store";
import { csvOlustur, normalAd } from "@/lib/kurallar";
import { api, type SunucuDurumu } from "@/lib/api";
import { dosyaIndir } from "@/lib/yazdir";
import { YEDEK_EN_BUYUK_BAYT, YEDEK_GECERSIZ, yedekDogrula } from "./kurallar";

export function DisaAktarma() {
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
      if (f.size > YEDEK_EN_BUYUK_BAYT) throw new Error("Yedek dosyası 64 MB'tan büyük olamaz.");
      const y: unknown = JSON.parse(await f.text());
      const engel = yedekDogrula(y, d.surum);
      if (engel) throw new Error(engel);
      setGeriYukle(y as Db);
    } catch (e) {
      toast(e instanceof Error && !(e instanceof SyntaxError) ? e.message : YEDEK_GECERSIZ, "hata");
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
        description="Sunucudaki tüm veriler yedektekiyle değiştirilecek. İşlemden hemen önce sunucu mevcut verinin yedeğini alır; KVKK kapsamında silinmiş kişiler geri gelmez."
        footer={<><Button variant="outline" onClick={() => setGeriYukle(null)}>Vazgeç</Button><Button variant="destructive" onClick={geriYukleOnay}>Geri yükle</Button></>}
      >
        {geriYukle && <p className="text-sm">Yedekte {geriYukle.ogrenciler.length} öğrenci, {geriYukle.kayitlar.length} kayıt, {Object.keys(geriYukle.yoklamalar ?? {}).length} yoklama var.</p>}
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

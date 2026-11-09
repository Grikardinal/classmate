/** Bölüm 14 · KVKK araçları: veri sahibi başvurusu, saklama süreleri, başvuru kayıtları */
import * as React from "react";
import { AlertTriangle, Download, Lock, Search, UserX } from "lucide-react";
import { Alert, Badge, Button, Card, CardContent, CardDescription, CardHeader, CardTitle, Dialog, Input, StatCard, Table, Td, Th, toast } from "@/components/ui";
import { useOturum } from "@/context/AppContext";
import { BUGUN, getDb, guncelle, islemYaz, senkron, simdiZaman, tamAd, useDb, veriYukle, yeniId } from "@/data/store";
import { normalAd } from "@/lib/kurallar";
import { api } from "@/lib/api";
import { dosyaIndir } from "@/lib/yazdir";
import { anonimlestirmeEngeli, kisiDokumu, saklamasiDolanAdaylar, saklamasiDolanOgrenciler, type KvkkTur } from "./kurallar";
import { anonimMi } from "../03-on-kayit/kurallar";

export function Kvkk() {
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
  const eskiAdaylar = saklamasiDolanAdaylar(d, BUGUN);
  const eskiOgrenciler = saklamasiDolanOgrenciler(d, BUGUN);
  const vazgecenler = d.adaylar.filter((a) => a.durum === "vazgecti" && !anonimMi(a));

  const bilgiVer = (tur: "veli" | "ogrenci", id: string) => {
    const kisi = tur === "veli" ? d.veliler.find((v) => v.id === id) : d.ogrenciler.find((o) => o.id === id);
    if (!kisi) return;
    dosyaIndir(`kvkk-bilgi-${id}.json`, JSON.stringify(kisiDokumu(d, tur, id), null, 2), "application/json");
    guncelle((x) => {
      x.kvkk.unshift({ id: yeniId("kv"), zaman: simdiZaman(), kisi: tamAd(kisi), tur: "bilgi", durum: "tamamlandi", not: "Kişisel veri dökümü verildi." });
      islemYaz(x, ad, "KVKK bilgi talebi", tamAd(kisi));
    });
  };
  /** Gönderim metni, işlem kaydı ve cihaz aboneliği de silindiği için sunucuda yapılır */
  const anonimlestir = async (tur: KvkkTur, ids: string[]) => {
    try {
      await senkron();
      const r = await api<{ sayi: number }>("/api/kvkk/anonimlestir", { tur, ids });
      await veriYukle();
      toast(`${r.sayi} kişinin verisi anonimleştirildi.`);
      return true;
    } catch (e) {
      toast(e instanceof Error ? e.message : "Anonimleştirilemedi.", "hata");
      return false;
    }
  };
  const anonim = async () => {
    if (!onay) return;
    const engel = anonimlestirmeEngeli(getDb(), onay.tur, onay.id);
    if (engel) return toast(engel, "uyari");
    if (await anonimlestir(onay.tur, [onay.id])) {
      setOnay(null);
      setAra("");
    }
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
            <StatCard label="Süresi dolan ayrılan öğrenci" value={eskiOgrenciler.length} tone={eskiOgrenciler.length ? "warning" : "default"} />
          </div>
          {rol === "genel-yonetici" ? (
            <>
              <Button variant="outline" disabled={!eskiAdaylar.length} onClick={() => anonimlestir("aday", eskiAdaylar.map((a) => a.id))}>Süresi dolan adayları anonimleştir</Button>
              <Button variant="outline" disabled={!eskiOgrenciler.length} onClick={() => anonimlestir("ogrenci", eskiOgrenciler.map((o) => o.id))}>Süresi dolan öğrencileri anonimleştir</Button>
              {vazgecenler.length > 0 && <Button variant="ghost" onClick={() => anonimlestir("aday", vazgecenler.map((a) => a.id))}>Tüm vazgeçen adayları ({vazgecenler.length}) şimdi anonimleştir</Button>}
            </>
          ) : (
            <Alert icon={<Lock />}>Anonimleştirmeyi genel yönetici yapar.</Alert>
          )}
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
            {[...d.kvkk].sort((a, b) => b.zaman.localeCompare(a.zaman)).map((k) => (
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
        description="Ad, telefon, doğum tarihi, sağlık notu, notlar, gönderim metinleri ve işlem kayıtlarındaki ad kalıcı olarak silinir; yoklama ve ödeme istatistikleri kimliksiz olarak korunur. Geri alınamaz. Eski yedeklerdeki kopyalar saklama süresi dolunca silinir."
        footer={<><Button variant="outline" onClick={() => setOnay(null)}>Vazgeç</Button><Button variant="destructive" onClick={anonim}>Anonimleştir</Button></>}
      >
        <Alert tone="warning" icon={<AlertTriangle />}>Aktif kaydı olan öğrencinin kaydı iptal edilir. Aktif öğrencisi olan veli anonimleştirilemez.</Alert>
      </Dialog>
    </div>
  );
}

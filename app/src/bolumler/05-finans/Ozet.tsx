import { AlarmClock, Banknote, BellRing, CircleDollarSign } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, StatCard, Table, Td, Th } from "@/components/ui";
import { useOturum } from "@/context/AppContext";
import { AKTIF_SEZON, BUGUN, sube, useDb } from "@/data/store";
import { tarihEkle, tl } from "@/lib/kurallar";
import { beklenenTahsil, kalan, kasaHareketleri, kurusa, sezonAylari, vadesiGecenler, yuzde } from "./kurallar";
import { TaksitTablosu, type Sekme } from "./ortak";

export function Ozet({ onGit }: { onGit: (s: Sekme) => void }) {
  const d = useDb();
  const { subeGorunur, seciliSubeler } = useOturum();
  const ay = BUGUN.slice(0, 7);
  const taksitler = d.taksitler.filter((t) => subeGorunur(t.subeId));
  const buAy = beklenenTahsil(taksitler.filter((t) => t.vade.startsWith(ay)));
  const geciken = vadesiGecenler(taksitler, BUGUN);
  const gecikenTutar = geciken.reduce((s, t) => s + kurusa(kalan(t)), 0) / 100;
  const gecikenVeli = new Set(geciken.map((t) => t.veliId)).size;
  const haftaSonu = tarihEkle(BUGUN, 7);
  const yaklasan = taksitler.filter((t) => t.vade >= BUGUN && t.vade <= haftaSonu && kalan(t) > 0).sort((a, b) => a.vade.localeCompare(b.vade));

  // Aylık beklenen vs tahsil edilen: aktif sezonun ayları
  const aylik = sezonAylari(d.sezonlar.find((s) => s.id === AKTIF_SEZON)).map((a) => ({ a, ...beklenenTahsil(taksitler.filter((t) => t.vade.startsWith(a))) }));
  const enBuyuk = Math.max(1, ...aylik.map((x) => x.beklenen));
  // Şube karşılaştırma: ciro = iptal edilmemiş tahsilatlar (kasa hareketlerinden net giriş)
  const hareketler = kasaHareketleri(d);

  return (
    <div className="grid gap-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Bu ay beklenen" value={tl(buAy.beklenen)} icon={<CircleDollarSign />} />
        <StatCard label="Bu ay tahsil edilen" value={tl(buAy.tahsil)} icon={<Banknote />} tone="success" hint={`Tahsilat oranı %${yuzde(buAy.tahsil, buAy.beklenen)}`} />
        <StatCard label="Vadesi geçen" value={tl(gecikenTutar)} icon={<AlarmClock />} tone="danger" hint={`${gecikenVeli} veli`} onClick={() => onGit("geciken")} />
        <StatCard label="7 gün içinde vadesi gelen" value={yaklasan.length} icon={<BellRing />} tone="warning" hint={tl(yaklasan.reduce((s, t) => s + kurusa(kalan(t)), 0) / 100)} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Aylık beklenen ve tahsil edilen</CardTitle>
          <CardDescription>Aktif sezon · açık renk beklenen, koyu renk tahsil edilen tutar</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex h-48 items-end gap-3">
            {aylik.map((x) => (
              <div key={x.a} className="flex flex-1 flex-col items-center gap-2">
                <div className="relative flex h-40 w-full max-w-16 items-end">
                  <div className="absolute bottom-0 w-full rounded-t-md bg-primary/20" style={{ height: `${(x.beklenen / enBuyuk) * 100}%` }} title={`Beklenen ${tl(x.beklenen)}`} />
                  <div className="absolute bottom-0 w-full rounded-t-md bg-primary" style={{ height: `${(x.tahsil / enBuyuk) * 100}%` }} title={`Tahsil ${tl(x.tahsil)}`} />
                </div>
                <span className="text-xs text-muted-foreground">{new Date(x.a + "-01T00:00:00").toLocaleDateString("tr-TR", { month: "short" })}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {seciliSubeler.length > 1 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Şube karşılaştırma</CardTitle>
          </CardHeader>
          <Table>
            <thead>
              <tr><Th>Şube</Th><Th className="text-right">Tahsilat (iptaller düşülmüş)</Th><Th className="text-right">Tahsilat oranı (vadesi gelen)</Th><Th className="text-right">Bu ay gideri</Th><Th className="text-right">Öğrenci başı gelir</Th></tr>
            </thead>
            <tbody>
              {seciliSubeler.map((sid) => {
                const vg = beklenenTahsil(d.taksitler.filter((x) => x.subeId === sid && x.vade <= BUGUN));
                const ciro = hareketler.filter((h) => h.kasa.startsWith(`${sid}:`) && (h.tur === "tahsilat" || h.tur === "tahsilatIptali")).reduce((s, h) => s + kurusa(h.giris) - kurusa(h.cikis), 0) / 100;
                const gider = d.giderler.filter((g) => g.subeId === sid && g.tarih.startsWith(ay)).reduce((s, g) => s + kurusa(g.tutar), 0) / 100;
                const ogr = d.kayitlar.filter((k) => k.subeId === sid && k.durum === "aktif").length;
                return (
                  <tr key={sid}>
                    <Td className="font-medium">{sube(sid)?.ad}</Td>
                    <Td className="text-right tabular-nums">{tl(ciro)}</Td>
                    <Td className="text-right tabular-nums">%{yuzde(vg.tahsil, vg.beklenen)}</Td>
                    <Td className="text-right tabular-nums">{tl(gider)}</Td>
                    <Td className="text-right tabular-nums">{tl(ogr ? Math.round((ciro / ogr) * 100) / 100 : 0)}</Td>
                  </tr>
                );
              })}
            </tbody>
          </Table>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Bu hafta vadesi gelenler</CardTitle>
        </CardHeader>
        {yaklasan.length === 0 ? (
          <CardContent><p className="text-sm text-muted-foreground">Önümüzdeki 7 günde vadesi gelen taksit yok.</p></CardContent>
        ) : (
          <TaksitTablosu taksitler={yaklasan} />
        )}
      </Card>
    </div>
  );
}

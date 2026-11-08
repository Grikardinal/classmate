import { AlarmClock, BellRing } from "lucide-react";
import { Button, Card, CardContent, CardDescription, CardHeader, CardTitle, EmptyState, Table, Td, Th, toast } from "@/components/ui";
import { useOturum } from "@/context/AppContext";
import { BUGUN, bildirimEkle, guncelle, islemYaz, tamAd, useDb } from "@/data/store";
import { gecikmeGunu, tl } from "@/lib/kurallar";
import { cn } from "@/lib/utils";
import { kalan, kurusa, otomatikHatirlatmaUygun, vadesiGecenler } from "./kurallar";
import { KayitDurumEtiketi, tarihTR } from "./ortak";

export function Gecikenler() {
  const d = useDb();
  const { subeGorunur, ad } = useOturum();
  const geciken = vadesiGecenler(d.taksitler.filter((t) => subeGorunur(t.subeId)), BUGUN);
  const veliler = [...new Set(geciken.map((t) => t.veliId))]
    .map((vid) => {
      const l = geciken.filter((t) => t.veliId === vid);
      const enEski = l.reduce((m, t) => (t.vade < m ? t.vade : m), l[0].vade);
      const son = d.gonderimler.filter((g) => g.olay === "gecikmisOdeme" && g.veliId === vid).sort((a, b) => b.zaman.localeCompare(a.zaman))[0];
      // Yalnızca iptal / dondurulmuş kayıtların borcu olan veliye toplu hatırlatma gitmez (otomatik hatırlatmayla aynı kural)
      const hatirlatilir = l.some((t) => otomatikHatirlatmaUygun(t, d.kayitlar));
      return { vid, l, toplam: l.reduce((s, t) => s + kurusa(kalan(t)), 0) / 100, enEski, son, hatirlatilir };
    })
    .sort((a, b) => a.enEski.localeCompare(b.enEski));
  const topluHedef = veliler.filter((r) => r.hatirlatilir);

  const hatirlat = (liste: typeof veliler) => {
    guncelle((x) => {
      for (const r of liste) {
        const t = r.l[0];
        bildirimEkle(x, "gecikmisOdeme", t.ogrenciId, { tutar: tl(r.toplam), vade: tarihTR(r.enEski) }, undefined, true);
      }
      islemYaz(x, ad, "Ödeme hatırlatma", `${liste.length} veliye gecikmiş ödeme hatırlatması gönderildi`);
    });
    toast(`${liste.length} veliye nazik hatırlatma gönderildi.`);
  };

  return (
    <Card>
      <CardHeader className="flex-row flex-wrap items-center justify-between gap-3">
        <div>
          <CardTitle>Vadesi geçenler</CardTitle>
          <CardDescription className="mt-1">
            Otomatik hatırlatma günleri (vadeye göre): {d.ayarlar.hatirlatmaGunleri.join(", ")}. İptal edilen / dondurulan kayda otomatik hatırlatma gitmez.
            Toplam {tl(veliler.reduce((s, r) => s + kurusa(r.toplam), 0) / 100)}.
          </CardDescription>
        </div>
        {topluHedef.length > 0 && <Button size="sm" variant="outline" onClick={() => hatirlat(topluHedef)}><BellRing /> Hepsine hatırlat ({topluHedef.length})</Button>}
      </CardHeader>
      {veliler.length === 0 ? (
        <CardContent><EmptyState icon={<AlarmClock />} title="Geciken ödeme yok" text="Tüm vadesi gelen taksitler ödenmiş." /></CardContent>
      ) : (
        <Table>
          <thead><tr><Th>Veli</Th><Th>Öğrenci(ler)</Th><Th>En eski vade</Th><Th className="text-right">Tutar</Th><Th>Son hatırlatma</Th><Th /></tr></thead>
          <tbody>
            {veliler.map((r) => {
              const v = d.veliler.find((x) => x.id === r.vid);
              const gun = gecikmeGunu(r.enEski, BUGUN);
              return (
                <tr key={r.vid}>
                  <Td>
                    <p className="font-medium">{tamAd(v)}</p>
                    <p className="font-mono text-xs text-muted-foreground">{v?.telefon}</p>
                  </Td>
                  <Td>
                    {[...new Map(r.l.map((t) => [t.ogrenciId, t])).values()].map((t) => (
                      <span key={t.ogrenciId} className="mr-2">{d.ogrenciler.find((o) => o.id === t.ogrenciId)?.ad} <KayitDurumEtiketi kayitId={t.kayitId} /></span>
                    ))}
                  </Td>
                  <Td><span className={cn("tabular-nums", gun >= 10 && "font-medium text-danger")}>{tarihTR(r.enEski)} · {gun} gün</span></Td>
                  <Td className="text-right tabular-nums font-medium">{tl(r.toplam)}</Td>
                  <Td className="text-muted-foreground">{r.son ? `${tarihTR(r.son.zaman)} · ${r.son.kanal === "sms" ? "SMS" : "uygulama"}` : "—"}</Td>
                  <Td className="text-right"><Button variant="ghost" size="sm" onClick={() => hatirlat([r])}><BellRing /> Hatırlat</Button></Td>
                </tr>
              );
            })}
          </tbody>
        </Table>
      )}
    </Card>
  );
}

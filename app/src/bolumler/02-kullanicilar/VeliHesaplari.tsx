/**
 * Veli hesapları: telefon + SMS koduyla giriş; portal daveti ve bildirim izni durumu.
 */
import * as React from "react";
import { Search, Send, Smartphone } from "lucide-react";
import { Badge, Button, Card, CardContent, CardDescription, CardHeader, CardTitle, Input, Select, Table, Td, Th, toast } from "@/components/ui";
import { useOturum } from "@/context/AppContext";
import { bildirimEkle, guncelle, islemYaz, tamAd, useDb } from "@/data/store";

export function VeliHesaplari() {
  const d = useDb();
  const { subeGorunur, ad: oturumAd } = useOturum();
  const [ara, setAra] = React.useState("");
  const [filtre, setFiltre] = React.useState<"all" | "bekliyor" | "pushKapali">("all");

  const satirlar = d.veliler
    .map((v) => {
      const cocuklar = d.ogrenciler.filter((o) => o.veliIds.includes(v.id) && o.durum === "aktif");
      const subeIds = cocuklar.map((o) => d.kayitlar.find((k) => k.ogrenciId === o.id && k.durum !== "iptal")?.subeId);
      return { v, cocuklar, gorunur: subeIds.some((s) => subeGorunur(s)) };
    })
    .filter(({ v, cocuklar, gorunur }) => {
      if (!gorunur || !cocuklar.length) return false;
      if (filtre === "bekliyor" && v.portalDavet === "giris-yapti") return false;
      if (filtre === "pushKapali" && v.pushAcik) return false;
      const q = ara.toLocaleLowerCase("tr");
      return !q || tamAd(v).toLocaleLowerCase("tr").includes(q) || v.telefon.replace(/\s/g, "").includes(q.replace(/\s/g, ""));
    });

  const pushOrani = satirlar.length ? Math.round((satirlar.filter((s) => s.v.pushAcik).length / satirlar.length) * 100) : 0;

  const davetGonder = (veliId: string, ogrenciId: string) => {
    guncelle((x) => {
      bildirimEkle(x, "hosgeldin", ogrenciId, {}, undefined);
      x.veliler = x.veliler.map((v) => (v.id === veliId && v.portalDavet === "bekliyor" ? { ...v, portalDavet: "gonderildi" } : v));
      islemYaz(x, oturumAd, "Veli daveti", "Portal daveti yeniden gönderildi");
    });
    toast("Portal daveti SMS ile gönderildi.");
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Veli hesapları</CardTitle>
        <CardDescription>
          Veliler telefon + SMS koduyla girer (parola yok). Öğrenci kaydında hesap otomatik açılır ve davet SMS'i gider.
          Bildirim izni açık olan veli oranı: <b className="text-foreground">%{pushOrani}</b>
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-wrap gap-2 pb-4">
        <div className="relative min-w-48 flex-1">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Veli adı veya telefon" className="pl-8" value={ara} onChange={(e) => setAra(e.target.value)} />
        </div>
        <Select aria-label="Filtre" className="w-56" value={filtre} onChange={(e) => setFiltre(e.target.value as typeof filtre)}>
          <option value="all">Tüm veliler</option>
          <option value="bekliyor">Portala hiç girmeyenler</option>
          <option value="pushKapali">Bildirimi kapalı (SMS'e düşer)</option>
        </Select>
      </CardContent>
      <Table>
        <thead>
          <tr>
            <Th>Veli</Th>
            <Th>Çocuk(lar)</Th>
            <Th>Portal</Th>
            <Th>Bildirim</Th>
            <Th className="text-right">İşlem</Th>
          </tr>
        </thead>
        <tbody>
          {satirlar.slice(0, 60).map(({ v, cocuklar }) => (
            <tr key={v.id}>
              <Td>
                <p className="font-medium">{tamAd(v)} <span className="text-xs font-normal text-muted-foreground">· {v.yakinlik}</span></p>
                <p className="font-mono text-xs text-muted-foreground">{v.telefon}</p>
              </Td>
              <Td>{cocuklar.map((o) => o.ad).join(", ")}</Td>
              <Td>
                <Badge variant={v.portalDavet === "giris-yapti" ? "success" : v.portalDavet === "gonderildi" ? "warning" : "secondary"}>
                  {v.portalDavet === "giris-yapti" ? "Giriş yaptı" : v.portalDavet === "gonderildi" ? "Davet gönderildi" : "Bekliyor"}
                </Badge>
              </Td>
              <Td>
                {v.pushAcik ? (
                  <Badge variant="default"><Smartphone className="size-3" /> Uygulama</Badge>
                ) : (
                  <Badge variant="outline">Yalnız SMS</Badge>
                )}
              </Td>
              <Td className="text-right">
                {v.portalDavet !== "giris-yapti" && (
                  <Button variant="outline" size="sm" onClick={() => davetGonder(v.id, cocuklar[0].id)}>
                    <Send /> Davet
                  </Button>
                )}
              </Td>
            </tr>
          ))}
        </tbody>
      </Table>
      {satirlar.length > 60 && <p className="p-4 text-center text-xs text-muted-foreground">İlk 60 veli gösteriliyor ({satirlar.length} toplam). Aramayı daraltın.</p>}
    </Card>
  );
}

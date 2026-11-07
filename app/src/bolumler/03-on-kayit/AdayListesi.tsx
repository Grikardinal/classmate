/** Aday listesi: arama, durum ve kaynak filtresi; sonraki aksiyon tarihine göre sıralı */
import * as React from "react";
import { Search, UserPlus } from "lucide-react";
import { Badge, Card, CardContent, EmptyState, Input, Select, Table, Td, Th } from "@/components/ui";
import { personelAdi, sube, useDb, type Aday, type AdayDurum } from "@/data/store";
import { ADAY_DURUMLARI, KAYNAKLAR, acikMi, adayAramaUyar, durumBilgisi } from "./kurallar";
import { AksiyonTarihi } from "./ortak";

export function AdayListesi({ adaylar, onSec }: { adaylar: Aday[]; onSec: (id: string) => void }) {
  const d = useDb();
  const [ara, setAra] = React.useState("");
  const [durum, setDurum] = React.useState<AdayDurum | "acik" | "all">("acik");
  const [kaynak, setKaynak] = React.useState("all");
  const liste = adaylar
    .filter((a) => {
      if (durum === "acik" && !acikMi(a)) return false;
      if (durum !== "acik" && durum !== "all" && a.durum !== durum) return false;
      if (kaynak !== "all" && a.kaynak !== kaynak) return false;
      return adayAramaUyar(a, ara);
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
          {ADAY_DURUMLARI.map((x) => (
            <option key={x.key} value={x.key}>{x.ad}</option>
          ))}
        </Select>
        <Select aria-label="Kaynak" className="w-40" value={kaynak} onChange={(e) => setKaynak(e.target.value)}>
          <option value="all">Tüm kaynaklar</option>
          {KAYNAKLAR.map((k) => (
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
                  <p className="text-xs text-muted-foreground">
                    {a.seviye}. sınıf{a.okul ? ` · ${a.okul}` : ""}
                  </p>
                </Td>
                <Td>
                  <p>{a.veliAd}</p>
                  <p className="font-mono text-xs text-muted-foreground">{a.veliTelefon}</p>
                </Td>
                <Td className="font-mono text-xs">{sube(a.subeId)?.kod}</Td>
                <Td>{a.kaynak}</Td>
                <Td><Badge variant={durumBilgisi(a.durum).renk}>{durumBilgisi(a.durum).ad}</Badge></Td>
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

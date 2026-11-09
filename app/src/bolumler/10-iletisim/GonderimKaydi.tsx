import * as React from "react";
import { RotateCcw } from "lucide-react";
import { Badge, Card, CardContent, CardHeader, CardTitle, Select, StatCard, Table, Td, Th, toast } from "@/components/ui";
import { useOturum } from "@/context/AppContext";
import { BUGUN, guncelle, islemYaz, simdiZaman, sube, useDb, type Gonderim } from "@/data/store";
import { tl } from "@/lib/kurallar";
import { cn } from "@/lib/utils";
import { tekrarEdilebilir } from "./kurallar";
import { olayAdi, zamanTR } from "./ortak";

export function GonderimKaydi() {
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
      x.gonderimler = x.gonderimler.map((y) => (y.id === g.id ? { ...y, durum: "bekliyor", hata: undefined, zaman: simdiZaman() } : y));
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
            <option value="all">Tüm durumlar</option><option value="bekliyor">Bekliyor</option><option value="iletildi">İletildi</option><option value="basarisiz">Başarısız</option>
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
                  {g.durum === "bekliyor" ? (
                    <Badge variant="secondary">Bekliyor</Badge>
                  ) : g.durum !== "basarisiz" ? (
                    <Badge variant="success">İletildi</Badge>
                  ) : tekrarEdilebilir(g) ? (
                    <button title={g.hata} onClick={() => tekrar(g)} className="inline-flex items-center gap-1 text-xs text-danger underline"><RotateCcw className="size-3" /> Başarısız · tekrar</button>
                  ) : (
                    <span title={g.hata} className="text-xs text-danger">Başarısız</span>
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

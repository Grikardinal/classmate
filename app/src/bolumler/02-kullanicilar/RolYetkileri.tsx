/**
 * Rol → bölüm yetki tablosu. Yalnızca genel yönetici değiştirir (sunucu: tekil ayar kuralı + rolYetkileriDogrula).
 */
import { Lock } from "lucide-react";
import { Alert, Card, CardContent, CardDescription, CardHeader, CardTitle, Switch, Table, Td, Th } from "@/components/ui";
import { useOturum } from "@/context/AppContext";
import { guncelle, islemYaz, rolAdlari, useDb } from "@/data/store";
import { bolumler } from "@/bolumler/registry";
import { BOLUM_KODLARI, ROLLER, bolumYetkisi } from "./kurallar";
import type { Rol } from "@/data/store";

export function RolYetkileri() {
  const d = useDb();
  const { ad: oturumAd, rol: oturumRol } = useOturum();
  const duzenleyebilir = oturumRol === "genel-yonetici";
  const degistir = (rol: Rol, kod: string, v: boolean) => {
    guncelle((x) => {
      x.rolYetkileri = {
        ...x.rolYetkileri,
        [rol]: { ...x.rolYetkileri[rol], [kod]: v },
        // Genel yöneticinin satırı her zaman tam ve açık yazılır (sunucu eksik/kapalı satırı reddeder)
        "genel-yonetici": Object.fromEntries(BOLUM_KODLARI.map((k) => [k, true])),
      };
      islemYaz(x, oturumAd, "Yetki", `${rolAdlari[rol]}: ${bolumler.find((b) => b.kod === kod)?.ad} ${v ? "açıldı" : "kapatıldı"}`);
    });
  };
  return (
    <Card>
      <CardHeader>
        <CardTitle>Rol → bölüm yetkileri</CardTitle>
        <CardDescription>
          Roller sabittir; genel yönetici rol bazında bölümleri açıp kapatabilir. Şube kapsamı ayrıca uygulanır.
          Veli ve öğrenci yalnızca portalı görür.
        </CardDescription>
      </CardHeader>
      <Table>
        <thead>
          <tr>
            <Th>Bölüm</Th>
            {ROLLER.map((r) => (
              <Th key={r} className="text-center">{rolAdlari[r]}</Th>
            ))}
          </tr>
        </thead>
        <tbody>
          {[...bolumler].sort((a, b) => a.kod.localeCompare(b.kod)).map((b) => (
            <tr key={b.kod}>
              <Td>
                <span className="mr-2 font-mono text-xs text-muted-foreground">{b.kod}</span>
                {b.ad}
              </Td>
              {ROLLER.map((r) => (
                <Td key={r} className="text-center">
                  <div className="flex justify-center">
                    <Switch
                      label={`${rolAdlari[r]} – ${b.ad}`}
                      checked={r === "genel-yonetici" || bolumYetkisi(d.rolYetkileri, r, b.kod)}
                      disabled={r === "genel-yonetici" || !duzenleyebilir}
                      onCheckedChange={(v) => degistir(r, b.kod, v)}
                    />
                  </div>
                </Td>
              ))}
            </tr>
          ))}
        </tbody>
      </Table>
      <CardContent className="pt-4">
        {!duzenleyebilir && <Alert className="mb-3">Bu tabloyu yalnızca genel yönetici değiştirebilir.</Alert>}
        <Alert icon={<Lock />}>
          Öğretmen hangi şubede olursa olsun yalnızca kendi gruplarını görür ve finans verisine erişemez. Önemli işlemler
          (tahsilat iptali, indirim, kayıt iptali, yetki değişikliği) işlem kaydına yazılır.
        </Alert>
      </CardContent>
    </Card>
  );
}

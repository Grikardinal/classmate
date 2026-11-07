/**
 * Giriş geçmişi: kim, ne zaman, hangi cihazdan. Sunucu bu kaydı yalnızca genel yöneticiye gönderir.
 */
import { Alert, Badge, Card, CardDescription, CardHeader, CardTitle, Table, Td, Th } from "@/components/ui";
import { useOturum } from "@/context/AppContext";
import { tamAd, useDb } from "@/data/store";
import { zamanBicim } from "./ortak";

export function GirisGecmisi() {
  const d = useDb();
  const { rol } = useOturum();
  return (
    <Card>
      <CardHeader>
        <CardTitle>Giriş geçmişi</CardTitle>
        <CardDescription>Kim, ne zaman, hangi cihazdan giriş yaptı (son 40 kayıt).</CardDescription>
      </CardHeader>
      {rol !== "genel-yonetici" ? (
        <div className="p-4 pt-0">
          <Alert>Giriş geçmişini yalnızca genel yönetici görebilir.</Alert>
        </div>
      ) : (
        <Table>
          <thead>
            <tr>
              <Th>Zaman</Th>
              <Th>Kullanıcı</Th>
              <Th>Cihaz</Th>
              <Th>Sonuç</Th>
            </tr>
          </thead>
          <tbody>
            {d.girisler.slice(0, 40).map((g) => {
              const k = d.kullanicilar.find((x) => x.id === g.kullaniciId);
              const p = d.personel.find((x) => x.id === k?.personelId);
              return (
                <tr key={g.id}>
                  <Td className="tabular-nums text-muted-foreground">{zamanBicim(g.tarih)}</Td>
                  <Td className="font-medium">{p ? tamAd(p) : (k?.eposta ?? "—")}</Td>
                  <Td>{g.cihaz}</Td>
                  {/* Başarısız = hatalı parola veya pasif hesap */}
                  <Td>{g.basarili ? <Badge variant="success">Başarılı</Badge> : <Badge variant="danger">Başarısız</Badge>}</Td>
                </tr>
              );
            })}
          </tbody>
        </Table>
      )}
    </Card>
  );
}

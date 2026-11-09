import { Navigate } from "react-router-dom";
import { Badge, Card, CardContent, EmptyState, PageHeader } from "@/components/ui";
import { useApp, useOturum } from "@/context/AppContext";
import { useDb } from "@/data/store";
import { tl } from "@/lib/kurallar";
import { Wallet } from "lucide-react";

const durumAd = { bekliyor: "Bekliyor", onaylandi: "Onaylandı", odendi: "Ödendi" } as const;

/** Öğretmenin salt okunur hak ediş dökümü (karar 2026-11-09). Veriyi sunucu hesaplar; bu sayfa hiçbir şey yazmaz. */
export default function HakEdisim() {
  const d = useDb();
  const { moduller } = useApp();
  const { ogretmenMi } = useOturum();
  if (!ogretmenMi || !moduller.hakedis) return <Navigate to="/" replace />;
  const satirlar = d.hakedisim ?? [];
  const kalem = (ad: string, n: number) => (n ? <div className="flex justify-between gap-4"><span className="text-muted-foreground">{ad}</span><span className="tabular-nums">{tl(n)}</span></div> : null);
  return (
    <div className="grid gap-6">
      <PageHeader code="13" title="Hak edişim" description="Yalnızca sizin aylık ders, etüt ve ödeme dökümünüz." />
      {satirlar.length === 0 && <EmptyState icon={<Wallet />} title="Henüz kayıt yok" text="İşlenen dersleriniz burada aylık görünür." />}
      <div className="grid gap-3 md:grid-cols-2">
        {satirlar.map((r) => (
          <Card key={r.ay}>
            <CardContent className="grid gap-2 p-4 text-sm">
              <div className="flex items-center justify-between">
                <span className="font-medium capitalize">{new Date(r.ay + "-01T00:00:00").toLocaleDateString("tr-TR", { month: "long", year: "numeric" })}</span>
                <Badge variant={r.durum === "odendi" ? "success" : "outline"}>{durumAd[r.durum]}</Badge>
              </div>
              <div className="flex justify-between gap-4"><span className="text-muted-foreground">İşlenen ders / etüt</span><span className="tabular-nums">{r.dersSayisi} / {r.etutSayisi}</span></div>
              {moduller.finans && (
                <>
                  {kalem("Hak ediş", r.tutar)}
                  {kalem("Önceki ay farkı", r.oncekiFark)}
                  {kalem("Elle düzeltme", r.duzeltme)}
                  {r.duzeltmeNeden && <p className="text-xs text-muted-foreground">Gerekçe: {r.duzeltmeNeden}</p>}
                  {kalem("Bu ayın avansı", -r.avans)}
                  {kalem("Devreden avans", -r.devredenAvans)}
                  <div className="flex justify-between gap-4 border-t pt-2 font-medium"><span>Ödenecek</span><span className="tabular-nums">{tl(r.odenecek)}</span></div>
                  {kalem("Sonraki aya devreden avans", r.fazlaAvans)}
                </>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

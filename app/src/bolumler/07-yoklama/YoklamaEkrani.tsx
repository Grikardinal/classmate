import * as React from "react";
import { AlertTriangle, ArrowLeft, CheckCircle2, HeartPulse } from "lucide-react";
import { Alert, Avatar, Button, Card, CardContent, Field, Input, toast } from "@/components/ui";
import { useOturum } from "@/context/AppContext";
import { BUGUN, SIMDI, bildirimEkle, dersAdi, derslikAdi, grupEtiket, guncelle, islemYaz, konular, oturumlar, ogrenciYoklamalari, personelAdi, tamAd, useDb } from "@/data/store";
import { haftaBasi, sonrakiDurum, tarihEkle, type YoklamaDurumu } from "@/lib/kurallar";
import { cn } from "@/lib/utils";
import { KONU_UZUNLUK, devamsizlikOlayi, ilkDurumlar, tarihMetni, yeniGelmeyenler, yoklamaListesi, yoklamaZamanEngeli } from "./kurallar";
import { durumlar, tarihUzun } from "./ortak";

/* ---------- Yoklama ekranı (telefonda hızlı) ---------- */
export function YoklamaEkrani({ id, tarih, onKapat }: { id: string; tarih: string; onKapat: () => void }) {
  const d = useDb();
  const { rol, ad } = useOturum();
  const o = oturumlar(d, tarih).find((x) => x.id === id);
  const mevcut = d.yoklamalar[id];
  const ogrenciler = o ? yoklamaListesi(d, o.satir.grupId, tarih, mevcut) : [];
  const izinler = d.izinler.filter((i) => i.tarih === tarih);
  const [durum, setDurum] = React.useState<Record<string, YoklamaDurumu>>(() =>
    ilkDurumlar(ogrenciler.map((x) => x.id), new Set(izinler.map((i) => i.ogrenciId)), mevcut),
  );
  const [konu, setKonu] = React.useState(mevcut?.konu ?? "");
  if (!o) return null;

  // Sunucuyla aynı kural (kurallar.ts · yoklamaZamanEngeli)
  const kilit = yoklamaZamanEngeli({ tarih, bas: o.bas, kayitVar: !!mevcut, rol, bugun: BUGUN, simdi: SIMDI });
  const kilitli = !!kilit;
  const olay = devamsizlikOlayi(tarih, BUGUN);
  const sayim = (k: YoklamaDurumu) => Object.values(durum).filter((x) => x === k).length;
  const oneriler = konular[o.satir.dersId] ?? [];

  const kaydet = () => {
    let bildirilen = 0;
    const uyarilanlar: string[] = [];
    guncelle((x) => {
      x.yoklamalar = { ...x.yoklamalar, [id]: { oturumId: id, tarih, satirId: o.satir.id, grupId: o.satir.grupId, ogretmenId: o.satir.ogretmenId, durumlar: durum, konu: konu.trim(), kayitZamani: `${BUGUN}T${SIMDI}` } };
      for (const ogrId of yeniGelmeyenler(durum, mevcut?.durumlar)) {
        // Dersin günü "bugün", 7 güne kadar geç girişte tarihli mesaj; daha eskisine mesaj gitmez
        if (olay) bildirilen += bildirimEkle(x, olay, ogrId, { saat: o.bas, ders: dersAdi(o.satir.dersId), tarih: tarihMetni(tarih) });
        const hafta = haftaBasi(tarih);
        const n = ogrenciYoklamalari(x, ogrId, hafta, tarihEkle(hafta, 6)).filter((y) => y.durum === "gelmedi").length;
        if (n >= x.ayarlar.devamsizlikEsigi) {
          const ogr = x.ogrenciler.find((z) => z.id === ogrId);
          uyarilanlar.push(tamAd(ogr));
          islemYaz(x, "Sistem", "Devamsızlık uyarısı", `${tamAd(ogr)} bu hafta ${n} derse katılmadı`, o.subeId);
        }
      }
      if (mevcut) islemYaz(x, ad, "Yoklama düzeltme", `${grupEtiket(x, o.satir.grupId)} ${tarih} ${o.bas}`, o.subeId);
    });
    toast(bildirilen ? `Yoklama kaydedildi; ${bildirilen} veliye devamsızlık bildirimi gönderildi.` : "Yoklama kaydedildi.");
    if (uyarilanlar.length) toast(`Haftalık devamsızlık eşiği aşıldı: ${uyarilanlar.join(", ")} — yöneticiye uyarı düştü.`, "uyari");
    onKapat();
  };

  return (
    <div className="mx-auto grid w-full max-w-2xl gap-4">
      <button onClick={onKapat} className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" /> Dersler
      </button>
      <div>
        <p className="text-sm text-muted-foreground">{tarihUzun(tarih)} · {o.bas}–{o.bit} · {derslikAdi(o.satir.derslikId)}</p>
        <h1 className="text-2xl font-semibold tracking-tight">{grupEtiket(d, o.satir.grupId)} · {dersAdi(o.satir.dersId)}</h1>
        <p className="text-sm text-muted-foreground">{personelAdi(d, o.satir.ogretmenId)}</p>
      </div>

      {kilit && <Alert tone="warning" icon={<AlertTriangle />}>{kilit}</Alert>}
      {!kilit && !olay && <Alert icon={<AlertTriangle />}>7 günden eski kayıtta veliye yeni devamsızlık bildirimi gitmez.</Alert>}

      <div className="flex flex-wrap gap-2 text-sm">
        {durumlar.map((s) => (
          <span key={s.key} className="rounded-full border px-3 py-1">{s.ad}: <b className="tabular-nums">{sayim(s.key)}</b></span>
        ))}
        {!kilitli && (
          <Button variant="ghost" size="sm" className="ml-auto" onClick={() => setDurum(Object.fromEntries(ogrenciler.map((x) => [x.id, "geldi" as YoklamaDurumu])))}>
            Hepsi geldi
          </Button>
        )}
      </div>

      <Card>
        <ul className="divide-y">
          {ogrenciler.map((x) => {
            const s = durum[x.id];
            const izin = izinler.find((i) => i.ogrenciId === x.id);
            return (
              <li key={x.id} className="grid gap-2 p-3 sm:flex sm:items-center sm:gap-3">
                <button
                  disabled={kilitli}
                  onClick={() => setDurum({ ...durum, [x.id]: sonrakiDurum(s) })}
                  className="flex min-w-0 flex-1 items-center gap-3 text-left"
                  aria-label={`${tamAd(x)}: ${durumlar.find((z) => z.key === s)?.ad}. Değiştirmek için dokunun.`}
                >
                  <Avatar ad={tamAd(x)} className={cn("size-10 ring-2 ring-offset-2 ring-offset-card", s === "geldi" ? "ring-success/60" : s === "gelmedi" ? "ring-danger" : s === "gec" ? "ring-warning" : "ring-muted-foreground/40")} />
                  <span className="min-w-0">
                    <span className="block truncate font-medium">{tamAd(x)} {x.saglikNotu && <HeartPulse className="inline size-3.5 text-danger" aria-label={x.saglikNotu} />}</span>
                    {izin && <span className="block truncate text-xs text-muted-foreground">Veli izni: {izin.not}</span>}
                  </span>
                </button>
                <div className="grid grid-cols-4 gap-1 sm:flex sm:shrink-0">
                  {durumlar.map((z) => (
                    <button
                      key={z.key}
                      disabled={kilitli}
                      onClick={() => setDurum({ ...durum, [x.id]: z.key })}
                      className={cn("h-10 min-w-11 rounded-md border px-2 text-xs font-medium transition sm:h-9",s === z.key ? z.sinif + " border-transparent" : "text-muted-foreground hover:bg-muted")}
                      aria-pressed={s === z.key}
                    >
                      {z.kisa}
                    </button>
                  ))}
                </div>
              </li>
            );
          })}
        </ul>
      </Card>

      <Card>
        <CardContent className="grid gap-2 p-4">
          <Field label="İşlenen konu (veliler görür)">
            <Input value={konu} maxLength={KONU_UZUNLUK} disabled={kilitli} onChange={(e) => setKonu(e.target.value)} placeholder="Örn. Kesirlerde toplama" />
          </Field>
          {!kilitli && (
            <div className="flex flex-wrap gap-1.5">
              {oneriler.map((k) => (
                <button key={k} onClick={() => setKonu(k)} className="rounded-full border px-2.5 py-0.5 text-xs text-muted-foreground hover:border-primary hover:text-primary">{k}</button>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {!kilitli && (
        <div className="sticky bottom-4 flex justify-end gap-2">
          <Button variant="outline" onClick={onKapat}>Vazgeç</Button>
          <Button onClick={kaydet} className="shadow-lg">
            <CheckCircle2 /> Kaydet {!!olay && sayim("gelmedi") > 0 && `· ${sayim("gelmedi")} gelmeyenin velisine bildir`}
          </Button>
        </div>
      )}
    </div>
  );
}

import * as React from "react";
import { Plus } from "lucide-react";
import { toast } from "@/components/ui";
import { useOturum } from "@/context/AppContext";
import { gunAdlari, gunKisa, type DersSaati } from "@/data/mock";
import { BUGUN, ders, dersAdi, derslikAdi, grup, grupEtiket, guncelle, islemYaz, oturumlar, personelAdi, saat, useDb, yeniId, type ProgramSatiri } from "@/data/store";
import { tanimAktif } from "@/bolumler/01-kurum-yapisi/kurallar";
import { cn } from "@/lib/utils";
import { bildirimGrubaDersDegisikligi, tarihKisa } from "./ortak";
import { bransDisiAtayabilir, cakismaMesaji, degisiklikDenetle, enErkenGecerlilik, gecerliSatirlar, programDegistir } from "./kurallar";

export function ProgramGrid({
  gunler,
  saatler,
  gorunum,
  secili,
  gunTarihi,
  duzenleyebilir,
  onHucre,
}: {
  gunler: number[];
  saatler: DersSaati[];
  gorunum: "grup" | "derslik";
  secili: string;
  gunTarihi: (gun: number) => string;
  duzenleyebilir: boolean;
  onHucre: (gun: number, saatId: string, satir?: ProgramSatiri) => void;
}) {
  const d = useDb();
  const { ad, rol } = useOturum();
  const [surukle, setSurukle] = React.useState<string | null>(null);

  // Pencereyle aynı denetim; değişiklik gösterilen haftadan değil, uygulanabilecek ilk tarihten itibaren geçerlidir
  const tasi = (satirId: string, gun: number, saatId: string) => {
    const s = d.program.find((p) => p.id === satirId);
    if (!s || (s.gun === gun && s.saatId === saatId)) return;
    const yeni = { ...s, gun, saatId };
    const gecerlilik = enErkenGecerlilik(s, d, BUGUN);
    const sonuc = degisiklikDenetle(d, s, yeni, gecerlilik, BUGUN, { bransDisi: bransDisiAtayabilir(rol) });
    const engel = sonuc.tarihEngeli ?? sonuc.atamaEngeli ?? (sonuc.cakismalar[0] ? cakismaMesaji(sonuc.cakismalar[0]) : null);
    if (engel) {
      toast(`Taşınamadı: ${engel}`, "hata");
      return;
    }
    // Şubeler arası geçiş onay gerektirir: taşıma pencerede onaylanır
    if (sonuc.gecisler.length) {
      toast("Şubeler arası geçiş süresi kısa; pencereden onaylayın.", "uyari");
      onHucre(gun, saatId, s);
      return;
    }
    guncelle((x) => {
      x.program = programDegistir(x.program, s, yeni, gecerlilik, () => yeniId("ps"));
      islemYaz(x, ad, "Program", `${grupEtiket(x, s.grupId)} ${dersAdi(s.dersId)}: ${gunKisa[s.gun]} → ${gunKisa[gun]} ${saat(saatId)?.baslangic}`, grup(x, s.grupId)?.subeId);
      bildirimGrubaDersDegisikligi(x, s.grupId, `${gunAdlari[gun]} ${saat(saatId)?.baslangic}`, dersAdi(s.dersId), "Ders saati değişti", gecerlilik);
    });
    toast(`Ders ${tarihKisa(gecerlilik)} tarihinden itibaren taşındı; grup velilerine bildirim gönderildi.`);
  };

  return (
    <table className="w-full min-w-[640px] table-fixed border-separate border-spacing-1 text-sm">
      <thead>
        <tr>
          <th className="w-20" />
          {gunler.map((g) => {
            const t = gunTarihi(g);
            return (
              <th key={g} className={cn("rounded-md py-1.5 text-xs font-medium", t === BUGUN ? "bg-accent text-accent-foreground" : "text-muted-foreground")}>
                {gunAdlari[g]} <span className="font-normal">{tarihKisa(t)}</span>
              </th>
            );
          })}
        </tr>
      </thead>
      <tbody>
        {saatler.map((h) => (
          <tr key={h.id}>
            <td className={cn("pr-1 text-right align-top text-xs tabular-nums text-muted-foreground", !tanimAktif(h) && "opacity-60")}>
              {h.baslangic}
              <br />
              {h.bitis}
              {!tanimAktif(h) && (
                <>
                  <br />
                  (pasif)
                </>
              )}
            </td>
            {gunler.map((g) => {
              const t = gunTarihi(g);
              const satir = gecerliSatirlar(d.program, t).find((p) => p.gun === g && p.saatId === h.id && (gorunum === "grup" ? p.grupId === secili : p.derslikId === secili));
              const oturum = satir ? oturumlar(d, t).find((o) => o.satir.id === satir.id) : undefined;
              const tatil = d.tatiller.find((x) => x.tarih === t && (!x.subeId || x.subeId === h.subeId));
              const ds = satir ? ders(satir.dersId) : undefined;
              return (
                <td
                  key={g}
                  onDragOver={(e) => duzenleyebilir && !satir && tanimAktif(h) && e.preventDefault()}
                  onDrop={(e) => {
                    e.preventDefault();
                    if (surukle) tasi(surukle, g, h.id);
                    setSurukle(null);
                  }}
                  className="h-16 align-top"
                >
                  {satir && ds ? (
                    <button
                      draggable={duzenleyebilir}
                      onDragStart={() => setSurukle(satir.id)}
                      onClick={() => onHucre(g, h.id, satir)}
                      className={cn("relative h-full w-full overflow-hidden rounded-md border-l-4 p-1.5 text-left transition hover:brightness-95", (oturum?.iptal || tatil) && "opacity-50")}
                      style={{ borderLeftColor: ds.renk, background: `color-mix(in oklab, ${ds.renk} 12%, var(--color-card))` }}
                    >
                      <p className="truncate font-medium">{ds.ad}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {gorunum === "grup" ? `${personelAdi(d, oturum?.ogretmenId ?? satir.ogretmenId)}${oturum?.yedek ? " (yedek)" : ""}` : grupEtiket(d, satir.grupId)}
                      </p>
                      <p className="truncate text-xs text-muted-foreground">{gorunum === "grup" ? derslikAdi(satir.derslikId) : `${personelAdi(d, oturum?.ogretmenId ?? satir.ogretmenId)}${oturum?.yedek ? " (yedek)" : ""}`}</p>
                      {(oturum?.iptal || tatil) && (
                        <span className="absolute right-1 top-1 rounded bg-danger px-1 text-[10px] font-medium text-white">{tatil ? "Tatil" : "İptal"}</span>
                      )}
                    </button>
                  ) : (
                    <button
                      onClick={() => onHucre(g, h.id)}
                      disabled={!duzenleyebilir || gorunum !== "grup" || !tanimAktif(h)}
                      className={cn(
                        "grid h-full w-full place-items-center rounded-md border border-dashed text-muted-foreground/0 transition",
                        duzenleyebilir && gorunum === "grup" && tanimAktif(h) && "hover:border-primary/50 hover:text-primary",
                        tatil && "bg-muted/60",
                      )}
                      aria-label={`${gunAdlari[g]} ${h.baslangic} ders ekle`}
                    >
                      {tatil ? <span className="text-[10px] text-muted-foreground">{tatil.ad}</span> : <Plus className="size-4" />}
                    </button>
                  )}
                </td>
              );
            })}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

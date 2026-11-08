import * as React from "react";
import { CalendarDays, ChevronLeft, ChevronRight, DoorOpen, Printer, User, Users } from "lucide-react";
import { Button, Card, CardContent, CardHeader, CardTitle, EmptyState, Select } from "@/components/ui";
import { useApp, useOturum } from "@/context/AppContext";
import { gunAdlari, type DersSaati } from "@/data/mock";
import { BUGUN, dersAdi, derslikAdi, grup, grupEtiket, personelAdi, saat, sube, tanimlar, useDb, type ProgramSatiri } from "@/data/store";
import { dakika, haftaBasi, tarihEkle } from "@/lib/kurallar";
import { esc, yazdir } from "@/lib/yazdir";
import { pasifEki, tanimAktif } from "@/bolumler/01-kurum-yapisi/kurallar";
import { cn } from "@/lib/utils";
import { DersDialog } from "./DersDialog";
import { OgretmenAjandasi } from "./OgretmenAjandasi";
import { ProgramGrid } from "./ProgramGrid";
import { tarihKisa, type Gorunum } from "./ortak";
import { gecerliSatirlar, haftaSatirlari } from "./kurallar";

export function HaftalikProgram() {
  const d = useDb();
  const { subeId } = useApp();
  const { grupGorunur, subeGorunur, ogretmenMi, personel, yetki, seciliSubeler } = useOturum();
  const duzenleyebilir = yetki("06") && !ogretmenMi;
  const [gorunum, setGorunum] = React.useState<Gorunum>(ogretmenMi ? "ogretmen" : "grup");
  const gruplar = d.gruplar.filter((g) => grupGorunur(g.id)).sort((a, b) => a.subeId.localeCompare(b.subeId) || a.seviye - b.seviye);
  const ogretmenler = d.personel.filter((p) => p.gorev === "ogretmen" && p.aktif && (ogretmenMi ? p.id === personel.id : p.subeIds.some((s) => subeGorunur(s))));
  const dersliklerim = tanimlar().derslikler.filter((x) => subeGorunur(x.subeId));
  const [secim, setSecim] = React.useState<Record<Gorunum, string>>({
    grup: gruplar[0]?.id ?? "",
    ogretmen: ogretmenMi ? personel.id : ogretmenler[0]?.id ?? "",
    derslik: dersliklerim[0]?.id ?? "",
  });
  const [hafta, setHafta] = React.useState(haftaBasi(BUGUN));
  const [duzenle, setDuzenle] = React.useState<{ satir?: ProgramSatiri; gun: number; saatId: string; grupId: string } | null>(null);

  // Şube seçici değişince seçimi kapsam içinde tut
  React.useEffect(() => {
    setSecim((s) => ({
      grup: gruplar.some((g) => g.id === s.grup) ? s.grup : gruplar[0]?.id ?? "",
      ogretmen: ogretmenler.some((o) => o.id === s.ogretmen) ? s.ogretmen : ogretmenler[0]?.id ?? "",
      derslik: dersliklerim.some((x) => x.id === s.derslik) ? s.derslik : dersliklerim[0]?.id ?? "",
    }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [subeId, d.gruplar.length]);

  const secili = secim[gorunum];
  const gunTarihi = (gun: number) => tarihEkle(hafta, gun - 1);

  const yazdirProgram = () => {
    const baslik =
      gorunum === "grup" ? `${grupEtiket(d, secili)} ders programı` : gorunum === "ogretmen" ? `${personelAdi(d, secili)} — öğretmen programı` : `${derslikAdi(secili)} — derslik programı`;
    const satirlar = haftaSatirlari(d.program, hafta)
      .filter((p) => saat(p.saatId))
      .filter((p) => (gorunum === "grup" ? p.grupId === secili : gorunum === "ogretmen" ? p.ogretmenId === secili : p.derslikId === secili))
      .sort((a, b) => a.gun - b.gun || dakika(saat(a.saatId)!.baslangic) - dakika(saat(b.saatId)!.baslangic));
    yazdir(
      baslik,
      `<h1>${esc(baslik)}</h1><p class="kucuk">${tarihKisa(hafta)} haftasından itibaren geçerli</p>
       <table><tr><th>Gün</th><th>Saat</th><th>Ders</th><th>Grup</th><th>Öğretmen</th><th>Şube / derslik</th></tr>
       ${satirlar.map((p) => `<tr><td>${gunAdlari[p.gun]}</td><td>${saat(p.saatId)!.baslangic}–${saat(p.saatId)!.bitis}</td><td>${esc(dersAdi(p.dersId))}</td><td>${esc(grupEtiket(d, p.grupId))}</td><td>${esc(personelAdi(d, p.ogretmenId))}</td><td>${esc(sube(grup(d, p.grupId)?.subeId)?.ad)} · ${esc(derslikAdi(p.derslikId))}</td></tr>`).join("")}
       </table>`,
    );
  };

  return (
    <div className="grid gap-4">
      <Card>
        <CardContent className="flex flex-wrap items-center gap-2 p-4">
          <div className="inline-flex rounded-md border p-0.5">
            {([
              ["grup", "Grup", <Users key="g" />],
              ["ogretmen", "Öğretmen", <User key="o" />],
              ["derslik", "Derslik", <DoorOpen key="d" />],
            ] as const).map(([k, a, ikon]) => (
              <button
                key={k}
                onClick={() => setGorunum(k)}
                disabled={ogretmenMi && k !== "ogretmen"}
                className={cn("flex items-center gap-1.5 rounded px-3 py-1.5 text-sm [&_svg]:size-4 disabled:opacity-40", gorunum === k ? "bg-accent font-medium text-accent-foreground" : "text-muted-foreground hover:text-foreground")}
              >
                {ikon}
                {a}
              </button>
            ))}
          </div>
          <Select aria-label="Seçim" className="w-52" value={secili} onChange={(e) => setSecim({ ...secim, [gorunum]: e.target.value })} disabled={ogretmenMi && gorunum === "ogretmen"}>
            {gorunum === "grup" && gruplar.map((g) => <option key={g.id} value={g.id}>{grupEtiket(d, g.id)}</option>)}
            {gorunum === "ogretmen" && ogretmenler.map((o) => <option key={o.id} value={o.id}>{o.ad} {o.soyad}</option>)}
            {gorunum === "derslik" && dersliklerim.map((x) => <option key={x.id} value={x.id}>{sube(x.subeId)?.kod} · {x.ad}{pasifEki(x)}</option>)}
          </Select>
          <div className="ml-auto flex items-center gap-1">
            <Button variant="ghost" size="icon" aria-label="Önceki hafta" onClick={() => setHafta(tarihEkle(hafta, -7))}><ChevronLeft /></Button>
            <button className="min-w-36 text-center text-sm font-medium" onClick={() => setHafta(haftaBasi(BUGUN))} title="Bu haftaya dön">
              {tarihKisa(hafta)} – {tarihKisa(tarihEkle(hafta, 6))}
            </button>
            <Button variant="ghost" size="icon" aria-label="Sonraki hafta" onClick={() => setHafta(tarihEkle(hafta, 7))}><ChevronRight /></Button>
            <Button variant="outline" size="sm" onClick={yazdirProgram} disabled={!secili}><Printer /> Yazdır</Button>
          </div>
        </CardContent>
      </Card>

      {!secili ? (
        <EmptyState icon={<CalendarDays />} title="Gösterilecek kayıt yok" text="Şube kapsamınızda grup, öğretmen veya derslik bulunamadı." />
      ) : gorunum === "ogretmen" ? (
        <OgretmenAjandasi ogretmenId={secili} hafta={hafta} />
      ) : (
        (["hafta-ici", "hafta-sonu"] as const).map((tip) => {
          const subeIdx = gorunum === "grup" ? grup(d, secili)?.subeId : tanimlar().derslikler.find((x) => x.id === secili)?.subeId;
          // Pasif dilim yalnızca bu hafta görünen bir dersi varsa satır olarak gösterilir (yeni ders eklenemez)
          const kullanilan = (h: DersSaati) =>
            [1, 2, 3, 4, 5, 6, 7].some((g) => gecerliSatirlar(d.program, gunTarihi(g)).some((p) => p.gun === g && p.saatId === h.id && (gorunum === "grup" ? p.grupId === secili : p.derslikId === secili)));
          const saatler = tanimlar()
            .dersSaatleri.filter((h) => h.subeId === subeIdx && h.gunTipi === tip && (tanimAktif(h) || kullanilan(h)))
            .sort((a, b) => a.sira - b.sira);
          const gunler = tip === "hafta-ici" ? [1, 2, 3, 4, 5] : [6, 7];
          if (!saatler.length) return null;
          return (
            <Card key={tip}>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">{tip === "hafta-ici" ? "Hafta içi" : "Hafta sonu"}</CardTitle>
              </CardHeader>
              <div className="overflow-x-auto px-3 pb-3">
                <ProgramGrid
                  gunler={gunler}
                  saatler={saatler}
                  gorunum={gorunum}
                  secili={secili}
                  gunTarihi={gunTarihi}
                  duzenleyebilir={duzenleyebilir}
                  onHucre={(gun, saatId, satir) =>
                    duzenleyebilir && setDuzenle({ satir, gun, saatId, grupId: satir?.grupId ?? (gorunum === "grup" ? secili : "") })
                  }
                />
              </div>
            </Card>
          );
        })
      )}
      {gorunum !== "ogretmen" && secili && seciliSubeler.length > 0 && (
        <p className="text-xs text-muted-foreground">
          {duzenleyebilir
            ? "Boş hücreye tıklayıp ders ekleyin; dersi sürükleyip başka saate taşıyın. Değişiklik seçilen tarihten itibaren geçerli olur, geçmiş oturumlar etkilenmez."
            : "Programı yalnızca yönetim düzenleyebilir."}
        </p>
      )}
      {duzenle && <DersDialog {...duzenle} onClose={() => setDuzenle(null)} />}
    </div>
  );
}

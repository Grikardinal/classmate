import * as React from "react";
import { ChevronLeft, ChevronRight, Package, Video } from "lucide-react";
import { Alert, Button, Checkbox, Dialog, Field, Input, Select, toast } from "@/components/ui";
import { useOturum } from "@/context/AppContext";
import { gunAdlari, gunKisa } from "@/data/mock";
import { BUGUN, SIMDI, aktifKayit, bildirimEkle, guncelle, islemYaz, personelAdi, sube, tamAd, tanimlar, useDb, yeniId, type EtutTuru, type Musaitlik, type Randevu } from "@/data/store";
import { haftaBasi, haftaGunu, tarihEkle } from "@/lib/kurallar";
import { cn } from "@/lib/utils";
import { bosSlotlar, etutTurAd, randevuYeniEngeli, uygunPaket, yaklasanRandevular } from "./kurallar";
import { tarihKisa } from "./ortak";

export function Takvim() {
  const d = useDb();
  const { subeGorunur, ogretmenMi, personel } = useOturum();
  const [hafta, setHafta] = React.useState(haftaBasi(BUGUN));
  const [ogretmenId, setOgretmenId] = React.useState(ogretmenMi ? personel.id : "all");
  const [yeni, setYeni] = React.useState<{ m: Musaitlik; tarih: string; bas: string; bit: string } | null>(null);
  const ogretmenler = d.personel.filter((p) => d.musaitlikler.some((m) => m.ogretmenId === p.id && subeGorunur(m.subeId)));
  const gunler = [1, 2, 3, 4, 5, 6, 7].map((g) => tarihEkle(hafta, g - 1));
  const yaklasan = ogretmenMi ? yaklasanRandevular(d.randevular, personel.id, { bugun: BUGUN, simdi: SIMDI }) : [];

  return (
    <div className="grid gap-4">
      {ogretmenMi && (
        <div className="rounded-lg border border-primary/50 bg-accent/40 p-3">
          <p className="text-sm font-semibold">Yaklaşan randevularım</p>
          {yaklasan.length === 0 && <p className="mt-1 text-sm text-muted-foreground">Planlı randevunuz yok.</p>}
          <ul className="mt-1 grid gap-1 text-sm">
            {yaklasan.map((r) => (
              <li key={r.id}>
                <span className="font-medium tabular-nums">{r.tarih === BUGUN ? "Bugün" : tarihKisa(r.tarih)} {r.bas}</span> · {r.ogrenciIds.map((id) => d.ogrenciler.find((o) => o.id === id)?.ad).join(", ")} · {sube(r.subeId)?.kod}
              </li>
            ))}
          </ul>
        </div>
      )}
      <div className="flex flex-wrap items-center gap-2">
        <Select aria-label="Öğretmen" className="w-48" value={ogretmenId} disabled={ogretmenMi} onChange={(e) => setOgretmenId(e.target.value)}>
          <option value="all">Tüm öğretmenler</option>
          {ogretmenler.map((p) => <option key={p.id} value={p.id}>{p.ad} {p.soyad}</option>)}
        </Select>
        <div className="ml-auto flex items-center gap-1">
          <Button variant="ghost" size="icon" aria-label="Önceki hafta" onClick={() => setHafta(tarihEkle(hafta, -7))}><ChevronLeft /></Button>
          <span className="min-w-36 text-center text-sm font-medium">{tarihKisa(hafta)} – {tarihKisa(tarihEkle(hafta, 6))}</span>
          <Button variant="ghost" size="icon" aria-label="Sonraki hafta" onClick={() => setHafta(tarihEkle(hafta, 7))}><ChevronRight /></Button>
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7">
        {gunler.map((t) => {
          const randevular = d.randevular
            .filter((r) => r.tarih === t && subeGorunur(r.subeId) && (ogretmenId === "all" || r.ogretmenId === ogretmenId))
            .sort((a, b) => a.bas.localeCompare(b.bas));
          const bos = bosSlotlar(d, t, ogretmenId === "all" ? undefined : ogretmenId).filter((s) => subeGorunur(s.m.subeId));
          return (
            <div key={t} className={cn("rounded-lg border bg-card p-2", t === BUGUN && "border-primary/50")}>
              <p className="mb-2 text-xs font-medium text-muted-foreground">{gunKisa[haftaGunu(t)]} · {tarihKisa(t)}</p>
              <div className="grid gap-1.5">
                {randevular.map((r) => (
                  <div key={r.id} className={cn("rounded-md border-l-4 bg-accent/40 p-1.5 text-xs", r.durum === "iptal" && "opacity-50 line-through")} style={{ borderLeftColor: "var(--color-primary)" }}>
                    <p className="font-medium tabular-nums">{r.bas}–{r.bit} {r.tur === "online" && <Video className="inline size-3" />}</p>
                    <p className="truncate">{r.ogrenciIds.map((id) => d.ogrenciler.find((o) => o.id === id)?.ad).join(", ")}</p>
                    <p className="truncate text-muted-foreground">{personelAdi(d, r.ogretmenId)} · {sube(r.subeId)?.kod}</p>
                  </div>
                ))}
                {bos.map((s) => (
                  <button
                    key={`${s.m.id}${s.bas}`}
                    onClick={() => setYeni({ m: s.m, tarih: t, bas: s.bas, bit: s.bit })}
                    className="rounded-md border border-dashed p-1.5 text-left text-xs text-muted-foreground transition hover:border-primary hover:text-primary"
                  >
                    <span className="tabular-nums">{s.bas}</span> · boş · {d.personel.find((p) => p.id === s.m.ogretmenId)?.ad}
                  </button>
                ))}
                {!randevular.length && !bos.length && <p className="py-2 text-center text-xs text-muted-foreground">—</p>}
              </div>
            </div>
          );
        })}
      </div>
      <p className="text-xs text-muted-foreground">Boş slota tıklayarak randevu oluşturun. Randevudan 1 saat önce veliye otomatik hatırlatma gider.</p>
      {yeni && <RandevuDialog {...yeni} onClose={() => setYeni(null)} />}
    </div>
  );
}

function RandevuDialog({ m, tarih, bas, bit, onClose }: { m: Musaitlik; tarih: string; bas: string; bit: string; onClose: () => void }) {
  const d = useDb();
  const { ad } = useOturum();
  const ogretmen = d.personel.find((p) => p.id === m.ogretmenId)!;
  const [tur, setTur] = React.useState<EtutTuru>("bireysel");
  const [secili, setSecili] = React.useState<string[]>([]);
  const [ara, setAra] = React.useState("");
  const [dersId, setDersId] = React.useState(ogretmen.dersIds[0] ?? tanimlar().dersler.find((x) => x.aktif)?.id ?? "");
  const [link, setLink] = React.useState("");
  const adaylar = d.ogrenciler
    .filter((o) => o.durum === "aktif" && aktifKayit(d, o.id)?.subeId === m.subeId)
    .filter((o) => !ara || tamAd(o).toLocaleLowerCase("tr").includes(ara.toLocaleLowerCase("tr")))
    .slice(0, 30);
  const coklu = tur === "grup";
  const paket = secili.length === 1 ? uygunPaket(d, secili[0], m.ogretmenId) : undefined;
  // Grup etüdünde her öğrencinin (bu derse ait) paketi ayrı işlenir
  const grupPaketleri = coklu ? Object.fromEntries(secili.flatMap((o) => { const p = uygunPaket(d, o, m.ogretmenId); return p && p.dersId === dersId ? [[o, p.id]] : []; })) : null;
  const taslak: Randevu = { id: "__yeni", ogretmenId: m.ogretmenId, subeId: m.subeId, tarih, bas, bit, tur, ogrenciIds: secili, dersId: !coklu && paket ? paket.dersId : dersId, durum: "planli", link: tur === "online" ? link.trim() : "", paketId: !coklu ? paket?.id ?? null : null, olusturan: "yonetim", ...(grupPaketleri && Object.keys(grupPaketleri).length ? { paketIds: grupPaketleri } : {}) };
  // Sunucu ile aynı kural; öğretmen için grup sınırını aday listesi zaten sağlar (yalnızca kendi öğrencilerini görür)
  const engel = randevuYeniEngeli(taslak, d, { bugun: BUGUN, simdi: SIMDI, ogretmenGruplari: null });
  const gecerli = !engel;

  const kaydet = () => {
    if (!gecerli) return;
    guncelle((x) => {
      x.randevular.push({ ...taslak, id: yeniId("r") });
      for (const o of secili) bildirimEkle(x, "etutHatirlatma", o, { tarih: tarihKisa(tarih), saat: bas, ogretmen: tamAd(ogretmen) }, undefined, true);
      islemYaz(x, ad, "Etüt randevusu", `${tarih} ${bas} ${tamAd(ogretmen)} — ${secili.length} öğrenci`, m.subeId);
    });
    toast("Randevu oluşturuldu; veliye onay bildirimi gönderildi.");
    onClose();
  };

  return (
    <Dialog
      open
      onClose={onClose}
      title="Etüt randevusu"
      description={`${tamAd(ogretmen)} · ${gunAdlari[haftaGunu(tarih)]} ${tarihKisa(tarih)} ${bas}–${bit} · ${sube(m.subeId)?.ad}`}
      footer={<><Button variant="outline" onClick={onClose}>Vazgeç</Button><Button onClick={kaydet} disabled={!gecerli}>Oluştur</Button></>}
    >
      <div className="grid grid-cols-2 gap-3">
        <Field label="Tür">
          <Select value={tur} onChange={(e) => { setTur(e.target.value as EtutTuru); if (e.target.value !== "grup") setSecili(secili.slice(0, 1)); }}>
            {Object.entries(etutTurAd).map(([k, a]) => <option key={k} value={k}>{a}</option>)}
          </Select>
        </Field>
        <Field label="Ders">
          <Select value={dersId} onChange={(e) => setDersId(e.target.value)}>
            {tanimlar().dersler.filter((x) => x.aktif).map((x) => <option key={x.id} value={x.id}>{x.ad}</option>)}
          </Select>
        </Field>
      </div>
      {tur === "online" && <Field label="Görüşme linki (Zoom / Meet)"><Input placeholder="https://meet.google.com/…" value={link} onChange={(e) => setLink(e.target.value)} /></Field>}
      <Field label={coklu ? "Öğrenciler (küçük grup)" : "Öğrenci"}>
        <Input placeholder="Ara" value={ara} onChange={(e) => setAra(e.target.value)} />
      </Field>
      <div className="grid max-h-48 gap-1.5 overflow-y-auto rounded-md border p-3">
        {adaylar.map((o) => (
          <Checkbox
            key={o.id}
            checked={secili.includes(o.id)}
            onChange={(v) => setSecili(v ? (coklu ? [...secili, o.id] : [o.id]) : secili.filter((x) => x !== o.id))}
            label={tamAd(o)}
            description={uygunPaket(d, o.id, m.ogretmenId) ? "Özel ders paketi var" : undefined}
          />
        ))}
      </div>
      {secili.length > 0 && engel && !(tur === "ozel" && !paket) && <Alert tone="warning">{engel}</Alert>}
      {paket && !coklu && <Alert icon={<Package />}>Özel ders paketinden düşülecek: kalan {paket.kalan}/{paket.toplam}</Alert>}
      {tur === "ozel" && secili.length === 1 && !paket && <Alert tone="warning">Bu öğrencinin bu öğretmenle aktif özel ders paketi yok. “Özel ders paketleri” sekmesinden paket tanımlayın.</Alert>}
    </Dialog>
  );
}

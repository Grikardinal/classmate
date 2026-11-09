/** Bölüm 14 · Öğrenci listesi içe aktarma sihirbazı */
import * as React from "react";
import { AlertTriangle, ArrowLeft, ArrowRight, CheckCircle2, Download, FileSpreadsheet, RotateCcw, Upload } from "lucide-react";
import { Alert, Badge, Button, Card, CardContent, CardDescription, CardHeader, CardTitle, Checkbox, Field, Select, StatCard, Table, Td, Th, toast } from "@/components/ui";
import { useOturum } from "@/context/AppContext";
import { AKTIF_SEZON, BUGUN, getDb, grupEtiket, guncelle, simdiZaman, sube, tanimlar, useDb, yeniId } from "@/data/store";
import { csvCoz, csvOlustur, iceAktarmaAlanlari, sutunEslestir, type IceAktarmaAlani } from "@/lib/kurallar";
import { xlsxOku } from "@/lib/xlsx";
import { dosyaIndir } from "@/lib/yazdir";
import { cn } from "@/lib/utils";
import { ornekSatirlar, sablonBasliklar } from "./sablonlar";
import { aktarimTablosuEngeli, dosyaBoyutEngeli, geriAlmaEngeli, ogrenciAktarimGeriAl, ogrenciAktarimiUygula, ogrenciOnizleme, type OnizlemeSatiri } from "./kurallar";
import { PersonelAktarma, personelGeriAl } from "./PersonelAktarma";

export function AktarmaSecici() {
  const [tur, setTur] = React.useState<"ogrenci" | "personel">("ogrenci");
  return (
    <div className="grid gap-4">
      <div className="inline-flex w-fit rounded-md border p-0.5">
        {([["ogrenci", "Öğrenci listesi"], ["personel", "Personel listesi"]] as const).map(([k, a]) => (
          <button key={k} onClick={() => setTur(k)} className={cn("rounded px-3 py-1.5 text-sm", tur === k ? "bg-accent font-medium text-accent-foreground" : "text-muted-foreground hover:text-foreground")}>{a}</button>
        ))}
      </div>
      {tur === "ogrenci" ? <IceAktarma /> : <PersonelAktarma />}
    </div>
  );
}

const adimAdlari = ["Dosya", "Sütun eşleştirme", "Şube ve grup", "Önizleme", "Rapor"];

function IceAktarma() {
  const d = useDb();
  const { ad, kapsam } = useOturum();
  const [adim, setAdim] = React.useState(0);
  const [dosyaAdi, setDosyaAdi] = React.useState("");
  const [tablo, setTablo] = React.useState<string[][]>([]);
  const [eslesme, setEslesme] = React.useState<Partial<Record<IceAktarmaAlani, number>>>({});
  const [subeModu, setSubeModu] = React.useState<"sabit" | "sutun">("sabit");
  const [sabitSube, setSabitSube] = React.useState(kapsam[0]);
  const [grupModu, setGrupModu] = React.useState<"sutun" | "seviye">("sutun");
  const [sadeceHatali, setSadeceHatali] = React.useState(false);
  const [rapor, setRapor] = React.useState<{ id: string; eklenen: number; atlanan: OnizlemeSatiri[] } | null>(null);
  const [hata, setHata] = React.useState("");

  const basliklar = tablo[0] ?? [];
  const veri = tablo.slice(1);

  const yukle = async (f: File) => {
    setHata("");
    try {
      const boyutHata = dosyaBoyutEngeli(f.size);
      if (boyutHata) throw new Error(boyutHata);
      const t = /\.xlsx$/i.test(f.name) ? await xlsxOku(f) : csvCoz(await f.text());
      const tabloHata = aktarimTablosuEngeli(t.length);
      if (tabloHata) throw new Error(tabloHata);
      setTablo(t);
      setDosyaAdi(f.name);
      const e = sutunEslestir(t[0]);
      setEslesme(e);
      setSubeModu(e.sube !== undefined ? "sutun" : "sabit");
      setGrupModu(e.grup !== undefined ? "sutun" : "seviye");
      setAdim(1);
    } catch (err) {
      setHata(err instanceof Error ? err.message : "Dosya okunamadı.");
    }
  };
  const ornekleDene = () => {
    const t = [sablonBasliklar, ...ornekSatirlar];
    setTablo(t);
    setDosyaAdi("ornek-ogrenci-listesi.csv");
    setEslesme(sutunEslestir(t[0]));
    setSubeModu("sutun");
    setGrupModu("sutun");
    setAdim(1);
  };

  // Önizleme ve doğrulama
  const onizleme: OnizlemeSatiri[] = React.useMemo(() => {
    if (adim < 3) return [];
    return ogrenciOnizleme(d, veri, { eslesme, subeModu, sabitSube, grupModu, kapsam, sezonId: AKTIF_SEZON, bugun: BUGUN });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [adim, tablo, eslesme, subeModu, sabitSube, grupModu, d.ogrenciler.length, d.kayitlar.length]);

  const gecerli = onizleme.filter((s) => !s.hatalar.length);
  const hatali = onizleme.filter((s) => s.hatalar.length);

  const aktar = () => {
    const partiId = yeniId("ia");
    let eklenen = 0;
    guncelle((x) => {
      eklenen = ogrenciAktarimiUygula(x, gecerli, AKTIF_SEZON, { partiId, dosya: dosyaAdi, kullanici: ad, atlanan: hatali.length, bugun: BUGUN, zaman: simdiZaman() }).length;
    });
    setRapor({ id: partiId, eklenen, atlanan: hatali });
    setAdim(4);
    toast(`${eklenen} öğrenci aktarıldı.`);
  };

  const sifirla = () => {
    setAdim(0);
    setTablo([]);
    setRapor(null);
    setDosyaAdi("");
  };

  return (
    <div className="grid gap-4">
      <ol className="flex flex-wrap gap-2">
        {adimAdlari.map((a, i) => (
          <li key={a} className={cn("flex items-center gap-2 rounded-full border px-3 py-1 text-sm", i === adim ? "border-primary bg-accent font-medium text-accent-foreground" : i < adim ? "" : "text-muted-foreground")}>
            <span className={cn("grid size-5 place-items-center rounded-full text-[11px] font-semibold", i < adim ? "bg-primary text-primary-foreground" : "bg-muted")}>{i < adim ? "✓" : i + 1}</span>
            {a}
          </li>
        ))}
      </ol>

      {adim === 0 && (
        <div className="grid gap-4 lg:grid-cols-[1fr_20rem]">
          <Card>
            <CardContent className="p-5">
              <label
                className="flex cursor-pointer flex-col items-center justify-center gap-3 rounded-lg border-2 border-dashed px-6 py-14 text-center transition hover:border-primary"
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  const f = e.dataTransfer.files[0];
                  if (f) yukle(f);
                }}
              >
                <FileSpreadsheet className="size-10 text-primary" />
                <span className="font-medium">Excel (.xlsx) veya CSV dosyasını sürükleyin ya da seçin</span>
                <span className="max-w-md text-sm text-muted-foreground">Mevcut listenizi olduğu gibi yükleyebilirsiniz; sütunları bir sonraki adımda eşleştireceğiz.</span>
                <input type="file" accept=".xlsx,.csv,text/csv" className="sr-only" onChange={(e) => e.target.files?.[0] && yukle(e.target.files[0])} />
                <span className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground">Dosya seç</span>
              </label>
              {hata && <p className="mt-3 text-sm text-danger">{hata}</p>}
            </CardContent>
          </Card>
          <div className="grid content-start gap-3">
            <Button variant="outline" onClick={() => dosyaIndir("classmate-ogrenci-sablonu.csv", csvOlustur([sablonBasliklar, ornekSatirlar[0]]))}><Download /> Şablonu indir</Button>
            <Button variant="outline" onClick={ornekleDene}><FileSpreadsheet /> Örnek dosyayla dene</Button>
            <Alert icon={<RotateCcw />}>Aktarım geri alınabilir: aynı partiden gelen kayıtlar tek tıkla silinir. Deneme yapmak güvenli.</Alert>
            <OncekiAktarimlar />
          </div>
        </div>
      )}

      {adim === 1 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Sütun eşleştirme · {dosyaAdi}</CardTitle>
            <CardDescription>{veri.length} veri satırı. Otomatik öneriler işaretlendi; gerekirse düzeltin. Ad-soyad tek sütundaysa otomatik bölünür.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-2">
            {iceAktarmaAlanlari.map((a) => (
              <Field key={a.key} label={`${a.ad}${a.zorunlu ? " *" : ""}`}>
                <Select value={eslesme[a.key] ?? ""} onChange={(e) => setEslesme({ ...eslesme, [a.key]: e.target.value === "" ? undefined : Number(e.target.value) })}>
                  <option value="">— eşleştirme yok —</option>
                  {basliklar.map((b, i) => <option key={i} value={i}>{b || `Sütun ${i + 1}`} {veri[0]?.[i] ? `(örn. ${String(veri[0][i]).slice(0, 20)})` : ""}</option>)}
                </Select>
              </Field>
            ))}
          </CardContent>
          <CardContent className="flex justify-between border-t pt-4">
            <Button variant="outline" onClick={sifirla}><ArrowLeft /> Başka dosya</Button>
            <Button onClick={() => setAdim(2)} disabled={(eslesme.adSoyad === undefined && eslesme.ad === undefined) || eslesme.veliTelefon === undefined || eslesme.seviye === undefined}>
              İleri <ArrowRight />
            </Button>
          </CardContent>
        </Card>
      )}

      {adim === 2 && (
        <Card>
          <CardHeader><CardTitle className="text-base">Şube, sezon ve grup</CardTitle><CardDescription>Kayıtlar aktif sezona ({d.sezonlar.find((z) => z.id === AKTIF_SEZON)?.ad ?? AKTIF_SEZON}) eklenir.</CardDescription></CardHeader>
          <CardContent className="grid gap-5">
            <div className="grid gap-2">
              <span className="text-sm font-medium">Şube</span>
              <label className="flex items-center gap-2 text-sm"><input type="radio" checked={subeModu === "sabit"} onChange={() => setSubeModu("sabit")} className="accent-[var(--color-primary)]" /> Dosyanın tamamı tek şubeye ait:</label>
              {subeModu === "sabit" && (
                <Select className="ml-6 w-56" value={sabitSube} onChange={(e) => setSabitSube(e.target.value)}>
                  {tanimlar().subeler.filter((s) => kapsam.includes(s.id)).map((s) => <option key={s.id} value={s.id}>{s.ad}</option>)}
                </Select>
              )}
              <label className={cn("flex items-center gap-2 text-sm", eslesme.sube === undefined && "opacity-50")}>
                <input type="radio" disabled={eslesme.sube === undefined} checked={subeModu === "sutun"} onChange={() => setSubeModu("sutun")} className="accent-[var(--color-primary)]" /> Şube dosyadaki sütundan okunsun
              </label>
            </div>
            <div className="grid gap-2">
              <span className="text-sm font-medium">Grup</span>
              <label className={cn("flex items-center gap-2 text-sm", eslesme.grup === undefined && "opacity-50")}>
                <input type="radio" disabled={eslesme.grup === undefined} checked={grupModu === "sutun"} onChange={() => setGrupModu("sutun")} className="accent-[var(--color-primary)]" /> Dosyadaki grup adına göre (örn. “5-A”)
              </label>
              <label className="flex items-center gap-2 text-sm"><input type="radio" checked={grupModu === "seviye"} onChange={() => setGrupModu("seviye")} className="accent-[var(--color-primary)]" /> Sınıf seviyesine göre şubenin ilk grubuna yerleştir</label>
            </div>
          </CardContent>
          <CardContent className="flex justify-between border-t pt-4">
            <Button variant="outline" onClick={() => setAdim(1)}><ArrowLeft /> Geri</Button>
            <Button onClick={() => setAdim(3)}>Önizle <ArrowRight /></Button>
          </CardContent>
        </Card>
      )}

      {adim === 3 && (
        <div className="grid gap-4">
          <div className="grid grid-cols-3 gap-3">
            <StatCard label="Toplam satır" value={onizleme.length} />
            <StatCard label="Aktarılacak" value={gecerli.length} tone="success" icon={<CheckCircle2 />} />
            <StatCard label="Hatalı (atlanacak)" value={hatali.length} tone={hatali.length ? "danger" : "default"} icon={<AlertTriangle />} />
          </div>
          <Card>
            <CardHeader className="flex-row flex-wrap items-center justify-between gap-2">
              <CardTitle className="text-base">Önizleme ve doğrulama</CardTitle>
              <Checkbox checked={sadeceHatali} onChange={setSadeceHatali} label="Yalnızca hatalı satırlar" />
            </CardHeader>
            <Table>
              <thead><tr><Th>Satır</Th><Th>Öğrenci</Th><Th>Sınıf</Th><Th>Veli / telefon</Th><Th>Şube · grup</Th><Th>Durum</Th></tr></thead>
              <tbody>
                {onizleme.filter((s) => !sadeceHatali || s.hatalar.length).map((s) => (
                  <tr key={s.satirNo} className={cn(s.hatalar.length && "bg-danger/5")}>
                    <Td className="tabular-nums text-muted-foreground">{s.satirNo}</Td>
                    <Td className="font-medium">{`${s.ad} ${s.soyad}`.trim() || "—"}</Td>
                    <Td>{s.seviye ?? "—"}</Td>
                    <Td>{`${s.veliAd} ${s.veliSoyad}`.trim()} <span className="font-mono text-xs text-muted-foreground">{s.veliTelefon ?? ""}</span></Td>
                    <Td className="whitespace-nowrap">{s.grupId ? grupEtiket(d, s.grupId) : s.subeId ? sube(s.subeId)?.kod : "—"}</Td>
                    <Td>
                      {s.hatalar.map((h) => <p key={h} className="text-xs text-danger">✕ {h}</p>)}
                      {s.uyarilar.map((h) => <p key={h} className="text-xs text-warning">! {h}</p>)}
                      {s.kardesVeliId && !s.hatalar.length && <p className="text-xs text-primary">Kardeş: mevcut veliye bağlanacak</p>}
                      {!s.hatalar.length && !s.uyarilar.length && !s.kardesVeliId && <Badge variant="success">Hazır</Badge>}
                    </Td>
                  </tr>
                ))}
              </tbody>
            </Table>
            <CardContent className="flex flex-wrap justify-between gap-2 border-t pt-4">
              <Button variant="outline" onClick={() => setAdim(2)}><ArrowLeft /> Geri</Button>
              <div className="flex gap-2">
                <Button variant="outline" onClick={sifirla}>Düzeltip tekrar yükle</Button>
                <Button onClick={aktar} disabled={!gecerli.length}><Upload /> {gecerli.length} öğrenciyi aktar</Button>
              </div>
            </CardContent>
          </Card>
          <p className="text-xs text-muted-foreground">Telefonlar tek formata çevrilir (05xx xxx xx xx). Veliye portal daveti otomatik gitmez; “Kullanıcılar → Veli hesapları”ndan gönderebilirsiniz.</p>
        </div>
      )}

      {adim === 4 && rapor && (
        <Card>
          <CardContent className="grid gap-4 p-6 text-center">
            <CheckCircle2 className="mx-auto size-12 text-success" />
            <div>
              <p className="text-lg font-semibold">{rapor.eklenen} öğrenci eklendi</p>
              <p className="text-sm text-muted-foreground">{rapor.atlanan.length} satır atlandı</p>
            </div>
            <div className="flex flex-wrap justify-center gap-2">
              {rapor.atlanan.length > 0 && (
                <Button variant="outline" onClick={() => dosyaIndir("atlanan-satirlar.csv", csvOlustur([[...basliklar, "Hata"], ...rapor.atlanan.map((s) => [...(veri[s.satirNo - 2] ?? []), s.hatalar.join("; ")])]))}>
                  <Download /> Atlananları indir
                </Button>
              )}
              <Button variant="outline" onClick={() => { geriAl(rapor.id, ad); sifirla(); }}><RotateCcw /> Aktarımı geri al</Button>
              <Button onClick={sifirla}>Yeni aktarım</Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function geriAl(id: string, kullanici: string) {
  const p = getDb().iceAktarmalar.find((x) => x.id === id);
  if (!p) return;
  const engel = geriAlmaEngeli(getDb(), p);
  if (engel) return toast(engel, "uyari");
  guncelle((x) => ogrenciAktarimGeriAl(x, p, kullanici));
  toast("Aktarım geri alındı.");
}

function OncekiAktarimlar() {
  const d = useDb();
  const { ad } = useOturum();
  if (!d.iceAktarmalar.length) return null;
  return (
    <Card>
      <CardHeader><CardTitle className="text-sm">Önceki aktarımlar</CardTitle></CardHeader>
      <CardContent className="grid gap-2 text-sm">
        {[...d.iceAktarmalar].sort((a, b) => b.zaman.localeCompare(a.zaman)).slice(0, 5).map((p) => (
          <div key={p.id} className="flex items-center justify-between gap-2 rounded-md border p-2">
            <div className="min-w-0">
              <p className="truncate font-medium">{p.dosya}</p>
              <p className="text-xs text-muted-foreground">{p.personelIds?.length ? `${p.personelIds.length} personel` : `${p.ogrenciIds.length} öğrenci`} · {new Date(p.zaman).toLocaleDateString("tr-TR")}</p>
            </div>
            {p.geriAlindi ? <Badge variant="secondary">Geri alındı</Badge> : <Button size="sm" variant="ghost" onClick={() => (p.personelIds?.length ? personelGeriAl(p.id, ad) : geriAl(p.id, ad))}><RotateCcw /> Geri al</Button>}
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

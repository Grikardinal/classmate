/** Bölüm 14 · Personel listesi içe aktarma */
import * as React from "react";
import { ArrowLeft, CheckCircle2, Download, FileSpreadsheet, RotateCcw, Upload } from "lucide-react";
import { Badge, Button, Card, CardContent, CardHeader, CardTitle, Checkbox, Field, Select, Table, Td, Th, toast } from "@/components/ui";
import { useOturum } from "@/context/AppContext";
import { BUGUN, getDb, guncelle, islemYaz, rolAdlari, simdiZaman, sube, useDb, yeniId } from "@/data/store";
import { basliklariEslestir, csvCoz, csvOlustur, personelAlanlari, type PersonelAlani } from "@/lib/kurallar";
import { xlsxOku } from "@/lib/xlsx";
import { dosyaIndir } from "@/lib/yazdir";
import { cn } from "@/lib/utils";
import { personelOrnek, personelSablon } from "./sablonlar";
import { aktarimTablosuEngeli, dosyaBoyutEngeli, personelOnizleme, type PersonelSatiri } from "./kurallar";

export function PersonelAktarma() {
  const d = useDb();
  const { ad, kapsam } = useOturum();
  const [tablo, setTablo] = React.useState<string[][]>([]);
  const [dosyaAdi, setDosyaAdi] = React.useState("");
  const [eslesme, setEslesme] = React.useState<Partial<Record<PersonelAlani, number>>>({});
  const [hesapAc, setHesapAc] = React.useState(true);
  const [sonuc, setSonuc] = React.useState<{ id: string; eklenen: number; atlanan: number } | null>(null);
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
      setEslesme(basliklariEslestir(t[0], personelAlanlari));
      setSonuc(null);
    } catch (e) {
      setHata(e instanceof Error ? e.message : "Dosya okunamadı.");
    }
  };

  const satirlar: PersonelSatiri[] = React.useMemo(
    () => personelOnizleme(d, veri, eslesme, kapsam, hesapAc),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [tablo, eslesme, d.subeler, d.dersler, d.personel, d.kullanicilar, kapsam, hesapAc],
  );

  const gecerli = satirlar.filter((s) => !s.hatalar.length);
  const aktar = () => {
    const partiId = yeniId("ia");
    const ids: string[] = [];
    guncelle((x) => {
      for (const s of gecerli) {
        const pid = yeniId("p");
        ids.push(pid);
        x.personel.push({
          id: pid, ad: s.ad, soyad: s.soyad, gorev: s.rol!, telefon: s.telefon!, eposta: s.eposta, subeIds: s.subeIds, anaSubeId: s.subeIds[0],
          dersIds: s.dersIds, baslangic: BUGUN, aktif: true, ucretTipi: s.rol === "ogretmen" ? "ders" : "sabit", dersUcreti: 0, sabitUcret: 0, iceAktarmaId: partiId,
        });
        if (hesapAc && s.eposta)
          x.kullanicilar.push({ id: yeniId("u"), personelId: pid, rol: s.rol!, subeIds: s.subeIds, eposta: s.eposta, aktif: true, sonGiris: null, ikiAdim: false });
      }
      x.iceAktarmalar.unshift({ id: partiId, zaman: simdiZaman(), dosya: dosyaAdi, ogrenciIds: [], veliIds: [], kayitIds: [], personelIds: ids, atlanan: satirlar.length - gecerli.length, geriAlindi: false });
      islemYaz(x, ad, "Excel içe aktarma", `${dosyaAdi}: ${ids.length} personel eklendi`);
    });
    setSonuc({ id: partiId, eklenen: ids.length, atlanan: satirlar.length - gecerli.length });
    toast(`${ids.length} personel aktarıldı. Parolaları Bölüm 02'den “Parola sıfırla” ile oluşturun.`);
  };

  if (sonuc)
    return (
      <Card>
        <CardContent className="grid gap-4 p-6 text-center">
          <CheckCircle2 className="mx-auto size-12 text-success" />
          <p className="text-lg font-semibold">{sonuc.eklenen} personel eklendi · {sonuc.atlanan} satır atlandı</p>
          <p className="text-sm text-muted-foreground">Kullanıcı hesaplarının parolası yoktur; Bölüm 02 → Personel hesapları → anahtar simgesiyle geçici parola üretin.</p>
          <div className="flex justify-center gap-2">
            <Button variant="outline" onClick={() => { personelGeriAl(sonuc.id, ad); setSonuc(null); setTablo([]); }}><RotateCcw /> Geri al</Button>
            <Button onClick={() => { setSonuc(null); setTablo([]); }}>Yeni aktarım</Button>
          </div>
        </CardContent>
      </Card>
    );

  return (
    <div className="grid gap-4">
      {!tablo.length ? (
        <div className="grid gap-4 lg:grid-cols-[1fr_20rem]">
          <Card>
            <CardContent className="p-5">
              <label className="flex cursor-pointer flex-col items-center justify-center gap-3 rounded-lg border-2 border-dashed px-6 py-14 text-center transition hover:border-primary">
                <FileSpreadsheet className="size-10 text-primary" />
                <span className="font-medium">Personel listesini (.xlsx veya CSV) seçin</span>
                <span className="max-w-md text-sm text-muted-foreground">Sütunlar: ad soyad, görev (öğretmen / sekreter / şube müdürü), cep telefonu, e-posta, şube(ler), branş(lar).</span>
                <input type="file" accept=".xlsx,.csv,text/csv" className="sr-only" onChange={(e) => e.target.files?.[0] && yukle(e.target.files[0])} />
                <span className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground">Dosya seç</span>
              </label>
              {hata && <p className="mt-3 text-sm text-danger">{hata}</p>}
            </CardContent>
          </Card>
          <div className="grid content-start gap-3">
            <Button variant="outline" onClick={() => dosyaIndir("classmate-personel-sablonu.csv", csvOlustur([personelSablon, personelOrnek[0]]))}><Download /> Şablonu indir</Button>
            <Button variant="outline" onClick={() => { const t = [personelSablon, ...personelOrnek]; setTablo(t); setDosyaAdi("ornek-personel.csv"); setEslesme(basliklariEslestir(t[0], personelAlanlari)); }}><FileSpreadsheet /> Örnek dosyayla dene</Button>
          </div>
        </div>
      ) : (
        <>
          <Card>
            <CardHeader><CardTitle className="text-base">Sütun eşleştirme · {dosyaAdi}</CardTitle></CardHeader>
            <CardContent className="grid gap-3 sm:grid-cols-3">
              {personelAlanlari.map((a) => (
                <Field key={a.key} label={`${a.ad}${a.zorunlu ? " *" : ""}`}>
                  <Select value={eslesme[a.key] ?? ""} onChange={(e) => setEslesme({ ...eslesme, [a.key]: e.target.value === "" ? undefined : Number(e.target.value) })}>
                    <option value="">— yok —</option>
                    {basliklar.map((b, i) => <option key={i} value={i}>{b || `Sütun ${i + 1}`}</option>)}
                  </Select>
                </Field>
              ))}
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex-row flex-wrap items-center justify-between gap-2">
              <CardTitle className="text-base">Önizleme · {gecerli.length}/{satirlar.length} aktarılacak</CardTitle>
              <Checkbox checked={hesapAc} onChange={setHesapAc} label="E-postası olanlara kullanıcı hesabı aç" />
            </CardHeader>
            <Table>
              <thead><tr><Th>Satır</Th><Th>Ad soyad</Th><Th>Görev</Th><Th>Telefon</Th><Th>Şube</Th><Th>Durum</Th></tr></thead>
              <tbody>
                {satirlar.map((s) => (
                  <tr key={s.satirNo} className={cn(s.hatalar.length && "bg-danger/5")}>
                    <Td className="tabular-nums text-muted-foreground">{s.satirNo}</Td>
                    <Td className="font-medium">{`${s.ad} ${s.soyad}`.trim() || "—"}</Td>
                    <Td>{s.rol ? rolAdlari[s.rol] : "—"}</Td>
                    <Td className="font-mono text-xs">{s.telefon ?? "—"}</Td>
                    <Td>{s.subeIds.map((x) => sube(x)?.kod).join(", ")}</Td>
                    <Td>
                      {s.hatalar.map((h) => <p key={h} className="text-xs text-danger">✕ {h}</p>)}
                      {s.uyarilar.map((h) => <p key={h} className="text-xs text-warning">! {h}</p>)}
                      {!s.hatalar.length && !s.uyarilar.length && <Badge variant="success">Hazır</Badge>}
                    </Td>
                  </tr>
                ))}
              </tbody>
            </Table>
            <CardContent className="flex justify-between border-t pt-4">
              <Button variant="outline" onClick={() => setTablo([])}><ArrowLeft /> Başka dosya</Button>
              <Button onClick={aktar} disabled={!gecerli.length || eslesme.adSoyad === undefined || eslesme.gorev === undefined || eslesme.telefon === undefined}><Upload /> {gecerli.length} personeli aktar</Button>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}

export function personelGeriAl(id: string, kullanici: string) {
  const p = getDb().iceAktarmalar.find((x) => x.id === id);
  if (!p || p.geriAlindi) return;
  const ids = new Set(p.personelIds ?? []);
  if (getDb().program.some((x) => ids.has(x.ogretmenId))) return toast("Aktarılan öğretmenlerden biri ders programına atanmış; önce programdan çıkarın.", "uyari");
  guncelle((x) => {
    x.kullanicilar = x.kullanicilar.filter((k) => !ids.has(k.personelId));
    x.personel = x.personel.filter((y) => !ids.has(y.id));
    x.iceAktarmalar = x.iceAktarmalar.map((y) => (y.id === id ? { ...y, geriAlindi: true } : y));
    islemYaz(x, kullanici, "İçe aktarma geri alındı", `${p.dosya}: ${ids.size} personel silindi`);
  });
  toast("Personel aktarımı geri alındı.");
}

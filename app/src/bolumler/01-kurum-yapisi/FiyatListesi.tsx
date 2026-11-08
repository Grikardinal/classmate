import * as React from "react";
import { Check } from "lucide-react";
import { Button, Card, CardContent, CardDescription, CardHeader, CardTitle, Field, Input, Select, Table, Td, Th, toast } from "@/components/ui";
import { useOturum } from "@/context/AppContext";
import { guncelle, islemYaz, useDb, type CaymaBedeli } from "@/data/store";
import { tl } from "@/lib/kurallar";
import { caymaBedeliEngeli } from "../05-finans/kurallar";
import { SEVIYELER, fiyatBul, fiyatListesiDogrula, sezonFiyatlariniYaz } from "./kurallar";
import { HataMetni, useGenel } from "./ortak";

const hucre = (subeId: string, seviye: number) => `${subeId}|${seviye}`;

/**
 * Fiyat listesi (yalnızca Finans modülü açıkken görünür). Karar 2026-11-07: fiyat sezon + şube + seviye bazında.
 * Boş hücre "fiyat tanımlı değil" demektir: o şube/seviyeye bu sezonda ücretli kayıt yapılamaz, sezon geçişi durur.
 */
export function FiyatListesi() {
  const d = useDb();
  const genel = useGenel();
  const { ad } = useOturum();
  const [sezonId, setSezonId] = React.useState(() => d.sezonlar.find((s) => s.aktif)?.id ?? d.sezonlar[0]?.id ?? "");
  const metinler = (z: string) =>
    Object.fromEntries(
      d.subeler.flatMap((s) => SEVIYELER.map((v) => [hucre(s.id, v), String(fiyatBul(d.fiyatListesi, z, s.id, v) ?? "")])),
    ) as Record<string, string>;
  // Ekranda yazılan metin tutulur; boş kutu 0 sayılmaz (tanımsız), kaydetmeden önce doğrulanır
  const [f, setF] = React.useState<Record<string, string>>(() => metinler(sezonId));
  const sezonSec = (z: string) => {
    setSezonId(z);
    setF(metinler(z));
  };
  const sayi = (s: string) => (s.trim() === "" ? undefined : Number(s.replace(",", ".")));
  const yeni = sezonFiyatlariniYaz(
    d.fiyatListesi,
    sezonId,
    d.subeler.flatMap((s) => SEVIYELER.map((v) => ({ subeId: s.id, seviye: v, fiyat: sayi(f[hucre(s.id, v)] ?? "") }))),
  );
  const gecersiz = Object.values(f).some((s) => s.trim() !== "" && Number.isNaN(Number(s.replace(",", "."))));
  const hata = gecersiz ? "Liste fiyatı sayı olmalı." : fiyatListesiDogrula(yeni, d);
  const tanimsiz = Object.values(f).filter((s) => s.trim() === "").length;

  const kaydet = () => {
    if (hata || !sezonId) return;
    guncelle((x) => {
      x.fiyatListesi = yeni;
      islemYaz(x, ad, "Fiyat listesi", `${d.sezonlar.find((s) => s.id === sezonId)?.ad} liste fiyatları güncellendi`);
    });
    toast("Fiyat listesi kaydedildi.");
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Fiyat listesi</CardTitle>
        <CardDescription>
          Sezonluk liste fiyatı: sezon, şube ve sınıf seviyesine göre. Kayıt sihirbazı bu fiyattan başlar, indirimler ayrıca uygulanır.
          Boş hücre “fiyat tanımlı değil” demektir; 0 ücretsizdir.
        </CardDescription>
      </CardHeader>
      <CardContent className="max-w-xs pb-4">
        <Field label="Sezon">
          <Select value={sezonId} onChange={(e) => sezonSec(e.target.value)}>
            {d.sezonlar.map((s) => <option key={s.id} value={s.id}>{s.ad}{s.aktif ? " (aktif)" : ""}</option>)}
          </Select>
        </Field>
      </CardContent>
      <Table>
        <thead>
          <tr><Th>Şube</Th>{SEVIYELER.map((v) => <Th key={v} className="w-32">{v}. sınıf (₺)</Th>)}</tr>
        </thead>
        <tbody>
          {d.subeler.map((s) => (
            <tr key={s.id}>
              <Td className="font-medium">{s.ad}</Td>
              {SEVIYELER.map((v) => {
                const k = hucre(s.id, v);
                const n = sayi(f[k] ?? "");
                return (
                  <Td key={v}>
                    <Input
                      type="number" min={0} step="0.01" aria-label={`${s.ad} ${v}. sınıf liste fiyatı`} disabled={!genel}
                      placeholder="—" value={f[k] ?? ""} onChange={(e) => setF({ ...f, [k]: e.target.value })}
                      title={n !== undefined && !Number.isNaN(n) && n >= 0 ? tl(n) : "Fiyat tanımlı değil"}
                    />
                  </Td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </Table>
      <CardContent className="flex flex-wrap items-center justify-end gap-3 pt-4">
        {tanimsiz > 0 && <p className="mr-auto text-xs text-muted-foreground">{tanimsiz} hücrede fiyat tanımlı değil.</p>}
        {genel && (
          <>
            <HataMetni hata={hata} />
            <Button onClick={kaydet} disabled={!!hata}><Check /> Kaydet</Button>
          </>
        )}
      </CardContent>
      <CaymaBedeliAyari />
    </Card>
  );
}

/** Kayıt iptalinde cayma bedeli (Bölüm 05, karar 2026-11-08): yüzde (plan toplamı üzerinden) veya sabit tutar; varsayılan 0 */
function CaymaBedeliAyari() {
  const d = useDb();
  const genel = useGenel();
  const { ad } = useOturum();
  const [tur, setTur] = React.useState<CaymaBedeli["tur"]>(d.kurum?.caymaBedeli?.tur ?? "yuzde");
  const [deger, setDeger] = React.useState(String(d.kurum?.caymaBedeli?.deger ?? 0));
  const ayar: CaymaBedeli = { tur, deger: deger.trim() === "" ? NaN : Number(deger.replace(",", ".")) };
  const hata = caymaBedeliEngeli(ayar);
  const kaydet = () => {
    if (hata) return;
    guncelle((x) => {
      x.kurum = { ...x.kurum, caymaBedeli: ayar };
      islemYaz(x, ad, "Cayma bedeli", ayar.tur === "yuzde" ? `%${ayar.deger}` : tl(ayar.deger));
    });
    toast("Cayma bedeli kaydedildi.");
  };
  return (
    <CardContent className="grid gap-3 border-t pt-4">
      <div>
        <p className="font-medium">Cayma bedeli</p>
        <p className="text-xs text-muted-foreground">
          Kayıt iptalinde kullanılan tutara eklenir; ödenen fazlaysa fark iade edilir. Yüzde, ödeme planı toplamı üzerinden hesaplanır. 0 = cayma bedeli yok.
        </p>
      </div>
      <div className="flex flex-wrap items-end gap-3">
        <Field label="Tür">
          <Select value={tur} disabled={!genel} onChange={(e) => setTur(e.target.value as CaymaBedeli["tur"])}>
            <option value="yuzde">Yüzde (%)</option>
            <option value="sabit">Sabit tutar (₺)</option>
          </Select>
        </Field>
        <Field label={tur === "yuzde" ? "Oran (%)" : "Tutar (₺)"}>
          <Input type="number" min={0} step="0.01" className="w-36" disabled={!genel} value={deger} onChange={(e) => setDeger(e.target.value)} />
        </Field>
        {genel && (
          <>
            <HataMetni hata={hata} />
            <Button variant="outline" onClick={kaydet} disabled={!!hata}><Check /> Kaydet</Button>
          </>
        )}
      </div>
    </CardContent>
  );
}

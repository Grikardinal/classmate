/** Öğrenci kartı (profil): üst bilgi, kayıt işlemleri ve sekmeler */
import * as React from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, ArrowRightLeft, Ban, GraduationCap, HeartPulse, PauseCircle, PlayCircle, Users } from "lucide-react";
import { Alert, Avatar, Button, EmptyState, StatCard, Tabs, toast } from "@/components/ui";
import { useApp, useOturum } from "@/context/AppContext";
import { aktifKayit, grup, grupEtiket, guncelle, islemYaz, ogrenciYoklamalari, sube, taksitKalan, tamAd, useDb } from "@/data/store";
import { devamsizlikOzeti, tl } from "@/lib/kurallar";
import { BelgelerSekmesi, EtutSekmesi, GenelBilgi, KayitlarSekmesi, NotlarSekmesi, OdemelerSekmesi, OdevlerSekmesi, VelilerSekmesi, YoklamaSekmesi } from "./KartSekmeleri";
import { GrupDegistir, KayitIptal } from "./KayitIslemleri";
import { grupDoluMu, kapasiteOnaylayabilir } from "./kurallar";
import { KayitDurumRozeti, tarihTR } from "./ortak";

type KartSekme = "genel" | "veliler" | "kayitlar" | "odemeler" | "yoklama" | "odevler" | "etut" | "notlar" | "belgeler";

export function OgrenciKarti() {
  const { id } = useParams();
  const d = useDb();
  const { moduller } = useApp();
  const { ad, rol, subeGorunur } = useOturum();
  const [sekme, setSekme] = React.useState<KartSekme>("genel");
  const [islem, setIslem] = React.useState<null | "grup" | "nakil" | "iptal">(null);
  const o = d.ogrenciler.find((x) => x.id === id);
  const kayitlar = d.kayitlar.filter((k) => k.ogrenciId === id);
  // Aktif sezonun kaydı; yoksa iptal olmayan son kayıt; yoksa son kayıt
  const k = aktifKayit(d, id ?? "") ?? [...kayitlar].reverse().find((x) => x.durum !== "iptal") ?? kayitlar[kayitlar.length - 1];

  if (!o || !k || !subeGorunur(k.subeId))
    return <EmptyState icon={<GraduationCap />} title="Öğrenci bulunamadı" text="Kayıt silinmiş veya şube kapsamınız dışında olabilir." />;

  const g = grup(d, k.grupId);
  const oz = devamsizlikOzeti(ogrenciYoklamalari(d, o.id).map((x) => x.durum));
  const sekmeler: { value: KartSekme; label: string }[] = [
    { value: "genel", label: "Genel" },
    { value: "veliler", label: "Veliler" },
    { value: "kayitlar", label: "Kayıtlar" },
    ...(moduller.finans ? [{ value: "odemeler" as const, label: "Ödemeler" }] : []),
    { value: "yoklama", label: "Yoklama" },
    ...(moduller.odev ? [{ value: "odevler" as const, label: "Ödevler" }] : []),
    ...(moduller.etut ? [{ value: "etut" as const, label: "Etüt" }] : []),
    { value: "notlar", label: "Notlar" },
    { value: "belgeler", label: "Belgeler" },
  ];

  const dondur = () => {
    const yeni = k.durum === "dondurulmus" ? "aktif" : "dondurulmus";
    // Dondurulmuş kayıt doluluğa sayılmaz; aktife dönerken kontenjan denetlenir
    if (yeni === "aktif" && grupDoluMu(d, k.grupId) && !kapasiteOnaylayabilir(rol)) {
      toast("Grubun kontenjanı dolu; kaydı aktifleştirmek için şube müdürü onayı gerekir.", "hata");
      return;
    }
    guncelle((x) => {
      x.kayitlar = x.kayitlar.map((y) => (y.id === k.id ? { ...y, durum: yeni } : y));
      islemYaz(x, ad, yeni === "aktif" ? "Kayıt aktifleştirildi" : "Kayıt donduruldu", `${tamAd(o)} — ${k.sozlesmeNo}`, k.subeId);
    });
    toast(yeni === "aktif" ? "Kayıt yeniden aktif." : "Kayıt donduruldu; öğrenci yoklama listelerinde görünmez.");
  };

  return (
    <div className="grid gap-6">
      <Link to="/ogrenciler" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" /> Öğrenciler
      </Link>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          <Avatar ad={tamAd(o)} className="size-14 text-base" />
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">{tamAd(o)}</h1>
            <p className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
              <span>{g ? grupEtiket(d, g.id) : "—"}</span>·<span className="font-mono">{k.sozlesmeNo}</span>
              <KayitDurumRozeti durum={k.durum} />
            </p>
          </div>
        </div>
        {k.durum !== "iptal" && (
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={() => setIslem("grup")}><Users /> Grup değiştir</Button>
            <Button variant="outline" size="sm" onClick={() => setIslem("nakil")}><ArrowRightLeft /> Şube nakli</Button>
            <Button variant="outline" size="sm" onClick={dondur}>{k.durum === "dondurulmus" ? <><PlayCircle /> Aktifleştir</> : <><PauseCircle /> Dondur</>}</Button>
            <Button variant="outline" size="sm" className="text-danger" onClick={() => setIslem("iptal")}><Ban /> Kaydı iptal et</Button>
          </div>
        )}
      </div>

      {o.saglikNotu && (
        <Alert tone="danger" icon={<HeartPulse />}>
          <b>Sağlık notu:</b> {o.saglikNotu}
        </Alert>
      )}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Devamsızlık" value={`%${Math.round(oz.oran * 100)}`} hint={`${oz.gelmedi} ders · ${oz.izinli} izinli · ${oz.gec} geç`} tone={oz.oran >= 0.15 ? "danger" : "default"} />
        <StatCard label="İşlenen ders" value={oz.toplam} hint="Bu sezon" />
        <StatCard label="Şube" value={sube(k.subeId)?.ad} hint={sube(k.subeId)?.telefon} />
        {moduller.finans ? (
          <StatCard label="Kalan borç" value={tl(d.taksitler.filter((t) => t.kayitId === k.id).reduce((s, t) => s + taksitKalan(t), 0))} />
        ) : (
          <StatCard label="Kayıt tarihi" value={tarihTR(k.tarih)} />
        )}
      </div>

      <Tabs value={sekme} onChange={setSekme} items={sekmeler} />
      {sekme === "genel" && <GenelBilgi o={o} />}
      {sekme === "veliler" && <VelilerSekmesi o={o} />}
      {sekme === "kayitlar" && <KayitlarSekmesi o={o} />}
      {sekme === "odemeler" && <OdemelerSekmesi o={o} />}
      {sekme === "yoklama" && <YoklamaSekmesi o={o} />}
      {sekme === "odevler" && <OdevlerSekmesi o={o} grupId={k.grupId} />}
      {sekme === "etut" && <EtutSekmesi o={o} />}
      {sekme === "notlar" && <NotlarSekmesi o={o} />}
      {sekme === "belgeler" && <BelgelerSekmesi o={o} />}

      {islem === "grup" && <GrupDegistir k={k} o={o} nakil={false} onClose={() => setIslem(null)} />}
      {islem === "nakil" && <GrupDegistir k={k} o={o} nakil onClose={() => setIslem(null)} />}
      {islem === "iptal" && <KayitIptal k={k} o={o} onClose={() => setIslem(null)} />}
    </div>
  );
}

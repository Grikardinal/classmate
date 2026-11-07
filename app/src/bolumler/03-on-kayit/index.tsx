/**
 * Bölüm 03 · Ön kayıt (aday öğrenci) yönetimi
 * Doküman: docs/bolumler/03-on-kayit.md · Açıklama: README.md
 * Saf kurallar kurallar.ts'te (sunucu da aynı dosyayı kullanır: server/politika.ts · onKayitDenetle).
 */
import * as React from "react";
import { BarChart3, CalendarClock, Columns3, Globe, List, PhoneCall, TrendingUp, UserCheck, UserPlus } from "lucide-react";
import { Alert, Button, PageHeader, StatCard, Tabs } from "@/components/ui";
import { useOturum } from "@/context/AppContext";
import { BUGUN, useDb } from "@/data/store";
import { ADAY_DURUMLARI, acikMi, bugunAranacakMi, donusumOrani } from "./kurallar";
import { AdayListesi } from "./AdayListesi";
import { AdayPanosu } from "./AdayPanosu";
import { AdayRaporlari } from "./AdayRaporlari";
import { AdayKarti } from "./AdayKarti";
import { HizliEkle } from "./HizliEkle";
import { WebFormu } from "./WebFormu";

/** Geriye uyumluluk: durum listesi artık kurallar.ts'te */
export const adayDurumlari = ADAY_DURUMLARI;

type Gorunum = "liste" | "pano" | "rapor";

export default function OnKayit() {
  const d = useDb();
  const { subeGorunur, yetki } = useOturum();
  const [gorunum, setGorunum] = React.useState<Gorunum>("liste");
  const [secili, setSecili] = React.useState<string | null>(null);
  const [hizliAcik, setHizliAcik] = React.useState(false);
  const [formAcik, setFormAcik] = React.useState(false);
  const yazabilir = yetki("03");

  const adaylar = d.adaylar.filter((a) => subeGorunur(a.subeId));
  const acik = adaylar.filter(acikMi);
  const bugunAranacak = acik.filter((a) => bugunAranacakMi(a, BUGUN));

  return (
    <div className="grid gap-6">
      <PageHeader
        code="03"
        title="Ön kayıt"
        description="Bilgi almak için arayan veya formu dolduran velileri kaybetmeyin; kesin kayda dönüşümü takip edin."
        actions={
          yazabilir && (
            <>
              <Button variant="outline" onClick={() => setFormAcik(true)}>
                <Globe /> Web formu
              </Button>
              <Button onClick={() => setHizliAcik(true)}>
                <UserPlus /> Hızlı ekle
              </Button>
            </>
          )
        }
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Açık aday" value={acik.length} icon={<UserPlus />} />
        <StatCard label="Bugün aranacak" value={bugunAranacak.length} icon={<PhoneCall />} tone={bugunAranacak.length ? "warning" : "default"} hint="Sonraki aksiyon tarihi gelenler" />
        <StatCard label="Kayda dönen" value={adaylar.filter((a) => a.durum === "kayit").length} icon={<UserCheck />} tone="success" />
        <StatCard label="Dönüşüm oranı" value={`%${donusumOrani(adaylar)}`} icon={<TrendingUp />} hint="Sonuçlanan adaylar içinde" />
      </div>

      {bugunAranacak.length > 0 && (
        <Alert tone="warning" icon={<CalendarClock />}>
          <b>Bugün aranacaklar:</b>{" "}
          {bugunAranacak.map((a, i) => (
            <React.Fragment key={a.id}>
              {i > 0 && ", "}
              <button className="underline underline-offset-2 hover:text-primary" onClick={() => setSecili(a.id)}>
                {a.veliAd}
              </button>
            </React.Fragment>
          ))}
        </Alert>
      )}

      <Tabs
        value={gorunum}
        onChange={setGorunum}
        items={[
          { value: "liste", label: "Liste", icon: <List /> },
          { value: "pano", label: "Pano", icon: <Columns3 /> },
          { value: "rapor", label: "Raporlar", icon: <BarChart3 /> },
        ]}
      />

      {gorunum === "liste" && <AdayListesi adaylar={adaylar} onSec={setSecili} />}
      {gorunum === "pano" && <AdayPanosu adaylar={adaylar} onSec={setSecili} />}
      {gorunum === "rapor" && <AdayRaporlari adaylar={adaylar} />}

      {secili && <AdayKarti key={secili} id={secili} onClose={() => setSecili(null)} />}
      {hizliAcik && <HizliEkle open onClose={() => setHizliAcik(false)} />}
      {formAcik && <WebFormu open onClose={() => setFormAcik(false)} />}
    </div>
  );
}

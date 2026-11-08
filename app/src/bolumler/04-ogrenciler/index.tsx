/**
 * Bölüm 04 · Öğrenci, veli ve kayıt (sözleşme)
 * Doküman: docs/bolumler/04-ogrenci-ve-kayit.md · Açıklama: ./README.md
 *
 * /ogrenciler          → öğrenci listesi (OgrenciListesi.tsx)
 * /ogrenciler/yeni     → kayıt sihirbazı (KayitSihirbazi.tsx; ?aday=… ile ön kayıttan doldurulur)
 * /ogrenciler/:id      → öğrenci kartı (OgrenciKarti.tsx, KartSekmeleri.tsx, KayitIslemleri.tsx)
 *
 * İş kuralları: kurallar.ts (ekran ve sunucu ortak; sunucu: server/politika.ts · kayitDenetle)
 */
import { Route, Routes, useLocation } from "react-router-dom";
import { KayitSihirbazi } from "./KayitSihirbazi";
import { OgrenciKarti } from "./OgrenciKarti";
import { OgrenciListesi } from "./OgrenciListesi";

/** ?ogrenci= / ?aday= değişince sihirbaz baştan kurulur (mükerrer uyarısındaki "yeniden kayıt" bağlantısı) */
function SihirbazSayfasi() {
  const { search } = useLocation();
  return <KayitSihirbazi key={search} />;
}

export default function Ogrenciler() {
  return (
    <Routes>
      <Route index element={<OgrenciListesi />} />
      <Route path="yeni" element={<SihirbazSayfasi />} />
      <Route path=":id" element={<OgrenciKarti />} />
    </Routes>
  );
}

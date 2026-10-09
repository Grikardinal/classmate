/**
 * Otomasyonlar (Bölüm 05, 08, 09, 10): sunucuda dakikada bir çalışır, her hatırlatmayı yalnızca bir kez üretir.
 * - Zamanlanmış duyurular vakti gelince gönderilir
 * - Etüt randevusundan 1 saat önce veliye hatırlatma
 * - Ödev tesliminden 1 gün önce (19:00'dan sonra) hatırlatma
 * - Finans açıksa taksit hatırlatmaları: vadeden 3 gün önce, vade günü, gecikmede 3. ve 10. gün (10:00'dan sonra)
 */
import {
  BUGUN,
  SIMDI,
  bildirimEkle,
  duyuruGonderimleri,
  grupOgrencileri,
  hedefVeliler,
  personelAdi,
  taksitKalan,
  type Db,
} from "../src/data/model";
import { dakika, gunFarki, hatirlatmaGunuMu, tarihEkle, tl } from "../src/lib/kurallar";

const tarihKisa = (iso: string) => new Date(iso + "T00:00:00").toLocaleDateString("tr-TR", { day: "numeric", month: "short" });

export function otomasyonlariCalistir(db: Db): Db {
  const x = { ...db, gonderimler: [...db.gonderimler], duyurular: [...db.duyurular], otomasyon: { ...(db.otomasyon ?? {}) } } as Db;
  const simdi = `${BUGUN}T${SIMDI}`;
  const birKez = (anahtar: string, fn: () => void) => {
    if (x.otomasyon[anahtar]) return;
    fn();
    x.otomasyon[anahtar] = BUGUN;
  };

  // 1) Zamanlanmış duyurular
  x.duyurular = x.duyurular.map((du) => {
    if (!du.zamanlanmis || du.zaman > simdi) return du;
    const yeni = { ...du, zamanlanmis: false, aliciVeliIds: hedefVeliler(x, du.hedef) };
    duyuruGonderimleri(x, yeni);
    return yeni;
  });

  // 2) Etüt hatırlatma: 1 saat önce
  if (x.moduller.etut)
    for (const r of x.randevular) {
      if (r.durum !== "planli" || r.tarih !== BUGUN) continue;
      const kalan = dakika(r.bas) - dakika(SIMDI);
      if (kalan <= 0 || kalan > 60) continue;
      birKez(`etut:${r.id}`, () => {
        for (const o of r.ogrenciIds) bildirimEkle(x, "etutHatirlatma", o, { tarih: "bugün", saat: r.bas, ogretmen: personelAdi(x, r.ogretmenId) }, simdi, true);
      });
    }

  // 3) Ödev hatırlatma: teslimden bir gün önce akşam
  if (x.moduller.odev && SIMDI >= "19:00")
    for (const od of x.odevler) {
      if (od.kontrolEdildi || od.teslim !== tarihEkle(BUGUN, 1)) continue;
      birKez(`odev:${od.id}`, () => {
        const hedef = grupOgrencileri(x, od.grupId).filter((o) => !od.ogrenciIds || od.ogrenciIds.includes(o.id));
        const ders = x.dersler.find((d) => d.id === od.dersId)?.ad ?? "";
        for (const o of hedef) bildirimEkle(x, "odevHatirlatma", o.id, { ders, baslik: od.baslik }, simdi, true);
      });
    }

  // 4) Taksit hatırlatmaları
  if (x.moduller.finans && SIMDI >= "10:00")
    for (const t of x.taksitler) {
      if (taksitKalan(t) <= 0 || !hatirlatmaGunuMu(t.vade, BUGUN, x.ayarlar.hatirlatmaGunleri)) continue;
      birKez(`taksit:${t.id}:${BUGUN}`, () => {
        bildirimEkle(x, t.vade >= BUGUN ? "taksitHatirlatma" : "gecikmisOdeme", t.ogrenciId, { tutar: tl(taksitKalan(t)), vade: tarihKisa(t.vade) }, simdi, true);
      });
    }

  // Eski kayıtları temizle (30 gün)
  for (const [k, t] of Object.entries(x.otomasyon)) if (gunFarki(t, BUGUN) > 30) delete x.otomasyon[k];
  if (JSON.stringify(x.otomasyon) === JSON.stringify(db.otomasyon ?? {})) x.otomasyon = db.otomasyon;
  if (x.gonderimler.length === db.gonderimler.length) x.gonderimler = db.gonderimler;
  if (x.duyurular.every((d, i) => d === db.duyurular[i])) x.duyurular = db.duyurular;
  return x;
}

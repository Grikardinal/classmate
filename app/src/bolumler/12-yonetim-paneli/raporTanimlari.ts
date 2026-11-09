/**
 * Bölüm 12 · Rapor tanımları. Her rapor, kullanıcıya gelmiş (okumaSuz'dan geçmiş) veriden tablo üretir.
 * Ekranda, CSV'de ve yazdırmada aynı satırlar kullanılır; rol süzmesi tek yerdedir (raporListesi).
 */
import { dersAdi, grupDoluluk, grupEtiket, personelAdi, sube, taksitAdi, taksitKalan, tamAd, type Db, type Kayit, type Rol } from "@/data/model";
import { csvOlustur, devamsizlikOzeti, gecikmeGunu, type YoklamaDurumu } from "@/lib/kurallar";
import { MERKEZ, kasaHareketleri, kasaSubesi, vadesiGecenler, yuzde, type KasaHareketi } from "@/bolumler/05-finans/kurallar";
import { aralikta, finansPanelGorur, oranYuzde, type SubeSuzgeci } from "./kurallar";

export type RaporBaglami = {
  sg: SubeSuzgeci;
  sezonId: string;
  bugun: string;
  /** Genel Merkez kasası: yalnızca genel yönetici, tüm şubeler görünümünde */
  merkezDahil: boolean;
  /** Tarih aralığı destekleyen rapor için (YYYY-AA-GG); boşsa sınır yok */
  bas?: string;
  bit?: string;
};
export type RaporSonucu = { basliklar: string[]; satirlar: (string | number)[][]; subeSutun: number };
export type Rapor = {
  key: string;
  ad: string;
  bolum: string;
  /** Gereken bölüm yetkisi; yoksa panele giren herkes görür (kişisel veri içermeyen raporlar) */
  yetki?: string;
  modul?: "finans" | "onKayit" | "odev";
  finans?: boolean;
  /** Ekranda başlangıç/bitiş seçimi gösterilir */
  tarihAraligi?: boolean;
  uret: (d: Db, b: RaporBaglami) => RaporSonucu;
};

const subeAdi = (id: string | null | undefined) => sube(id)?.ad ?? "";
const DURUM_ADI: Record<Kayit["durum"], string> = { aktif: "Aktif", dondurulmus: "Dondurulmuş", iptal: "İptal", mezun: "Mezun" };
const KASA_TUR_ADI: Record<KasaHareketi["tur"], string> = {
  tahsilat: "Tahsilat", tahsilatIptali: "Tahsilat iptali", iade: "İade", iadeIptali: "İade iptali", gider: "Gider", giderIptali: "Gider iptali",
  virmanCikis: "Virman çıkış", virmanGiris: "Virman giriş", virmanIptalCikis: "Virman iptali", virmanIptalGiris: "Virman iptali",
};

function kasaAciklama(d: Db, h: KasaHareketi): string {
  if (h.tur.startsWith("tahsilat")) {
    const t = d.tahsilatlar.find((x) => x.id === h.ref);
    return h.tur === "tahsilat" ? (t?.makbuzNo ?? "") : `${t?.makbuzNo ?? ""} · ${t?.iptal?.neden ?? ""}`;
  }
  if (h.tur.startsWith("iade")) {
    const i = (d.iadeler ?? []).find((x) => x.id === h.ref);
    return h.tur === "iade" ? (i?.makbuzNo ?? "") : `${i?.makbuzNo ?? ""} · ${i?.iptal?.neden ?? ""}`;
  }
  if (h.tur.startsWith("gider")) {
    const g = d.giderler.find((x) => x.id === h.ref);
    return h.tur === "gider" ? `${g?.kategori ?? ""} · ${g?.aciklama ?? ""}` : `${g?.kategori ?? ""} · ${g?.iptal?.neden ?? ""}`;
  }
  const v = d.virmanlar.find((x) => x.id === h.ref);
  return (h.tur === "virmanIptalCikis" || h.tur === "virmanIptalGiris" ? v?.iptal?.neden : v?.aciklama) ?? "";
}

/** Öğrenci başına aktif sezon yoklama durumları (tek geçiş) */
function sezonDurumlari(d: Db, sezonId: string): Map<string, YoklamaDurumu[]> {
  const sezonda = new Set(d.gruplar.filter((g) => g.sezonId === sezonId).map((g) => g.id));
  const m = new Map<string, YoklamaDurumu[]>();
  for (const y of Object.values(d.yoklamalar)) {
    if (!sezonda.has(y.grupId)) continue;
    for (const [ogr, durum] of Object.entries(y.durumlar)) {
      const l = m.get(ogr);
      if (l) l.push(durum);
      else m.set(ogr, [durum]);
    }
  }
  return m;
}

export const raporlar: Rapor[] = [
  {
    key: "ogrenci", ad: "Öğrenci listesi", bolum: "04", yetki: "04",
    uret: (d, b) => {
      const ogr = new Map(d.ogrenciler.map((o) => [o.id, o]));
      const veli = new Map(d.veliler.map((v) => [v.id, v]));
      const grup = new Map(d.gruplar.map((g) => [g.id, g]));
      return {
        basliklar: ["Öğrenci", "Şube", "Grup", "Seviye", "Okul", "Birincil veli", "Telefon", "Durum", "Sözleşme no"],
        subeSutun: 1,
        satirlar: d.kayitlar.filter((k) => k.sezonId === b.sezonId && b.sg(k.subeId)).map((k) => {
          const o = ogr.get(k.ogrenciId);
          const v = o ? veli.get(o.birincilVeliId) : undefined;
          return [tamAd(o), subeAdi(k.subeId), grupEtiket(d, k.grupId), grup.get(k.grupId)?.seviye ?? "", o?.okul ?? "", tamAd(v), v?.telefon ?? "", DURUM_ADI[k.durum] ?? k.durum, k.sozlesmeNo];
        }),
      };
    },
  },
  {
    key: "doluluk", ad: "Grup doluluk raporu", bolum: "01",
    uret: (d, b) => ({
      basliklar: ["Grup", "Şube", "Seviye", "Kapasite", "Kayıtlı", "Doluluk %", "Rehber"],
      subeSutun: 1,
      satirlar: d.gruplar.filter((g) => g.sezonId === b.sezonId && b.sg(g.subeId)).map((g) => {
        const n = grupDoluluk(d, g.id);
        return [grupEtiket(d, g.id), subeAdi(g.subeId), g.seviye, g.kapasite, n, yuzde(n, g.kapasite), personelAdi(d, g.rehberId)];
      }),
    }),
  },
  {
    key: "devamsizlik", ad: "Devamsızlık raporu (sezon)", bolum: "07", yetki: "07",
    uret: (d, b) => {
      const durumlar = sezonDurumlari(d, b.sezonId);
      const ogr = new Map(d.ogrenciler.map((o) => [o.id, o]));
      return {
        basliklar: ["Öğrenci", "Şube", "Grup", "Yoklanan ders", "Gelmedi", "İzinli", "Geç", "Devamsızlık %"],
        subeSutun: 1,
        satirlar: d.kayitlar.filter((k) => k.sezonId === b.sezonId && k.durum === "aktif" && b.sg(k.subeId)).map((k) => {
          const z = devamsizlikOzeti(durumlar.get(k.ogrenciId) ?? []);
          return [tamAd(ogr.get(k.ogrenciId)), subeAdi(k.subeId), grupEtiket(d, k.grupId), z.toplam, z.gelmedi, z.izinli, z.gec, oranYuzde(z.oran)];
        }),
      };
    },
  },
  {
    key: "dersKayit", ad: "Öğretmen ders kayıtları", bolum: "06–07", yetki: "07",
    uret: (d, b) => {
      const grupSube = new Map(d.gruplar.map((g) => [g.id, g.subeId]));
      const satir = new Map(d.program.map((p) => [p.id, p]));
      return {
        basliklar: ["Tarih", "Şube", "Grup", "Ders", "Öğretmen", "Konu", "Katılım"],
        subeSutun: 1,
        satirlar: Object.values(d.yoklamalar)
          .filter((y) => b.sg(grupSube.get(y.grupId)))
          .sort((x, y) => y.tarih.localeCompare(x.tarih))
          .map((y) => {
            // Katılım devamsızlık kuralıyla aynı: izinli öğrenci paydaya da paya da girmez
            const z = devamsizlikOzeti(Object.values(y.durumlar));
            return [y.tarih, subeAdi(grupSube.get(y.grupId)), grupEtiket(d, y.grupId), dersAdi(satir.get(y.satirId)?.dersId ?? ""), personelAdi(d, y.ogretmenId), y.konu, `${z.payda - z.gelmedi}/${z.payda}`];
          }),
      };
    },
  },
  {
    key: "onKayit", ad: "Ön kayıt dönüşüm raporu", bolum: "03", yetki: "03", modul: "onKayit",
    uret: (d, b) => {
      const gruplar = new Map<string, Db["adaylar"]>();
      for (const a of d.adaylar) {
        if (!b.sg(a.subeId)) continue;
        const k = `${a.subeId}\u0000${a.kaynak}`;
        gruplar.set(k, [...(gruplar.get(k) ?? []), a]);
      }
      const satirlar = [...gruplar.values()].map((l): (string | number)[] => {
        const kayit = l.filter((a) => a.durum === "kayit").length;
        return [l[0].kaynak, subeAdi(l[0].subeId), l.length, kayit, l.filter((a) => a.durum === "vazgecti").length, yuzde(kayit, l.length)];
      });
      return { basliklar: ["Kaynak", "Şube", "Aday", "Kayıt", "Vazgeçen", "Dönüşüm %"], subeSutun: 1, satirlar };
    },
  },
  {
    key: "odev", ad: "Ödev teslim oranları", bolum: "08", yetki: "08", modul: "odev",
    uret: (d, b) => {
      const grupSube = new Map(d.gruplar.map((g) => [g.id, g.subeId]));
      return {
        basliklar: ["Ödev", "Şube", "Grup", "Öğretmen", "Teslim", "Yaptı", "Eksik", "Yapmadı"],
        subeSutun: 1,
        satirlar: d.odevler.filter((o) => b.sg(grupSube.get(o.grupId))).map((o) => {
          const t = Object.values(o.teslimler);
          return [o.baslik, subeAdi(grupSube.get(o.grupId)), grupEtiket(d, o.grupId), personelAdi(d, o.ogretmenId), o.teslim, t.filter((x) => x === "yapti").length, t.filter((x) => x === "eksik").length, t.filter((x) => x === "yapmadi").length];
        }),
      };
    },
  },
  {
    key: "mesaj", ad: "Gönderilen mesajlar ve maliyet", bolum: "10", yetki: "10",
    uret: (d, b) => ({
      basliklar: ["Zaman", "Şube", "Olay", "Kanal", "Alıcı", "Durum", "Maliyet (₺)"],
      subeSutun: 1,
      satirlar: d.gonderimler.filter((g) => b.sg(g.subeId)).sort((x, y) => y.zaman.localeCompare(x.zaman)).map((g) => [g.zaman.replace("T", " "), subeAdi(g.subeId), d.olaylar.find((o) => o.key === g.olay)?.ad ?? g.olay, g.kanal === "sms" ? "SMS" : "Uygulama", g.alici, g.durum, Math.round(g.maliyet * 100) / 100]),
    }),
  },
  {
    key: "borc", ad: "Ödeme planları ve borç durumu", bolum: "05", yetki: "05", modul: "finans", finans: true,
    uret: (d, b) => ({
      basliklar: ["Öğrenci", "Şube", "Taksit", "Vade", "Tutar", "Ödenen", "Kalan"],
      subeSutun: 1,
      satirlar: d.taksitler.filter((t) => b.sg(t.subeId)).map((t) => [tamAd(d.ogrenciler.find((o) => o.id === t.ogrenciId)), subeAdi(t.subeId), taksitAdi(t.no), t.vade, t.tutar, t.odenen, taksitKalan(t)]),
    }),
  },
  {
    key: "geciken", ad: "Vadesi geçenler", bolum: "05", yetki: "05", modul: "finans", finans: true,
    uret: (d, b) => ({
      basliklar: ["Veli", "Telefon", "Öğrenci", "Şube", "Vade", "Gecikme (gün)", "Kalan"],
      subeSutun: 3,
      satirlar: vadesiGecenler(d.taksitler.filter((t) => b.sg(t.subeId)), b.bugun).map((t) => {
        const v = d.veliler.find((x) => x.id === t.veliId);
        return [tamAd(v), v?.telefon ?? "", tamAd(d.ogrenciler.find((o) => o.id === t.ogrenciId)), subeAdi(t.subeId), t.vade, gecikmeGunu(t.vade, b.bugun), taksitKalan(t)];
      }),
    }),
  },
  {
    key: "kasa", ad: "Kasa / gelir-gider", bolum: "05", yetki: "05", modul: "finans", finans: true, tarihAraligi: true,
    // Kasa ekranıyla aynı hareketler: iptaller iptal gününe ters kayıt olarak düşer, iade çıkıştır.
    // Aralık hareketin kendi gününe uygulanır: iptali aralıkta, aslı dışında olan ters kayıt görünür (gün sonu kasayla aynı)
    uret: (d, b) => ({
      basliklar: ["Tarih", "Şube", "Tür", "Açıklama", "Giriş", "Çıkış"],
      subeSutun: 1,
      satirlar: kasaHareketleri(d)
        .filter((h) => (kasaSubesi(h.kasa) === MERKEZ ? b.merkezDahil : b.sg(kasaSubesi(h.kasa))) && aralikta(h.tarih, b.bas ?? "", b.bit ?? ""))
        .map((h) => [h.tarih.slice(0, 10), kasaSubesi(h.kasa) === MERKEZ ? "Genel Merkez" : subeAdi(kasaSubesi(h.kasa)), KASA_TUR_ADI[h.tur], kasaAciklama(d, h), h.giris, h.cikis]),
    }),
  },
];

/** Kullanıcının açabileceği raporlar: modül açık, bölüm yetkisi var; finans raporları yalnızca genel yönetici / şube müdürü */
export function raporListesi(moduller: Partial<Record<string, boolean>>, rol: Rol, yetki: (kod: string) => boolean): Rapor[] {
  return raporlar.filter((r) => (!r.modul || moduller[r.modul] === true) && (!r.yetki || yetki(r.yetki)) && (!r.finans || finansPanelGorur(rol, moduller.finans === true, yetki("05"))));
}

/** Dışa aktarım metni: hücreler formül enjeksiyonuna karşı temizlenir */
export function raporCsv(s: Pick<RaporSonucu, "basliklar" | "satirlar">): string {
  return csvOlustur([s.basliklar, ...s.satirlar]);
}

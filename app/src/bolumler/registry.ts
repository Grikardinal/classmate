import type { LucideIcon } from "lucide-react";
import {
  Building2,
  ShieldCheck,
  UserPlus,
  GraduationCap,
  Wallet,
  CalendarDays,
  ClipboardCheck,
  BookOpenCheck,
  Clock,
  Bell,
  Smartphone,
  LayoutDashboard,
  Users,
  ServerCog,
} from "lucide-react";
import type { ModulKey } from "@/context/AppContext";

export type Bolum = {
  kod: string;
  yol: string;
  ad: string;
  ikon: LucideIcon;
  surum: "MVP" | "MVP sonrası" | "v2" | "MVP / v2" | "Tümü";
  grup: "Genel" | "Eğitim" | "İletişim" | "Yönetim";
  /** Bağlı olduğu modül kapalıysa menüde görünmez */
  modul?: ModulKey;
};

/** docs/bolumler/ altındaki 14 bölümün arayüzdeki karşılıkları. Her bölümün kendi dosyası var. */
export const bolumler: Bolum[] = [
  { kod: "12", yol: "/", ad: "Yönetim paneli", ikon: LayoutDashboard, surum: "MVP", grup: "Genel" },
  { kod: "03", yol: "/on-kayit", ad: "Ön kayıt", ikon: UserPlus, surum: "MVP", grup: "Genel", modul: "onKayit" },
  { kod: "04", yol: "/ogrenciler", ad: "Öğrenciler", ikon: GraduationCap, surum: "MVP", grup: "Genel" },
  { kod: "05", yol: "/finans", ad: "Finans", ikon: Wallet, surum: "MVP sonrası", grup: "Genel", modul: "finans" },
  { kod: "06", yol: "/ders-programi", ad: "Ders programı", ikon: CalendarDays, surum: "MVP", grup: "Eğitim" },
  { kod: "07", yol: "/yoklama", ad: "Yoklama", ikon: ClipboardCheck, surum: "MVP", grup: "Eğitim" },
  { kod: "08", yol: "/odevler", ad: "Ödevler", ikon: BookOpenCheck, surum: "v2", grup: "Eğitim", modul: "odev" },
  { kod: "09", yol: "/etut", ad: "Etüt ve birebir", ikon: Clock, surum: "v2", grup: "Eğitim", modul: "etut" },
  { kod: "10", yol: "/iletisim", ad: "İletişim", ikon: Bell, surum: "MVP / v2", grup: "İletişim" },
  { kod: "11", yol: "/veli-portali", ad: "Veli portalı", ikon: Smartphone, surum: "MVP", grup: "İletişim" },
  { kod: "13", yol: "/personel", ad: "Personel", ikon: Users, surum: "MVP / v2", grup: "Yönetim" },
  { kod: "02", yol: "/kullanicilar", ad: "Kullanıcılar ve yetkiler", ikon: ShieldCheck, surum: "MVP", grup: "Yönetim" },
  { kod: "01", yol: "/kurum", ad: "Kurum ve tanımlar", ikon: Building2, surum: "MVP", grup: "Yönetim" },
  { kod: "14", yol: "/altyapi", ad: "Veri, güvenlik, KVKK", ikon: ServerCog, surum: "Tümü", grup: "Yönetim" },
];

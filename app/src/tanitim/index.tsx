/** Herkese açık tanıtım ve fiyat sayfası. Yalnızca uygulamada gerçekten olan özellikler yazılır. */
import * as React from "react";
import { Link } from "react-router-dom";
import { Bell, BookOpenCheck, CalendarDays, Check, ClipboardCheck, Clock, GraduationCap, Phone, ShieldCheck, Smartphone, UserPlus, Users, Wallet, type LucideIcon } from "lucide-react";
import { Logo } from "@/components/brand/Logo";
import { YAPIMCI, YapimciBilgisi } from "@/components/brand/Yapimci";
import { cn } from "@/lib/utils";
import { EK_SUBE_AYLIK, EK_SUBE_YILLIK, aylikFiyat, paketler, yillikFiyat, yillikKazanc } from "./fiyat";

const ozellikler: { ikon: LucideIcon; ad: string; metin: string }[] = [
  { ikon: UserPlus, ad: "Ön kayıt", metin: "Adayları, görüşmeleri ve kayda dönüşümü takip edin." },
  { ikon: GraduationCap, ad: "Öğrenciler", metin: "Öğrenci, veli ve sınıf bilgileri tek kayıtta durur." },
  { ikon: Wallet, ad: "Finans", metin: "Taksit, tahsilat, iade ve gecikmeleri izleyin." },
  { ikon: CalendarDays, ad: "Ders programı", metin: "Sınıf, öğretmen ve derslik çakışmalarını önleyin." },
  { ikon: ClipboardCheck, ad: "Yoklama", metin: "Öğretmenler dersi işlerken yoklamayı girer." },
  { ikon: BookOpenCheck, ad: "Ödevler", metin: "Ödev verin, teslim durumunu takip edin." },
  { ikon: Clock, ad: "Etüt ve birebir", metin: "Etüt ve birebir dersleri planlayın." },
  { ikon: Bell, ad: "İletişim", metin: "Velilere ve öğrencilere SMS ve duyuru gönderin." },
  { ikon: Smartphone, ad: "Veli portalı", metin: "Veliler telefonlarına gelen kodla parolasız girer." },
  { ikon: Users, ad: "Personel", metin: "Personel kayıtlarını ve öğretmen hak edişlerini yönetin." },
  { ikon: ShieldCheck, ad: "Yetki ve KVKK", metin: "Rol bazlı yetki, işlem kaydı, yedek ve anonimleştirme." },
];

const sorular: [string, string][] = [
  ["Fiyata neler dahil?", "Tüm modüller, sınırsız öğrenci ve kullanıcı fiyata dahildir."],
  ["Aylık ödemede asgari süre var mı?", "Hayır. Aylık ödemede asgari süre yoktur, dilediğiniz ay bırakabilirsiniz. Yıllık alımda ise 2 ay bedava kullanırsınız."],
  ["SMS ücreti fiyata dahil mi?", "Hayır. SMS gönderimleri kendi SMS sağlayıcı hesabınız üzerinden ayrıca ücretlendirilir."],
  ["Birden fazla şubem var, nasıl görünür?", "Şubeler tek panelden yönetilir; yetkilendirmeye göre her kullanıcı yalnızca kendi şubesini görür."],
  ["Kurulum nasıl yapılıyor?", "Her kurum için ayrı kurulum yapılır. Bizi arayın, kurumunuza uygun planı birlikte çıkaralım."],
];

const birincilBtn = "inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-marka px-6 text-sm font-bold text-white shadow-glow transition hover:opacity-90";
const ikincilBtn = "inline-flex h-12 items-center justify-center gap-2 rounded-xl border bg-card px-6 text-sm font-bold transition hover:bg-muted";

function AraBtn({ className }: { className?: string }) {
  return (
    <a href={YAPIMCI.telefonBag} className={cn(ikincilBtn, className)}>
      <Phone className="size-4" /> {YAPIMCI.telefon}
    </a>
  );
}

const tl = (n: number) => `${n.toLocaleString("tr-TR")} ₺`;

function Fiyatlar() {
  const [donem, setDonem] = React.useState<"yillik" | "aylik">("yillik");
  const yillik = donem === "yillik";
  const secenek = (d: typeof donem, ad: string, rozet?: string) => (
    <button
      type="button"
      aria-pressed={donem === d}
      onClick={() => setDonem(d)}
      className={cn("inline-flex h-10 items-center gap-2 rounded-lg px-4 text-sm font-bold transition", donem === d ? "bg-marka text-white shadow-glow" : "text-muted-foreground hover:text-foreground")}
    >
      {ad}
      {rozet && <span className={cn("rounded-full px-2 py-0.5 text-xs", donem === d ? "bg-white/20" : "bg-primary/10 text-primary")}>{rozet}</span>}
    </button>
  );
  return (
    <section id="fiyatlar" className="mx-auto max-w-6xl scroll-mt-6 px-4 py-14 sm:px-6">
      <h2 className="text-center font-display text-3xl font-extrabold tracking-tight">Şube sayınıza göre fiyat</h2>
      <p className="mt-3 text-center text-sm text-muted-foreground">Fiyatlara KDV dahildir. SMS ücretleri ayrıdır.</p>
      <div className="mt-6 flex justify-center">
        <div className="inline-flex gap-1 rounded-xl border bg-card p-1">
          {secenek("yillik", "Yıllık", "2 ay bedava")}
          {secenek("aylik", "Aylık")}
        </div>
      </div>
      <div className="mt-8 grid gap-4 md:grid-cols-3">
        {paketler.map((p) => (
          <div key={p.ad} className={cn("flex flex-col rounded-2xl border bg-card p-6", p.oneCikan && "border-primary ring-1 ring-primary")}>
            <h3 className="text-lg font-bold">{p.ad}</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              {p.not}
              {p.ekSubeli && `, sonraki her şube +${tl(yillik ? EK_SUBE_YILLIK : EK_SUBE_AYLIK)}${yillik ? "" : "/ay"}`}
            </p>
            <p className="mt-5 font-display text-4xl font-extrabold">{tl(yillik ? yillikFiyat(p.sube) : aylikFiyat(p.sube))}</p>
            <p className="text-sm text-muted-foreground">{yillik ? "yıllık" : "aylık · asgari süre yok"}</p>
            <p className="mt-2 text-sm font-semibold text-primary">
              {yillik ? `${tl(yillikKazanc(p.sube))} kazanırsınız` : `Yıllık alımda ${tl(yillikKazanc(p.sube))} kazanç`}
            </p>
            <ul className="mt-5 grid gap-2 text-sm">
              {["Tüm modüller", "Sınırsız öğrenci ve kullanıcı", "Veli portalı"].map((x) => (
                <li key={x} className="flex items-center gap-2"><Check className="size-4 text-primary" /> {x}</li>
              ))}
            </ul>
            <a href={YAPIMCI.telefonBag} className={cn(p.oneCikan ? birincilBtn : ikincilBtn, "mt-6")}>Bizi arayın</a>
          </div>
        ))}
      </div>
    </section>
  );
}

export default function Tanitim() {
  return (
    <div className="relative min-h-dvh">
      <div className="aurora" aria-hidden />
      <div className="relative z-10">
        <header className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-5 sm:px-6">
          <Logo />
          <nav className="flex items-center gap-1 text-sm font-semibold sm:gap-4">
            <a href="#ozellikler" className="hidden px-2 py-1 text-muted-foreground hover:text-foreground sm:block">Özellikler</a>
            <a href="#fiyatlar" className="hidden px-2 py-1 text-muted-foreground hover:text-foreground sm:block">Fiyatlar</a>
            <Link to="/veli" className="px-2 py-1 text-muted-foreground hover:text-foreground">Veli girişi</Link>
            <Link to="/giris" className="rounded-lg border bg-card px-3 py-1.5 hover:bg-muted">Giriş</Link>
          </nav>
        </header>

        <main>
          <section className="mx-auto max-w-3xl px-4 pb-16 pt-12 text-center sm:px-6 sm:pt-20">
            <h1 className="font-display text-4xl font-extrabold tracking-tight sm:text-5xl">Kursunuzun tüm işleri tek ekranda</h1>
            <p className="mx-auto mt-5 max-w-xl text-base text-muted-foreground sm:text-lg">
              Ön kayıttan tahsilata, yoklamadan veli iletişimine kadar kurs yönetimi için tek uygulama.
            </p>
            <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
              <Link to="/giris" className={birincilBtn}>Demoyu deneyin</Link>
              <AraBtn />
            </div>
          </section>

          <section aria-label="Tanıtım filmi" className="mx-auto max-w-4xl px-4 pb-10 sm:px-6">
            <video className="aspect-video w-full rounded-2xl border bg-black shadow-glow" src="/tanitim.mp4" controls autoPlay muted playsInline preload="auto">
              Tarayıcınız video oynatmayı desteklemiyor.
            </video>
          </section>

          <section id="ozellikler"className="mx-auto max-w-6xl scroll-mt-6 px-4 py-14 sm:px-6">
            <h2 className="text-center font-display text-3xl font-extrabold tracking-tight">Kurumunuzun ihtiyaç duyduğu modüller</h2>
            <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {ozellikler.map(({ ikon: Ikon, ad, metin }) => (
                <div key={ad} className="rounded-2xl border bg-card p-5">
                  <span className="grid size-10 place-items-center rounded-xl bg-primary/10 text-primary"><Ikon className="size-5" /></span>
                  <h3 className="mt-3 font-bold">{ad}</h3>
                  <p className="mt-1 text-sm text-muted-foreground">{metin}</p>
                </div>
              ))}
            </div>
          </section>

          <Fiyatlar />

          <section className="mx-auto max-w-3xl px-4 py-14 sm:px-6">
            <h2 className="text-center font-display text-3xl font-extrabold tracking-tight">Sık sorulan sorular</h2>
            <div className="mt-8 grid gap-3">
              {sorular.map(([s, c]) => (
                <details key={s} className="rounded-xl border bg-card p-4">
                  <summary className="cursor-pointer font-semibold">{s}</summary>
                  <p className="mt-2 text-sm text-muted-foreground">{c}</p>
                </details>
              ))}
            </div>
          </section>

          <section className="mx-auto max-w-3xl px-4 py-14 text-center sm:px-6">
            <h2 className="font-display text-3xl font-extrabold tracking-tight">Kurumunuz için konuşalım</h2>
            <div className="mt-6 flex flex-col justify-center gap-3 sm:flex-row">
              <AraBtn />
              <Link to="/giris" className={ikincilBtn}>Demoyu deneyin</Link>
            </div>
          </section>
        </main>

        <footer className="px-4 pb-6"><YapimciBilgisi /></footer>
      </div>
    </div>
  );
}

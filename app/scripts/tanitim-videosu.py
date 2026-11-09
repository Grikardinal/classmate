"""Classmate'in ilk (sessiz) tanıtım filmi: hareketli grafikleri kare kare çizer, FFmpeg ile MP4 yapar.

Sitedeki public/tanitim.mp4 artık bu betikle üretilmiyor (Remotion ve müzikli sürüm seçildi); üzerine yazmayın.
Sessizdir, ekran içerikleri örnek veridir; gerçek kişi veya müşteri bilgisi yoktur.
Kullanım: python scripts/tanitim-videosu.py cikti.mp4 [--kare saniye]
Gereksinim: Pillow, ffmpeg. Fiyat değişirse FIYAT_METNI de değişmelidir (src/tanitim/fiyat.ts).
"""
import math
import subprocess
import sys
from functools import lru_cache

from PIL import Image, ImageDraw, ImageFilter, ImageFont

W, H, FPS = 1280, 720, 30
GECIS = 0.42
FIYAT_METNI = "Yıllık 24.000 ₺'den başlayan fiyatlarla · KDV dahil"

KOYU = (13, 12, 34)
MOR = (91, 76, 240)
MOR2 = (139, 92, 246)
PEMBE = (236, 72, 153)
CAMGOBEGI = (34, 211, 238)
YESIL = (16, 185, 129)
KIRMIZI = (239, 68, 68)
SARI = (245, 158, 11)
BEYAZ = (255, 255, 255)
GRI = (100, 104, 130)
ACIK = (243, 244, 250)
YAZI = (24, 24, 48)


def kis(x):
    return max(0.0, min(1.0, x))


def ilerle(t, a, b):
    return kis((t - a) / (b - a))


def cik(x):
    return 1 - (1 - kis(x)) ** 3


def gir_cik(x):
    x = kis(x)
    return 4 * x**3 if x < 0.5 else 1 - (-2 * x + 2) ** 3 / 2


def yayli(x):
    x = kis(x)
    return 1 + 2.7 * (x - 1) ** 3 + 1.7 * (x - 1) ** 2


@lru_cache(maxsize=None)
def yazi_tipi(boy, kalin=True):
    return ImageFont.truetype("C:/Windows/Fonts/" + ("segoeuib.ttf" if kalin else "segoeui.ttf"), boy)


def renk_a(renk, a):
    return (*renk[:3], int(255 * kis(a)))


def yaz(k, xy, s, boy, renk=BEYAZ, kalin=True, a=1.0, capa="la"):
    if a > 0:
        ImageDraw.Draw(k, "RGBA").text(xy, s, font=yazi_tipi(boy, kalin), fill=renk_a(renk, a), anchor=capa)


@lru_cache(maxsize=256)
def kutu_maske(g, y, r):
    """Yumuşak kenarlı yuvarlak köşe maskesi (2 kat çizip küçültür)."""
    m = Image.new("L", (g * 2, y * 2), 0)
    ImageDraw.Draw(m).rounded_rectangle((0, 0, g * 2 - 1, y * 2 - 1), r * 2, fill=255)
    return m.resize((g, y), Image.LANCZOS)


def kutu(k, x, y, g, h, r, renk, a=1.0):
    g, h = int(g), int(h)
    if g < 2 or h < 2 or a <= 0:
        return
    r = min(r, g // 2, h // 2)
    m = kutu_maske(g, h, r)
    if a < 1:
        m = m.point(lambda v: int(v * a))
    k.paste(Image.new("RGB", (g, h), renk), (int(x), int(y)), m)


@lru_cache(maxsize=32)
def golge_maske(g, h):
    m = Image.new("L", (g + 80, h + 80), 0)
    ImageDraw.Draw(m).rounded_rectangle((40, 44, g + 40, h + 44), 24, fill=110)
    return m.filter(ImageFilter.GaussianBlur(20))


@lru_cache(maxsize=64)
def yazi_kalip(s, boy, renk):
    bb = yazi_tipi(boy).getbbox(s)
    y = Image.new("RGBA", (bb[2] + 12, bb[3] + 12), (*renk, 0))
    ImageDraw.Draw(y).text((4, 2), s, font=yazi_tipi(boy), fill=(*renk, 255))
    return y


def buyuk_yazi(k, ox, oy, s, boy, renk, olcek=1.0, a=1.0):
    """Ortalanmış, ölçeklenebilir başlık."""
    if a <= 0 or olcek <= 0.02:
        return
    y = yazi_kalip(s, boy, renk)
    if abs(olcek - 1) > 0.005:
        y = y.resize((max(1, int(y.width * olcek)), max(1, int(y.height * olcek))), Image.BILINEAR)
    m = y.getchannel("A")
    if a < 1:
        m = m.point(lambda v: int(v * a))
    k.paste(y.convert("RGB"), (int(ox - y.width / 2), int(oy - y.height / 2)), m)


def _isik(renk, cap):
    m = Image.new("L", (cap, cap), 0)
    ImageDraw.Draw(m).ellipse((cap * 0.25, cap * 0.25, cap * 0.75, cap * 0.75), fill=120)
    return Image.new("RGB", (cap, cap), renk), m.filter(ImageFilter.GaussianBlur(cap * 0.08))


ISIKLAR = [(_isik(MOR, 760), 0.13, 0.6), (_isik(PEMBE, 560), 0.19, 2.1), (_isik(CAMGOBEGI, 480), 0.1, 4.0)]
TABAN = Image.new("RGB", (W, H), KOYU)


def zemin(t):
    k = TABAN.copy()
    for i, ((c, m), hiz, faz) in enumerate(ISIKLAR):
        x = W * (0.5 + 0.42 * math.sin(t * hiz * 3 + faz)) - c.width / 2
        y = H * (0.5 + 0.38 * math.cos(t * hiz * 2.4 + faz * 1.7)) - c.height / 2
        k.paste(c, (int(x), int(y)), m)
    return k


def altyazi(k, t, ust, satirlar, x=64, y=212):
    """Sol sütundaki başlık: satırlar sırayla kayarak gelir."""
    e = cik(ilerle(t, 0.28, 0.65))
    yaz(k, (x - (1 - e) * 40, y - 44), ust, 20, CAMGOBEGI, a=e)
    for i, s in enumerate(satirlar):
        e = cik(ilerle(t, 0.38 + i * 0.09, 0.85 + i * 0.09))
        yaz(k, (x - (1 - e) * 90, y + i * 58), s, 46, BEYAZ, a=e)
    e = gir_cik(ilerle(t, 0.75, 1.25))
    kutu(k, x, y + len(satirlar) * 58 + 16, 96 * e, 6, 3, PEMBE)


def pencere(k, t, baslik, x=430, y=70, g=800, h=580):
    """Uygulama penceresi kalıbı: içerik koordinatları için (ox, oy) döndürür."""
    e = yayli(ilerle(t, 0.12, 0.72))
    oy = y + (1 - e) * 520
    oxk = x + math.sin(t * 0.9) * 4
    oy += math.cos(t * 1.1) * 4
    k.paste(Image.new("RGB", (g + 80, h + 80), (0, 0, 0)), (int(oxk - 40), int(oy - 40)), golge_maske(g, h))
    kutu(k, oxk, oy, g, h, 22, ACIK)
    kutu(k, oxk, oy, g, 62, 22, BEYAZ)
    kutu(k, oxk, oy + 40, g, 22, 1, BEYAZ)
    for i, c in enumerate((MOR, PEMBE, CAMGOBEGI)):
        kutu(k, oxk + 22 + i * 20, oy + 25, 12, 12, 6, c)
    yaz(k, (oxk + 100, oy + 31), baslik, 21, YAZI, capa="lm")
    yaz(k, (oxk + g - 24, oy + 31), "Örnek veri", 14, GRI, kalin=False, capa="rm")
    return oxk, oy + 62


def rozet(k, sag, y, metin, renk, olcek=1.0):
    g = int(yazi_tipi(15).getlength(metin) + 26)
    gg, hh = int(g * olcek), int(32 * olcek)
    kutu(k, sag - g / 2 - gg / 2, y - hh / 2, gg, hh, 16, renk)
    if olcek > 0.75:
        yaz(k, (sag - g / 2, y), metin, 15, BEYAZ, capa="mm")


def tik(k, x, y, r, renk, e):
    e = kis(e)
    kutu(k, x - r * yayli(e), y - r * yayli(e), 2 * r * yayli(e), 2 * r * yayli(e), r, renk)
    if e > 0.45:
        d = ImageDraw.Draw(k)
        d.line([(x - r * 0.45, y), (x - r * 0.1, y + r * 0.38), (x + r * 0.5, y - r * 0.38)], fill=BEYAZ, width=max(2, int(r * 0.26)), joint="curve")


def para(n):
    return f"{int(n):,}".replace(",", ".") + " ₺"


# ---- Sahneler ----
def s_acilis(k, t):
    s = "Classmate"
    bosluk = [yazi_tipi(118).getlength(s[:i]) for i in range(len(s) + 1)]
    bas = W / 2 - bosluk[-1] / 2
    for i, h in enumerate(s):
        e = yayli(ilerle(t, 0.1 + i * 0.05, 0.62 + i * 0.05))
        yaz(k, (bas + bosluk[i], 320 + (1 - e) * 230 * (-1 if i % 2 else 1)), h, 118, BEYAZ, a=kis(e * 2), capa="ls")
    e = cik(ilerle(t, 0.95, 1.35))
    kutu(k, W / 2 - 280 * e, 362, 560 * e, 6, 3, MOR2)
    e = cik(ilerle(t, 1.15, 1.6))
    yaz(k, (W / 2, 412 + (1 - e) * 26), "Kurs yönetiminde yeni düzen", 34, CAMGOBEGI, kalin=False, a=e, capa="ma")


def s_sorun(k, t):
    satirlar = [("Kayıtlar defterde.", 0.15), ("Taksitler Excel'de.", 0.75), ("Yoklama kâğıtta.", 1.35)]
    for i, (s, b) in enumerate(satirlar):
        e = yayli(ilerle(t, b, b + 0.4))
        y = 190 + i * 112
        buyuk_yazi(k, W / 2, y, s, 72, BEYAZ, olcek=1.8 - 0.8 * e, a=kis((t - b) * 5))
        cizgi = gir_cik(ilerle(t, 2.15 + i * 0.08, 2.5 + i * 0.08))
        g = yazi_tipi(72).getlength(s) + 30
        kutu(k, W / 2 - g / 2, y + 4, g * cizgi, 9, 4, KIRMIZI)
    e = yayli(ilerle(t, 2.75, 3.15))
    if t > 2.7:
        ImageDraw.Draw(k, "RGBA").rectangle((0, 0, W, H), fill=(13, 12, 34, int(245 * kis((t - 2.7) * 4))))
        buyuk_yazi(k, W / 2, H / 2, "Hepsi tek ekranda.", 92, BEYAZ, olcek=2.2 - 1.2 * e, a=kis((t - 2.7) * 5))


def s_panel(k, t):
    altyazi(k, t, "YÖNETİM PANELİ", ["Tüm kurumu", "tek bakışta", "görün"])
    ox, oy = pencere(k, t, "Yönetim paneli")
    kartlar = [("Aktif öğrenci", 428, str, MOR), ("Bugünkü ders", 36, str, CAMGOBEGI), ("Yeni aday", 27, str, PEMBE), ("Bu ay tahsilat", 386500, para, YESIL)]
    for i, (ad, n, bic, c) in enumerate(kartlar):
        b = 0.75 + i * 0.14
        e = yayli(ilerle(t, b, b + 0.45))
        x, y = ox + 24 + i % 2 * 382, oy + 22 + i // 2 * 138
        x += (1 - e) * 120
        kutu(k, x, y, 370, 122, 16, BEYAZ, a=kis(e))
        kutu(k, x, y + 18, 6, 86, 3, c, a=kis(e))
        yaz(k, (x + 26, y + 18), ad, 18, GRI, kalin=False, a=kis(e))
        yaz(k, (x + 26, y + 52), bic(round(n * cik(ilerle(t, b + 0.1, b + 1.25)))), 44, YAZI, a=kis(e))
    for i, (s, c) in enumerate([("Şubeler arasında tek tıkla geçiş", MOR), ("Yetkiye göre herkes kendi ekranını görür", PEMBE)]):
        b = 1.9 + i * 0.22
        e = cik(ilerle(t, b, b + 0.4))
        y = oy + 306 + i * 92
        kutu(k, ox + 24 + (1 - e) * 200, y, 752, 76, 14, BEYAZ, a=e)
        tik(k, ox + 62 + (1 - e) * 200, y + 38, 15, c, ilerle(t, b + 0.25, b + 0.6))
        yaz(k, (ox + 96 + (1 - e) * 200, y + 38), s, 22, YAZI, a=e, capa="lm")


def s_onkayit(k, t):
    altyazi(k, t, "ÖN KAYIT", ["Hiçbir adayı", "kaçırmayın"])
    ox, oy = pencere(k, t, "Ön kayıt")
    for i, (ad, sinif) in enumerate([("Deniz A.", "LGS Hazırlık"), ("Ece K.", "YKS Sayısal"), ("Mert T.", "9. Sınıf Takviye"), ("Selin Y.", "LGS Hazırlık"), ("Kaan D.", "YKS Eşit Ağırlık")]):
        b = 0.65 + i * 0.1
        e = cik(ilerle(t, b, b + 0.4))
        y = oy + 20 + i * 98
        x = ox + 24 + (1 - e) * 260
        k1 = 1.35 + i * 0.28
        vurgu = kis(1 - abs(t - (k1 + 0.5)) * 2.5)
        kutu(k, x, y, 752, 84, 14, BEYAZ, a=e)
        if vurgu > 0:
            kutu(k, x, y, 8, 84, 4, YESIL, a=vurgu)
        kutu(k, x + 20, y + 19, 46, 46, 23, MOR, a=e)
        yaz(k, (x + 43, y + 42), ad[0], 22, BEYAZ, a=e, capa="mm")
        yaz(k, (x + 84, y + 16), ad, 22, YAZI, a=e)
        yaz(k, (x + 84, y + 50), sinif, 16, GRI, kalin=False, a=e)
        sag = x + 730
        if t < k1:
            rozet(k, sag, y + 42, "Aday", SARI, kis(e))
        elif t < k1 + 0.5:
            rozet(k, sag, y + 42, "Görüşüldü", MOR2, yayli(ilerle(t, k1, k1 + 0.2)))
        else:
            rozet(k, sag, y + 42, "Kayıt oldu", YESIL, yayli(ilerle(t, k1 + 0.5, k1 + 0.72)))


def s_finans(k, t):
    altyazi(k, t, "FİNANS", ["Taksit ve", "tahsilat", "kontrolünüzde"])
    ox, oy = pencere(k, t, "Finans")
    rows = [("Ekim taksiti", 7500), ("Kasım taksiti", 7500), ("Aralık taksiti", 7500), ("Ocak taksiti", 7500)]
    odenen = sum(n for i, (_, n) in enumerate(rows) if t >= 1.5 + i * 0.42)
    hedef = sum(n for _, n in rows)
    e = yayli(ilerle(t, 0.65, 1.05))
    kutu(k, ox + 24, oy + 20, 752, 124, 16, MOR, a=kis(e))
    yaz(k, (ox + 50, oy + 38), "Tahsil edilen", 18, BEYAZ, kalin=False, a=kis(e))
    yaz(k, (ox + 50, oy + 66), para(odenen), 48, BEYAZ, a=kis(e))
    cubuk = odenen / hedef
    kutu(k, ox + 400, oy + 76, 350, 16, 8, (70, 58, 190), a=kis(e))
    kutu(k, ox + 400, oy + 76, 350 * cubuk, 16, 8, CAMGOBEGI, a=kis(e))
    for i, (ad, n) in enumerate(rows):
        b = 0.85 + i * 0.1
        e = cik(ilerle(t, b, b + 0.4))
        y = oy + 164 + i * 84
        x = ox + 24 + (1 - e) * 280
        od = 1.5 + i * 0.42
        kutu(k, x, y, 752, 72, 14, BEYAZ, a=e)
        tik(k, x + 40, y + 36, 17, YESIL if t >= od else (200, 203, 220), max(ilerle(t, od, od + 0.28), e))
        yaz(k, (x + 76, y + 36), ad, 22, YAZI, a=e, capa="lm")
        yaz(k, (x + 500, y + 36), para(n), 22, YAZI, a=e, capa="rm")
        rozet(k, x + 730, y + 36, "Ödendi" if t >= od else "Bekliyor", YESIL if t >= od else SARI, yayli(ilerle(t, od, od + 0.25)) if t >= od else kis(e))


def s_yoklama(k, t):
    altyazi(k, t, "DERS PROGRAMI VE YOKLAMA", ["Yoklama", "saniyeler", "içinde"])
    ox, oy = pencere(k, t, "Yoklama · 8-A Matematik")
    harf = "AEMSKDBCNZHGTLPYOIRF"
    yok = {6, 13}
    for i, h in enumerate(harf):
        sut, sat = i % 5, i // 5
        x, y = ox + 24 + sut * 152, oy + 22 + sat * 122
        b = 0.55 + (sut + sat) * 0.05
        e = yayli(ilerle(t, b, b + 0.42))
        d = 1.35 + i * 0.075
        tamam = t >= d
        cx, cy = x + 68, y + 54
        renk = BEYAZ
        kutu(k, cx - 68 * e, cy - 54 * e, 136 * e, 108 * e, 16, renk, a=kis(e))
        if e > 0.6:
            kutu(k, x + 44, y + 12, 48, 48, 24, (KIRMIZI if i in yok else YESIL) if tamam else (215, 218, 232))
            if tamam and i not in yok:
                tik(k, x + 68, y + 36, 24, YESIL, ilerle(t, d, d + 0.2))
            elif tamam:
                yaz(k, (x + 68, y + 36), "×", 34, BEYAZ, capa="mm")
            else:
                yaz(k, (x + 68, y + 36), h, 22, YAZI, capa="mm")
            yaz(k, (x + 68, y + 82), "Örnek " + str(i + 1), 15, GRI, kalin=False, capa="mm")


def s_veli(k, t):
    altyazi(k, t, "VELİ PORTALI", ["Veliler", "parolasız,", "kodla girer"])
    e = yayli(ilerle(t, 0.1, 0.72))
    g, h = 310, 620
    x = 780 + math.sin(t * 1.2) * 5
    y = 50 + (1 - e) * 620 + math.cos(t) * 5
    k.paste(Image.new("RGB", (g + 80, h + 80), (0, 0, 0)), (int(x - 40), int(y - 40)), golge_maske(g, h))
    kutu(k, x, y, g, h, 44, (26, 26, 46))
    kutu(k, x + 12, y + 12, g - 24, h - 24, 34, ACIK)
    kutu(k, x + 105, y + 22, 100, 22, 11, (26, 26, 46))
    px, py, pg = x + 30, y + 66, g - 60
    giris = ilerle(t, 2.35, 2.75)
    if t < 2.55:
        a = 1 - giris * 2
        yaz(k, (px + pg / 2, py + 20), "Veli girişi", 26, YAZI, a=a, capa="ma")
        yaz(k, (px + pg / 2, py + 62), "SMS kodunu girin", 16, GRI, kalin=False, a=a, capa="ma")
        kod = "482913"
        for i, r in enumerate(kod):
            kx, ky = px + i * 42 + 2, py + 118
            dolu = t >= 1.0 + i * 0.2
            kutu(k, kx, ky, 36, 54, 9, BEYAZ, a=a)
            if dolu:
                yaz(k, (kx + 18, ky + 27), r, 26, MOR, a=a, capa="mm")
        kutu(k, px, py + 206, pg, 52, 14, MOR if t < 2.2 else YESIL, a=a)
        yaz(k, (px + pg / 2, py + 232), "Giriş yap", 19, BEYAZ, a=a, capa="mm")
    if giris > 0:
        for i, (ad, alt, c) in enumerate([("Ders programı", "Bugün 15.30 Matematik", MOR), ("Yoklama", "Bu ay devam: %96", YESIL), ("Ödevler", "2 aktif ödev", PEMBE), ("Ödemeler", "Sonraki taksit 1 Aralık", SARI), ("Duyurular", "1 yeni duyuru", CAMGOBEGI)]):
            b = 2.45 + i * 0.11
            e2 = cik(ilerle(t, b, b + 0.38))
            ky = py + i * 98 - 8
            kx = px + (1 - e2) * 240
            kutu(k, kx, ky, pg, 86, 16, BEYAZ, a=e2)
            kutu(k, kx + 14, ky + 25, 36, 36, 12, c, a=e2)
            yaz(k, (kx + 62, ky + 20), ad, 17, YAZI, a=e2)
            yaz(k, (kx + 62, ky + 48), alt, 13, GRI, kalin=False, a=e2)


MODULLER = ["Ön kayıt", "Öğrenciler", "Finans", "Ders programı", "Yoklama", "Ödevler", "Etüt ve birebir", "İletişim", "Veli portalı", "Personel", "Hak ediş", "KVKK ve yedek"]


def s_moduller(k, t):
    e = cik(ilerle(t, 0.2, 0.6))
    buyuk_yazi(k, W / 2, 112, "İhtiyacınız olan her şey", 60, BEYAZ, olcek=1.3 - 0.3 * e, a=e)
    renkler = [MOR, PEMBE, (8, 145, 178), (5, 150, 105)]
    for i, ad in enumerate(MODULLER):
        sut, sat = i % 4, i // 4
        hx, hy = 72 + sut * 290 + 134, 214 + sat * 124 + 48
        b = 0.42 + i * 0.075
        e = yayli(ilerle(t, b, b + 0.42))
        ac = (i * 2.399) % (2 * math.pi)
        cx = hx + (1 - e) * math.cos(ac) * 700
        cy = hy + (1 - e) * math.sin(ac) * 450
        kutu(k, cx - 134, cy - 48, 268, 96, 18, renkler[(sut + sat) % 4], a=kis(e))
        yaz(k, (cx, cy), ad, 25, BEYAZ, a=kis(e), capa="mm")


def s_kapanis(k, t):
    e = yayli(ilerle(t, 0.2, 0.72))
    buyuk_yazi(k, W / 2, 200, "Kursunuzu büyütmeye odaklanın", 58, BEYAZ, olcek=1.5 - 0.5 * e, a=kis(e))
    e = yayli(ilerle(t, 0.75, 1.2))
    g, h = 620 * e, 112 * e
    kutu(k, W / 2 - g / 2, 300 - h / 2 + 30, g, h, 28, MOR)
    if e > 0.7:
        yaz(k, (W / 2, 330), "classmatekurs.app", 56, BEYAZ, capa="mm")
    e = cik(ilerle(t, 1.25, 1.65))
    yaz(k, (W / 2, 432 + (1 - e) * 30), FIYAT_METNI, 28, CAMGOBEGI, kalin=False, a=e, capa="ma")
    e = cik(ilerle(t, 1.6, 2.0))
    yaz(k, (W / 2, 504 + (1 - e) * 30), "Bizi arayın: 0532 783 76 95", 42, BEYAZ, a=e, capa="ma")
    e = cik(ilerle(t, 1.95, 2.35))
    yaz(k, (W / 2, 590), "Keskin Bilişim", 24, BEYAZ, a=e * 0.85, capa="ma")
    yaz(k, (W / 2, 626), "SMS ücretleri ayrıdır", 16, BEYAZ, kalin=False, a=e * 0.55, capa="ma")


SAHNELER = [(s_acilis, 2.6), (s_sorun, 4.2), (s_panel, 4.6), (s_onkayit, 4.3), (s_finans, 4.3), (s_yoklama, 4.1), (s_veli, 4.6), (s_moduller, 3.4), (s_kapanis, 5.4)]
SURE = sum(s for _, s in SAHNELER)


def sahne_ciz(f, yerel, genel):
    k = zemin(genel)
    f(k, yerel)
    return k


def kare(t):
    bas = 0.0
    for i, (f, sure) in enumerate(SAHNELER):
        if t < bas + sure or i == len(SAHNELER) - 1:
            yerel = t - bas
            a = sahne_ciz(f, yerel, t)
            kalan = sure - yerel
            if kalan < GECIS and i + 1 < len(SAHNELER):
                e = gir_cik(1 - kalan / GECIS)
                b = sahne_ciz(SAHNELER[i + 1][0], GECIS - kalan, t)
                sinir = int(W * (1 - e))
                sonuc = Image.new("RGB", (W, H))
                sonuc.paste(a, (sinir - W, 0))
                sonuc.paste(b, (sinir, 0))
                d = ImageDraw.Draw(sonuc)
                d.rectangle((sinir - 26, 0, sinir, H), fill=PEMBE)
                d.rectangle((sinir - 10, 0, sinir + 8, H), fill=CAMGOBEGI)
                return sonuc
            if i == len(SAHNELER) - 1 and yerel > sure - 0.45:
                return Image.blend(a, TABAN, ilerle(yerel, sure - 0.45, sure))
            return a
        bas += sure
    raise AssertionError


def main():
    arg = sys.argv[1:]
    if "--kare" in arg:
        i = arg.index("--kare")
        kare(float(arg[i + 1])).save(arg[0])
        return
    cikti = arg[0]
    n = int(SURE * FPS)
    ff = subprocess.Popen(
        ["ffmpeg", "-y", "-loglevel", "error", "-f", "rawvideo", "-pix_fmt", "rgb24", "-s", f"{W}x{H}", "-r", str(FPS), "-i", "-",
         "-an", "-c:v", "libx264", "-preset", "medium", "-threads", "2", "-rc-lookahead", "12", "-crf", "24", "-pix_fmt", "yuv420p", "-movflags", "+faststart", cikti],
        stdin=subprocess.PIPE,
    )
    for i in range(n):
        ff.stdin.write(kare(i / FPS).tobytes())
        if i % 150 == 0:
            print(f"{i}/{n}", flush=True)
    ff.stdin.close()
    sys.exit(ff.wait())


if __name__ == "__main__":
    main()

# 02 · Kullanıcılar, Roller ve Yetkiler

**Sürüm:** MVP · **Kurspro karşılığı:** Kullanıcılar (yetki grupları), Kurumsal/Öğretmen/Öğrenci/Veli girişleri

## Amaç
Kimin sisteme nasıl gireceğini ve neyi görüp yapabileceğini belirlemek.

## Roller
| Rol | Ne yapar |
|---|---|
| **Genel yönetici** | Tüm şubelerde her şey: tanımlar, finans, raporlar, kullanıcılar |
| **Şube müdürü** | Yalnızca kendi şubesinde yönetici yetkileri (finans dahil) |
| **Sekreter / Kayıt** | Atandığı şube(ler)de ön kayıt, öğrenci kaydı, tahsilat, duyuru (finans raporları hariç) |
| **Öğretmen** | Hangi şubede olursa olsun yalnızca kendi grupları: yoklama, ödev, öğrenci notları, etüt; finans göremez |
| **Veli** | Kendi çocuğu/çocukları: yoklama, ödev, ödemeler, duyurular, mesaj |
| **Öğrenci** | Ödevler, ders programı, duyurular (3–5. sınıflar için opsiyonel) |

> 3–8. sınıf öğrencileri küçük yaşta olduğu için **ana kullanıcı veli**dir. Öğrenci hesabı opsiyonel tutulur.

## Giriş
- Personel: e-posta/telefon + parola
- Veli: **telefon numarası + SMS ile tek kullanımlık kod** (parola hatırlama derdi yok)
- Öğrenci: veli tarafından açılan basit kullanıcı adı + parola
- Kurspro'daki gibi TCKN ile giriş **kullanılmayacak** (KVKK açısından gereksiz risk)

## Yetki modeli
- Yetki = **rol + şube kapsamı.** Her kullanıcıya bir rol ve bir veya birden fazla şube atanır
  (örn. sekreter: Merkez + Şube 2). Genel yönetici "tüm şubeler" kapsamındadır.
- Roller sabit; yönetici gerekirse rol bazında modül aç/kapat yapabilir (Kurspro'daki "yetki grubu" mantığının sade hali).
- Öğretmen birden fazla şubede ders verebilir; yalnızca kendisine atanmış grupları görür.
- Şube kapsamı **sunucu tarafında** her sorguda uygulanır (bir şube personeli diğer şubenin öğrencisini/kasasını göremez).
- Veli yalnızca kendisine bağlı öğrencileri görür; bir veli birden çok çocuğa bağlanabilir (kardeşler).

## Ekranlar
- Kullanıcı listesi (rol filtresi, aktif/pasif)
- Kullanıcı ekle/düzenle, parola sıfırlama
- Rol → modül yetki tablosu
- Giriş geçmişi (kim, ne zaman)

## İş kuralları
- Personel ayrıldığında hesap silinmez, pasife alınır (geçmiş kayıtlar bozulmasın).
- Öğrenci kaydı yapılınca veli hesabı otomatik oluşturulur ve davet SMS'i gönderilir.
- Önemli işlemler (tahsilat silme, indirim, kayıt iptali) **işlem kaydına** (audit log) yazılır.

## Açık sorular
- Kaç personel kullanacak? Her şubede sekreter var mı?
- Şube müdürleri kendi şubesinin finansını görmeli mi?

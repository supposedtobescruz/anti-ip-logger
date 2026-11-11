# Microsoft Edge Add-ons listing - Türkçe

## Uzantı adı
Anti IP Logger

## Kısa açıklama
IP logger ve link grabber alan adlarını engeller, sayfa içinde IP sızıntısı denemelerini raporlar.

(Karakter sayısı: 98. Manifest `appDescription` alanının Türkçe karşılığıdır.)

## Kategori
Tools

## Arama terimleri (en fazla 7 terim, en çok 21 kelime)
ip logger, link grabber, grabify, oltalama koruması, gizlilik, güvenlik, discord güvenliği

(7 terim, 11 kelime.)

## Tek amaç beyanı
Kullanıcıları IP logger ve link grabber bağlantılarından korur: bilinen IP toplama alan adlarına giden bağlantıları engeller ve bir sayfanın IP adresinizi toplamaya çalıştığını gösteren davranış tespit ettiğinde uyarır.

## Detaylı açıklama

Anti IP Logger, IP adresinizi toplamak için var olan bağlantıları engeller: Grabify, IPLogger ve bunlar gibi Discord, WhatsApp, Telegram ve internette her yerde dağıtılan servisler.

Ne yapar

- Bilinen IP logger ve link grabber alan adlarına giden bağlantıları, istek ağa çıkmadan önce engeller.
- Özenle derlenmiş bir liste ile gelir (125 alan adı; kamuya açık kaynaklardan doğrulanır, kaynaklar değiştikçe otomatik yenilenir).
- Bir site, IP toplama ile ilişkilendirilen davranışlar gösterdiğinde sizi sayfa içinde uyarır: WebRTC aday dökümleri, tıklamasız form gönderimleri, gizli iframe'ler ve izleme pikselleri, meta refresh yönlendirmeleri ve etkileşimden önceki üçüncü taraf istekleri.
- Bir gezinme engellendiğinde hedef adresi, kaynak güvenilirliğini ve izin seçeneklerini gösteren tam sayfa bir uyarı açar.
- Olay kaydını ve sayaçları yalnızca tarayıcıda tutar. Hiçbir şey hiçbir yere gönderilmez.

Ne yapmaz

- VPN değildir, IP adresinizi gizlemez.
- Tüm cihazınızı kapsayan bir ağ filtresi değildir. Yalnızca bu tarayıcıyı etkiler.
- Hiçbir kişisel veri toplamaz, saklamaz veya iletmez. Telemetri, analitik ve çökme raporu altyapısı yoktur.
- Reklam engellemez. Yerleşik liste yalnızca IP toplamaya yönelik alan adlarını hedef alır.

Liste hakkında

- 125 alan adı; 91'i birden fazla kaynağa göre doğrulandı, 34'ü tek kaynaklı.
- Kaynaklar ve lisanslar `THIRD-PARTY-LICENSES.md` dosyasındadır (TMAFE listesi, MPL-2.0; PhishIndex, MIT; DeGrabify, atıf verilmiştir).
- Liste en fazla 6 saatte bir ve isteğe bağlı yenilenir; yenileme başarısız olduğunda önceki liste silinmez.

Diller

- Tam İngilizce ve Türkçe arayüz. Tarayıcının arayüz dili otomatik uygulanır ya da Ayarlar'dan zorlayabilirsiniz.
- İlk kurulumda altı adımlık bir hoşgeldin turu açar; Scruize, uzantının maskotu. Ayarlar → Hakkında bölümünden istediğinizde yeniden izleyebilirsiniz.

Gizlilik ve izinler

- Her şey yerel çalışır. Ayarlar, sayaçlar ve olay kaydı (en fazla 500 kayıt; alan adı + kısa metin, asla tam URL yok) tarayıcınızda kalır.
- Kişisel verileriniz makinenizden asla çıkmaz. Ayrıntılar için gizlilik politikasına bakın.

Uzantı ihtiyacınız olan bir şeyi engellerse, o sekme için bir kez izin verebilir, siteyi izin listesine ekleyebilir veya engel listesinden çıkarabilirsiniz. Bunların tümü panelden yönetilir.

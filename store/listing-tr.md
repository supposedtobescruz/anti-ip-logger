# Chrome Web Store listing — Türkçe

## Başlık
Anti IP Logger

## Kısa açıklama (132 karakter sınırı)
IP logger ve link grabber alan adlarını açılmadan engeller. Veri toplamaz, telemetri yok, Türkçe ve İngilizce.

(Karakter sayısı: 110.)

## Kategori
Tools

## Etiketler (opsiyonel, dürüst)
gizlilik, güvenlik, ip logger, grabify, link grabber, discord güvenliği

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

- Tam İngilizce ve Türkçe arayüz. Tarayıcının arayüz dili otomatik olarak uygulanır.

Gizlilik ve izinler

- Her şey yerel çalışır. Ayarlar, sayaçlar ve olay kaydı (en fazla 500 kayıt; alan adı + kısa metin, asla tam URL yok) tarayıcınızda kalır.
- Kişisel verileriniz makinenizden asla çıkmaz. Ayrıntılar için gizlilik politikasına bakın.

Uzantı ihtiyacınız olan bir şeyi engellerse, o sekme için bir kez izin verebilir, siteye izin listesine ekleyebilir veya engel listesinden çıkarabilirsiniz. Bunların tümü panelden yönetilir.

## İnceleyiciye notlar

- Geniş host izinleri `webNavigation` (engellenen gezinmeyi değerlendirmek için) ve içerik betikleri (`http://*/*` ve `https://*/*` ile sınırlı) için gereklidir.
- Uzantı uzaktan kod çalıştırmaz.
- WebRTC politikası isteğe bağlıdır ve varsayılan olarak kapalıdır ("Tarayıcı varsayılanı").

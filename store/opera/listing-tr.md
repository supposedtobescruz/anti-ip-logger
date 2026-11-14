# Opera Add-ons listing - Türkçe

Internal note, not part of the listing: Anti IP Logger, Chromium tabanlı tarayıcılar için Manifest V3 bir uzantıdır; Opera da dahildir. Alt sınır Opera 97'dir (Chromium 111, `world: MAIN` içerik komut dosyalarının geldiği sürüm). `manifest.json`, `minimum_chrome_version: 111` değerini bildirir; Opera alt sınırı burada metinde belgelenir çünkü manifest'te Opera'ya özgü bir anahtar yoktur.

## Başlık
Anti IP Logger

## Kısa açıklama (132 karakter sınırı)
IP logger ve link grabber alan adlarını açılmadan engeller. Veri toplamaz, telemetri yok, Türkçe ve İngilizce.

(Karakter sayısı: 110.)

## Kategori
Privacy & Security (Opera panelindeki kategori adı)

## Etiketler (opsiyonel, dürüst)
gizlilik, güvenlik, ip logger, grabify, link grabber, discord güvenliği

## Tek amaç beyanı
Kullanıcıları IP logger ve link grabber bağlantılarından korur: bilinen IP toplama alan adlarına giden bağlantıları engeller ve bir sayfanın IP adresinizi toplamaya çalıştığını gösteren davranış tespit ettiğinde uyarır.

## Detaylı açıklama

Anti IP Logger, IP adresinizi toplamak için var olan bağlantıları engeller: Grabify, IPLogger ve bunlar gibi Discord, WhatsApp, Telegram ve internette her yerde dağıtılan servisler. Opera 97 ve üzeri sürümlerde (Chromium 111 ve üzeri) Manifest V3 uzantısı olarak çalışır.

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
- İlk kurulumda altı adımlık bir hoşgeldin turu açar; Scruize, uzantının maskotu. Ayarlar > Hakkında bölümünden istediğinizde yeniden izleyebilirsiniz.

Gizlilik ve izinler

- Her şey yerel çalışır. Ayarlar, sayaçlar ve olay kaydı (en fazla 500 kayıt; alan adı + kısa metin, asla tam URL yok) tarayıcınızda kalır.
- Kişisel verileriniz makinenizden asla çıkmaz. Ağ istekleri yalnızca liste yenilemesi (HTTPS, sabit kaynaklar, en fazla 6 saatte bir ve isteğe bağlı) ve günlük sürüm kontrolüdür (public gist'ten tek satırlık sürüm metni, tanımlayıcı yok).
- Ayrıntılar için gizlilik politikasına bakın: https://supposedtobescruz.github.io/anti-ip-logger/privacy.html

Uzantı ihtiyacınız olan bir şeyi engellerse, o sekme için bir kez izin verebilir, siteye izin listesine ekleyebilir veya engel listesinden çıkarabilirsiniz. Bunların tümü panelden yönetilir.

## İnceleyiciye notlar

- Minimum sürüm Opera 97'dir; bu da Chromium 111'e karşılık gelir. `manifest.json`, `minimum_chrome_version: 111` değerini bildirir.
- Geniş host izinleri `webNavigation` (engellenen gezinmeyi değerlendirmek için) ve içerik betikleri (yalnızca `http://*/*` ve `https://*/*`) içindir.
- Uzantı uzaktan kod çalıştırmaz. Tüm JavaScript paketin içindedir.
- WebRTC politikası isteğe bağlıdır ve varsayılan olarak kapalıdır ("Tarayıcı varsayılanı").
- Geçici koruma duraklatma (15 dakika veya 1 saat) ve sekme başına "bir kez izin ver" seçeneği açılır pencere ve Ayarlar'dan kullanılabilir; ikisi de yalnızca yerel durumdur.
- Kontrol listesi ve engel sayfasını güvenli tetikleme yöntemi için bkz. `store/opera/submission-notes.md`.

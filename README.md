# Anti IP Logger

IP logger ve link grabber alan adlarını engelleyen, sayfa içinde IP sızıntısı denemelerini raporlayan Chrome uzantısı. Manifest V3, derleme adımı gerektirmeyen vanilla JavaScript.

Sürüm 2.0.0. Yerel liste 125 alan adı, 2 statik kural ve 61 istisna içerir.

## Ne yapar

- Bilinen IP logger ve Grabify alan adlarına yapılan üst düzey gezinmeyi engeller.
- Engellenen adres yerine ne olduğunu açıklayan bir sayfa gösterir; hedef sunucuya istek gitmez.
- Sayfa içinde WebRTC ile IP sızıntısı, tıklamasız form gönderimi, gizli iframe, meta refresh ve takip pikseli sinyallerini izler.
- Şüpheli davranışta sayfada uyarı bandı gösterir, panelde olay kaydı tutar.
- Alan adı bazında izin listesi, özel engel listesi ve sekmeye özel geçici izin sunar.
- Çekirdek listeyi kaynaklardan günceller; kaynaklar başarısız olursa mevcut listeyi korur.

## Ne yapmaz

- VPN değildir, IP adresini gizlemez.
- DNS, e-posta veya tarayıcı dışı trafiği engellemez.
- Görsel doğrulama yapmaz. Liste kaydı yanlış pozitif olabilir; izin listesi bunun için var.
- Hiçbir veriyi uzak bir sunucuya göndermez. Liste güncellemesi dışında ağ isteği yapmaz.

## Kurulum

1. Bu depoyu indir veya klonla.
2. Chrome veya Brave'de `chrome://extensions` sayfasını aç.
3. Sağ üstten "Geliştirici modu"nu aç.
4. "Paketlenmemiş öğe yükle" ile depo kökünü seç.
5. Kurulumdan sonra panel açılır. Araç çubuğundaki simge popup'ı açar.

Depo kökünde `manifest.json` bulunmalıdır. Alt klasörü seçme.

## Kullanım

- **Popup:** aktif sekmenin durumu, risk sinyalleri, sayaçlar ve son olaylar. "Siteyi engelle" özel listeye ekler, "İzin listesine ekle" alan adını muaf tutar, "Bu sekmede izin ver" yalnızca o sekme için geçerlidir.
- **Panel:** Genel Bakış, Listeler, Olaylar, Kaynaklar, Ayarlar. Liste arama, özel ve izin listesi yönetimi, kaynak sağlığı, yedekleme, sıfırlama.
- **Engel sayfası:** hedef adres, kayıt kaynağı ve üç karar: bu sekmede izin ver, kalıcı izin ver, geri dön.

## Veri ve kaynaklar

Çekirdek liste derleme sırasında üretilir:

| Kaynak | Lisans | Kullanım |
|---|---|---|
| TMAFE anti-grabify | MPL-2.0 | Grabify, IPLogger ve diğer servis alan adları |
| PhishIndex IP logger listesi | MIT | IP logger alan adları |
| DeGrabify düz alan adı listesi | Açık lisans belirtilmemiş, atıf verildi | Güncel Grabify alan adları |
| Elle gözden geçirilmiş kayıtlar | Bu depo | Eksik kalan servisler ve istisnalar |

- İstisnalar derleme sırasında engel listesinden çıkarılır, varsayılan izin listesine yazılmaz. Kullanıcı izin listesi boş başlar.
- Tehdit listesi isteğe bağlıdır ve varsayılan kapalıdır.
- Ayrıntılar ve lisans metinleri: [THIRD-PARTY-LICENSES.md](THIRD-PARTY-LICENSES.md).

## Geliştirme

Node 20.12 veya üzeri gerekir. Bağımlılık yoktur.

```powershell
npm run build           # kaynaklardan listeyi üret
npm run build:offline   # kayıtlı veriden yeniden üret
npm run check           # kayıtlı veri güncel mi
npm test                # birim testleri
npm run verify          # manifest, dosya, kural ve veri kontrolleri
npm run verify:ui       # erişilebilirlik, kontrast ve arayüz kontrolleri
npm run verify:browser  # Brave/Chrome ile gerçek yükleme ve ekran görüntüsü
npm run verify:all      # check + test + statik doğrulamalar
```

Tarayıcı doğrulaması `verify-output/` altına ekran görüntüleri ve `report.json` yazar. Brave varsayılan yolunda yoksa `BRAVE_PATH` ortam değişkeni ile yol verilebilir.

### Mimari

```
background.js          servis çalışanı, mesaj yolu, DNR uygulama, senkronizasyon
lib/constants.js       izinler, öncelikler, varsayılan ayarlar
lib/parser.js          liste ayrıştırma, alan adı doğrulama, alt alan adı sadeleştirme
lib/domains.js         kayıtlı alan adı ve eşleştirme yardımcıları
lib/rules.js           dinamik DNR kuralı üretimi
lib/dnr.js             kural uygulama, statik set, WebRTC politikası, rozet
lib/risk.js            sinyal puanlama, karar ve Türkçe metinler
lib/store.js           storage sarmalayıcıları, oturum durumu
content/probe.js       MAIN dünyası: WebRTC, medya, konum, ağ, jest kancaları
content/guard.js       izole dünya: DOM taraması, raporlama, shadow DOM bandı
popup/ dashboard/ blocked/   arayüz sayfaları
data/                  kaynak tanımı, özel kayıtlar, istisnalar, üretilen liste
rules/core.json        statik DNR kuralları
tools/                 derleme ve doğrulama betikleri
```

Kural önceliği: sekme izni 110 > izin listesi 100 > özel engel 50 > engel sayfası 40 > tehdit listesi 20 > çekirdek 10.

## Gizlilik

- Ayarlar, sayaçlar ve olay kaydı yalnızca `chrome.storage.local` içinde tutulur.
- Sekme durumu `chrome.storage.session` içinde tutulur ve tarayıcı kapanınca silinir.
- Liste güncellemesi dışında hiçbir ağ isteği yapılmaz. Güncelleme doğrudan kaynak adreslerine gider, aracı sunucu yoktur.
- Olay kaydı en fazla 500 kayıt tutar, alan adı ve kısa açıklama içerir.

## Bilinen sınırlar

- WebRTC politikası tarayıcı genelinde geçerlidir. "Tarayıcı varsayılanı" seçildiğinde uzantı, daha önce kendisi değiştirmediyse ayara dokunmaz.
- Liste güncellemesi internet erişimi gerektirir. Çevrimdışıyken yerel liste kullanılır.
- Kaynaklar kısmen yanıt verdiğinde uzantı, önceki senkronizasyonun alan adlarını korur ve yeni kayıtları üzerine ekler; boş liste yazmaz.
- Alan adı listesi zamanla eskir. Grabify benzeri servisler sık sık yeni alan adı açar.
- Uyarı bandı yalnızca danger seviyesinde ya da en az iki farklı warn kategorisi aynı anda tespit edildiğinde gösterilir. Tek zayıf sinyal (tek piksel, tek gizli iframe, tek erken istek) sayfada band açmaz, popup'ta rozet ve bulgu listesinde görünür.
- Bilinen reklam, ölçüm, consent ve sosyal embed alan adları gizli iframe/piksel taramasında gürültü olarak işaretlenir; bunlar sinyal üretmez. Liste `content/guard.js` içindedir ve genişletilebilir.
- Uyarı bandı sayfa tarafından CSS veya JavaScript ile gizlenebilir ya da DOM'dan kaldırılabilir. Engel listesi bu durumdan etkilenmez; panel ve popup her zaman doğru durumu gösterir.
- İçerik betiği MAIN dünyada çalışır ve sayfa JavaScript'i sinyal kuyruğuna sahte sinyal yazabilir. Engelleme yolu (DNR) bundan etkilenmez; uyarı bandı ve olay kaydı etkilenebilir.
- `host_permissions <all_urls>` gereklidir: `webNavigation` olaylarının URL alanının okunması ve içerik betiklerinin tüm sayfalarda çalışması buna bağlıdır. Uzantı, tanımlı liste kaynakları dışında hiçbir ağ isteği yapmaz ve hiçbir veriyi dışarı göndermez.
- Sinyaller tüm alt çerçevelerde (iframe) toplanır ve üst sayfaya bağlanır; uyarı bandı yalnızca üst çerçevede gösterilir.

## Lisans

Kod MIT lisansı ile yayınlanır. Üçüncü taraf veri ve yazı tiplerinin lisansları ayrıdır, [THIRD-PARTY-LICENSES.md](THIRD-PARTY-LICENSES.md) dosyasına bak.

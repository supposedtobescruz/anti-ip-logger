# AGENTS.md

Bu dosya, bu depoda çalışan yapay zeka ajanları ve geliştiriciler için kısa kural setidir. Amaç: mimariyi bozmadan, doğrulanabilir değişiklik üretmek.

## Proje özeti

Anti IP Logger, Manifest V3 Chrome uzantısıdır. Derleme adımı yoktur: kaynak dosyalar doğrudan tarayıcıya yüklenir. Veri listesi Node betikleriyle üretilir, ancak uzantı çalışırken bu betiklere ihtiyaç duymaz.

- Girdi noktası: `manifest.json`
- Servis çalışanı: `background.js`
- Arayüz: `popup/`, `dashboard/`, `blocked/`
- Ortak kod: `lib/`, `assets/`
- Üretilen veri: `data/core-domains.json`, `data/core-exceptions.json`, `data/meta.json`, `rules/core.json`
- Mağaza kiti: `store/` (listing, izin gerekçeleri, ekran görüntüleri), `PRIVACY.md`, `docs/privacy.html`

## Komutlar

Node 20.12 veya üzeri. Bağımlılık yoktur, `npm install` gerekmez.

```powershell
npm run build           # kaynaklardan listeyi üret (ağ erişimi gerekir)
npm run build:offline   # kayıtlı veriden yeniden üret
npm run check           # kayıtlı veri kaynaklarla tutarlı mı
npm test                # birim testleri
npm run verify          # manifest, dosya, kural, veri ve em dash kontrolü
npm run verify:ui       # kontrast, etiket, odak, hareket, kırılım
npm run verify:browser  # Brave/Chrome ile gerçek yükleme ve ekran görüntüsü
npm run verify:all      # check + test + verify + verify:ui
npm run icons           # simgeleri yeniden üret
npm run package         # mağaza zip'i üret: dist/anti-ip-logger-<sürüm>-cws.zip
```

Değişiklik teslim etmeden önce `npm run verify:all` çalışmalı. Arayüz değiştiyse `npm run verify:browser` de çalışmalı ve `verify-output/` görüntüleri gözle kontrol edilmeli.

## Değişmezler

Bunlar tasarım kararıdır; gerekçesiz değiştirme.

1. **Manifest V3, modül servis çalışanı, paketleyici yok.** Yeni npm bağımlılığı ekleme. Tarayıcı API'si yeterliyse kütüphane yaz.
2. **İzinler en az.** `web_accessible_resources` yok. Yeni izin eklemek kullanıcıya görünen bir maliyettir, önce mevcut API ile çözüm ara.
3. **Statik ve dinamik kural ayrımı.** Çekirdek liste `rules/core.json` içinde statik kural seti olarak durur. Kullanıcı ayarları, uzak güncelleme, izin listesi ve özel engeller dinamik kurallarla uygulanır.
4. **Öncelik merdiveni sabit:** sekme izni 110 > izin listesi 100 > özel engel 50 > engel sayfası yönlendirmesi 40 > tehdit listesi 20 > çekirdek 10. Yeni kural türü eklerken `lib/constants.js` içindeki `PRIORITY` ve `RULE_BASE` aralıklarını kullan, çakışan kimlik üretme.
5. **İstisnalar derleme sırasında listeden çıkarılır.** Varsayılan izin listesine yazılmaz. Kullanıcı izin listesi boş başlar.
6. **WebRTC politikası yalnızca uzantı kendisi değiştirdiyse geri alınır.** `appliedWebrtcPolicy` işareti bunun için var. Kullanıcının tarayıcı ayarını sessizce sıfırlama.
7. **Engel sayfası hedef adrese istek göndermez.** Yönlendirme `declarativeNetRequest` ile yapılır, hedef sunucuya ön istek atılmaz.
8. **Veri yalnızca yerelde.** `chrome.storage.local` ayarlar, sayaçlar ve olaylar için; `chrome.storage.session` sekme durumu için. Uzak sunucu, telemetri, analitik yok. Ağ isteği sadece liste güncellemesinde ve yalnızca tanımlı kaynak adreslerine gider.
9. **Olay kaydı sınırlı.** En fazla 500 kayıt. Alan adı ve kısa açıklama dışında kişisel veri yazma, tam URL saklama.
10. **Arayüz iki dillidir: İngilizce varsayılan, Türkçe destek.** Tüm kullanıcı metinleri `_locales/en/messages.json` ve `_locales/tr/messages.json` içindedir; `manifest.json` içinde `default_locale: "en"`. Kod, değişken adı ve API adları İngilizce kalır. Bölümler hash rotası İngilizcedir (`#overview`, `#lists`, `#events`, `#sources`, `#settings`).
11. **Uzun tire yok.** Proje dosyalarında `U+2014` kullanılmaz. `npm run verify` bunu kontrol eder. `antislop.md` hariç tutulur çünkü üçüncü taraf metindir.

## Antislop kuralları

Bu depo `antislop.md` kurallarını uygular. Tam metin depo kökünde. Özet:

- Uydurma istatistik, kullanıcı sayısı, başarı oranı yok. Sayı gerekiyorsa kaynağı ve ölçüm anı belli olmalı.
- Ölü kontrol yok. Her düğme çalışır, her bağlantı var olan bir hedefe gider, her durumun boş, yükleniyor ve hata hali tanımlı.
- Kontrast WCAG AA. Yeni renk eklerken `tools/verify-ui.mjs` içindeki çift listesine ekle.
- Klavye ile tam kullanım. Odak görünür, odak tuzağı yok, `Esc` beklenen yerlerde çalışır.
- Hareket azaltma tercihine saygı. `prefers-reduced-motion` açıkken animasyon kalmaz.
- Uydurma görsel, sahte logo, placeholder fotoğraf yok. Simgeler kodla üretilir (`tools/make-icons.mjs`).
- Pazarlama dili yok. Belirsizlik ve sınırlar açıkça yazılır.
- Teslim öncesi Delivery Gate raporu: hangi kontrol geçti, hangi kontrol atlandı, neden.

## Veri hattı

`data/sources.json` kaynak listesini, `data/curated.json` elle eklenen kayıtları, `data/exceptions.json` istisnaları tanımlar.

- Kaynak eklemek veya çıkarmak için `data/sources.json` düzenle, sonra `npm run build`.
- Kaynak başarısız olursa derleme mevcut listeyi korur, boş liste yazmaz. `--allow-partial` yalnızca çevrimdışı doğrulama içindir.
- Lisans bilgisi `THIRD-PARTY-LICENSES.md` ile birlikte güncellenmeli. Lisansı belirsiz kaynak ekleme.
- Üretilen dosyaları elle düzenleme. Değişiklik `tools/build-lists.mjs` veya girdi dosyalarında yapılır.

## Arayüz kuralları

- Ortak stiller `assets/base.css`, ortak yardımcılar `assets/ui.js`. Sayfaya özel stil kendi klasöründe.
- Tema `data-theme` özniteliği ile yönetilir. `system` seçiliyken öznitelik kaldırılır, `prefers-color-scheme` devreye girer.
- Mesajlaşma `send()` sarmalayıcısı üzerinden. Doğrudan `chrome.runtime.sendMessage` çağrısı yeni kodda kullanılmamalı.
- Her yeni form alanı görünür etiket veya `aria-label` taşımalı.
- Sayfa başına tek `h1`. Bölüm başlıkları `h2`.
- Yeni sayfa eklerken `tools/verify-extension.mjs` ve `tools/verify-ui.mjs` listelerine ekle, yoksa kontrol dışında kalır.

## Kod stili

- Vanilla JavaScript, ES modülleri, 2 boşluk girinti, çift tırnak, noktalı virgül.
- Yorum yalnızca kodun ne yaptığı dosyadan anlaşılmıyorsa. "Bu fonksiyon X yapar" türü yorum yazma.
- Sihirli sayı yok. Sabitler `lib/constants.js` içinde.
- Hata yutma yok. Yakalanan hata kullanıcıya anlamlı mesaj olarak dönmeli veya olay kaydına yazılmalı.
- Ölü kod, kullanılmayan içe aktarma, erişilmeyen dal bırakma.

## Commit düzeni

- Tek mantıksal değişiklik, tek commit. Karışık commit yapma.
- Mesaj İngilizce ve `type: summary` biçiminde: `feat:`, `fix:`, `docs:`, `test:`, `refactor:`, `chore:`.
- Commit öncesi `npm run verify:all` çalıştır.
- Üretilen veri değiştiyse aynı commit içinde olsun, ayrı commit'e bölme.

## Sürüm numaralandırma

Sürüm kaynağı `manifest.json` → `version`; `package.json` bununla aynı olmak zorunda.

- Proje 1.0.0'dan başlar; altına inilmez.
- Her teslim edilebilir güncelleme küçük bir sürüm artışıdır; sürüm artışı atlanmaz.
- Artış semver'e uyar: hata düzeltme `patch` (1.0.1), kullanıcıya görünen özellik `minor` (1.1.0), uyumsuz davranış `major` (2.0.0).
- Sürüm artışını manifest ve package.json birlikte taşır; README.md (`Version x.y.z`), readme/readmeTR.md, PRIVACY.md, docs/privacy.html, store/README.md ve paket çıktı adı aynı commit'te güncellenir.
- `npm run package` manifest sürümünü kullanır; eski sürüm referansları asla bırakılmaz.
- Sürüm numarası taşıyan her commit `v<version>` etiketi alır; push `--follow-tags` ile yapılır: `git push origin main --follow-tags`.
- Sadece doküman ve imla düzeltmeleri sürüm artışı gerektirmez; paketlenip yayınlanacak her değişiklik gerektirir.

## Bilinen sınırlar

Bunları gizleme, belgele:

- Uzantı VPN değildir, IP gizlemez.
- Liste zamanla eskir, yeni IP logger alan adları eklenmeli.
- WebRTC politikası tarayıcı genelinde geçerlidir.
- Gizli iframe ve piksel tespiti sezgiseldir, yanlış pozitif olabilir.
- Tarayıcı doğrulaması yerel Brave veya Chrome kurulumuna bağlıdır. Yoksa `BRAVE_PATH` ver veya kontrolü atlandı olarak raporla.

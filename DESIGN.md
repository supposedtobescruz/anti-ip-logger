# Tasarım notları

Bu dosya arayüz kararlarını, tasarım tokenlarını ve erişilebilirlik beklentilerini kaydeder. Amaç, sonraki değişikliklerde görsel dilin dağılmaması.

## Yön

Tema: **sansürlenmiş kanıt dosyası**. Uzantı bir güvenlik aracı; arayüz de bir dosya, damga ve kayıt dili kullanıyor. Kağıt zemin, mürekkep siyahı metin, tek vurgu rengi olarak vermilion kırmızısı. Süsleme yok, kanıt var.

Enerji 2, ritim 2, hareket 1. Ekran sakin, tipografi sıkı, tek vurgu rengi karar noktalarına ayrılmış.

Neden bu yön:

- Uzantının işi bir iddiayı doğrulamak: "bu adres IP topluyor". Dosya ve damga metaforu bu iddiayı taşıyor.
- Kırmızı yalnızca engel, tehlike ve birincil eylem için kullanılıyor. Sonuç: renk gördüğünde kullanıcı bir şey olduğunu biliyor.
- Kağıt zemin uzun okumada yormuyor, koyu temada da aynı sıcaklık korunuyor.

Kaçınılanlar: mor gradyan, cam efektli kart, yuvarlak köşeli balon, rastgele ikon seti, dekoratif illüstrasyon, "AI ürünü" görünümlü boşluk.

## Tokenlar

Renkler `assets/base.css` içinde tanımlı. Tema `data-theme` özniteliği ile değişiyor, `prefers-color-scheme` yalnızca yedek.

### Açık tema

| Token | Değer | Kullanım |
|---|---|---|
| `--paper` | `#fbf8f1` | Sayfa zemini |
| `--paper-raised` | `#ffffff` | Kart ve panel |
| `--paper-sunken` | `#f1ebdd` | Çukur alan, tablo başlığı, rail |
| `--ink` | `#171512` | Gövde metni |
| `--ink-soft` | `#4c463b` | İkincil metin |
| `--ink-faint` | `#6b6152` | Etiket, üçüncül metin |
| `--rule` | `#d5cbb7` | İnce çizgi |
| `--rule-strong` | `#171512` | Bölüm ayırıcı |
| `--accent` | `#a51f1f` | Vurgu, engel, birincil eylem |
| `--accent-ink` | `#ffffff` | Vurgu üzerindeki metin |
| `--safe` | `#2c6349` | Temiz durum |
| `--warn` | `#7d5210` | Şüpheli durum |
| `--danger` | `#a51f1f` | Tehlike durumu |

### Koyu tema

| Token | Değer |
|---|---|
| `--paper` | `#15130f` |
| `--paper-raised` | `#1e1b16` |
| `--paper-sunken` | `#100e0b` |
| `--ink` | `#f6f1e6` |
| `--ink-soft` | `#cfc5b2` |
| `--ink-faint` | `#a89d8a` |
| `--rule` | `#3b342a` |
| `--accent` | `#ff8f7d` |
| `--accent-ink` | `#1a0805` |

Koyu temada vurgu rengi açılıyor; siyah zeminde `#a51f1f` okunmuyor. Renk kimliği korunuyor, kontrast hedefi korunuyor.

### Ölçü

| Token | Değer | Not |
|---|---|---|
| `--radius` | `2px` | Neredeyse keskin köşe; belge hissi |
| `--shadow` | `0 10px 24px rgba(23, 21, 18, 0.12)` | Yalnızca engel sayfası |
| Gövde | 14px / 1.5 | Tüm sayfalar |
| Başlık | 24px panel, `clamp(22px, 4vw, 30px)` engel sayfası | Sıkı harf aralığı |
| Mikro etiket | 10px mono, 0.08em ile 0.22em arası tracking, büyük harf | Bölüm ve durum etiketi |
| Rakam | 26px mono, tabular | Sayaçlar |

Yazı tipleri gömülü: IBM Plex Sans (400, 500) ve IBM Plex Mono (400, 500), latin ve latin-ext alt kümeleri. Ağ isteği yok, FOUT yok.

## Bileşenler

- **Düğme:** üç varyant. `btn--primary` dolu vurgu, `btn--quiet` çizgili, `btn--danger` yalnızca çerçeve ve kırmızı metin. Yıkıcı işlem onay kutusunda dolu kırmızıya döner. Tüm düğmelerde `type` zorunlu.
- **Anahtar:** 38x22 ray, seçili durumda vurgu rengi. Etiket her zaman görünür, `aria-label` ile birlikte.
- **Rozet:** `safe`, `warn`, `danger`, `muted`, `plain`. Renk tek başına anlam taşımıyor, metin de var.
- **Kart:** 1px çizgi, gölge yok. Başlık şeridi ve gövde ayrı; tablo kartın içinde tam genişlik.
- **Olay satırı:** zaman, alan adı, açıklama, tür rozeti. Dar ekranda rozet gizleniyor, metin kısalıyor.
- **Uyarı bandı:** sol kenarda 5px renk şeridi. Renk durumu taşıyor, başlık cümlesi de aynı şeyi söylüyor.
- **Damga:** engel sayfasında 3px çerçeveli, 2.5 derece eğik `ENGELLENDİ` etiketi. Tek dekoratif öğe; işlevi durumu ilk bakışta bildirmek.

## Sayfa kompozisyonu

- **Popup:** 384px sabit genişlik, dikey akış. Durum kartı ve eylemler, sinyal listesi, dört sayaç, son olaylar, alt bilgi şeridi. Yükseklik 600px ile sınırlı, gerekirse kaydırılıyor.
- **Panel:** 232px sabit rail ve esnek içerik. Beş bölüm hash yönlendirmesi ile; tek seferde tek bölüm görünür. 980px altında rail üst şeride dönüşüyor, 760px altında tablolar ve ızgara tek sütuna iniyor.
- **Engel sayfası:** 680px belge, ortalanmış. Mobilde tam ekran, kenarlıksız. Karar düğmeleri mobilde tam genişlik.

## Durumlar

Her sayfada üç durum tanımlı:

| Durum | Popup | Panel | Engel sayfası |
|---|---|---|---|
| Yükleniyor | İskelet ve `aria-busy` | Sayaçlar sıfır, "Yükleniyor" metni | `aria-busy`, "Adres okunuyor" |
| Boş | "Henüz kayıt yok" açıklaması | Liste ve olay boş metni | Hedef okunamadı uyarısı |
| Hata | Hata kartı ve yeniden dene | `role="alert"` küresel hata | `role="status"` geri bildirim |

Ölü kontrol yok: her düğme bir mesaja veya gezinmeye bağlı, her bağlantı var olan bir bölüme gidiyor.

## Hareket

- Bölüm geçişi: 160ms `fade`, 3px yukarı kayma.
- Düğme ve anahtar: 120ms renk geçişi, anahtar topuzunda 120ms `transform`.
- Yükleniyor göstergesi: 700ms doğrusal dönüş.
- Canlı durum noktası: 1.4s nabız, yalnızca popup başlığında.

`prefers-reduced-motion: reduce` açıkken tüm animasyon ve geçişler 0.01ms'ye iniyor, sonsuz animasyon tek iterasyona düşüyor.

## Erişilebilirlik

- **Kontrast:** ölçülen en düşük oran açık temada 5.11:1, koyu temada 6.81:1. Tam liste `npm run verify:ui` çıktısında. WCAG AA hedefi 4.5:1.
- **Odak:** `:focus-visible` her yerde 2px vurgu çerçevesi ve 2px boşluk. Fare tıklamasında çerçeve çıkmıyor.
- **Klavye:** panelde "İçeriğe geç" bağlantısı ilk odak. Bölüm değişiminde başlık değil ana içerik odaklanıyor, böylece ekran okuyucu yeni bölümü baştan okuyor.
- **Etiket:** her form alanı görünür etiket veya `aria-label` taşıyor. Dosya girişi gizli ama etiketli.
- **Duyuru:** popup durum değişimini `role="status"` ile bildiriyor. Engel sayfası karar sonucunu aynı şekilde duyuruyor. Panelde hata `role="alert"`.
- **Dil:** üç sayfa da `lang="tr"`.
- **Başlık hiyerarşisi:** sayfa başına tek `h1`, bölüm başlıkları `h2`.
- **Dokunma hedefi:** düğmeler en az 30px yüksekliğinde, mobilde tam genişlik.

## İçerik kuralları

- Uzun tire (em dash) kullanılmıyor. Cümleler nokta veya iki nokta ile ayrılıyor.
- Uydurma sayı yok. Tüm sayaçlar ve oranlar gerçek veriden geliyor.
- "Devrimci", "süper", "akıllı" gibi pazarlama sıfatı yok. Ne yapıyorsa onu söylüyor.
- Belirsizlik açıkça yazılıyor: liste eskiyebilir, yanlış pozitif olabilir, WebRTC ayarı tarayıcı genelinde geçerli.
- Hata metinleri ne olduğunu ve ne yapılacağını söylüyor, özür dilemiyor.

## Doğrulama

Tasarım kuralları otomatik kontrol ediliyor:

```powershell
npm run verify:ui       # kontrast, etiket, odak, hareket, kırılım
npm run verify:browser  # gerçek tarayıcıda yükleme, ekran görüntüsü
```

`verify-ui.mjs` token çiftlerini okuyup kontrast hesaplıyor. Yeni bir renk eklerken bu betiğe çift eklenmeli, yoksa kontrol kapsamı dışında kalır.

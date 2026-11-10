# Üçüncü taraf lisansları

Bu depo MIT lisansı ile yayınlanır (bkz. `LICENSE`). Aşağıdaki veri kümeleri, yazı tipleri ve araçlar ayrı lisanslara tabidir. Bu dosya, hangi içeriğin hangi lisansla geldiğini ve ilgili bildirimleri listeler.

## Özet

| Bileşen | Lisans | Bu depodaki kullanım | Kaynak |
|---|---|---|---|
| TMAFE anti-grabify | MPL-2.0 | Grabify, IPLogger ve diğer servis alan adları, derleme sırasında türetilir | https://github.com/TMAFE/anti-grabify |
| PhishIndex blocklist | MIT | IP logger alan adları, isteğe bağlı tehdit listesi | https://github.com/PhishIndex/phishindex-blocklist |
| PhishDestroy destroylist | MIT | Yalnızca isteğe bağlı tehdit listesi | https://github.com/phishdestroy/destroylist |
| DeGrabify | Açık lisans belirtilmemiş | Grabify alan adları, atıf ile kullanılır | https://github.com/JonasLong/DeGrabify |
| IBM Plex Sans, IBM Plex Mono | SIL OFL-1.1 | `assets/fonts/` altında gömülü yazı tipleri | https://github.com/IBM/plex |
| antislop | MIT | `antislop.md` tasarım ve yazım kuralları | https://github.com/miqdadbadjuber/anti-slop |

## Veri kümeleri

### TMAFE anti-grabify (MPL-2.0)

`data/core-domains.json` ve `rules/core.json` içindeki Grabify, IPLogger ve diğer servis alan adlarının bir bölümü TMAFE anti-grabify deposundan türetilmiştir. Kaynak depo Mozilla Public License 2.0 ile lisanslanmıştır:

https://github.com/TMAFE/anti-grabify/blob/master/LICENSE

Bu depo, kaynak kodun kendisini değil, kaynak dosyalardan çıkarılmış alan adı listesini içerir. Alan adları olgusal veridir. MPL-2.0 kapsamındaki dosyalarda değişiklik yapılmamıştır; liste `tools/build-lists.mjs` ile kaynaktan yeniden üretilebilir. MPL-2.0 metni: https://mozilla.org/MPL/2.0/

### PhishIndex blocklist (MIT)

IP logger alan adları ve isteğe bağlı tehdit listesi PhishIndex blocklist deposundan alınır.

Copyright (c) 2026 PhishIndex

```
MIT License

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

### PhishDestroy destroylist (MIT)

Yalnızca kullanıcı tehdit listesini açtığında çekilir. Depoya dahil edilmez.

Copyright (c) 2019 PhishDestroy

```
MIT License

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

### DeGrabify

DeGrabify deposunda ve dağıtılan gist içinde açık bir lisans dosyası bulunmuyor. Liste yalnızca alan adı gerçeklerini içerdiği ve atıf verildiği için kullanılıyor. Hak sahibi talep ederse ilgili kayıtlar kaldırılır.

Kaynak: https://github.com/JonasLong/DeGrabify

### Elle gözden geçirilmiş kayıtlar

`data/curated.json` ve `data/exceptions.json` bu depoya aittir, MIT lisansı kapsamındadır.

## Yazı tipleri

IBM Plex Sans ve IBM Plex Mono, SIL Open Font License 1.1 ile lisanslanmıştır.

Copyright (c) 2017 IBM Corp. with Reserved Font Name "Plex".

Tam lisans metni: `assets/fonts/OFL.txt`. Özet ve SSS: https://openfontlicense.org/

Yazı tipleri değiştirilmemiş WOFF2 dosyaları olarak gömülüdür. Alt kümeleme sırasında glifler azaltılmıştır; bu, OFL kapsamında izin verilen bir değişikliktir ve dosya adları korunmuştur.

## Maskot

`assets/mascot-scruize.svg` bir DiceBear avataaars üretimi (v10), `seed=corrupted` ile üretilmiştir. Avataaars tarzı Pablo Stanley tarafından oluşturulmuş, kişisel ve ticari kullanımda ücretsizdir. Stil kaynağı: https://www.avataaars.com/ ; üretim: https://www.dicebear.com/ . SVG, kişisel kullanıma uygun olarak yerel dosyaya dondurulmuştur; uzantı çalışma zamanında dicebear.com'a istekte bulunmaz. Bireysel değiştirilmemiş kopyası `assets/mascot-scruize.svg` içindedir.

## Araçlar

### antislop (MIT)

`antislop.md` dosyası Miqdad Badjuber tarafından yayınlanan anti-slop deposundan alınmıştır. Tasarım, yazım ve erişilebilirlik kuralları bu projede uygulanmıştır.

Copyright (c) 2026 Miqdad Badjuber

```
MIT License

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

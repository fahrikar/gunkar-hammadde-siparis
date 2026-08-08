# CLAUDE.md

Tek dosyalık statik web uygulaması: tedarikçiye gönderilecek oluklu mukavva
levha siparişi telefondan girilir, firmanın kendi Excel şablonu doldurularak
`.xlsx` indirilir. Sunucu yok, hesap yok, veri dışarı çıkmıyor.

İşleyişin ayrıntısı ve kullanıcıya dönük anlatım `README.md`'de. Burada
yalnızca kod üzerinde çalışırken bilinmesi gerekenler var.

## Yapı

| Dosya | Ne |
|---|---|
| `index.html` | uygulamanın tamamı — HTML + CSS + JS + base64 gömülü Excel şablonu |
| `sw.js` | service worker — çevrimdışı çalışma ve otomatik güncelleme |
| `manifest.webmanifest` | ana ekrana kurulum; `icon*.png` / `icon.svg`'ye bakar |
| `icon.svg`, `icon-*.png` | üretilmiş dosyalar — elle düzenlemeyin, `npm run ikon` |
| `jszip.min.js` | JSZip 3.10.1, repoda tutuluyor (CDN yok) |
| `tools/` | sadece geliştirme (aşağıda) |
| `.claude/skills/` | `yayinla`, `sablon-guncelle` — tekrar eden akışlar |

```
tools/check.mjs             statik kontroller                    npm run check
tools/smoke.mjs             tarayıcıda uçtan uca test            npm test
tools/bump-version.mjs      iki dosyadaki sürümü birlikte artır  npm run bump
tools/inspect-template.mjs  şablonun satır/kolon eşlemesi        npm run sablon
tools/make-icons.mjs        simgeleri koddan çizer               npm run ikon
tools/embed-template.mjs    yeni .xlsx'i index.html'e göm
tools/lib/xlsx.mjs          jszip.min.js'i node'dan kullanma yardımcısı
```

Build adımı yok, framework yok, transpile yok. **Uygulamanın kendisi sıfır
bağımlılıklı kalmalı** — `package.json`'daki tek bağımlılık testler içindir,
tarayıcıya hiçbir şey yüklenmez.

Arayüz, hata mesajları, kod yorumları ve commit mesajları Türkçe.

## Değişiklikten sonra

```bash
npm run check   # sözdizimi + sürüm tutarlılığı, saniyeler sürer
npm test        # gerçek Chromium'da uçtan uca smoke testi
```

Web oturumlarında bağımlılıklar `.claude/hooks/session-start.sh` ile
kuruluyor; elle `npm install` gerekmez.

## Sessizce bozulan yerler

Bu kod tabanında hatalar bağırmaz. Değişiklik yaparken asıl dikkat gereken
noktalar bunlar:

**1. `xlSet` hücreyi bulamazsa hata vermez.** Şablonda aranan hücre yoksa
`String.replace` eşleşmez, fonksiyon sessizce geri döner ve o veri Excel'e
hiç yazılmaz. Kolon/satır eşlemesine dokunan her değişiklikten sonra
`npm test` şart — test hücre değerlerini tek tek okur.

Şablon değişirse gözden geçirilecekler (`README.md`'de ayrıntılı):
`xlFillLine` içindeki `const r=3+i`, `MAX_LINES=50`, `addDateStyle`'daki
`all[34]`, ve `I–P` / `Q` / `R` / `S` / `X` kolon harfleri.

**2. Sürüm ikilisi ayrışırsa otomatik güncelleme durur.** `index.html`
içindeki `APP_VERSION` ile `sw.js` içindeki `VERSION` **birlikte**
artırılmalı. `sw.js` baytı değişmezse tarayıcı yeni sürüm olduğunu anlamaz;
kullanıcı eski sürümde kalır ve bunu kimse fark etmez. `npm run check`
bu ayrışmayı yakalar.

**3. Ölçülerde kayan nokta.** Ril ölçüleri ve levha en/boy küsüratlı
girilebiliyor (`parseNum` hem virgülü hem noktayı kabul eder). Şablon rilli
satırlarda levha enini `SUM(I:P)` ile hesapladığı için **ril toplamı levha
enine eşit olmak zorunda**; bu karşılaştırma `eqMm` ile 0,005 mm toleransla
yapılır. Ölçüleri `===` ile karşılaştırmayın, `roundMm`/`eqMm` kullanın.

**4. Service worker `file://` ile çalışmaz.** Güncelleme davranışını test
etmek için sayfa http üzerinden sunulmalı — `npm test` bunu kendi kurduğu
yerel sunucuyla yapıyor. `file://` ile açıldığında kayıt atlanır, uygulama
yine çalışır.

`controllerchange` yalnızca **önceden bir denetleyici varken** sayfayı
yeniler (`hadController`). İlk ziyarette `clients.claim()` de bu olayı
tetikliyor; koşul kaldırılırsa kullanıcı ilk açılışta sebepsiz bir yenileme
görür ve o sırada forma yazdıkları silinir. Bunun bedeli: ilk ziyaretteki
sayfa denetimsiz kalabilir, bir sonraki açılışta denetime girer. Çevrimdışı
çalışma etkilenmez — dosyalar `install` sırasında zaten önbelleğe alınıyor.

**5. Arayüz satır içi `onclick` ile kurulu.** Bir fonksiyon yeniden
adlandırıldığında sayfa açılır, düğme sessizce ölür. `npm run check`
HTML'deki `onclick` adlarıyla script'teki `function` tanımlarını
karşılaştırıp bunu yakalar.

**6. Renkler yalnız `:root` değişkenlerinde.** Koyu tema
(`prefers-color-scheme`) sadece bu değişkenleri yeniden tanımlıyor; kural
içine doğrudan renk yazılırsa karanlık modda okunmaz hâle gelir. JS'ten
renk atanan tek yer `updatePreview`'daki `pvM2` — orada da `var(--…)`
kullanılmalı.

## Yayın

GitHub Pages `main` dalını sunuyor: **`main`'e merge etmek yayına almaktır.**
Akışın tamamı `yayinla` skill'inde; özeti:

1. `npm run bump` — `APP_VERSION` ve `sw.js`'teki `VERSION` birlikte artar.
2. `npm run check && npm test` geçer.
3. `main`'e merge edilip push edilir.
4. GitHub Actions'taki `pages build and deployment` çalışmasının bitmesi
   beklenir (~1-2 dk).

Tedarikçi yeni şablon gönderdiğinde `sablon-guncelle` skill'i var.

Kullanıcı tarafında güncelleme otomatik: `sw.js` "ağ önce" çalıştığı için
uygulama bir sonraki açılışta yeni sürümü alır, silinip yeniden kurulması
gerekmez. Uygulama açıkken yeni sürüm inerse üstte "Yeni sürüm hazır ·
Yenile" çubuğu çıkar — form doldurulurken veri kaybolmasın diye sayfa
kendiliğinden yenilenmez. Çalışan sürüm başlıktaki `· s<sürüm>` etiketinden
okunur.

## Veri

Sipariş satırları, sipariş başlığı ve tedarikçi listesi `localStorage`'da
(`gk_lines`, `gk_header`, `gk_suppliers`, `gk_activeSupplier`). `loadLines`
gelen veriyi süzüp sayıya çeviriyor — eski kayıtlar yeni alanları
içermeyebileceği için bu süzgeç korunmalı. Kalite, ril tipi ve firma adı
serbest metin; `innerHTML`'e basılmadan önce `esc()` ile kaçışlanır.

`store.set` kota dolduğunda `false` döner; `saveLines` bunu bildirimle
duyurur. Sessizce yutmayın — kullanıcı kaydedildi sanıp sekmeyi kapatır.

`gk_header`'daki teslim tarihi geçmişte kaldıysa `restoreHeader` bugüne
çeker: eski bir tarihin sessizce siparişe geçmesi boş kalmasından kötü.

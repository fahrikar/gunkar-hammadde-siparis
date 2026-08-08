# Günkar · Hammadde Sipariş Formu

Tedarikçiye (Ankutsan, KRN vb.) gönderilecek oluklu mukavva levha siparişini
telefondan girip, firmanın kendi Excel şablonunu doldurarak `.xlsx` olarak
indirmeye/paylaşmaya yarayan tek dosyalık web uygulaması.

Sunucu yok, hesap yok, veri dışarı çıkmıyor — her şey tarayıcıda çalışır.

## Kullanım

1. Üstteki **Tedarikçiler** butonundan firmayı seç (veya yeni ekle/düzenle).
2. Sipariş bilgilerini (teslim tarihi, müşteri, sevk yeri, vade) doldur.
   Bunlar tarayıcıda saklanır, her seferinde yeniden yazılmaz.
3. Her ürün için dalga / kalite / ril tipi / levha ölçüsü / adet girip
   **Satırı ekle**'ye bas (klavyedeki Enter de ekler).
4. Alt bardaki **Excel indir / paylaş** ile dosyayı üret. Telefonda paylaşım
   menüsü açılır (WhatsApp, mail); masaüstünde dosya iner.

Dosya adı: `GUNKAR_SIPARIS_<firma>_<tarih>.xlsx`

### Satırlarla çalışmak

| Ne | Nasıl |
|---|---|
| Yanlış girilen satırı düzeltmek | satırdaki **Düzenle** — satır forma döner, değiştirip **güncelle** |
| Benzer bir satır girmek | **Kopyala** — satır forma gelir, ölçüyü değiştirip ekle |
| Silmek | **Sil** — onay sorulmaz, çıkan bildirimden **Geri al**'a basılabilir |
| Sekiz ril ölçüsünü hızlı girmek | “300 300 325 325” gibi bir metni ilk ril kutusuna yapıştır |

**Temizle** de geri alınabilir. Aynı satır ikinci kez eklenirse uyarı çıkar
(engellenmez, bilinçli tekrar olabilir).

### Ana ekrana ekleme

Uygulama telefona kurulabilir (PWA): tarayıcı menüsünden **Ana ekrana ekle**
denince tarayıcı sekmesi değil, kendi simgesiyle tam ekran açılan bir uygulama
olarak yerleşir. Simgeler `tools/make-icons.mjs` ile koddan üretiliyor
(`npm run ikon`), `manifest.webmanifest` bunlara işaret ediyor.

Arayüz telefonun temasına uyar: karanlık modda karanlık görünür. Çevrimdışıyken
başlıkta **çevrimdışı** rozeti çıkar — uygulama çalışmaya devam eder.

## Kurallar

Uygulama satırı eklemeden önce şunları zorunlu tutar:

| Kural | Değer | Nereden |
|---|---|---|
| Levha eni | 300 – 2.800 mm | şablonun kendi kontrolü |
| Levha boyu | 650 – 5.500 mm | şablonun kendi kontrolü |
| Minimum sipariş | 500 m² | üretim alt sınırı |
| Sipariş adedi | tam sayı | levha adedi kesirli olamaz |
| Ril toplamı | levha enine eşit olmalı | şablon eni `SUM(I:P)` ile hesaplıyor |
| Satır sayısı | en fazla 50 | şablonda hazır satır: 3–52 |

Excel üretilmeden önce de kontrol edilir: tedarikçi seçilmiş, müşteri adı ve
sevk yeri dolu, düzenlenmekte olan bir satır açık değil. Teslim tarihi boş
bırakılmışsa bugüne çekilir — `W` kolonu boş giden sipariş tedarikçide takılır.

RİLSİZ satırlarda ril ölçüsü aranmaz, en `Q` kolonuna da yazılır.

50 satır dolduğunda yeni satır eklenmez — siparişi indirip yeni bir sipariş
açmak gerekir. Bu sınır şablonun gerçek kapasitesidir: 52. satırdan sonrası
Excel'e hiç yazılamaz.

Girilen satırlar tarayıcıda (`localStorage`) saklanır, sayfa yenilenince
kaybolmaz. **Temizle** ile silinir.

## Dosyalar

```
index.html                  uygulamanın tamamı (HTML + CSS + JS + gömülü şablon)
sw.js                       service worker — çevrimdışı çalışma + otomatik güncelleme
manifest.webmanifest        ana ekrana kurulum (PWA)
icon.svg, icon-*.png        uygulama simgeleri — tools/make-icons.mjs üretiyor
jszip.min.js                JSZip 3.10.1 — .xlsx zip'ini açıp yeniden paketler
jszip-LICENSE.markdown
tools/                      geliştirme kontrolleri (yayına etkisi yok)
CLAUDE.md                   kod üzerinde çalışırken bilinmesi gerekenler
.nojekyll                   GitHub Pages
```

## Kontroller

```bash
npm install      # sadece test aracı (playwright-core); uygulama bağımlılıksız
npm run check    # sözdizimi, sürüm tutarlılığı, onclick bağlantıları, manifest
npm test         # gerçek tarayıcıda uçtan uca: ölçü girişi, Excel hücreleri,
                 # satır düzenleme/geri alma, manifest, çevrimdışı çalışma
npm run bump     # yayın öncesi iki dosyadaki sürümü birlikte artırır
npm run sablon   # gömülü şablonun satır/kolon eşlemesini raporlar
npm run ikon     # simgeleri yeniden üretir (renk/biçim değişirse)
```

`npm test` Excel çıktısındaki hücreleri tek tek okur. Bunun sebebi
`xlSet`'in hücreyi bulamayınca hata vermemesi: şablon eşlemesi bozulduğunda
Excel sessizce eksik dolar, test bunu yakalar.

Bağımlılık yönetimi, build adımı yok. `index.html`'i tarayıcıda açmak yeterli;
yayın için repoyu GitHub Pages'e vermek dışında bir şey gerekmiyor.

JSZip repoda tutuluyor (CDN'den çekilmiyor) — böylece dış bir servise bağımlı
kalmıyor ve sayfa bir kez yüklendikten sonra internet olmadan da Excel üretiyor.

## Güncelleme (ana ekrana eklenen uygulama)

`sw.js` "ağ önce" çalışır: internet varken her açılışta dosyalar sunucudan
alınır, internet yokken önbellekteki son sürümle çalışılır. Yani telefondaki
uygulamayı **silip yeniden kurmaya gerek yok** — yeni sürüm `main`'e girip
GitHub Pages yayını bittikten sonra uygulama bir sonraki açılışta kendini
günceller.

Uygulama açıkken yeni sürüm inerse üstte sarı bir **"Yeni sürüm hazır ·
Yenile"** çubuğu çıkar; forma yazılanlar kaybolmasın diye sayfa kendiliğinden
yenilenmez, yenileme kullanıcının tıklamasıyla olur.

Çalışan sürüm başlıktaki `· s2026-08-07.1` etiketinden okunur — telefondaki
sürümün güncel olup olmadığı böyle kontrol edilir.

Yeni sürüm yayınlarken **iki yerdeki sürüm numarası birlikte** artırılmalı:

| Dosya | Sabit |
|---|---|
| `index.html` | `const APP_VERSION="…"` |
| `sw.js` | `const VERSION="…"` |

`sw.js` içeriği değişmezse tarayıcı yeni sürüm olduğunu anlamaz ve güncelleme
çubuğu çıkmaz.

## Excel şablonu nasıl çalışıyor

Boş şablon `.xlsx`, `index.html` içinde `TEMPLATE_B64` sabitinde base64 olarak
gömülü. Export sırasında:

1. Zip JSZip ile açılır.
2. `xl/worksheets/sheet1.xml` içindeki hücreler (`D3:X52`) tek tek değiştirilir.
3. `xl/styles.xml`'e `gg.aa.yyyy` biçimli bir hücre stili eklenir; teslim
   tarihi metin değil gerçek tarih olarak yazılır.
4. `xl/calcChain.xml` silinir ve çalışma kitabı `fullCalcOnLoad` ile
   işaretlenir — formül içeren hücreleri düz değerle ezdiğimiz için, aksi
   hâlde Excel onarım uyarısı verebilir ve kalan formüller (FİYAT vb.)
   güncellenmez.
5. Zip yeniden paketlenip indirilir.

Logo, biçimlendirme, `ANA VERİLER` ve `GEÇERLİLİK` sayfaları olduğu gibi kalır.

### Kolon eşlemesi (`SİPARİŞ FORMU` sayfası)

| Kolon | Alan | Kolon | Alan |
|---|---|---|---|
| D | Müşteri adı | R | Levha en |
| E | Kalite grup | S | Levha boy |
| F | Dalga | U | Sevk yeri |
| G | Kalite | V | Vade |
| H | Ril tipi | W | Teslim tarihi |
| I–P | Ril 1–8 | X | Sipariş adet |
| Q | Levha en (RİLSİZ) | | |

`C` (müşteri kodu), `AA` (FSC), `AB`, `AC` doldurulmuyor. `Y`/`Z` (fiyat/birim)
şablonun `ANA VERİLER`'e bakan formüllerinden gelir, uygulama dokunmaz.

### Şablon güncellenirse

Tedarikçi yeni bir şablon gönderirse gömülü base64'ü yenilemek gerekir:

```bash
base64 -w0 YENI_SABLON.xlsx > sablon.b64
```

Çıkan metni `index.html` içindeki `const TEMPLATE_B64="..."` satırına yapıştır.
Sonra kontrol et:

- Sipariş satırları hâlâ 3. satırda mı başlıyor? Değilse `xlFillLine`'daki
  `const r=3+i` güncellenmeli.
- Son hazır satır hâlâ 52 mi? Değilse `MAX_LINES` güncellenmeli.
- Kolon harfleri değiştiyse `xlFillLine` içindeki eşleme güncellenmeli.
- `W` kolonunun stil indeksi değiştiyse `addDateStyle`'daki `all[34]`
  güncellenmeli (yanlış indeks sadece kenarlık/font'u etkiler, tarih biçimi
  yine doğru olur).

Bu üçü sessizce bozulabilen yerlerdir: hücre bulunamazsa `xlSet` hata vermez,
sadece o veriyi yazmaz. Şablon değiştikten sonra mutlaka bir deneme siparişi
üretip Excel'de aç.

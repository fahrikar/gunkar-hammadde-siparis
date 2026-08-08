---
name: sablon-guncelle
description: Tedarikçiden gelen yeni Excel şablonunu index.html'e gömer ve satır/kolon eşlemesinin hâlâ doğru olduğunu doğrular. Kullanıcı "yeni şablon geldi", "Ankutsan şablonu değişti", "şablonu güncelle", "sipariş formu excel'i yenilendi", "tedarikçi yeni form gönderdi" dediğinde ya da bir .xlsx dosyası verip "bunu kullan / bunu göm" dediğinde bu skill'i kullan. Excel çıktısındaki kolonlar, satır numaraları veya tarih biçimi ile ilgili bir şikâyet geldiğinde de buradaki teşhis adımlarını kullan. Bu repoda yanlış eşleme hata vermeden sessizce eksik Excel ürettiği için adımları atlama.
---

# Şablon güncelleme

Boş `.xlsx` şablonu `index.html` içinde `TEMPLATE_B64` sabitinde base64
olarak gömülü. Uygulama export sırasında bu zip'i açıp
`xl/worksheets/sheet1.xml` içindeki hücreleri tek tek değiştiriyor.

Buradaki tehlike şu: `xlSet` aradığı hücreyi bulamazsa **hata vermez**.
`String.replace` eşleşmez, fonksiyon sessizce geri döner, o veri Excel'e
hiç yazılmaz. Yani şablonun satır numaraları veya kolon harfleri değiştiyse
uygulama çalışmaya devam eder, indirilen dosya eksik olur ve bu ancak
tedarikçi "bu siparişte adet yazmıyor" dediğinde ortaya çıkar. Aşağıdaki
adımların tamamı bu sessizliği bozmak için var.

## Adımlar

### 1. Önce mevcut şablonun raporunu al

Karşılaştırma yapabilmek için değiştirmeden önce fotoğrafını çek:

```bash
node tools/inspect-template.mjs > /tmp/eski-sablon.txt
cat /tmp/eski-sablon.txt
```

### 2. Yeni şablonu incele

```bash
node tools/inspect-template.mjs YENI_SABLON.xlsx > /tmp/yeni-sablon.txt
diff /tmp/eski-sablon.txt /tmp/yeni-sablon.txt
```

`diff` boşsa yapı aynı demektir, doğrudan 4. adıma geç. Fark varsa 3. adım.

### 3. Farkları koda yansıt

Rapor dört şeyi gösteriyor; her biri `index.html` içinde bir yere karşılık
geliyor:

| Rapordaki satır | Kod |
|---|---|
| `ilk satır: N` | `xlFillLine` içindeki `const r=3+i` → `const r=N+i` |
| `kapasite: N` | `MAX_LINES=N` |
| Başlık satırındaki kolon harfleri | `xlFillLine`'daki `D/E/F/G/H`, `C="IJKLMNOP"`, `Q/R/S/U/V/W/X` |
| `W<n> hücresinin stil indeksi: N` | `addDateStyle` içindeki `all[34]` → `all[N]` |

Kolon eşlemesini rapordaki başlık etiketlerinden kur — `MÜŞTERİ ADI` hangi
harfteyse `D` oradadır, `RİL 1`–`RİL 8` hangi aralıktaysa `C` dizesi odur.
Etiketler değişmiş ama anlamları aynıysa harfe bak, isme değil.

Stil indeksi yanlış olursa tarih yine doğru yazılır, sadece hücrenin
kenarlığı ve fontu şablondan farklı görünür — yani bu tek başına yayını
engellemez ama düzeltilmesi kolaydır.

### 4. Şablonu göm

```bash
node tools/embed-template.mjs YENI_SABLON.xlsx
```

Dosyanın geçerli bir xlsx olduğunu ve içinde `sheet1` bulunduğunu önce
doğrular; değilse gömmez. Elle base64 yapıştırma, 100 KB'lık tek satırı
bozmak kolay.

### 5. Kontroller

```bash
npm run check && npm test
```

`npm test` gerçek tarayıcıda bir sipariş üretip Excel hücrelerini tek tek
okuyor: `I3–P3` ril kolonları, `R3`/`S3` levha ölçüleri, `Q` (RİLSİZ),
`D3`/`H3` metinleri, `X3` adet. Eşleme bozulmuşsa burada düşer.

Test düşerse hangi hücrenin boş geldiğine bak — çıktı beklenen ve bulunan
değeri yan yana yazıyor, bu doğrudan hangi kolonun kaydığını söyler.

### 6. Gözle doğrula

Otomatik test hücre değerlerini kontrol eder ama şablonun görünümünü
kontrol edemez. Uygulamadan bir deneme siparişi indirip Excel'de aç ve şuna
bak: logo yerinde mi, `ANA VERİLER` ve `GEÇERLİLİK` sayfaları duruyor mu,
Excel açılışta "onarım" uyarısı veriyor mu, `FİYAT`/`BİRİM` formülleri
hesaplanıyor mu.

Onarım uyarısı çıkıyorsa `dropCalcChain` ile ilgilidir: formüllü hücreleri
düz değerle ezdiğimiz için `calcChain.xml` siliniyor ve çalışma kitabı
`fullCalcOnLoad` ile işaretleniyor. Yeni şablonda bu dosyanın adı veya
ilişkileri farklıysa oraya bak.

### 7. Yayınla

Şablon değişikliği kullanıcıya ulaşmadan bir işe yaramaz. `yayinla`
skill'ini kullan — sürümü artırır, kontrolleri tekrar çalıştırır ve Pages
derlemesini bekler.

## Referans

Kolon eşlemesinin tamamı ve şablonun nasıl işlendiği `README.md`'de
"Excel şablonu nasıl çalışıyor" bölümünde. Uygulamanın dokunmadığı yerler:
`C` (müşteri kodu), `T`, `Y`/`Z` (şablonun kendi formülleri), `AA`–`AC`.

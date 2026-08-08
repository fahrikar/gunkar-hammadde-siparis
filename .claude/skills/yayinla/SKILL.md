---
name: yayinla
description: Günkar sipariş formunu yayına alır — sürüm numarasını iki dosyada birlikte artırır, kontrolleri çalıştırır, main'e merge eder ve GitHub Pages derlemesinin bitmesini bekleyip doğrular. Kullanıcı "yayınla", "yayına al", "canlıya çıkar", "deploy", "main'e al", "sürüm çıkalım", "telefondaki uygulama güncellensin", "kullanıcılara gitsin" gibi bir şey söylediğinde bu skill'i kullan. Bir düzeltme bitip kullanıcının telefonuna ulaşması gerektiğinde de kullan. Elle yapıldığında sürüm artırma adımı unutuluyor ve otomatik güncelleme sessizce durduğu için komutları tek tek çalıştırmak yerine bu akışı izle.
---

# Yayına alma

GitHub Pages `main` dalını sunuyor: **`main`'e merge etmek yayına almaktır.**
Ara bir onay adımı yok, merge biter bitmez kullanıcıların telefonuna gider.

Bu akışın var olma sebebi tek bir sessiz hata: `index.html`'deki
`APP_VERSION` ile `sw.js`'teki `VERSION` birlikte artmazsa uygulama kendini
güncellemez. Tarayıcı yeni sürüm olup olmadığına `sw.js` baytı değişti mi
diye bakarak karar veriyor; bayt aynı kalırsa kullanıcı eski sürümde kalır
ve **bunu kimse fark etmez** — ne hata çıkar, ne uyarı. Yayın sonrası
"güncellenmedi" şikâyeti geldiğinde ilk bakılacak yer burasıdır.

## Adımlar

### 1. Neyin yayınlandığını çıkar

```bash
git log --oneline origin/main..HEAD
git status --short
```

Çalışma alanı temiz olmalı. Yayınlanacak commit yoksa dur ve kullanıcıya
söyle — muhtemelen değişiklikler henüz commit edilmemiştir.

### 2. Onay al

Merge dışa dönük ve geri alması zahmetli. Kullanıcıya ne yayınlanacağını
tek cümleyle özetleyip onay iste. Kullanıcı zaten "yayınla" dediyse bu
onaydır, tekrar sorma; belirsizse sor.

### 3. Sürümü artır

```bash
node tools/bump-version.mjs
```

İki dosyayı birlikte günceller ve `YYYY-AA-GG.N` biçiminde numara verir;
aynı gün ikinci yayında `.2` diye devam eder. Belirli bir numara gerekirse
argüman olarak ver: `node tools/bump-version.mjs 2026-09-01.1`.

Kullanılmış bir numarayı tekrar kullanma. Sürüm etiketi kullanıcının
telefonundaki sürümü teşhis etmenin tek yolu; aynı numara iki farklı içeriğe
denk gelirse o teşhis imkânsız hâle gelir.

### 4. Kontrolleri çalıştır

```bash
npm run check && npm test
```

İkisi de geçmeden devam etme. `check` sürüm ayrışmasını, `test` Excel
hücrelerinin doğru dolduğunu doğruluyor. Test düşerse sebebini çöz — testi
geçirmek için beklentiyi gevşetme, çünkü bu testler tam da sessiz bozulmayı
yakalamak için var.

### 5. Commit ve merge

```bash
git add -A && git commit -m "Sürüm <numara>"
git checkout main && git merge --ff-only origin/main
git merge --no-ff <çalışma-dalı> -m "<özet>"
git push -u origin main
git checkout <çalışma-dalı>
```

Çalışma dalına geri dön — sonraki iş yanlışlıkla `main` üzerinde
başlamasın.

### 6. Pages derlemesini bekle

Merge push'landıktan sonra GitHub Actions'ta `pages build and deployment`
çalışması başlar, ~1-2 dakika sürer. Durumu GitHub MCP ile oku:

```
mcp__github__actions_list · method: list_workflow_runs
owner: fahrikar · repo: gunkar-hammadde-siparis · per_page: 1
```

Bu çağrının çıktısı büyük olduğu için araç genelde sonucu bir dosyaya yazıp
yolunu döndürür. Tamamını okumaya çalışma, ilgili alanları ayıkla:

```bash
python3 -c "
import json,sys
d=json.load(open(sys.argv[1]))
r=d['workflow_runs'][0]
print(r.get('name'),r.get('head_sha','')[:7],r.get('status'),r.get('conclusion','(henüz yok)'))
" <dosya-yolu>
```

`conclusion` alanı çalışma bitene kadar **yanıtta hiç bulunmuyor**, o yüzden
`.get()` ile oku — `r['conclusion']` `queued` durumundayken KeyError verir.

`status` `queued` veya `in_progress` ise kısa bir aralık bekleyip tekrar
bak; `head_sha`'nın az önce push'ladığın merge commit'i olduğunu da doğrula,
yoksa bir önceki yayının sonucuna bakıyor olabilirsin. `conclusion`
`success` olana kadar yayın bitmiş sayılmaz.

Yayındaki sayfayı `curl` ile doğrulamayı deneyebilirsin ama bu ortamda
`github.io` çıkışı proxy tarafından engellenebiliyor; engellenirse Actions
sonucu tek doğrulama kaynağıdır, bunu kullanıcıya olduğu gibi söyle.

### 7. Kullanıcıya rapor et

Şunları yaz:

- Yayınlanan sürüm numarası ve ne içerdiği.
- Pages derlemesinin sonucu (`success` ve commit'in kısa sha'sı).
- Telefonda ne yapılacağı: uygulamayı kapatıp açmak yeterli, **silip
  yeniden kurmak gerekmiyor**. Uygulama açıkken yeni sürüm inerse üstte
  "Yeni sürüm hazır · Yenile" çubuğu çıkar.
- Doğrulama yolu: başlıktaki `· s<sürüm>` etiketi yeni numarayı
  gösteriyorsa güncelleme inmiştir.

## Yayın sonrası bir sorun çıkarsa

Sürümü geri çekmenin yolu eski dosyayı geri koyup **yeni bir sürüm
numarasıyla** tekrar yayınlamaktır:

```bash
git revert -m 1 <merge-commit>
node tools/bump-version.mjs
npm run check && npm test
```

Numarayı geri saymaya çalışma. Kullanıcının tarayıcısındaki service worker
"daha yeni mi" diye değil "farklı mı" diye baktığı için ileri gitmek her
zaman güvenli, geri gitmek kafa karıştırıcıdır.

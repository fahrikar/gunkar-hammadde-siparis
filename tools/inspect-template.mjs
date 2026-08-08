/* Şablonun yapısını raporlar — kolon/satır eşlemesini gözle doğrulamak için.

   Kullanım:
     node tools/inspect-template.mjs              # gömülü şablonu inceler
     node tools/inspect-template.mjs YENI.xlsx    # yeni gelen şablonu inceler

   Neden var: tedarikçi yeni şablon gönderdiğinde `xlFillLine` içindeki
   `r=3+i`, `MAX_LINES`, kolon harfleri ve `addDateStyle`'daki xf indeksi
   hâlâ doğru mu bakmak gerekiyor. Bunlar yanlışsa Excel sessizce eksik
   dolar — `xlSet` hücreyi bulamayınca hata vermez. Bu script o dört
   noktayı tek ekranda gösterir; iki çıktıyı (eski/yeni) yan yana koyup
   farkı görmek en hızlı yol. */
import {readFileSync} from "node:fs";
import {loadJSZip, embeddedTemplate, parseSheet, parseSharedStrings, ROOT} from "./lib/xlsx.mjs";
import {join} from "node:path";

const arg=process.argv[2];
const bytes=arg?readFileSync(arg):embeddedTemplate();
const JSZip=loadJSZip();
const zip=await JSZip.loadAsync(bytes);
const read=async p=>zip.file(p)?await zip.file(p).async("string"):null;

console.log(arg?`Şablon: ${arg}`:"Şablon: index.html içine gömülü");
console.log(`Boyut: ${(bytes.length/1024).toFixed(0)} KB\n`);

/* --- sayfalar --- */
const wb=await read("xl/workbook.xml");
const sheets=[...(wb||"").matchAll(/<sheet[^>]*name="([^"]*)"[^>]*r:id="([^"]*)"/g)].map(m=>m[1]);
console.log("Sayfalar: "+sheets.join(" · "));
console.log("(uygulama yalnızca xl/worksheets/sheet1.xml'e yazıyor)\n");

const sst=parseSharedStrings(await read("xl/sharedStrings.xml"));
const xml=await read("xl/worksheets/sheet1.xml");
if(!xml){console.error("xl/worksheets/sheet1.xml yok — uygulama bu şablona yazamaz.");process.exit(1);}
const rows=parseSheet(xml,sst);

/* --- başlık satırları: kolon harfi ↔ alan eşlemesi --- */
console.log("── Başlık satırları (kolon → etiket) ──");
for(const r of rows.slice(0,3)){
  const labeled=r.cells.filter(c=>c.value!=="");
  if(!labeled.length)continue;
  console.log(`satır ${r.row}: `+labeled.map(c=>`${c.col}=${c.value}`).join("  "));
}

/* --- sipariş satırlarının aralığı ---
   Başlık satırını "MÜŞTERİ ADI" etiketinden buluyoruz; sipariş satırları
   hemen altından başlıyor ve uygulamanın yazdığı D kolonu hücresi hazır
   olduğu sürece devam ediyor. */
const headerRow=rows.find(r=>r.cells.some(c=>c.value.trim()==="MÜŞTERİ ADI"));
const has=(r,col)=>r.cells.some(c=>c.col===col);
let firstRow=null,lastRow=null;
if(headerRow){
  firstRow=headerRow.row+1;
  for(const r of rows){
    if(r.row<firstRow)continue;
    if(has(r,"D")&&has(r,"X"))lastRow=r.row;
    else if(lastRow!==null)break;
  }
}
console.log("\n── Hazır sipariş satırları ──");
if(firstRow&&lastRow){
  console.log(`ilk satır: ${firstRow}   son satır: ${lastRow}   kapasite: ${lastRow-firstRow+1}`);
  console.log(`beklenen kod: xlFillLine → const r=${firstRow}+i   ·   MAX_LINES=${lastRow-firstRow+1}`);
}else{
  console.log("otomatik bulunamadı — satırları elle inceleyin.");
}

/* --- ilk sipariş satırındaki hücreler: hangi kolon boş, hangisi formüllü --- */
if(firstRow){
  const r=rows.find(x=>x.row===firstRow);
  console.log(`\n── Satır ${firstRow} hücreleri (kolon:stil) ──`);
  console.log(r.cells.map(c=>`${c.col}:${c.style??"-"}${c.formula?"(f)":""}`).join("  "));
  console.log("(f) = formüllü hücre. Uygulama R/Q'ya düz değer yazıyor;");
  console.log("şablon rilli satırlarda eni SUM(I:P) ile hesapladığı için");
  console.log("ril toplamı = levha eni kuralı buradan geliyor.");
}

/* --- tarih stili: addDateStyle hangi xf'i kopyalıyor --- */
const styles=await read("xl/styles.xml");
const xfs=(styles||"").split("<cellXfs");
const all=xfs[1]?(xfs[1].match(/<xf\b[^>]*?(?:\/>|>[\s\S]*?<\/xf>)/g)||[]):[];
const wCell=firstRow?rows.find(x=>x.row===firstRow)?.cells.find(c=>c.col==="W"):null;
console.log("\n── Tarih biçimi (addDateStyle) ──");
console.log(`cellXfs içindeki xf sayısı: ${all.length}`);
console.log(`W${firstRow??"?"} hücresinin stil indeksi: ${wCell?.style??"(yok)"}`);
console.log("addDateStyle bu indeksteki xf'i kopyalayıp tarih biçimi ekliyor;");
console.log("index.html'deki all[34] bu değere eşit olmalı. Yanlışsa tarih yine");
console.log("doğru yazılır ama hücrenin kenarlığı/fontu şablondan farklı olur.");

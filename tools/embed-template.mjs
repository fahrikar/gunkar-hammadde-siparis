/* Yeni Excel şablonunu index.html'e gömer.

   Kullanım: node tools/embed-template.mjs YENI_SABLON.xlsx

   Elle base64 yapıştırmaya göre farkı: dosyanın gerçekten geçerli bir xlsx
   olduğunu ve uygulamanın yazdığı sayfanın (sheet1) içinde bulunduğunu
   önce doğrular. Yanlış dosya gömülürse uygulama açılışta değil, sipariş
   indirilirken patlar — yani en kötü anda. */
import {readFileSync, writeFileSync} from "node:fs";
import {join} from "node:path";
import {loadJSZip, ROOT} from "./lib/xlsx.mjs";

const src=process.argv[2];
if(!src){
  console.error("Kullanım: node tools/embed-template.mjs YENI_SABLON.xlsx");
  process.exit(1);
}

const bytes=readFileSync(src);
const JSZip=loadJSZip();
let zip;
try{zip=await JSZip.loadAsync(bytes);}
catch{console.error(`${src} bir xlsx (zip) dosyası gibi görünmüyor.`);process.exit(1);}

for(const need of ["xl/worksheets/sheet1.xml","xl/styles.xml","xl/workbook.xml"]){
  if(!zip.file(need)){
    console.error(`Şablonda ${need} yok — uygulama bu dosyaya yazamaz.`);
    process.exit(1);
  }
}

const htmlPath=join(ROOT,"index.html");
const html=readFileSync(htmlPath,"utf8");
const m=html.match(/const TEMPLATE_B64\s*=\s*"([^"]*)"/);
if(!m){console.error("index.html içinde TEMPLATE_B64 bulunamadı.");process.exit(1);}

const b64=bytes.toString("base64");
writeFileSync(htmlPath,html.replace(m[0],`const TEMPLATE_B64="${b64}"`));

const kb=n=>(n/1024).toFixed(0)+" KB";
console.log(`Şablon gömüldü: ${src}`);
console.log(`  eski: ${kb(Buffer.from(m[1],"base64").length)}   yeni: ${kb(bytes.length)}`);
console.log("\nSırada:");
console.log("  1. node tools/inspect-template.mjs   → satır/kolon eşlemesi değişti mi");
console.log("  2. npm run check && npm test         → hücreler hâlâ doğru doluyor mu");

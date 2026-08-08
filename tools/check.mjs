/* Statik kontroller — tarayıcı gerektirmez, saniyeler sürer.
   Çalıştır: npm run check

   1. index.html'in gömülü script'i ve sw.js sözdizimi açısından geçerli mi?
      (Tek dosyalık uygulamada bir yazım hatası sayfayı tamamen boş bırakır.)
   2. index.html'deki APP_VERSION ile sw.js'teki VERSION aynı mı?
      Bu ikisi ayrışırsa güncelleme mekanizması sessizce bozulur: sw.js
      değişmezse tarayıcı yeni sürümü fark etmez, uygulama eski sürümde kalır. */
import {readFileSync} from "node:fs";
import {execFileSync} from "node:child_process";
import {mkdtempSync, writeFileSync} from "node:fs";
import {tmpdir} from "node:os";
import {join, dirname} from "node:path";
import {fileURLToPath} from "node:url";

const ROOT=join(dirname(fileURLToPath(import.meta.url)),"..");
const fails=[];
const ok=m=>console.log("  ok   "+m);
const bad=m=>{fails.push(m);console.log("  HATA "+m);};

const html=readFileSync(join(ROOT,"index.html"),"utf8");
const sw=readFileSync(join(ROOT,"sw.js"),"utf8");
const tmp=mkdtempSync(join(tmpdir(),"gk-check-"));

/* 1 — sözdizimi */
const blocks=[...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m=>m[1]);
if(!blocks.length)bad("index.html içinde gömülü <script> bulunamadı.");
blocks.forEach((code,i)=>{
  const f=join(tmp,`inline-${i}.js`);
  writeFileSync(f,code);
  try{execFileSync(process.execPath,["--check",f],{stdio:"pipe"});ok(`index.html script #${i+1} sözdizimi`);}
  catch(e){bad(`index.html script #${i+1}: ${String(e.stderr||e.message).trim().split("\n")[0]}`);}
});
try{execFileSync(process.execPath,["--check",join(ROOT,"sw.js")],{stdio:"pipe"});ok("sw.js sözdizimi");}
catch(e){bad(`sw.js: ${String(e.stderr||e.message).trim().split("\n")[0]}`);}

/* 2 — sürüm ikilisi */
const appVer=(html.match(/const APP_VERSION\s*=\s*"([^"]+)"/)||[])[1];
const swVer=(sw.match(/const VERSION\s*=\s*"([^"]+)"/)||[])[1];
if(!appVer)bad("index.html içinde APP_VERSION bulunamadı.");
else if(!swVer)bad("sw.js içinde VERSION bulunamadı.");
else if(appVer!==swVer)
  bad(`sürümler ayrışmış: index.html APP_VERSION="${appVer}", sw.js VERSION="${swVer}". `
     +"Yeni sürüm yayınlarken ikisi birlikte artırılmalı, yoksa uygulama kendini güncellemez.");
else ok(`sürüm ikilisi tutarlı (${appVer})`);

/* 3 — service worker'ın ön yüklediği dosyalar gerçekten var mı? */
const assets=(sw.match(/const ASSETS\s*=\s*\[([^\]]*)\]/)||["",""])[1]
  .split(",").map(s=>s.trim().replace(/^["']|["']$/g,"")).filter(s=>s&&s!=="./");
for(const a of assets){
  try{readFileSync(join(ROOT,a));ok(`sw.js ön yükleme: ${a}`);}
  catch{bad(`sw.js ASSETS içindeki ${a} repoda yok — kurulum sırasında önbellek eksik kalır.`);}
}

/* 4 — satır içi onclick'ler gerçek bir fonksiyona bağlı mı?
   Arayüz baştan sona onclick="fn()" ile kurulu. Bir fonksiyon yeniden
   adlandırıldığında tarayıcı sessiz kalmaz ama hatayı ancak o düğmeye basan
   görür; burada erken yakalanır. */
const script=blocks.join("\n");
const defined=new Set([...script.matchAll(/\bfunction\s+([A-Za-z_$][\w$]*)\s*\(/g)].map(m=>m[1]));
const called=new Set([...html.matchAll(/\bon\w+="\s*([A-Za-z_$][\w$]*)\s*\(/g)].map(m=>m[1]));
const missing=[...called].filter(n=>!defined.has(n));
if(missing.length)bad(`HTML'deki onclick şu fonksiyonlara bakıyor ama tanımlı değiller: ${missing.join(", ")}`);
else ok(`satır içi olay bağlantıları (${called.size} fonksiyon) tanımlı`);

/* 5 — ana ekran kurulumu: manifest ve ikonlar tutarlı mı?
   Manifest bozulursa uygulama ana ekrana "tarayıcı kısayolu" olarak eklenir;
   hiçbir hata çıkmaz, sadece tam ekran açılmaz. */
if(!/<link[^>]+rel="manifest"/.test(html))bad("index.html içinde <link rel=\"manifest\"> yok.");
else ok("index.html manifest'e bağlı");
let manifest=null;
try{manifest=JSON.parse(readFileSync(join(ROOT,"manifest.webmanifest"),"utf8"));ok("manifest.webmanifest okunabiliyor");}
catch(e){bad(`manifest.webmanifest okunamadı: ${e.message}`);}
if(manifest){
  for(const key of ["name","start_url","display","icons"])
    if(!manifest[key])bad(`manifest.webmanifest içinde ${key} yok.`);
  for(const ic of manifest.icons||[]){
    try{readFileSync(join(ROOT,ic.src));}
    catch{bad(`manifest'teki ikon repoda yok: ${ic.src}`);}
  }
  if(!(manifest.icons||[]).some(i=>String(i.purpose||"").includes("maskable")))
    bad("manifest'te maskable ikon yok — Android'de simge beyaz kutu içinde görünür.");
  ok("manifest ikonları yerinde");
}
const appleIcon=(html.match(/rel="apple-touch-icon"[^>]*href="([^"]+)"/)||[])[1];
if(!appleIcon)bad("apple-touch-icon yok — iPhone ana ekranında simge boş çıkar.");
else{
  try{readFileSync(join(ROOT,appleIcon));ok(`apple-touch-icon: ${appleIcon}`);}
  catch{bad(`apple-touch-icon dosyası repoda yok: ${appleIcon}`);}
}

console.log(fails.length?`\n${fails.length} kontrol başarısız.`:"\nTüm kontroller geçti.");
process.exit(fails.length?1:0);

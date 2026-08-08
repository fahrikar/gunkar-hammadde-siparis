/* Tarayıcı smoke testi — gerçek Chromium'da uçtan uca akış.
   Çalıştır: npm test

   Neyi koruyor: bu uygulamada hatalar sessiz. xlSet hücreyi bulamazsa hata
   vermez, sadece o veriyi yazmaz; yani şablon eşlemesi bozulduğunda Excel
   eksik doluyor ve kimse fark etmiyor. Bu test hücre değerlerini tek tek
   okuyarak o sessizliği bozar.

   Sayfa http üzerinden sunulur: service worker file:// ile çalışmaz. */
import {createServer} from "node:http";
import {readFile, readdir} from "node:fs/promises";
import {existsSync} from "node:fs";
import {join, extname, dirname} from "node:path";
import {fileURLToPath} from "node:url";
import {chromium} from "playwright-core";

const ROOT=join(dirname(fileURLToPath(import.meta.url)),"..");
const TYPES={".html":"text/html; charset=utf-8",".js":"text/javascript; charset=utf-8",
             ".json":"application/json",".md":"text/markdown; charset=utf-8"};

let failed=0;
function check(name,cond,detail){
  if(cond)console.log("  ok   "+name);
  else{failed++;console.log("  HATA "+name+(detail!==undefined?` → ${detail}`:""));}
}

/* Chromium'u bulur: ortam değişkeni → hazır kurulum → playwright'ın kendi yolu. */
async function findChromium(){
  if(process.env.CHROME_PATH)return process.env.CHROME_PATH;
  const base=process.env.PLAYWRIGHT_BROWSERS_PATH||"/opt/pw-browsers";
  if(existsSync(base)){
    const dirs=(await readdir(base)).filter(d=>d.startsWith("chromium-")).sort().reverse();
    for(const d of dirs){
      const p=join(base,d,"chrome-linux","chrome");
      if(existsSync(p))return p;
    }
  }
  try{const p=chromium.executablePath();if(p&&existsSync(p))return p;}catch{}
  return null;
}

function serve(){
  const srv=createServer(async(req,res)=>{
    let p=decodeURIComponent(new URL(req.url,"http://x").pathname);
    if(p.endsWith("/"))p+="index.html";
    try{
      const body=await readFile(join(ROOT,p));
      /* Gerçek sunucudaki gibi ETag yerine no-cache: test önbelleğe takılmasın. */
      res.writeHead(200,{"Content-Type":TYPES[extname(p)]||"application/octet-stream",
                         "Cache-Control":"no-cache"});
      res.end(body);
    }catch{res.writeHead(404).end("yok");}
  });
  return new Promise(r=>srv.listen(0,"127.0.0.1",()=>r({srv,port:srv.address().port})));
}

const exe=await findChromium();
if(!exe){
  console.error("Chromium bulunamadı. CHROME_PATH ile yol verin veya bir Chromium kurun.");
  process.exit(1);
}

const {srv,port}=await serve();
const origin=`http://127.0.0.1:${port}`;
const ctx=await chromium.launchPersistentContext(
  join(process.env.TMPDIR||"/tmp","gk-smoke-profile"),
  {executablePath:exe,args:["--no-sandbox"],headless:true});
const page=await ctx.newPage();
const pageErrors=[];
page.on("pageerror",e=>pageErrors.push(e.message));

try{
  await page.goto(origin+"/");
  await page.evaluate(()=>localStorage.clear());
  await page.reload();

  /* --- 1. küsüratlı ölçü girişi (virgül) --- */
  const kalite=await page.$$eval("#kalite option",o=>o.map(x=>x.value).filter(v=>v&&v!=="__custom"));
  await page.selectOption("#kalite",kalite[0]);
  await page.selectOption("#rilTipi","NORMAL OFFSET");
  /* Sekiz kutu da dolduruluyor: I–P kolon eşlemesinin tamamı sınansın. */
  const rils=["150,25","150,1","150,1","150,1","150,1","150,1","150","200"]; // toplam 1250,75
  for(let i=0;i<rils.length;i++)
    await page.fill(`.rils .cell:nth-child(${i+1}) input`,rils[i]);
  await page.fill("#levhaBoy","1600,5");
  check("ril toplamı küsüratla hesaplanıyor",
    (await page.textContent("#rilSumHint")).includes("1.250,75"),
    await page.textContent("#rilSumHint"));

  await page.click("#rilSumHint");                         // "eni eşitle" kısayolu
  check("eni eşitle küsüratı koruyor",
    (await page.inputValue("#levhaEn"))==="1250,75",
    await page.inputValue("#levhaEn"));
  check("küsüratlı satır geçerli sayılıyor",
    (await page.textContent("#lineMsg")).includes("geçerli"),
    (await page.textContent("#lineMsg")).trim());

  await page.click('button:has-text("Satırı ekle")');
  check("satır listeye eklendi",(await page.$$("#lineBody tr")).length===1);

  /* --- 2. nokta ile de girilebiliyor (RİLSİZ) --- */
  await page.selectOption("#kalite",kalite[0]);
  await page.selectOption("#rilTipi","RİLSİZ");
  await page.fill("#levhaEn","1250.75");
  await page.fill("#levhaBoy","1600.5");
  check("nokta da ondalık ayırıcı",
    (await page.textContent("#pvEn")).includes("1.250,75"),
    await page.textContent("#pvEn"));
  await page.click('button:has-text("Satırı ekle")');
  check("RİLSİZ satır eklendi",(await page.$$("#lineBody tr")).length===2);

  /* --- 3. kurallar hâlâ işliyor ---
     Satır eklenince form temizlendiği için ril kutuları yeniden doldurulur. */
  await page.selectOption("#kalite",kalite[0]);
  await page.selectOption("#rilTipi","NORMAL OFFSET");
  await page.fill(".rils .cell:nth-child(1) input","600,5");
  await page.fill(".rils .cell:nth-child(2) input","650,25"); // toplam 1250,75
  await page.fill("#levhaEn","1000");                         // toplamla uyuşmuyor
  await page.fill("#levhaBoy","1600");
  check("ril toplamı ≠ levha eni yakalanıyor",
    (await page.textContent("#lineMsg")).includes("eşit olmalı"),
    (await page.textContent("#lineMsg")).trim());
  await page.fill("#levhaEn","abc");
  check("sayı olmayan ölçü yakalanıyor",
    (await page.textContent("#lineMsg")).includes("yalnızca sayı"),
    (await page.textContent("#lineMsg")).trim());

  /* --- 4. Excel çıktısı: hücreler doğru dolmuş mu --- */
  const cells=await page.evaluate(async()=>{
    const ls=JSON.parse(localStorage.getItem("gk_lines"));
    const zip=await JSZip.loadAsync(b64ToBytes(TEMPLATE_B64));
    let xml=await zip.file("xl/worksheets/sheet1.xml").async("string");
    const h={musteri:"TEST AŞ",sevk:"ADANA",vade:"60 gün",tarih:"2026-08-07"};
    ls.forEach((l,i)=>{xml=xlFillLine(xml,i,l,h,null);});
    const get=ref=>{
      const m=xml.match(new RegExp('<c r="'+ref+'"[^>]*?(?:/>|>([\\s\\S]*?)</c>)'));
      if(!m)return null;
      const v=m[0].match(/<v>([^<]*)<\/v>/);
      const t=m[0].match(/<t[^>]*>([^<]*)<\/t>/);
      return v?v[1]:(t?t[1]:"");
    };
    const rilCells="IJKLMNOP".split("").map(c=>get(c+"3"));
    return {rilCells,Q3:get("Q3"),R3:get("R3"),
            S3:get("S3"),X3:get("X3"),D3:get("D3"),H3:get("H3"),
            I4:get("I4"),Q4:get("Q4"),R4:get("R4")};
  });
  check("sekiz ril kolonu da küsüratla yazılıyor (I3–P3)",
    JSON.stringify(cells.rilCells)===
      JSON.stringify(["150.25","150.1","150.1","150.1","150.1","150.1","150","200"]),
    JSON.stringify(cells.rilCells));
  check("levha en/boy hücreleri (R3/S3)",
    cells.R3==="1250.75"&&cells.S3==="1600.5",JSON.stringify([cells.R3,cells.S3]));
  check("rilli satırda Q boş kalıyor",cells.Q3==="",JSON.stringify(cells.Q3));
  check("metin hücreleri (D3/H3)",
    cells.D3==="TEST AŞ"&&cells.H3==="NORMAL OFFSET",JSON.stringify([cells.D3,cells.H3]));
  check("adet hücresi (X3)",cells.X3==="250",cells.X3);
  check("RİLSİZ satırda en Q'ya da yazılıyor, ril hücresi boş",
    cells.Q4==="1250.75"&&cells.R4==="1250.75"&&cells.I4==="",
    JSON.stringify([cells.Q4,cells.R4,cells.I4]));

  /* --- 5. service worker: devralıyor ve çevrimdışı çalışıyor --- */
  await page.waitForFunction(()=>navigator.serviceWorker.controller!==null,null,{timeout:20000});
  check("service worker sayfayı devraldı",true);
  await ctx.setOffline(true);
  await page.reload();
  check("çevrimdışı açılıyor",await page.isVisible("#levhaEn"));
  check("çevrimdışı satırlar duruyor",(await page.$$("#lineBody tr")).length===2);
  await ctx.setOffline(false);

  check("sayfada JS hatası yok",pageErrors.length===0,pageErrors.join(" | "));
}catch(e){
  failed++;
  console.log("  HATA test çalışırken istisna → "+e.message);
}finally{
  await ctx.close();
  srv.close();
}

console.log(failed?`\n${failed} kontrol başarısız.`:"\nSmoke testi geçti.");
process.exit(failed?1:0);

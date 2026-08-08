/* Şablonu node tarafında okumak için ortak yardımcılar.

   JSZip repoda tarayıcı için duruyor (UMD paketi). package.json "type":"module"
   olduğu için doğrudan import edilemiyor; vm ile kendi bağlamında çalıştırıp
   dışa verdiği nesneyi alıyoruz. Böylece tarayıcıdaki ile birebir aynı
   kütüphane kullanılıyor, ikinci bir zip bağımlılığı gerekmiyor. */
import {readFileSync} from "node:fs";
import {join, dirname} from "node:path";
import {fileURLToPath} from "node:url";
import vm from "node:vm";

export const ROOT=join(dirname(fileURLToPath(import.meta.url)),"..","..");

export function loadJSZip(){
  const src=readFileSync(join(ROOT,"jszip.min.js"),"utf8");
  const sandbox={module:{exports:{}},setTimeout,clearTimeout,console,Buffer,process,
                 TextDecoder,TextEncoder,Promise,Date,Math,JSON};
  sandbox.exports=sandbox.module.exports;
  sandbox.window=sandbox;sandbox.self=sandbox;sandbox.globalThis=sandbox;
  vm.createContext(sandbox);
  vm.runInContext(src,sandbox);
  const z=sandbox.module.exports;
  if(!z||!z.version)throw new Error("jszip.min.js yüklenemedi.");
  return z;
}

/* index.html'e gömülü şablonu bayt dizisi olarak döndürür. */
export function embeddedTemplate(){
  const html=readFileSync(join(ROOT,"index.html"),"utf8");
  const m=html.match(/const TEMPLATE_B64\s*=\s*"([^"]+)"/);
  if(!m)throw new Error("index.html içinde TEMPLATE_B64 bulunamadı.");
  return Buffer.from(m[1],"base64");
}

/* sheet1.xml'i satır/hücre yapısına çevirir. Değerler shared string ve
   inlineStr dahil çözülür; stil indeksi (s) korunur çünkü tarih biçimi
   eklerken (addDateStyle) hangi xf'in kopyalandığı buna bakıyor. */
export function parseSheet(xml,sharedStrings){
  const rows=[];
  for(const rm of xml.matchAll(/<row[^>]*\br="(\d+)"[^>]*>([\s\S]*?)<\/row>/g)){
    const cells=[];
    /* Kendinden kapanan hücre önce denenmeli: `<c r="D3" s="52"/>` açık etiket
       gibi eşleşirse sonraki </c>'ye kadarki bütün hücreleri yutar. */
    for(const cm of rm[2].matchAll(/<c\b([^>]*?)\/>|<c\b([^>]*?)>([\s\S]*?)<\/c>/g)){
      const attrs=cm[1]??cm[2]??"";
      const inner=cm[3]??"";
      const ref=(attrs.match(/r="([^"]+)"/)||[])[1];
      const style=(attrs.match(/s="(\d+)"/)||[])[1];
      const type=(attrs.match(/t="([^"]+)"/)||[])[1];
      let value="";
      const v=inner.match(/<v>([^<]*)<\/v>/);
      const t=inner.match(/<t[^>]*>([^<]*)<\/t>/);
      if(type==="s"&&v)value=sharedStrings[+v[1]]??"";
      else if(t)value=t[1];
      else if(v)value=v[1];
      cells.push({ref,col:(ref||"").replace(/\d+/g,""),style,type,value,
                  formula:/<f[ >]/.test(inner)});
    }
    rows.push({row:+rm[1],cells});
  }
  return rows;
}

export function parseSharedStrings(xml){
  if(!xml)return [];
  return [...xml.matchAll(/<si>([\s\S]*?)<\/si>/g)]
    .map(m=>[...m[1].matchAll(/<t[^>]*>([^<]*)<\/t>/g)].map(t=>t[1]).join(""));
}

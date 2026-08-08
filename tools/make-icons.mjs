/* Ana ekran ikonlarını üretir — bağımlılıksız PNG yazıcı.

   Kullanım: npm run ikon

   Neden script: uygulama ana ekrana eklenip "gerçek uygulama" gibi açılsın
   diye manifest ve ikon gerekiyor, ama repoya ikili dosya atıp kaynağını
   kaybetmek istemiyoruz. İkon burada koddan çiziliyor; rengi ya da biçimi
   değişince dosyalar yeniden üretilebilir.

   Çizim: oluklu mukavvanın kesiti — iki düz astar arasında bir oluk dalgası.
   Üretilen dosyalar: icon-192.png, icon-512.png, icon-maskable-512.png */
import {writeFileSync} from "node:fs";
import {deflateSync} from "node:zlib";
import {join} from "node:path";
import {ROOT} from "./lib/xlsx.mjs";

const BG=[0x1a,0x3a,0x2a];     // --navy
const FG=[0xc8,0xa8,0x4b];     // --yellow

/* ---------- PNG yazıcı (truecolor, filtre yok) ---------- */
const CRC_TABLE=(()=>{
  const t=new Int32Array(256);
  for(let n=0;n<256;n++){
    let c=n;
    for(let k=0;k<8;k++)c=(c&1)?(0xedb88320^(c>>>1)):(c>>>1);
    t[n]=c;
  }
  return t;
})();
function crc32(buf){
  let c=-1;
  for(let i=0;i<buf.length;i++)c=CRC_TABLE[(c^buf[i])&0xff]^(c>>>8);
  return (c^-1)>>>0;
}
function chunk(type,data){
  const len=Buffer.alloc(4);len.writeUInt32BE(data.length);
  const body=Buffer.concat([Buffer.from(type,"latin1"),data]);
  const crc=Buffer.alloc(4);crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len,body,crc]);
}
function encodePng(w,h,rgb){
  const raw=Buffer.alloc(h*(1+w*3));
  for(let y=0;y<h;y++){
    raw[y*(1+w*3)]=0;                                  // filtre: None
    rgb.copy(raw,y*(1+w*3)+1,y*w*3,(y+1)*w*3);
  }
  const ihdr=Buffer.alloc(13);
  ihdr.writeUInt32BE(w,0);ihdr.writeUInt32BE(h,4);
  ihdr[8]=8;ihdr[9]=2;ihdr[10]=0;ihdr[11]=0;ihdr[12]=0; // 8 bit, truecolor
  return Buffer.concat([
    Buffer.from([0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a]),
    chunk("IHDR",ihdr),
    chunk("IDAT",deflateSync(raw,{level:9})),
    chunk("IEND",Buffer.alloc(0))
  ]);
}

/* ---------- çizim ----------
   content: ikonun kenarına göre çizimin kapladığı oran. Maskelenebilir
   ikonda güvenli alan dairesi ikonun %80'i olduğu için oran küçültülür. */
function drawIcon(size,content){
  const SS=3, N=size*SS;                                // kenar yumuşatma için 3× örnekleme
  const acc=new Float64Array(N*N);                      // 0 = astar/dalga yok, 1 = var
  const w=N*content, cx=N/2, cy=N/2;
  const h=w*0.66;                                       // çizimin yüksekliği
  const t=w*0.10;                                       // astar ve dalga kalınlığı
  const gap=w*0.05;                                     // astar ile dalga arası boşluk
  const x0=cx-w/2, x1=cx+w/2;
  const topY=cy-h/2+t/2, botY=cy+h/2-t/2;               // astarların orta çizgisi
  const amp=h/2-t-gap-t/2;                              // dalga genliği
  const k=2.5;                                          // görünen oluk sayısı (tam periyot)
  const wk=2*Math.PI*k/w;

  /* astarlar: uçları yuvarlak iki yatay çubuk (nokta–doğru parçası uzaklığı) */
  for(let py=0;py<N;py++){
    for(let px=0;px<N;px++){
      if(px<x0-t||px>x1+t)continue;
      const x=px+0.5, y=py+0.5;
      const xc=Math.min(Math.max(x,x0+t/2),x1-t/2);
      if(Math.hypot(x-xc,y-topY)<=t/2||Math.hypot(x-xc,y-botY)<=t/2)acc[py*N+px]=1;
    }
  }
  /* dalga: eğri boyunca yuvarlak fırça izi bırakılır. Sinüse "dikey uzaklık"
     ile yaklaşmak dik bölümlerde çizgiyi inceltip uçlarda sivrilik bırakıyor;
     disk basmak her yerde eşit kalınlık verir. */
  const r=t/2, steps=Math.ceil((x1-x0)*4);
  for(let s=0;s<=steps;s++){
    const x=x0+(x1-x0)*s/steps;
    const y=cy+amp*Math.sin(wk*(x-x0));
    const pxa=Math.max(0,Math.floor(x-r)), pxb=Math.min(N-1,Math.ceil(x+r));
    const pya=Math.max(0,Math.floor(y-r)), pyb=Math.min(N-1,Math.ceil(y+r));
    for(let py=pya;py<=pyb;py++){
      const dy=py+0.5-y, row=py*N;
      const half=Math.sqrt(Math.max(0,r*r-dy*dy));
      const a=Math.max(pxa,Math.ceil(x-half-0.5)), b=Math.min(pxb,Math.floor(x+half-0.5));
      for(let px=a;px<=b;px++)acc[row+px]=1;
    }
  }

  /* SS×SS bloklarını ortalayarak indir — kenarlar yumuşar */
  const out=Buffer.alloc(size*size*3);
  for(let y=0;y<size;y++){
    for(let x=0;x<size;x++){
      let s=0;
      for(let j=0;j<SS;j++)for(let i=0;i<SS;i++)s+=acc[(y*SS+j)*N+(x*SS+i)];
      const a=s/(SS*SS), o=(y*size+x)*3;
      for(let c=0;c<3;c++)out[o+c]=Math.round(BG[c]+(FG[c]-BG[c])*a);
    }
  }
  return encodePng(size,size,out);
}

/* Aynı çizimin vektör hâli — sekme simgesi ve büyük ekranlar için.
   Sinüs, yuvarlak uçlu tek bir çizgi olarak örneklenip yazılır: her ölçekte
   pürüzsüz görünür, PNG'lerle birebir aynı biçimi taşır. */
function drawSvg(size,content){
  const hex=c=>"#"+c.map(v=>v.toString(16).padStart(2,"0")).join("");
  const w=size*content, cx=size/2, cy=size/2;
  const h=w*0.66, t=w*0.10, gap=w*0.05;
  const x0=cx-w/2, x1=cx+w/2;
  const topY=cy-h/2+t/2, botY=cy+h/2-t/2;
  const amp=h/2-t-gap-t/2, wk=2*Math.PI*2.5/w;
  const n=(v)=>Math.round(v*100)/100;
  const pts=[];
  for(let s=0;s<=72;s++){
    const x=x0+(x1-x0)*s/72;
    pts.push(`${n(x)},${n(cy+amp*Math.sin(wk*(x-x0)))}`);
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" width="${size}" height="${size}">
<title>Günkar Sipariş</title>
<rect width="${size}" height="${size}" fill="${hex(BG)}"/>
<g fill="none" stroke="${hex(FG)}" stroke-width="${n(t)}" stroke-linecap="round" stroke-linejoin="round">
<path d="M${n(x0+t/2)},${n(topY)}H${n(x1-t/2)}"/>
<path d="M${n(x0+t/2)},${n(botY)}H${n(x1-t/2)}"/>
<polyline points="${pts.join(" ")}"/>
</g>
</svg>
`;
}

const files=[
  ["icon-192.png",192,0.70],
  ["icon-512.png",512,0.70],
  ["icon-maskable-512.png",512,0.52]   // güvenli alan: ikonun ortadaki %80'i
];
for(const [name,size,content] of files){
  const buf=drawIcon(size,content);
  writeFileSync(join(ROOT,name),buf);
  console.log(`  ${name}  ${size}×${size}  ${(buf.length/1024).toFixed(1)} kB`);
}
const svg=drawSvg(512,0.70);
writeFileSync(join(ROOT,"icon.svg"),svg);
console.log(`  icon.svg  vektör  ${(Buffer.byteLength(svg)/1024).toFixed(1)} kB`);
console.log("\nİkonlar üretildi. manifest.webmanifest bu dosyalara işaret ediyor.");

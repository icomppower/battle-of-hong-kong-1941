/* =====================================================================
 *  app.js  —  Battle of Hong Kong 1941 · interactive 3D documentary
 *  REAL terrain: AWS Terrarium DEM + EOX Sentinel-2 cloudless 2016, Web-Mercator,
 *  to scale. Reads window.BATTLE_DATA (real lng/lat). Three.js r128.
 *  Sections: CONFIG · bootstrap · projection · tiles · terrain · sky
 *  · labels · crests · units · arrows · front · effects · weather
 *  · clock · camera · UI · loop
 * ===================================================================== */
(function () {
"use strict";

/* ---- fail loudly, never silently (Philosophy: No Fallback) -------- */
function fatal(e){
  const el=document.getElementById("err");
  el.style.display="block";
  el.textContent="⚠ 初始化失敗 / Initialization error:\n\n"+(e&&e.stack?e.stack:e)+
    "\n\n（本作需以本機伺服器開啟：執行 `node tools/serve.js` 後開 http://localhost:5050 ，"+
    "或用內建預覽。直接以 file:// 開啟會因瀏覽器安全限制無法讀取地形瓦片。）";
  const boot=document.getElementById("boot"); if(boot) boot.classList.add("gone");
  console.error(e);
}
window.addEventListener("error", ev=>fatal(ev.error||ev.message));

try {
  if(typeof THREE==="undefined") throw new Error("THREE 未載入 (lib/three.min.js)");
  if(!THREE.OrbitControls) throw new Error("OrbitControls 未載入");
  if(!THREE.CSS2DRenderer) throw new Error("CSS2DRenderer 未載入");
  if(!window.BATTLE_DATA) throw new Error("BATTLE_DATA 未載入 (data.js)");
}catch(e){ fatal(e); return; }

const D = window.BATTLE_DATA;
const bootMsg = t => { const m=document.getElementById("boot-msg"); if(m) m.textContent=t; };

/* ========================= CONFIG ================================== */
const CFG = {
  GEO:{ minLng:113.88, maxLng:114.32, minLat:22.16, maxLat:22.57, Z:13 }, // == tools/fetch_tiles.ps1
  TARGET_UNITS: 2000,   // world width of the map (height derived → to scale)
  VEXAG: 2.0,           // vertical exaggeration (Y only; XZ stays true to scale)
  TERR_SEG: 420,        // terrain mesh resolution
  SSAA: 1.4,            // supersample factor → render above display res to calm terrain/coastline texture aliasing under the orbit (capped so retina never regresses)
  // archival film grade on the (present-day) satellite imagery — ages modern colour cues toward
  // period footage so the anachronism is disguised. Noise floor: saturation ≥0.55, vignette ≤0.5
  // so the battle area (image centre) stays legible.
  GRADE:{ filter:"sepia(0.32) saturate(0.6) contrast(1.05) brightness(0.97)", vignette:0.42, grain:0.045 },
  DAY_MIN: 8, DAY_MAX: 25.5,
  TWEEN: 2.4,            // camera move duration between shots (s)
  ZOOM: 0.45,           // multiplies each shot's camera distance → tighter framing on the action
  FOCUS:{ UNIT_DIM:0.12, PLACE_NEAR:300, PLACE_FAR:950, MAX_PLACES:6 }, // show only the nearest few place names
  FLASH_K: 0.26,        // muzzle/explosion flash-light dampening (was blowing out the scene)
  // entity scale (tuned to the ~2000-unit metric extent)
  FLAG_H: 30, FLAG_W: 26, FLAG_TH: 16,   // shorter staff + smaller cloth → less "stadium banner / km-pole" clash
  RING_IN: 5, RING_OUT: 8, TOKEN_R: 6.5, TOKEN_H: 7, POLE_R: 0.6, FINIAL_R: 1.2,   // TOKEN_R kept → wedge footprint unchanged
  LBL_REGION: 80, LBL_PEAK: 44, LBL_TOWN: 34, LBL_FORT: 38, LBL_UNIT: 34,
  EU: 5.0,              // effect spatial unit
  GLOW_PSCALE: 400,     // bright additive points (smaller → less glare)
  SMOKE_PSCALE: 340,    // smoke kept modest so it reads as a column, not a dark canopy
};
const FAC = {
  jp:{ main:0xe23b3b, glow:0xff6a5a, dim:0x7a1f1f, css:"#e23b3b" },
  uk:{ main:0x3b7be2, glow:0x5aa0ff, dim:0x1f3f7a, css:"#3b7be2" },
};
const REDUCE_MOTION = !!(window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches);  // honour the OS "reduce motion" preference → drop the cinematic auto-orbit

/* ---- small math --------------------------------------------------- */
const clamp=(v,a,b)=>v<a?a:v>b?b:v;
const lerp=(a,b,t)=>a+(b-a)*t;
const smooth=(e0,e1,x)=>{ const t=clamp((x-e0)/(e1-e0||1e-6),0,1); return t*t*(3-2*t); };
const easeIO=t=>t<0.5?4*t*t*t:1-Math.pow(-2*t+2,3)/2;
const deg=Math.PI/180;

/* ========================= BOOTSTRAP =============================== */
const scene = new THREE.Scene();
scene.fog = new THREE.FogExp2(0x9fb3c4, 0.00018);

const camera = new THREE.PerspectiveCamera(50, innerWidth/innerHeight, 10, 16000);   // near=10 (not 1): a tiny near plane wrecks z-precision at distance → the translucent sea's depth-test twinkles under the wide-shot orbit

const renderer = new THREE.WebGLRenderer({antialias:true, powerPreference:"high-performance", preserveDrawingBuffer:true});
renderer.setPixelRatio(Math.min(devicePixelRatio*CFG.SSAA, 2));   // supersample (capped at 2 → no retina regression)
renderer.setSize(innerWidth, innerHeight);
renderer.outputEncoding = THREE.sRGBEncoding;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;   // static self-shadowing → terrain relief form
document.getElementById("scene").appendChild(renderer.domElement);

const labelRenderer = new THREE.CSS2DRenderer();
labelRenderer.setSize(innerWidth, innerHeight);
labelRenderer.domElement.style.position="absolute";
labelRenderer.domElement.style.top="0";
labelRenderer.domElement.style.pointerEvents="none";
document.getElementById("labels").appendChild(labelRenderer.domElement);

const controls = new THREE.OrbitControls(camera, renderer.domElement);
controls.enableDamping=true; controls.dampingFactor=0.08;
controls.minDistance=90; controls.maxDistance=6500;
controls.maxPolarAngle=Math.PI*0.495;

const sun = new THREE.DirectionalLight(0xfff1d6, 1.1);
sun.position.set(900, 1500, 700); scene.add(sun);
const hemi = new THREE.HemisphereLight(0xbfd4ea, 0x35422f, 0.55); scene.add(hemi);
const amb = new THREE.AmbientLight(0x404a55, 0.5); scene.add(amb);

addEventListener("resize", ()=>{
  camera.aspect=innerWidth/innerHeight; camera.updateProjectionMatrix();
  renderer.setSize(innerWidth,innerHeight);
  labelRenderer.setSize(innerWidth,innerHeight);
});

/* ===================== PROJECTION (Web Mercator) ================== *
 *  Filled by loadTiles(); project()/sampleHeight() are the SSOT for
 *  lng/lat → world and for terrain elevation.
 * ---------------------------------------------------------------- */
const RE = 6378137;
const lng2mx = l => RE*l*deg;
const lat2my = la => RE*Math.log(Math.tan(Math.PI/4 + la*deg/2));
const lng2tx = (l,z)=>Math.floor((l+180)/360*Math.pow(2,z));
const lat2ty = (la,z)=>{ const r=la*deg; return Math.floor((1-Math.log(Math.tan(r)+1/Math.cos(r))/Math.PI)/2*Math.pow(2,z)); };
const tx2lng = (x,z)=>x/Math.pow(2,z)*360-180;
const ty2lat = (y,z)=>{ const n=Math.PI-2*Math.PI*y/Math.pow(2,z); return Math.atan(Math.sinh(n))/deg; };

let MX0,MX1,MYN,MYS,M2U,MAPW,MAPD;            // mercator bounds + scale
let demW,demH,heightData=null;                 // composed DEM
let imageryTex=null;

function project(lng,lat){ return { X:(lng2mx(lng)-MX0)*M2U-MAPW/2, Z:(MYN-lat2my(lat))*M2U-MAPD/2 }; }
function sampleHeightPx(u,v){
  const fx=clamp(u,0,1)*(demW-1), fy=clamp(v,0,1)*(demH-1);
  const x0=Math.floor(fx), y0=Math.floor(fy), x1=Math.min(x0+1,demW-1), y1=Math.min(y0+1,demH-1);
  const tx=fx-x0, ty=fy-y0;
  const a=heightData[y0*demW+x0], b=heightData[y0*demW+x1], c=heightData[y1*demW+x0], d=heightData[y1*demW+x1];
  return (a*(1-tx)+b*tx)*(1-ty)+(c*(1-tx)+d*tx)*ty;
}
function sampleHeight(lng,lat){
  return sampleHeightPx((lng2mx(lng)-MX0)/(MX1-MX0), (MYN-lat2my(lat))/(MYN-MYS));
}
function groundY(lng,lat){ return Math.max(sampleHeight(lng,lat)*M2U*CFG.VEXAG, 0); }
function vec(lng,lat,yOff){ const p=project(lng,lat); return new THREE.Vector3(p.X, groundY(lng,lat)+(yOff||0), p.Z); }

/* ===================== TILE LOADING / COMPOSITING ================= */
function loadImg(src){ return new Promise((res,rej)=>{ const im=new Image();
  im.onload=()=>res(im); im.onerror=()=>rej(new Error("地形瓦片載入失敗 / tile failed to load: "+src)); im.src=src; }); }

async function loadTiles(){
  const g=CFG.GEO, z=g.Z;
  const x0=lng2tx(g.minLng,z), x1=lng2tx(g.maxLng,z);
  const y0=lat2ty(g.maxLat,z), y1=lat2ty(g.minLat,z);   // north has smaller y
  const nx=x1-x0+1, ny=y1-y0+1;
  // mercator bounds from tile-grid edges (so geometry aligns to imagery)
  MX0=lng2mx(tx2lng(x0,z));   MX1=lng2mx(tx2lng(x1+1,z));
  MYN=lat2my(ty2lat(y0,z));   MYS=lat2my(ty2lat(y1+1,z));
  M2U=CFG.TARGET_UNITS/(MX1-MX0); MAPW=(MX1-MX0)*M2U; MAPD=(MYN-MYS)*M2U;

  // --- DEM → heightData ---
  bootMsg("載入真實地形高程 (DEM)…");
  const dem=document.createElement("canvas"); dem.width=nx*256; dem.height=ny*256;
  const dctx=dem.getContext("2d",{willReadFrequently:true});
  dctx.fillStyle="rgb(128,0,0)"; dctx.fillRect(0,0,dem.width,dem.height);   // 0 m baseline → a missing DEM tile reads as sea level, not a -32768 m pit
  const total=nx*ny; let demFail=0, imgFail=0;
  const demJobs=[];
  for(let x=x0;x<=x1;x++) for(let y=y0;y<=y1;y++)
    demJobs.push(loadImg(`lib/tiles/dem/${z}_${x}_${y}.png`).then(im=>dctx.drawImage(im,(x-x0)*256,(y-y0)*256)).catch(()=>{demFail++;}));
  await Promise.all(demJobs);   // each job resolves (catch swallows the reject) → one missing tile no longer aborts the whole mosaic
  demW=dem.width; demH=dem.height;
  const px=dctx.getImageData(0,0,demW,demH).data;
  heightData=new Float32Array(demW*demH);
  for(let i=0;i<heightData.length;i++){ const j=i*4;
    heightData[i]=(px[j]*256 + px[j+1] + px[j+2]/256) - 32768; }

  // --- imagery → texture (graded for a documentary look) ---
  bootMsg("載入衛星影像…");
  const maxT=renderer.capabilities.maxTextureSize||4096;
  const nativeW=nx*256, nativeH=ny*256, scale=Math.min(1, maxT/Math.max(nativeW,nativeH));
  const img=document.createElement("canvas"); img.width=Math.round(nativeW*scale); img.height=Math.round(nativeH*scale);
  const ictx=img.getContext("2d");
  ictx.fillStyle="#16242c"; ictx.fillRect(0,0,img.width,img.height);   // neutral fill → a missing imagery tile is a dark patch, not transparent
  ictx.filter=CFG.GRADE.filter;
  const imgJobs=[];
  for(let x=x0;x<=x1;x++) for(let y=y0;y<=y1;y++)
    imgJobs.push(loadImg(`lib/tiles/img/${z}_${x}_${y}.jpg`).then(im=>
      ictx.drawImage(im,(x-x0)*256*scale,(y-y0)*256*scale,256*scale,256*scale)).catch(()=>{imgFail++;}));
  await Promise.all(imgJobs);
  if(demFail>total*0.25 || imgFail>total*0.25)   // tolerate gaps; only fail if too much is missing to be usable
    throw new Error(`地圖瓦片缺失過多 / too many map tiles missing (DEM ${demFail}/${total}, imagery ${imgFail}/${total}) — 請重新執行 tools/fetch_tiles.ps1`);
  if(demFail||imgFail) console.warn(`地圖瓦片 / map tiles: ${demFail} DEM + ${imgFail} imagery missing — rendered with gaps`);
  applyArchivalGrade(ictx,img.width,img.height);   // vignette + faint grain over the graded tiles
  imageryTex=new THREE.CanvasTexture(img);
  imageryTex.colorSpace=THREE.SRGBColorSpace || undefined;
  imageryTex.encoding=THREE.sRGBEncoding;
  imageryTex.anisotropy=renderer.capabilities.getMaxAnisotropy();
  imageryTex.needsUpdate=true;
}

/* ===================== REAL TERRAIN + SEA + SKY =================== */
let seaMesh;
function buildTerrain(){
  bootMsg("塑造真實地形…");
  const seg=CFG.TERR_SEG;
  const geo=new THREE.PlaneGeometry(MAPW, MAPD, seg, seg);
  geo.rotateX(-Math.PI/2);
  const pos=geo.attributes.position, uv=geo.attributes.uv, n=pos.count;
  for(let i=0;i<n;i++){
    const wx=pos.getX(i), wz=pos.getZ(i);
    const u=(wx+MAPW/2)/MAPW, vS=(wz+MAPD/2)/MAPD;   // vS: 0 north → 1 south
    let y=sampleHeightPx(u,vS)*M2U*CFG.VEXAG;
    const edge=smooth(0.05,0,Math.min(u,1-u,vS,1-vS)); // sink periphery below sea → no floating-slab edge
    y=y*(1-edge)-90*edge;
    pos.setY(i, y);
    uv.setXY(i, u, 1-vS);                            // align imagery (north up)
  }
  geo.computeVertexNormals();
  const terrain=new THREE.Mesh(geo, new THREE.MeshStandardMaterial({
    map:imageryTex, roughness:0.96, metalness:0.0 }));
  scene.add(terrain);
  // static cast-shadows for relief form — the sun direction is FIXED (no arc) so shadows never move;
  // day/night stays intensity/colour-driven (honours the standing "no moving shadows" directive).
  terrain.castShadow=true; terrain.receiveShadow=true;
  sun.castShadow=true; sun.shadow.mapSize.set(2048,2048);
  { const S=Math.max(MAPW,MAPD)*0.72, sc=sun.shadow.camera;
    sc.left=-S; sc.right=S; sc.top=S; sc.bottom=-S; sc.near=50; sc.far=5000; sc.updateProjectionMatrix();
    sun.shadow.bias=-0.0006; sun.shadow.normalBias=1.4; }

  // sea: a STATIC, matte, slightly-translucent surface just below the coastline.
  // (No wave animation + low reflectivity + depthWrite:false → no sweeping specular
  //  highlights and no z-fighting where it meets the shore — i.e. no "moving shadows".)
  const sg=new THREE.PlaneGeometry(MAPW*1.4, MAPD*1.4); sg.rotateX(-Math.PI/2);
  seaMesh=new THREE.Mesh(sg, new THREE.MeshStandardMaterial({
    color:0x14323f, roughness:0.88, metalness:0.04, transparent:true, opacity:0.88, depthWrite:false }));
  // MATTE (roughness 0.88, low metalness). A glossy sheen sweeps a moving specular highlight as the camera
  // orbits → the "sea flicker". Reverted to matte (the HKBattleSeaShimmer known-good); deeper tone +
  // opacity 0.88 kept (continuous open water; helps the waterline rim).
  seaMesh.position.y=-0.2; scene.add(seaMesh);
}

const skyMat = new THREE.ShaderMaterial({
  side:THREE.BackSide, depthWrite:false,
  uniforms:{ top:{value:new THREE.Color(0x6f9fd0)}, bot:{value:new THREE.Color(0xcad9e2)} },
  vertexShader:`varying float vH; void main(){ vH=normalize(position).y; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}`,
  fragmentShader:`uniform vec3 top; uniform vec3 bot; varying float vH;
    void main(){ float t=clamp(vH*0.5+0.5,0.0,1.0); gl_FragColor=vec4(mix(bot,top,t),1.0);}`
});
scene.add(new THREE.Mesh(new THREE.SphereGeometry(9000,32,16), skyMat));


/* ===================== PLACE / TERRAIN LABELS ===================== */
const labelGroup=new THREE.Group(); scene.add(labelGroup);
const placeLabels=[];
function addPlaceLabel(p, cls, off){
  const d=document.createElement("div"); d.className="lbl "+cls;
  d.innerHTML=`<div class="zh">${p.name_zh}</div><div class="en">${p.name_en}</div>`;
  const o=new THREE.CSS2DObject(d); o.position.copy(vec(p.lng,p.lat,off));
  labelGroup.add(o); placeLabels.push({o,div:d,cls});
}
function buildLabels(){
  D.geography.regions.forEach(r=>addPlaceLabel(r,"region",CFG.LBL_REGION));
  D.geography.points.forEach(p=>{
    const cls=p.h>0?"peak":(p.type==="fort"?"fort":(p.type==="bay"||p.type==="channel"?"bay":"town"));
    const off=p.h>0?CFG.LBL_PEAK:(cls==="fort"?CFG.LBL_FORT:CFG.LBL_TOWN);
    addPlaceLabel(p,cls,off);
  });
}

/* ---- defensive line (Gin Drinkers) + moving front line ---------- *
 *  Both are explained in the on-screen legend (#key) AND carry an
 *  on-map label, so the audience knows what each line means.
 * ---------------------------------------------------------------- */
function geoCurve(path, yOff){ return new THREE.CatmullRomCurve3(path.map(p=>vec(p[0],p[1],yOff)), false, "catmullrom", 0.4); }
function lineLabel(zh,en,color){ const d=document.createElement("div"); d.className="lbl linelbl";
  d.innerHTML=`<div class="zh" style="color:${color}">${zh}</div><div class="en">${en}</div>`;
  const o=new THREE.CSS2DObject(d); labelGroup.add(o); return {o,div:d}; }

let gdlMesh=null, gdlLabel=null;
function buildLine(){
  const curve=geoCurve(D.geography.lines[0].path, 12);
  gdlMesh=new THREE.Mesh(new THREE.TubeGeometry(curve,120,2.0,8,false),
    new THREE.MeshBasicMaterial({color:0x6fa0d8, transparent:true, opacity:0}));
  scene.add(gdlMesh);
  gdlLabel=lineLabel("醉酒灣防線","Gin Drinkers Line","#6fa0d8");
  const m=curve.getPoint(0.5); gdlLabel.o.position.set(m.x, m.y+CFG.LBL_FORT, m.z);
}
// The Gin Drinkers Line matters only while the mainland is held (8–13 Dec);
// fade it out as the line collapses so it doesn't linger over the island battle.
function updateLines(day){
  if(!gdlMesh) return;
  const op = day<10.5 ? 0.6 : clamp((13-day)/2.5,0,1)*0.6;
  gdlMesh.material.opacity=op; gdlMesh.visible=op>0.02;
  gdlLabel.o.visible=op>0.05; gdlLabel.div.style.opacity=clamp(op/0.6,0,1);
}

const frontGroup=new THREE.Group(); scene.add(frontGroup);
let frontMesh=null, frontIdx=-1, frontLabel=null;
function updateFront(day){
  let idx=-1; for(let i=0;i<D.fronts.length;i++){ if(D.fronts[i].d<=day) idx=i; }
  if(idx===frontIdx) return; frontIdx=idx;
  if(frontMesh){ frontGroup.remove(frontMesh); frontMesh.geometry.dispose(); frontMesh=null; }
  if(!frontLabel) frontLabel=lineLabel("戰線","Front line","#ffb24a");
  if(idx<0){ frontLabel.o.visible=false; return; }
  const curve=geoCurve(D.fronts[idx].path,16);
  frontMesh=new THREE.Mesh(new THREE.TubeGeometry(curve,80,2.4,8,false),
    new THREE.MeshBasicMaterial({color:0xffb24a, transparent:true, opacity:0.8}));
  frontGroup.add(frontMesh);
  const m=curve.getPoint(0.5); frontLabel.o.position.set(m.x, m.y+CFG.LBL_FORT, m.z); frontLabel.o.visible=true;
}

/* ============================ CRESTS ============================== */
const COL={ ink:"#16140f", red:"#c62828", gold:"#d8b24a", silver:"#dcdce2",
  cream:"#f2ead2", green:"#3f7d40", pink:"#e58fa0", navy:"#16243f", brass:"#caa64a" };
function pCrown(c,x,y,w){ c.fillStyle=COL.gold; c.beginPath();
  c.moveTo(x-w,y+w*0.5); c.lineTo(x-w,y-w*0.3); c.lineTo(x-w*0.5,y+w*0.1);
  c.lineTo(x,y-w*0.5); c.lineTo(x+w*0.5,y+w*0.1); c.lineTo(x+w,y-w*0.3);
  c.lineTo(x+w,y+w*0.5); c.closePath(); c.fill(); c.fillRect(x-w,y+w*0.45,w*2,w*0.35); }
function pMaple(c,x,y,r,col){ c.fillStyle=col||COL.red; c.beginPath();
  const pts=[[0,-1],[.18,-.5],[.55,-.62],[.42,-.22],[.92,-.18],[.55,.05],[.78,.42],
    [.3,.32],[.34,.86],[0,.55],[-.34,.86],[-.3,.32],[-.78,.42],[-.55,.05],[-.92,-.18],
    [-.42,-.22],[-.55,-.62],[-.18,-.5]];
  pts.forEach((p,i)=>{ const X=x+p[0]*r, Y=y+p[1]*r; i?c.lineTo(X,Y):c.moveTo(X,Y); }); c.closePath(); c.fill(); }
function pStar(c,x,y,r,n,col){ c.fillStyle=col||COL.gold; c.beginPath();
  for(let i=0;i<n*2;i++){ const a=Math.PI/n*i-Math.PI/2, rr=i%2?r*0.42:r;
    const X=x+Math.cos(a)*rr, Y=y+Math.sin(a)*rr; i?c.lineTo(X,Y):c.moveTo(X,Y); } c.closePath(); c.fill(); }
function pAnchor(c,x,y,r,col){ c.strokeStyle=col||COL.silver; c.lineWidth=r*0.16; c.lineCap="round";
  c.beginPath(); c.arc(x,y-r*0.7,r*0.2,0,7); c.stroke();
  c.beginPath(); c.moveTo(x,y-r*0.5); c.lineTo(x,y+r*0.8); c.stroke();
  c.beginPath(); c.moveTo(x-r*0.55,y+r*0.05); c.lineTo(x+r*0.55,y+r*0.05); c.stroke();
  c.beginPath(); c.moveTo(x-r*0.7,y+r*0.55); c.quadraticCurveTo(x,y+r*1.05,x,y+r*0.8); c.stroke();
  c.beginPath(); c.moveTo(x+r*0.7,y+r*0.55); c.quadraticCurveTo(x,y+r*1.05,x,y+r*0.8); c.stroke(); }
function pBugle(c,x,y,r,col){ c.strokeStyle=col||COL.silver; c.lineWidth=r*0.14;
  c.beginPath(); c.ellipse(x,y,r*0.8,r*0.5,0,0.2,Math.PI*1.7); c.stroke();
  c.beginPath(); c.moveTo(x+r*0.7,y-r*0.25); c.lineTo(x+r*1.0,y-r*0.4); c.stroke(); }
function pGrenade(c,x,y,r){ c.fillStyle=COL.gold; c.beginPath(); c.arc(x,y+r*0.2,r*0.55,0,7); c.fill();
  c.fillRect(x-r*0.13,y-r*0.5,r*0.26,r*0.35); c.strokeStyle=COL.red; c.lineWidth=r*0.1; c.lineCap="round";
  for(let i=-1;i<=1;i++){ c.beginPath(); c.moveTo(x+i*r*0.18,y-r*0.45);
    c.quadraticCurveTo(x+i*r*0.5,y-r*0.9,x+i*r*0.15,y-r*1.05); c.stroke(); } }
function pPlume(c,x,y,r){ c.fillStyle=COL.silver;
  for(let i=-1;i<=1;i++){ c.save(); c.translate(x+i*r*0.32,y); c.rotate(i*0.28);
    c.beginPath(); c.ellipse(0,-r*0.1,r*0.16,r*0.7,0,0,7); c.fill(); c.restore(); }
  c.fillStyle=COL.gold; c.fillRect(x-r*0.5,y+r*0.55,r,r*0.2); }
function pJunk(c,x,y,r,col){ c.fillStyle=col||COL.gold;
  c.beginPath(); c.moveTo(x-r*0.8,y+r*0.4); c.lineTo(x+r*0.8,y+r*0.4);
  c.lineTo(x+r*0.55,y+r*0.7); c.lineTo(x-r*0.55,y+r*0.7); c.closePath(); c.fill();
  c.beginPath(); c.moveTo(x-r*0.1,y+r*0.35); c.lineTo(x-r*0.1,y-r*0.75);
  c.quadraticCurveTo(x-r*0.7,y-r*0.5,x-r*0.55,y+r*0.2); c.closePath(); c.fill();
  c.beginPath(); c.moveTo(x+r*0.18,y+r*0.35); c.lineTo(x+r*0.18,y-r*0.55);
  c.quadraticCurveTo(x+r*0.72,y-r*0.3,x+r*0.6,y+r*0.25); c.closePath(); c.fill(); }
function pCannon(c,x,y,r){ c.save(); c.strokeStyle=COL.silver; c.lineWidth=r*0.22; c.lineCap="round";
  c.beginPath(); c.moveTo(x-r*0.7,y+r*0.6); c.lineTo(x+r*0.7,y-r*0.5); c.stroke();
  c.beginPath(); c.moveTo(x+r*0.7,y+r*0.6); c.lineTo(x-r*0.7,y-r*0.5); c.stroke(); c.restore(); }
function pFieldGun(c,x,y,r){ c.fillStyle=COL.brass; c.fillRect(x-r*0.2,y-r*0.15,r*1.1,r*0.22);
  c.beginPath(); c.arc(x-r*0.25,y+r*0.4,r*0.4,0,7); c.fill();
  c.fillStyle=COL.navy; c.beginPath(); c.arc(x-r*0.25,y+r*0.4,r*0.16,0,7); c.fill(); }
function pSakura(c,x,y,r){ c.fillStyle=COL.pink;
  for(let i=0;i<5;i++){ const a=-Math.PI/2+i*Math.PI*0.4;
    c.save(); c.translate(x+Math.cos(a)*r*0.42,y+Math.sin(a)*r*0.42); c.rotate(a+Math.PI/2);
    c.beginPath(); c.ellipse(0,0,r*0.26,r*0.42,0,0,7); c.fill(); c.restore(); }
  c.fillStyle=COL.gold; c.beginPath(); c.arc(x,y,r*0.16,0,7); c.fill(); }
function pReeds(c,x,y,r){ c.strokeStyle=COL.ink; c.lineWidth=r*0.1; c.lineCap="round";
  for(let i=-2;i<=2;i++){ c.beginPath(); c.moveTo(x+i*r*0.2,y+r*0.7);
    c.quadraticCurveTo(x+i*r*0.3,y-r*0.2,x+i*r*0.45,y-r*0.8); c.stroke(); } }
function pIgeta(c,x,y,r){ c.strokeStyle=COL.ink; c.lineWidth=r*0.16; const s=r*0.55;
  c.strokeRect(x-s,y-s,s*2,s*2);
  c.beginPath(); c.moveTo(x-s*1.2,y-s*0.4); c.lineTo(x+s*1.2,y-s*0.4);
  c.moveTo(x-s*1.2,y+s*0.4); c.lineTo(x+s*1.2,y+s*0.4);
  c.moveTo(x-s*0.4,y-s*1.2); c.lineTo(x-s*0.4,y+s*1.2);
  c.moveTo(x+s*0.4,y-s*1.2); c.lineTo(x+s*0.4,y+s*1.2); c.stroke(); }
function pRiceField(c,x,y,r){ const s=r*0.6; c.strokeStyle=COL.ink; c.lineWidth=r*0.13;
  c.strokeRect(x-s,y-s,s*2,s*2); c.beginPath(); c.moveTo(x,y-s); c.lineTo(x,y+s);
  c.moveTo(x-s,y); c.lineTo(x+s,y); c.stroke(); c.strokeStyle=COL.green; c.lineWidth=r*0.09;
  [[-1,-1],[1,-1],[-1,1],[1,1]].forEach(d=>{ c.beginPath();
    c.moveTo(x+d[0]*s*1.2,y+d[1]*s*1.2); c.lineTo(x+d[0]*s*1.45,y+d[1]*s*1.5); c.stroke(); }); }
function pRisingSun(c,x,y,r){ c.fillStyle=COL.red; c.beginPath(); c.arc(x,y-r*0.1,r*0.5,0,7); c.fill();
  c.fillStyle=COL.red; for(let i=-1;i<=1;i++){ c.beginPath();   // red rays on the cream medallion — canonical Rising Sun
    c.moveTo(x+i*r*0.4,y+r*0.7); c.lineTo(x+i*r*0.4-r*0.18,y+r*0.2); c.lineTo(x+i*r*0.4+r*0.18,y+r*0.2);
    c.closePath(); c.fill(); } }
function pLion(c,x,y,r){ c.fillStyle=COL.gold; c.beginPath();
  c.moveTo(x-r*0.4,y+r*0.8); c.lineTo(x-r*0.3,y-r*0.2);
  c.quadraticCurveTo(x-r*0.4,y-r*0.7,x-r*0.05,y-r*0.7); c.quadraticCurveTo(x+r*0.2,y-r*0.7,x+r*0.15,y-r*0.35);
  c.lineTo(x+r*0.5,y-r*0.5); c.lineTo(x+r*0.3,y-r*0.1); c.lineTo(x+r*0.55,y+r*0.2);
  c.lineTo(x+r*0.25,y+r*0.25); c.lineTo(x+r*0.3,y+r*0.8); c.lineTo(x+r*0.05,y+r*0.8);
  c.lineTo(x,y+r*0.3); c.lineTo(x-r*0.1,y+r*0.8); c.closePath(); c.fill(); }
function pWing(c,x,y,r){ c.fillStyle=COL.silver; c.beginPath();
  c.moveTo(x-r,y); c.quadraticCurveTo(x,y-r*0.5,x+r,y-r*0.15);
  c.quadraticCurveTo(x,y+r*0.2,x-r,y+r*0.15); c.closePath(); c.fill(); }
const crests = {
  sakai:(c,x,y,r)=>{ pCannon(c,x,y,r*0.9); pSakura(c,x,y,r*0.95);
    c.fillStyle=COL.ink; c.font=`bold ${r*0.5}px serif`; c.textAlign="center"; c.fillText("廿三",x,y+r*1.15); },
  sano:(c,x,y,r)=>{ pReeds(c,x,y,r); c.strokeStyle=COL.ink; c.lineWidth=r*0.08;
    c.beginPath(); c.arc(x,y,r*0.92,0,7); c.stroke();
    c.fillStyle=COL.ink; for(let i=-1;i<=1;i++){ c.beginPath(); c.arc(x+i*r*0.28,y+r*0.95,r*0.1,0,7); c.fill(); } },
  doi:(c,x,y,r)=>{ pIgeta(c,x,y,r); },
  tanaka:(c,x,y,r)=>{ pRiceField(c,x,y,r); },
  shoji:(c,x,y,r)=>{ pRisingSun(c,x,y,r); },
  kitajima:(c,x,y,r)=>{ pCannon(c,x,y,r); pStar(c,x,y-r*0.55,r*0.3,5,COL.silver); },
  jp_air:(c,x,y,r)=>{ c.fillStyle=COL.red; c.beginPath(); c.arc(x,y,r*0.55,0,7); c.fill(); pWing(c,x,y,r*0.95); },
  jp_navy:(c,x,y,r)=>{ pAnchor(c,x,y,r,COL.silver);
    c.fillStyle=COL.red; c.beginPath(); c.arc(x+r*0.6,y-r*0.6,r*0.22,0,7); c.fill(); },
  maltby:(c,x,y,r)=>{ pCrown(c,x,y-r*0.45,r*0.5); pLion(c,x,y+r*0.2,r*0.7); },
  royalscots:(c,x,y,r)=>{ pStar(c,x,y,r,8,COL.gold); c.strokeStyle=COL.navy; c.lineWidth=r*0.16;
    c.beginPath(); c.moveTo(x-r*0.6,y-r*0.6); c.lineTo(x+r*0.6,y+r*0.6);
    c.moveTo(x+r*0.6,y-r*0.6); c.lineTo(x-r*0.6,y+r*0.6); c.stroke();
    c.fillStyle=COL.cream; c.beginPath(); c.arc(x,y,r*0.28,0,7); c.fill(); },
  rajput:(c,x,y,r)=>{ pLion(c,x,y,r); },
  punjab:(c,x,y,r)=>{ pJunk(c,x,y,r*0.9,COL.gold); pCrown(c,x,y-r*0.85,r*0.32); },
  middlesex:(c,x,y,r)=>{ pPlume(c,x,y,r); },
  winnipeg:(c,x,y,r)=>{ pGrenade(c,x,y,r); pMaple(c,x,y+r*0.2,r*0.32,COL.red); },
  royalrifles:(c,x,y,r)=>{ pBugle(c,x,y,r,COL.silver); pMaple(c,x,y+r*0.55,r*0.3,COL.green); },
  hkvdc:(c,x,y,r)=>{ pJunk(c,x,y,r,COL.gold); },
  lawson:(c,x,y,r)=>{ pMaple(c,x,y+r*0.1,r*0.85,COL.red); pCrown(c,x,y-r*0.5,r*0.34);
    for(let i=-1;i<=1;i++) pStar(c,x+i*r*0.3,y+r*0.35,r*0.14,4,COL.gold); },
  wallis:(c,x,y,r)=>{ pCrown(c,x,y-r*0.5,r*0.4);
    for(let i=-1;i<=1;i++) pStar(c,x+i*r*0.3,y,r*0.16,4,COL.gold); pBugle(c,x,y+r*0.55,r*0.5,COL.silver); },
  ra:(c,x,y,r)=>{ pFieldGun(c,x,y,r);
    c.fillStyle=COL.cream; c.font=`bold ${r*0.34}px serif`; c.textAlign="center"; c.fillText("UBIQUE",x,y+r*0.9); },
  rn:(c,x,y,r)=>{ pAnchor(c,x,y,r,COL.gold); pCrown(c,x,y-r*0.95,r*0.3); },
};
const flagTexCache={};
function flagTexture(unit){
  if(flagTexCache[unit.id]) return flagTexCache[unit.id];
  const W=230,H=150, cv=document.createElement("canvas"); cv.width=W; cv.height=H;
  const c=cv.getContext("2d"); const f=FAC[unit.faction];
  const g=c.createLinearGradient(0,0,W,H);
  g.addColorStop(0,f.css); g.addColorStop(0.5,shade(f.css,1.18)); g.addColorStop(1,shade(f.css,0.7));
  c.fillStyle=g; c.fillRect(0,0,W,H);
  c.fillStyle="rgba(0,0,0,0.35)"; c.fillRect(0,0,12,H);
  c.strokeStyle=unit.faction==="jp"?"#ffd9c8":"#cfe0ff"; c.lineWidth=4; c.strokeRect(6,6,W-12,H-12);
  const cx=W*0.6, cy=H*0.5, R=50;
  if(unit.faction==="jp"){ c.fillStyle=COL.cream; c.beginPath(); c.arc(cx,cy,R,0,7); c.fill();
    c.strokeStyle=COL.ink; c.lineWidth=4; c.beginPath(); c.arc(cx,cy,R,0,7); c.stroke(); }
  else { c.fillStyle=COL.cream; c.beginPath();
    c.moveTo(cx-R,cy-R*0.8); c.lineTo(cx+R,cy-R*0.8); c.lineTo(cx+R,cy+R*0.2);
    c.quadraticCurveTo(cx+R,cy+R*0.9,cx,cy+R*1.15); c.quadraticCurveTo(cx-R,cy+R*0.9,cx-R,cy+R*0.2);
    c.closePath(); c.fill(); c.strokeStyle=COL.gold; c.lineWidth=4; c.stroke(); }
  c.save(); (crests[unit.crest]||crests.doi)(c,cx,cy,R*0.78); c.restore();
  const tex=new THREE.CanvasTexture(cv); tex.anisotropy=4; tex.needsUpdate=true;
  flagTexCache[unit.id]=tex; return tex;
}
function shade(hex,f){ const c=new THREE.Color(hex); c.multiplyScalar(f); return "#"+c.getHexString(); }
function makeSoftTex(){ const s=64, cv=document.createElement("canvas"); cv.width=cv.height=s;
  const c=cv.getContext("2d"); const g=c.createRadialGradient(s/2,s/2,0,s/2,s/2,s/2);
  g.addColorStop(0,"#fff"); g.addColorStop(0.4,"rgba(255,255,255,0.6)"); g.addColorStop(1,"rgba(255,255,255,0)");
  c.fillStyle=g; c.fillRect(0,0,s,s); return new THREE.CanvasTexture(cv); }
// Archival pass over the composited imagery: a soft vignette (periphery only — centre/battle area stays
// clear) plus faint film grain, so the present-day satellite mosaic reads as aged documentary footage.
function applyArchivalGrade(ctx,w,h){
  ctx.filter="none";
  const vg=ctx.createRadialGradient(w/2,h/2,Math.min(w,h)*0.30, w/2,h/2,Math.max(w,h)*0.62);
  vg.addColorStop(0,"rgba(28,20,10,0)"); vg.addColorStop(1,`rgba(18,12,6,${CFG.GRADE.vignette})`);
  ctx.fillStyle=vg; ctx.fillRect(0,0,w,h);
  ctx.globalAlpha=CFG.GRADE.grain; const n=Math.min(18000,(w*h)/130);
  for(let i=0;i<n;i++){ ctx.fillStyle=(i&1)?"#fff":"#000"; ctx.fillRect(Math.random()*w,Math.random()*h,1,1); }
  ctx.globalAlpha=1;
}

/* ========================= UNITS / FLAGS ========================== */
const unitsGroup=new THREE.Group(); scene.add(unitsGroup);
const flagWaves=[]; const unitObjs=[];
// Unit glyphs — shared geometries built once and reused by every unit (less allocation than a token each).
// Combat units fly an oriented "formation wedge": a notched chevron whose tip points along the unit's
// advance vector (updateUnits sets token.rotation.y) and whose footprint scales with combat strength.
const WEDGE_GEO=(()=>{ const s=new THREE.Shape();
  s.moveTo(0,-1.0); s.lineTo(0.60,0.55); s.lineTo(0.22,0.30); s.lineTo(0,0.48);
  s.lineTo(-0.22,0.30); s.lineTo(-0.60,0.55); s.closePath();          // tip at -Y, notched wings at +Y
  const g=new THREE.ExtrudeGeometry(s,{depth:0.9, bevelEnabled:false}); // 0.9 = thin map-glyph slab
  g.rotateX(-Math.PI/2);                          // tip → world +Z (forward), thickness → +Y (up)
  g.scale(CFG.TOKEN_R*1.25,1,CFG.TOKEN_R*1.25);   // footprint ≈ the former cylinder token
  return g; })();
// Command posts are not maneuver formations — they wear a static diamond beacon, never a direction arrow.
const CMD_GEO=new THREE.OctahedronGeometry(CFG.TOKEN_R*0.62);
// state → formation footprint [frontage, depth] applied to the wedge so 陣型 reads per posture:
// attack=spearhead, march=narrow column, hold=broad defensive line, retreat=dispersed.
const FORM={ attack:[1,1], landing:[1.06,1.06], march:[0.62,1.18], hold:[1.5,0.55], retreat:[1.25,0.7], dead:[1,1] };
function buildUnit(u){
  const grp=new THREE.Group(); const f=FAC[u.faction]; const isCmd=u.kind==="command";
  const ring=new THREE.Mesh(new THREE.RingGeometry(CFG.RING_IN,CFG.RING_OUT,40),
    new THREE.MeshBasicMaterial({color:f.glow, transparent:true, opacity:0.5, side:THREE.DoubleSide}));
  ring.rotation.x=-Math.PI/2; ring.position.y=1.5; grp.add(ring);
  const token=new THREE.Mesh(isCmd?CMD_GEO:WEDGE_GEO,
    new THREE.MeshStandardMaterial({color:f.main, emissive:f.dim, emissiveIntensity:0.3, roughness:0.62}));
  token.position.y=isCmd?6:2.2; token.castShadow=true; grp.add(token);   // HQ beacon hovers; wedge lies just above the ground ring
  const pole=new THREE.Mesh(new THREE.CylinderGeometry(CFG.POLE_R,CFG.POLE_R,CFG.FLAG_H+CFG.TOKEN_H,6),
    new THREE.MeshStandardMaterial({color:0x2a2620, roughness:0.8}));
  pole.position.y=(CFG.FLAG_H+CFG.TOKEN_H)/2; pole.castShadow=true; grp.add(pole);   // planted to the ground (no float over the flat wedge)
  const finial=new THREE.Mesh(new THREE.SphereGeometry(CFG.FINIAL_R,8,8),
    new THREE.MeshStandardMaterial({color:f.glow, emissive:f.glow, emissiveIntensity:0.28}));
  finial.position.y=CFG.FLAG_H+CFG.TOKEN_H; grp.add(finial);
  const fg=new THREE.PlaneGeometry(CFG.FLAG_W,CFG.FLAG_TH,16,8); fg.translate(CFG.FLAG_W/2,0,0);
  const flag=new THREE.Mesh(fg, new THREE.MeshStandardMaterial({map:flagTexture(u),
    side:THREE.DoubleSide, roughness:0.7, emissive:0x222222, emissiveIntensity:0.15, transparent:true}));
  flag.position.set(CFG.POLE_R, CFG.FLAG_H+CFG.TOKEN_H-CFG.FLAG_TH*0.6, 0); grp.add(flag);
  flag.userData.base=fg.attributes.position.array.slice(); flag.userData.phase=Math.random()*9;
  flagWaves.push(flag);
  const div=document.createElement("div"); div.className="unit "+u.faction;
  div.innerHTML=`<div class="name">${u.label_zh||u.name_zh}</div>`;   // commander shown in the caption, not on-map; label_zh = optional shorter on-map label
  const lbl=new THREE.CSS2DObject(div); lbl.position.set(0, CFG.FLAG_H+CFG.LBL_UNIT, 0); grp.add(lbl);
  unitsGroup.add(grp);
  unitObjs.push({u,grp,ring,token,flag,finial,div,lbl,
    activeStart:u.track[0].d, activeEnd:u.track[u.track.length-1].d, visible:true});
}
function sampleTrack(track, day){
  if(day<=track[0].d) return {lng:track[0].lng,lat:track[0].lat,s:track[0].s,st:track[0].st};
  const last=track[track.length-1];
  if(day>=last.d) return {lng:last.lng,lat:last.lat,s:last.s,st:last.st};
  for(let i=0;i<track.length-1;i++){ const a=track[i], b=track[i+1];
    if(day>=a.d&&day<=b.d){ const t=(day-a.d)/(b.d-a.d||1);
      return {lng:lerp(a.lng,b.lng,t),lat:lerp(a.lat,b.lat,t),s:Math.round(lerp(a.s,b.s,t)),st:a.st}; } }
  return {lng:last.lng,lat:last.lat,s:last.s,st:last.st};
}
function deadDay(u){ for(const k of u.track) if(k.st==="dead") return k.d; return 999; }

/* ===================== MOVEMENT ARROWS ============================ */
const arrowsGroup=new THREE.Group(); scene.add(arrowsGroup);
const arrowObjs=[]; let softTex;
function buildArrow(a){
  const f=FAC[a.f]; const p0=vec(a.from[0],a.from[1],14), p2=vec(a.to[0],a.to[1],14);
  const mid=p0.clone().lerp(p2,0.5); mid.y+=p0.distanceTo(p2)*0.18+20;
  const curve=new THREE.QuadraticBezierCurve3(p0,mid,p2);
  const col=a.kind==="retreat"?FAC.uk.glow:f.glow;
  const tube=new THREE.Mesh(new THREE.TubeGeometry(curve,40,a.kind==="landing"?2.4:1.8,8,false),
    new THREE.MeshBasicMaterial({color:col, transparent:true, opacity:0.0}));
  const tan=curve.getTangent(1).normalize();
  const head=new THREE.Mesh(new THREE.ConeGeometry(5,12,12),
    new THREE.MeshBasicMaterial({color:col, transparent:true, opacity:0.0}));
  head.position.copy(p2); head.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),tan);
  const flows=[]; for(let i=0;i<3;i++){ const sp=new THREE.Sprite(new THREE.SpriteMaterial({map:softTex,color:col,
    transparent:true,opacity:0,blending:THREE.AdditiveBlending,depthWrite:false}));
    sp.scale.set(9,9,9); arrowsGroup.add(sp); flows.push(sp); }
  const div=document.createElement("div"); div.className="lbl bay";
  div.innerHTML=`<div class="zh" style="font-size:11px;color:${a.f==='jp'?'#ffb0a4':'#a8c6ff'}">${a.label}</div>`;
  const lbl=new THREE.CSS2DObject(div); lbl.position.copy(mid); div.style.opacity="0";
  arrowsGroup.add(tube); arrowsGroup.add(head); arrowsGroup.add(lbl);
  arrowObjs.push({a,curve,tube,head,flows,div,lbl});
}

/* ========================= EFFECTS ================================ */
function makeParticleSystem(cap, additive, pscale){
  const geo=new THREE.BufferGeometry();
  const pos=new Float32Array(cap*3), col=new Float32Array(cap*3), psize=new Float32Array(cap), alpha=new Float32Array(cap);
  geo.setAttribute("position",new THREE.BufferAttribute(pos,3));
  geo.setAttribute("color",new THREE.BufferAttribute(col,3));
  geo.setAttribute("psize",new THREE.BufferAttribute(psize,1));
  geo.setAttribute("alpha",new THREE.BufferAttribute(alpha,1));
  const mat=new THREE.ShaderMaterial({ transparent:true, depthWrite:false,
    blending: additive?THREE.AdditiveBlending:THREE.NormalBlending,
    uniforms:{ pscale:{value:pscale} },
    vertexShader:`uniform float pscale; attribute vec3 color; attribute float psize; attribute float alpha;
      varying vec3 vC; varying float vA;
      void main(){ vC=color; vA=alpha; vec4 mv=modelViewMatrix*vec4(position,1.0);
        gl_PointSize=psize*(pscale/-mv.z); gl_Position=projectionMatrix*mv; }`,
    fragmentShader:`varying vec3 vC; varying float vA;
      void main(){ vec2 c=gl_PointCoord-0.5; float d=length(c);
        float a=smoothstep(0.5,${additive?"0.05":"0.0"},d)*vA; if(a<=0.0) discard; gl_FragColor=vec4(vC,a); }`
  });
  const pts=new THREE.Points(geo,mat); pts.frustumCulled=false; scene.add(pts);
  return { geo,pos,col,psize,alpha,cap,cursor:0, vel:new Float32Array(cap*3),
    life:new Float32Array(cap), max:new Float32Array(cap), grow:new Float32Array(cap), kind:new Int8Array(cap), pts };
}
let GLOW, SMOKE;
function emit(S,x,y,z,vx,vy,vz,size,life,r,g,b,grow,kind){
  const i=S.cursor; S.cursor=(S.cursor+1)%S.cap;
  S.pos[i*3]=x; S.pos[i*3+1]=y; S.pos[i*3+2]=z;
  S.vel[i*3]=vx; S.vel[i*3+1]=vy; S.vel[i*3+2]=vz;
  S.col[i*3]=r; S.col[i*3+1]=g; S.col[i*3+2]=b;
  S.psize[i]=size; S.life[i]=life; S.max[i]=life; S.grow[i]=grow||0; S.kind[i]=kind||0; S.alpha[i]=1;
}
function stepParticles(S,dt){
  const G=CFG.EU;
  for(let i=0;i<S.cap;i++){
    if(S.life[i]<=0){ if(S.alpha[i]!==0) S.alpha[i]=0; continue; }
    S.life[i]-=dt; const k=S.kind[i];
    if(k===1) S.vel[i*3+1]+=2*G*dt; else if(k===2) S.vel[i*3+1]+=5*G*dt; else S.vel[i*3+1]-=14*G*dt;
    S.pos[i*3]+=S.vel[i*3]*dt; S.pos[i*3+1]+=S.vel[i*3+1]*dt; S.pos[i*3+2]+=S.vel[i*3+2]*dt;
    if(S.pos[i*3+1]<1 && k!==1 && k!==2) S.life[i]=0;
    S.psize[i]+=S.grow[i]*dt;
    const lt=S.life[i]/S.max[i]; S.alpha[i]=k===1?clamp(lt*0.5,0,0.5):clamp(lt,0,1);
  }
  S.geo.attributes.position.needsUpdate=true; S.geo.attributes.color.needsUpdate=true;
  S.geo.attributes.psize.needsUpdate=true; S.geo.attributes.alpha.needsUpdate=true;
}
const flashes=[];
function buildFlashes(){ for(let i=0;i<7;i++){ const L=new THREE.PointLight(0xffaa55,0,240,2); L.visible=false; scene.add(L); flashes.push({L,life:0}); } }
function flash(x,y,z,color,intensity){ for(const fl of flashes){ if(fl.life<=0){ fl.L.color.setHex(color);
  fl.L.position.set(x,y,z); fl.L.intensity=intensity*CFG.FLASH_K; fl.L.visible=true; fl.life=0.14; return; } } }
const hotTimers={}; const rnd=(a,b)=>a+Math.random()*(b-a);
function updateEffects(day, dt){
  const G=CFG.EU;
  for(let h=0;h<D.hotspots.length;h++){
    const hs=D.hotspots[h]; if(day<hs.a||day>hs.b) continue;
    const w=vec(hs.lng,hs.lat,0); const gx=w.x, gz=w.z, gy=w.y;
    hotTimers[h]=(hotTimers[h]||0)-dt; const fire=hotTimers[h]<=0;
    if(hs.kind==="firefight"){
      if(Math.random()<hs.i*0.9){ const c=Math.random()<0.5?[1,0.8,0.3]:[1,0.5,0.2];
        emit(GLOW,gx+rnd(-3,3)*G,gy+rnd(0.5,3)*G,gz+rnd(-3,3)*G,rnd(-6,6)*G,rnd(4,12)*G,rnd(-6,6)*G,rnd(8,16),rnd(0.3,0.6),c[0],c[1],c[2],0,0); }
      if(fire){ flash(gx,gy+2*G,gz,0xffcc66,rnd(120,260)); emit(SMOKE,gx,gy+G,gz,rnd(-1,1)*G,2*G,rnd(-1,1)*G,16,rnd(1.2,2),0.22,0.21,0.2,12,1); hotTimers[h]=rnd(0.12,0.28)/hs.i; }
    } else if(hs.kind==="artillery"){
      if(fire){ flash(gx,gy+3*G,gz,0xffd27a,rnd(220,360));
        for(let s=0;s<8;s++) emit(GLOW,gx,gy+2.5*G,gz,rnd(-10,10)*G,rnd(6,16)*G,rnd(-10,10)*G,rnd(10,18),0.4,1,0.75,0.35,0,0);
        emit(SMOKE,gx,gy+2*G,gz,rnd(-1,1)*G,2.5*G,rnd(-1,1)*G,22,2.2,0.26,0.25,0.23,16,1);
        for(let t=0;t<6;t++) emit(GLOW,gx+rnd(-2,2)*G,gy+(5+t*4)*G,gz+(10+t*7)*G,rnd(-2,2)*G,3*G,18*G,9,0.5,1,0.9,0.5,0,0);
        hotTimers[h]=rnd(0.4,0.9)/hs.i; }
    } else if(hs.kind==="explosion"){
      if(fire){ flash(gx,gy+2*G,gz,0xffaa44,rnd(300,520));
        for(let s=0;s<14;s++){ const a=Math.random()*7,sp=rnd(6,20)*G;
          emit(GLOW,gx,gy+1.5*G,gz,Math.cos(a)*sp,rnd(8,20)*G,Math.sin(a)*sp,rnd(10,22),rnd(0.3,0.6),1,0.6,0.2,0,3); }
        emit(SMOKE,gx,gy+2*G,gz,rnd(-2,2)*G,3*G,rnd(-2,2)*G,30,2.4,0.2,0.19,0.18,20,1);
        hotTimers[h]=rnd(0.7,1.6)/hs.i; }
    } else if(hs.kind==="landing"){
      if(Math.random()<0.7) emit(GLOW,gx+rnd(-6,6)*G,gy+rnd(0,2)*G,gz+rnd(-4,4)*G,rnd(-4,4)*G,rnd(6,12)*G,rnd(-4,4)*G,rnd(8,14),0.4,0.7,0.85,1,0);
      if(fire){ flash(gx,gy+1.5*G,gz,0xfff0c0,rnd(120,220));
        for(let s=0;s<6;s++) emit(GLOW,gx+rnd(-8,8)*G,gy+0.5*G,gz+rnd(-6,6)*G,rnd(-3,3)*G,rnd(3,7)*G,rnd(-3,3)*G,11,0.4,0.6,0.8,1,0,0);
        hotTimers[h]=rnd(0.3,0.6); }
    } else if(hs.kind==="oilfire"){
      for(let s=0;s<3;s++) emit(GLOW,gx+rnd(-4,4)*G,gy+rnd(0,4)*G,gz+rnd(-4,4)*G,rnd(-2,2)*G,rnd(8,16)*G,rnd(-2,2)*G,rnd(18,30),rnd(0.4,0.8),1,rnd(0.35,0.6),0.12,-12,2);
      if(fire){ for(let s=0;s<2;s++) emit(SMOKE,gx+rnd(-2,2)*G,gy+3*G,gz+rnd(-2,2)*G,rnd(0,2)*G,rnd(4,7)*G,rnd(-1,1)*G,rnd(22,34),rnd(2,3),0.15,0.14,0.13,16,1);
        flash(gx,gy+3*G,gz,0xff7733,rnd(120,200)*hs.i); hotTimers[h]=rnd(0.2,0.34); }
    } else if(hs.kind==="air"){
      if(fire){ flash(gx,gy+2*G,gz,0xffcc66,300);
        for(let s=0;s<10;s++){ const a=Math.random()*7,sp=rnd(8,16)*G;
          emit(GLOW,gx,gy+1.5*G,gz,Math.cos(a)*sp,rnd(6,14)*G,Math.sin(a)*sp,rnd(10,18),0.5,1,0.7,0.3,0,3); }
        emit(SMOKE,gx,gy+2*G,gz,0,2.5*G,0,26,2.4,0.2,0.19,0.18,18,1);
        for(let t=0;t<6;t++) emit(GLOW,gx+(rnd(-3,3)+(6-t)*4)*G,gy+(30-t*4)*G,gz+(-30+t*4)*G,rnd(-2,2)*G,-6*G,6*G,8,0.4,1,0.9,0.4,0,0);
        hotTimers[h]=rnd(0.8,1.6); }
    }
  }
  stepParticles(GLOW,dt); stepParticles(SMOKE,dt);
  flashes.forEach(fl=>{ if(fl.life>0){ fl.life-=dt; fl.L.intensity=Math.max(0,fl.L.intensity-dt*fl.L.intensity*6.5); if(fl.life<=0){ fl.life=0; fl.L.visible=false; } }});
}

/* ========================= WEATHER ================================ */
const RAIN_N=1500; let rain, rainPos, rainMat;
function buildRain(){
  const g=new THREE.BufferGeometry(); rainPos=new Float32Array(RAIN_N*6);
  for(let i=0;i<RAIN_N;i++) resetRain(i,true);
  g.setAttribute("position",new THREE.BufferAttribute(rainPos,3));
  rainMat=new THREE.LineBasicMaterial({color:0xaebfce, transparent:true, opacity:0});
  rain=new THREE.LineSegments(g,rainMat); rain.frustumCulled=false; scene.add(rain);
}
function resetRain(i,init){ const cx=controls?controls.target.x:0, cz=controls?controls.target.z:0;
  const x=cx+rnd(-700,700), z=cz+rnd(-700,700), y=init?rnd(0,700):rnd(500,760);
  rainPos[i*6]=x; rainPos[i*6+1]=y; rainPos[i*6+2]=z; rainPos[i*6+3]=x+6; rainPos[i*6+4]=y-34; rainPos[i*6+5]=z; }
function curWeather(day){ const W=D.weather; if(day<=W[0].d) return W[0]; const last=W[W.length-1]; if(day>=last.d) return last;
  for(let i=0;i<W.length-1;i++){ const a=W[i],b=W[i+1]; if(day>=a.d&&day<=b.d){ const t=(day-a.d)/(b.d-a.d||1);
    return { night:lerp(a.night,b.night,t), fog:lerp(a.fog,b.fog,t), rain:lerp(a.rain,b.rain,t),
             smoke:lerp(a.smoke,b.smoke,t), zh:t<0.5?a.zh:b.zh, en:t<0.5?a.en:b.en }; } } return last; }
const cDay=new THREE.Color(0x6f9fd0), cDayB=new THREE.Color(0xcad9e2), cNight=new THREE.Color(0x10182c),
      cNightB=new THREE.Color(0x243349), cOver=new THREE.Color(0x5a6470), cOverB=new THREE.Color(0x808a92), cSmoke=new THREE.Color(0x4a3f3a), cSea=new THREE.Color(0x14323f);
const _t=new THREE.Color(), _b=new THREE.Color();
function applyWeather(day){
  const w=curWeather(day), overcast=clamp(Math.max(w.rain,w.smoke*0.6),0,1);
  _t.copy(cDay).lerp(cOver,overcast).lerp(cNight,w.night);
  _b.copy(cDayB).lerp(cOverB,overcast).lerp(cNightB,w.night).lerp(cSmoke,w.smoke*0.4);
  skyMat.uniforms.top.value.copy(_t); skyMat.uniforms.bot.value.copy(_b);
  scene.fog.color.copy(_b); scene.fog.density=0.00012 + w.fog*0.00055 + w.smoke*0.00022;
  sun.intensity=lerp(1.2,0.1,w.night)*(1-0.55*overcast);
  sun.color.setHex(w.night>0.5?0x8ea6cf:0xfff1d6);
  hemi.intensity=lerp(0.5,0.22,w.night)*(1-0.3*overcast);
  amb.intensity=lerp(0.45,0.36,w.night); amb.color.setHex(w.night>0.5?0x1c2a44:0x404a55);
  renderer.toneMappingExposure=lerp(1.08,0.78,w.night);
  if(seaMesh) seaMesh.material.color.copy(cSea).lerp(cNight,w.night*0.8);
  if(rainMat){ rainMat.opacity=clamp(w.rain*0.6,0,0.6); rain.visible=w.rain>0.02; }
  return w;
}
function stepRain(dt,w){ if(!rain||!rain.visible) return; const fall=720*dt*(0.6+w.rain);
  for(let i=0;i<RAIN_N;i++){ rainPos[i*6+1]-=fall; rainPos[i*6+4]-=fall; if(rainPos[i*6+1]<0) resetRain(i,false); }
  rain.geometry.attributes.position.needsUpdate=true; }

/* ====================== CLOCK & FOCUS STATE ====================== */
const Clock={ day:CFG.DAY_MIN };
function setDay(d){ Clock.day=clamp(d,CFG.DAY_MIN,CFG.DAY_MAX); }
let focusSet=new Set();                 // unit ids emphasised by the current shot
const lookTarget=new THREE.Vector3();   // where the camera looks (drives place-label focus)
const unitById={};                      // id → unit render-object (filled at init)

/* ===================== per-frame world update ===================== */
let now=0;
function updateUnits(day){
  const DIM=CFG.FOCUS.UNIT_DIM;
  unitObjs.forEach(o=>{
    const u=o.u, vis=day>=o.activeStart-0.4 && day<=o.activeEnd+1.4;
    o.grp.visible=vis; o.visible=vis; if(!vis){ o.lbl.visible=false; o.div.style.opacity=0; return; }   // inactive units: hide the CSS2D label too (grp.visible=false alone does NOT hide it → it leaks at the map origin)
    const s=sampleTrack(u.track,day);
    const dead=s.st==="dead" && day>=(deadDay(u)-0.01);
    const w=vec(s.lng,s.lat,0); o.grp.position.copy(w);
    const ah=sampleTrack(u.track,Math.min(day+0.4,o.activeEnd)); const pa=project(ah.lng,ah.lat);
    const dx=pa.X-w.x, dz=pa.Z-w.z; if(dx*dx+dz*dz>1) o.token.rotation.y=Math.atan2(dx,dz);
    if(u.cf){ const sc=0.6+clamp(s.s/2200,0,1.6); const fm=FORM[s.st]||FORM.attack; o.token.scale.set(sc*fm[0],1,sc*fm[1]); }
    const f=FAC[u.faction], focused=focusSet.has(u.id);
    // every on-stage unit flies its kamon flag (the signature feature); focus only emphasises.
    o.flag.visible=true; o.flag.material.opacity=focused?1:0.5; o.finial.visible=focused;
    o.lbl.visible=focused; o.div.style.opacity=focused?(dead?0.65:1):0;   // text labels stay focus-only (no clutter)
    if(dead){ o.token.material.color.setHex(0x55585c); o.token.material.emissiveIntensity=focused?0.06:0.0;
      o.ring.material.opacity=focused?0.4:DIM; o.flag.rotation.z=-0.5; o.flag.position.y=(CFG.FLAG_H+CFG.TOKEN_H)*0.55; }
    else { o.token.material.color.setHex(f.main); o.flag.rotation.z=0; o.flag.position.y=CFG.FLAG_H+CFG.TOKEN_H-CFG.FLAG_TH*0.6;
      const att=s.st==="attack"||s.st==="landing";
      o.token.material.emissiveIntensity = focused?(att?0.38+0.2*Math.sin(now*6):0.26):DIM;
      o.ring.material.opacity = focused?(att?0.5+0.18*Math.sin(now*5):0.4):DIM;
      o.ring.material.color.setHex(s.st==="retreat"?0x888888:f.glow); }
  });
}
function updateArrows(day){
  arrowObjs.forEach(o=>{ const a=o.a, op=a.kind==="march"?0.6:0.85;
    const vis=day>=a.d-0.6&&day<=a.d+1.1;
    let alpha=vis?(smooth(a.d-0.6,a.d,day)*(1-smooth(a.d+0.6,a.d+1.1,day))):0; alpha*=op;
    o.tube.material.opacity=alpha; o.head.material.opacity=alpha;
    o.tube.visible=o.head.visible=alpha>0.01; o.div.style.opacity=alpha*1.1;
    o.flows.forEach((sp,i)=>{ if(alpha<=0.01){ sp.material.opacity=0; return; }
      const t=((now*0.4+i/3)%1); sp.position.copy(o.curve.getPoint(t));
      sp.material.opacity=alpha*(0.6+0.4*Math.sin(t*Math.PI)); }); });
}
function updateFlags(){ for(const flag of flagWaves){ const pos=flag.geometry.attributes.position, base=flag.userData.base, ph=flag.userData.phase;
  for(let i=0;i<pos.count;i++){ const bx=base[i*3], by=base[i*3+1], k=bx/CFG.FLAG_W;
    pos.setZ(i, Math.sin(bx*0.25+now*5+ph)*CFG.FLAG_TH*0.12*k + Math.sin(by*0.3+now*3)*CFG.FLAG_TH*0.04*k); }
  pos.needsUpdate=true; } }
const _rankIdx=[];   // reused across frames — rank place labels by camera distance with no per-frame allocation
function updateLabels(){ const NE=CFG.FOCUS.PLACE_NEAR, FA=CFG.FOCUS.PLACE_FAR, K=CFG.FOCUS.MAX_PLACES, n=placeLabels.length;
  if(_rankIdx.length!==n){ _rankIdx.length=0; for(let i=0;i<n;i++) _rankIdx.push(i); }   // rebuild only if the label set changes
  for(let i=0;i<n;i++) placeLabels[i]._d=lookTarget.distanceTo(placeLabels[i].o.position);
  _rankIdx.sort((a,b)=>placeLabels[a]._d-placeLabels[b]._d);   // in-place sort of the reused index array
  for(let idx=0;idx<n;idx++){ const l=placeLabels[_rankIdx[idx]], d=l._d;
    const op=(idx<K && d<FA)? clamp((FA-d)/(FA-NE),0.18,1) : 0;
    l.div.style.display = op>0.02?"":"none"; l.div.style.opacity=op; } }

/* ===================== CAMERA & DIRECTOR ========================= */
const TITLE_DUR=4.5;
// closing shot: a slow majestic pull-back/orbit over the whole fallen colony (harbour + island + Kowloon)
const OUTRO_CAM={ lng:114.17, lat:22.28, dist:2600, az:0, el:46, orbit:1.0, tween:3.6 };
const _off=new THREE.Vector3();
function spherical(target,dist,azDeg,elDeg){ const a=azDeg*deg, e=elDeg*deg;
  _off.set(Math.sin(a)*Math.cos(e),Math.sin(e),Math.cos(a)*Math.cos(e)).multiplyScalar(dist);
  return target.clone().add(_off); }
function camFromShot(c){ const target=vec(c.lng,c.lat,8); return { target, pos:spherical(target,c.dist*CFG.ZOOM,c.az,c.el) }; }
// aim at the centroid of the shot's focus units so the action is centred & close
function shotTarget(sh){ let x=0,y=0,z=0,n=0;
  (sh.focus||[]).forEach(id=>{ const o=unitById[id]; if(!o) return; const s=sampleTrack(o.u.track,sh.day);
    const v=vec(s.lng,s.lat,0); x+=v.x; y+=v.y; z+=v.z; n++; });
  return n ? new THREE.Vector3(x/n, y/n+8, z/n) : vec(sh.cam.lng,sh.cam.lat,8); }

/* ---- captions (lower-third) ---- */
const $=id=>document.getElementById(id);
function showCap(){ $("caption").classList.add("show"); }
function hideCap(){ $("caption").classList.remove("show"); }
let narrLang="both";              // caption narration language: "both" | "zh" | "en"
let lastNarr={zh:"",en:""};       // remembered so the toggle can re-render the current caption
function setNarr(zh,en){ lastNarr={zh:zh||"",en:en||""};
  $("cap-narr").innerHTML = narrLang==="zh" ? `<span class="nz">${lastNarr.zh}</span>`
    : narrLang==="en" ? `<span class="ne">${lastNarr.en||lastNarr.zh}</span>`
    : `<span class="nz">${lastNarr.zh}</span>`+(lastNarr.en?`<span class="ne">${lastNarr.en}</span>`:""); }
function cycleNarrLang(){ narrLang = narrLang==="both"?"zh":narrLang==="zh"?"en":"both";
  const b=$("lang-btn"); if(b) b.textContent = narrLang==="both"?"中／EN":narrLang==="zh"?"中文":"EN";
  setNarr(lastNarr.zh,lastNarr.en); }
function card(zh,en,narrZh,narrEn){ $("cap-date").textContent=""; $("cap-title").innerHTML=zh+`<span class="en">${en}</span>`;
  setNarr(narrZh,narrEn); $("cap-meta").innerHTML=""; showCap(); }
function sideStrength(sh,side){ let s=0; (sh.focus||[]).forEach(id=>{ const o=unitById[id];
  if(o&&o.u.cf&&o.u.faction===side) s+=sampleTrack(o.u.track,Clock.day).s; }); return s; }
function setCaption(sh){
  $("cap-date").textContent=sh.dateLabel;
  $("cap-title").innerHTML=sh.title_zh+`<span class="en">${sh.title_en}</span>`;
  setNarr(sh.narration_zh,sh.narration_en);
  let meta=(sh.commanders||[]).map(c=>`<span class="cmd">${c.zh}${c.en?(" · "+c.en):""}</span>`).join("");
  const MAXS={jp:16000,uk:8000};
  (sh.side==="both"?["jp","uk"]:[sh.side]).forEach(sd=>{ const v=sideStrength(sh,sd); if(!v) return;
    const pct=clamp(v/MAXS[sd]*100,6,100), nm=sd==="jp"?"日軍":"守軍";
    meta+=`<span class="str ${sd}">${nm} ${v.toLocaleString()}人<span class="bar"><i style="width:${pct}%"></i></span></span>`; });
  $("cap-meta").innerHTML=meta; showCap();
}

/* ---- the Director: plays the storyboard like a TV programme ---- */
const Director = {
  shots:D.storyboard, i:-1, t:0, mode:"title", playing:true, userFree:false, capShown:false,
  fromPos:new THREE.Vector3(), fromTgt:new THREE.Vector3(), tgt:new THREE.Vector3(), fromDay:8, toDay:8,
  start(){ this.mode="title"; this.t=0; this.playing=true; this.userFree=false; setDay(this.shots[0].day);
    const c=camFromShot({lng:114.16,lat:22.33,dist:2600,az:0,el:52}); camera.position.copy(c.pos); controls.target.copy(c.target);
    lookTarget.copy(controls.target);
    card("香港保衛戰","THE BATTLE OF HONG KONG · 1941","1941年12月8日 — 25日 · 十八日戰事 · 「黑色聖誕」","Dec 8 – 25, 1941 · eighteen days · \"Black Christmas\""); },
  enterShot(i){ this.i=i; this.t=0; this.capShown=false; const sh=this.shots[i];
    this.fromDay=Clock.day; this.toDay=sh.day;   // ease the day across the move → smooth day/night + weather
    focusSet=new Set(sh.focus||[]); this.tgt.copy(shotTarget(sh));
    this.fromPos.copy(camera.position); this.fromTgt.copy(controls.target); hideCap(); },
  pauseForUser(){ if(this.mode==="title"||this.userFree) return; this.userFree=true; $("resume").classList.add("show"); },
  resume(){ if(!this.userFree) return; this.userFree=false; $("resume").classList.remove("show");
    if(this.mode==="play"){ this.fromPos.copy(camera.position); this.fromTgt.copy(controls.target); this.t=0; this.capShown=false; hideCap(); }
    this.playing=true; updatePlayBtn(); },
  togglePlay(){ if(this.mode==="outro"){ this.start(); updatePlayBtn(); return; }
    this.playing=!this.playing; updatePlayBtn(); },
  goToShot(i){ i=clamp(i,0,this.shots.length-1);     // jump to a chapter from the timeline axis
    this.userFree=false; $("resume").classList.remove("show"); this.mode="play"; this.playing=true;
    this.enterShot(i); updatePlayBtn(); },
  update(dt){
    if(this.userFree){ lookTarget.copy(controls.target); return; }   // free-look: OrbitControls owns the camera
    if(!this.playing) return;
    this.t+=dt;
    if(this.mode==="title"){ if(this.t>=TITLE_DUR){ hideCap(); this.enterShot(0); this.mode="play"; } return; }
    if(this.mode==="outro"){ const dist=OUTRO_CAM.dist*CFG.ZOOM;
      if(this.t<OUTRO_CAM.tween){ const e=easeIO(this.t/OUTRO_CAM.tween);
        camera.position.lerpVectors(this.fromPos,spherical(this.tgt,dist,OUTRO_CAM.az,OUTRO_CAM.el),e);
        controls.target.lerpVectors(this.fromTgt,this.tgt,e); }
      else { const ot=this.t-OUTRO_CAM.tween;
        controls.target.copy(this.tgt); camera.position.copy(spherical(this.tgt,dist,OUTRO_CAM.az+OUTRO_CAM.orbit*ot*(REDUCE_MOTION?0:1),OUTRO_CAM.el)); }
      lookTarget.copy(controls.target); updateProgress(); return; }
    const sh=this.shots[this.i], dur=CFG.TWEEN+sh.hold, dist=sh.cam.dist*CFG.ZOOM;
    if(this.t<CFG.TWEEN){ const e=easeIO(this.t/CFG.TWEEN);
      setDay(lerp(this.fromDay,this.toDay,e));   // day/night + weather glide as the camera moves
      camera.position.lerpVectors(this.fromPos,spherical(this.tgt,dist,sh.cam.az,sh.cam.el),e);
      controls.target.lerpVectors(this.fromTgt,this.tgt,e); }
    else { const ot=this.t-CFG.TWEEN; setDay(this.toDay);
      controls.target.copy(this.tgt); camera.position.copy(spherical(this.tgt,dist,sh.cam.az+sh.cam.orbit*ot*(REDUCE_MOTION?0:1),sh.cam.el));
      if(!this.capShown){ setCaption(sh); this.capShown=true; } }
    lookTarget.copy(controls.target);
    if(this.t>=dur){
      if(this.i+1<this.shots.length) this.enterShot(this.i+1);
      else { this.mode="outro"; this.t=0; focusSet=new Set();
        this.fromPos.copy(camera.position); this.fromTgt.copy(controls.target);
        this.tgt.copy(vec(OUTRO_CAM.lng,OUTRO_CAM.lat,8));
        card(D.outro.title_zh,D.outro.title_en,D.outro.narration_zh,D.outro.narration_en); updatePlayBtn(); } }
    updateProgress();
  }
};

/* ===================== MINIMAL UI (no control panel) ============= */
function updatePlayBtn(){ $("play").textContent = Director.mode==="outro" ? "↻" : (Director.playing?"⏸":"▶"); }
function updateProgress(){ const N=Director.shots.length; let f=0;
  if(Director.mode==="play"){ const sh=Director.shots[Director.i]; f=(Director.i+clamp(Director.t/(CFG.TWEEN+sh.hold),0,1))/N; }
  else if(Director.mode==="outro") f=1;
  $("prog").firstChild.style.width=(f*100)+"%";
  $("scene-label").textContent = Director.mode==="outro" ? "完 · END"
    : (Director.mode==="play" ? `1941.12.${String(Math.min(25,Math.floor(Clock.day))).padStart(2,"0")}` : ""); }
let kickMusic=()=>{};   // assigned in wireUI to syncMusic → init() starts the MUTED, in-sync soundtrack timeline once audio is buffered + the tour has started (silent; audible only after a deliberate music-button click)
function wireUI(){
  const n=D.notes;
  $("notes-body").innerHTML=`<p>${n.summary}</p><h5>考據與呈現說明 · Caveats</h5><ul>`+
    n.caveats.map(c=>`<li>${c}</li>`).join("")+`</ul><h5>主要來源 · Sources</h5><p>${n.sources}</p>`;
  const np=$("notes");
  $("notes-btn").onclick=()=>np.classList.toggle("open");
  $("notes-close").onclick=()=>np.classList.remove("open");
  $("lang-btn").onclick=cycleNarrLang;
  // background music ("Victoria Harbour 1941") — muted autoplay (silent, in sync with the tour); a DELIBERATE click is the ONLY thing that produces sound
  const bgm=$("bgm"), musicBtn=$("music-btn"); bgm.volume=0.55; bgm.muted=true;   // muted from the start (HTML `muted` attr + re-asserted here) — silent until the user opts in
  let soundOn=false;   // honest default: the user has NOT opted into sound. Governs ONLY audibility (bgm.muted), never the timeline (play/pause).
  const paintMusic=()=>{ musicBtn.textContent=soundOn?"🔊":"🔇"; musicBtn.classList.toggle("off",!soundOn); };   // icon = the user's sound preference (🔇 on load → never reads "on" over a silent first load)
  // the MUTED timeline follows the tour's play/pause ONLY (decoupled from soundOn), so the soundtrack stays in sync for an eventual unmute.
  // muted autoplay is exempt from the browser gesture gate → this play() resolves on load with NO interaction (and stays silent).
  const syncMusic=()=>{ if(Director.playing){ bgm.play().catch(()=>{}); } else { bgm.pause(); } };
  paintMusic();
  // SOLE path to audible sound: a deliberate click flips mute on the already-playing muted element, inside the user gesture (browser-honored).
  // never resets currentTime, so toggling sound never restarts the track; syncMusic() respects a paused tour (sound waits for resume).
  musicBtn.onclick=()=>{ soundOn=!soundOn; bgm.muted=!soundOn; syncMusic(); paintMusic(); };
  kickMusic=syncMusic;   // init() calls this after the tour starts → starts the MUTED, in-sync timeline on load (always allowed; silent)
  $("play").onclick=()=>{ Director.togglePlay(); syncMusic(); };   // pause/resume the tour → pause/resume the (muted) timeline
  $("resume").onclick=()=>{ Director.resume(); syncMusic(); };
  const beats=$("prog-beats"), N=D.storyboard.length;
  D.storyboard.forEach((sh,i)=>{ const b=document.createElement("b"); b.style.left=((i+0.5)/N*100)+"%";
    b.title=sh.dateLabel+" · "+sh.title_zh; beats.appendChild(b); });   // hover a tick to read the chapter
  $("prog").addEventListener("click",e=>{ const r=$("prog").getBoundingClientRect();   // click the time axis to jump to a chapter
    const frac=clamp((e.clientX-r.left)/r.width,0,1); Director.goToShot(Math.round(frac*N-0.5)); });
  controls.addEventListener("start",()=>Director.pauseForUser());   // a user drag pauses the tour
  // auto-hide transport + hint on inactivity
  let idle; const ui=[$("controls"),$("hint")];
  const wake=()=>{ ui.forEach(e=>e.classList.remove("hide")); clearTimeout(idle);
    idle=setTimeout(()=>ui.forEach(e=>e.classList.add("hide")),3500); };
  ["pointermove","pointerdown","keydown","wheel"].forEach(ev=>addEventListener(ev,wake)); wake();
}

/* ===================== ANIMATION LOOP ============================= */
let last=performance.now();
// screen-space label de-collision: after CSS2DRenderer positions the labels,
// push any overlapping ones downward (units have priority, place names yield).
function decollide(){
  const items=[];
  for(const o of unitObjs) if(o.visible && o.lbl.visible && (+o.div.style.opacity||0)>0.05) items.push(o.div);
  for(const o of arrowObjs) if((+o.div.style.opacity||0)>0.05) items.push(o.div);
  if(gdlLabel && gdlLabel.o.visible && (+gdlLabel.div.style.opacity||0)>0.05) items.push(gdlLabel.div);
  if(frontLabel && frontLabel.o.visible) items.push(frontLabel.div);
  for(const l of placeLabels) if(l.div.style.display!=="none" && (+l.div.style.opacity||0)>0.05) items.push(l.div);
  if(items.length<1) return;
  const R=items.map(el=>el.getBoundingClientRect());   // batched reads (one reflow)
  const placed=[];
  // fixed HUD panels are immovable obstacles — a map label must never hide under them
  for(const hudId of ["hud-tl","key"]){ const el=document.getElementById(hudId);
    if(el){ const hb=el.getBoundingClientRect(); if(hb.width>0) placed.push({top:hb.top,bottom:hb.bottom,left:hb.left,right:hb.right}); } }
  for(let i=0;i<items.length;i++){
    const r={top:R[i].top,bottom:R[i].bottom,left:R[i].left,right:R[i].right}; let dy=0, guard=0, moved=true;
    while(moved && guard++<24){ moved=false;
      for(const p of placed){ if(r.left<p.right && r.right>p.left && r.top<p.bottom+3 && r.bottom>p.top){
        const push=p.bottom-r.top+4; dy+=push; r.top+=push; r.bottom+=push; moved=true; } } }
    if(dy) items[i].style.transform+=` translateY(${dy.toFixed(1)}px)`;
    placed.push(r);
  }
}
function renderScene(){ controls.update(); renderer.render(scene,camera); labelRenderer.render(scene,camera); decollide(); }
function frame(dt){
  Director.update(dt);                  // drives camera + clock + captions + focus
  const w=applyWeather(Clock.day);
  updateFront(Clock.day); updateLines(Clock.day); updateUnits(Clock.day); updateArrows(Clock.day);
  updateFlags(); updateEffects(Clock.day,dt); stepRain(dt,w); updateLabels();
  renderScene();
}
function animate(){
  requestAnimationFrame(animate);
  const t=performance.now(); let dt=(t-last)/1000; last=t; if(dt>0.1) dt=0.1; now+=dt;
  frame(dt);
}

/* ===================== ASYNC INIT ================================= */
softTex=makeSoftTex(); GLOW=makeParticleSystem(1800,true,CFG.GLOW_PSCALE); SMOKE=makeParticleSystem(1100,false,CFG.SMOKE_PSCALE); buildFlashes();
function awaitAudio(){   // hold boot until the background mp3 is buffered (10s hard cap so audio can never hang the experience)
  const a=document.getElementById("bgm");
  if(!a || a.readyState>=4) return Promise.resolve();
  return new Promise(res=>{ let done=false; const finish=()=>{ if(!done){done=true;res();} };
    a.addEventListener("canplaythrough",finish,{once:true});
    a.addEventListener("error",finish,{once:true});            // failed load → degrade, don't hang
    setTimeout(finish, 10000);
    try{ a.load(); }catch(e){}
  });
}
(async function init(){
  try{
    // FAC is the single source for the faction colours — push them into the CSS custom properties the legend reads.
    { const hx=n=>"#"+n.toString(16).padStart(6,"0"), rs=document.documentElement.style;
      rs.setProperty("--jp",FAC.jp.css);  rs.setProperty("--jp-glow",hx(FAC.jp.glow));
      rs.setProperty("--uk",FAC.uk.css);  rs.setProperty("--uk-glow",hx(FAC.uk.glow)); }
    renderer.domElement.setAttribute("role","img");
    renderer.domElement.setAttribute("aria-label","互動式 3D 地圖：1941 香港保衛戰 · Interactive 3D map of the Battle of Hong Kong, 1941");
    await loadTiles();
    buildTerrain(); buildLabels(); buildLine(); buildRain();
    D.units.forEach(buildUnit); D.arrows.forEach(buildArrow);
    unitObjs.forEach(o=>{ unitById[o.u.id]=o; });
    wireUI(); applyWeather(D.storyboard[0].day);
    bootMsg("載入配樂 · Loading music…"); await awaitAudio();   // mp3 buffered before the tour begins
    Director.start(); updatePlayBtn(); kickMusic();   // start the MUTED, in-sync soundtrack timeline (muted autoplay is gesture-exempt; silent). Audible sound requires a deliberate music-button click.
    bootMsg("啟動…"); renderScene(); animate();
    setTimeout(()=>{ const b=document.getElementById("boot"); if(b) b.classList.add("gone"); }, 600);
  }catch(e){ fatal(e); }
})();

})();

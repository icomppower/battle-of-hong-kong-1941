/* =====================================================================
 *  crests.js — stylised original unit crests painted to a canvas, and the
 *  per-unit flag texture that stamps one onto a faction banner. Pure art:
 *  depends only on FAC (faction colours). Exports flagTexture().
 * ===================================================================== */
import { FAC } from "./config.js";

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
export function flagTexture(unit){
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

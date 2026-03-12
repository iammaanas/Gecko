/* ═══════════════════════════════════════════════════════════════════
   GECKO LAB — ADHESIVE LOAD SIMULATION ENGINE  v4.0
   ───────────────────────────────────────────────────────────────────
   Physics model: Effective adhesive stress + surface roughness + SF=2

   CORE FORMULA:
     F_adhesion = σ · A · Rc          [N]
     W          = m · g               [N]
     F_required = SF · W = 2 · W      [N]  (safety factor = 2)
     safetyMargin = F_adh / F_req     [dimensionless]

   HAMAKER REFERENCE (per-seta, informational):
     F_vdW = (A_H · R) / (6 · D²)
     A_H ≈ 1×10⁻¹⁹ J  (β-keratin/glass, Israelachvili 1992)
     D   ≈ 0.3–0.4 nm  (spatula–surface equilibrium gap)
     → F_seta ≈ 200 nN  (Autumn et al., Nature 2000, doi:10.1038/35015073)

   SOURCES:
     gecko σ  : Autumn et al. 2002 PNAS 99(19):12252–12256
     tape σ   : Kinloch 1994 "Adhesion and Adhesives" Chapman & Hall
     velcro σ : Velcro Industries datasheet; De Witte et al. 2014
     glue σ   : ASTM D1002 lap-shear; Comyn 1997 "Adhesion Science"
     suction  : P_atm(101,325 Pa) × ~0.69 cup-seal efficiency
     Rc values: Bhushan 2010 "Tribology and Mechanics of Magnetic Storage"
     SF = 2   : Standard structural engineering practice (ISO 4126)
═══════════════════════════════════════════════════════════════════ */

'use strict';

// ──────────────────────────────────────────────────────────────────
//  1. PHYSICS CONSTANTS  (all values sourced, commented)
// ──────────────────────────────────────────────────────────────────
const PHYS = {
  SIGMA: {
    gecko:   100000,   // 100 kPa  — Autumn et al. 2002 PNAS (synthetic setae, normal stress)
    tape:     30000,   //  30 kPa  — Kinloch 1994 (PSA peel/shear, average)
    velcro:   60000,   //  60 kPa  — 6 N/cm² Velcro Industries tech datasheet
    glue:  1500000,   // 1.5 MPa  — ASTM D1002 lap-shear, cyanoacrylate ideal joint
    suction:  70000,   //  70 kPa  — P_atm(101325) × 0.69 seal efficiency
  },
  // Surface roughness contact-efficiency coefficients Rc ∈ (0,1]
  // Rc = fraction of nominal contact area achieving true molecular contact
  // Source: Bhushan 2010; Autumn 2006 JRSI
  RC: {
    glass:    0.95,  // Ra < 1 nm    — atomically smooth, near-perfect spatula contact
    metal:    0.85,  // Ra ≈ 10 nm   — polished finish
    plastic:  0.75,  // Ra ≈ 100 nm  — standard injection-moulded
    painted:  0.65,  // Ra ≈ 1 μm    — brush/roll applied
    concrete: 0.40,  // Ra ≈ 100 μm  — macro-rough, very few real contacts
  },
  SAFETY_FACTOR: 2,     // ISO 4126; standard structural engineering SF
  G_EARTH:       9.81,  // m/s² — standard gravity (NIST)
  HAMAKER:       1e-19, // J   — A_H β-keratin/glass (Israelachvili 1992)
};

// ──────────────────────────────────────────────────────────────────
//  2. ADHESIVE DEFINITIONS
// ──────────────────────────────────────────────────────────────────
const ADHESIVES = {
  gecko: {
    label:'Gecko Tape', sigma:PHYS.SIGMA.gecko,
    mechanism:'Van der Waals — dry, reversible, directional',
    color:'#00f0a0', colorB:'rgba(0,240,160,',
    vacuumOk:true, permanent:false, atmosphericOnly:false,
    note:null, draw:drawGecko,
  },
  tape: {
    label:'Normal Tape (PSA)', sigma:PHYS.SIGMA.tape,
    mechanism:'Pressure-sensitive adhesive (viscoelastic)',
    color:'#c0d8e8', colorB:'rgba(192,216,232,',
    vacuumOk:false, permanent:false, atmosphericOnly:false,
    note:'PSA tape outgasses in hard vacuum (≤10⁻³ Pa) — adhesion degrades significantly over hours. Not rated for space robotics.',
    draw:drawTape,
  },
  velcro: {
    label:'Velcro', sigma:PHYS.SIGMA.velcro,
    mechanism:'Mechanical hook-and-loop interlocking',
    color:'#2ab4ff', colorB:'rgba(42,180,255,',
    vacuumOk:true, permanent:false, atmosphericOnly:false,
    note:'Velcro performance drops ~30% on rough or contaminated surfaces. The Rc penalty applies on top of σ here.',
    draw:drawVelcro,
  },
  glue: {
    label:'Super Glue', sigma:PHYS.SIGMA.glue,
    mechanism:'Covalent/ionic chemical bond (cyanoacrylate)',
    color:'#ffbd59', colorB:'rgba(255,189,89,',
    vacuumOk:true, permanent:true, atmosphericOnly:false,
    note:'Permanent covalent bond — removal is destructive. σ = 1.5 MPa is ideal lap-shear; real joints are lower due to stress concentration at edges.',
    draw:drawGlue,
  },
  suction: {
    label:'Suction Cup', sigma:PHYS.SIGMA.suction,
    mechanism:'Atmospheric pressure differential',
    color:'#64c8ff', colorB:'rgba(100,200,255,',
    vacuumOk:false, permanent:false, atmosphericOnly:true,
    note:null, draw:drawSuction,
  },
};

// ──────────────────────────────────────────────────────────────────
//  3. DOM REFERENCES
// ──────────────────────────────────────────────────────────────────
const DOM = {
  massInput:     document.getElementById('massInput'),
  gravityInput:  document.getElementById('gravityInput'),
  areaSlider:    document.getElementById('areaSlider'),
  areaValue:     document.getElementById('areaValue'),
  canvas:        document.getElementById('simCanvas'),
  fAdh:          document.getElementById('fAdh'),
  fWeight:       document.getElementById('fWeight'),
  fReq:          document.getElementById('fReq'),
  fSafety:       document.getElementById('fSafety'),
  fMax:          document.getElementById('fMax'),
  safetyBar:     document.getElementById('safetyBar'),
  warningBanner: document.getElementById('warningBanner'),
};

const ctx = DOM.canvas.getContext('2d');

// ──────────────────────────────────────────────────────────────────
//  4. SIMULATION STATE
// ──────────────────────────────────────────────────────────────────
const SIM = {
  type:'gecko', surfKey:'glass', Rc:PHYS.RC.glass,
  mass:8, g:PHYS.G_EARTH, areaCm2:10,
};

let slipOffset = 0;
let simTime    = 0;
let lastResult = null;

// ──────────────────────────────────────────────────────────────────
//  5. PHYSICS ENGINE  (pure function — no DOM side-effects)
// ──────────────────────────────────────────────────────────────────
function computePhysics({ type, Rc, mass, g, areaCm2 }) {
  const adh    = ADHESIVES[type];
  const areaM2 = areaCm2 / 10000;          // cm² → m²

  // Atmospheric proxy: g < 0.05 treated as vacuum/ISS
  const isVacuum = g < 0.05;
  const isLowAtm = g < 2.0 && adh.atmosphericOnly;

  // F_adhesion = σ · A · Rc  [N]
  let F_adh = (adh.atmosphericOnly && isVacuum) ? 0 : adh.sigma * areaM2 * Rc;
  F_adh = Math.max(0, F_adh);

  // W = m · g  [N]
  const F_weight = Math.max(0, mass * g);

  // F_required = SF · W = 2 · W  [N]
  const F_req = PHYS.SAFETY_FACTOR * F_weight;

  // safetyMargin = F_adh / F_req  (dimensionless; Inf when weightless)
  const safetyMargin = F_req < 1e-9
    ? (F_adh > 0 ? Infinity : 1)
    : F_adh / F_req;

  // Maximum mass supportable at current params with SF=2
  let maxMass;
  if (adh.atmosphericOnly && isVacuum) { maxMass = 0; }
  else if (g < 1e-4)                   { maxMass = Infinity; }
  else { maxMass = F_adh / (g * PHYS.SAFETY_FACTOR); }

  // Status classification
  let status;
  if      (adh.atmosphericOnly && isVacuum) status = 'NO HOLD';
  else if (!isFinite(safetyMargin))         status = 'HOLD ∞';
  else if  (safetyMargin >= 1.0)            status = 'SAFE';      // meets SF=2
  else if  (F_adh >= F_weight)              status = 'MARGINAL';  // holds but <SF
  else                                      status = 'FAIL';

  return { areaM2, F_adh, F_weight, F_req, safetyMargin, maxMass, status, isVacuum, isLowAtm };
}

// ──────────────────────────────────────────────────────────────────
//  6. UI UPDATE
// ──────────────────────────────────────────────────────────────────
function fmtN(n) {
  if (!isFinite(n)) return '∞';
  return Math.abs(n) >= 1000 ? (n/1000).toFixed(2)+' kN' : n.toFixed(2)+' N';
}

function updateUI(r) {
  if (!DOM.fAdh) return;  // guard: DOM not ready

  DOM.fAdh.textContent    = fmtN(r.F_adh);
  DOM.fWeight.textContent = fmtN(r.F_weight);
  DOM.fReq.textContent    = fmtN(r.F_req);

  // Safety margin
  if (!isFinite(r.safetyMargin)) {
    DOM.fSafety.textContent = '∞ (weightless)';
    DOM.fSafety.style.color = '#00f0a0';
  } else {
    DOM.fSafety.textContent = r.safetyMargin.toFixed(3) + '×';
    DOM.fSafety.style.color = r.safetyMargin >= 1 ? '#00f0a0' : r.safetyMargin >= 0.5 ? '#ffbd59' : '#ff5252';
  }

  // Safety bar (0–100% represents 0–2× required force)
  const barPct = isFinite(r.safetyMargin) ? Math.min(1, r.safetyMargin/2)*100 : 100;
  DOM.safetyBar.style.width      = barPct.toFixed(1)+'%';
  DOM.safetyBar.style.background = r.safetyMargin>=1 ? '#00f0a0' : r.safetyMargin>=0.5 ? '#ffbd59' : '#ff5252';

  // Max mass
  if (r.maxMass === 0) {
    DOM.fMax.innerHTML = '<span style="color:#ff5252">0 kg (no hold)</span>';
  } else if (!isFinite(r.maxMass)) {
    DOM.fMax.innerHTML = '<span style="color:#00f0a0">∞  (weightless)</span>';
  } else {
    const c = r.maxMass >= SIM.mass ? '#00f0a0' : '#ff5252';
    DOM.fMax.innerHTML = '<span style="color:'+c+'">'+r.maxMass.toFixed(2)+' kg</span>';
  }

  // Warnings
  const warns = [];
  const adh = ADHESIVES[SIM.type];
  if (adh.atmosphericOnly && r.isVacuum)
    warns.push('⚠ Suction cups need atmospheric pressure. In ISS / vacuum (P ≈ 10⁻⁶ Pa) the pressure differential is zero — no holding force.');
  if (r.isLowAtm)
    warns.push('⚠ Mars (0.6 kPa) and Moon (~10⁻¹⁰ Pa) have negligible atmospheres. Suction cup figures here assume Earth-level atmospheric pressure.');
  if (SIM.type === 'tape' && r.isVacuum)
    warns.push('⚠ PSA tape outgasses in hard vacuum — adhesion degrades over hours and it is not rated for space environments.');
  if (adh.permanent)
    warns.push('ℹ Super glue forms a permanent covalent bond. Removal is destructive — unlike gecko tape, it cannot be reattached cleanly.');
  if (SIM.surfKey === 'concrete' && SIM.type === 'gecko')
    warns.push('ℹ On concrete (Rc = 0.40) only ~40% of spatulae achieve nanoscale contact. Real geckos flex their setae to recover some Rc; rigid synthetic tapes show larger losses on macro-rough surfaces.');
  if (r.status === 'MARGINAL')
    warns.push('△ Safety factor < 2. The adhesive holds the load (F_adh ≥ W) but does not meet the engineering design requirement (F_adh ≥ 2W). Increase area or reduce mass.');
  if (r.status === 'FAIL')
    warns.push('⛔ Adhesive force is less than gravitational load — the system detaches. Increase contact area, switch adhesive, or reduce mass.');
  if (adh.note) warns.push('ℹ ' + adh.note);

  DOM.warningBanner.innerHTML = warns.join('<br><br>');
  DOM.warningBanner.classList.toggle('visible', warns.length > 0);
}

// ──────────────────────────────────────────────────────────────────
//  7. CANVAS HELPERS
// ──────────────────────────────────────────────────────────────────
const C = {
  teal:'#00f0a0', tA:'rgba(0,240,160,', blue:'#2ab4ff', bA:'rgba(42,180,255,',
  amber:'#ffbd59', aA:'rgba(255,189,89,', red:'#ff5252', bg:'#020c12', bgL:'#071420', wall:'#0d1e2e',
};
const clamp = (v,a,b) => Math.min(b,Math.max(a,v));

function arrow(x1,y1,x2,y2,color,label){
  const ang=Math.atan2(y2-y1,x2-x1),hs=10;
  ctx.save();
  ctx.strokeStyle=ctx.fillStyle=color; ctx.lineWidth=2.2;
  ctx.shadowColor=color; ctx.shadowBlur=6;
  ctx.beginPath();ctx.moveTo(x1,y1);ctx.lineTo(x2,y2);ctx.stroke();
  ctx.beginPath();ctx.moveTo(x2,y2);
  ctx.lineTo(x2-hs*Math.cos(ang-Math.PI/6),y2-hs*Math.sin(ang-Math.PI/6));
  ctx.lineTo(x2-hs*Math.cos(ang+Math.PI/6),y2-hs*Math.sin(ang+Math.PI/6));
  ctx.closePath();ctx.fill();
  ctx.shadowBlur=0;
  ctx.font="11px 'JetBrains Mono',monospace"; ctx.fillText(label,x2+10,y2-4);
  ctx.restore();
}

function drawGrid(W,H){
  ctx.strokeStyle='rgba(0,240,160,.022)';ctx.lineWidth=1;
  for(let x=0;x<W;x+=48){ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,H);ctx.stroke()}
  for(let y=0;y<H;y+=48){ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(W,y);ctx.stroke()}
}

function drawWall(wallX,H){
  ctx.fillStyle=C.wall;ctx.fillRect(wallX-34,18,34,H-36);
  ctx.shadowColor=C.teal;ctx.shadowBlur=12;
  ctx.strokeStyle='rgba(0,240,160,.35)';ctx.lineWidth=2;
  ctx.beginPath();ctx.moveTo(wallX,18);ctx.lineTo(wallX,H-18);ctx.stroke();
  ctx.shadowBlur=0;
  ctx.strokeStyle='rgba(255,255,255,.05)';ctx.lineWidth=1;
  for(let y=18;y<H-18;y+=22){ctx.beginPath();ctx.moveTo(wallX-34,y);ctx.lineTo(wallX,y);ctx.stroke()}
}

function drawMassBlock(linkX,tapeBottom,result){
  const mNorm=clamp((SIM.mass-.18)/(70-.18),0,1);
  const sz=36+mNorm*68, bx=linkX-sz/2, by=tapeBottom+46+slipOffset;
  const fail=result.status==='FAIL'||result.status==='NO HOLD';
  ctx.save();
  ctx.strokeStyle='rgba(0,240,160,.35)';ctx.lineWidth=2.5;ctx.setLineDash([4,3]);
  ctx.beginPath();ctx.moveTo(linkX,tapeBottom+slipOffset);ctx.lineTo(linkX,by);ctx.stroke();
  ctx.setLineDash([]);ctx.restore();
  const bg=ctx.createLinearGradient(bx,by,bx+sz,by+sz);
  bg.addColorStop(0,'#1a3045');bg.addColorStop(1,'#0d1e2e');
  ctx.fillStyle=bg;ctx.fillRect(bx,by,sz,sz);
  ctx.shadowColor=fail?C.red:C.teal;ctx.shadowBlur=8;
  ctx.strokeStyle=fail?'rgba(255,82,82,.5)':'rgba(0,240,160,.25)';
  ctx.lineWidth=1;ctx.strokeRect(bx,by,sz,sz);ctx.shadowBlur=0;
  ctx.fillStyle='rgba(0,240,160,.85)';
  ctx.font="bold 11px 'JetBrains Mono',monospace";ctx.textAlign='center';
  ctx.fillText(SIM.mass.toFixed(2)+' kg',bx+sz/2,by+sz/2+4);
  ctx.textAlign='left';
  return {bx,by,sz};
}

// ──────────────────────────────────────────────────────────────────
//  8. PER-ADHESIVE DRAWERS
// ──────────────────────────────────────────────────────────────────
function drawGecko(wallX,W,H,tapeTop,tapeH,tapeW){
  const tapeX=wallX+2,rc=SIM.Rc;
  const tg=ctx.createLinearGradient(tapeX,0,tapeX+tapeW,0);
  tg.addColorStop(0,'rgba(0,220,140,.9)');tg.addColorStop(1,'rgba(0,180,110,.7)');
  ctx.fillStyle=tg;ctx.fillRect(tapeX,tapeTop,tapeW,tapeH);
  ctx.strokeStyle='rgba(0,100,70,.5)';ctx.lineWidth=0.7;
  for(let i=0;i<Math.floor(tapeH/5);i++){
    const sy=tapeTop+i*5+2,lean=Math.sin(i*.7+simTime*.8)*1.5;
    ctx.beginPath();ctx.moveTo(tapeX+2,sy);ctx.lineTo(tapeX+2+lean,sy-4);ctx.stroke();
  }
  ctx.shadowColor=C.teal;ctx.shadowBlur=12*rc;
  ctx.fillStyle=C.tA+(0.15+rc*.5)+')';ctx.fillRect(wallX-5,tapeTop,7,tapeH);ctx.shadowBlur=0;
  if(rc>0.4){
    for(let i=0;i<8;i++){
      const py=tapeTop+(i/7)*tapeH,pulse=0.4+0.35*Math.sin(simTime*2.5+i*1.3);
      ctx.shadowColor=C.teal;ctx.shadowBlur=8;
      ctx.fillStyle=C.tA+(pulse*rc)+')';
      ctx.beginPath();ctx.arc(wallX-2,py,2.8,0,Math.PI*2);ctx.fill();
    }
    ctx.shadowBlur=0;
  }
  ctx.fillStyle='rgba(0,240,160,.7)';ctx.font="10px 'JetBrains Mono',monospace";
  ctx.fillText('van der Waals',tapeX+tapeW+7,tapeTop+28);
}

function drawTape(wallX,W,H,tapeTop,tapeH,tapeW){
  const tapeX=wallX+2,rc=SIM.Rc;
  ctx.fillStyle=`rgba(200,225,242,${0.75+rc*.2})`;ctx.fillRect(tapeX,tapeTop,tapeW,tapeH);
  ctx.strokeStyle='rgba(180,205,225,.25)';ctx.lineWidth=1;
  for(let y=tapeTop;y<tapeTop+tapeH;y+=7){ctx.beginPath();ctx.moveTo(tapeX,y);ctx.lineTo(tapeX+tapeW,y);ctx.stroke()}
  ctx.shadowColor=C.amber;ctx.shadowBlur=8*rc;
  ctx.fillStyle=C.aA+(0.18+rc*.4)+')';ctx.fillRect(wallX-5,tapeTop,7,tapeH);ctx.shadowBlur=0;
  ctx.fillStyle='rgba(200,225,242,.65)';ctx.font="10px 'JetBrains Mono',monospace";
  ctx.fillText('PSA adhesive',tapeX+tapeW+7,tapeTop+28);
}

function drawVelcro(wallX,W,H,tapeTop,tapeH,tapeW){
  const tapeX=wallX+2,rc=SIM.Rc;
  ctx.fillStyle='#1a3a5c';ctx.fillRect(tapeX,tapeTop,tapeW,tapeH);
  ctx.strokeStyle=C.bA+(0.5+rc*.4)+')';ctx.lineWidth=1;
  for(let i=0;i<Math.floor(tapeH/5);i++){
    const hy=tapeTop+i*5+3;
    ctx.beginPath();ctx.moveTo(tapeX+2,hy);ctx.lineTo(tapeX+2,hy-3);
    ctx.quadraticCurveTo(tapeX+8,hy-3,tapeX+8,hy);ctx.stroke();
  }
  ctx.shadowColor=C.blue;ctx.shadowBlur=10*rc;
  ctx.fillStyle=C.bA+(0.22+rc*.45)+')';ctx.fillRect(wallX-5,tapeTop,7,tapeH);ctx.shadowBlur=0;
  ctx.fillStyle=C.bA+'0.65)';ctx.font="10px 'JetBrains Mono',monospace";
  ctx.fillText('hook & loop',tapeX+tapeW+7,tapeTop+28);
}

function drawGlue(wallX,W,H,tapeTop,tapeH,tapeW){
  const tapeX=wallX+2,rc=SIM.Rc;
  const gg=ctx.createLinearGradient(tapeX,tapeTop,tapeX+tapeW,tapeTop+tapeH);
  gg.addColorStop(0,'#9a5200');gg.addColorStop(.5,'#c86a00');gg.addColorStop(1,'#7a4000');
  ctx.fillStyle=gg;ctx.fillRect(tapeX,tapeTop,tapeW,tapeH);
  ctx.fillStyle='rgba(255,210,100,.18)';ctx.fillRect(tapeX+2,tapeTop+2,tapeW-4,tapeH*.38);
  for(let i=0;i<Math.floor(tapeH/6);i++){
    const py=tapeTop+i*6+3,pulse=0.6+0.2*Math.sin(simTime*1.5+i*.5);
    ctx.shadowColor=C.amber;ctx.shadowBlur=4;
    ctx.fillStyle=C.aA+(pulse*rc)+')';ctx.beginPath();ctx.arc(wallX-1,py,1.8,0,Math.PI*2);ctx.fill();
  }
  ctx.shadowBlur=0;
  if(rc>0.5){ctx.fillStyle='rgba(255,180,50,.45)';ctx.font="bold 8px 'JetBrains Mono',monospace";ctx.textAlign='center';ctx.fillText('PERM',tapeX+tapeW/2,tapeTop+tapeH/2+3);ctx.textAlign='left'}
  ctx.fillStyle=C.aA+'0.65)';ctx.font="10px 'JetBrains Mono',monospace";
  ctx.fillText('chem. bond',tapeX+tapeW+7,tapeTop+28);
}

function drawSuction(wallX,W,H,tapeTop,tapeH,tapeW){
  const tapeX=wallX+2,rc=SIM.Rc,fail=lastResult&&lastResult.status==='NO HOLD';
  const cx2=tapeX+tapeW/2,cy2=tapeTop+tapeH/2,rO=tapeH*.44;
  ctx.shadowColor=fail?C.red:'#64c8ff';ctx.shadowBlur=10;
  ctx.strokeStyle=fail?'rgba(255,82,82,.7)':`rgba(100,200,255,${0.5+rc*.45})`;
  ctx.lineWidth=3;ctx.beginPath();ctx.arc(cx2,cy2,rO,0,Math.PI*2);ctx.stroke();ctx.shadowBlur=0;
  const cg=ctx.createRadialGradient(cx2,cy2,rO*.2,cx2,cy2,rO);
  if(fail){cg.addColorStop(0,'rgba(255,82,82,.06)');cg.addColorStop(1,'rgba(255,82,82,.18)')}
  else{cg.addColorStop(0,`rgba(0,80,180,${.35*rc})`);cg.addColorStop(1,`rgba(40,120,220,${.1*rc})`)}
  ctx.fillStyle=cg;ctx.beginPath();ctx.arc(cx2,cy2,rO-1,0,Math.PI*2);ctx.fill();
  if(!fail&&rc>0.35){
    for(let i=0;i<8;i++){
      const ang=(i/8)*Math.PI*2,x1=cx2+Math.cos(ang)*(rO+16),y1=cy2+Math.sin(ang)*(rO+16);
      const x2=cx2+Math.cos(ang)*(rO+4),y2=cy2+Math.sin(ang)*(rO+4);
      const aA=0.3+0.3*Math.sin(simTime*2+i*.8);
      ctx.strokeStyle=`rgba(100,200,255,${aA*rc})`;ctx.lineWidth=1.5;
      ctx.shadowColor='#64c8ff';ctx.shadowBlur=4;
      ctx.beginPath();ctx.moveTo(x1,y1);ctx.lineTo(x2,y2);ctx.stroke();
    }
    ctx.shadowBlur=0;
  }
  if(fail){
    ctx.shadowColor=C.red;ctx.shadowBlur=10;ctx.strokeStyle=C.red;ctx.lineWidth=2.5;
    ctx.beginPath();ctx.moveTo(cx2-12,cy2-12);ctx.lineTo(cx2+12,cy2+12);ctx.stroke();
    ctx.beginPath();ctx.moveTo(cx2+12,cy2-12);ctx.lineTo(cx2-12,cy2+12);ctx.stroke();ctx.shadowBlur=0;
  }
  ctx.fillStyle=fail?C.red:'rgba(100,200,255,.65)';ctx.font="10px 'JetBrains Mono',monospace";
  ctx.fillText(fail?'no atmosphere!':'atm. pressure',tapeX+tapeW+7,tapeTop+28);
}

// ──────────────────────────────────────────────────────────────────
//  9. MAIN SCENE RENDERER
// ──────────────────────────────────────────────────────────────────
function drawScene(){
  const W=DOM.canvas.clientWidth,H=DOM.canvas.clientHeight;
  if(W<2||H<2) return;
  const r=lastResult||computePhysics(SIM);
  const fail=r.status==='FAIL'||r.status==='NO HOLD';

  ctx.clearRect(0,0,W,H);
  const bg=ctx.createLinearGradient(0,0,0,H);
  bg.addColorStop(0,C.bgL);bg.addColorStop(1,C.bg);
  ctx.fillStyle=bg;ctx.fillRect(0,0,W,H);
  drawGrid(W,H);

  const wallX=W*.18;
  drawWall(wallX,H);
  ctx.fillStyle='rgba(0,240,160,.3)';ctx.font="10px 'JetBrains Mono',monospace";
  ctx.fillText('RIGID SURFACE',wallX-82,16);

  const aNorm=clamp((SIM.areaCm2-1)/199,0,1);
  const tapeH=55+aNorm*135,tapeW=22,tapeY0=H*.22;

  if(fail){
    const deficit=clamp(1-r.F_adh/Math.max(r.F_weight,1e-9),0,1);
    slipOffset+=0.85+deficit*3.5;
  } else { slipOffset*=0.76; }
  slipOffset=clamp(slipOffset,0,Math.max(12,H-tapeY0-tapeH-140));

  const tapeTop=tapeY0+slipOffset,linkX=wallX+tapeW+2;
  const adh=ADHESIVES[SIM.type];
  adh.draw(wallX,W,H,tapeTop,tapeH,tapeW);

  ctx.fillStyle=adh.color;ctx.font="bold 11px 'JetBrains Mono',monospace";
  ctx.fillText(adh.label,wallX+tapeW+7,tapeTop+14);

  const bi=drawMassBlock(linkX,tapeTop+tapeH,r);

  const wScale=clamp(r.F_weight/400,.1,1),aScale=clamp(r.F_adh/400,.1,1);
  arrow(bi.bx+bi.sz/2,bi.by+bi.sz*.35,bi.bx+bi.sz/2,bi.by+bi.sz*.35+32+wScale*95,C.red,'W='+r.F_weight.toFixed(1)+'N');
  if(r.F_adh>0){
    const ax=wallX+tapeW+46,ay=tapeTop+tapeH*.42;
    arrow(ax,ay,ax-32-aScale*80,ay,C.teal,'F='+r.F_adh.toFixed(1)+'N');
  } else {
    ctx.fillStyle=C.red;ctx.font="11px 'JetBrains Mono',monospace";
    ctx.fillText('No hold',wallX+tapeW+8,tapeTop+tapeH*.45);
  }

  const sC={SAFE:C.teal,'HOLD ∞':C.teal,MARGINAL:C.amber,FAIL:C.red,'NO HOLD':C.red};
  ctx.font="11px 'JetBrains Mono',monospace";ctx.fillStyle=sC[r.status]||C.teal;
  if(fail) ctx.fillText('⚠ Detaching…',wallX+tapeW+8,tapeTop+tapeH+20+slipOffset*.15);
  else if(r.status==='MARGINAL') ctx.fillText('△ Marginal — SF < 2',wallX+tapeW+8,tapeTop+tapeH+20);
  else{
    const sfStr=isFinite(r.safetyMargin)?r.safetyMargin.toFixed(2)+'×':'∞';
    ctx.fillText('✓ Safe  SF = '+sfStr,wallX+tapeW+8,tapeTop+tapeH+20);
  }

  ctx.fillStyle='rgba(0,240,160,.3)';ctx.font="10px 'JetBrains Mono',monospace";
  const gLbl=SIM.g<0.05?'g ≈ 0 m/s² (ISS)':'g = '+SIM.g.toFixed(2)+' m/s²';
  ctx.fillText(gLbl,W-158,H-22);
  ctx.fillText('Rc = '+SIM.Rc.toFixed(2)+'  ('+SIM.surfKey+')',W-158,H-10);
  ctx.fillText(adh.mechanism,10,H-10);

  simTime+=0.018;
}

// ──────────────────────────────────────────────────────────────────
//  10. MAIN UPDATE (inputs → physics → UI)
// ──────────────────────────────────────────────────────────────────
function updateSim(){
  SIM.mass    = Math.max(0.001, parseFloat(DOM.massInput.value)   || 0.001);
  SIM.g       = Math.max(0,     parseFloat(DOM.gravityInput.value) || 0);
  SIM.areaCm2 = parseFloat(DOM.areaSlider.value) || 10;
  DOM.areaValue.textContent = SIM.areaCm2.toFixed(0);
  lastResult = computePhysics(SIM);
  updateUI(lastResult);
}

// ──────────────────────────────────────────────────────────────────
//  11. EVENT WIRING
// ──────────────────────────────────────────────────────────────────
document.querySelectorAll('.adh-btn').forEach(btn=>btn.addEventListener('click',()=>{
  document.querySelectorAll('.adh-btn').forEach(b=>b.classList.remove('active'));
  btn.classList.add('active'); SIM.type=btn.dataset.type; slipOffset=0; updateSim();
}));
document.querySelectorAll('.surf-btn').forEach(btn=>btn.addEventListener('click',()=>{
  document.querySelectorAll('.surf-btn').forEach(b=>b.classList.remove('active'));
  btn.classList.add('active'); SIM.surfKey=btn.dataset.surf; SIM.Rc=parseFloat(btn.dataset.rc); updateSim();
}));
document.querySelectorAll('.preset-g').forEach(btn=>btn.addEventListener('click',()=>{
  document.querySelectorAll('.preset-g').forEach(b=>b.classList.remove('active'));
  btn.classList.add('active'); DOM.gravityInput.value=btn.dataset.g; updateSim();
}));
document.querySelectorAll('[data-mass]').forEach(btn=>btn.addEventListener('click',()=>{
  document.querySelectorAll('[data-mass]').forEach(b=>b.classList.remove('active'));
  btn.classList.add('active'); DOM.massInput.value=btn.dataset.mass; updateSim();
}));
DOM.gravityInput.addEventListener('input',()=>{document.querySelectorAll('.preset-g').forEach(b=>b.classList.remove('active'));updateSim()});
DOM.massInput.addEventListener('input',()=>{document.querySelectorAll('[data-mass]').forEach(b=>b.classList.remove('active'));updateSim()});
DOM.areaSlider.addEventListener('input',updateSim);

// ──────────────────────────────────────────────────────────────────
//  12. RESIZE + ANIMATION LOOP
// ──────────────────────────────────────────────────────────────────
function resizeCanvas(){
  const dpr=Math.min(window.devicePixelRatio||1,2),rect=DOM.canvas.getBoundingClientRect();
  DOM.canvas.width=Math.round(rect.width*dpr);DOM.canvas.height=Math.round(rect.height*dpr);
  ctx.setTransform(dpr,0,0,dpr,0,0);
}
window.addEventListener('resize',resizeCanvas);
function loop(){drawScene();requestAnimationFrame(loop)}

updateSim(); resizeCanvas(); loop();

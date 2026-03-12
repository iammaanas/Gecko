/* ═══════════════════════════════════════════════════════════════════
   GECKO LAB — VAN DER WAALS FORCE EXPLORER  v3.0
   ───────────────────────────────────────────────────────────────────
   PHYSICS MODEL:
     London dispersion force (a subset of van der Waals):
     F ∝ 1/r⁶  (Lennard-Jones attractive branch)

     Relative force normalised to r_min = 0.3 nm:
       F_rel(r) = (r_min / r)⁶  ∈ (0, 1]

     Adhesion index:
       A_idx = F_rel(r) × η_contact  ∈ [0, 1]

     where η_contact = fraction of spatulae in true molecular contact.

   HAMAKER MACROSCALE LIMIT (sphere-flat geometry):
     F_vdW = (A_H × R) / (6 × D²)
     A_H ≈ 1×10⁻¹⁹ J  (β-keratin / glass, Israelachvili 1992)
     D   ≈ 0.3–0.4 nm  (equilibrium gap, Autumn 2002)
     R   ≈ 100 nm       (spatula tip radius)
     → F_seta ≈ 200 nN per seta  (Autumn et al., Nature 2000)

   DIMENSIONAL NOTE:
     F_rel is dimensionless — it represents relative force strength
     compared to maximum contact at r = 0.3 nm. It does NOT have
     units of force on its own. Real force requires Hamaker integration.

   SOURCES:
     Autumn et al. 2000 Nature 405:681 doi:10.1038/35079073
     Autumn et al. 2002 PNAS 99:12252 doi:10.1073/pnas.192252799
     Israelachvili 1992 "Intermolecular and Surface Forces" Academic Press
═══════════════════════════════════════════════════════════════════ */

const distanceSlider = document.getElementById("distanceSlider");
const contactSlider  = document.getElementById("contactSlider");
const distanceValue  = document.getElementById("distanceValue");
const contactValue   = document.getElementById("contactValue");
const forceValue     = document.getElementById("forceValue");
const adhesionIndex  = document.getElementById("adhesionIndex");
const contactSpots   = document.getElementById("contactSpots");
const modeLabel      = document.getElementById("modeLabel");
const statusChip     = document.getElementById("statusChip");
const canvas         = document.getElementById("vdwGraph");
const ctx            = canvas.getContext("2d");

let state = { r:0.6, contactPercent:75, relativeForce:0, adhesion:0, mode:"Strong" };
let animT = 0;

function resizeCanvas() {
  const dpr  = Math.min(window.devicePixelRatio||1,2);
  const rect = canvas.getBoundingClientRect();
  canvas.width  = Math.round(rect.width  * dpr);
  canvas.height = Math.round(rect.height * dpr);
  ctx.setTransform(dpr,0,0,dpr,0,0);
  draw();
}

function draw() {
  const W = canvas.clientWidth, H = canvas.clientHeight;
  if (W < 2 || H < 2) return;
  ctx.clearRect(0,0,W,H);

  // Background
  const bg = ctx.createLinearGradient(0,0,0,H);
  bg.addColorStop(0,"#040f18"); bg.addColorStop(1,"#020c12");
  ctx.fillStyle = bg; ctx.fillRect(0,0,W,H);

  // Grid
  ctx.strokeStyle = "rgba(0,240,160,.04)"; ctx.lineWidth = 1;
  for (let x=0;x<W;x+=40){ ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,H);ctx.stroke() }
  for (let y=0;y<H;y+=40){ ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(W,y);ctx.stroke() }

  const pad = { l:60, r:Math.min(280, W*0.38), t:28, b:36 };
  const plotW = W - pad.l - pad.r;
  const plotH = H - pad.t - pad.b;

  // Axes
  ctx.strokeStyle = "rgba(0,240,160,.25)"; ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(pad.l,pad.t); ctx.lineTo(pad.l,pad.t+plotH);
  ctx.lineTo(pad.l+plotW,pad.t+plotH);
  ctx.stroke();

  // Axis labels
  ctx.fillStyle = "rgba(122,160,184,.65)";
  ctx.font = "11px 'JetBrains Mono',monospace";
  ctx.fillText("F (relative)", 8, pad.t+8);
  ctx.fillText("distance r (nm) →", pad.l+plotW-100, pad.t+plotH+28);

  // Tick marks
  const minR=0.3,maxR=2.0;
  [0.5,1.0,1.5,2.0].forEach(r => {
    const tx = pad.l + ((r-minR)/(maxR-minR))*plotW;
    ctx.strokeStyle = "rgba(0,240,160,.15)"; ctx.lineWidth=1;
    ctx.beginPath(); ctx.moveTo(tx,pad.t); ctx.lineTo(tx,pad.t+plotH); ctx.stroke();
    ctx.fillStyle = "rgba(122,160,184,.5)";
    ctx.font = "10px 'JetBrains Mono',monospace"; ctx.textAlign="center";
    ctx.fillText(r.toFixed(1), tx, pad.t+plotH+16);
  });
  ctx.textAlign = "left";

  // VdW curve with gradient fill
  ctx.beginPath();
  for (let i=0;i<=300;i++) {
    const t = i/300;
    const r = minR + t*(maxR-minR);
    const yNorm = Math.pow(minR/r, 6);
    const x = pad.l + t*plotW;
    const y = pad.t + plotH - yNorm*plotH;
    i===0 ? ctx.moveTo(x,y) : ctx.lineTo(x,y);
  }
  // Close for fill
  ctx.lineTo(pad.l+plotW, pad.t+plotH);
  ctx.lineTo(pad.l, pad.t+plotH);

  const fillG = ctx.createLinearGradient(0,pad.t,0,pad.t+plotH);
  fillG.addColorStop(0,"rgba(0,240,160,.12)");
  fillG.addColorStop(1,"rgba(0,240,160,.01)");
  ctx.fillStyle = fillG; ctx.fill();

  // Redraw line on top
  ctx.beginPath();
  for (let i=0;i<=300;i++) {
    const t = i/300;
    const r = minR + t*(maxR-minR);
    const yNorm = Math.pow(minR/r,6);
    const x = pad.l + t*plotW;
    const y = pad.t + plotH - yNorm*plotH;
    i===0 ? ctx.moveTo(x,y) : ctx.lineTo(x,y);
  }
  ctx.strokeStyle = "#00f0a0"; ctx.lineWidth = 2.2;
  ctx.shadowColor = "rgba(0,240,160,.4)"; ctx.shadowBlur = 8;
  ctx.stroke(); ctx.shadowBlur = 0;

  // Current point
  const ct = (state.r - minR) / (maxR - minR);
  const cyNorm = Math.pow(minR/state.r, 6);
  const cx = pad.l + ct*plotW;
  const cy = pad.t + plotH - cyNorm*plotH;

  // Dashed drop line
  ctx.strokeStyle = "rgba(255,189,89,.4)"; ctx.lineWidth=1;
  ctx.setLineDash([5,5]);
  ctx.beginPath(); ctx.moveTo(cx,cy); ctx.lineTo(cx,pad.t+plotH); ctx.stroke();
  ctx.setLineDash([]);

  // Glow point
  const glow = ctx.createRadialGradient(cx,cy,0,cx,cy,12);
  glow.addColorStop(0,"rgba(255,189,89,.9)");
  glow.addColorStop(0.4,"rgba(255,189,89,.4)");
  glow.addColorStop(1,"rgba(255,189,89,0)");
  ctx.fillStyle = glow;
  ctx.beginPath(); ctx.arc(cx,cy,12,0,Math.PI*2); ctx.fill();
  ctx.fillStyle = "#ffbd59";
  ctx.beginPath(); ctx.arc(cx,cy,5,0,Math.PI*2); ctx.fill();

  // Label
  ctx.fillStyle = "#ffdb9b"; ctx.font = "bold 11px 'JetBrains Mono',monospace";
  ctx.fillText(`r=${state.r.toFixed(2)} nm`, cx+10, cy-8);

  // ── Micro-contact panel (right side) ──────────────────────────
  const px = W - pad.r + 12, py = 16, pw = pad.r-20, ph = Math.min(200,H*0.46);

  ctx.fillStyle = "rgba(6,20,32,.9)";
  ctx.strokeStyle = "rgba(0,240,160,.18)"; ctx.lineWidth=1;
  ctx.beginPath(); ctx.roundRect(px,py,pw,ph,10); ctx.fill(); ctx.stroke();

  ctx.fillStyle = "rgba(0,240,160,.7)"; ctx.font = "bold 10px 'JetBrains Mono',monospace";
  ctx.textAlign="center"; ctx.fillText("MICRO-CONTACTS",px+pw/2,py+16); ctx.textAlign="left";

  // Contact dots grid
  const total = 30;
  const active = Math.round((state.contactPercent/100)*total);
  const cols=6, rows=5;
  const dotS = Math.min((pw-20)/cols, (ph-40)/rows) * .65;
  const dotPad = dotS * 1.45;
  const gridX = px + (pw - (cols-1)*dotPad)/2;
  const gridY = py + 30;

  for (let i=0;i<total;i++) {
    const col=i%cols, row=Math.floor(i/cols);
    const dx = gridX + col*dotPad;
    const dy = gridY + row*dotPad;
    const isActive = i < active;
    const pulse = isActive ? (0.7 + 0.3*Math.sin(animT*2 + i*0.4)) : 1;

    if (isActive) {
      const dg = ctx.createRadialGradient(dx,dy,0,dx,dy,dotS*1.2*pulse);
      dg.addColorStop(0,"rgba(0,240,160,.85)");
      dg.addColorStop(1,"rgba(0,240,160,0)");
      ctx.fillStyle = dg;
      ctx.beginPath(); ctx.arc(dx,dy,dotS*1.2*pulse,0,Math.PI*2); ctx.fill();
    }
    ctx.fillStyle = isActive ? "rgba(0,240,160,.9)" : "rgba(61,100,120,.35)";
    ctx.beginPath(); ctx.arc(dx,dy,dotS*.5,0,Math.PI*2); ctx.fill();
  }

  ctx.fillStyle = "rgba(122,160,184,.55)";
  ctx.font = "10px 'JetBrains Mono',monospace"; ctx.textAlign="center";
  ctx.fillText(`${active} / ${total} active`, px+pw/2, py+ph-8);
  ctx.textAlign="left";

  // ── Adhesion bar (below contact panel) ────────────────────────
  if (H > 340) {
    const bpx=px, bpy=py+ph+12, bpw=pw, bph=80;
    ctx.fillStyle = "rgba(6,20,32,.9)";
    ctx.strokeStyle = "rgba(0,240,160,.18)"; ctx.lineWidth=1;
    ctx.beginPath(); ctx.roundRect(bpx,bpy,bpw,bph,10); ctx.fill(); ctx.stroke();

    ctx.fillStyle = "rgba(0,240,160,.7)"; ctx.font="bold 10px 'JetBrains Mono',monospace";
    ctx.textAlign="center"; ctx.fillText("ADHESION INDEX",bpx+bpw/2,bpy+16); ctx.textAlign="left";

    const barW = bpw-24, barH=14;
    const barX=bpx+12, barY=bpy+28;
    ctx.fillStyle = "rgba(255,255,255,.06)";
    ctx.beginPath(); ctx.roundRect(barX,barY,barW,barH,4); ctx.fill();

    const fillW = barW * Math.min(state.adhesion, 1);
    const barColor = state.adhesion > .55 ? "#00f0a0" : state.adhesion > .25 ? "#ffbd59" : "#ff5252";
    const bg2 = ctx.createLinearGradient(barX,0,barX+fillW,0);
    bg2.addColorStop(0, barColor+"aa"); bg2.addColorStop(1, barColor);
    ctx.fillStyle = bg2;
    ctx.beginPath(); ctx.roundRect(barX,barY,fillW,barH,4); ctx.fill();

    ctx.fillStyle = "rgba(255,255,255,.9)";
    ctx.font = "bold 13px 'JetBrains Mono',monospace"; ctx.textAlign="center";
    ctx.fillText(state.adhesion.toFixed(3), bpx+bpw/2, bpy+bph-14);
    ctx.textAlign="left";
  }

  animT += 0.016;
}

function updateModel() {
  const r = parseFloat(distanceSlider.value) || 0.6;
  const contact = parseFloat(contactSlider.value) || 75;
  const relF = Math.pow(1/r, 6);
  const norm = Math.pow(1/0.3, 6);
  const adhesion = (relF/norm) * (contact/100);

  let mode = adhesion>=.55 ? "Strong" : adhesion>=.25 ? "Moderate" : "Weak";

  state = { r, contactPercent:contact, relativeForce:relF, adhesion, mode };

  distanceValue.textContent = r.toFixed(2);
  contactValue.textContent  = contact.toFixed(0);
  forceValue.textContent    = relF.toFixed(2);
  adhesionIndex.textContent = adhesion.toFixed(3);
  contactSpots.textContent  = `${Math.round(contact/100*30)} / 30`;
  modeLabel.textContent     = mode;

  const configs = {
    Strong:   { txt:"High adhesion window",    c:"#3dff9a", bg:"rgba(61,255,154,.1)",  bd:"rgba(61,255,154,.3)"  },
    Moderate: { txt:"Balanced / near threshold", c:"#ffbd59", bg:"rgba(255,189,89,.1)", bd:"rgba(255,189,89,.3)" },
    Weak:     { txt:"Low adhesion / likely slip",c:"#ff5252", bg:"rgba(255,82,82,.1)",  bd:"rgba(255,82,82,.3)"  },
  };
  const cfg = configs[mode];
  statusChip.textContent = cfg.txt;
  statusChip.style.color = cfg.c;
  statusChip.style.background = cfg.bg;
  statusChip.style.borderColor = cfg.bd;

  draw();
}

function loop() { draw(); requestAnimationFrame(loop); }

distanceSlider.addEventListener("input", updateModel);
contactSlider.addEventListener("input", updateModel);
window.addEventListener("resize", resizeCanvas);
updateModel(); resizeCanvas(); loop();

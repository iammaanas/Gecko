window.addEventListener('load', () => {
  const canvas  = document.getElementById('stage-canvas');
  if (!canvas) return;
  const ctx     = canvas.getContext('2d');
  let W, H, dpr;

  // ── Palette ──────────────────────────────────────────────────────
  const C = {
    teal:    '#00f0a0',
    tealDim: 'rgba(0,240,160,',
    blue:    '#2ab4ff',
    blueDim: 'rgba(42,180,255,',
    amber:   '#ffbd59',
    amberDim:'rgba(255,189,89,',
    bg:      '#020c12',
  };

  // ── Resize ───────────────────────────────────────────────────────
  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    W = window.innerWidth;
    H = window.innerHeight - 58;
    canvas.style.width  = W + 'px';
    canvas.style.height = H + 'px';
    canvas.width  = W * dpr;
    canvas.height = H * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  window.addEventListener('resize', resize);
  resize();

  // ── Utils ─────────────────────────────────────────────────────────
  const lerp  = (a, b, t) => a + (b - a) * t;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const smooth= t => t * t * (3 - 2 * t);

  function getProgress() {
    const max = document.body.scrollHeight - window.innerHeight;
    return max <= 0 ? 0 : clamp(window.scrollY / max, 0, 1);
  }

  // Scale bar
  function scaleBar(x, y, w, label) {
    ctx.save();
    ctx.strokeStyle = 'rgba(0,240,160,.4)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(x, y);   ctx.lineTo(x + w, y);
    ctx.moveTo(x, y-4); ctx.lineTo(x, y+4);
    ctx.moveTo(x+w,y-4);ctx.lineTo(x+w, y+4);
    ctx.stroke();
    ctx.fillStyle = 'rgba(0,240,160,.55)';
    ctx.font = "10px 'JetBrains Mono',monospace";
    ctx.textAlign = 'center';
    ctx.fillText(label, x + w/2, y - 10);
    ctx.restore();
  }

  // Callout line
  function callout(x1, y1, x2, y2, text, sub, color) {
    color = color || C.tealDim + '0.55)';
    const textColor = color.replace(/[\d.]+\)$/, '0.9)');
    ctx.save();
    ctx.strokeStyle = color;
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 4]);
    const dir = x2 > x1 ? 44 : -44;
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.lineTo(x2 + dir, y2);
    ctx.stroke();
    ctx.setLineDash([]);
    const lx = x2 > x1 ? x2 + dir + 4 : x2 + dir - 4;
    ctx.textAlign = x2 > x1 ? 'left' : 'right';
    ctx.fillStyle = textColor;
    ctx.font = "bold 11px 'JetBrains Mono',monospace";
    ctx.fillText(text, lx, y2 - 3);
    if (sub) {
      ctx.font = "10px 'JetBrains Mono',monospace";
      ctx.fillStyle = color.replace(/[\d.]+\)$/, '0.6)');
      ctx.fillText(sub, lx, y2 + 11);
    }
    ctx.textAlign = 'left';
    ctx.restore();
  }

  // Background grid
  function drawGrid(alpha) {
    if (alpha < 0.01) return;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.strokeStyle = C.tealDim + '0.04)';
    ctx.lineWidth = 1;
    for (let x = 0; x < W; x += 48) {
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke();
    }
    for (let y = 0; y < H; y += 48) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
    }
    ctx.restore();
  }

  // ── STAGE 0: Gecko Toe ───────────────────────────────────────────
  function drawStage0(p) {
    const cx = W/2, cy = H/2;
    const sp = smooth(p);

    // Deep green-teal bg
    const bg = ctx.createRadialGradient(cx, cy * 0.8, 0, cx, cy, Math.max(W,H));
    bg.addColorStop(0, '#071a12');
    bg.addColorStop(1, C.bg);
    ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);
    drawGrid(0.6);

    const surfY = cy + H * 0.22;

    // Glass surface
    const sg = ctx.createLinearGradient(0, surfY, 0, H);
    sg.addColorStop(0, 'rgba(42,180,255,.18)');
    sg.addColorStop(1, 'rgba(42,180,255,.03)');
    ctx.fillStyle = sg; ctx.fillRect(0, surfY, W, H - surfY);

    // Glass edge line with glow
    ctx.shadowColor = C.blue; ctx.shadowBlur = 10;
    ctx.strokeStyle = 'rgba(42,180,255,.5)'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(0, surfY); ctx.lineTo(W, surfY); ctx.stroke();
    ctx.shadowBlur = 0;

    // Toe geometry
    const tw = Math.min(W * 0.44, 260);
    const th = Math.min(H * 0.44, 220);
    const tx = cx - tw/2;
    const ty = surfY - th;

    // Shadow ellipse
    const shad = ctx.createRadialGradient(cx, surfY, 0, cx, surfY, tw * 0.55);
    shad.addColorStop(0, 'rgba(0,0,0,.4)');
    shad.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = shad;
    ctx.beginPath(); ctx.ellipse(cx, surfY+6, tw*.44, 14, 0, 0, Math.PI*2); ctx.fill();

    // Toe body
    const tg = ctx.createLinearGradient(tx, ty, tx+tw, ty+th);
    tg.addColorStop(0, '#2a1c10');
    tg.addColorStop(0.5, '#1a120a');
    tg.addColorStop(1, '#0d0907');
    ctx.beginPath();
    ctx.moveTo(tx + tw*.15, ty + 2);
    ctx.bezierCurveTo(cx-tw*.05,ty-th*.1, cx+tw*.05,ty-th*.1, tx+tw*.85, ty+2);
    ctx.bezierCurveTo(tx+tw*1.04, ty+th*.3, tx+tw, ty+th*.75, tx+tw*.94, surfY-1);
    ctx.lineTo(tx+tw*.06, surfY-1);
    ctx.bezierCurveTo(tx, ty+th*.75, tx-tw*.04, ty+th*.3, tx+tw*.15, ty+2);
    ctx.fillStyle = tg; ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,.05)'; ctx.lineWidth = 1; ctx.stroke();

    // Setae pad (teal glow)
    const padH = 22;
    const pg = ctx.createLinearGradient(0, surfY-padH, 0, surfY);
    pg.addColorStop(0, 'rgba(0,240,160,.04)');
    pg.addColorStop(1, 'rgba(0,240,160,.22)');
    ctx.fillStyle = pg;
    ctx.beginPath(); ctx.roundRect(tx+tw*.07, surfY-padH, tw*.86, padH, [4,4,0,0]); ctx.fill();

    // Lamella ridges
    ctx.strokeStyle = 'rgba(0,240,160,.18)'; ctx.lineWidth = 0.7;
    for (let i=1;i<9;i++) {
      const lx = tx+tw*.07 + (tw*.86/9)*i;
      ctx.beginPath(); ctx.moveTo(lx, surfY-padH); ctx.lineTo(lx, surfY); ctx.stroke();
    }

    // Labels
    ctx.globalAlpha = sp;
    callout(tx+tw*.93, surfY-12, tx+tw*1.1, surfY-55, 'Setae pad', '~200,000 setae/toe');
    callout(cx, ty+40, cx-tw*.5, ty-25, 'Gecko toe', null, C.amberDim+'0.5)');
    ctx.fillStyle = 'rgba(42,180,255,.45)'; ctx.font="11px 'JetBrains Mono',monospace";
    ctx.fillText('Glass surface', W*.04, surfY+24);
    ctx.globalAlpha = 1;

    scaleBar(W-140, H-32, 70, '~1 cm');

    if (p < 0.55) {
      ctx.globalAlpha = (1 - p/0.55) * 0.5;
      ctx.fillStyle = C.tealDim + '0.6)';
      ctx.font = "10px 'JetBrains Mono',monospace";
      ctx.textAlign = 'center';
      ctx.fillText('SCROLL TO ZOOM IN', W/2, H-20);
      ctx.textAlign = 'left';
      ctx.globalAlpha = 1;
    }
  }

  // ── STAGE 1: Lamellae ────────────────────────────────────────────
  function drawStage1(p) {
    const cx = W/2, cy = H/2;
    const sp = smooth(p);

    const bg = ctx.createLinearGradient(0,0,0,H);
    bg.addColorStop(0,'#111a0c'); bg.addColorStop(1,C.bg);
    ctx.fillStyle = bg; ctx.fillRect(0,0,W,H);
    drawGrid(0.4);

    const n=7, lH=Math.min(H*.075,44), gap=Math.min(H*.055,30);
    const total = n*(lH+gap)-gap;
    const sy = cy - total/2;
    const lW = Math.min(W*.8, 560);
    const lX = cx - lW/2;

    for (let i=0;i<n;i++) {
      const y = sy + i*(lH+gap);
      const fade = clamp(sp*2.2 - i*.08, 0, 1);
      if (fade <= 0) continue;

      const rg = ctx.createLinearGradient(lX,y,lX,y+lH);
      rg.addColorStop(0, C.tealDim+(0.45*fade)+')');
      rg.addColorStop(0.35, C.tealDim+(0.2*fade)+')');
      rg.addColorStop(1, C.tealDim+(0.04*fade)+')');

      ctx.beginPath();
      ctx.moveTo(lX, y+lH*.5);
      ctx.bezierCurveTo(lX+lW*.08,y, lX+lW*.92,y, lX+lW,y+lH*.5);
      ctx.bezierCurveTo(lX+lW*.92,y+lH, lX+lW*.08,y+lH, lX,y+lH*.5);
      ctx.fillStyle = rg; ctx.fill();

      // Top edge highlight
      ctx.shadowColor = C.teal; ctx.shadowBlur = 6*fade;
      ctx.beginPath();
      ctx.moveTo(lX, y+lH*.5);
      ctx.bezierCurveTo(lX+lW*.08,y, lX+lW*.92,y, lX+lW, y+lH*.5);
      ctx.strokeStyle = C.tealDim+(0.5*fade)+')'; ctx.lineWidth = 1.8; ctx.stroke();
      ctx.shadowBlur = 0;

      // Setae hint
      if (p > 0.35) {
        const sA = clamp((p-.35)/.4,0,1)*fade*0.5;
        ctx.strokeStyle = C.tealDim+sA+')'; ctx.lineWidth = 0.7;
        const sc=30;
        for (let s=0;s<sc;s++) {
          const sx = lX + (lW/sc)*s + lW/sc/2;
          const by = y + lH*.1;
          const h = 7 + Math.sin(s*1.1+i*.7)*2;
          const lean = Math.sin(s*.9)*1.5;
          ctx.beginPath(); ctx.moveTo(sx,by); ctx.lineTo(sx+lean,by-h); ctx.stroke();
        }
      }
    }

    ctx.globalAlpha = sp;
    callout(lX+lW, sy+2*(lH+gap)+lH/2, lX+lW+20, sy+(lH+gap), 'Lamella', '~500 μm wide');
    ctx.fillStyle = C.tealDim+'0.35)'; ctx.font="11px 'JetBrains Mono',monospace";
    ctx.fillText(`${n} lamellae visible`, W*.04, sy-18);
    ctx.globalAlpha = 1;

    scaleBar(W-140, H-32, 80, '~500 μm');
  }

  // ── STAGE 2: Setae Field ─────────────────────────────────────────
  function drawStage2(p) {
    const cx = W/2, cy = H/2;
    const sp = smooth(p);

    const bg = ctx.createLinearGradient(0,0,0,H);
    bg.addColorStop(0,'#081812'); bg.addColorStop(1,'#04100c');
    ctx.fillStyle = bg; ctx.fillRect(0,0,W,H);
    drawGrid(0.3);

    const baseY = cy + H * 0.22;

    // Lamella surface
    const sg = ctx.createLinearGradient(0,baseY,0,H);
    sg.addColorStop(0,'rgba(0,240,160,.16)');
    sg.addColorStop(1,'rgba(0,240,160,.03)');
    ctx.fillStyle = sg; ctx.fillRect(0,baseY,W,H-baseY);

    ctx.shadowColor = C.teal; ctx.shadowBlur = 8;
    ctx.strokeStyle = 'rgba(0,240,160,.35)'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(0,baseY); ctx.lineTo(W,baseY); ctx.stroke();
    ctx.shadowBlur = 0;

    // Dense setae columns
    const colW=16, cols=Math.ceil(W/colW), rows=7;
    const rSpacing = Math.min(H*.055,28);

    for (let row=0;row<rows;row++) {
      const rf = clamp(sp*2.0 - row*.15, 0, 1);
      if (rf <= 0) continue;
      const maxH = 14 + row*5;

      for (let col=0;col<cols;col++) {
        const x = col*colW + (row%2)*(colW/2);
        const by= baseY - row*rSpacing;
        const h = (maxH*(0.7+Math.sin(col*1.4+row*.9)*.3))*rf;
        const lean = Math.sin(col*.65+row*.5)*3;
        const alpha = 0.3 + rf*.5 + (rows-row)/rows*.12;

        // Glow on top rows
        if (row >= rows-2 && rf > 0.5) {
          ctx.shadowColor = C.teal;
          ctx.shadowBlur = 3 * rf;
        }
        ctx.strokeStyle = C.tealDim+alpha+')'; ctx.lineWidth = 0.8 + row*.08;
        ctx.beginPath();
        ctx.moveTo(x, by);
        ctx.quadraticCurveTo(x+lean*.4, by-h*.5, x+lean, by-h);
        ctx.stroke();
        ctx.shadowBlur = 0;

        // Spatula tips on top rows
        if (row >= rows-2 && rf > 0.6) {
          const tipA = (rf-.6)*2*.65;
          ctx.fillStyle = C.tealDim+tipA+')';
          ctx.beginPath(); ctx.arc(x+lean, by-h, 1.4, 0, Math.PI*2); ctx.fill();
        }
      }
    }

    ctx.globalAlpha = smooth(p);
    callout(W/2, baseY-58, W/2+W*.18, baseY-105, 'Seta', '~100 μm tall');
    ctx.fillStyle = C.tealDim+'0.35)'; ctx.font="11px 'JetBrains Mono',monospace";
    ctx.fillText('~1,000 setae per lamella', W*.04, baseY-16);
    ctx.fillStyle = C.tealDim+'0.22)'; ctx.fillText('Lamella surface', W*.04, baseY+24);
    ctx.globalAlpha = 1;

    scaleBar(W-140, H-32, 60, '~100 μm');
  }

  // ── STAGE 3: Spatulae ────────────────────────────────────────────
  function drawStage3(p, time) {
    const cx = W/2, cy = H/2;
    const sp = smooth(p);

    ctx.fillStyle = '#030c0a'; ctx.fillRect(0,0,W,H);
    drawGrid(0.25);

    const surfY = cy + H*.28;

    // Surface glow
    const sg = ctx.createLinearGradient(0,surfY,0,H);
    sg.addColorStop(0,'rgba(42,180,255,.22)');
    sg.addColorStop(1,'rgba(42,180,255,.04)');
    ctx.fillStyle = sg; ctx.fillRect(0,surfY,W,H-surfY);

    ctx.shadowColor = C.blue; ctx.shadowBlur = 12;
    ctx.strokeStyle = 'rgba(42,180,255,.55)'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(0,surfY); ctx.lineTo(W,surfY); ctx.stroke();
    ctx.shadowBlur = 0;

    // Surface molecule hints
    if (p > 0.3) {
      const mA = clamp((p-.3)/.5, 0, 1)*.45;
      const ms = 26;
      for (let mx=ms/2;mx<W;mx+=ms) {
        const jy = Math.sin(mx*.22)*4;
        const mg = ctx.createRadialGradient(mx, surfY+7+jy, 0, mx, surfY+7+jy, 6);
        mg.addColorStop(0, C.blueDim+mA+')');
        mg.addColorStop(1,'rgba(42,180,255,0)');
        ctx.fillStyle = mg;
        ctx.beginPath(); ctx.arc(mx, surfY+7+jy, 6, 0, Math.PI*2); ctx.fill();
      }
    }

    // Seta shaft
    const topY = cy - H*.35, botY = surfY - 34;
    const sw = Math.max(4, 13 - sp*4);

    const shG = ctx.createLinearGradient(cx-sw, topY, cx+sw, topY);
    shG.addColorStop(0, 'rgba(0,240,160,.25)');
    shG.addColorStop(0.5,'rgba(0,240,160,.85)');
    shG.addColorStop(1, 'rgba(0,240,160,.25)');

    ctx.shadowColor = C.teal; ctx.shadowBlur = 12;
    ctx.beginPath();
    ctx.moveTo(cx-sw/2, topY);
    ctx.lineTo(cx+sw/2, topY);
    ctx.bezierCurveTo(cx+sw/2+3, cy-20, cx+sw/3, botY-20, cx+1, botY);
    ctx.bezierCurveTo(cx-sw/3, botY-20, cx-sw/2-3, cy-20, cx-sw/2, topY);
    ctx.fillStyle = shG; ctx.fill();
    ctx.shadowBlur = 0;

    // Shaft highlight
    ctx.strokeStyle = 'rgba(0,240,160,.28)'; ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(cx-sw/2, topY);
    ctx.bezierCurveTo(cx-sw/2-3, cy-20, cx-sw/3, botY-20, cx-1, botY);
    ctx.stroke();

    // Spatulae fan
    const numS=28, spread=Math.min(W*.3,185)*sp, fanDrop=32*sp;
    for (let i=0;i<numS;i++) {
      const t = i/(numS-1);
      const angle = (t-.5)*Math.PI*.9;
      const tipX = cx + Math.sin(angle)*spread;
      const tipY = botY + Math.cos(angle)*10 + fanDrop*(1-Math.cos(angle*2));
      const alpha = (0.4 + (1-Math.abs(t-.5)*1.8)*.45)*sp;

      // Branch line with glow
      if (Math.abs(t-.5) < 0.2) { ctx.shadowColor = C.teal; ctx.shadowBlur = 4*sp; }
      ctx.strokeStyle = C.tealDim+(alpha*.9)+')';
      ctx.lineWidth = 0.9 + (1-Math.abs(t-.5)*1.6)*1.5;
      ctx.beginPath();
      ctx.moveTo(cx, botY);
      ctx.quadraticCurveTo(cx+Math.sin(angle)*spread*.5, botY, tipX, tipY);
      ctx.stroke();
      ctx.shadowBlur = 0;

      // Spatula pad
      if (sp > 0.28) {
        const pA = clamp((sp-.28)/.5,0,1)*alpha;
        const padW = 12*pA, padH2 = 5*pA;
        const pd = 20*sp;
        ctx.save(); ctx.translate(tipX, tipY+pd); ctx.rotate(angle*.3);
        const pg = ctx.createLinearGradient(-padW/2,0,padW/2,0);
        pg.addColorStop(0, C.tealDim+(pA*.25)+')');
        pg.addColorStop(0.5, C.tealDim+(pA*.95)+')');
        pg.addColorStop(1, C.tealDim+(pA*.25)+')');
        ctx.shadowColor = C.teal; ctx.shadowBlur = 5*pA;
        ctx.fillStyle = pg;
        ctx.beginPath(); ctx.ellipse(0,0,padW/2,padH2/2,0,0,Math.PI*2); ctx.fill();
        ctx.restore(); ctx.shadowBlur = 0;
      }
    }

    ctx.globalAlpha = smooth(p);
    callout(cx+sw/2, topY+22, cx+W*.22, topY+44, 'Seta shaft', null, C.tealDim+'0.5)');
    if (sp > 0.3) {
      ctx.globalAlpha = clamp((sp-.3)/.4,0,1);
      callout(cx+spread*.85, botY+fanDrop, cx+spread+12, botY+fanDrop-12, 'Spatula pads','~200 nm', C.tealDim+'0.5)');
    }
    ctx.globalAlpha = smooth(p);
    ctx.fillStyle = 'rgba(42,180,255,.45)'; ctx.font="11px 'JetBrains Mono',monospace";
    ctx.fillText('Surface', W*.04, surfY+24);
    ctx.globalAlpha = 1;

    scaleBar(W-140, H-32, 55, '~1 μm');
  }

  // ── STAGE 4: Van der Waals ───────────────────────────────────────
  function drawStage4(p, time) {
    const cx = W/2, cy = H/2;
    const sp = smooth(p);

    ctx.fillStyle = '#020a0c'; ctx.fillRect(0,0,W,H);

    // Deep radial glow
    const bg = ctx.createRadialGradient(cx,cy,0,cx,cy,Math.max(W,H)*.55);
    bg.addColorStop(0,'rgba(0,240,160,.055)');
    bg.addColorStop(1,'rgba(0,0,0,0)');
    ctx.fillStyle = bg; ctx.fillRect(0,0,W,H);
    drawGrid(0.2);

    // Gap narrows as p increases
    const maxGap = H*.21, minGap = H*.065;
    const gap = lerp(maxGap, minGap, sp);
    const upperY = cy - gap/2;
    const lowerY = cy + gap/2;

    const molR = Math.min(W,H)*.027;
    const mSpacing = molR*2.75;
    const cols = Math.ceil(W/mSpacing)+2;

    // Force lines between molecules
    if (sp > 0.15) {
      const fA = clamp((sp-.15)/.5, 0, 1);
      const wAmp = lerp(8, 1.5, sp);
      for (let i=0;i<cols;i++) {
        const mx = (i-.5)*mSpacing + mSpacing*.3;
        const r = lowerY - upperY;
        const forceMag = clamp(.4/Math.pow(r/(H*.08),2), 0, 1);
        const intensity = forceMag * fA;

        const fg = ctx.createLinearGradient(mx,upperY,mx,lowerY);
        fg.addColorStop(0, 'rgba(0,240,160,0)');
        fg.addColorStop(0.3, C.tealDim+(intensity*.9)+')');
        fg.addColorStop(0.5, 'rgba(42,180,255,'+intensity+')');
        fg.addColorStop(0.7, C.blueDim+(intensity*.8)+')');
        fg.addColorStop(1, 'rgba(42,180,255,0)');

        ctx.strokeStyle = fg;
        ctx.lineWidth = 1.2 + forceMag*2.5;
        ctx.shadowColor = C.teal; ctx.shadowBlur = 6*intensity;
        ctx.beginPath();
        let first=true;
        for (let y=upperY;y<=lowerY;y+=2) {
          const xOff = Math.sin(y*.09+time*2.2+i*.8)*wAmp;
          if(first){ctx.moveTo(mx+xOff,y);first=false}
          else ctx.lineTo(mx+xOff,y);
        }
        ctx.stroke();
        ctx.shadowBlur = 0;
      }
    }

    // Upper molecules — spatula (teal/amber)
    for (let i=0;i<cols;i++) {
      const mx = (i-.5)*mSpacing+mSpacing*.3;
      const jy = Math.sin(mx*.14+.5)*molR*.35;
      const bob = Math.sin(time*1.1+i*.7)*molR*.2*(1-sp*.8);
      const y = upperY+jy+bob;

      ctx.shadowColor = C.amber; ctx.shadowBlur = 6;
      const mg = ctx.createRadialGradient(mx,y,0,mx,y,molR*1.1);
      mg.addColorStop(0,'rgba(255,220,140,.85)');
      mg.addColorStop(0.5,'rgba(255,180,60,.55)');
      mg.addColorStop(1,'rgba(255,140,30,0)');
      ctx.fillStyle = mg;
      ctx.beginPath(); ctx.arc(mx,y,molR*1.05,0,Math.PI*2); ctx.fill();
      ctx.shadowBlur = 0;
    }

    // Lower molecules — surface (blue)
    for (let i=0;i<cols;i++) {
      const mx = (i-.28)*mSpacing+mSpacing*.5;
      const jy = Math.cos(mx*.12+.8)*molR*.3;
      const y = lowerY+jy;

      ctx.shadowColor = C.blue; ctx.shadowBlur = 6;
      const mg = ctx.createRadialGradient(mx,y,0,mx,y,molR*1.1);
      mg.addColorStop(0,'rgba(120,210,255,.85)');
      mg.addColorStop(0.5,'rgba(60,165,245,.55)');
      mg.addColorStop(1,'rgba(40,120,230,0)');
      ctx.fillStyle = mg;
      ctx.beginPath(); ctx.arc(mx,y,molR,0,Math.PI*2); ctx.fill();
      ctx.shadowBlur = 0;
    }

    // Distance label
    if (sp > 0.25) {
      const dA = clamp((sp-.25)/.45, 0, 1);
      const dX = W*.8;
      ctx.save(); ctx.globalAlpha = dA*.8;
      ctx.strokeStyle = 'rgba(0,240,160,.3)'; ctx.lineWidth = 1;
      ctx.setLineDash([3,4]);
      ctx.beginPath(); ctx.moveTo(dX,upperY); ctx.lineTo(dX,lowerY); ctx.stroke();
      ctx.setLineDash([]);
      const dist = lerp(.8,.4,sp).toFixed(1);
      ctx.fillStyle = 'rgba(0,240,160,.8)';
      ctx.font = "bold 12px 'JetBrains Mono',monospace"; ctx.textAlign='center';
      ctx.fillText(dist+' nm', dX, (upperY+lowerY)/2+4);
      ctx.textAlign='left'; ctx.restore();
    }

    // Equation box
    if (sp > 0.45) {
      const eqA = clamp((sp-.45)/.4, 0, 1);
      const eqX=W*.04, eqY=H-85;
      ctx.save(); ctx.globalAlpha = eqA;
      ctx.fillStyle = 'rgba(0,240,160,.06)';
      ctx.strokeStyle = 'rgba(0,240,160,.25)'; ctx.lineWidth=1;
      ctx.beginPath(); ctx.roundRect(eqX,eqY,230,60,10); ctx.fill(); ctx.stroke();
      ctx.shadowColor = C.teal; ctx.shadowBlur = 8;
      ctx.fillStyle = 'rgba(0,240,160,.95)';
      ctx.font="bold 15px 'JetBrains Mono',monospace";
      ctx.fillText('F  ∝  1 / r⁶', eqX+18, eqY+24);
      ctx.shadowBlur = 0;
      ctx.fillStyle = 'rgba(0,240,160,.5)'; ctx.font="10px 'JetBrains Mono',monospace";
      ctx.fillText('Van der Waals force law', eqX+18, eqY+42);
      ctx.restore();
    }

    // Molecule labels
    ctx.globalAlpha = smooth(p);
    ctx.fillStyle = 'rgba(255,210,130,.85)';
    ctx.font = "bold 12px 'JetBrains Mono',monospace";
    ctx.fillText('Spatula molecules', W*.04, upperY-18);
    ctx.fillStyle = 'rgba(120,200,255,.85)';
    ctx.fillText('Surface molecules',  W*.04, lowerY+32);
    ctx.globalAlpha = 1;

    scaleBar(W-140, H-32, 45, '~0.5 nm');
  }

  // ── UI refs ───────────────────────────────────────────────────────
  const STAGES = [
    { title:'Gecko Toe',       num:'01', desc:'Macro view — the toe pad resting on a glass surface (~1 cm)' },
    { title:'Lamellae',        num:'02', desc:'Zooming in — parallel ridges that organize the setae (~500 μm wide)' },
    { title:'Setae Field',     num:'03', desc:'Microscale — thousands of hair-like setae per lamella (~100 μm tall)' },
    { title:'Spatulae',        num:'04', desc:'A single seta fans into ~1,000 spatula pads at its tip (~200 nm)' },
    { title:'Van der Waals',   num:'05', desc:'Molecules attract across 0.3–0.6 nm — no glue, no suction, just physics' },
  ];
  const FUNCS = [drawStage0, drawStage1, drawStage2, drawStage3, drawStage4];

  const dots       = document.querySelectorAll('.stage-dot');
  const titleEl    = document.getElementById('stage-title');
  const numEl      = document.getElementById('stage-num');
  const descEl     = document.getElementById('stage-desc');
  const progressBar= document.getElementById('progress-bar');

  let smoothP=0, time=0, lastSi=-1;

  dots.forEach(dot => {
    dot.addEventListener('click', () => {
      const si = parseInt(dot.dataset.stage);
      const max = document.body.scrollHeight - window.innerHeight;
      window.scrollTo({ top: ((si+.05)/STAGES.length)*max, behavior:'smooth' });
    });
  });

  function render() {
    const raw = getProgress();
    smoothP = lerp(smoothP, raw, 0.07);

    const stageF = smoothP * STAGES.length;
    const si = clamp(Math.floor(stageF), 0, STAGES.length-1);
    const sp = clamp(stageF - si, 0, 1);

    if (si !== lastSi) {
      lastSi = si;
      titleEl.textContent = STAGES[si].title;
      numEl.textContent   = STAGES[si].num;
      descEl.textContent  = STAGES[si].desc;
      dots.forEach((d,i) => d.classList.toggle('active', i===si));
    }

    progressBar.style.width = (raw*100)+'%';
    ctx.clearRect(0,0,W,H);

    if (si===3 || si===4) FUNCS[si](sp, time);
    else FUNCS[si](sp);

    // Fade-to-black between stages
    if (sp > 0.87 && si < STAGES.length-1) {
      ctx.globalAlpha = smooth((sp-.87)/.13);
      ctx.fillStyle = C.bg;
      ctx.fillRect(0,0,W,H);
      ctx.globalAlpha = 1;
    }

    time += 0.016;
    requestAnimationFrame(render);
  }

  render();
});

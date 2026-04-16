/**
 * Btoan AI — Naruto Mode v5.0  (Procedural — Generated from hand landmarks)
 *
 * Mọi hiệu ứng được sinh từ vị trí THỰC của từng landmark:
 *   - Palm center  (avg wrist + 4 knuckle) = tâm phát năng lượng
 *   - Fingertips   (4,8,12,16,20)          = nguồn emitter / tia sét
 *   - Hand scale   (wrist→midMCP)           = scale effect
 *   - Pinch point  (thumb ↔ index)          = điểm nén → phóng
 *
 * Tay TRÁI  → Fire/Chakra (cam/vàng)
 * Tay PHẢI  → Chidori/Lightning (xanh lam)
 * Hai tay   → Arc điện nối giữa 2 lòng bàn tay
 * Pinch     → Năng lượng nén → Ném shuriken + shockwave
 */

const DEBUG_HAND_MARKER = false;

document.addEventListener('DOMContentLoaded', function () {
  (function () {

    /* ══ STATE ══════════════════════════════════════════════ */
    let narutoActive = false;
    let narutoScore  = 0;
    let lastPinchL   = false, lastPinchR = false;
    let animFrame    = null;
    let nCanvas, nCtx;
    let frameTime = 0;

    // Particle pool per hand
    const particles = { Left: [], Right: [] };

    const btn = document.getElementById('toggleNarutoMode');
    if (!btn) return;
    btn.addEventListener('click', () => narutoActive ? closeNaruto() : openNaruto());

    /* ══ MATH UTILS ═════════════════════════════════════════ */
    const lerp  = (a, b, t) => a + (b - a) * t;
    const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
    const rand  = (lo, hi) => lo + Math.random() * (hi - lo);
    const dist  = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

    /**
     * Convert MediaPipe normalized landmark → screen pixel (mirrored X)
     */
    function lm2px(lm, W, H) {
      return { x: (1 - lm.x) * W, y: lm.y * H };
    }

    /**
     * Average of landmark array (by index list)
     */
    function avgPts(pts, indices) {
      const sel = indices.map(i => pts[i]);
      return {
        x: sel.reduce((s, p) => s + p.x, 0) / sel.length,
        y: sel.reduce((s, p) => s + p.y, 0) / sel.length,
      };
    }

    /* ══ CLOSE ══════════════════════════════════════════════ */
    window.closeNaruto = function () {
      narutoActive = false;
      document.getElementById('naruto-overlay').style.display = 'none';
      btn.classList.remove('naruto-active');
      particles.Left = []; particles.Right = [];
      if (animFrame) { cancelAnimationFrame(animFrame); animFrame = null; }
      const ho = document.getElementById('hand-overlay');
      if (ho && window.handEngine?.isActive) ho.style.display = 'block';
    };

    /* ══ OPEN ═══════════════════════════════════════════════ */
    async function openNaruto() {
      narutoActive = true;
      narutoScore  = 0;
      lastPinchL   = false; lastPinchR = false;
      particles.Left = []; particles.Right = [];

      document.getElementById('naruto-overlay').style.display = 'block';
      document.getElementById('naruto-fx-layer').innerHTML  = '';
      document.getElementById('naruto-score').textContent   = '\uD83D\uDCA0 0';
      btn.classList.add('naruto-active');

      // Canvas setup
      nCanvas = document.getElementById('naruto-canvas');
      nCanvas.width  = window.innerWidth;
      nCanvas.height = window.innerHeight;
      nCtx    = nCanvas.getContext('2d');
      window.addEventListener('resize', () => {
        if (nCanvas) { nCanvas.width = window.innerWidth; nCanvas.height = window.innerHeight; }
      });

      // Start handEngine (không show hand-overlay)
      if (window.handEngine && !window.handEngine.isActive) {
        await window.handEngine.start(false);
        await new Promise(r => setTimeout(r, 400));
      } else {
        const ho = document.getElementById('hand-overlay');
        if (ho) ho.style.display = 'none';
      }

      // Share handEngine camera → naruto background
      const handVideo = document.getElementById('hand-video');
      const narutoCam = document.getElementById('naruto-camera');
      if (handVideo?.srcObject && narutoCam) {
        narutoCam.srcObject = handVideo.srcObject;
        narutoCam.play().catch(() => {});
      }
      const ho = document.getElementById('hand-overlay');
      if (ho) ho.style.display = 'none';

      narutoLoop();
    }

    /* ══ MAIN LOOP ══════════════════════════════════════════ */
    function narutoLoop() {
      if (!narutoActive) return;
      frameTime = performance.now();

      const W = window.innerWidth;
      const H = window.innerHeight;

      if (nCtx) {
        // Fade trail — không xóa hoàn toàn để tạo afterglow
        nCtx.fillStyle = 'rgba(0,0,0,0.18)';
        nCtx.fillRect(0, 0, W, H);
      }

      const sL = window.handEngine?.handStates?.['Left'];
      const sR = window.handEngine?.handStates?.['Right'];
      const Lactive = sL?.history?.length > 0 && sL.landmarks;
      const Ractive = sR?.history?.length > 0 && sR.landmarks;

      if (Lactive) drawHandEffect(sL, 'Left',  W, H);
      if (Ractive) drawHandEffect(sR, 'Right', W, H);

      // Arc giữa 2 lòng bàn tay khi cả 2 tay đều detect
      if (Lactive && Ractive) drawDualArc(sL, sR, W, H);

      // Pinch
      ['Left', 'Right'].forEach(side => {
        const s      = window.handEngine?.handStates?.[side];
        const active = s?.history?.length > 0;
        if (!active) return;
        const isPinch = s.isPinching;
        const wasLast = (side === 'Left') ? lastPinchL : lastPinchR;
        if (isPinch && !wasLast && s.landmarks) {
          const lms = s.landmarks;
          // Điểm giữa thumb tip và index tip
          const px = ((1 - lms[4].x) + (1 - lms[8].x)) * 0.5 * W;
          const py = (lms[4].y + lms[8].y) * 0.5 * H;
          onPinchFire(px, py, side === 'Left');
        }
        if (side === 'Left') lastPinchL = isPinch;
        else                 lastPinchR = isPinch;
      });

      animFrame = requestAnimationFrame(narutoLoop);
    }

    /* ══ PER-HAND PROCEDURAL EFFECT ════════════════════════ */
    function drawHandEffect(s, side, W, H) {
      const lms   = s.landmarks;
      const t     = frameTime;
      const isLeft = (side === 'Left');

      // Convert all 21 landmarks to screen pixels
      const pts = lms.map(lm => lm2px(lm, W, H));

      // Palm center = avg wrist(0) + 4 MCP knuckles(5,9,13,17)
      const palm = avgPts(pts, [0, 5, 9, 13, 17]);

      // Hand scale = wrist(0) → middle MCP(9)
      const handSz = dist(pts[0], pts[9]);

      // Fingertip indices: thumb=4, index=8, middle=12, ring=16, pinky=20
      const tipIdx = [4, 8, 12, 16, 20];
      const tips   = tipIdx.map(i => pts[i]);

      // MCP base indices (knuckles): 2,5,9,13,17
      const mcpIdx = [2, 5, 9, 13, 17];
      const mcps   = mcpIdx.map(i => pts[i]);

      const isPinching = s.isPinching;

      if (!isPinching) {
        // ── 1. Palm glow core ──
        drawPalmCore(palm, handSz, t, isLeft);

        // ── 2. Energy lines palm → each fingertip ──
        for (let i = 0; i < tips.length; i++) {
          drawEnergyLine(palm, tips[i], mcps[i], t + i * 37, isLeft);
        }

        // ── 3. Fingertip spark emitters ──
        for (let i = 0; i < tips.length; i++) {
          emitTipParticle(tips[i], side, t + i * 11, isLeft);
        }

        // ── 4. Rotating chakra ring at palm ──
        drawChakraRing(palm, handSz * 0.9, t, isLeft);

        // ── 5. Draw + update particles ──
        updateParticles(side, isLeft);

      } else {
        // ── Pinch state: energy concentrates to pinch point ──
        const pinchPt = {
          x: (pts[4].x + pts[8].x) * 0.5,
          y: (pts[4].y + pts[8].y) * 0.5,
        };
        drawPinchCharge(pinchPt, palm, handSz, t, isLeft);
      }
    }

    /* ── Palm Core Glow ─────────────────────────────────── */
    function drawPalmCore(palm, sz, t, isLeft) {
      const pulse = 1 + Math.sin(t * 0.005) * 0.18;
      const r     = sz * 0.75 * pulse;

      const [c0, c1, c2] = isLeft
        ? ['rgba(255,140,20,0.85)', 'rgba(249,90,0,0.45)', 'rgba(249,50,0,0.00)']
        : ['rgba(180,220,255,0.85)', 'rgba(60,130,255,0.50)', 'rgba(20,60,255,0.00)'];

      const g = nCtx.createRadialGradient(palm.x, palm.y, 0, palm.x, palm.y, r);
      g.addColorStop(0,   c0);
      g.addColorStop(0.45, c1);
      g.addColorStop(1,   c2);

      nCtx.save();
      nCtx.globalCompositeOperation = 'screen';
      nCtx.fillStyle = g;
      nCtx.beginPath();
      nCtx.arc(palm.x, palm.y, r, 0, Math.PI * 2);
      nCtx.fill();
      nCtx.restore();
    }

    /* ── Energy Line: Palm → Fingertip  (lightning-like) ── */
    function drawEnergyLine(from, to, knuckle, t, isLeft) {
      // 2 passes: glow + bright core
      const flicker = 0.5 + 0.5 * Math.sin(t * 0.009 + Math.random() * 2);
      const color   = isLeft
        ? `rgba(255,160,30,${0.55 * flicker})`
        : `rgba(80,170,255,${0.60 * flicker})`;
      const bright  = isLeft ? '#fff0aa' : '#d0eeff';

      const segs = 6;
      const dx   = to.x - knuckle.x;
      const dy   = to.y - knuckle.y;
      const len  = Math.hypot(dx, dy) || 1;
      const nx   = -dy / len;  // normal vector for jitter
      const ny   =  dx / len;

      nCtx.save();
      nCtx.globalCompositeOperation = 'screen';

      // Glow pass
      nCtx.beginPath();
      nCtx.moveTo(from.x, from.y);
      for (let i = 1; i <= segs; i++) {
        const p  = i / segs;
        const jx = nx * rand(-len * 0.06, len * 0.06);
        const jy = ny * rand(-len * 0.06, len * 0.06);
        nCtx.lineTo(knuckle.x + dx * p + jx, knuckle.y + dy * p + jy);
      }
      nCtx.shadowColor = isLeft ? '#ff8800' : '#4499ff';
      nCtx.shadowBlur  = 12;
      nCtx.strokeStyle = color;
      nCtx.lineWidth   = 3.5;
      nCtx.stroke();

      // Bright core pass
      nCtx.beginPath();
      nCtx.moveTo(from.x, from.y);
      for (let i = 1; i <= segs; i++) {
        const p  = i / segs;
        const jx = nx * rand(-len * 0.03, len * 0.03);
        const jy = ny * rand(-len * 0.03, len * 0.03);
        nCtx.lineTo(knuckle.x + dx * p + jx, knuckle.y + dy * p + jy);
      }
      nCtx.shadowBlur  = 4;
      nCtx.strokeStyle = isLeft ? `rgba(255,230,180,${0.8 * flicker})` : `rgba(200,235,255,${0.9 * flicker})`;
      nCtx.lineWidth   = 1.2;
      nCtx.stroke();

      nCtx.restore();
    }

    /* ── Fingertip Particle Emitter ─────────────────────── */
    function emitTipParticle(tip, side, t, isLeft) {
      // Emit particles occasionally
      if (Math.random() > 0.35) return;
      particles[side].push({
        x:    tip.x + rand(-4, 4),
        y:    tip.y + rand(-4, 4),
        vx:   rand(-1.2, 1.2),
        vy:   rand(-2.5, -0.5),
        life: 1.0,
        size: rand(2, 5),
        left: isLeft,
      });
    }

    function updateParticles(side, isLeft) {
      nCtx.save();
      nCtx.globalCompositeOperation = 'screen';

      particles[side] = particles[side].filter(p => {
        p.x    += p.vx;
        p.y    += p.vy;
        p.vy   -= 0.05; // rise
        p.life -= 0.028;

        if (p.life <= 0) return false;

        const a = p.life;
        nCtx.beginPath();
        nCtx.arc(p.x, p.y, p.size * p.life, 0, Math.PI * 2);
        nCtx.fillStyle = isLeft
          ? `rgba(255,200,60,${a})`
          : `rgba(140,200,255,${a})`;
        nCtx.shadowColor = isLeft ? '#ff8800' : '#4499ff';
        nCtx.shadowBlur  = 6;
        nCtx.fill();
        return true;
      });

      // Cap at 120 particles per hand
      if (particles[side].length > 120) particles[side].splice(0, particles[side].length - 120);

      nCtx.restore();
    }

    /* ── Chakra Ring (rotating segmented) ───────────────── */
    function drawChakraRing(palm, r, t, isLeft) {
      const segs  = isLeft ? 8 : 12;
      const rot   = (t * (isLeft ? 0.0012 : -0.0018)) % (Math.PI * 2);
      const gap   = 0.18; // radians gap between segments
      const segA  = (Math.PI * 2 / segs) - gap;

      nCtx.save();
      nCtx.globalCompositeOperation = 'screen';
      nCtx.shadowColor = isLeft ? '#ff8800' : '#4499ff';
      nCtx.shadowBlur  = 10;
      nCtx.strokeStyle = isLeft ? 'rgba(255,160,40,0.65)' : 'rgba(80,160,255,0.65)';
      nCtx.lineWidth   = 2.5;

      for (let i = 0; i < segs; i++) {
        const startA = rot + (Math.PI * 2 / segs) * i;
        nCtx.beginPath();
        nCtx.arc(palm.x, palm.y, r, startA, startA + segA);
        nCtx.stroke();
      }

      // Inner ring (counter-rotate)
      nCtx.shadowBlur  = 6;
      nCtx.strokeStyle = isLeft ? 'rgba(255,220,100,0.5)' : 'rgba(160,210,255,0.5)';
      nCtx.lineWidth   = 1.5;
      const rot2 = (-t * 0.0008) % (Math.PI * 2);
      for (let i = 0; i < segs - 2; i++) {
        const startA = rot2 + (Math.PI * 2 / (segs - 2)) * i;
        nCtx.beginPath();
        nCtx.arc(palm.x, palm.y, r * 0.55, startA, startA + segA * 0.9);
        nCtx.stroke();
      }

      nCtx.restore();
    }

    /* ── Pinch Charge State ──────────────────────────────── */
    function drawPinchCharge(pinch, palm, handSz, t, isLeft) {
      // Lines from all fingers converge to pinch point
      const pulse = 0.6 + 0.4 * Math.abs(Math.sin(t * 0.015));
      const r     = handSz * 0.3 * pulse;

      // Bright core at pinch
      const g = nCtx.createRadialGradient(pinch.x, pinch.y, 0, pinch.x, pinch.y, r * 1.5);
      g.addColorStop(0,   isLeft ? 'rgba(255,255,200,0.95)' : 'rgba(200,230,255,0.95)');
      g.addColorStop(0.3, isLeft ? 'rgba(255,140,20,0.70)'  : 'rgba(80,160,255,0.70)');
      g.addColorStop(1,   'rgba(0,0,0,0)');

      nCtx.save();
      nCtx.globalCompositeOperation = 'screen';
      nCtx.fillStyle = g;
      nCtx.beginPath();
      nCtx.arc(pinch.x, pinch.y, r * 1.5, 0, Math.PI * 2);
      nCtx.fill();

      // Energy compression ring
      nCtx.strokeStyle = isLeft ? `rgba(255,200,60,${pulse})` : `rgba(140,200,255,${pulse})`;
      nCtx.lineWidth   = 3;
      nCtx.shadowColor = isLeft ? '#ff8800' : '#4499ff';
      nCtx.shadowBlur  = 20;
      nCtx.beginPath();
      nCtx.arc(pinch.x, pinch.y, r, 0, Math.PI * 2);
      nCtx.stroke();

      // Line from palm to pinch point
      nCtx.beginPath();
      nCtx.moveTo(palm.x, palm.y);
      nCtx.lineTo(pinch.x, pinch.y);
      nCtx.strokeStyle = isLeft ? 'rgba(255,160,40,0.6)' : 'rgba(80,160,255,0.6)';
      nCtx.lineWidth   = 2;
      nCtx.shadowBlur  = 8;
      nCtx.stroke();

      nCtx.restore();
    }

    /* ── Dual Hand Arc (nối 2 lòng bàn tay) ────────────── */
    function drawDualArc(sL, sR, W, H) {
      if (!sL.landmarks || !sR.landmarks) return;

      const ptsL = sL.landmarks.map(lm => lm2px(lm, W, H));
      const ptsR = sR.landmarks.map(lm => lm2px(lm, W, H));
      const palmL = avgPts(ptsL, [0, 5, 9, 13, 17]);
      const palmR = avgPts(ptsR, [0, 5, 9, 13, 17]);
      const d = dist(palmL, palmR);

      if (d > W * 0.85) return; // tay quá xa nhau → không vẽ

      // Electric arc giữa 2 lòng bàn tay
      const segs  = 12;
      const t     = frameTime;
      const mx    = (palmL.x + palmR.x) * 0.5;
      const my    = (palmL.y + palmR.y) * 0.5;

      nCtx.save();
      nCtx.globalCompositeOperation = 'screen';

      // 3 bolt paths
      for (let b = 0; b < 3; b++) {
        nCtx.beginPath();
        nCtx.moveTo(palmL.x, palmL.y);
        const dx = palmR.x - palmL.x;
        const dy = palmR.y - palmL.y;
        const len = Math.hypot(dx, dy) || 1;
        const nx = -dy / len; const ny = dx / len;

        for (let i = 1; i < segs; i++) {
          const p   = i / segs;
          const jitter = d * 0.07 * (Math.random() - 0.5);
          nCtx.lineTo(palmL.x + dx * p + nx * jitter, palmL.y + dy * p + ny * jitter);
        }
        nCtx.lineTo(palmR.x, palmR.y);

        nCtx.strokeStyle = b === 1 ? 'rgba(255,255,255,0.8)' : 'rgba(150,200,255,0.5)';
        nCtx.lineWidth   = b === 1 ? 1.5 : 4;
        nCtx.shadowColor = '#aaddff';
        nCtx.shadowBlur  = b === 1 ? 5 : 20;
        nCtx.stroke();
      }

      // Glow at midpoint
      const g = nCtx.createRadialGradient(mx, my, 0, mx, my, d * 0.15);
      g.addColorStop(0,   'rgba(180,220,255,0.6)');
      g.addColorStop(1,   'rgba(80,140,255,0.0)');
      nCtx.fillStyle = g;
      nCtx.beginPath();
      nCtx.arc(mx, my, d * 0.15, 0, Math.PI * 2);
      nCtx.fill();

      nCtx.restore();
    }

    /* ══ PINCH → LAUNCH ════════════════════════════════════ */
    function onPinchFire(px, py, isLeft) {
      const angle = (-Math.PI / 2) + (Math.random() - 0.5) * Math.PI * 0.85;
      const power = 500 + Math.random() * 350;
      launchShuriken(px, py, angle, power, isLeft);
      // Particle burst at pinch point
      for (let i = 0; i < 20; i++) {
        const side = isLeft ? 'Left' : 'Right';
        particles[side].push({
          x: px, y: py,
          vx: rand(-4, 4), vy: rand(-5, 1),
          life: 1.0, size: rand(3, 7), left: isLeft,
        });
      }
    }

    /* ══ LAUNCH SHURIKEN ═══════════════════════════════════ */
    function launchShuriken(sx, sy, angle, power, isLeft) {
      const dx = Math.cos(angle) * power;
      const dy = Math.sin(angle) * power;
      const layer = document.getElementById('naruto-fx-layer');
      if (!layer) return;

      // Shuriken = rotating 8-spoke star
      const el = document.createElement('div');
      const size = 70;
      Object.assign(el.style, {
        position:        'absolute',
        width:           size + 'px',
        height:          size + 'px',
        left:            sx  + 'px',
        top:             sy  + 'px',
        pointerEvents:   'none',
        zIndex:          '60',
        transformOrigin: 'center',
        // 8-point star
        clipPath:        'polygon(50% 0%,54% 38%,76% 9%,62% 46%,100% 44%,66% 58%,88% 90%,50% 67%,12% 90%,34% 58%,0% 44%,38% 46%,24% 9%,46% 38%)',
        background:      isLeft
          ? 'conic-gradient(from 0deg,#fff 0%,#fde68a 20%,#f97316 50%,#fff 55%,#fbbf24 80%,#f97316 100%)'
          : 'conic-gradient(from 0deg,#fff 0%,#bae6fd 20%,#3b82f6 50%,#fff 55%,#93c5fd 80%,#3b82f6 100%)',
        filter:          'drop-shadow(0 0 12px #fff) drop-shadow(0 0 30px ' + (isLeft ? '#f97316' : '#3b82f6') + ') brightness(1.5)',
        willChange:      'left,top,transform,opacity',
      });
      layer.appendChild(el);

      // Trail elements
      const trails = [];
      for (let i = 0; i < 4; i++) {
        const tr = document.createElement('div');
        Object.assign(tr.style, {
          position:      'absolute',
          width:         (size * 0.6 - i * 8) + 'px',
          height:        (size * 0.6 - i * 8) + 'px',
          borderRadius:  '50%',
          background:    isLeft ? 'rgba(249,115,22,0.3)' : 'rgba(59,130,246,0.3)',
          pointerEvents: 'none',
          zIndex:        '59',
          filter:        'blur(4px)',
          left:          sx + 'px',
          top:           sy + 'px',
          transform:     'translate(-50%,-50%)',
        });
        layer.appendChild(tr);
        trails.push({ el: tr, delay: i * 0.06 });
      }

      const dur = 700;
      const t0  = performance.now();

      (function frame(now) {
        const p  = Math.min((now - t0) / dur, 1);
        const x  = sx + dx * p;
        const y  = sy + dy * p;
        const r  = p * 1260;
        const sc = 0.8 + p * 0.6;
        const o  = p < 0.65 ? 1 : 1 - (p - 0.65) / 0.35;

        el.style.left      = x + 'px';
        el.style.top       = y + 'px';
        el.style.transform = `translate(-50%,-50%) rotate(${r}deg) scale(${sc})`;
        el.style.opacity   = String(o);

        // Trail follows with delay
        trails.forEach(({ el: tr, delay }) => {
          const pt = Math.max(0, p - delay);
          const tx = sx + dx * pt;
          const ty = sy + dy * pt;
          tr.style.left    = tx + 'px';
          tr.style.top     = ty + 'px';
          tr.style.opacity = String(o * 0.6);
        });

        if (p < 1) {
          requestAnimationFrame(frame);
        } else {
          el.remove();
          trails.forEach(t => t.el.remove());
          narutoScore++;
          const scoreEl = document.getElementById('naruto-score');
          if (scoreEl) scoreEl.textContent = '\uD83D\uDCA0 ' + narutoScore;
          spawnImpact(x, y, isLeft);
        }
      })(t0);
    }

    /* ══ IMPACT ════════════════════════════════════════════ */
    function spawnImpact(x, y, isLeft) {
      const layer = document.getElementById('naruto-fx-layer');
      if (!layer) return;

      // Shockwave ring
      const ring = document.createElement('div');
      Object.assign(ring.style, {
        position:      'absolute',
        width:         '10px', height: '10px',
        left:          x + 'px', top: y + 'px',
        borderRadius:  '50%',
        border:        '4px solid ' + (isLeft ? 'rgba(249,115,22,0.9)' : 'rgba(59,130,246,0.9)'),
        boxShadow:     '0 0 20px ' + (isLeft ? '#f97316' : '#3b82f6'),
        transform:     'translate(-50%,-50%)',
        pointerEvents: 'none',
        zIndex:        '65',
      });
      layer.appendChild(ring);

      // Boom emoji
      const boom = document.createElement('div');
      boom.textContent = '\uD83D\uDCA5';
      Object.assign(boom.style, {
        position: 'absolute', fontSize: '64px', lineHeight: '1',
        left: x + 'px', top: y + 'px',
        transform: 'translate(-50%,-50%) scale(0.3)',
        pointerEvents: 'none', zIndex: '66',
      });
      layer.appendChild(boom);

      const t0 = performance.now();
      (function frame(now) {
        const p  = Math.min((now - t0) / 550, 1);
        const o  = 1 - p;
        ring.style.transform = `translate(-50%,-50%) scale(${1 + p * 10})`;
        ring.style.opacity   = String(o);
        boom.style.transform = `translate(-50%,-50%) scale(${0.3 + p * 2})`;
        boom.style.opacity   = String(o);
        if (p < 1) requestAnimationFrame(frame);
        else { ring.remove(); boom.remove(); }
      })(t0);
    }

  })();
});

/**
 * Btoan AI — Naruto Mode v4.0
 *
 * Effect giống demo naruto_ar.html:
 *   - Tay trái mở  → Shuriken (spinning disc) bám lòng bàn tay
 *   - Tay phải mở  → Chidori (canvas lightning) bám lòng bàn tay
 *   - Pinch bất kỳ → Ném shuriken thật + boom
 *
 * Không còn debug circle. Toàn bộ effect bằng CSS + Canvas.
 */

const DEBUG_HAND_MARKER = false; // bật = hiện vòng tròn debug

document.addEventListener('DOMContentLoaded', function () {
  (function () {
    /* ══════════════════════════════════════════════
       STATE
    ══════════════════════════════════════════════ */
    let narutoActive = false;
    let narutoScore  = 0;
    let lastPinchL   = false, lastPinchR = false;
    let animFrame    = null;

    // Smooth lerp state cho mỗi effect
    const shuState = { sx: 0, sy: 0, ss: 1, visible: false };
    const chiState = { sx: 0, sy: 0, ss: 1, visible: false };
    let chiBolts     = [];
    let chiLastBuild = 0;
    let mgkRotAngle  = 0;

    // Debug cursors (chỉ dùng khi DEBUG_HAND_MARKER = true)
    const debugCursors = { Left: null, Right: null };

    const btn = document.getElementById('toggleNarutoMode');
    if (!btn) return;

    btn.addEventListener('click', () => narutoActive ? closeNaruto() : openNaruto());

    /* ══════════════════════════════════════════════
       HELPERS
    ══════════════════════════════════════════════ */
    const lerp  = (a, b, t) => a + (b - a) * t;
    const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

    // Tâm lòng bàn tay: trung bình wrist + 4 MCP knuckle
    // landmarks ở đây là handStates[side] — KHÔNG phải MediaPipe raw
    // Ta dùng s.x, s.y (đã là screen px, từ index finger tip) làm proxy
    // vì HandEngine chỉ expose index tip position qua handStates.x/y

    // Ước lượng hand size từ handEngine để scale effect
    // HandEngine không expose hand size, ta dùng fixed base * zoom proxy
    function estimateHandRadius(s) {
      // Dùng smoothFactor-based heuristic: tay gần camera = marker to hơn
      // Không có dữ liệu thực → dùng fixed size đủ lớn
      return 90; // px, điều chỉnh theo cảm quan
    }

    /* ══════════════════════════════════════════════
       SHURIKEN CSS (element bám tay)
    ══════════════════════════════════════════════ */
    let shuEl = null;

    function buildShurikenEl() {
      if (document.getElementById('naruto-shuriken-el')) return;
      const el = document.createElement('div');
      el.id = 'naruto-shuriken-el';
      Object.assign(el.style, {
        position:        'absolute',
        width:           '160px',
        height:          '160px',
        left:            '0',
        top:             '0',
        transform:       'translate(-50%,-50%)',
        transformOrigin: 'center',
        pointerEvents:   'none',
        zIndex:          '50',
        display:         'none',
        // Shuriken 8-spoke star shape
        clipPath: 'polygon(50% 0%,55% 40%,80% 10%,60% 50%,100% 45%,65% 60%,90% 90%,50% 68%,10% 90%,35% 60%,0% 45%,40% 50%,20% 10%,45% 40%)',
        background:      'conic-gradient(from 0deg,#f97316 0%,#fbbf24 25%,#f97316 50%,#ea580c 75%,#f97316 100%)',
        filter:          'drop-shadow(0 0 18px #f97316) drop-shadow(0 0 40px rgba(249,115,22,0.6)) brightness(1.2)',
        animation:       'naruto-shu-spin 0.5s linear infinite',
        opacity:         '0',
        transition:      'opacity 0.15s',
        willChange:      'left, top, transform, opacity',
      });
      document.getElementById('naruto-fx-layer').appendChild(el);
      shuEl = el;

      // Inject keyframe nếu chưa có
      if (!document.getElementById('naruto-shu-kf')) {
        const s = document.createElement('style');
        s.id = 'naruto-shu-kf';
        s.textContent = `
          @keyframes naruto-shu-spin {
            0%   { transform: translate(-50%,-50%) rotate(0deg) scale(var(--shu-scale,1)); }
            100% { transform: translate(-50%,-50%) rotate(360deg) scale(var(--shu-scale,1)); }
          }
          @keyframes naruto-chakra-pulse {
            0%,100% { opacity:0.5; transform:translate(-50%,-50%) scale(1); }
            50%     { opacity:0.9; transform:translate(-50%,-50%) scale(1.08); }
          }
        `;
        document.head.appendChild(s);
      }
    }

    function showShurikenAt(x, y, scale) {
      if (!shuEl) return;
      shuState.sx = lerp(shuState.sx || x, x, 0.30);
      shuState.sy = lerp(shuState.sy || y, y, 0.30);
      shuState.ss = lerp(shuState.ss || scale, scale, 0.22);

      const sc = clamp(shuState.ss, 0.4, 2.5);
      shuEl.style.left    = shuState.sx + 'px';
      shuEl.style.top     = shuState.sy + 'px';
      shuEl.style.setProperty('--shu-scale', sc);
      shuEl.style.display = 'block';
      shuEl.style.opacity = '1';
      shuState.visible    = true;
    }

    function hideShuriken() {
      if (shuEl) { shuEl.style.opacity = '0'; }
      shuState.visible = false;
    }

    /* ══════════════════════════════════════════════
       CHIDORI — Canvas lightning bám tay phải
    ══════════════════════════════════════════════ */
    let narutoCanvas = null;
    let nCtx         = null;

    function getCanvas() {
      if (narutoCanvas) return narutoCanvas;
      narutoCanvas = document.getElementById('naruto-canvas');
      if (!narutoCanvas) return null;
      narutoCanvas.width  = window.innerWidth;
      narutoCanvas.height = window.innerHeight;
      nCtx = narutoCanvas.getContext('2d');
      return narutoCanvas;
    }

    function resizeCanvas() {
      if (!narutoCanvas) return;
      narutoCanvas.width  = window.innerWidth;
      narutoCanvas.height = window.innerHeight;
    }

    function boltPath(ox, oy, ang, len, segs) {
      const pts = [[ox, oy]];
      let cx = ox, cy = oy;
      for (let i = 0; i < segs; i++) {
        const spread = len * 0.32 * (1 - i / segs * 0.5);
        cx += Math.cos(ang) * (len / segs) + (Math.random() - 0.5) * spread;
        cy += Math.sin(ang) * (len / segs) + (Math.random() - 0.5) * spread;
        pts.push([cx, cy]);
      }
      return pts;
    }

    function drawChidori(x, y, radius) {
      if (!nCtx) return;

      chiState.sx = lerp(chiState.sx || x, x, 0.30);
      chiState.sy = lerp(chiState.sy || y, y, 0.30);

      const mx = chiState.sx;
      const my = chiState.sy;
      const r  = clamp(radius, 60, 200);

      // Rebuild bolts mỗi 35ms
      const now = performance.now();
      if (now - chiLastBuild > 35) {
        chiLastBuild = now;
        chiBolts = [];
        for (let i = 0; i < 22; i++) {
          const ang = (i / 22) * Math.PI * 2 + (Math.random() - 0.5) * 0.5;
          const len = r * (0.7 + Math.random() * 0.9);
          chiBolts.push(boltPath(mx, my, ang, len, 5 + Math.floor(Math.random() * 5)));
        }
      }

      // Glow halo
      const g = nCtx.createRadialGradient(mx, my, 0, mx, my, r * 1.35);
      g.addColorStop(0,   'rgba(90,170,255,0.60)');
      g.addColorStop(0.4, 'rgba(60,130,255,0.35)');
      g.addColorStop(1,   'rgba(20,60,255,0.00)');
      nCtx.fillStyle = g;
      nCtx.beginPath(); nCtx.arc(mx, my, r * 1.35, 0, Math.PI * 2); nCtx.fill();

      // White core
      const core = nCtx.createRadialGradient(mx, my, 0, mx, my, r * 0.40);
      core.addColorStop(0,   'rgba(240,248,255,1.0)');
      core.addColorStop(0.4, 'rgba(140,200,255,0.80)');
      core.addColorStop(1,   'rgba(60,120,255,0.00)');
      nCtx.fillStyle = core;
      nCtx.beginPath(); nCtx.arc(mx, my, r * 0.40, 0, Math.PI * 2); nCtx.fill();

      // Lightning bolts — glow pass + bright pass
      nCtx.shadowColor = '#55aaff';
      for (const bolt of chiBolts) {
        nCtx.beginPath();
        nCtx.moveTo(bolt[0][0], bolt[0][1]);
        for (let i = 1; i < bolt.length; i++) nCtx.lineTo(bolt[i][0], bolt[i][1]);
        nCtx.shadowBlur  = 20;
        nCtx.strokeStyle = 'rgba(100,190,255,0.60)';
        nCtx.lineWidth   = 4;
        nCtx.stroke();
        nCtx.shadowBlur  = 5;
        nCtx.strokeStyle = 'rgba(235,248,255,0.92)';
        nCtx.lineWidth   = 1.4;
        nCtx.stroke();
      }
      nCtx.shadowBlur = 0;
      chiState.visible = true;
    }

    /* ══════════════════════════════════════════════
       DEBUG MARKER (chỉ bật khi DEBUG_HAND_MARKER = true)
    ══════════════════════════════════════════════ */
    function createDebugCursor(side) {
      const el = document.createElement('div');
      Object.assign(el.style, {
        position:      'absolute',
        width:         '40px',
        height:        '40px',
        borderRadius:  '50%',
        border:        '2px dashed rgba(255,255,255,0.4)',
        transform:     'translate(-50%,-50%)',
        pointerEvents: 'none',
        zIndex:        '999',
        display:       'none',
        fontSize:      '9px',
        color:         'rgba(255,255,255,0.5)',
        textAlign:     'center',
        lineHeight:    '40px',
        fontFamily:    'monospace',
      });
      el.textContent = side[0];
      document.getElementById('naruto-fx-layer').appendChild(el);
      return el;
    }

    /* ══════════════════════════════════════════════
       CLOSE
    ══════════════════════════════════════════════ */
    window.closeNaruto = function () {
      narutoActive = false;
      document.getElementById('naruto-overlay').style.display = 'none';
      btn.classList.remove('naruto-active');

      hideShuriken();
      chiBolts = [];
      Object.values(debugCursors).forEach(c => { if (c) c.style.display = 'none'; });
      if (animFrame) { cancelAnimationFrame(animFrame); animFrame = null; }

      const ho = document.getElementById('hand-overlay');
      if (ho && window.handEngine?.isActive) ho.style.display = 'block';
    };

    /* ══════════════════════════════════════════════
       OPEN
    ══════════════════════════════════════════════ */
    async function openNaruto() {
      narutoActive = true;
      narutoScore  = 0;
      lastPinchL   = false;
      lastPinchR   = false;

      document.getElementById('naruto-overlay').style.display = 'block';
      document.getElementById('naruto-fx-layer').innerHTML = '';
      document.getElementById('naruto-score').textContent = '\uD83D\uDCA0 0';
      btn.classList.add('naruto-active');

      // Khởi tạo elements
      buildShurikenEl();
      getCanvas();
      window.addEventListener('resize', resizeCanvas);

      if (DEBUG_HAND_MARKER) {
        debugCursors.Left  = createDebugCursor('Left');
        debugCursors.Right = createDebugCursor('Right');
      }

      // Start handEngine
      if (window.handEngine && !window.handEngine.isActive) {
        await window.handEngine.start(false);
        await new Promise(r => setTimeout(r, 400));
      } else {
        const ho = document.getElementById('hand-overlay');
        if (ho) ho.style.display = 'none';
      }

      // Share camera stream hand-video → naruto-camera
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

    /* ══════════════════════════════════════════════
       MAIN LOOP
    ══════════════════════════════════════════════ */
    function narutoLoop() {
      if (!narutoActive) return;

      // Clear canvas mỗi frame
      if (nCtx && narutoCanvas) {
        nCtx.clearRect(0, 0, narutoCanvas.width, narutoCanvas.height);
      }

      const L = window.handEngine?.handStates?.['Left'];
      const R = window.handEngine?.handStates?.['Right'];

      const Lactive = L && L.history && L.history.length > 0;
      const Ractive = R && R.history && R.history.length > 0;

      /* ── Tay TRÁI = Shuriken ── */
      if (Lactive) {
        const radius = estimateHandRadius(L);
        const scale  = radius / 80; // normalize to ~1.0
        showShurikenAt(L.x, L.y, scale);

        if (DEBUG_HAND_MARKER && debugCursors.Left) {
          debugCursors.Left.style.display = 'block';
          debugCursors.Left.style.left    = L.x + 'px';
          debugCursors.Left.style.top     = L.y + 'px';
        }
      } else {
        hideShuriken();
        if (DEBUG_HAND_MARKER && debugCursors.Left) debugCursors.Left.style.display = 'none';
      }

      /* ── Tay PHẢI = Chidori ── */
      if (Ractive) {
        drawChidori(R.x, R.y, estimateHandRadius(R));

        if (DEBUG_HAND_MARKER && debugCursors.Right) {
          debugCursors.Right.style.display = 'block';
          debugCursors.Right.style.left    = R.x + 'px';
          debugCursors.Right.style.top     = R.y + 'px';
        }
      } else {
        chiState.visible = false;
        if (DEBUG_HAND_MARKER && debugCursors.Right) debugCursors.Right.style.display = 'none';
      }

      /* ── Pinch → ném shuriken thật ── */
      ['Left', 'Right'].forEach(side => {
        const s       = window.handEngine?.handStates?.[side];
        const active  = s && s.history && s.history.length > 0;
        if (!active) return;

        const isPinch = s.isPinching;
        const wasLast = (side === 'Left') ? lastPinchL : lastPinchR;

        if (isPinch && !wasLast) {
          launchShuriken(s.x, s.y,
            ((-Math.PI / 2) + (Math.random() - 0.5) * Math.PI * 0.85),
            480 + Math.random() * 320);
        }

        if (side === 'Left') lastPinchL = isPinch;
        else                 lastPinchR = isPinch;
      });

      animFrame = requestAnimationFrame(narutoLoop);
    }

    /* ══════════════════════════════════════════════
       LAUNCH SHURIKEN (pinch attack)
    ══════════════════════════════════════════════ */
    function launchShuriken(sx, sy, angle, power) {
      const dx = Math.cos(angle) * power;
      const dy = Math.sin(angle) * power;

      const layer = document.getElementById('naruto-fx-layer');
      if (!layer) return;

      // Shuriken bay — dùng cùng polygon shape nhưng to hơn + brighter
      const el = document.createElement('div');
      Object.assign(el.style, {
        position:        'absolute',
        width:           '80px',
        height:          '80px',
        left:            sx + 'px',
        top:             sy + 'px',
        clipPath:        'polygon(50% 0%,55% 40%,80% 10%,60% 50%,100% 45%,65% 60%,90% 90%,50% 68%,10% 90%,35% 60%,0% 45%,40% 50%,20% 10%,45% 40%)',
        background:      'conic-gradient(from 0deg,#fff 0%,#fbbf24 20%,#f97316 45%,#fff 50%,#fbbf24 70%,#f97316 95%,#fff 100%)',
        filter:          'drop-shadow(0 0 20px #fff) drop-shadow(0 0 40px #f97316) brightness(1.4)',
        transformOrigin: 'center',
        pointerEvents:   'none',
        zIndex:          '60',
        willChange:      'left, top, transform, opacity',
      });
      layer.appendChild(el);

      const dur = 700;
      const t0  = performance.now();

      (function frame(now) {
        const p  = Math.min((now - t0) / dur, 1);
        const x  = sx + dx * p;
        const y  = sy + dy * p;
        const r  = p * 1080; // xoay 3 vòng
        const sc = 1 + p * 0.5;
        const o  = p < 0.7 ? 1 : 1 - (p - 0.7) / 0.3;

        el.style.left      = x + 'px';
        el.style.top       = y + 'px';
        el.style.transform = `translate(-50%,-50%) rotate(${r}deg) scale(${sc})`;
        el.style.opacity   = String(o);

        if (p < 1) {
          requestAnimationFrame(frame);
        } else {
          el.remove();
          narutoScore++;
          const scoreEl = document.getElementById('naruto-score');
          if (scoreEl) scoreEl.textContent = '\uD83D\uDCA0 ' + narutoScore;
          spawnBoom(x, y);
        }
      })(t0);
    }

    /* ══════════════════════════════════════════════
       BOOM
    ══════════════════════════════════════════════ */
    function spawnBoom(x, y) {
      const layer = document.getElementById('naruto-fx-layer');
      if (!layer) return;

      // Shockwave ring
      const ring = document.createElement('div');
      Object.assign(ring.style, {
        position:      'absolute',
        width:         '20px',
        height:        '20px',
        left:          x + 'px',
        top:           y + 'px',
        borderRadius:  '50%',
        border:        '4px solid rgba(249,115,22,0.9)',
        boxShadow:     '0 0 20px rgba(249,115,22,0.7)',
        transform:     'translate(-50%,-50%) scale(1)',
        pointerEvents: 'none',
        zIndex:        '65',
      });
      layer.appendChild(ring);

      // Emoji boom
      const boom = document.createElement('div');
      boom.textContent = '\uD83D\uDCA5';
      Object.assign(boom.style, {
        position:      'absolute',
        fontSize:      '72px',
        lineHeight:    '1',
        left:          x + 'px',
        top:           y + 'px',
        transform:     'translate(-50%,-50%) scale(0.4)',
        pointerEvents: 'none',
        zIndex:        '66',
      });
      layer.appendChild(boom);

      const t0 = performance.now();
      (function frame(now) {
        const p  = Math.min((now - t0) / 500, 1);
        const sc = 0.4 + p * 2.5;
        const o  = 1 - p;

        // Ring expand
        ring.style.transform = `translate(-50%,-50%) scale(${1 + p * 8})`;
        ring.style.opacity   = String(1 - p);

        // Boom emoji
        boom.style.transform = `translate(-50%,-50%) scale(${sc})`;
        boom.style.opacity   = String(o);

        if (p < 1) requestAnimationFrame(frame);
        else { ring.remove(); boom.remove(); }
      })(t0);
    }

  })();
});

/**
 * Btoan AI — Naruto Mode v6.0
 *
 * Gesture Map:
 *   Open palm (1 tay)          → Flame Chakra / Chidori bám từng ngón
 *   Pinch                      → Nén năng lượng → phóng shuriken
 *   2 tay, mỗi tay 1 ngón trỏ → Dual Index Bridge (seal chakra beam)
 *
 * Tất cả effect được sinh từ landmark thật, không có sprite cố định.
 */

const DEBUG_SHOW_WEBCAM = false; // true = hiện lại webcam feed trong naruto overlay

document.addEventListener('DOMContentLoaded', function () {
  (function () {

    /* ═══════════════════════════════════════════════════════
       STATE
    ═══════════════════════════════════════════════════════ */
    let narutoActive = false;
    let narutoScore  = 0;
    let lastPinchL   = false, lastPinchR = false;
    let animFrame    = null;
    let nCanvas, nCtx;
    let T = 0; // frame timestamp

    // Particle pools
    const particles = { Left: [], Right: [], Bridge: [], Kameha: [] };

    // Hold counters cho gesture debounce
    const hold = { Lpoint: 0, Rpoint: 0 };
    const HOLD_FRAMES = 3; // số frame phải giữ gesture

    // Summon progress: kiểm soát 3 pha hiệu ứng 2 tay
    const summon = {
      progress: 0, startedAt: 0, decayStart: 0, state: 'idle',
    };
    const SUMMON_RISE_MS  = 750;
    const SUMMON_DECAY_MS = 400;

    // Kamehameha state
    const kameha = {
      state: 'idle',  // 'idle'|'charging'|'firing'
      chargeStart: 0,
      progress: 0,    // 0→1 trong charge
      origin: null,
      angle: 0,
      firedAt: 0,
    };
    const KAMEHA_CHARGE_MS = 1200; 
    const KAMEHA_FIRE_MS   = 3000; // Tăng lên 3 giây

    // Face state
    let facePos = null; // { x, y, w, h, roll }
    let lastFaceDetectT = 0;
    const FACE_DETECT_INTERVAL = 150; // ms

    // SSJ Hair Image Local Asset (Sửa lỗi CORS)
    const hairImg = new Image();
    hairImg.src = "ssj_hair.png?v=2"; // Force reload
    
    let hairCanvas = null;
    hairImg.onload = () => {
      const tempCanvas = document.createElement('canvas');
      const tempCtx = tempCanvas.getContext('2d');
      tempCanvas.width = hairImg.width;
      tempCanvas.height = hairImg.height;
      tempCtx.drawImage(hairImg, 0, 0);
      const imgData = tempCtx.getImageData(0, 0, tempCanvas.width, tempCanvas.height);
      const pixels = imgData.data;
      for (let i = 0; i < pixels.length; i += 4) {
        // Xóa màu trắng HOẶC màu đen tuyệt đối nếu có
        const isWhite = pixels[i] > 240 && pixels[i+1] > 240 && pixels[i+2] > 240;
        const isBlack = pixels[i] < 15 && pixels[i+1] < 15 && pixels[i+2] < 15;
        if (isWhite || isBlack) {
          pixels[i+3] = 0;
        }
      }
      tempCtx.putImageData(imgData, 0, 0);
      hairCanvas = tempCanvas;
      console.log("Hair Loaded Locally");
    };


    const btn = document.getElementById('toggleNarutoMode');
    if (!btn) return;
    btn.addEventListener('click', () => narutoActive ? closeNaruto() : openNaruto());

    /* ═══════════════════════════════════════════════════════
       MATH
    ═══════════════════════════════════════════════════════ */
    const lerp  = (a, b, t) => a + (b - a) * t;
    const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
    const rand  = (lo, hi) => lo + Math.random() * (hi - lo);
    const dist2 = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

    // MediaPipe normalized → screen px (mirror X)
    function lm2px(lm, W, H) { return { x: (1 - lm.x) * W, y: lm.y * H }; }

    // Average screen coords from landmark index list
    function avgPts(pts, idxs) {
      const s = idxs.reduce((acc, i) => ({ x: acc.x + pts[i].x, y: acc.y + pts[i].y }), { x: 0, y: 0 });
      return { x: s.x / idxs.length, y: s.y / idxs.length };
    }

    /* ═══════════════════════════════════════════════════════
       GESTURE CLASSIFIERS
       Dùng raw MediaPipe landmarks (normalized 0-1)
       y=0 = top of screen, y=1 = bottom
       Finger "extended" = tip.y < pip.y (tip is above pip)
    ═══════════════════════════════════════════════════════ */

    // Một ngón có extended không
    function fingerUp(lms, tip, pip, mcp) {
      return lms[tip].y < lms[pip].y - 0.02 && lms[pip].y < lms[mcp].y;
    }

    // Index ngón trỏ extended, 3 ngón còn lại cuộn
    function isPointingIndex(lms) {
      if (!lms) return false;
      const indexExt  = lms[8].y  < lms[6].y  - 0.03;
      const middleCurl = lms[12].y > lms[10].y;
      const ringCurl   = lms[16].y > lms[14].y;
      const pinkyCurl  = lms[20].y > lms[18].y;
      return indexExt && middleCurl && ringCurl && pinkyCurl;
    }

    // Bàn tay mở (>= 3 ngón extended)
    function isOpenPalm(lms) {
      if (!lms) return false;
      let count = 0;
      if (fingerUp(lms, 8, 6, 5))   count++;
      if (fingerUp(lms, 12, 10, 9)) count++;
      if (fingerUp(lms, 16, 14, 13)) count++;
      if (fingerUp(lms, 20, 18, 17)) count++;
      return count >= 3;
    }

    /* ═══════════════════════════════════════════════════════
       OPEN / CLOSE
    ═══════════════════════════════════════════════════════ */
    window.closeNaruto = function () {
      narutoActive = false;
      document.getElementById('naruto-overlay').style.display = 'none';
      btn.classList.remove('naruto-active');
      particles.Left = []; particles.Right = []; particles.Bridge = [];
      hold.Lpoint = 0; hold.Rpoint = 0;
      if (animFrame) { cancelAnimationFrame(animFrame); animFrame = null; }
      const ho = document.getElementById('hand-overlay');
      if (ho && window.handEngine?.isActive) ho.style.display = 'block';
    };

    async function openNaruto() {
      narutoActive = true;
      narutoScore  = 0;
      lastPinchL   = false; lastPinchR = false;
      particles.Left = []; particles.Right = []; particles.Bridge = [];

      document.getElementById('naruto-overlay').style.display = 'block';
      document.getElementById('naruto-fx-layer').innerHTML  = '';
      document.getElementById('naruto-score').textContent   = '\uD83D\uDCA0 0';
      btn.classList.add('naruto-active');

      // Canvas
      nCanvas = document.getElementById('naruto-canvas');
      nCanvas.width  = window.innerWidth;
      nCanvas.height = window.innerHeight;
      nCtx = nCanvas.getContext('2d');
      window.addEventListener('resize', () => {
        if (!nCanvas) return;
        nCanvas.width  = window.innerWidth;
        nCanvas.height = window.innerHeight;
      });

      // Camera feed luôn hiện — effect overlay lên trên
      const narutoCam = document.getElementById('naruto-camera');
      if (narutoCam) narutoCam.style.opacity = '0.88';

      // Start handEngine
      if (window.handEngine && !window.handEngine.isActive) {
        await window.handEngine.start(false);
        await new Promise(r => setTimeout(r, 400));
      } else {
        const ho = document.getElementById('hand-overlay');
        if (ho) ho.style.display = 'none';
      }

      // Share stream: hand-video → naruto-camera
      const handVideo = document.getElementById('hand-video');
      if (handVideo?.srcObject && narutoCam) {
        narutoCam.srcObject = handVideo.srcObject;
        narutoCam.play().catch(() => {});
      }
      const ho = document.getElementById('hand-overlay');
      if (ho) ho.style.display = 'none';

      narutoLoop();
    }

    /* ═══════════════════════════════════════════════════════
       MAIN LOOP
    ═══════════════════════════════════════════════════════ */
    function narutoLoop() {
      if (!narutoActive) return;
      T = performance.now();

      const W = window.innerWidth;
      const H = window.innerHeight;

      nCtx.clearRect(0, 0, W, H);

      // ── Face detection (150ms interval) ──
      const narutoCam = document.getElementById('naruto-camera');
      if (narutoCam && T - lastFaceDetectT > FACE_DETECT_INTERVAL) {
        lastFaceDetectT = T;
        detectFace(narutoCam);
      }

      if (facePos) drawSSJHair(facePos, W, H);

      const sL = window.handEngine?.handStates?.['Left'];
      const sR = window.handEngine?.handStates?.['Right'];
      
      const isValidHand = (s) => {
        if (!s || !s.landmarks) return false;
        // Sử dụng score vừa được hand_engine.js truyền sang
        return s.score > 0.65; 
      };

      const Lactive = isValidHand(sL);
      const Ractive = isValidHand(sR);

      // ── Gesture hold debounce ──
      hold.Lpoint = Lactive && isPointingIndex(sL.landmarks) ? hold.Lpoint + 1 : 0;
      hold.Rpoint = Ractive && isPointingIndex(sR.landmarks) ? hold.Rpoint + 1 : 0;

      const Lpointing = hold.Lpoint >= HOLD_FRAMES;
      const Rpointing = hold.Rpoint >= HOLD_FRAMES;
      const dualBridge = Lpointing && Rpointing;

      // ── Kamehameha detection (priority cao nhất trước bridge) ──
      const kamehamehaClose = Lactive && Ractive && isKamehamehaClose(sL, sR, W, H);

      // ── Summon progress management (chỉ khi không trong kameha) ──
      if (!kamehamehaClose) {
        if (dualBridge) {
          if (summon.state === 'idle' || summon.state === 'decaying') {
            summon.state = 'rising';
            summon.startedAt = T - summon.progress * SUMMON_RISE_MS;
          }
          summon.progress = Math.min((T - summon.startedAt) / SUMMON_RISE_MS, 1);
          if (summon.progress >= 1) summon.state = 'stable';
        } else {
          if (summon.state === 'rising' || summon.state === 'stable') {
            summon.state      = 'decaying';
            summon.decayStart = T - (1 - summon.progress) * SUMMON_DECAY_MS;
          }
          if (summon.state === 'decaying') {
            summon.progress = Math.max(1 - (T - summon.decayStart) / SUMMON_DECAY_MS, 0);
            if (summon.progress <= 0) { summon.state = 'idle'; summon.startedAt = 0; }
          }
        }
      }

      // ── KAMEHA STATE MACHINE ──
      if (kamehamehaClose && kameha.state === 'idle') {
        kameha.state = 'charging';
        kameha.chargeStart = T;
        kameha.progress = 0;
      }
      if (!kamehamehaClose && kameha.state === 'charging') {
        // Hủy nếu bỏ tay
        kameha.state = 'idle'; kameha.progress = 0;
      }
      if (kameha.state === 'charging') {
        kameha.progress = Math.min((T - kameha.chargeStart) / KAMEHA_CHARGE_MS, 1);
        // Auto-fire khi chạm mức
        if (kameha.progress >= 1) {
          const ptsL = sL.landmarks.map(lm => lm2px(lm, W, H));
          const ptsR = sR.landmarks.map(lm => lm2px(lm, W, H));
          const pL = avgPts(ptsL, [0, 5, 9, 13, 17]);
          const pR = avgPts(ptsR, [0, 5, 9, 13, 17]);
          
          kameha.origin = { x: (pL.x + pR.x) * 0.5, y: (pL.y + pR.y) * 0.5 };
          
          // Tính hướng dựa trên vector từ cổ tay đến ngón giữa của cả 2 tay
          const getHandAngle = (pts) => Math.atan2(pts[9].y - pts[0].y, pts[9].x - pts[0].x);
          const angL = getHandAngle(ptsL);
          const angR = getHandAngle(ptsR);
          kameha.angle = (angL + angR) * 0.5;

          kameha.state  = 'firing';
          kameha.firedAt = T;
          kameha.progress = 0;
        }
      }
      if (kameha.state === 'firing') {
        kameha.progress = Math.min((T - kameha.firedAt) / KAMEHA_FIRE_MS, 1);
        if (kameha.progress >= 1) kameha.state = 'idle';
      }

      // ── RENDER PRIORITY: kameha > bridge > single-hand ──
      if (kameha.state === 'charging') {
        // Vẫn hiện 2 tay nhưng với single effect nhẹ + kameha charge
        if (Lactive) drawHandEffect(sL, 'Left',  W, H);
        if (Ractive) drawHandEffect(sR, 'Right', W, H);
        drawKamehaCharge(sL, sR, W, H, kameha.progress);
      } else if (kameha.state === 'firing') {
        const isForward = Math.abs(Math.cos(kameha.angle)) < 0.3 && Math.abs(Math.sin(kameha.angle)) < 0.3; 
        if (isForward) {
          drawKamehaFirePerspective(kameha.origin, kameha.progress, W, H);
        } else {
          drawKamehaBeam(kameha.origin, kameha.angle, kameha.progress, W, H);
        }
        drawParticles('Kameha', null, true);
      } else {
        const bridgeVisible = summon.progress > 0 || dualBridge;
        if (bridgeVisible && (sL?.landmarks || sR?.landmarks)) {
          const _sL = Lactive ? sL : sR;
          const _sR = Ractive ? sR : sL;
          if (_sL && _sR) drawDualIndexBridge(_sL, _sR, W, H, summon.progress);
        } else {
          if (Lactive) drawHandEffect(sL, 'Left',  W, H);
          if (Ractive) drawHandEffect(sR, 'Right', W, H);
        }
      }

      // ── HUD Debug Overlay (Thấp, góc trái) ──
      drawHUDDebug(W, H, Lactive, Ractive, dualBridge, facePos, kameha);

      animFrame = requestAnimationFrame(narutoLoop);
    }

    function drawHUDDebug(W, H, L, R, bridge, face, km) {
      nCtx.save();
      nCtx.fillStyle = 'rgba(0,40,0,0.7)';
      nCtx.fillRect(10, H - 160, 240, 150);
      nCtx.fillStyle = '#0f0';
      nCtx.font = '12px monospace';
      const kmLine = `KAMEHA: ${km.state.toUpperCase()} (${(km.progress*100).toFixed(0)}%)`;
      const faceLine = face ? `FACE: ${Math.round(face.x)},${Math.round(face.y)} (VISIBLE)` : `FACE: SEARCHING...`;
      
      const lines = [
        `DETECT-H: L=${L?'OK':'--'} R=${R?'OK':'--'}`,
        `GESTURE: Bridge=${bridge?'YES':'NO'}`,
        faceLine,
        kmLine,
        `T: ${Math.floor(T)}`
      ];
      lines.forEach((l, i) => nCtx.fillText(l, 20, H - 140 + i * 18));
      nCtx.restore();
    }

    /* ── KAMEHAMEHA DETECTOR ──────────────────────────────────── */
    function isKamehamehaClose(sL, sR, W, H) {
      if (!sL.landmarks || !sR.landmarks) return false;
      const ptsL = sL.landmarks.map(lm => lm2px(lm, W, H));
      const ptsR = sR.landmarks.map(lm => lm2px(lm, W, H));
      const palmL = avgPts(ptsL, [0, 5, 9, 13, 17]);
      const palmR = avgPts(ptsR, [0, 5, 9, 13, 17]);
      // Trả về 0.28W để yêu cầu chụm tay sát hơn, tránh ghost trigger
      return dist2(palmL, palmR) < W * 0.28; 
    }

    /* ═══════════════════════════════════════════════════════
       SINGLE HAND EFFECT
    ═══════════════════════════════════════════════════════ */
    function drawHandEffect(s, side, W, H) {
      const lms    = s.landmarks;
      const isLeft = side === 'Left';

      // All 21 points → screen px
      const pts = lms.map(lm => lm2px(lm, W, H));

      // Palm center = avg wrist(0) + 4 MCP knuckles(5,9,13,17)
      const palm   = avgPts(pts, [0, 5, 9, 13, 17]);
      const handSz = dist2(pts[0], pts[9]); // wrist → middle MCP

      // Calculate hand openness amount (fingertips distance to palm)
      const tipIdxs = [4, 8, 12, 16, 20];
      let avgTipDist = 0;
      tipIdxs.forEach(t => avgTipDist += dist2(pts[t], palm));
      avgTipDist /= tipIdxs.length;
      // Normalization: raw open amount 0 (closed) đến ~1.5 (fully open)
      // Dùng hàm mũ để độ bung rõ rệt hơn ở cuối
      const rawOpen = clamp(avgTipDist / (handSz * 1.6), 0.35, 1.5);
      const openAmount = Math.pow(rawOpen, 1.8); 

      // Fingertip + MCP pairs for energy lines
      const fingerPairs = [
        { tip: 4,  mcp: 2  }, // thumb
        { tip: 8,  mcp: 5  }, // index
        { tip: 12, mcp: 9  }, // middle
        { tip: 16, mcp: 13 }, // ring
        { tip: 20, mcp: 17 }, // pinky
      ];

      nCtx.save();
      nCtx.globalCompositeOperation = 'screen';

      if (!s.isPinching) {
        // scale visual mạnh hơn hẳn theo độ mở
        const scl = openAmount * 1.25;

        // ── Palm organic glow ──
        drawOrganicCore(palm, handSz * (0.8 + scl * 2.5), isLeft);

        // ── Energy tendrils palm → mỗi đầu ngón ──
        for (const { tip, mcp } of fingerPairs) {
          drawTendril(palm, pts[mcp], pts[tip], isLeft);
        }

        // ── Chakra ring ──
        drawImperfectRing(palm, handSz * 1.5 * scl, isLeft);

        // ── Emit sparks from extended fingertips ──
        for (const { tip } of fingerPairs) {
          if (Math.random() < 0.4) {
            spawnParticle(pts[tip], side, isLeft);
          }
        }
      } else {
        // ── Pinch: energy compresses to thumb-index midpoint ──
        const pinchX = (pts[4].x + pts[8].x) * 0.5;
        const pinchY = (pts[4].y + pts[8].y) * 0.5;
        drawPinchCore({ x: pinchX, y: pinchY }, palm, handSz, isLeft);
      }

      nCtx.restore();
    }

    /* ── Organic (non-perfect) palm glow ────────────────── */
    function drawOrganicCore(palm, sz, isLeft) {
      // Smooth multi-frequency flicker (không random mỗi frame → không nhấp nháy gắt)
      const flicker = 0.88
        + Math.sin(T * 0.0031) * 0.07
        + Math.sin(T * 0.0053) * 0.04
        + Math.sin(T * 0.0127) * 0.02;
      const pulse   = 1 + Math.sin(T * 0.003) * 0.15 + Math.sin(T * 0.0071) * 0.06;
      const r       = sz * 0.7 * pulse;

      // Outer soft glow (rất to, alpha thấp)
      const [outerC, c0, c1, c2, edge] = isLeft
        ? ['rgba(255,80,0,0.06)', 'rgba(255,200,80,0.92)', 'rgba(255,120,15,0.55)', 'rgba(253,60,0,0.20)', 'rgba(255,20,0,0)']
        : ['rgba(40,80,255,0.06)', 'rgba(200,235,255,0.92)', 'rgba(80,160,255,0.55)', 'rgba(40,100,255,0.20)', 'rgba(20,50,255,0)'];

      // Outer soft glow (3× radius)
      const go = nCtx.createRadialGradient(palm.x, palm.y, 0, palm.x, palm.y, r * 3);
      go.addColorStop(0, isLeft ? 'rgba(255,100,20,0.18)' : 'rgba(80,150,255,0.18)');
      go.addColorStop(1, 'rgba(0,0,0,0)');
      nCtx.fillStyle = go;
      nCtx.beginPath(); nCtx.arc(palm.x, palm.y, r * 3, 0, Math.PI * 2); nCtx.fill();

      // Multiple offset blobs → organic feel
      const offsets = [
        { dx:  sz * 0.07, dy: -sz * 0.05, scale: 0.80 },
        { dx: -sz * 0.05, dy:  sz * 0.08, scale: 0.70 },
        { dx:  sz * 0.02, dy:  sz * 0.01, scale: 1.00 }, // dominant center
      ];

      for (const { dx, dy, scale } of offsets) {
        const cx = palm.x + dx; const cy = palm.y + dy;
        const cr = r * scale;
        const g  = nCtx.createRadialGradient(cx, cy, 0, cx, cy, cr);
        g.addColorStop(0,    c0);
        g.addColorStop(0.25, c1);
        g.addColorStop(0.60, c2);
        g.addColorStop(1,    edge);
        nCtx.fillStyle = g;
        nCtx.beginPath(); nCtx.arc(cx, cy, cr, 0, Math.PI * 2); nCtx.fill();
      }

      // Flame wisps — organic tendrils từ core, dùng flicker đã tính sẵn
      const numWisps = 6;
      for (let i = 0; i < numWisps; i++) {
        // Phase offset per wisp nên không nhấp nháy đồng bộ
        const wFlick = 0.85 + Math.sin(T * 0.004 + i * 1.3) * 0.15;
        const angle  = (i / numWisps) * Math.PI * 2 + T * 0.0008 + i * 0.22;
        const wLen   = sz * (0.45 + Math.sin(T * 0.003 + i) * 0.2);
        const ex     = palm.x + Math.cos(angle) * wLen;
        const ey     = palm.y + Math.sin(angle) * wLen;
        const cpx    = palm.x + (ex - palm.x) * 0.5 + Math.sin(T * 0.007 + i) * sz * 0.12;
        const cpy    = palm.y + (ey - palm.y) * 0.5 + Math.cos(T * 0.007 + i) * sz * 0.12;
        nCtx.beginPath(); nCtx.moveTo(palm.x, palm.y);
        nCtx.quadraticCurveTo(cpx, cpy, ex, ey);
        const a = 0.25 * wFlick * flicker;
        nCtx.strokeStyle = isLeft ? `rgba(255,210,90,${a})` : `rgba(120,190,255,${a})`;
        nCtx.lineWidth   = 1.5 + Math.sin(T * 0.005 + i) * 0.5;
        nCtx.shadowColor = isLeft ? '#ff8800' : '#4488ff';
        nCtx.shadowBlur  = 6;
        nCtx.stroke();
      }
    }

    /* ── Lightning tendril với nhánh phụ ────────────────── */
    function drawTendril(from, knuckle, tip, isLeft) {
      // Time-based flicker (mỗi ngón phase khác nhau)
      const phaseKey = from.x + from.y; // pseudo-unique per finger
      const flick = 0.82 + Math.sin(T * 0.0045 + phaseKey * 0.001) * 0.18;

      const [glow, bright, sh] = isLeft
        ? [`rgba(255,170,40,${flick * 0.7})`, `rgba(255,245,190,${flick * 0.85})`, '#ff8800']
        : [`rgba(80,170,255,${flick * 0.7})`, `rgba(210,238,255,${flick * 0.85})`, '#3399ff'];

      // Draw one jittered bolt segment a→b
      const bolt = (a, b, colorStr, width, blur) => {
        const dx  = b.x - a.x; const dy = b.y - a.y;
        const len = Math.hypot(dx, dy) || 1;
        const nx  = -dy / len; const ny = dx / len;
        const segs = 6;
        nCtx.beginPath(); nCtx.moveTo(a.x, a.y);
        const pts = [[a.x, a.y]];
        for (let i = 1; i <= segs; i++) {
          const p   = i / segs;
          const jx  = nx * rand(-len * 0.06, len * 0.06);
          const jy  = ny * rand(-len * 0.06, len * 0.06);
          const px_ = a.x + dx * p + jx;
          const py_ = a.y + dy * p + jy;
          pts.push([px_, py_]);
          nCtx.lineTo(px_, py_);
        }
        nCtx.shadowColor = sh; nCtx.shadowBlur = blur;
        nCtx.strokeStyle = colorStr; nCtx.lineWidth = width;
        nCtx.stroke();
        return pts;
      };

      // Branch phụ ngắn (xác suất 35%)
      const addBranch = (a, b) => {
        if (Math.random() > 0.35) return;
        const dx = b.x - a.x; const dy = b.y - a.y;
        const bT  = rand(0.3, 0.65);
        const bx  = a.x + dx * bT; const by = a.y + dy * bT;
        const bLen = rand(0.2, 0.38);
        const bAng = Math.atan2(dy, dx) + (Math.random() > 0.5 ? 0.6 : -0.6);
        const ex   = bx + Math.cos(bAng) * Math.hypot(dx, dy) * bLen;
        const ey   = by + Math.sin(bAng) * Math.hypot(dx, dy) * bLen;
        nCtx.beginPath(); nCtx.moveTo(bx, by); nCtx.lineTo(ex, ey);
        nCtx.strokeStyle = isLeft ? `rgba(255,220,120,${flick * 0.45})` : `rgba(180,220,255,${flick * 0.45})`;
        nCtx.lineWidth   = 0.8; nCtx.shadowBlur = 4; nCtx.stroke();
      };

      nCtx.shadowColor = sh;
      // palm → knuckle
      bolt(from, knuckle, glow,  3.0, 12);
      bolt(from, knuckle, bright, 1.0, 3);
      addBranch(from, knuckle);
      // knuckle → tip
      bolt(knuckle, tip, glow,  2.0, 10);
      bolt(knuckle, tip, bright, 0.8, 3);
      addBranch(knuckle, tip);
    }

    /* ── Imperfect segmented ring ─────────────────────────── */
    function drawImperfectRing(palm, r, isLeft) {
      const t      = T;
      const segs   = isLeft ? 7 : 11; // prime numbers = less symmetric feel
      const rot1   = (t * 0.0013) % (Math.PI * 2);
      const rot2   = -(t * 0.0009) % (Math.PI * 2);
      const color  = isLeft ? 'rgba(255,150,30,0.60)' : 'rgba(70,160,255,0.65)';
      const color2 = isLeft ? 'rgba(255,220,100,0.40)' : 'rgba(150,210,255,0.40)';

      nCtx.shadowColor = isLeft ? '#ff8800' : '#4499ff';

      // Outer ring, uneven segments
      for (let i = 0; i < segs; i++) {
        const t0 = rot1 + (Math.PI * 2 / segs) * i;
        // Vary gap size per segment for imperfect look
        const gapFrac = 0.08 + (i % 3) * 0.04;
        const arcLen  = (Math.PI * 2 / segs) * (1 - gapFrac);
        // Slight radius wobble
        const rWobble = r * (1 + Math.sin(t * 0.003 + i) * 0.06);
        nCtx.beginPath(); nCtx.arc(palm.x, palm.y, rWobble, t0, t0 + arcLen);
        nCtx.strokeStyle = color;
        nCtx.lineWidth   = 2.0 + Math.sin(t * 0.004 + i) * 0.5;
        nCtx.shadowBlur  = 8;
        nCtx.stroke();
      }

      // Inner counter-rotating ring
      const segs2 = segs + 2;
      for (let i = 0; i < segs2; i++) {
        const t0    = rot2 + (Math.PI * 2 / segs2) * i;
        const arcLen = (Math.PI * 2 / segs2) * 0.72;
        nCtx.beginPath(); nCtx.arc(palm.x, palm.y, r * 0.52, t0, t0 + arcLen);
        nCtx.strokeStyle = color2;
        nCtx.lineWidth   = 1.5;
        nCtx.shadowBlur  = 5;
        nCtx.stroke();
      }
    }

    /* ── Pinch charge state ───────────────────────────────── */
    function drawPinchCore(pinch, palm, handSz, isLeft) {
      const pulse = 0.6 + 0.4 * Math.abs(Math.sin(T * 0.018));
      const r     = handSz * 0.28 * pulse;
      const [c0, c1, sh] = isLeft
        ? ['rgba(255,255,200,0.95)', 'rgba(255,130,20,0.70)', '#ff8800']
        : ['rgba(200,235,255,0.95)', 'rgba(60,150,255,0.72)', '#3399ff'];

      const g = nCtx.createRadialGradient(pinch.x, pinch.y, 0, pinch.x, pinch.y, r * 1.6);
      g.addColorStop(0, c0); g.addColorStop(0.4, c1); g.addColorStop(1, 'rgba(0,0,0,0)');
      nCtx.fillStyle = g;
      nCtx.beginPath(); nCtx.arc(pinch.x, pinch.y, r * 1.6, 0, Math.PI * 2); nCtx.fill();

      // Compression ring
      nCtx.shadowColor = sh; nCtx.shadowBlur = 20;
      nCtx.strokeStyle = isLeft ? `rgba(255,200,60,${pulse})` : `rgba(100,190,255,${pulse})`;
      nCtx.lineWidth   = 3;
      nCtx.beginPath(); nCtx.arc(pinch.x, pinch.y, r, 0, Math.PI * 2); nCtx.stroke();

      // Energy lines converging from palm
      for (let i = 0; i < 6; i++) {
        const angle = (i / 6) * Math.PI * 2 + T * 0.002;
        const sx    = palm.x + Math.cos(angle) * handSz * 0.5;
        const sy    = palm.y + Math.sin(angle) * handSz * 0.5;
        nCtx.beginPath(); nCtx.moveTo(sx, sy); nCtx.lineTo(pinch.x, pinch.y);
        nCtx.strokeStyle = isLeft ? `rgba(255,160,40,${0.4 * pulse})` : `rgba(80,160,255,${0.4 * pulse})`;
        nCtx.lineWidth   = 1.5; nCtx.shadowBlur = 6; nCtx.stroke();
      }
    }

    /* ═══════════════════════════════════════════════════════
       DUAL INDEX BRIDGE  (3 GIAI ĐOẠN SUMMON)

       sp = easeOutCubic(rawProgress)  [0 → 1]

       Giai đoạn 1  sp < 0.30  (0–225ms)
         → chỉ seed spark nhỏ tại palm + nguyên tử rất nhỏ

       Giai đoạn 2  sp < 0.65  (225–490ms)
         → core phình lên, tia sáng từ ngón đổ vào core
         → bridge mờ, orb chưa hiện

       Giai đoạn 3  sp ≥ 0.65  (490ms+)
         → full bridge arc sáng, orb lớn, seal ring, resonance
    ═══════════════════════════════════════════════════════ */
    function drawDualIndexBridge(sL, sR, W, H, rawProgress) {
      // easeOutCubic: nhanh lúc đầu, chậm dần khi gần đến 1
      const sp = 1 - Math.pow(1 - clamp(rawProgress, 0, 1), 3);
      const pulse = 0.78 + 0.22 * Math.sin(T * 0.011);

      const ptsL = sL.landmarks.map(lm => lm2px(lm, W, H));
      const ptsR = sR.landmarks.map(lm => lm2px(lm, W, H));

      const tipL  = ptsL[8];   const tipR  = ptsR[8];
      const palmL = avgPts(ptsL, [0, 5, 9, 13, 17]);
      const palmR = avgPts(ptsR, [0, 5, 9, 13, 17]);
      const szL   = dist2(ptsL[0], ptsL[9]);
      const szR   = dist2(ptsR[0], ptsR[9]);

      const mid  = { x: (tipL.x + tipR.x) * 0.5, y: (tipL.y + tipR.y) * 0.5 };
      const d    = dist2(tipL, tipR);
      const maxD = W * 0.80;
      const intensity = clamp(1 - d / maxD, 0, 1);

      nCtx.save();
      nCtx.globalCompositeOperation = 'screen';

      /* ── GIAI ĐOẠN 1: Seed sparks (Bỏ đốm sáng to) ─────────────── */
      // Chỉ vẽ glow rất mờ, không vẽ đốm đặc
      if (sp < 0.3) {
        for (const palm of [palmL, palmR]) {
          const g = nCtx.createRadialGradient(palm.x, palm.y, 0, palm.x, palm.y, szL * sp);
          g.addColorStop(0, `rgba(100,180,255,${sp * 0.3})`);
          g.addColorStop(1, 'rgba(0,0,0,0)');
          nCtx.fillStyle = g;
          nCtx.beginPath(); nCtx.arc(palm.x, palm.y, szL * sp, 0, Math.PI * 2); nCtx.fill();
        }
      }

      /* ── GIAI ĐOẠN 2: Core phình lên (sp > 0.10) ──────────── */
      if (sp > 0.10) {
        const ph2 = clamp((sp - 0.10) / 0.55, 0, 1);

        for (const [pts, palm] of [[ptsL, palmL], [ptsR, palmR]]) {
          // Tia năng lượng từ các ngón chảy vào palm
          for (const ti of [4, 8, 12, 16, 20]) {
            const tip = pts[ti];
            const a   = ph2 * (0.30 + intensity * 0.25);
            nCtx.beginPath(); nCtx.moveTo(tip.x, tip.y); nCtx.lineTo(palm.x, palm.y);
            nCtx.shadowColor = '#66aaff'; nCtx.shadowBlur = 8;
            nCtx.strokeStyle = `rgba(130,200,255,${a})`;
            nCtx.lineWidth   = 1.4 * ph2; nCtx.stroke();
          }
          // Palm core grow (Bỏ vẽ đốm sáng ở palm trong bridge mode)
          // const coreR = dist2(pts[0], pts[9]) * (0.55 + ph2 * 1.0) * pulse;
          // ... (xóa logic vẽ gradient tại đây)
        }

        // Bridge arc mờ (bắt đầu từ ph2 > 0.35)
        if (ph2 > 0.35) {
          const bAlpha = (ph2 - 0.35) / 0.65 * (0.4 + intensity * 0.2);
          drawBridgeArc(tipL, tipR, d, { w: 2.0, alpha: bAlpha, blur: 14, color: '120,200,255' }, 0);
        }

        // Particles từ fingertips
        if (ph2 > 0.4 && Math.random() < 0.38) spawnBridgeParticle(tipL, mid);
        if (ph2 > 0.4 && Math.random() < 0.38) spawnBridgeParticle(tipR, mid);
      }

      /* ── GIAI ĐOẠN 3: Full form (sp > 0.65) ─────────────────── */
      if (sp > 0.65) {
        const ph3 = clamp((sp - 0.65) / 0.35, 0, 1);

        // Electric arcs (to hơn rất nhiều)
        const numBolts = Math.ceil(intensity * 4 + 2);
        const arcPasses = [
          { w: d * 0.022 + 9, alpha: (0.25 + intensity * 0.25) * ph3, blur: 32, color: '55,125,255' },
          { w: 3.5,            alpha: (0.55 + intensity * 0.32) * ph3, blur: 10, color: '155,220,255' },
          { w: 1.2,            alpha: 0.90 * ph3,                      blur: 3,  color: '230,250,255' },
        ];
        for (const pass of arcPasses)
          for (let b = 0; b < numBolts; b++) drawBridgeArc(tipL, tipR, d, pass, b);

        // Glow lớn tại 2 ngón trỏ
        for (const tip of [tipL, tipR]) {
          const r  = (32 + intensity * 60) * ph3;
          const g0 = nCtx.createRadialGradient(tip.x, tip.y, 0, tip.x, tip.y, r);
          g0.addColorStop(0,   `rgba(220,248,255,${0.85 * ph3})`);
          g0.addColorStop(0.5, `rgba(80,165,255,${0.48 * ph3 * pulse})`);
          g0.addColorStop(1,   'rgba(0,0,0,0)');
          nCtx.fillStyle = g0;
          nCtx.beginPath(); nCtx.arc(tip.x, tip.y, r, 0, Math.PI * 2); nCtx.fill();
        }

        // Orb tại midpoint (lớn hơn trước)
        const orbR = clamp((1 / (d + 30)) * 14000 * pulse, 18, 150) * ph3;
        if (orbR > 2) drawBridgeOrb(mid, orbR, intensity * ph3, pulse);

        // Seal rings
        if (ph3 > 0.45 && intensity > 0.08)
          drawSealRing(mid, orbR * 3.0 * ph3, intensity * ph3, pulse);

        // Palm outer glow lớn
        for (const [palm, sz] of [[palmL, szL], [palmR, szR]]) {
          const outerR = sz * 2.2 * ph3 * pulse;
          const go = nCtx.createRadialGradient(palm.x, palm.y, 0, palm.x, palm.y, outerR);
          go.addColorStop(0,   `rgba(140,215,255,${0.38 * ph3})`);
          go.addColorStop(0.5, `rgba(60,135,255,${0.16 * ph3})`);
          go.addColorStop(1,   'rgba(0,0,0,0)');
          nCtx.fillStyle = go;
          nCtx.beginPath(); nCtx.arc(palm.x, palm.y, outerR, 0, Math.PI * 2); nCtx.fill();
        }

        // Resonance particles
        const emitChance = 0.3 + intensity * 0.5 + ph3 * 0.2;
        if (Math.random() < emitChance) spawnBridgeParticle(tipL, mid);
        if (Math.random() < emitChance) spawnBridgeParticle(tipR, mid);
        if (Math.random() < 0.25 * ph3) {
          spawnBridgeParticle(
            { x: tipL.x + (tipR.x - tipL.x) * rand(0.2, 0.8),
              y: tipL.y + (tipR.y - tipL.y) * rand(0.2, 0.8) },
            mid
          );
        }
      }

      nCtx.restore();
    }


    function drawBridgeArc(tipL, tipR, d, pass, boltIdx) {
      const segs = 10 + Math.floor(d / 30);
      const dx   = tipR.x - tipL.x;
      const dy   = tipR.y - tipL.y;
      const len  = Math.hypot(dx, dy) || 1;
      const nx   = -dy / len; const ny = dx / len;
      // Different random seed per bolt
      const seed = boltIdx * 137.5 + T * 0.001;

      nCtx.beginPath();
      nCtx.moveTo(tipL.x, tipL.y);

      for (let i = 1; i < segs; i++) {
        const p    = i / segs;
        // Sinusoidal base displacement + random jitter
        const disp = Math.sin(p * Math.PI) * d * 0.06 * (boltIdx % 2 === 0 ? 1 : -1);
        const jx   = nx * (disp + rand(-d * 0.04, d * 0.04));
        const jy   = ny * (disp + rand(-d * 0.04, d * 0.04));
        nCtx.lineTo(tipL.x + dx * p + jx, tipL.y + dy * p + jy);
      }
      nCtx.lineTo(tipR.x, tipR.y);

      nCtx.shadowColor = `rgba(${pass.color},1)`;
      nCtx.shadowBlur  = pass.blur;
      nCtx.strokeStyle = `rgba(${pass.color},${pass.alpha})`;
      nCtx.lineWidth   = pass.w;
      nCtx.stroke();
    }

    function drawBridgeOrb(mid, r, intensity, pulse) {
      // Concentric glows
      const layers = [
        { r: r * 2.5, c0: 'rgba(120,180,255,0.15)', c1: 'rgba(60,120,255,0)' },
        { r: r * 1.4, c0: `rgba(160,210,255,${0.4 * pulse})`, c1: 'rgba(80,150,255,0)' },
        { r: r,       c0: `rgba(240,250,255,${0.85 * pulse})`, c1: `rgba(100,180,255,${0.2})` },
        { r: r * 0.4, c0: 'rgba(255,255,255,0.98)',            c1: 'rgba(180,230,255,0.6)' },
      ];

      for (const { r: radius, c0, c1 } of layers) {
        const g = nCtx.createRadialGradient(mid.x, mid.y, 0, mid.x, mid.y, radius);
        g.addColorStop(0, c0); g.addColorStop(1, c1);
        nCtx.fillStyle = g;
        nCtx.beginPath(); nCtx.arc(mid.x, mid.y, radius, 0, Math.PI * 2); nCtx.fill();
      }

      // Orbiting bright dot
      const orbAngle = (T * 0.003) % (Math.PI * 2);
      const orbX = mid.x + Math.cos(orbAngle) * r * 0.9;
      const orbY = mid.y + Math.sin(orbAngle) * r * 0.9;
      nCtx.shadowColor = '#aadeff'; nCtx.shadowBlur = 12;
      nCtx.fillStyle = 'rgba(255,255,255,0.95)';
      nCtx.beginPath(); nCtx.arc(orbX, orbY, 4, 0, Math.PI * 2); nCtx.fill();
      nCtx.shadowBlur = 0;
    }

    // Chakra seal ring around orb (Naruto hand seal vibe)
    function drawSealRing(mid, r, intensity, pulse) {
      const segs = 6;
      const rot  = (T * 0.002) % (Math.PI * 2);
      nCtx.shadowColor = '#88ccff'; nCtx.shadowBlur = 10;
      for (let i = 0; i < segs; i++) {
        const a0 = rot + (Math.PI * 2 / segs) * i;
        const a1 = a0 + (Math.PI * 2 / segs) * 0.55;
        nCtx.beginPath(); nCtx.arc(mid.x, mid.y, r, a0, a1);
        nCtx.strokeStyle = `rgba(150,210,255,${0.5 * intensity * pulse})`;
        nCtx.lineWidth   = 2;  nCtx.stroke();
      }
      // Counter ring
      const rot2 = -(T * 0.0015) % (Math.PI * 2);
      for (let i = 0; i < segs - 1; i++) {
        const a0 = rot2 + (Math.PI * 2 / (segs - 1)) * i;
        const a1 = a0  + (Math.PI * 2 / (segs - 1)) * 0.45;
        nCtx.beginPath(); nCtx.arc(mid.x, mid.y, r * 0.7, a0, a1);
        nCtx.strokeStyle = `rgba(200,235,255,${0.4 * intensity * pulse})`;
        nCtx.lineWidth   = 1.5; nCtx.stroke();
      }
    }

    /* ═══════════════════════════════════════════════════════
       PARTICLES
    ═══════════════════════════════════════════════════════ */
    function spawnParticle(pos, side, isLeft) {
      particles[side].push({
        x: pos.x, y: pos.y,
        vx: rand(-1.5, 1.5), vy: rand(-3, -0.5),
        life: 1, size: rand(2, 5), fire: isLeft,
      });
    }

    function spawnBridgeParticle(from, target) {
      const speed = rand(2, 5);
      const angle = Math.atan2(target.y - from.y, target.x - from.x) + rand(-0.3, 0.3);
      particles.Bridge.push({
        x: from.x + rand(-8, 8), y: from.y + rand(-8, 8),
        vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed,
        life: 1, size: rand(2, 4), fire: false,
      });
    }

    function drawParticles(key, isLeft) {
      if (!nCtx) return;
      const pool = particles[key];
      if (!pool) return;
      nCtx.save();
      nCtx.globalCompositeOperation = 'screen';
      const decay = key === 'Bridge' ? 0.025 : 0.018;

      particles[key] = pool.filter(p => {
        p.x  += p.vx; p.y += p.vy;
        p.vy -= key === 'Bridge' ? 0 : 0.035; // rise slowly
        p.vx *= 0.97; // air friction
        p.life -= decay;
        if (p.life <= 0) return false;

        // Quadratic fade — mềm hơn linear
        const a    = p.life * p.life;
        const size = p.size * p.life; // thu dần
        const fire = key === 'Bridge' ? false : p.fire;

        nCtx.beginPath();
        nCtx.arc(p.x, p.y, Math.max(0.5, size), 0, Math.PI * 2);
        nCtx.fillStyle = fire
          ? `rgba(255,210,70,${a * 0.85})`
          : `rgba(160,215,255,${a * 0.85})`;
        nCtx.shadowColor = fire ? '#ff9900' : '#4488ff';
        nCtx.shadowBlur  = 5;
        nCtx.fill();
        return true;
      });

      if (particles[key].length > 120) particles[key].splice(0, particles[key].length - 120);
      nCtx.restore();
    }

    /* ═══════════════════════════════════════════════════════
       PINCH FIRE → Launch shuriken
    ═══════════════════════════════════════════════════════ */
    function doPinchFire(px, py, isLeft, W, H) {
      const angle = (-Math.PI / 2) + (Math.random() - 0.5) * Math.PI * 0.85;
      const power = 500 + Math.random() * 350;
      launchShuriken(px, py, angle, power, isLeft);
      // Burst particles
      for (let i = 0; i < 24; i++) {
        const side = isLeft ? 'Left' : 'Right';
        particles[side].push({
          x: px, y: py, vx: rand(-5, 5), vy: rand(-6, 1),
          life: 1, size: rand(3, 7), fire: isLeft,
        });
      }
    }

    function launchShuriken(sx, sy, angle, power, isLeft) {
      const dx = Math.cos(angle) * power;
      const dy = Math.sin(angle) * power;
      const layer = document.getElementById('naruto-fx-layer');
      if (!layer) return;

      const sz = 68;
      const el = document.createElement('div');
      Object.assign(el.style, {
        position: 'absolute', width: sz + 'px', height: sz + 'px',
        left: sx + 'px', top: sy + 'px', zIndex: '60',
        pointerEvents: 'none', transformOrigin: 'center',
        clipPath: 'polygon(50% 0%,54% 38%,76% 9%,62% 46%,100% 44%,66% 58%,88% 90%,50% 67%,12% 90%,34% 58%,0% 44%,38% 46%,24% 9%,46% 38%)',
        background: isLeft
          ? 'conic-gradient(from 0deg,#fff 0%,#fde68a 20%,#f97316 50%,#fff 55%,#fbbf24 80%,#f97316 100%)'
          : 'conic-gradient(from 0deg,#fff 0%,#bae6fd 20%,#3b82f6 50%,#fff 55%,#93c5fd 80%,#3b82f6 100%)',
        filter: 'drop-shadow(0 0 10px #fff) drop-shadow(0 0 28px ' + (isLeft ? '#f97316' : '#3b82f6') + ') brightness(1.6)',
        willChange: 'left,top,transform,opacity',
      });
      layer.appendChild(el);

      const t0 = performance.now();
      (function frame(now) {
        const p  = Math.min((now - t0) / 700, 1);
        const x  = sx + dx * p; const y  = sy + dy * p;
        const o  = p < 0.65 ? 1 : 1 - (p - 0.65) / 0.35;
        el.style.left      = x + 'px'; el.style.top = y + 'px';
        el.style.transform = `translate(-50%,-50%) rotate(${p * 1260}deg) scale(${0.8 + p * 0.6})`;
        el.style.opacity   = String(o);
        if (p < 1) requestAnimationFrame(frame);
        else { el.remove(); narutoScore++; const s = document.getElementById('naruto-score'); if (s) s.textContent = '\uD83D\uDCA0 ' + narutoScore; spawnImpact(x, y, isLeft); }
      })(t0);
    }

    function spawnImpact(x, y, isLeft) {
      const layer = document.getElementById('naruto-fx-layer');
      if (!layer) return;
      const ring = document.createElement('div');
      Object.assign(ring.style, { position:'absolute', width:'10px', height:'10px', left:x+'px', top:y+'px', borderRadius:'50%', border:'4px solid '+(isLeft?'rgba(249,115,22,0.9)':'rgba(59,130,246,0.9)'), transform:'translate(-50%,-50%)', pointerEvents:'none', zIndex:'65' });
      const boom = document.createElement('div');
      boom.textContent = '\uD83D\uDCA5';
      Object.assign(boom.style, { position:'absolute', fontSize:'64px', left:x+'px', top:y+'px', transform:'translate(-50%,-50%) scale(0.3)', pointerEvents:'none', zIndex:'66' });
      layer.appendChild(ring); layer.appendChild(boom);
      const t0 = performance.now();
      (function frame(now) {
        const p = Math.min((now - t0) / 500, 1), o = 1 - p;
        ring.style.transform = `translate(-50%,-50%) scale(${1 + p * 10})`;
        ring.style.opacity   = String(o);
        boom.style.transform = `translate(-50%,-50%) scale(${0.3 + p * 2.2})`;
        boom.style.opacity   = String(o);
        if (p < 1) requestAnimationFrame(frame);
        else { ring.remove(); boom.remove(); }
      })(t0);
    }

    /* ── KAMEHAMEHA RENDERING ─────────────────────────────── */
    function drawKamehaCharge(sL, sR, W, H, p) {
      const ptsL = sL.landmarks.map(lm => lm2px(lm, W, H));
      const ptsR = sR.landmarks.map(lm => lm2px(lm, W, H));
      const palmL = avgPts(ptsL, [0, 5, 9, 13, 17]);
      const palmR = avgPts(ptsR, [0, 5, 9, 13, 17]);
      const mid   = { x: (palmL.x + palmR.x) * 0.5, y: (palmL.y + palmR.y) * 0.5 };
      const sz    = (dist2(ptsL[0], ptsL[9]) + dist2(ptsR[0], ptsR[9])) * 0.5;

      const r = sz * (0.5 + p * 2.0); // phình to khi charge
      const pulse = 0.8 + 0.2 * Math.sin(T * 0.02);

      nCtx.save();
      nCtx.globalCompositeOperation = 'screen';
      const g = nCtx.createRadialGradient(mid.x, mid.y, 0, mid.x, mid.y, r);
      g.addColorStop(0, `rgba(240, 255, 255, ${0.9 * pulse})`);
      g.addColorStop(0.4, `rgba(100, 180, 255, ${0.7 * pulse})`);
      g.addColorStop(1, 'rgba(0, 0, 0, 0)');
      nCtx.fillStyle = g;
      nCtx.beginPath(); nCtx.arc(mid.x, mid.y, r, 0, Math.PI * 2); nCtx.fill();

      for (let i = 0; i < 3; i++) {
        const ang = T * 0.005 + i * 2.1;
        nCtx.strokeStyle = `rgba(150, 220, 255, ${0.4 * p})`;
        nCtx.lineWidth = 2;
        nCtx.beginPath();
        nCtx.ellipse(mid.x, mid.y, r * 1.2, r * 0.4, ang, 0, Math.PI * 2);
        nCtx.stroke();
      }

      for (let i = 0; i < 8; i++) {
        const ang = (i / 8) * Math.PI * 2 + T * 0.002;
        const dist = r * (1.5 + Math.sin(T * 0.01 + i) * 0.5);
        const x = mid.x + Math.cos(ang) * dist;
        const y = mid.y + Math.sin(ang) * dist;
        nCtx.beginPath(); nCtx.moveTo(x, y); nCtx.lineTo(mid.x, mid.y);
        nCtx.strokeStyle = `rgba(200, 240, 255, ${0.3 * p})`;
        nCtx.stroke();
      }
      if (Math.random() < 0.3 + p * 0.4) spawnKamehaParticle(mid, r);
      nCtx.restore();
    }

    function drawKamehaFirePerspective(origin, p, W, H) {
      nCtx.save();
      nCtx.globalCompositeOperation = 'screen';

      // 1. Phình to nổ (Beam lao về camera)
      const maxR = W * 0.8;
      const r = 50 + maxR * Math.pow(p, 0.6);
      const alpha = 1 - p;

      const g = nCtx.createRadialGradient(origin.x, origin.y, r * 0.1, origin.x, origin.y, r);
      g.addColorStop(0, `rgba(255, 255, 255, ${alpha})`);
      g.addColorStop(0.3, `rgba(100, 180, 255, ${alpha * 0.8})`);
      g.addColorStop(1, 'rgba(0, 50, 200, 0)');

      nCtx.fillStyle = g;
      nCtx.beginPath(); nCtx.arc(origin.x, origin.y, r, 0, Math.PI * 2); nCtx.fill();

      // 2. Shock rings lao về Viewer
      for (let i = 0; i < 3; i++) {
        const ringP = (p * 3 + i) % 3 / 3; // 0->1
        const ringR = ringP * maxR * 1.2;
        const ringAlpha = (1 - ringP) * alpha;
        nCtx.strokeStyle = `rgba(200, 240, 255, ${ringAlpha})`;
        nCtx.lineWidth = 10 * (1 - ringP);
        nCtx.beginPath();
        nCtx.arc(origin.x, origin.y, ringR, 0, Math.PI * 2);
        nCtx.stroke();
      }

      // 3. Central blinding line/X
      nCtx.strokeStyle = `rgba(255, 255, 255, ${alpha})`;
      nCtx.lineWidth = 40 * alpha;
      const xL = 200 * (1 - p);
      nCtx.beginPath();
      nCtx.moveTo(origin.x - xL, origin.y); nCtx.lineTo(origin.x + xL, origin.y);
      nCtx.moveTo(origin.x, origin.y - xL); nCtx.lineTo(origin.x, origin.y + xL);
      nCtx.stroke();

      nCtx.restore();
    }

    function drawKamehaBeam(origin, angle, p, W, H) {
      const len = W * 1.5;
      const alpha = p < 0.8 ? 1 : 1 - (p - 0.8) / 0.2; // Fade out 20% cuối
      const width = 140 * alpha;
      const endX = origin.x + Math.cos(angle) * len;
      const endY = origin.y + Math.sin(angle) * len;

      nCtx.save();
      nCtx.globalCompositeOperation = 'screen';
      
      const g = nCtx.createLinearGradient(origin.x, origin.y, endX, endY);
      g.addColorStop(0, '#fff');
      g.addColorStop(0.2, '#60a5fa');
      g.addColorStop(1, 'rgba(30, 64, 175, 0)');
      
      nCtx.shadowColor = '#3b82f6'; nCtx.shadowBlur = 30;
      nCtx.strokeStyle = g;
      nCtx.lineWidth = width * (1.1 + Math.sin(T * 0.05 + p * 10) * 0.2);
      nCtx.lineCap = 'round';
      nCtx.beginPath(); nCtx.moveTo(origin.x, origin.y); nCtx.lineTo(endX, endY); nCtx.stroke();
      
      nCtx.lineWidth = width * 0.4; nCtx.strokeStyle = '#fff'; nCtx.shadowBlur = 0;
      nCtx.beginPath(); nCtx.moveTo(origin.x, origin.y); nCtx.lineTo(endX, endY); nCtx.stroke();
      
      nCtx.restore();
    }

    function spawnKamehaParticle(center, r) {
      const ang = Math.random() * Math.PI * 2;
      const dist = r * (1 + Math.random() * 0.5);
      particles.Kameha.push({
        x: center.x + Math.cos(ang) * dist, y: center.y + Math.sin(ang) * dist,
        vx: (center.x - (center.x + Math.cos(ang) * dist)) * 0.1,
        vy: (center.y - (center.y + Math.sin(ang) * dist)) * 0.1,
        life: 1.0, size: 2 + Math.random() * 3, fire: false
      });
    }

    /* ── FACE DETECTION & SSJ HAIR ────────────────────────── */
    async function detectFace(video) {
      if (!window.faceapi || !window.faceapi.nets.tinyFaceDetector.params) return;
      
      const result = await faceapi.detectSingleFace(video, new faceapi.TinyFaceDetectorOptions({ 
        inputSize: 160, 
        scoreThreshold: 0.2 // Cực nhạy để bắt mặt trong tối
      }));

      if (result) {
        const box = result.box;
        facePos = {
          x: box.x + box.width / 2, y: box.y + box.height / 2,
          w: box.width, h: box.height,
          vW: video.videoWidth || video.width, vH: video.videoHeight || video.height,
          method: 'api'
        };
      } else {
        // Fallback: Nếu 2 tay đang chụm lại hoặc POINTING, đoán vị trí đầu
        const sL = window.handEngine?.handStates?.['Left'];
        const sR = window.handEngine?.handStates?.['Right'];
        if (sL?.landmarks && sR?.landmarks) {
          const pL = avgPts(sL.landmarks.map(lm => lm2px(lm, 640, 480)), [0,5,9,13,17]);
          const pR = avgPts(sR.landmarks.map(lm => lm2px(lm, 640, 480)), [0,5,9,13,17]);
          facePos = {
            x: (pL.x + pR.x) * 0.5,
            y: Math.min(pL.y, pR.y) - 200, // Đầu nằm trên tay
            w: 180, h: 220, vW: 640, vH: 480,
            method: 'hands'
          };
        } else {
           facePos = null;
        }
      }
    }

    function drawSSJHair(face, W, H) {
      if (!hairCanvas) return;

      // Mirror X coordinates for face detector to match mirrored video CSS
      const rx = (1 - face.x / face.vW) * W; 
      const ry = (face.y / face.vH) * H;
      const fw = (face.w / face.vW) * W;
      const fh = (face.h / face.vH) * H;

      const tw = fw * 3.0; 
      const th = tw * (hairCanvas.height / hairCanvas.width);

      // Neo chân tóc: Đặt chân tóc bám sát trán, không phụ thuộc quá nhiều vào th
      const tx = rx;
      const ty = ry - fh * 0.48 - th * 0.15; 

      nCtx.save();
      nCtx.translate(tx, ty);
      nCtx.shadowColor = 'rgba(251, 191, 36, 0.48)'; nCtx.shadowBlur = 30;
      nCtx.drawImage(hairCanvas, -tw/2, -th/2, tw, th);
      
      if (Math.random() < 0.12) {
        nCtx.strokeStyle = '#bae6fd'; nCtx.lineWidth = 1.5;
        const ex = (Math.random() - 0.5) * tw * 0.4; const ey = (Math.random() - 0.5) * th * 0.4;
        nCtx.beginPath(); nCtx.moveTo(ex, ey);
        nCtx.lineTo(ex + (Math.random()-0.5)*30, ey + (Math.random()-0.5)*20);
        nCtx.stroke();
      }
      nCtx.restore();
    }
  })();
});
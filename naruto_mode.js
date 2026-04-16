/**
 * Btoan AI - Naruto Shuriken Mode v2.1
 * FIX: Không mở camera riêng — dùng chung stream của handEngine
 *      để tránh dual-camera conflict khiến MediaPipe không nhận được frame.
 */
document.addEventListener('DOMContentLoaded', function () {
  (function () {
    let narutoActive = false;
    let narutoScore  = 0;
    let lastPinchL   = false, lastPinchR = false;
    let animFrame    = null;

    const btn = document.getElementById('toggleNarutoMode');
    if (!btn) return;

    btn.addEventListener('click', () => narutoActive ? closeNaruto() : openNaruto());

    /* ─────────────────────────────────────────────
       CLOSE
    ───────────────────────────────────────────── */
    window.closeNaruto = function () {
      console.log('[Naruto] closeNaruto()');
      narutoActive = false;

      document.getElementById('naruto-overlay').style.display = 'none';
      btn.classList.remove('naruto-active');

      // Restore hand-overlay nếu handEngine đang chạy
      const handOverlay = document.getElementById('hand-overlay');
      if (handOverlay && window.handEngine?.isActive) {
        handOverlay.style.display = 'block';
      }

      if (animFrame) { cancelAnimationFrame(animFrame); animFrame = null; }

      // KHÔNG stop handEngine camera — user có thể vẫn muốn dùng hand mode
    };

    /* ─────────────────────────────────────────────
       OPEN
    ───────────────────────────────────────────── */
    async function openNaruto() {
      // [DEBUG POINT 1] Naruto mode bật
      console.log('[Naruto] openNaruto() — bắt đầu');
      narutoActive = true;
      narutoScore  = 0;
      lastPinchL   = false;
      lastPinchR   = false;

      const overlay = document.getElementById('naruto-overlay');
      overlay.style.display = 'block';
      document.getElementById('naruto-fx-layer').innerHTML = '';
      document.getElementById('naruto-score').textContent = '\uD83D\uDCA0 0';
      btn.classList.add('naruto-active');

      /* ── Bước 1: Start handEngine nếu chưa chạy ──
         handEngine.start() mở camera trên #hand-video
         và bật MediaPipe Hands detection.
      */
      if (window.handEngine && !window.handEngine.isActive) {
        console.log('[Naruto] Đang start handEngine (showOverlay=false)...');
        await window.handEngine.start(false); // false = không show hand-overlay
        // Đợi thêm 400ms để camera + MediaPipe warm-up
        await new Promise(r => setTimeout(r, 400));
      } else {
        console.log('[Naruto] handEngine đang chạy sẵn:', window.handEngine?.isActive);
        // Ẩn hand-overlay nếu đang hiện
        const handOverlay = document.getElementById('hand-overlay');
        if (handOverlay) handOverlay.style.display = 'none';
      }

      /* ── Bước 2: Chia sẻ stream hand-video → naruto-camera ──
         Thay vì mở camera riêng (gây conflict),
         clone stream từ hand-video để hiển thị nền.
      */
      const handVideo   = document.getElementById('hand-video');
      const narutoCam   = document.getElementById('naruto-camera');

      if (handVideo && narutoCam && handVideo.srcObject) {
        narutoCam.srcObject = handVideo.srcObject;
        narutoCam.play().catch(e => console.warn('[Naruto] narutoCam.play():', e));
        console.log('[Naruto] Đã share stream tới naruto-camera');
      } else {
        console.warn('[Naruto] Không share được stream —',
          { handVideo: !!handVideo, srcObject: !!handVideo?.srcObject });
      }

      /* ── Bước 3: Ẩn hand-overlay (tracking vẫn chạy, chỉ ẩn UI) ── */
      const handOverlay = document.getElementById('hand-overlay');
      if (handOverlay) handOverlay.style.display = 'none';

      /* ── Bước 4: Bắt đầu vòng lặp Naruto ── */
      console.log('[Naruto] narutoLoop() bắt đầu');
      narutoLoop();
    }

    /* ─────────────────────────────────────────────
       MAIN LOOP
    ───────────────────────────────────────────── */
    let _dbgFrameCount = 0;

    function narutoLoop() {
      if (!narutoActive) return;

      ['Left', 'Right'].forEach(side => {
        const s = window.handEngine?.handStates?.[side];
        if (!s) return;

        // [DEBUG POINT 2] In mỗi 60 frame (~1 giây) để không spam
        _dbgFrameCount++;
        if (_dbgFrameCount % 60 === 0) {
          console.log(`[Naruto] handState[${side}] x=${s.x.toFixed(0)} y=${s.y.toFixed(0)} isPinching=${s.isPinching}`);
        }

        const isPinch = s.isPinching;
        const wasLast = (side === 'Left') ? lastPinchL : lastPinchR;

        // [DEBUG POINT 3] Gesture: pinch start
        if (isPinch && !wasLast) {
          console.log(`[Naruto] PINCH START — ${side} tại (${s.x.toFixed(0)}, ${s.y.toFixed(0)})`);
          const angle = (-Math.PI / 2) + (Math.random() - 0.5) * Math.PI * 0.85;
          const power = 480 + Math.random() * 320;
          launchShuriken(s.x, s.y, Math.cos(angle) * power, Math.sin(angle) * power);
        }

        if (side === 'Left') lastPinchL = isPinch;
        else                 lastPinchR = isPinch;
      });

      animFrame = requestAnimationFrame(narutoLoop);
    }

    /* ─────────────────────────────────────────────
       EFFECTS
    ───────────────────────────────────────────── */
    function launchShuriken(sx, sy, dx, dy) {
      // [DEBUG POINT 4] Skill / effect được kích hoạt
      console.log(`[Naruto] launchShuriken từ (${sx.toFixed(0)}, ${sy.toFixed(0)})`);

      const layer = document.getElementById('naruto-fx-layer');
      if (!layer) { console.error('[Naruto] naruto-fx-layer không tồn tại!'); return; }

      const el = document.createElement('div');
      el.textContent = '\uD83C\uDF00'; // 🌀
      el.style.cssText = [
        'position:absolute',
        'pointer-events:none',
        'z-index:10',
        'font-size:42px',
        'line-height:1',
        `left:${sx}px`,
        `top:${sy}px`,
        'transform-origin:center',
        'will-change:transform,opacity',
      ].join(';');
      layer.appendChild(el);

      // [DEBUG POINT 5] Effect có thực sự vào DOM không
      console.log('[Naruto] shuriken appended to layer, layer children:', layer.children.length);

      const dur = 750;
      const t0  = performance.now();

      (function frame(now) {
        const p = Math.min((now - t0) / dur, 1);
        const x = sx + dx * p;
        const y = sy + dy * p;
        const r = p * 900;
        const sc = 1 - p * 0.65;
        const o  = p < 0.75 ? 1 : 1 - (p - 0.75) / 0.25;

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

    function spawnBoom(x, y) {
      const layer = document.getElementById('naruto-fx-layer');
      if (!layer) return;

      const boom = document.createElement('div');
      boom.textContent = '\uD83D\uDCA5'; // 💥
      boom.style.cssText = [
        'position:absolute',
        'pointer-events:none',
        'font-size:64px',
        'line-height:1',
        `left:${x}px`,
        `top:${y}px`,
        'z-index:11',
        'transform:translate(-50%,-50%) scale(0.5)',
        'will-change:transform,opacity',
      ].join(';');
      layer.appendChild(boom);

      const t0 = performance.now();
      (function frame(now) {
        const p  = Math.min((now - t0) / 450, 1);
        const sc = 0.5 + p * 2;
        const o  = 1 - p;
        boom.style.transform = `translate(-50%,-50%) scale(${sc})`;
        boom.style.opacity   = String(o);
        if (p < 1) requestAnimationFrame(frame);
        else boom.remove();
      })(t0);
    }
  })();
});

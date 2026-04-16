/**
 * Btoan AI — Naruto Shuriken Mode v3.0
 *
 * Tầng 1: Cursor aura bám theo tay mỗi frame (kể cả khi chưa pinch)
 * Tầng 2: Shuriken + boom khi pinch
 *
 * Fix dual-camera: dùng lại stream của handEngine, không mở camera riêng.
 */
document.addEventListener('DOMContentLoaded', function () {
  (function () {
    let narutoActive = false;
    let narutoScore  = 0;
    let lastPinchL   = false, lastPinchR = false;
    let animFrame    = null;

    // Cursor elements tồn tại suốt session — update mỗi frame
    const cursors = { Left: null, Right: null };

    const btn = document.getElementById('toggleNarutoMode');
    if (!btn) return;

    btn.addEventListener('click', () => narutoActive ? closeNaruto() : openNaruto());

    /* ──────────────────────────────────────────────
       TẠO CURSOR (1 lần per session)
    ────────────────────────────────────────────── */
    function createCursor(side) {
      const el = document.createElement('div');
      el.id = 'naruto-cursor-' + side.toLowerCase();
      Object.assign(el.style, {
        position:        'absolute',
        width:           '64px',
        height:          '64px',
        borderRadius:    '50%',
        border:          '3px solid rgba(249,115,22,0.9)',
        background:      'rgba(249,115,22,0.15)',
        boxShadow:       '0 0 24px rgba(249,115,22,0.7), inset 0 0 12px rgba(249,115,22,0.2)',
        transform:       'translate(-50%,-50%)',
        pointerEvents:   'none',
        zIndex:          '200',
        display:         'none',
        transition:      'width .08s, height .08s, box-shadow .08s, background .08s',
        willChange:      'left, top',
      });

      // Chấm trung tâm
      const dot = document.createElement('div');
      Object.assign(dot.style, {
        position:     'absolute',
        width:        '10px',
        height:       '10px',
        borderRadius: '50%',
        background:   '#f97316',
        boxShadow:    '0 0 10px #f97316, 0 0 20px #f97316',
        top:          '50%',
        left:         '50%',
        transform:    'translate(-50%,-50%)',
      });
      el.appendChild(dot);

      // Label tay L / R
      const label = document.createElement('div');
      Object.assign(label.style, {
        position:   'absolute',
        bottom:     '-20px',
        left:       '50%',
        transform:  'translateX(-50%)',
        fontSize:   '10px',
        fontWeight: '700',
        color:      '#f97316',
        fontFamily: 'monospace',
        whiteSpace:  'nowrap',
      });
      label.textContent = side === 'Left' ? 'L' : 'R';
      el.appendChild(label);

      document.getElementById('naruto-fx-layer').appendChild(el);
      return el;
    }

    /* ──────────────────────────────────────────────
       CLOSE
    ────────────────────────────────────────────── */
    window.closeNaruto = function () {
      narutoActive = false;
      document.getElementById('naruto-overlay').style.display = 'none';
      btn.classList.remove('naruto-active');

      Object.values(cursors).forEach(c => { if (c) c.style.display = 'none'; });
      if (animFrame) { cancelAnimationFrame(animFrame); animFrame = null; }

      // Restore hand-overlay nếu handEngine còn chạy
      const ho = document.getElementById('hand-overlay');
      if (ho && window.handEngine?.isActive) ho.style.display = 'block';
    };

    /* ──────────────────────────────────────────────
       OPEN
    ────────────────────────────────────────────── */
    async function openNaruto() {
      narutoActive = true;
      narutoScore  = 0;
      lastPinchL   = false;
      lastPinchR   = false;

      // Reset UI
      document.getElementById('naruto-overlay').style.display = 'block';
      document.getElementById('naruto-fx-layer').innerHTML = '';
      document.getElementById('naruto-score').textContent = '\uD83D\uDCA0 0';
      btn.classList.add('naruto-active');

      // Tạo cursor cho 2 tay (sau khi innerHTML reset)
      cursors.Left  = createCursor('Left');
      cursors.Right = createCursor('Right');

      // Start handEngine nếu chưa chạy
      if (window.handEngine && !window.handEngine.isActive) {
        await window.handEngine.start(false); // false = không hiện hand-overlay
        await new Promise(r => setTimeout(r, 400)); // warm-up
      } else {
        // Đã chạy → chỉ ẩn hand-overlay đi
        const ho = document.getElementById('hand-overlay');
        if (ho) ho.style.display = 'none';
      }

      // Chia sẻ stream hand-video → naruto-camera (tránh dual-camera conflict)
      const handVideo = document.getElementById('hand-video');
      const narutoCam = document.getElementById('naruto-camera');
      if (handVideo?.srcObject && narutoCam) {
        narutoCam.srcObject = handVideo.srcObject;
        narutoCam.play().catch(() => {});
      }

      // Đảm bảo hand-overlay ẩn
      const ho = document.getElementById('hand-overlay');
      if (ho) ho.style.display = 'none';

      // Bắt đầu render loop
      narutoLoop();
    }

    /* ──────────────────────────────────────────────
       MAIN LOOP — chạy mỗi frame
    ────────────────────────────────────────────── */
    function narutoLoop() {
      if (!narutoActive) return;

      ['Left', 'Right'].forEach(side => {
        const s      = window.handEngine?.handStates?.[side];
        const cursor = cursors[side];
        if (!cursor) return;

        // Dùng history.length > 0 để biết tay có đang được track không
        // (syncUI trong hand_engine.js reset history[] khi mất tay)
        const isTracked = s && s.history && s.history.length > 0;

        if (!isTracked) {
          cursor.style.display = 'none';
          return;
        }

        /* ── Tầng 1: Cursor bám tay mỗi frame ── */
        cursor.style.display = 'block';
        cursor.style.left    = s.x + 'px';
        cursor.style.top     = s.y + 'px';

        const isPinch = s.isPinching;

        if (isPinch) {
          // Chụm ngón: cursor thu nhỏ + sáng hơn
          Object.assign(cursor.style, {
            width:     '32px',
            height:    '32px',
            background: 'rgba(249,115,22,0.55)',
            boxShadow:  '0 0 40px rgba(249,115,22,1), 0 0 80px rgba(249,115,22,0.4)',
          });
        } else {
          // Tay mở: cursor to + mờ
          Object.assign(cursor.style, {
            width:     '64px',
            height:    '64px',
            background: 'rgba(249,115,22,0.15)',
            boxShadow:  '0 0 24px rgba(249,115,22,0.7)',
          });
        }

        /* ── Tầng 2: Shuriken khi PINCH START ── */
        const wasLast = (side === 'Left') ? lastPinchL : lastPinchR;

        if (isPinch && !wasLast) {
          const angle = (-Math.PI / 2) + (Math.random() - 0.5) * Math.PI * 0.85;
          const power = 480 + Math.random() * 320;
          launchShuriken(s.x, s.y, Math.cos(angle) * power, Math.sin(angle) * power);
        }

        if (side === 'Left') lastPinchL = isPinch;
        else                 lastPinchR = isPinch;
      });

      animFrame = requestAnimationFrame(narutoLoop);
    }

    /* ──────────────────────────────────────────────
       EFFECTS
    ────────────────────────────────────────────── */
    function launchShuriken(sx, sy, dx, dy) {
      const layer = document.getElementById('naruto-fx-layer');
      if (!layer) return;

      const el = document.createElement('div');
      el.textContent = '\uD83C\uDF00'; // 🌀
      Object.assign(el.style, {
        position:        'absolute',
        pointerEvents:   'none',
        zIndex:          '10',
        fontSize:        '42px',
        lineHeight:      '1',
        left:            sx + 'px',
        top:             sy + 'px',
        transformOrigin: 'center',
        willChange:      'transform, opacity',
      });
      layer.appendChild(el);

      const dur = 750;
      const t0  = performance.now();

      (function frame(now) {
        const p  = Math.min((now - t0) / dur, 1);
        const x  = sx + dx * p;
        const y  = sy + dy * p;
        const r  = p * 900;
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

      const el = document.createElement('div');
      el.textContent = '\uD83D\uDCA5'; // 💥
      Object.assign(el.style, {
        position:      'absolute',
        pointerEvents: 'none',
        fontSize:      '64px',
        lineHeight:    '1',
        left:          x + 'px',
        top:           y + 'px',
        zIndex:        '11',
        transform:     'translate(-50%,-50%) scale(0.5)',
        willChange:    'transform, opacity',
      });
      layer.appendChild(el);

      const t0 = performance.now();
      (function frame(now) {
        const p  = Math.min((now - t0) / 450, 1);
        const sc = 0.5 + p * 2;
        const o  = 1 - p;
        el.style.transform = `translate(-50%,-50%) scale(${sc})`;
        el.style.opacity   = String(o);
        if (p < 1) requestAnimationFrame(frame);
        else el.remove();
      })(t0);
    }

  })();
});

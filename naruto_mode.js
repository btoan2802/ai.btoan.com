/**
 * Btoan AI - Naruto Shuriken Mode
 * Tách ra file riêng để tránh PHP output truncation
 */
document.addEventListener('DOMContentLoaded', function() {
  (function() {
    let narutoActive = false;
    let narutoScore  = 0;
    let narutoStream = null;
    let lastPinchL   = false, lastPinchR = false;
    let animFrame    = null;

    const btn = document.getElementById('toggleNarutoMode');
    if (!btn) return;

    btn.addEventListener('click', () => narutoActive ? closeNaruto() : openNaruto());

    window.closeNaruto = function() {
      narutoActive = false;
      document.getElementById('naruto-overlay').style.display = 'none';
      btn.classList.remove('naruto-active');
      if (narutoStream) { narutoStream.getTracks().forEach(t => t.stop()); narutoStream = null; }
      if (animFrame)    { cancelAnimationFrame(animFrame); animFrame = null; }
    };

    async function openNaruto() {
      narutoActive = true;
      narutoScore  = 0;
      lastPinchL = false; lastPinchR = false;
      document.getElementById('naruto-score').textContent = '\uD83D\uDCA0 0';
      document.getElementById('naruto-overlay').style.display = 'block';
      document.getElementById('naruto-fx-layer').innerHTML = '';
      btn.classList.add('naruto-active');

      // Camera background (visual only)
      try {
        narutoStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode:'user', width:1280, height:720 } });
        const vid = document.getElementById('naruto-camera');
        vid.srcObject = narutoStream;
        vid.play();
      } catch(e) { console.warn('Naruto cam:', e); }

      // Dam bao handEngine dang chay
      if (window.handEngine && !window.handEngine.isActive) {
        window.handEngine.start();
      }

      // Poll handEngine.handStates
      function narutoLoop() {
        if (!narutoActive) return;
        ['Left', 'Right'].forEach(side => {
          const s = window.handEngine?.handStates?.[side];
          if (!s) return;
          const isPinch = s.isPinching;
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
      narutoLoop();
    }

    function launchShuriken(sx, sy, dx, dy) {
      const layer = document.getElementById('naruto-fx-layer');
      const el    = document.createElement('div');
      el.textContent = '\uD83C\uDF00';
      el.style.cssText = `
        position:absolute; pointer-events:none; z-index:10;
        font-size:42px; line-height:1;
        left:${sx}px; top:${sy}px;
        transform-origin:center;
        will-change:transform,opacity;
      `;
      layer.appendChild(el);
      const dur   = 750;
      const t0    = performance.now();
      (function frame(now) {
        const p = Math.min((now - t0) / dur, 1);
        const x = sx + dx * p;
        const y = sy + dy * p;
        const r = p * 900;
        const s = 1 - p * 0.65;
        const o = p < 0.75 ? 1 : 1 - (p - 0.75) / 0.25;
        el.style.left    = x + 'px';
        el.style.top     = y + 'px';
        el.style.transform = `translate(-50%,-50%) rotate(${r}deg) scale(${s})`;
        el.style.opacity   = o;
        if (p < 1) {
          requestAnimationFrame(frame);
        } else {
          el.remove();
          narutoScore++;
          document.getElementById('naruto-score').textContent = '\uD83D\uDCA0 ' + narutoScore;
          spawnBoom(x, y);
        }
      })(t0);
    }

    function spawnBoom(x, y) {
      const layer = document.getElementById('naruto-fx-layer');
      const boom  = document.createElement('div');
      boom.textContent = '\uD83D\uDCA5';
      boom.style.cssText = `
        position:absolute; pointer-events:none; font-size:64px; line-height:1;
        left:${x}px; top:${y}px; z-index:11;
        transform:translate(-50%,-50%) scale(0.5);
        will-change:transform,opacity;
      `;
      layer.appendChild(boom);
      const t0 = performance.now();
      (function frame(now) {
        const p = Math.min((now - t0) / 450, 1);
        const s = 0.5 + p * 2;
        const o = 1 - p;
        boom.style.transform = `translate(-50%,-50%) scale(${s})`;
        boom.style.opacity   = o;
        if (p < 1) requestAnimationFrame(frame);
        else boom.remove();
      })(t0);
    }
  })();
});

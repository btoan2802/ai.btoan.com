/**
 * Btoan AI - Hand Engine v10.0 (STABLE TRACKING)
 * Ultra-smooth cursor, reliable click, 3D object manipulation.
 */

class HandEngine {
    constructor() {
        this.video = document.getElementById('hand-video');
        this.canvas = document.getElementById('hand-canvas');
        this.ctx = this.canvas.getContext('2d');
        this.overlay = document.getElementById('hand-overlay');
        
        this.isActive = false;

        // --- HAND STATE (per hand) ---
        this.handStates = {
            'Left':  this._newHandState(),
            'Right': this._newHandState()
        };

        // --- TRACKING CONFIG ---
        this.smoothFactor = 0.35;       // Tăng để chuột theo tay nhanh hơn (bỏ cảm giác bị trễ/lag)
        this.deadZone = 2;              // Giảm một chút để nhạy hơn
        this.historySize = 3;           // Chỉ lấy trung bình 3 frame để giảm độ trễ (latency)
        this.pinchEnter = 0.35;         // Threshold to START pinch (normalized by hand size)
        this.pinchExit  = 0.50;         // Threshold to END pinch (hysteresis)
        this.tapWindow  = 300;          // ms: pinch shorter than this = click

        // --- DUAL HAND STATE ---
        this.spatialState = {
            isDualOnSame: false,
            initialDist: 0,
            initialAngle: 0,
            initialRotX: 0,
            initialRotY: 0,
            initialRotZ: 0
        };

        this.init();
    }

    _newHandState() {
        return {
            x: 0, y: 0,
            smoothX: 0, smoothY: 0,
            prevX: 0, prevY: 0,
            isPinching: false,
            prevPinching: false,
            lockTarget: null,
            pinchStartTime: 0,
            pinchEmpty: false,
            history: []    // [{x,y}, ...] for averaging
        };
    }

    async init() {
        this.hands = new Hands({
            locateFile: (f) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands@0.4/${f}`
        });
        this.hands.setOptions({
            maxNumHands: 2,
            modelComplexity: 0, // Đổi từ 1 xuống 0 (Lite Model): Giảm tải CPU, tăng gấp đôi FPS, vô cùng mượt mà
            minDetectionConfidence: 0.6,
            minTrackingConfidence: 0.6
        });
        this.hands.onResults(this.onResults.bind(this));

        const toggle = document.getElementById('toggleHandMode');
        if (toggle) toggle.onclick = () => this.toggle();
        this.loop();
    }

    toggle() { this.isActive ? this.stop() : this.start(); }

    async start(showOverlay = true) {
        // showOverlay=false khi được gọi từ Naruto Mode (tự quản lý overlay)
        if (showOverlay) this.overlay.style.display = 'block';
        try {
            if (!this.camera) {
                this.camera = new Camera(this.video, {
                    onFrame: async () => {
                        if (this.isActive) await this.hands.send({ image: this.video });
                    },
                    width: 640, height: 480
                });
            }
            await this.camera.start();
            this.isActive = true;
            console.log('[HandEngine] Camera started, isActive=true');
        } catch (e) { console.error('[HandEngine] start() error:', e); }
    }

    stop() {
        if (this.camera) this.camera.stop();
        this.isActive = false;
        this.overlay.style.display = 'none';
        ['Left', 'Right'].forEach(side => this.releaseObject(side));
    }

    // ========== CORE TRACKING PIPELINE ==========

    /**
     * Step 1: Raw point from MediaPipe
     * Step 2: Multi-frame history average (removes spikes)
     * Step 3: Dead zone filter (ignores micro-jitter)
     * Step 4: Exponential smoothing (makes motion fluid)
     */
    stabilizePosition(s, rawX, rawY) {
        // Step 2: History average
        s.history.push({ x: rawX, y: rawY });
        if (s.history.length > this.historySize) s.history.shift();

        let avgX = 0, avgY = 0;
        for (const p of s.history) { avgX += p.x; avgY += p.y; }
        avgX /= s.history.length;
        avgY /= s.history.length;

        // Step 3: Dead zone
        const dx = avgX - s.smoothX;
        const dy = avgY - s.smoothY;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist < this.deadZone) {
            // Too small — don't move at all
            return;
        }

        // Step 4: Exponential smoothing
        s.smoothX += dx * this.smoothFactor;
        s.smoothY += dy * this.smoothFactor;

        s.x = s.smoothX;
        s.y = s.smoothY;
    }

    /**
     * Pinch detection — normalize theo hand size để ổn định với mọi khoảng cách camera.
     *
     * rawDist = khoảng cách thumb tip (4) ↔ index tip (8) trong MediaPipe 0-1 space
     * handSize = wrist (0) ↔ middle_mcp (9), đại diện kích thước bàn tay
     * normDist = rawDist / handSize  ⇒  so sánh với pinchEnter/pinchExit
     *
     * Khi chụm ngón: normDist ≈ 0.1 – 0.3
     * Khi mở tay:   normDist ≈ 0.6 – 1.2
     */
    detectPinch(s, thumb, index, landmarks) {
        // Raw distance trong normalized 0-1 space
        const rawDist = Math.sqrt(
            Math.pow(thumb.x - index.x, 2) +
            Math.pow(thumb.y - index.y, 2)
        );

        // Hand size: wrist (0) → middle MCP (9)
        const wrist   = landmarks[0];
        const midMcp  = landmarks[9];
        const handSize = Math.sqrt(
            Math.pow(wrist.x - midMcp.x, 2) +
            Math.pow(wrist.y - midMcp.y, 2)
        ) || 0.001;

        const normDist = rawDist / handSize;

        s.prevPinching = s.isPinching;

        if (s.isPinching) {
            s.isPinching = normDist < this.pinchExit;
        } else {
            s.isPinching = normDist < this.pinchEnter;
        }

        // Debug dày mỗi 300ms — in đủ 7 giá trị để trace
        const now = Date.now();
        if (!s._dbgTs || now - s._dbgTs > 300) {
            s._dbgTs = now;
            console.log(
                `[Pinch] thumb(${thumb.x.toFixed(3)},${thumb.y.toFixed(3)}) ` +
                `index(${index.x.toFixed(3)},${index.y.toFixed(3)}) ` +
                `raw=${rawDist.toFixed(4)} handSz=${handSize.toFixed(4)} ` +
                `norm=${normDist.toFixed(3)} ` +
                `enter=${this.pinchEnter} exit=${this.pinchExit} ` +
                `isPinching=${s.isPinching}`
            );
        }
    }

    // ========== RESULTS HANDLER ==========

    onResults(results) {
        this.ctx.save();
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        const detectedSet = new Set();

        if (results.multiHandLandmarks) {
            results.multiHandLandmarks.forEach((landmarks, i) => {
                const label = results.multiHandedness[i].label;
                detectedSet.add(label);

                // Draw skeleton (subtle)
                window.drawConnectors(this.ctx, landmarks, window.HAND_CONNECTIONS,
                    { color: 'rgba(255,255,255,0.08)', lineWidth: 1 });
                window.drawLandmarks(this.ctx, landmarks,
                    { color: '#00ffcc', lineWidth: 1, radius: 1 });

                this.processHand(label, landmarks);
            });
        }

        this.evaluateMultiHandState();
        this.syncUI(detectedSet);
        this.ctx.restore();
    }

    // ========== PER-HAND PROCESSING ==========

    processHand(side, landmarks) {
        const s = this.handStates[side];
        const thumb = landmarks[4];
        const index = landmarks[8];

        // Raw position (mirror X for natural feel)
        const rawX = (1 - index.x) * window.innerWidth;
        const rawY = index.y * window.innerHeight;

        // Stabilize
        this.stabilizePosition(s, rawX, rawY);

        // Pinch with hysteresis + hand-size normalization
        this.detectPinch(s, thumb, index, landmarks);

        const now = Date.now();

        // === PINCH START ===
        if (s.isPinching && !s.prevPinching) {
            s.pinchStartTime = now;
            const target = window.shapeManager.getShapeAt(s.x, s.y);
            if (target) {
                target.state = 'grabbed_single';
                s.lockTarget = target;
                s.pinchEmpty = false;
                if (!target.grabbedBy.includes(side.toLowerCase())) {
                    target.grabbedBy.push(side.toLowerCase());
                }
            } else {
                s.pinchEmpty = true;
            }
        }

        // === PINCH END ===
        if (!s.isPinching && s.prevPinching) {
            if (s.lockTarget) {
                this.releaseObject(side);
            } else if (s.pinchEmpty && (now - s.pinchStartTime < this.tapWindow)) {
                this.virtualClick(s.x, s.y);
            }
            s.pinchEmpty = false;
        }

        // === MOVE GRABBED OBJECT ===
        if (s.isPinching && s.lockTarget && s.lockTarget.state === 'grabbed_single') {
            s.lockTarget.x = s.x;
            s.lockTarget.y = s.y;
            s.lockTarget.vx = (s.x - s.prevX) * 0.3;
            s.lockTarget.vy = (s.y - s.prevY) * 0.3;
        }

        // === DUAL ROTATION ===
        if (this.spatialState.isDualOnSame) {
            this.handleDualSpatial();
        }

        // === HOVER ===
        if (!s.isPinching) {
            const h = window.shapeManager.getShapeAt(s.x, s.y);
            window.shapeManager.shapes.forEach(sh => sh.setHover(sh === h));
        }

        s.prevX = s.x;
        s.prevY = s.y;
    }

    // ========== MULTI-HAND ==========

    evaluateMultiHandState() {
        const hL = this.handStates['Left'];
        const hR = this.handStates['Right'];

        if (hL.lockTarget && hR.lockTarget && hL.lockTarget === hR.lockTarget) {
            const t = hL.lockTarget;
            if (!this.spatialState.isDualOnSame) {
                this.spatialState.isDualOnSame = true;
                this.spatialState.initialDist = Math.sqrt(
                    Math.pow(hL.x - hR.x, 2) + Math.pow(hL.y - hR.y, 2)
                ) || 1;
                this.spatialState.initialAngle = Math.atan2(hR.y - hL.y, hR.x - hL.x);
                this.spatialState.initialRotX = t.rotationX || 0;
                this.spatialState.initialRotY = t.rotationY || 0;
                this.spatialState.initialRotZ = t.rotationZ || 0;
            }
            t.state = 'grabbed_dual';
        } else {
            if (this.spatialState.isDualOnSame) {
                this.spatialState.isDualOnSame = false;
                if (hL.lockTarget) hL.lockTarget.state = 'grabbed_single';
                if (hR.lockTarget) hR.lockTarget.state = 'grabbed_single';
            }
        }
    }

    handleDualSpatial() {
        const hL = this.handStates['Left'];
        const hR = this.handStates['Right'];
        const t = hL.lockTarget;

        if (!t || t !== hR.lockTarget) {
            this.spatialState.isDualOnSame = false;
            return;
        }

        const ss = this.spatialState;
        const dx = hR.x - hL.x;
        const dy = hR.y - hL.y;
        const angle = Math.atan2(dy, dx);

        // Z-Rotation
        t.rotationZ = ss.initialRotZ + (angle - ss.initialAngle) * (180 / Math.PI);

        // XY Rotation (from both hands combined movement)
        const diffX = (hL.x - hL.prevX) + (hR.x - hR.prevX);
        const diffY = (hL.y - hL.prevY) + (hR.y - hR.prevY);
        t.rotationY += diffX * 0.2;
        t.rotationX -= diffY * 0.2;

        // Center object between hands
        t.x = (hL.x + hR.x) / 2;
        t.y = (hL.y + hR.y) / 2;
    }

    // ========== UI ==========

    syncUI(detected) {
        const badge = document.getElementById('hand-mode-label');
        if (badge) badge.innerText = `3D_SPATIAL [${detected.size}H]`;

        ['Left', 'Right'].forEach(side => {
            const cursor = document.getElementById(`cursor-${side.toLowerCase()}`);
            if (!cursor) return;

            if (detected.has(side)) {
                const s = this.handStates[side];
                cursor.style.display = 'block';
                cursor.style.left = `${s.x}px`;
                cursor.style.top = `${s.y}px`;
                cursor.style.transform = `translate(-50%, -50%) scale(${s.isPinching ? 0.6 : 1})`;
                cursor.style.opacity = s.isPinching ? '1' : '0.7';
            } else {
                cursor.style.display = 'none';
                this.releaseObject(side);
                this.handStates[side].isPinching = false;
                this.handStates[side].history = [];
            }
        });
    }

    // ========== ACTIONS ==========

    releaseObject(side) {
        const s = this.handStates[side];
        if (s && s.lockTarget) {
            const target = s.lockTarget;
            if (target.grabbedBy) {
                const idx = target.grabbedBy.indexOf(side.toLowerCase());
                if (idx > -1) target.grabbedBy.splice(idx, 1);
                target.state = target.grabbedBy.length > 0 ? 'grabbed_single' : 'idle';
            }
            s.lockTarget = null;
        }
    }

    async virtualClick(x, y) {
        // Hide overlay so elementFromPoint can find the real element
        this.overlay.style.display = 'none';
        await new Promise(r => requestAnimationFrame(r));

        const el = document.elementFromPoint(x, y);
        if (el) {
            const props = { bubbles: true, cancelable: true, view: window, clientX: x, clientY: y };
            el.dispatchEvent(new MouseEvent('mousedown', props));
            el.dispatchEvent(new MouseEvent('mouseup', props));
            el.click();
            this.createRipple(x, y);
        }

        this.overlay.style.display = 'block';
    }

    createRipple(x, y) {
        const r = document.createElement('div');
        r.style.cssText = `
            position: fixed; left: ${x}px; top: ${y}px;
            width: 20px; height: 20px;
            background: rgba(0, 255, 204, 0.5);
            border: 2px solid rgba(0, 255, 204, 0.8);
            border-radius: 50%;
            transform: translate(-50%, -50%) scale(0);
            animation: hand-ripple 0.5s ease-out forwards;
            pointer-events: none; z-index: 999999;
        `;
        document.body.appendChild(r);
        setTimeout(() => r.remove(), 500);
    }

    loop() { requestAnimationFrame(() => this.loop()); }
}

// Inject ripple animation CSS
if (!document.getElementById('hand-ripple-css')) {
    const s = document.createElement('style');
    s.id = 'hand-ripple-css';
    s.textContent = `
        @keyframes hand-ripple {
            0%   { transform: translate(-50%, -50%) scale(0); opacity: 1; }
            100% { transform: translate(-50%, -50%) scale(3); opacity: 0; }
        }
    `;
    document.head.appendChild(s);
}

window.handEngine = new HandEngine();

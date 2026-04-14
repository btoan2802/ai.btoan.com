/**
 * Btoan AI - Professional Hand Engine v8.0 (SHAPE SNAPPING & STRETCH)
 * Integrated with Physics, Recognition, and Absolute Click.
 */

class HandEngine {
    constructor() {
        this.video = document.getElementById('hand-video');
        this.canvas = document.getElementById('hand-canvas');
        this.ctx = this.canvas.getContext('2d');
        this.overlay = document.getElementById('hand-overlay');
        
        this.isActive = false;
        this.mode = 'NO_HAND';
        
        this.handStates = {
            'Left': { x: 0, y: 0, isPinching: false, prevPinching: false, pinchStartTime: 0, lockTarget: null, prevX: 0, prevY: 0 },
            'Right': { x: 0, y: 0, isPinching: false, prevPinching: false, pinchStartTime: 0, lockTarget: null, prevX: 0, prevY: 0 }
        };
        
        // --- PRECISION CONFIG ---
        this.smooth = 0.5;
        this.pinchThresh = 0.052;
        this.tapWindow = 220; 
        
        this.init();
    }

    async init() {
        this.hands = new Hands({ locateFile: (f) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands@0.4/${f}` });
        this.hands.setOptions({ maxNumHands: 2, modelComplexity: 1, minDetectionConfidence: 0.7, minTrackingConfidence: 0.7 });
        this.hands.onResults(this.onResults.bind(this));
        
        const toggle = document.getElementById('toggleHandMode');
        if (toggle) toggle.onclick = () => this.toggle();
        this.loop();
    }

    toggle() { this.isActive ? this.stop() : this.start(); }

    async start() {
        this.overlay.style.display = 'block';
        try {
            if (!this.camera) {
                this.camera = new Camera(this.video, {
                    onFrame: async () => { if (this.isActive) await this.hands.send({ image: this.video }); },
                    width: 1280, height: 720
                });
            }
            await this.camera.start();
            this.isActive = true;
        } catch (e) { console.error(e); }
    }

    stop() {
        if (this.camera) this.camera.stop();
        this.isActive = false;
        this.overlay.style.display = 'none';
        this.mode = 'NO_HAND';
    }

    onResults(results) {
        this.ctx.save();
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        const detectedArr = [];
        const detectedSet = new Set();
        
        if (results.multiHandLandmarks) {
            results.multiHandLandmarks.forEach((landmarks, i) => {
                const label = results.multiHandedness[i].label;
                detectedSet.add(label);
                detectedArr.push({ label, landmarks });
                
                window.drawConnectors(this.ctx, landmarks, window.HAND_CONNECTIONS, { color: 'rgba(255,255,255,0.1)', lineWidth: 1 });
                window.drawLandmarks(this.ctx, landmarks, { color: '#00ffcc', lineWidth: 1, radius: 1 });
                
                this.processHand(label, landmarks);
            });
        }
        
        this.updateGlobalMode(detectedSet);
        this.syncUI(detectedSet);
        this.ctx.restore();
    }

    updateGlobalMode(detected) {
        let newMode = 'NO_HAND';
        if (detected.size === 1) newMode = 'MOUSE_DRAW';
        else if (detected.size === 2) newMode = 'STRETCH';
        
        if (this.mode !== newMode) {
            if (this.mode === 'MOUSE_DRAW') window.handDraw.endStroke();
            this.mode = newMode;
        }
    }

    syncUI(detected) {
        const badge = document.getElementById('hand-mode-label');
        badge.innerText = this.mode;
        ['Left', 'Right'].forEach(side => {
            const cursor = document.getElementById(`cursor-${side.toLowerCase()}`);
            if (detected.has(side)) {
                cursor.style.display = 'block';
                const s = this.handStates[side];
                cursor.style.left = `${s.x}px`;
                cursor.style.top = `${s.y}px`;
                cursor.style.transform = `translate(-50%, -50%) scale(${s.isPinching ? 0.7 : 1})`;
            } else { cursor.style.display = 'none'; }
        });
    }

    processHand(side, landmarks) {
        const s = this.handStates[side];
        const thumb = landmarks[4]; const index = landmarks[8];
        const rawX = (1 - index.x) * window.innerWidth;
        const rawY = index.y * window.innerHeight;
        
        s.x += (rawX - s.x) * this.smooth;
        s.y += (rawY - s.y) * this.smooth;
        
        const d = Math.sqrt(Math.pow(thumb.x - index.x, 2) + Math.pow(thumb.y - index.y, 2));
        s.prevPinching = s.isPinching;
        s.isPinching = d < this.pinchThresh;
        
        const now = Date.now();
        if (s.isPinching && !s.prevPinching) s.pinchStartTime = now;

        if (this.mode === 'MOUSE_DRAW') {
            this.handleMouseDraw(side, s, now);
        } else if (this.mode === 'STRETCH') {
            this.handleStretch();
        }
        
        s.prevX = s.x; s.prevY = s.y;
    }

    handleMouseDraw(side, s, now) {
        if (s.isPinching) {
            if (!s.lockTarget) {
                const shape = window.shapeManager.getShapeAt(s.x, s.y);
                if (shape) {
                    s.lockTarget = shape;
                    shape.state = 'dragging';
                } else {
                    // Start Stroke
                    if (!s.prevPinching) window.handDraw.startStroke(s.x, s.y);
                    window.handDraw.addPoint(s.x, s.y);
                }
            } else {
                // Move Shape
                s.lockTarget.x = s.x;
                s.lockTarget.y = s.y;
            }
        } else {
            if (s.prevPinching) {
                if (s.lockTarget) { s.lockTarget.state = 'idle'; s.lockTarget = null; }
                else {
                    const dur = now - s.pinchStartTime;
                    if (dur < this.tapWindow) {
                        window.handDraw.strokes.pop(); // Remove click-dot
                        this.virtualClick(s.x, s.y);
                    } else {
                        window.handDraw.endStroke();
                    }
                }
            }
            // Hover logic
            const hover = window.shapeManager.getShapeAt(s.x, s.y);
            window.shapeManager.shapes.forEach(sh => sh.setHover(sh === hover));
        }
    }

    handleStretch() {
        const hL = this.handStates['Left']; const hR = this.handStates['Right'];
        if (hL.isPinching && hR.isPinching) {
            const centerX = (hL.x + hR.x) / 2;
            const centerY = (hL.y + hR.y) / 2;
            const target = window.shapeManager.getShapeAt(centerX, centerY);
            
            if (target) {
                target.state = 'stretching';
                const dist = Math.sqrt(Math.pow(hL.x - hR.x, 2) + Math.pow(hL.y - hR.y, 2));
                if (!target.initialDist) {
                    target.initialDist = dist;
                    target.initialW = target.w;
                    target.initialH = target.h;
                }
                const ratio = dist / target.initialDist;
                target.w = target.initialW * ratio;
                target.h = target.initialH * ratio;
            }
        } else {
            // Reset stretch anchors when fingers release
            window.shapeManager.shapes.forEach(s => { 
                if (s.state === 'stretching') s.state = 'idle'; 
                s.initialDist = null;
            });
        }
    }

    async virtualClick(x, y) {
        this.overlay.style.display = 'none';
        await new Promise(r => requestAnimationFrame(r));
        const el = document.elementFromPoint(x, y);
        if (el) {
            const props = { bubbles: true, cancelable: true, view: window };
            el.dispatchEvent(new MouseEvent('mousedown', props));
            el.dispatchEvent(new MouseEvent('mouseup', props));
            el.click();
            this.createRipple(x, y);
        }
        this.overlay.style.display = 'block';
    }

    createRipple(x, y) {
        const r = document.createElement('div');
        r.style.cssText = `position:absolute; left:${x}px; top:${y}px; width:10px; height:10px; background:rgba(255,255,255,0.6); border-radius:50%; transform:translate(-50%, -50%); animation:ripple-v8 0.4s forwards; pointer-events:none; z-index:999999;`;
        document.body.appendChild(r);
        setTimeout(() => r.remove(), 400);
        if (!document.getElementById('v8-ripple')) {
            const s = document.createElement('style'); s.id='v8-ripple';
            s.textContent = `@keyframes ripple-v8 { to { width:100px; height:100px; opacity:0; } }`;
            document.head.appendChild(s);
        }
    }

    loop() { requestAnimationFrame(() => this.loop()); }
}

window.handEngine = new HandEngine();

/**
 * Btoan AI - Professional Hand Engine v7.0 (AIR MOUSE & DRAW)
 * Refactored for 1-hand Mouse and 2-hand Draw logic.
 */

class HandEngine {
    constructor() {
        this.video = document.getElementById('hand-video');
        this.canvas = document.getElementById('hand-canvas');
        this.ctx = this.canvas.getContext('2d');
        
        this.hands = null;
        this.camera = null;
        this.isActive = false;
        
        // --- GLOBAL STATE ---
        this.mode = 'NO_HAND'; // 'NO_HAND', 'MOUSE', 'DRAW'
        this.handStates = {
            'Left': { x: 0, y: 0, isPinching: false, prevPinching: false, rawX: 0, rawY: 0 },
            'Right': { x: 0, y: 0, isPinching: false, prevPinching: false, rawX: 0, rawY: 0 }
        };
        
        // --- CONFIG ---
        this.smoothFactor = 0.55;
        this.pinchThreshold = 0.055;
        this.modeStabilityFrames = 0;
        this.lastTime = 0;
        
        // --- CLICK DEBOUNCE ---
        this.lastClickTime = 0;
        this.clickCooldown = 400; // ms

        this.init();
    }

    async init() {
        this.hands = new Hands({
            locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands@0.4/${file}`
        });

        this.hands.setOptions({
            maxNumHands: 2,
            modelComplexity: 1,
            minDetectionConfidence: 0.65,
            minTrackingConfidence: 0.65
        });

        this.hands.onResults(this.onResults.bind(this));
        
        const toggleBtn = document.getElementById('toggleHandMode');
        if (toggleBtn) toggleBtn.onclick = () => this.toggle();
        this.loop();
    }

    toggle() {
        if (this.isActive) this.stop();
        else this.start();
    }

    async start() {
        document.getElementById('hand-overlay').style.display = 'block';
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
        document.getElementById('hand-overlay').style.display = 'none';
        this.mode = 'NO_HAND';
    }

    onResults(results) {
        this.ctx.save();
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        const detected = new Set();
        
        if (results.multiHandLandmarks && results.multiHandedness) {
            results.multiHandLandmarks.forEach((landmarks, i) => {
                const label = results.multiHandedness[i].label; // 'Left' or 'Right'
                detected.add(label);
                
                // Draw skeleton (Professional Cyan)
                window.drawConnectors(this.ctx, landmarks, window.HAND_CONNECTIONS, { color: 'rgba(255, 255, 255, 0.2)', lineWidth: 1 });
                window.drawLandmarks(this.ctx, landmarks, { color: '#00ffcc', lineWidth: 1, radius: 1 });
                
                this.processHand(label, landmarks);
            });
        }
        
        // --- MODE MANAGEMENT ---
        this.updateMode(detected);
        this.syncUI(detected);
        
        this.ctx.restore();
    }

    updateMode(detected) {
        const count = detected.size;
        let targetMode = 'NO_HAND';
        if (count === 1) targetMode = 'MOUSE';
        else if (count === 2) targetMode = 'DRAW';

        if (this.mode !== targetMode) {
            this.modeStabilityFrames++;
            if (this.modeStabilityFrames > 5) { // Needs 5 frames of stability
                const oldMode = this.mode;
                this.mode = targetMode;
                this.modeStabilityFrames = 0;
                
                // Cleanup when leaving Draw mode
                if (oldMode === 'DRAW') window.handDraw.endStroke();
            }
        } else {
            this.modeStabilityFrames = 0;
        }
    }

    syncUI(detected) {
        const overlay = document.getElementById('hand-overlay');
        const badge = document.getElementById('hand-mode-label');
        const controls = document.getElementById('drawing-controls');
        
        badge.innerText = this.mode;
        controls.style.display = (this.mode === 'DRAW') ? 'flex' : 'none';
        
        ['Left', 'Right'].forEach(side => {
            const cursor = document.getElementById(`cursor-${side.toLowerCase()}`);
            if (detected.has(side)) {
                cursor.style.display = 'block';
                const s = this.handStates[side];
                cursor.style.left = `${s.x}px`;
                cursor.style.top = `${s.y}px`;
                
                // Mouse Clicking Feedback
                if (this.mode === 'MOUSE') {
                   cursor.style.transform = `translate(-50%, -50%) scale(${s.isPinching ? 0.7 : 1})`;
                }
            } else {
                cursor.style.display = 'none';
            }
        });
        
        // Handle Drawing Visual State
        if (this.mode === 'DRAW' && this.handStates['Left'].isPinching) {
            overlay.classList.add('drawing-active');
        } else {
            overlay.classList.remove('drawing-active');
        }
    }

    processHand(side, landmarks) {
        const s = this.handStates[side];
        const thumb = landmarks[4];
        const index = landmarks[8];
        
        // Smoothing
        const rawX = (1 - index.x) * window.innerWidth;
        const rawY = index.y * window.innerHeight;
        s.x = s.x + (rawX - s.x) * this.smoothFactor;
        s.y = s.y + (rawY - s.y) * this.smoothFactor;
        
        // Pinch Detection
        const d = Math.sqrt(Math.pow(thumb.x - index.x, 2) + Math.pow(thumb.y - index.y, 2));
        s.prevPinching = s.isPinching;
        s.isPinching = d < this.pinchThreshold;
        
        // --- INTERACTION LOGIC ---
        if (this.mode === 'MOUSE') {
            this.handleMouseMode(s);
        } else if (this.mode === 'DRAW') {
            this.handleDrawMode();
        }
    }

    handleMouseMode(s) {
        // Trigger Click on Release (Tap Gesture)
        if (s.prevPinching && !s.isPinching) {
            const now = Date.now();
            if (now - this.lastClickTime > this.clickCooldown) {
                this.lastClickTime = now;
                this.virtualClick(s.x, s.y);
            }
        }
    }

    handleDrawMode() {
        const trigger = this.handStates['Left']; // Trigger hand
        const pen = this.handStates['Right'];    // Pen hand
        
        if (trigger.isPinching && !trigger.prevPinching) {
            // Start Stroke
            window.handDraw.startStroke(pen.x, pen.y);
        } else if (trigger.isPinching) {
            // Add Point
            window.handDraw.addPoint(pen.x, pen.y);
        } else if (!trigger.isPinching && trigger.prevPinching) {
            // End Stroke
            window.handDraw.endStroke();
        }
    }

    virtualClick(x, y) {
        // Find element at point
        const el = document.elementFromPoint(x, y);
        if (!el) return;

        console.log("Virtual Click at:", x, y, "on element:", el);
        
        // Dispatch sequence
        const props = { bubbles: true, cancelable: true, view: window };
        el.dispatchEvent(new MouseEvent('mousedown', props));
        el.dispatchEvent(new MouseEvent('mouseup', props));
        el.click();
        
        // Visual Ripple Feedback
        this.createRipple(x, y);
    }

    createRipple(x, y) {
        const ripple = document.createElement('div');
        ripple.style.cssText = `
            position:absolute; left:${x}px; top:${y}px; width:10px; height:10px;
            background:rgba(0, 255, 204, 0.4); border-radius:50%; pointer-events:none;
            transform:translate(-50%, -50%); animation: ripple-anim 0.4s ease-out forwards;
            z-index:9999999;
        `;
        document.body.appendChild(ripple);
        setTimeout(() => ripple.remove(), 400);
        
        if (!document.getElementById('ripple-css')) {
            const style = document.createElement('style');
            style.id = 'ripple-css';
            style.textContent = `@keyframes ripple-anim { to { width: 100px; height: 100px; opacity: 0; } }`;
            document.head.appendChild(style);
        }
    }

    loop() {
        if (this.isActive) {
            // External updates handled in loop
        }
        requestAnimationFrame(() => this.loop());
    }
}

window.handEngine = new HandEngine();

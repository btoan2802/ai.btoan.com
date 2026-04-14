/**
 * Btoan AI - Professional Hand Engine v7.5 (MOUSE + DRAW + ORBS)
 * Fixed Click, Smooth Draw, and Gesture-based Orb Creation.
 */

class HandEngine {
    constructor() {
        this.video = document.getElementById('hand-video');
        this.canvas = document.getElementById('hand-canvas');
        this.ctx = this.canvas.getContext('2d');
        this.overlay = document.getElementById('hand-overlay');
        
        this.hands = null;
        this.camera = null;
        this.isActive = false;
        
        this.mode = 'NO_HAND';
        this.handStates = {
            'Left': { x: 0, y: 0, isPinching: false, prevPinching: false, pinchStartTime: 0, lockTarget: null, mode: 'idle' },
            'Right': { x: 0, y: 0, isPinching: false, prevPinching: false, pinchStartTime: 0, lockTarget: null, mode: 'idle' }
        };
        
        this.smoothFactor = 0.5;
        this.pinchThreshold = 0.055;
        this.tapWindow = 250; // Max ms for a tap/click
        this.creationHoldTime = 600; // ms to hold for spawning orb
        
        this.lastTime = 0;
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
        const detected = new Set();
        
        if (results.multiHandLandmarks && results.multiHandedness) {
            results.multiHandLandmarks.forEach((landmarks, i) => {
                const label = results.multiHandedness[i].label;
                detected.add(label);
                
                // Professional Skeleton
                window.drawConnectors(this.ctx, landmarks, window.HAND_CONNECTIONS, { color: 'rgba(255,255,255,0.1)', lineWidth: 1 });
                window.drawLandmarks(this.ctx, landmarks, { color: '#00ffcc', lineWidth: 1, radius: 1 });
                
                this.processHand(label, landmarks);
            });
        }
        
        this.updateMode(detected);
        this.syncUI(detected);
        this.ctx.restore();
    }

    updateMode(detected) {
        let newMode = 'NO_HAND';
        if (detected.size === 1) newMode = 'MOUSE';
        else if (detected.size === 2) newMode = 'DRAW';
        
        if (this.mode !== newMode) {
            if (this.mode === 'DRAW') window.handDraw.endStroke();
            this.mode = newMode;
        }
    }

    syncUI(detected) {
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
                cursor.style.transform = `translate(-50%, -50%) scale(${s.isPinching ? 0.75 : 1})`;
            } else {
                cursor.style.display = 'none';
            }
        });
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
        
        // Pinch
        const d = Math.sqrt(Math.pow(thumb.x - index.x, 2) + Math.pow(thumb.y - index.y, 2));
        s.prevPinching = s.isPinching;
        s.isPinching = d < this.pinchThreshold;
        
        const now = Date.now();
        if (s.isPinching && !s.prevPinching) s.pinchStartTime = now;

        if (this.mode === 'MOUSE') {
            this.handleMouseLogic(s, now);
        } else if (this.mode === 'DRAW') {
            this.handleDrawLogic();
        }
        
        s.prevX = s.x; s.prevY = s.y;
    }

    handleMouseLogic(s, now) {
        const duration = now - s.pinchStartTime;

        if (s.isPinching) {
            // Check for Orb interaction or Creation start
            if (!s.lockTarget) {
                const targetOrb = window.orbManager.getOrbAt(s.x, s.y);
                if (targetOrb) {
                    s.lockTarget = targetOrb;
                    targetOrb.state = 'dragging';
                } else if (duration > this.creationHoldTime && s.mode !== 'creating') {
                    // Start Orb Creation Visualization
                    s.mode = 'creating';
                    this.createSpawnRipple(s.x, s.y);
                }
            } else {
                // Dragging Orb
                s.lockTarget.x = s.x;
                s.lockTarget.y = s.y;
                s.lockTarget.vx = (s.x - s.prevX) * 0.5;
                s.lockTarget.vy = (s.y - s.prevY) * 0.5;
            }
        } else {
            // RELEASE OR CLICK
            if (s.prevPinching) {
                if (s.lockTarget) {
                    s.lockTarget.state = 'idle';
                    s.lockTarget = null;
                } else if (s.mode === 'creating') {
                    // Finalize Orb
                    window.orbManager.spawn(s.x, s.y);
                } else if (duration < this.tapWindow) {
                    // Tap -> CLICK
                    this.virtualClick(s.x, s.y);
                }
            }
            s.mode = 'idle';
            // Hover logic for orbs
            const hoverOrb = window.orbManager.getOrbAt(s.x, s.y);
            window.orbManager.orbs.forEach(o => o.setHover(o === hoverOrb));
        }
    }

    handleDrawLogic() {
        const trigger = this.handStates['Left'];
        const pen = this.handStates['Right'];
        if (trigger.isPinching && !trigger.prevPinching) window.handDraw.startStroke(pen.x, pen.y);
        else if (trigger.isPinching) window.handDraw.addPoint(pen.x, pen.y);
        else if (!trigger.isPinching && trigger.prevPinching) window.handDraw.endStroke();
    }

    virtualClick(x, y) {
        // --- THE FIX ---
        // 1. Mark overlay as non-clickable
        this.overlay.style.pointerEvents = 'none';
        
        // 2. Find target element
        const el = document.elementFromPoint(x, y);
        
        // 3. Dispatch
        if (el) {
            console.log("Virtual Click on:", el.tagName, el.id);
            const props = { bubbles: true, cancelable: true, view: window };
            el.dispatchEvent(new MouseEvent('mousedown', props));
            el.dispatchEvent(new MouseEvent('mouseup', props));
            el.click();
            this.createRipple(x, y);
        }
        
        // 4. Restore
        this.overlay.style.pointerEvents = 'auto'; // Will be 'none' anyway, but managed by engine
    }

    createRipple(x, y) {
        const r = document.createElement('div');
        r.style.cssText = `position:absolute; left:${x}px; top:${y}px; width:10px; height:10px; background:rgba(0,255,204,0.5); border-radius:50%; transform:translate(-50%, -50%); animation:ripple-v5 0.5s forwards; pointer-events:none; z-index:999999;`;
        document.body.appendChild(r);
        setTimeout(() => r.remove(), 500);
        if (!document.getElementById('v5-ripple')) {
            const s = document.createElement('style'); s.id='v5-ripple';
            s.textContent = `@keyframes ripple-v5 { to { width:120px; height:120px; opacity:0; } }`;
            document.head.appendChild(s);
        }
    }

    createSpawnRipple(x, y) {
        const r = document.createElement('div');
        r.style.cssText = `position:absolute; left:${x}px; top:${y}px; width:40px; height:40px; border:3px solid #00ffcc; border-radius:50%; transform:translate(-50%, -50%); animation:spawn-pulse 0.6s infinite; pointer-events:none; z-index:999999;`;
        document.body.appendChild(r);
        setTimeout(() => r.remove(), 600);
        if (!document.getElementById('spawn-pulse-css')) {
            const s = document.createElement('style'); s.id='spawn-pulse-css';
            s.textContent = `@keyframes spawn-pulse { 0% { transform:translate(-50%,-50%) scale(1); opacity:1; } 100% { transform:translate(-50%,-50%) scale(1.5); opacity:0; } }`;
            document.head.appendChild(s);
        }
    }

    loop() {
        requestAnimationFrame(() => this.loop());
    }
}

window.handEngine = new HandEngine();

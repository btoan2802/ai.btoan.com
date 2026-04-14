/**
 * Btoan AI - Professional Hand Engine v5.0 (STABLE)
 * Advanced Smoothing, Hysteresis, and Robust Target Locking.
 */

class HandEngine {
    constructor() {
        this.video = document.getElementById('hand-video');
        this.canvas = document.getElementById('hand-canvas');
        this.ctx = this.canvas.getContext('2d');
        
        this.hands = null;
        this.camera = null;
        this.isActive = false;
        
        // Hand States with Target Locking
        this.handStates = {
            'Left': { x: 0, y: 0, isPinching: false, lockTarget: null, mode: 'idle' },
            'Right': { x: 0, y: 0, isPinching: false, lockTarget: null, mode: 'idle' }
        };
        
        // --- 1. SMOOTHING PARAMS ---
        this.smoothFactor = 0.5; // Exponential Smoothing
        this.pinchStartThreshold = 0.05; // Tight to start
        this.pinchReleaseThreshold = 0.085; // Loose to hold
        
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
            minDetectionConfidence: 0.6,
            minTrackingConfidence: 0.6
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
        this.cleanupAll();
    }

    cleanupAll() {
        ['Left', 'Right'].forEach(side => this.cleanupSide(side));
    }

    cleanupSide(side) {
        const s = this.handStates[side];
        if (s.mode === 'creating') window.genesisEngine.cancelCreation();
        if (s.lockTarget) this.releaseObject(s);
        s.mode = 'idle';
        s.lockTarget = null;
    }

    onResults(results) {
        this.ctx.save();
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        const detected = new Set();
        
        if (results.multiHandLandmarks && results.multiHandedness) {
            results.multiHandLandmarks.forEach((landmarks, i) => {
                const label = results.multiHandedness[i].label;
                detected.add(label);
                
                // Draw skeleton (Cyan)
                window.drawConnectors(this.ctx, landmarks, window.HAND_CONNECTIONS, { color: 'rgba(0, 255, 204, 0.4)', lineWidth: 2 });
                window.drawLandmarks(this.ctx, landmarks, { color: '#00ffcc', lineWidth: 1, radius: 2 });
                
                this.processHand(label, landmarks);
            });
        }
        
        // Visibility Sync
        ['Left', 'Right'].forEach(side => {
            const cursor = document.getElementById(`cursor-${side.toLowerCase()}`);
            if (detected.has(side)) {
                cursor.style.display = 'block';
                const s = this.handStates[side];
                cursor.style.left = `${s.x}px`;
                cursor.style.top = `${s.y}px`;
                // Cursor visual scale based on pinch
                cursor.style.transform = `translate(-50%, -50%) scale(${s.isPinching ? 0.7 : 1})`;
            } else {
                cursor.style.display = 'none';
                this.cleanupSide(side);
            }
        });
        this.ctx.restore();
    }

    processHand(side, landmarks) {
        const s = this.handStates[side];
        const thumb = landmarks[4];
        const index = landmarks[8];
        
        // --- 2. ADVANCED SMOOTHING ---
        const rawX = (1 - index.x) * window.innerWidth;
        const rawY = index.y * window.innerHeight;
        s.x = s.x + (rawX - s.x) * this.smoothFactor;
        s.y = s.y + (rawY - s.y) * this.smoothFactor;
        
        // --- 3. HYSTERESIS GESTURE ---
        const d = Math.sqrt(Math.pow(thumb.x - index.x, 2) + Math.pow(thumb.y - index.y, 2));
        const wasPinching = s.isPinching;
        
        if (!wasPinching && d < this.pinchStartThreshold) s.isPinching = true;
        else if (wasPinching && d > this.pinchReleaseThreshold) s.isPinching = false;
        
        // --- 4. STATE MACHINE & TARGET LOCKING ---
        if (s.isPinching && !wasPinching) {
            // New interaction: LOCK TARGET
            const seed = window.genesisEngine.getSeedAt(s.x, s.y);
            if (seed) {
                s.mode = 'creating';
                s.lockTarget = seed;
                window.genesisEngine.startCreation(seed, side, s.x, s.y);
            } else {
                const obj = window.handScene.getObjectAt(s.x, s.y);
                if (obj) {
                    s.mode = 'manipulating';
                    this.grabObject(s, obj, side);
                }
            }
        } else if (!s.isPinching && wasPinching) {
            // RELEASE TARGET
            if (s.mode === 'creating') window.genesisEngine.finalizeCreation(s.x, s.y);
            else if (s.mode === 'manipulating') this.releaseObject(s);
            s.mode = 'idle';
            s.lockTarget = null;
        }

        // --- 5. EXECUTION (LOCKED) ---
        if (s.mode === 'creating') {
            window.genesisEngine.updateCreation(s.x, s.y);
        } else if (s.mode === 'manipulating' && s.lockTarget) {
            this.handleManipulation(s);
        } else {
            // Hover logic (Exclusive to non-interacting hands)
            const hover = window.handScene.getObjectAt(s.x, s.y);
            window.handScene.objects.forEach(o => { if (!o.grabbedBy.length) o.setHover(o === hover); });
        }
        
        s.prevX = s.x; s.prevY = s.y;
    }

    grabObject(handState, target, handSide) {
        handState.lockTarget = target;
        if (!target.grabbedBy.includes(handSide)) target.grabbedBy.push(handSide.toLowerCase());
        target.state = target.grabbedBy.length === 2 ? 'grabbed_dual' : 'grabbed_single';
        
        if (target.state === 'grabbed_dual') {
            const hL = this.handStates['Left']; const hR = this.handStates['Right'];
            target.initialDist = Math.sqrt(Math.pow(hL.x - hR.x, 2) + Math.pow(hL.y - hR.y, 2));
            target.initialAngle = Math.atan2(hR.y - hL.y, hR.x - hL.x) * (180 / Math.PI);
            target.initialScale = target.scale;
            target.initialRot = target.rotationZ;
        }
    }

    releaseObject(handState) {
        const target = handState.lockTarget; if (!target) return;
        const side = handState === this.handStates['Left'] ? 'left' : 'right';
        const idx = target.grabbedBy.indexOf(side);
        if (idx > -1) target.grabbedBy.splice(idx, 1);
        target.state = target.grabbedBy.length === 1 ? 'grabbed_single' : 'idle';
        if (target.state === 'idle') {
            target.vx = (handState.x - handState.prevX) * 0.4;
            target.vy = (handState.y - handState.prevY) * 0.4;
        }
        handState.lockTarget = null;
    }

    handleManipulation(handState) {
        const t = handState.lockTarget;
        if (t.state === 'grabbed_single') {
            t.x = handState.x; t.y = handState.y;
        } else if (t.state === 'grabbed_dual') {
            const hL = this.handStates['Left']; const hR = this.handStates['Right'];
            t.x = (hL.x + hR.x) / 2; t.y = (hL.y + hR.y) / 2;
            const dist = Math.sqrt(Math.pow(hL.x - hR.x, 2) + Math.pow(hL.y - hR.y, 2));
            t.scale = t.initialScale * (dist / target.initialDist); // Use scale for dual transform
            const angle = Math.atan2(hR.y - hL.y, hR.x - hL.x) * (180 / Math.PI);
            t.rotationZ = t.initialRot + (angle - target.initialAngle);
        }
    }

    loop() {
        const dt = performance.now() - this.lastTime; this.lastTime = performance.now();
        if (window.handScene) window.handScene.update();
        requestAnimationFrame(() => this.loop());
    }
}
window.handEngine = new HandEngine();

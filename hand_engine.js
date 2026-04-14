/**
 * Btoan AI - Professional Hand Engine v4.5
 * Handles Multi-hand tracking, Gestures, Creation Mode, and Multi-object manipulation.
 */

class HandEngine {
    constructor() {
        this.video = document.getElementById('hand-video');
        this.canvas = document.getElementById('hand-canvas');
        this.ctx = this.canvas.getContext('2d');
        
        this.hands = null;
        this.camera = null;
        this.isActive = false;
        
        // Tracking state
        this.handStates = {
            'Left': { x: 0, y: 0, isPinching: false, target: null, mode: 'idle', rawX: 0, rawY: 0 },
            'Right': { x: 0, y: 0, isPinching: false, target: null, mode: 'idle', rawX: 0, rawY: 0 }
        };
        
        this.lerpAmount = 0.45;
        this.pinchThreshold = 0.055;
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
            minDetectionConfidence: 0.5,
            minTrackingConfidence: 0.5
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
    }

    onResults(results) {
        this.ctx.save();
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        const detected = new Set();
        
        if (results.multiHandLandmarks && results.multiHandedness) {
            results.multiHandLandmarks.forEach((landmarks, i) => {
                const label = results.multiHandedness[i].label;
                detected.add(label);
                
                // Visual Skeleton (Professional White/Cyan)
                window.drawConnectors(this.ctx, landmarks, window.HAND_CONNECTIONS, { color: 'rgba(0, 255, 204, 0.4)', lineWidth: 1.5 });
                window.drawLandmarks(this.ctx, landmarks, { color: '#00ffcc', lineWidth: 1, radius: 1.5 });
                
                this.processHand(label, landmarks);
            });
        }
        
        ['Left', 'Right'].forEach(side => {
            const cursor = document.getElementById(`cursor-${side.toLowerCase()}`);
            if (detected.has(side)) {
                cursor.style.display = 'block';
                const s = this.handStates[side];
                cursor.style.left = `${s.x}px`;
                cursor.style.top = `${s.y}px`;
                // Update Badge style based on mode
                const badge = cursor.querySelector('.cursor-status-label');
                badge.innerText = `${side.charAt(0)}_${s.mode.toUpperCase()}`;
                badge.style.color = s.isPinching ? '#fff' : '#00ffcc';
            } else {
                cursor.style.display = 'none';
                this.cleanupHandState(side);
            }
        });
        this.ctx.restore();
    }

    cleanupHandState(side) {
        const s = this.handStates[side];
        if (s.mode === 'creating') window.genesisEngine.cancelCreation();
        if (s.target) this.releaseObject(s);
        s.mode = 'idle';
    }

    processHand(side, landmarks) {
        const s = this.handStates[side];
        const thumb = landmarks[4];
        const index = landmarks[8];
        
        // 1. Position Smoothing
        const rawX = (1 - index.x) * window.innerWidth;
        const rawY = index.y * window.innerHeight;
        s.x += (rawX - s.x) * this.lerpAmount;
        s.y += (rawY - s.y) * this.lerpAmount;
        
        // 2. Gesture Detection
        const d = Math.sqrt(Math.pow(thumb.x - index.x, 2) + Math.pow(thumb.y - index.y, 2));
        const wasPinching = s.isPinching;
        s.isPinching = d < this.pinchThreshold;
        
        if (s.isPinching && !wasPinching) {
            // Check for GENESIS mode first
            const seed = window.genesisEngine.getSeedAt(s.x, s.y);
            if (seed) {
                s.mode = 'creating';
                window.genesisEngine.startCreation(seed, side, s.x, s.y);
            } else {
                // Otherwise try grab existing
                const target = window.handScene.getObjectAt(s.x, s.y);
                if (target) {
                    s.mode = 'grabbing';
                    this.grabObject(s, target, side);
                }
            }
        } else if (!s.isPinching && wasPinching) {
            // Release
            if (s.mode === 'creating') window.genesisEngine.finalizeCreation(s.x, s.y);
            else if (s.mode === 'grabbing') this.releaseObject(s);
            s.mode = 'idle';
        }

        // 3. Execution
        if (s.mode === 'creating') window.genesisEngine.updateCreation(s.x, s.y);
        else if (s.mode === 'grabbing' && s.target) this.handleManipulation(s);
        else {
            // Hover logic
            const hover = window.handScene.getObjectAt(s.x, s.y);
            window.handScene.objects.forEach(o => { if (!o.grabbedBy.length) o.setHover(o === hover); });
        }
        
        s.prevX = s.x; s.prevY = s.y;
    }

    grabObject(handState, target, handSide) {
        handState.target = target;
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
        const target = handState.target; if (!target) return;
        const side = handState === this.handStates['Left'] ? 'left' : 'right';
        const idx = target.grabbedBy.indexOf(side);
        if (idx > -1) target.grabbedBy.splice(idx, 1);
        target.state = target.grabbedBy.length === 1 ? 'grabbed_single' : 'idle';
        if (target.state === 'idle') {
            target.vx = (handState.x - handState.prevX) * 0.5;
            target.vy = (handState.y - handState.prevY) * 0.5;
        }
        handState.target = null;
    }

    handleManipulation(handState) {
        const t = handState.target;
        if (t.state === 'grabbed_single') {
            t.x = handState.x; t.y = handState.y;
        } else if (t.state === 'grabbed_dual') {
            const hL = this.handStates['Left']; const hR = this.handStates['Right'];
            t.x = (hL.x + hR.x) / 2; t.y = (hL.y + hR.y) / 2;
            const dist = Math.sqrt(Math.pow(hL.x - hR.x, 2) + Math.pow(hL.y - hR.y, 2));
            t.currentScale = t.initialScale * (dist / t.initialDist);
            const angle = Math.atan2(hR.y - hL.y, hR.x - hL.x) * (180 / Math.PI);
            t.rotationZ = t.initialRot + (angle - t.initialAngle);
        }
    }

    loop() {
        const dt = performance.now() - this.lastTime; this.lastTime = performance.now();
        if (document.getElementById('fps-counter')) document.getElementById('fps-counter').innerText = `FPS: ${Math.round(1000/dt)}`;
        if (window.handScene) window.handScene.update();
        requestAnimationFrame(() => this.loop());
    }
}
window.handEngine = new HandEngine();

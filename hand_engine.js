/**
 * Btoan AI - Professional Hand Engine v9.0 (3D SPATIAL & INDEPENDENT DUAL)
 * Pure 3D Manipulation: 1H Move, 1H Rotate (Two objects), or 2H Dual Rotation.
 */

class HandEngine {
    constructor() {
        this.video = document.getElementById('hand-video');
        this.canvas = document.getElementById('hand-canvas');
        this.ctx = this.canvas.getContext('2d');
        this.overlay = document.getElementById('hand-overlay');
        
        this.isActive = false;
        this.mode = '3D SPATIAL';
        
        // --- INDEPENDENT HAND CONTROLLERS ---
        this.handStates = {
            'Left': { x: 0, y: 0, isPinching: false, prevPinching: false, lockTarget: null, prevX: 0, prevY: 0 },
            'Right': { x: 0, y: 0, isPinching: false, prevPinching: false, lockTarget: null, prevX: 0, prevY: 0 }
        };
        
        // --- PRECISION CONFIG ---
        this.smooth = 0.5;
        this.pinchThresh = 0.052;
        this.tapWindow = 220; 
        
        // --- SPATIAL ANCHORS ---
        this.spatialState = {
            isDualOnSame: false,
            initialDist: 0,
            initialRotX: 0,
            initialRotY: 0,
            initialRotZ: 0
        };

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
        ['Left', 'Right'].forEach(side => this.releaseObject(side));
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
        
        // Sync Logic for Shared Objects
        this.evaluateMultiHandState();
        this.syncUI(detectedSet);
        this.ctx.restore();
    }

    evaluateMultiHandState() {
        const hL = this.handStates['Left'];
        const hR = this.handStates['Right'];
        
        if (hL.lockTarget && hR.lockTarget && hL.lockTarget === hR.lockTarget) {
            const t = hL.lockTarget;
            if (!this.spatialState.isDualOnSame) {
                this.spatialState.isDualOnSame = true;
                this.spatialState.initialDist = Math.sqrt(Math.pow(hL.x - hR.x, 2) + Math.pow(hL.y - hR.y, 2)) || 1;
                this.spatialState.initialAngle = Math.atan2(hR.y - hL.y, hR.x - hL.x);
                this.spatialState.initialRotX = t.rotationX;
                this.spatialState.initialRotY = t.rotationY;
                this.spatialState.initialRotZ = t.rotationZ;
            }
            t.state = 'grabbed_dual';
        } else {
            this.spatialState.isDualOnSame = false;
            if (hL.lockTarget) hL.lockTarget.state = 'grabbed_single';
            if (hR.lockTarget) hR.lockTarget.state = 'grabbed_single';
        }
    }

    syncUI(detected) {
        const badge = document.getElementById('hand-mode-label');
        badge.innerText = `3D_SPATIAL [${detected.size}H]`;
        ['Left', 'Right'].forEach(side => {
            const cursor = document.getElementById(`cursor-${side.toLowerCase()}`);
            if (detected.has(side)) {
                cursor.style.display = 'block';
                const s = this.handStates[side];
                cursor.style.left = `${s.x}px`;
                cursor.style.top = `${s.y}px`;
                cursor.style.transform = `translate(-50%, -50%) scale(${s.isPinching ? 0.7 : 1})`;
            } else { 
                cursor.style.display = 'none'; 
                this.releaseObject(side);
            }
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
        if (s.isPinching && !s.prevPinching) {
            const target = window.shapeManager.getShapeAt(s.x, s.y);
            if (target) {
                target.state = 'grabbed_single';
                s.lockTarget = target;
                if (!target.grabbedBy.includes(side.toLowerCase())) target.grabbedBy.push(side.toLowerCase());
            } else {
                // Potential Click only if in background
                s.pinchStartTime = now;
            }
        } else if (!s.isPinching && s.prevPinching) {
            if (s.lockTarget) {
                this.releaseObject(side);
            } else if (now - s.pinchStartTime < this.tapWindow) {
                this.virtualClick(s.x, s.y);
            }
        }

        // Apply Independent Movement
        if (s.isPinching && s.lockTarget && s.lockTarget.state === 'grabbed_single') {
            s.lockTarget.x = s.x;
            s.lockTarget.y = s.y;
            s.lockTarget.vx = (s.x - s.prevX) * 0.5;
            s.lockTarget.vy = (s.y - s.prevY) * 0.5;
        }
        
        // Handle Shared Rotation Logic
        if (this.spatialState.isDualOnSame) {
            this.handleDualSpatial();
        }

        // Hover Effect
        if (!s.isPinching) {
             const h = window.shapeManager.getShapeAt(s.x, s.y);
             window.shapeManager.shapes.forEach(sh => sh.setHover(sh === h));
        }
        
        s.prevX = s.x; s.prevY = s.y;
    }

    handleDualSpatial() {
        const hL = this.handStates['Left'];
        const hR = this.handStates['Right'];
        const t = hL.lockTarget; // same as hR
        const ss = this.spatialState;
        
        const dx = hR.x - hL.x;
        const dy = hR.y - hL.y;
        const dist = Math.sqrt(dx*dx + dy*dy) || 1;
        const angle = Math.atan2(dy, dx);
        
        // Z-Rotation (Angle Change)
        t.rotationZ = ss.initialRotZ + (angle - ss.initialAngle) * (180/Math.PI);
        
        // 3D X/Y Rotation (Relative movements)
        const diffX = (hL.x - hL.prevX) + (hR.x - hR.prevX);
        const diffY = (hL.y - hL.prevY) + (hR.y - hR.prevY);
        
        // Use midpoint movement for rotation logic
        t.rotationY += diffX * 0.3;
        t.rotationX -= diffY * 0.3;
        
        // Midpoint position
        t.x = (hL.x + hR.x) / 2;
        t.y = (hL.y + hR.y) / 2;
    }

    releaseObject(side) {
        const s = this.handStates[side];
        if (s.lockTarget) {
            const idx = s.lockTarget.grabbedBy.indexOf(side.toLowerCase());
            if (idx > -1) s.lockTarget.grabbedBy.splice(idx, 1);
            s.lockTarget.state = s.lockTarget.grabbedBy.length > 0 ? 'grabbed_single' : 'idle';
            s.lockTarget = null;
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
        r.style.cssText = `position:absolute; left:${x}px; top:${y}px; width:10px; height:10px; background:rgba(255,255,255,0.6); border-radius:50%; transform:translate(-50%, -50%); animation:ripple-v9 0.4s forwards; pointer-events:none; z-index:999999;`;
        document.body.appendChild(r);
        setTimeout(() => r.remove(), 400);
    }

    loop() { requestAnimationFrame(() => this.loop()); }
}

window.handEngine = new HandEngine();

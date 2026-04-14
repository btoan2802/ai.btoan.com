/**
 * Btoan AI - Professional Hand Engine v4.0
 * Handles MediaPipe tracking, smoothing, gestures, and multi-hand interaction.
 */

class HandEngine {
    constructor() {
        this.video = document.getElementById('hand-video');
        this.canvas = document.getElementById('hand-canvas');
        this.ctx = this.canvas.getContext('2d');
        
        this.hands = null;
        this.camera = null;
        this.isActive = false;
        
        // Tracking state for 2 hands
        this.handStates = {
            'Left': { x: 0, y: 0, isPinching: false, target: null, rawX: 0, rawY: 0 },
            'Right': { x: 0, y: 0, isPinching: false, target: null, rawX: 0, rawY: 0 }
        };
        
        // Smoothing config
        this.lerpAmount = 0.4;
        this.pinchThreshold = 0.06;
        
        // FPS / Performance
        this.lastTime = 0;
        this.fpsCounter = document.getElementById('fps-counter');
        
        // Rulers
        this.rulerX = document.getElementById('ruler-x');
        this.rulerY = document.getElementById('ruler-y');

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
                    onFrame: async () => {
                        if (this.isActive) await this.hands.send({ image: this.video });
                    },
                    width: 1280,
                    height: 720
                });
            }
            await this.camera.start();
            this.isActive = true;
        } catch (e) {
            console.error(e);
        }
    }

    stop() {
        if (this.camera) this.camera.stop();
        this.isActive = false;
        document.getElementById('hand-overlay').style.display = 'none';
        // Reset hand states
        Object.values(this.handStates).forEach(h => {
            if (h.target) this.releaseObject(h);
        });
    }

    onResults(results) {
        this.ctx.save();
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        
        const detectedHands = new Set();
        
        if (results.multiHandLandmarks && results.multiHandedness) {
            results.multiHandLandmarks.forEach((landmarks, i) => {
                const label = results.multiHandedness[i].label; // 'Left' or 'Right'
                detectedHands.add(label);
                
                // Draw skeleton
                window.drawConnectors(this.ctx, landmarks, window.HAND_CONNECTIONS, { color: '#00ffcc', lineWidth: 2 });
                window.drawLandmarks(this.ctx, landmarks, { color: '#ffffff', lineWidth: 1, radius: 2 });
                
                this.processHand(label, landmarks);
            });
        }
        
        // Update labels and visibility
        ['Left', 'Right'].forEach(side => {
            const cursor = document.getElementById(`cursor-${side.toLowerCase()}`);
            if (detectedHands.has(side)) {
                cursor.style.display = 'block';
                const state = this.handStates[side];
                cursor.style.left = `${state.x}px`;
                cursor.style.top = `${state.y}px`;
                cursor.style.transform = `translate(-50%, -50%) scale(${state.isPinching ? 0.8 : 1})`;
                cursor.style.borderColor = state.isPinching ? '#ffffff' : '#00ffcc';
            } else {
                cursor.style.display = 'none';
                if (this.handStates[side].target) this.releaseObject(this.handStates[side]);
            }
        });
        
        this.ctx.restore();
    }

    processHand(side, landmarks) {
        const state = this.handStates[side];
        const thumb = landmarks[4];
        const index = landmarks[8];
        
        // 1. Position & Smoothing
        const rawX = (1 - index.x) * window.innerWidth;
        const rawY = index.y * window.innerHeight;
        state.x += (rawX - state.x) * this.lerpAmount;
        state.y += (rawY - state.y) * this.lerpAmount;
        
        // 2. Gesture: Pinch
        const dx = thumb.x - index.x;
        const dy = thumb.y - index.y;
        const dist = Math.sqrt(dx*dx + dy*dy);
        const prevPinching = state.isPinching;
        state.isPinching = dist < this.pinchThreshold;
        
        // 3. Hovering Logic
        if (!state.isPinching) {
            const hoverTarget = window.handScene.getObjectAt(state.x, state.y);
            window.handScene.objects.forEach(obj => {
                if (obj.grabbedBy.length === 0) obj.setHover(obj === hoverTarget);
            });
        }

        // 4. Interaction Logic
        if (state.isPinching && !prevPinching) {
            // New pinch: try grab
            const target = window.handScene.getObjectAt(state.x, state.y);
            if (target) this.grabObject(state, target, side);
        } else if (!state.isPinching && prevPinching) {
            // Released
            this.releaseObject(state);
        }
        
        // 5. Manipulation
        if (state.isPinching && state.target) {
            this.handleManipulation(state);
        }
        
        // Update Rulers (Visual Only)
        if (side === 'Right') {
            this.rulerX.style.top = `${state.y}px`;
            this.rulerY.style.left = `${state.x}px`;
        }
    }

    grabObject(handState, target, handSide) {
        handState.target = target;
        if (!target.grabbedBy.includes(handSide)) {
            target.grabbedBy.push(handSide.toLowerCase());
        }
        target.state = target.grabbedBy.length === 2 ? 'grabbed_dual' : 'grabbed_single';
        target.targetScale = 1.1;
        
        // Initial distance/angle for dual transform
        if (target.state === 'grabbed_dual') {
            const hL = this.handStates['Left'];
            const hR = this.handStates['Right'];
            target.initialDist = Math.sqrt(Math.pow(hL.x - hR.x, 2) + Math.pow(hL.y - hR.y, 2));
            target.initialAngle = Math.atan2(hR.y - hL.y, hR.x - hL.x) * (180 / Math.PI);
            target.initialScale = target.scale;
            target.initialRot = target.rotationZ;
        }
    }

    releaseObject(handState) {
        const target = handState.target;
        if (!target) return;
        
        const sideIdx = target.grabbedBy.indexOf(handState === this.handStates['Left'] ? 'left' : 'right');
        if (sideIdx > -1) target.grabbedBy.splice(sideIdx, 1);
        
        target.state = target.grabbedBy.length === 1 ? 'grabbed_single' : 'idle';
        if (target.state === 'idle') {
            target.targetScale = 1.0;
            // Add slight inertia
            target.vx = (handState.x - handState.prevX || 0) * 0.5;
            target.vy = (handState.y - handState.prevY || 0) * 0.5;
        }
        handState.target = null;
    }

    handleManipulation(handState) {
        const target = handState.target;
        
        if (target.state === 'grabbed_single') {
            // Simple Drag
            target.x = handState.x;
            target.y = handState.y;
            // Tilt based on movement
            target.rotationY = (handState.x - window.innerWidth / 2) * 0.05;
            target.rotationX = -(handState.y - window.innerHeight / 2) * 0.05;
        } else if (target.state === 'grabbed_dual') {
            // Dual Transform: Scale & Rotate & Position
            const hL = this.handStates['Left'];
            const hR = this.handStates['Right'];
            
            // Midpoint Position
            target.x = (hL.x + hR.x) / 2;
            target.y = (hL.y + hR.y) / 2;
            
            // Scale
            const currentDist = Math.sqrt(Math.pow(hL.x - hR.x, 2) + Math.pow(hL.y - hR.y, 2));
            const scaleFactor = currentDist / target.initialDist;
            target.currentScale = target.initialScale * scaleFactor;
            
            // Rotate
            const currentAngle = Math.atan2(hR.y - hL.y, hR.x - hL.x) * (180 / Math.PI);
            target.rotationZ = target.initialRot + (currentAngle - target.initialAngle);
        }
        
        handState.prevX = handState.x;
        handState.prevY = handState.y;
    }

    loop() {
        const now = performance.now();
        const dt = now - this.lastTime;
        this.lastTime = now;
        
        if (this.fpsCounter) this.fpsCounter.innerText = `FPS: ${Math.round(1000 / dt) || 0}`;
        
        if (window.handScene) window.handScene.update(dt);
        
        requestAnimationFrame(() => this.loop());
    }
}

window.handEngine = new HandEngine();

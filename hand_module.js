/**
 * Btoan AI - Hand Interaction Module (Architect Mode)
 * Inspired by @ztuden TikTok: Realistic gesture control with HUD and Wireframe effects
 */

class HandModule {
    constructor() {
        this.videoElement = document.getElementById('hand-video');
        this.canvasElement = document.getElementById('hand-canvas');
        this.canvasCtx = this.canvasElement.getContext('2d');
        this.statusElement = document.getElementById('hand-status');
        this.overlayElement = document.getElementById('hand-overlay');
        this.cursorElement = document.getElementById('hand-cursor');
        this.cursorStatus = document.getElementById('cursor-status');
        
        // HUD Elements
        this.rulerX = document.getElementById('hud-ruler-x');
        this.rulerY = document.getElementById('hud-ruler-y');
        this.valX = document.getElementById('hud-val-x');
        this.valY = document.getElementById('hud-val-y');
        
        this.hands = null;
        this.camera = null;
        this.isActive = false;
        
        // Interaction state
        this.isPinching = false;
        this.draggedElement = null;
        this.pinchThreshold = 0.045; // Tighter for precision
        
        // Smoothing (Enhanced)
        this.cursorX = 0;
        this.cursorY = 0;
        this.lerpAmount = 0.25;

        this.init();
    }

    async init() {
        this.hands = new Hands({
            locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`
        });

        this.hands.setOptions({
            maxNumHands: 2, // Enable 2 hands as seen in video
            modelComplexity: 1,
            minDetectionConfidence: 0.7,
            minTrackingConfidence: 0.7
        });

        this.hands.onResults(this.onResults.bind(this));

        document.getElementById('toggleHandMode').addEventListener('click', () => this.toggle());
    }

    async toggle() {
        if (this.isActive) this.stop();
        else await this.start();
    }

    async start() {
        this.overlayElement.style.display = 'block';
        this.statusElement.textContent = "SCANNING...";
        document.getElementById('toggleHandMode').classList.add('active');
        
        try {
            if (!this.camera) {
                this.camera = new Camera(this.videoElement, {
                    onFrame: async () => {
                        await this.hands.send({ image: this.videoElement });
                    },
                    width: 640,
                    height: 480
                });
            }
            await this.camera.start();
            this.isActive = true;
            this.cursorElement.style.display = 'block';
        } catch (err) {
            this.statusElement.textContent = "ERR: CAMERA_FAILED";
        }
    }

    stop() {
        if (this.camera) this.camera.stop();
        this.isActive = false;
        this.overlayElement.style.display = 'none';
        this.cursorElement.style.display = 'none';
        document.getElementById('toggleHandMode').classList.remove('active');
    }

    onResults(results) {
        this.canvasCtx.save();
        this.canvasCtx.clearRect(0, 0, this.canvasElement.width, this.canvasElement.height);
        
        if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
            this.statusElement.textContent = "TRACKING: " + results.multiHandLandmarks.length + "H";
            
            results.multiHandLandmarks.forEach((landmarks, index) => {
                // Drawing Wireframe Skeleton (Cyan color like video)
                window.drawConnectors(this.canvasCtx, landmarks, window.HAND_CONNECTIONS, { color: '#00ffcc', lineWidth: 2 });
                window.drawLandmarks(this.canvasCtx, landmarks, { color: '#00ffcc', lineWidth: 1, radius: 2 });

                // Process input from the first hand for cursor control
                if (index === 0) this.processInput(landmarks);
            });
        } else {
            this.statusElement.textContent = "READY_SEARCHING...";
            this.releaseElement();
        }
        
        this.canvasCtx.restore();
    }

    processInput(landmarks) {
        const thumb = landmarks[4];
        const indexTip = landmarks[8];
        
        // Pinch Detection
        const dx = thumb.x - indexTip.x;
        const dy = thumb.y - indexTip.y;
        const dist = Math.sqrt(dx*dx + dy*dy);

        // Screen Mapping (Mirrored)
        const rawX = (1 - indexTip.x) * window.innerWidth;
        const rawY = indexTip.y * window.innerHeight;

        // Smoothing
        this.cursorX += (rawX - this.cursorX) * this.lerpAmount;
        this.cursorY += (rawY - this.cursorY) * this.lerpAmount;

        this.updateHUD(this.cursorX, this.cursorY, dist);

        // Logic
        if (dist < this.pinchThreshold) {
            if (!this.isPinching) {
                this.isPinching = true;
                this.tryPickElement(this.cursorX, this.cursorY);
            }
        } else {
            if (this.isPinching) {
                this.isPinching = false;
                this.releaseElement();
            }
        }

        if (this.isPinching && this.draggedElement) {
            this.moveElement(this.cursorX, this.cursorY);
        }
    }

    updateHUD(x, y, dist) {
        // Update Cursor
        this.cursorElement.style.left = `${x}px`;
        this.cursorElement.style.top = `${y}px`;
        
        // Update Rulers
        this.rulerX.style.top = `${y}px`;
        this.rulerY.style.left = `${x}px`;
        this.valX.innerText = `X: ${Math.round(x)}`;
        this.valX.style.left = `${x}px`;
        this.valY.innerText = `Y: ${Math.round(y)}`;
        this.valY.style.top = `${y}px`;

        // Pulse effect when pinching
        if (this.isPinching) {
            this.cursorElement.style.borderColor = '#ffffff';
            this.cursorElement.style.boxShadow = "0 0 20px #00ffcc";
            this.cursorStatus.textContent = "GRABBING (" + Math.round(dist*1000) + ")";
        } else {
            this.cursorElement.style.borderColor = '#00ffcc';
            this.cursorElement.style.boxShadow = "none";
            this.cursorStatus.textContent = "READY (" + Math.round(dist*1000) + ")";
        }
    }

    tryPickElement(x, y) {
        const boxes = document.querySelectorAll('.wireframe');
        for (const box of boxes) {
            const rect = box.getBoundingClientRect();
            if (x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom) {
                this.draggedElement = box;
                this.draggedElement.style.borderColor = "#ffffff";
                this.draggedElement.style.background = "rgba(0, 255, 204, 0.2)";
                this.draggedElement.style.zIndex = "1000001";
                break;
            }
        }
    }

    moveElement(x, y) {
        if (this.draggedElement) {
            this.draggedElement.style.left = `${x}px`;
            this.draggedElement.style.top = `${y}px`;
            this.draggedElement.style.transform = `translate(-50%, -50%) rotateX(${y/10}deg) rotateY(${x/10}deg)`;
        }
    }

    releaseElement() {
        if (this.draggedElement) {
            this.draggedElement.style.borderColor = "#00ffcc";
            this.draggedElement.style.background = "rgba(0, 255, 204, 0.05)";
            this.draggedElement.style.zIndex = "1000000";
            this.draggedElement = null;
        }
    }
}

window.addEventListener('load', () => {
    window.handModule = new HandModule();
});

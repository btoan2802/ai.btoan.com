/**
 * Btoan AI - Hand Interaction Module (FINAL STABLE v5)
 * Simplified interaction for reliable Grab & Drag
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
        
        this.hands = null;
        this.camera = null;
        this.isActive = false;
        
        // Interaction state
        this.isPinching = false;
        this.draggedElement = null;
        this.pinchThreshold = 0.05; 
        
        // Smoothing
        this.cursorX = 0;
        this.cursorY = 0;
        this.lerpAmount = 0.3;

        this.init();
    }

    async init() {
        console.log("HandModule: Initializing...");
        try {
            this.hands = new Hands({
                locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands@0.4/${file}`
            });

            this.hands.setOptions({
                maxNumHands: 1, // Single hand for maximum stability
                modelComplexity: 1,
                minDetectionConfidence: 0.5,
                minTrackingConfidence: 0.5
            });

            this.hands.onResults(this.onResults.bind(this));

            const toggleBtn = document.getElementById('toggleHandMode');
            if (toggleBtn) toggleBtn.onclick = () => this.toggle();
            
        } catch (e) {
            console.error("HandModule Init Error:", e);
        }
    }

    async toggle() {
        if (this.isActive) this.stop();
        else await this.start();
    }

    async start() {
        this.overlayElement.style.display = 'block';
        this.statusElement.textContent = "STARTING...";
        
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
            this.statusElement.textContent = "ACTIVE";
        } catch (err) {
            this.statusElement.textContent = "CAM_ERR";
            console.error(err);
        }
    }

    stop() {
        if (this.camera) this.camera.stop();
        this.isActive = false;
        this.overlayElement.style.display = 'none';
        this.cursorElement.style.display = 'none';
        this.releaseElement();
    }

    onResults(results) {
        this.canvasCtx.save();
        this.canvasCtx.clearRect(0, 0, this.canvasElement.width, this.canvasElement.height);
        
        if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
            const landmarks = results.multiHandLandmarks[0];
            
            // Draw skeleton
            window.drawConnectors(this.canvasCtx, landmarks, window.HAND_CONNECTIONS, { color: '#00ffcc', lineWidth: 2 });
            window.drawLandmarks(this.canvasCtx, landmarks, { color: '#ffffff', lineWidth: 1, radius: 2 });

            this.processInput(landmarks);
        } else {
            this.isPinching = false;
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

        // Mapping (Mirrored)
        const rawX = (1 - indexTip.x) * window.innerWidth;
        const rawY = indexTip.y * window.innerHeight;

        // Smoothing
        this.cursorX += (rawX - this.cursorX) * this.lerpAmount;
        this.cursorY += (rawY - this.cursorY) * this.lerpAmount;

        this.updateCursorHUD(this.cursorX, this.cursorY, dist);

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

    updateCursorHUD(x, y, dist) {
        this.cursorElement.style.left = `${x}px`;
        this.cursorElement.style.top = `${y}px`;
        
        if (this.isPinching) {
            this.cursorElement.style.borderColor = "#ffffff";
            this.cursorElement.style.transform = "scale(0.8)";
            this.cursorStatus.textContent = "GRABBING";
        } else {
            this.cursorElement.style.borderColor = "#00ffcc";
            this.cursorElement.style.transform = "scale(1)";
            this.cursorStatus.textContent = "READY";
        }
    }

    tryPickElement(x, y) {
        const boxes = document.querySelectorAll('.demo-box');
        for (const box of boxes) {
            const rect = box.getBoundingClientRect();
            if (x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom) {
                this.draggedElement = box;
                this.draggedElement.style.boxShadow = "0 0 30px #00ffcc";
                this.draggedElement.style.zIndex = "1000001";
                break;
            }
        }
    }

    moveElement(x, y) {
        if (this.draggedElement) {
            this.draggedElement.style.left = `${x}px`;
            this.draggedElement.style.top = `${y}px`;
        }
    }

    releaseElement() {
        if (this.draggedElement) {
            this.draggedElement.style.boxShadow = "none";
            this.draggedElement.style.zIndex = "1000000";
            this.draggedElement = null;
        }
    }
}

window.addEventListener('load', () => {
    window.handModule = new HandModule();
});

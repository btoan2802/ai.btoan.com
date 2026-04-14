/**
 * Btoan AI - Hand Interaction Module
 * Real-time hand tracking and gesture recognition using MediaPipe
 */

class HandModule {
    constructor() {
        this.videoElement = document.getElementById('hand-video');
        this.canvasElement = document.getElementById('hand-canvas');
        this.canvasCtx = this.canvasElement.getContext('2d');
        this.statusElement = document.getElementById('hand-status');
        this.overlayElement = document.getElementById('hand-overlay');
        this.cursorElement = document.getElementById('hand-cursor');
        this.targetElement = document.getElementById('hand-demo-target');
        
        this.hands = null;
        this.camera = null;
        this.isActive = false;
        
        // Interaction state
        this.isPinching = false;
        this.draggedElement = null;
        this.pinchThreshold = 0.05; // Relative distance
        
        // Smoothing
        this.cursorX = 0;
        this.cursorY = 0;
        this.lerpAmount = 0.3;

        this.init();
    }

    async init() {
        this.hands = new Hands({
            locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`
        });

        this.hands.setOptions({
            maxNumHands: 1,
            modelComplexity: 1,
            minDetectionConfidence: 0.5,
            minTrackingConfidence: 0.5
        });

        this.hands.onResults(this.onResults.bind(this));

        // UI Listeners
        document.getElementById('toggleHandMode').addEventListener('click', () => this.toggle());
    }

    async toggle() {
        if (this.isActive) {
            this.stop();
        } else {
            await this.start();
        }
    }

    async start() {
        this.overlayElement.style.display = 'block';
        this.statusElement.textContent = "Loading camera...";
        
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
            this.statusElement.textContent = "Active";
            this.cursorElement.style.display = 'block';
        } catch (err) {
            console.error(err);
            this.statusElement.textContent = "Error: " + err.message;
            alert("Không thể mở camera. Vui lòng cấp quyền.");
        }
    }

    stop() {
        if (this.camera) this.camera.stop();
        this.isActive = false;
        this.overlayElement.style.display = 'none';
        this.cursorElement.style.display = 'none';
        this.draggedElement = null;
        this.isPinching = false;
    }

    onResults(results) {
        this.canvasCtx.save();
        this.canvasCtx.clearRect(0, 0, this.canvasElement.width, this.canvasElement.height);
        
        if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
            const landmarks = results.multiHandLandmarks[0];
            
            // Draw skeleton
            window.drawConnectors(this.canvasCtx, landmarks, window.HAND_CONNECTIONS, { color: '#00FF00', lineWidth: 5 });
            window.drawLandmarks(this.canvasCtx, landmarks, { color: '#FF0000', lineWidth: 2 });

            this.processGestures(landmarks);
        } else {
            this.isPinching = false;
            this.releaseElement();
        }
        
        this.canvasCtx.restore();
    }

    processGestures(landmarks) {
        // Landmark 4: Thumb Tip, Landmark 8: Index Tip
        const thumb = landmarks[4];
        const index = landmarks[8];
        
        // Calculate distance for Pinch
        const dx = thumb.x - index.x;
        const dy = thumb.y - index.y;
        const distance = Math.sqrt(dx*dx + dy*dy);

        // Map index finger to screen
        // Mirror the X coordinate because webcam is mirrored
        const rawX = (1 - index.x) * window.innerWidth;
        const rawY = index.y * window.innerHeight;

        // Smooth cursor
        this.cursorX += (rawX - this.cursorX) * this.lerpAmount;
        this.cursorY += (rawY - this.cursorY) * this.lerpAmount;

        this.updateCursor(this.cursorX, this.cursorY);

        // Detect Pinch
        if (distance < this.pinchThreshold) {
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

    updateCursor(x, y) {
        this.cursorElement.style.left = `${x}px`;
        this.cursorElement.style.top = `${y}px`;
        this.cursorElement.style.borderColor = this.isPinching ? '#00ff00' : '#ff00ff';
        this.cursorElement.style.transform = `scale(${this.isPinching ? 0.8 : 1})`;
    }

    tryPickElement(x, y) {
        const boxes = document.querySelectorAll('.demo-box');
        for (const box of boxes) {
            const rect = box.getBoundingClientRect();
            if (x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom) {
                this.draggedElement = box;
                this.draggedElement.style.boxShadow = "0 0 40px #00ff00";
                this.draggedElement.style.zIndex = "1000001";
                this.draggedElement.style.transform = "translate(-50%, -50%) scale(1.1)";
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
            this.draggedElement.style.boxShadow = "0 10px 20px rgba(0,0,0,0.2)";
            this.draggedElement.style.transform = "translate(-50%, -50%) scale(1)";
            this.draggedElement.style.zIndex = "1000000";
            this.draggedElement = null;
        }
    }
}

// Global initialization
window.addEventListener('load', () => {
    window.handModule = new HandModule();
});

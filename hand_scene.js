/**
 * Btoan AI - Professional Hand Scene v5.0
 * Advanced Materials & Finalization Animations
 */

class HandObject {
    constructor(id, type, bounds) {
        this.id = id;
        this.type = type;
        
        // Final Bounds from Extrusion
        this.width = bounds.w;
        this.height = bounds.h;
        this.x = bounds.x + this.width / 2;
        this.y = bounds.y + this.height / 2;
        
        this.rotationX = 0;
        this.rotationY = 0;
        this.rotationZ = 0;
        this.scale = 1;
        
        this.vx = 0;
        this.vy = 0;
        this.currentScale = 0.5; // Start small for pop-in
        this.targetScale = 1.0;
        
        this.state = 'idle';
        this.grabbedBy = [];

        this.init();
    }

    init() {
        this.el = document.createElement('div');
        this.el.id = `obj-${this.id}`;
        this.el.className = `hand-object ${this.type}`;
        this.el.style.cssText = `
            position: absolute; width: ${this.width}px; height: ${this.height}px;
            left: 0; top: 0; transform-style: preserve-3d; pointer-events: auto;
        `;
        
        this.el.innerHTML = `
            <div class="obj-content" style="position:absolute; inset:0; 
                background: rgba(0, 255, 204, 0.05); backdrop-filter: blur(10px);
                border: 1px solid rgba(0, 255, 204, 0.4); border-radius: 8px;
                box-shadow: 0 10px 30px rgba(0,0,0,0.5), inset 0 0 20px rgba(0,255,204,0.1);
                transition: border 0.3s, box-shadow 0.3s, background 0.3s;">
                <div style="position:absolute; top:10px; left:10px; font-size:9px; color:#00ffcc; opacity:0.6; font-family:monospace;">
                    ${this.type.toUpperCase()}_${Math.floor(this.id % 1000)}
                </div>
                <div class="glow-edge" style="position:absolute; inset:-1px; border:1px solid #00ffcc; opacity:0; transition:0.3s;"></div>
            </div>
        `;

        document.getElementById('hand-stage').appendChild(this.el);
        
        // Settle animation
        setTimeout(() => { this.currentScale = 1.05; setTimeout(() => { this.currentScale = 1.0; }, 200); }, 50);
    }

    update() {
        this.currentScale += (this.targetScale - this.currentScale) * 0.15;
        
        if (this.state === 'idle') {
            this.x += this.vx; this.y += this.vy;
            this.vx *= 0.95; this.vy *= 0.95;
            // Hover-like breathing
            this.rotationY = Math.sin(Date.now() / 1500) * 2;
        }

        this.applyTransform();
    }

    applyTransform() {
        this.el.style.transform = `translate(-50%, -50%) translate3d(${this.x}px, ${this.y}px, 0) rotateX(${this.rotationX}deg) rotateY(${this.rotationY}deg) rotateZ(${this.rotationZ}deg) scale(${this.currentScale})`;
    }

    setHover(isHover) {
        if (this.grabbedBy.length > 0) return;
        this.targetScale = isHover ? 1.1 : 1.0;
        const content = this.el.querySelector('.obj-content');
        content.style.background = isHover ? 'rgba(0, 255, 204, 0.1)' : 'rgba(0, 255, 204, 0.05)';
        content.style.borderColor = isHover ? '#00ffcc' : 'rgba(0, 255, 204, 0.4)';
        this.el.querySelector('.glow-edge').style.opacity = isHover ? '0.5' : '0';
    }
}

class HandScene {
    constructor() {
        this.objects = [];
        this.initPlayground();
    }

    initPlayground() {
        const stage = document.getElementById('hand-stage');
        if (!stage) return;
        stage.innerHTML = '';
        this.objects = [];
    }

    spawnObject(type, bounds) {
        const obj = new HandObject(Date.now(), type, bounds);
        this.objects.push(obj);
        return obj;
    }

    getObjectAt(x, y) {
        let closest = null;
        let minDist = 120;
        for (const obj of this.objects) {
            const d = Math.sqrt(Math.pow(obj.x - x, 2) + Math.pow(obj.y - y, 2));
            if (d < minDist) { minDist = d; closest = obj; }
        }
        return closest;
    }

    update() {
        for (const obj of this.objects) obj.update();
    }
}

window.handScene = new HandScene();

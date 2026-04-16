/**
 * Btoan AI - Professional Hand Scene v5.5
 * Refined Interactive Playground: Glassmorphism, Floating objects, and Centralized Seeds.
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
        this.currentScale = 0.6; // Start small for pop-in
        this.targetScale = 1.0;
        
        this.state = 'idle';
        this.grabbedBy = []; // 'left' or 'right'

        this.init();
    }

    init() {
        this.el = document.createElement('div');
        this.el.id = `obj-${this.id}`;
        this.el.className = `hand-object ${this.type}`;
        this.el.style.cssText = `position:absolute; width:${this.width}px; height:${this.height}px; left:0; top:0; transform-style:preserve-3d;`;
        
        this.el.innerHTML = `
            <div class="obj-content" style="position:absolute; inset:0; 
                background: rgba(255, 255, 255, 0.02); backdrop-filter: blur(12px);
                border: 1px solid rgba(0, 255, 204, 0.2); border-radius: 12px;
                box-shadow: 0 10px 40px rgba(0,0,0,0.4), inset 0 0 10px rgba(0,255,204,0.05);
                transition: border 0.4s, box-shadow 0.4s;">
                <div style="position:absolute; bottom:10px; right:12px; font-size:9px; color:#00ffcc; opacity:0.3; font-family:monospace;">
                    L_ID: ${Math.floor(this.id % 999)}
                </div>
            </div>
        `;

        document.getElementById('hand-stage').appendChild(this.el);
        setTimeout(() => { this.currentScale = 1.0; }, 50);
    }

    update() {
        this.currentScale += (this.targetScale - this.currentScale) * 0.15;
        
        if (this.state === 'idle') {
            this.x += this.vx; this.y += this.vy;
            this.vx *= 0.95; this.vy *= 0.95;
            
            // Subtle floating motion
            const t = Date.now() / 2000;
            this.rotationY = Math.sin(t) * 3;
            this.rotationX = Math.cos(t) * 2;
        }

        this.applyTransform();
    }

    applyTransform() {
        this.el.style.transform = `translate(-50%, -50%) translate3d(${this.x}px, ${this.y}px, 0) rotateX(${this.rotationX}deg) rotateY(${this.rotationY}deg) rotateZ(${this.rotationZ}deg) scale(${this.currentScale})`;
    }

    setHover(isHover) {
        if (this.grabbedBy.length > 0) return;
        this.targetScale = isHover ? 1.12 : 1.0;
        const content = this.el.querySelector('.obj-content');
        content.style.borderColor = isHover ? 'rgba(0, 255, 204, 0.8)' : 'rgba(0, 255, 204, 0.2)';
        content.style.boxShadow = isHover ? '0 0 30px rgba(0, 255, 204, 0.3)' : '0 10px 40px rgba(0,0,0,0.4)';
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
        
        // Initial setup
        this.spawnObject('box', { x: window.innerWidth / 2, y: window.innerHeight * 0.4, w: 200, h: 120 });
    }

    spawnObject(type, bounds) {
        const obj = new HandObject(Date.now(), type, bounds);
        this.objects.push(obj);
        return obj;
    }

    getObjectAt(x, y) {
        let closest = null;
        let minDist = 140;
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

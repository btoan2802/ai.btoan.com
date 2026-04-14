/**
 * Btoan AI - Professional Hand Scene v4.5
 * Glassmorphism materials and advanced visual polish.
 */

class HandObject {
    constructor(id, type, config) {
        this.id = id;
        this.type = type;
        this.isNew = config.isNew || false;
        
        // Physical state
        this.x = config.x || window.innerWidth / 2;
        this.y = config.y || window.innerHeight / 2;
        this.z = 0;
        this.rotationX = config.rotationX || 0;
        this.rotationY = config.rotationY || 0;
        this.rotationZ = config.rotationZ || 0;
        this.scale = config.scale || 1;
        
        this.vx = 0;
        this.vy = 0;
        this.targetScale = this.scale;
        this.currentScale = this.isNew ? 0.1 : this.scale;
        
        this.state = 'idle';
        this.grabbedBy = [];

        this.init();
    }

    init() {
        this.el = document.createElement('div');
        this.el.id = `obj-${this.id}`;
        this.el.className = `hand-object ${this.type}`;
        this.el.style.position = 'absolute';
        this.el.style.width = `${this.config?.width || 140}px`;
        this.el.style.height = `${this.config?.height || 140}px`;
        this.el.style.left = '0';
        this.el.style.top = '0';
        this.el.style.transformStyle = 'preserve-3d';
        
        // Premium Material: Glassmorphism + Glow
        this.el.innerHTML = `
            <div class="obj-content" style="position:absolute; inset:0; 
                background: rgba(0, 255, 204, 0.03);
                backdrop-filter: blur(8px);
                border: 1px solid rgba(0, 255, 204, 0.3);
                border-radius: ${this.type === 'sphere' ? '50%' : '12px'};
                box-shadow: inset 0 0 20px rgba(0,255,204,0.1), 0 5px 15px rgba(0,0,0,0.3);
                transition: border 0.3s, box-shadow 0.3s;
                overflow: hidden;">
                
                <!-- Inner Detail -->
                <div style="position:absolute; top:8px; left:10px; font-size:8px; color:#00ffcc; opacity:0.5; font-family:monospace;">
                    NODE_ID: ${this.id}<br>TYPE: ${this.type.toUpperCase()}
                </div>
                
                <!-- Scanning Effect Line -->
                <div class="scan-line" style="position:absolute; top:-100%; left:0; width:100%; height:20%; background:linear-gradient(to bottom, transparent, rgba(0,255,204,0.2), transparent); animation: scan 3s infinite linear;"></div>
            </div>
        `;

        document.getElementById('hand-stage').appendChild(this.el);
        
        if (this.isNew) {
            setTimeout(() => { this.targetScale = 1.0; }, 50);
        }
    }

    update() {
        // Smooth scale transition
        this.currentScale += (this.targetScale - this.currentScale) * 0.15;
        
        if (this.state === 'idle') {
            this.x += this.vx;
            this.y += this.vy;
            this.vx *= 0.96;
            this.vy *= 0.96;
            
            // Subtle floating motion
            this.rotationY += Math.sin(Date.now() / 1000) * 0.1;
        }

        this.applyTransform();
    }

    applyTransform() {
        this.el.style.transform = `translate(-50%, -50%) translate3d(${this.x}px, ${this.y}px, ${this.z}px) rotateX(${this.rotationX}deg) rotateY(${this.rotationY}deg) rotateZ(${this.rotationZ}deg) scale(${this.currentScale})`;
    }

    setHover(isHover) {
        if (this.grabbedBy.length > 0) return;
        this.targetScale = isHover ? 1.15 : 1.0;
        const content = this.el.querySelector('.obj-content');
        content.style.borderColor = isHover ? 'rgba(0, 255, 204, 0.8)' : 'rgba(0, 255, 204, 0.3)';
        content.style.boxShadow = isHover ? '0 0 30px rgba(0, 255, 204, 0.5), inset 0 0 20px rgba(0,255,204,0.2)' : '0 5px 15px rgba(0,0,0,0.3)';
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
        
        // Initial set of objects
        this.spawnObject('box', { x: window.innerWidth * 0.25, y: window.innerHeight * 0.3 });
        this.spawnObject('sphere', { x: window.innerWidth * 0.75, y: window.innerHeight * 0.35 });
    }

    spawnObject(type, config) {
        const id = Date.now() + Math.random();
        const obj = new HandObject(id, type, config);
        this.objects.push(obj);
        return obj;
    }

    getObjectAt(x, y) {
        let closest = null;
        let minDist = 120;
        for (const obj of this.objects) {
            const d = Math.sqrt(Math.pow(obj.x - x, 2) + Math.pow(obj.y - y, 2));
            if (d < minDist) {
                minDist = d; closest = obj;
            }
        }
        return closest;
    }

    update() {
        for (const obj of this.objects) obj.update();
    }
}

// Global scan animation
const style = document.createElement('style');
style.textContent = `@keyframes scan { from { top: -100%; } to { top: 150%; } }`;
document.head.appendChild(style);

window.handScene = new HandScene();

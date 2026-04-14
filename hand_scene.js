/**
 * Btoan AI - Professional Hand Scene v4.0
 * Handles interactable objects, animations, and visual polish.
 */

class HandObject {
    constructor(id, type, config) {
        this.id = id;
        this.type = type; // 'box', 'sphere', 'panel'
        this.el = null;
        this.config = config;
        
        // Physical state
        this.x = config.x || window.innerWidth / 2;
        this.y = config.y || window.innerHeight / 2;
        this.z = 0;
        this.rotationX = 0;
        this.rotationY = 0;
        this.rotationZ = 0;
        this.scale = 1;
        
        // Velocity for inertia
        this.vx = 0;
        this.vy = 0;
        this.targetScale = 1;
        this.currentScale = 1;
        
        // Interaction state
        this.state = 'idle'; // 'idle', 'hover', 'grabbed_single', 'grabbed_dual'
        this.grabbedBy = []; // ['left', 'right']

        this.init();
    }

    init() {
        this.el = document.createElement('div');
        this.el.id = `obj-${this.id}`;
        this.el.className = `hand-object ${this.type}`;
        this.el.style.position = 'absolute';
        this.el.style.width = `${this.config.width || 120}px`;
        this.el.style.height = `${this.config.height || 120}px`;
        this.el.style.left = '0';
        this.el.style.top = '0';
        this.el.style.transformStyle = 'preserve-3d';
        
        // Inner content for wireframe/glow
        this.el.innerHTML = `
            <div class="obj-content" style="position:absolute; inset:0; border:2px solid #00ffcc; background:rgba(0,255,204,0.02); box-shadow:0 0 15px rgba(0,255,204,0.1); transition: all 0.3s;">
                <div style="position:absolute; top:5px; left:8px; font-size:9px; color:#00ffcc; opacity:0.6;">${this.config.label || 'OBJECT'}</div>
                <div class="glow-layer" style="position:absolute; inset:-2px; border:1px solid #00ffcc; opacity:0; transition: opacity 0.3s;"></div>
            </div>
        `;

        document.getElementById('hand-stage').appendChild(this.el);
    }

    update(dt) {
        // Physics: Spring Scale
        this.currentScale += (this.targetScale - this.currentScale) * 0.2;
        
        // Inertia (if not grabbed)
        if (this.state === 'idle') {
            this.x += this.vx;
            this.y += this.vy;
            this.vx *= 0.95;
            this.vy *= 0.95;
            
            // Boundary bounce
            if (this.x < 100 || this.x > window.innerWidth - 100) this.vx *= -1;
            if (this.y < 100 || this.y > window.innerHeight - 100) this.vy *= -1;
        }

        this.applyTransform();
    }

    applyTransform() {
        const t = `translate(-50%, -50%) translate3d(${this.x}px, ${this.y}px, ${this.z}px) rotateX(${this.rotationX}deg) rotateY(${this.rotationY}deg) rotateZ(${this.rotationZ}deg) scale(${this.currentScale})`;
        this.el.style.transform = t;
    }

    setHover(isHover) {
        if (this.state.startsWith('grabbed')) return;
        this.state = isHover ? 'hover' : 'idle';
        this.targetScale = isHover ? 1.1 : 1.0;
        this.el.querySelector('.obj-content').style.boxShadow = isHover ? '0 0 30px rgba(0,255,204,0.4)' : '0 0 15px rgba(0,255,204,0.1)';
        this.el.querySelector('.glow-layer').style.opacity = isHover ? '0.5' : '0';
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
        
        // Add varied objects
        this.objects.push(new HandObject(1, 'box', { x: window.innerWidth * 0.3, y: window.innerHeight * 0.4, width: 150, height: 150, label: 'PRIMITIVE_BOX' }));
        this.objects.push(new HandObject(2, 'panel', { x: window.innerWidth * 0.7, y: window.innerHeight * 0.3, width: 220, height: 140, label: 'DATA_PANEL' }));
        this.objects.push(new HandObject(3, 'sphere', { x: window.innerWidth * 0.5, y: window.innerHeight * 0.7, width: 100, height: 100, label: 'CORE_ORB' }));
    }

    getObjectAt(x, y) {
        // Find closest object within reach
        let closest = null;
        let minDist = 150; // Grab radius

        for (const obj of this.objects) {
            const dx = obj.x - x;
            const dy = obj.y - y;
            const dist = Math.sqrt(dx*dx + dy*dy);
            if (dist < minDist) {
                minDist = dist;
                closest = obj;
            }
        }
        return closest;
    }

    update(dt) {
        for (const obj of this.objects) {
            obj.update(dt);
        }
    }
}

window.handScene = new HandScene();

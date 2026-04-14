/**
 * Btoan AI - Interactive 3D Objects Module v2.0
 * Supports 3D Rotation, Independent Dual-Hand Manipulation.
 */

class Interactive3DObject {
    constructor(id, type, x, y, size) {
        this.id = id;
        this.type = type; // 'box', 'panel'
        
        this.w = size || 180;
        this.h = size || 180;
        this.x = x;
        this.y = y;
        
        this.rotationX = 0;
        this.rotationY = 0;
        this.rotationZ = 0;
        this.scale = 1;
        
        this.vx = 0;
        this.vy = 0;
        
        this.state = 'idle';
        this.grabbedBy = []; // ['left', 'right']
        
        this.init();
    }

    init() {
        this.el = document.createElement('div');
        this.el.className = `interactive-3d ${this.type}`;
        this.el.style.cssText = `
            position: absolute; left: 0; top: 0; 
            width: ${this.w}px; height: ${this.h}px;
            pointer-events: auto; transform-style: preserve-3d; z-index: 20;
            display: flex; align-items: center; justify-content: center;
        `;

        this.updateVisuals();
        document.getElementById('shape-container').appendChild(this.el);
    }

    updateVisuals() {
        const glass = `
            width:100%; height:100%; position:absolute; inset:0;
            background: rgba(0,255,204,0.1); border: 2px solid rgba(0,255,204,0.6);
            border-radius:12px; backdrop-filter:blur(10px);
            box-shadow: 0 0 30px rgba(0,255,204,0.2);
            display:flex; align-items:center; justify-content:center;
            color:#00ffcc; font-size:10px; font-weight:900; letter-spacing:2px;
        `;
        
        if (this.type === 'box') {
            // Simplified 3D cube
            this.el.innerHTML = `
                <div style="${glass} transform: translateZ(40px);">FRONT</div>
                <div style="${glass} transform: translateZ(-40px) rotateY(180deg); opacity:0.5;">BACK</div>
                <div style="${glass} transform: translateX(40px) rotateY(90deg); width:80px; left:50px;">SIDE</div>
                <div style="${glass} transform: translateX(-40px) rotateY(-90deg); width:80px; left:50px;">SIDE</div>
            `;
        } else {
            this.el.innerHTML = `<div style="${glass}">TRANSFORM_PANEL</div>`;
        }
    }

    update() {
        if (this.state === 'idle') {
            this.x += this.vx; this.y += this.vy;
            this.vx *= 0.95; this.vy *= 0.95;
            // Float
            this.rotationY += Math.sin(Date.now() / 2000) * 0.2;
        }
        this.applyTransform();
    }

    applyTransform() {
        this.el.style.transform = `translate(-50%, -50%) translate3d(${this.x}px, ${this.y}px, 0) rotateX(${this.rotationX}deg) rotateY(${this.rotationY}deg) rotateZ(${this.rotationZ}deg) scale(${this.scale})`;
    }

    setHover(isHover) {
        if (this.grabbedBy.length > 0) return;
        this.scale = isHover ? 1.15 : 1.0;
    }
}

class ShapeManager {
    constructor() {
        this.shapes = [];
        this.reset();
        this.loop();
    }

    reset() {
        this.shapes.forEach(s => s.el.remove());
        this.shapes = [];
        // Spawn standard 3D cubes
        this.spawn('box', window.innerWidth * 0.35, window.innerHeight * 0.5, 140);
        this.spawn('box', window.innerWidth * 0.65, window.innerHeight * 0.5, 140);
    }

    spawn(type, x, y, size) {
        const s = new Interactive3DObject(Date.now() + Math.random(), type, x, y, size);
        this.shapes.push(s);
        return s;
    }

    getShapeAt(x, y) {
        let closest = null;
        let minDist = 120;
        for (const s of this.shapes) {
            const d = Math.sqrt(Math.pow(s.x - x, 2) + Math.pow(s.y - y, 2));
            if (d < minDist) { minDist = d; closest = s; }
        }
        return closest;
    }

    loop() {
        this.shapes.forEach(s => s.update());
        requestAnimationFrame(() => this.loop());
    }
}

window.shapeManager = new ShapeManager();

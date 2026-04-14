/**
 * Btoan AI - Interactive Shapes Module v1.0
 * Handles Circle, Square, Triangle, and Star primitives with stretching logic.
 */

class InteractiveShape {
    constructor(id, type, bounds) {
        this.id = id;
        this.type = type; // 'circle', 'square', 'triangle', 'star'
        
        this.w = bounds.w;
        this.h = bounds.h;
        this.x = bounds.x + this.w / 2;
        this.y = bounds.y + this.h / 2;
        
        this.baseW = this.w;
        this.baseH = this.h;
        
        this.rotation = 0;
        this.scale = 1;
        this.state = 'idle';
        
        this.init();
    }

    init() {
        this.el = document.createElement('div');
        this.el.className = `interactive-shape ${this.type}`;
        this.el.style.cssText = `
            position: absolute; left: 0; top: 0; 
            width: ${this.w}px; height: ${this.h}px;
            pointer-events: auto; transform-style: preserve-3d; z-index: 20;
            display: flex; align-items: center; justify-content: center;
        `;

        this.updateStyle();
        document.getElementById('shape-container').appendChild(this.el);
    }

    updateStyle() {
        const commonStyle = `width:100%; height:100%; filter: drop-shadow(0 0 15px rgba(0,255,204,0.4)); transition: border 0.3s;`;
        
        if (this.type === 'circle') {
            this.el.innerHTML = `<div style="${commonStyle} background: radial-gradient(circle, rgba(0,255,204,0.1) 0%, rgba(0,255,204,0.6) 100%); border-radius:50%; border:2px solid rgba(255,255,255,0.3); backdrop-filter:blur(8px);"></div>`;
        } else if (this.type === 'square') {
            this.el.innerHTML = `<div style="${commonStyle} background: rgba(0,255,204,0.1); border:2px solid rgba(0,255,204,0.8); border-radius:8px; backdrop-filter:blur(8px);"></div>`;
        } else if (this.type === 'triangle') {
            const path = "50% 0%, 0% 100%, 100% 100%";
            this.el.innerHTML = `<div style="${commonStyle} background: rgba(0,255,204,0.2); clip-path: polygon(${path}); border:1px solid #00ffcc;"></div>`;
        } else if (this.type === 'star') {
            const path = "50% 0%, 61% 35%, 98% 35%, 68% 57%, 79% 91%, 50% 70%, 21% 91%, 32% 57%, 2% 35%, 39% 35%";
            this.el.innerHTML = `<div style="${commonStyle} background: rgba(0,255,204,0.3); clip-path: polygon(${path});"></div>`;
        }
    }

    update() {
        this.el.style.width = `${this.w}px`;
        this.el.style.height = `${this.h}px`;
        this.el.style.transform = `translate(-50%, -50%) translate3d(${this.x}px, ${this.y}px, 0) rotate(${this.rotation}deg) scale(${this.scale})`;
    }

    setHover(isHover) {
        if (this.state === 'dragging' || this.state === 'stretching') return;
        this.scale = isHover ? 1.1 : 1.0;
    }
}

class ShapeManager {
    constructor() {
        this.shapes = [];
        this.loop();
    }

    spawn(type, bounds) {
        const s = new InteractiveShape(Date.now(), type, bounds);
        this.shapes.push(s);
        return s;
    }

    getShapeAt(x, y) {
        let closest = null;
        let minDist = 100;
        for (const s of this.shapes) {
            const d = Math.sqrt(Math.pow(s.x - x, 2) + Math.pow(s.y - y, 2));
            if (d < minDist) { minDist = d; closest = s; }
        }
        return closest;
    }

    clearAll() {
        this.shapes.forEach(s => s.el.remove());
        this.shapes = [];
    }

    loop() {
        this.shapes.forEach(s => s.update());
        requestAnimationFrame(() => this.loop());
    }
}

window.shapeManager = new ShapeManager();

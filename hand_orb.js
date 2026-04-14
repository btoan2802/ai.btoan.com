/**
 * Btoan AI - Spirit Orb Module v1.0
 * Interactable floating orbs created via gesture.
 */

class SpiritOrb {
    constructor(id, x, y) {
        this.id = id;
        this.x = x;
        this.y = y;
        this.size = 60;
        
        this.vx = 0;
        this.vy = 0;
        this.targetScale = 1;
        this.currentScale = 0.1;
        
        this.state = 'idle';
        this.grabbedBy = null; // 'left' or 'right'
        
        this.init();
    }

    init() {
        this.el = document.createElement('div');
        this.el.className = 'spirit-orb';
        this.el.style.cssText = `
            position: absolute; width: ${this.size}px; height: ${this.size}px;
            left: 0; top: 0; border-radius: 50%;
            background: radial-gradient(circle at 30% 30%, rgba(255,255,255,0.4) 0%, rgba(0,255,204,0.1) 40%, rgba(0,255,204,0.6) 100%);
            box-shadow: 0 0 30px rgba(0,255,204,0.3), inset 0 0 15px rgba(255,255,255,0.2);
            backdrop-filter: blur(8px); border: 1px solid rgba(255,255,255,0.2);
            pointer-events: auto; transform-style: preserve-3d; z-index: 20;
            transition: box-shadow 0.3s;
        `;
        document.getElementById('orb-container').appendChild(this.el);
        setTimeout(() => this.currentScale = 1, 50);
    }

    update() {
        // Smooth scale
        const scaleVel = (this.targetScale - this.currentScale) * 0.15;
        this.currentScale += scaleVel;

        if (this.state === 'idle') {
            this.x += this.vx; this.y += this.vy;
            this.vx *= 0.96; this.vy *= 0.96;
            
            // Boundary bounce
            if (this.x < 50 || this.x > window.innerWidth - 50) this.vx *= -1;
            if (this.y < 50 || this.y > window.innerHeight - 50) this.vy *= -1;
            
            // Idle float
            this.y += Math.sin(Date.now() / 1000) * 0.5;
        }

        this.applyTransform();
    }

    applyTransform() {
        this.el.style.transform = `translate(-50%, -50%) translate3d(${this.x}px, ${this.y}px, 0) scale(${this.currentScale})`;
    }

    setHover(isHover) {
        if (this.state === 'dragging') return;
        this.targetScale = isHover ? 1.2 : 1.0;
        this.el.style.boxShadow = isHover ? '0 0 50px rgba(0,255,204,0.6)' : '0 0 30px rgba(0,255,204,0.3)';
    }
}

class OrbManager {
    constructor() {
        this.orbs = [];
        this.loop();
    }

    spawn(x, y) {
        const orb = new SpiritOrb(Date.now(), x, y);
        this.orbs.push(orb);
        return orb;
    }

    getOrbAt(x, y) {
        let closest = null;
        let minDist = 80;
        for (const orb of this.orbs) {
            const d = Math.sqrt(Math.pow(orb.x - x, 2) + Math.pow(orb.y - y, 2));
            if (d < minDist) { minDist = d; closest = orb; }
        }
        return closest;
    }

    loop() {
        this.orbs.forEach(orb => orb.update());
        requestAnimationFrame(() => this.loop());
    }
}

window.orbManager = new OrbManager();

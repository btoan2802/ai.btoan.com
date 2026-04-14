/**
 * Btoan AI - Genesis Creation Module v6.0 (STABLE ANCHOR)
 * Implements Multi-Stage State Machine and Axis Stabilization.
 */

class SeedNode {
    constructor(id, x, y) {
        this.id = id;
        this.x = x; this.y = y;
        this.init();
    }
    init() {
        this.el = document.createElement('div');
        this.el.className = 'seed-node';
        this.el.style.cssText = `
            position:absolute; left:${this.x}px; top:${this.y}px;
            width:60px; height:60px; border:1px solid rgba(0,255,204,0.3);
            border-radius:50%; transform:translate(-50%,-50%);
            display:flex; align-items:center; justify-content:center;
            background:rgba(0,255,204,0.02); z-index:100;
        `;
        this.el.innerHTML = `<div style="width:6px; height:6px; background:#00ffcc; border-radius:50%; box-shadow:0 0 15px #00ffcc;"></div>`;
        document.getElementById('hand-stage').appendChild(this.el);
    }
}

class GenesisEngine {
    constructor() {
        this.seeds = [];
        this.activeSession = null; // { seed, handSide, anchorX, anchorY, state, previewEl, tetherEl, dragX, dragY }
        
        // --- STABILITY CONSTANTS ---
        this.MIN_THRESHOLD = 35; // Pixels to drag before preview appears
        this.AXIS_DAMPING = 0.2; // Damping for non-dominant axis jitter
        
        this.initSeeds();
    }

    initSeeds() {
        const stage = document.getElementById('hand-stage'); if (!stage) return;
        this.seeds.push(new SeedNode(1, window.innerWidth * 0.25, window.innerHeight * 0.5));
        this.seeds.push(new SeedNode(2, window.innerWidth * 0.75, window.innerHeight * 0.5));
    }

    getSeedAt(x, y) {
        for (const seed of this.seeds) {
            const d = Math.sqrt(Math.pow(seed.x - x, 2) + Math.pow(seed.y - y, 2));
            if (d < 70) return seed;
        }
        return null;
    }

    startInteraction(seed, handSide, startX, startY) {
        this.activeSession = {
            seed: seed,
            handSide: handSide,
            anchorX: seed.x,
            anchorY: seed.y,
            dragX: seed.x, 
            dragY: seed.y,
            state: 'ARMED', // Hand is pinching, but hasn't moved enough
            previewEl: null,
            tetherEl: null,
            primaryAxis: null // 'h' or 'v'
        };
        seed.el.style.borderColor = "rgba(0,255,204,1)";
        seed.el.style.boxShadow = "0 0 40px rgba(0,255,204,0.4)";
    }

    updateInteraction(rawX, rawY) {
        if (!this.activeSession) return;
        const s = this.activeSession;
        
        // 1. Smooth the drag point internally (Highly damped)
        s.dragX += (rawX - s.dragX) * 0.25;
        s.dragY += (rawY - s.dragY) * 0.25;
        
        const dx = s.dragX - s.anchorX;
        const dy = s.dragY - s.anchorY;
        const dist = Math.sqrt(dx*dx + dy*dy);

        // 2. State Transition: ARMED -> CREATING
        if (s.state === 'ARMED' && dist > this.MIN_THRESHOLD) {
            s.state = 'CREATING';
            s.previewEl = this.createPreview(s.anchorX, s.anchorY);
            s.tetherEl = this.createTether(s.anchorX, s.anchorY);
            // Determine primary axis lock
            s.primaryAxis = Math.abs(dx) > Math.abs(dy) ? 'h' : 'v';
        }

        // 3. Update Geometry (CREATING state only)
        if (s.state === 'CREATING' && s.previewEl) {
            this.updateGeometry(s, dx, dy);
        }
    }

    updateGeometry(s, dx, dy) {
        // --- AXIS STABILIZATION ---
        // If one axis is dominant, dampen the other to prevent wobbly rectangles
        let finalW = dx;
        let finalH = dy;
        
        if (s.primaryAxis === 'h' && Math.abs(dy) < Math.abs(dx) * 0.4) finalH *= this.AXIS_DAMPING;
        if (s.primaryAxis === 'v' && Math.abs(dx) < Math.abs(dy) * 0.4) finalW *= this.AXIS_DAMPING;

        const left = finalW < 0 ? s.anchorX + finalW : s.anchorX;
        const top = finalH < 0 ? s.anchorY + finalH : s.anchorY;
        const absW = Math.abs(finalW);
        const absH = Math.abs(finalH);

        s.previewEl.style.left = `${left}px`;
        s.previewEl.style.top = `${top}px`;
        s.previewEl.style.width = `${absW}px`;
        s.previewEl.style.height = `${absH}px`;
        
        // Update Tether Line
        const line = s.tetherEl.querySelector('line');
        line.setAttribute('x1', s.anchorX);
        line.setAttribute('y1', s.anchorY);
        line.setAttribute('x2', s.anchorX + finalW);
        line.setAttribute('y2', s.anchorY + finalH);
    }

    createPreview(x, y) {
        const el = document.createElement('div');
        el.style.cssText = `
            position:absolute; left:${x}px; top:${y}px; width:0; height:0;
            border:1.5px solid #00ffcc; background:rgba(0,255,204,0.05);
            backdrop-filter:blur(10px); pointer-events:none; border-radius:12px;
            z-index:1000002; box-shadow:0 0 30px rgba(0,255,204,0.1);
        `;
        document.getElementById('hand-stage').appendChild(el);
        return el;
    }

    createTether(x, y) {
        const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
        svg.style.cssText = "position:absolute; inset:0; width:100%; height:100%; pointer-events:none; z-index:1000001;";
        svg.innerHTML = `<line x1="${x}" y1="${y}" x2="${x}" y2="${y}" stroke="#00ffcc" stroke-width="1.5" stroke-dasharray="10,5" opacity="0.3" />`;
        document.getElementById('hand-overlay').appendChild(svg);
        return svg;
    }

    finalize() {
        if (!this.activeSession) return;
        const s = this.activeSession;
        
        if (s.state === 'CREATING' && s.previewEl) {
            const w = parseFloat(s.previewEl.style.width);
            const h = parseFloat(s.previewEl.style.height);
            const x = parseFloat(s.previewEl.style.left);
            const y = parseFloat(s.previewEl.style.top);
            
            if (w > 50 && h > 50) {
                window.handScene.spawnObject('panel', { x: x, y: y, w: w, h: h });
            }
        }
        this.cleanup();
    }

    cleanup() {
        if (!this.activeSession) return;
        const s = this.activeSession;
        if (s.previewEl) s.previewEl.remove();
        if (s.tetherEl) s.tetherEl.remove();
        s.seed.el.style.borderColor = "rgba(0,255,204,0.3)";
        s.seed.el.style.boxShadow = "none";
        this.activeSession = null;
    }

    cancel() { this.cleanup(); }
}

window.genesisEngine = new GenesisEngine();

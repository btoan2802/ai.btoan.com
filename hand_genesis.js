/**
 * Btoan AI - Genesis Creation Module v5.5 (STABLE SINGLE-HAND)
 * Enhanced extrusion from centralized Seed Nodes.
 */

class SeedNode {
    constructor(id, type, x, y) {
        this.id = id; this.type = type;
        this.x = x; this.y = y;
        this.init();
    }

    init() {
        this.el = document.createElement('div');
        this.el.className = 'seed-node';
        this.el.style.cssText = `
            position: absolute; left: ${this.x}px; top: ${this.y}px;
            width: 70px; height: 70px; border: 1px solid rgba(0, 255, 204, 0.4);
            border-radius: 50%; transform: translate(-50%, -50%);
            display: flex; align-items: center; justify-content: center;
            background: rgba(0,255,204,0.05); box-shadow: 0 0 30px rgba(0,255,204,0.1);
            z-index: 1000;
        `;
        this.el.innerHTML = `<div style="color:#00ffcc; font-size:10px; font-weight:900; opacity:0.6;">SEED</div>`;
        document.getElementById('hand-stage').appendChild(this.el);
    }
}

class GenesisEngine {
    constructor() {
        this.seeds = [];
        this.activeGenesis = null;
        this.initSeeds();
    }

    initSeeds() {
        const stage = document.getElementById('hand-stage'); if (!stage) return;
        // Centralized but spaced Seeds
        this.seeds.push(new SeedNode(1, 'panel', window.innerWidth * 0.2, window.innerHeight * 0.5));
        this.seeds.push(new SeedNode(2, 'panel', window.innerWidth * 0.8, window.innerHeight * 0.5));
    }

    getSeedAt(x, y) {
        for (const seed of this.seeds) {
            const d = Math.sqrt(Math.pow(seed.x - x, 2) + Math.pow(seed.y - y, 2));
            if (d < 80) return seed;
        }
        return null;
    }

    startCreation(seed, handSide, x, y) {
        this.activeGenesis = {
            seed: seed,
            handSide: handSide,
            anchorX: seed.x,
            anchorY: seed.y,
            previewEl: this.createPreview(seed.x, seed.y),
            canvas: this.createTetherCanvas()
        };
        seed.el.style.borderColor = "#00ffcc";
        seed.el.style.background = "rgba(0,255,204,0.15)";
    }

    createPreview(x, y) {
        const el = document.createElement('div');
        el.className = 'genesis-preview';
        el.style.cssText = `
            position: absolute; left: ${x}px; top: ${y}px;
            width: 0px; height: 0px; border: 1.5px solid #00ffcc;
            background: rgba(0,255,204,0.1); backdrop-filter: blur(5px);
            pointer-events: none; border-radius: 12px; z-index: 1000002;
            box-shadow: 0 10px 40px rgba(0,255,204,0.2);
        `;
        document.getElementById('hand-stage').appendChild(el);
        return el;
    }

    createTetherCanvas() {
        const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
        svg.style.cssText = "position:absolute; inset:0; width:100%; height:100%; pointer-events:none; z-index:1000001;";
        svg.innerHTML = `<line x1="0" y1="0" x2="0" y2="0" stroke="#00ffcc" stroke-width="1.5" stroke-dasharray="10,5" opacity="0.4" />`;
        document.getElementById('hand-overlay').appendChild(svg);
        return svg;
    }

    updateCreation(x, y) {
        if (!this.activeGenesis) return;
        const g = this.activeGenesis;
        
        // Bounds Calculation
        const w = (x - g.anchorX);
        const h = (y - g.anchorY);
        const left = w < 0 ? x : g.anchorX;
        const top = h < 0 ? y : g.anchorY;
        const absW = Math.max(10, Math.abs(w));
        const absH = Math.max(10, Math.abs(h));
        
        g.previewEl.style.left = `${left}px`;
        g.previewEl.style.top = `${top}px`;
        g.previewEl.style.width = `${absW}px`;
        g.previewEl.style.height = `${absH}px`;
        
        const line = g.canvas.querySelector('line');
        line.setAttribute('x1', g.anchorX);
        line.setAttribute('y1', g.anchorY);
        line.setAttribute('x2', x);
        line.setAttribute('y2', y);
    }

    finalizeCreation(x, y) {
        if (!this.activeGenesis) return;
        const g = this.activeGenesis;
        
        const w = Math.abs(x - g.anchorX);
        const h = Math.abs(y - g.anchorY);
        
        if (w > 40 && h > 40) {
            const left = (x < g.anchorX) ? x : g.anchorX;
            const top = (y < g.anchorY) ? y : g.anchorY;
            window.handScene.spawnObject('panel', { x: left, y: top, w: w, h: h });
        }

        this.cleanup();
    }

    cleanup() {
        if (!this.activeGenesis) return;
        this.activeGenesis.previewEl.remove();
        this.activeGenesis.canvas.remove();
        this.activeGenesis.seed.el.style.borderColor = "rgba(0, 255, 204, 0.4)";
        this.activeGenesis.seed.el.style.background = "rgba(0,255,204,0.05)";
        this.activeGenesis = null;
    }

    cancelCreation() { this.cleanup(); }
}

window.genesisEngine = new GenesisEngine();

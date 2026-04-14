/**
 * Btoan AI - Genesis Creation Module v5.0 (ANCHOR-BASED)
 * True extrusion from static Seed Points.
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
            width: 50px; height: 50px; border: 2px solid #00ffcc;
            border-radius: 50%; transform: translate(-50%, -50%);
            display: flex; align-items: center; justify-content: center;
            background: rgba(0,255,204,0.1); box-shadow: 0 0 20px rgba(0,255,204,0.2);
            z-index: 1000; transition: box-shadow 0.3s;
        `;
        this.el.innerHTML = `<i class="bi bi-plus-lg" style="color:#00ffcc; font-size:20px;"></i>`;
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
        this.seeds.push(new SeedNode(1, 'panel', 100, window.innerHeight / 2));
        this.seeds.push(new SeedNode(2, 'panel', window.innerWidth - 100, window.innerHeight / 2));
    }

    getSeedAt(x, y) {
        for (const seed of this.seeds) {
            const d = Math.sqrt(Math.pow(seed.x - x, 2) + Math.pow(seed.y - y, 2));
            if (d < 60) return seed;
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
            tetherEl: this.createTether(seed.x, seed.y)
        };
        seed.el.style.boxShadow = "0 0 40px #00ffcc";
    }

    createPreview(x, y) {
        const el = document.createElement('div');
        el.className = 'genesis-preview';
        el.style.cssText = `
            position: absolute; left: ${x}px; top: ${y}px;
            width: 0px; height: 0px; border: 1px dashed #00ffcc;
            background: rgba(0,255,204,0.1); transform-origin: top left;
            pointer-events: none; border-radius: 8px; z-index: 1000002;
        `;
        document.getElementById('hand-stage').appendChild(el);
        return el;
    }

    createTether(x, y) {
        const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
        svg.style.cssText = "position:absolute; inset:0; width:100%; height:100%; pointer-events:none; z-index:1000001;";
        svg.innerHTML = `<line x1="${x}" y1="${y}" x2="${x}" y2="${y}" stroke="#00ffcc" stroke-width="1" stroke-dasharray="5,5" opacity="0.6" />`;
        document.getElementById('hand-overlay').appendChild(svg);
        return svg;
    }

    updateCreation(x, y) {
        if (!this.activeGenesis) return;
        const g = this.activeGenesis;
        
        // True Anchor-Based Growth Logic
        // Calculate bounds from static anchor to finger
        const w = (x - g.anchorX);
        const h = (y - g.anchorY);
        
        // Handle negative growth (dragging left/up)
        const left = w < 0 ? x : g.anchorX;
        const top = h < 0 ? y : g.anchorY;
        const absW = Math.abs(w);
        const absH = Math.abs(h);
        
        g.previewEl.style.left = `${left}px`;
        g.previewEl.style.top = `${top}px`;
        g.previewEl.style.width = `${absW}px`;
        g.previewEl.style.height = `${absH}px`;
        
        // Update Tether
        const line = g.tetherEl.querySelector('line');
        line.setAttribute('x2', x);
        line.setAttribute('y2', y);
    }

    finalizeCreation(x, y) {
        if (!this.activeGenesis) return;
        const g = this.activeGenesis;
        
        const w = Math.abs(x - g.anchorX);
        const h = Math.abs(y - g.anchorY);
        
        if (w > 50 && h > 50) {
            const left = (x < g.anchorX) ? x : g.anchorX;
            const top = (y < g.anchorY) ? y : g.anchorY;
            
            window.handScene.spawnObject('panel', { x: left, y: top, w: w, h: h });
        }

        this.cleanup();
    }

    cleanup() {
        if (!this.activeGenesis) return;
        this.activeGenesis.previewEl.remove();
        this.activeGenesis.tetherEl.remove();
        this.activeGenesis.seed.el.style.boxShadow = "0 0 20px rgba(0,255,204,0.2)";
        this.activeGenesis = null;
    }

    cancelCreation() { this.cleanup(); }
}

window.genesisEngine = new GenesisEngine();

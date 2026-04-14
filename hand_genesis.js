/**
 * Btoan AI - Genesis Creation Module v1.0
 * Handles the "Stretch-to-Spawn" interaction from Seed Nodes.
 */

class SeedNode {
    constructor(id, type, x, y) {
        this.id = id;
        this.type = type; // 'box', 'sphere'
        this.x = x;
        this.y = y;
        this.el = null;
        this.init();
    }

    init() {
        this.el = document.createElement('div');
        this.el.className = 'seed-node';
        this.el.style.cssText = `
            position: absolute;
            left: ${this.x}px;
            top: ${this.y}px;
            width: 40px;
            height: 40px;
            border: 2px solid #00ffcc;
            border-radius: 50%;
            transform: translate(-50%, -50%);
            pointer-events: auto;
            display: flex;
            align-items: center;
            justify-content: center;
            background: rgba(0,255,204,0.1);
            box-shadow: 0 0 20px rgba(0,255,204,0.3);
            z-index: 1000;
        `;
        this.el.innerHTML = `<div style="font-size:8px; color:#00ffcc; font-weight:bold;">${this.type.charAt(0).toUpperCase()}</div>`;
        document.getElementById('hand-stage').appendChild(this.el);
    }
}

class GenesisEngine {
    constructor() {
        this.seeds = [];
        this.activeGenesis = null; // { seed, handSide, previewEl }
        this.initSeeds();
    }

    initSeeds() {
        const stage = document.getElementById('hand-stage');
        if (!stage) return;
        
        this.seeds.push(new SeedNode(1, 'box', 150, window.innerHeight / 2));
        this.seeds.push(new SeedNode(2, 'sphere', window.innerWidth - 150, window.innerHeight / 2));
    }

    getSeedAt(x, y) {
        for (const seed of this.seeds) {
            const d = Math.sqrt(Math.pow(seed.x - x, 2) + Math.pow(seed.y - y, 2));
            if (d < 50) return seed;
        }
        return null;
    }

    startCreation(seed, handSide, x, y) {
        this.activeGenesis = {
            seed: seed,
            handSide: handSide,
            startX: x,
            startY: y,
            previewEl: this.createPreview(seed.type, x, y)
        };
        console.log("Genesis: Creation Started", seed.type);
    }

    createPreview(type, x, y) {
        const el = document.createElement('div');
        el.style.cssText = `
            position: absolute;
            left: ${x}px;
            top: ${y}px;
            width: 0px;
            height: 0px;
            border: 1px dashed #00ffcc;
            background: rgba(0,255,204,0.05);
            transform: translate(-50%, -50%);
            pointer-events: none;
            border-radius: ${type === 'sphere' ? '50%' : '8px'};
            z-index: 1000002;
            box-shadow: 0 0 15px rgba(0,255,204,0.2);
        `;
        document.getElementById('hand-stage').appendChild(el);
        return el;
    }

    updateCreation(x, y) {
        if (!this.activeGenesis) return;
        const genesis = this.activeGenesis;
        
        // Calculate size based on distance from start
        const dist = Math.sqrt(Math.pow(x - genesis.startX, 2) + Math.pow(y - genesis.startY, 2));
        const size = Math.max(20, Math.min(dist * 1.5, 300));
        
        genesis.previewEl.style.width = `${size}px`;
        genesis.previewEl.style.height = `${size}px`;
        // Move preview midpoint between seed and hand
        genesis.previewEl.style.left = `${(genesis.startX + x) / 2}px`;
        genesis.previewEl.style.top = `${(genesis.startY + y) / 2}px`;
    }

    finalizeCreation(x, y) {
        if (!this.activeGenesis) return;
        const genesis = this.activeGenesis;
        
        // Final size
        const dist = Math.sqrt(Math.pow(x - genesis.startX, 2) + Math.pow(y - genesis.startY, 2));
        const size = Math.max(50, Math.min(dist * 1.5, 300));
        
        // Spawn Real Object in Scene
        const finalX = (genesis.startX + x) / 2;
        const finalY = (genesis.startY + y) / 2;
        
        window.handScene.spawnObject(genesis.seed.type, {
            x: finalX,
            y: finalY,
            width: size,
            height: size,
            isNew: true
        });

        // Cleanup preview
        genesis.previewEl.remove();
        this.activeGenesis = null;
    }

    cancelCreation() {
        if (this.activeGenesis) {
            this.activeGenesis.previewEl.remove();
            this.activeGenesis = null;
        }
    }
}

window.genesisEngine = new GenesisEngine();

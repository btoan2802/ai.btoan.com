/**
 * Btoan AI - Air Draw Module v3.0
 * Integrated with HandGeometry for shape snapping.
 */

class HandDraw {
    constructor() {
        this.canvas = document.getElementById('draw-canvas');
        this.ctx = this.canvas.getContext('2d');
        this.strokes = [];
        this.currentStroke = null;
        this.resize();
        window.addEventListener('resize', () => this.resize());
    }

    resize() {
        this.canvas.width = window.innerWidth;
        this.canvas.height = window.innerHeight;
        this.render();
    }

    startStroke(x, y) {
        this.currentStroke = { points: [{x, y}] };
        this.strokes.push(this.currentStroke);
    }

    addPoint(x, y) {
        if (!this.currentStroke) return;
        const pts = this.currentStroke.points;
        const last = pts[pts.length - 1];
        if (Math.sqrt(Math.pow(x - last.x, 2) + Math.pow(y - last.y, 2)) > 5) {
            pts.push({x, y});
            this.render();
        }
    }

    endStroke() {
        if (!this.currentStroke || this.currentStroke.points.length < 15) {
            this.strokes.pop();
            this.currentStroke = null;
            this.render();
            return;
        }

        // --- GEOMETRY RECOGNITION ---
        const result = window.handGeometry.classify(this.currentStroke.points);
        if (result) {
            // Success! Create perfect shape
            window.shapeManager.spawn(result.type, result.bounds);
            this.strokes.pop(); // Remove rough drawing
        }

        this.currentStroke = null;
        this.render();
    }

    clear() { this.strokes = []; this.render(); }

    render() {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        this.ctx.lineCap = 'round'; this.ctx.lineJoin = 'round';
        this.ctx.strokeStyle = '#00ffcc'; this.ctx.lineWidth = 3;
        this.ctx.shadowBlur = 8; this.ctx.shadowColor = '#00ffcc';

        this.strokes.forEach(s => {
            if (s.points.length < 2) return;
            this.ctx.beginPath();
            this.ctx.moveTo(s.points[0].x, s.points[0].y);
            for (let i = 1; i < s.points.length - 1; i++) {
                const xc = (s.points[i].x + s.points[i+1].x) / 2;
                const yc = (s.points[i].y + s.points[i+1].y) / 2;
                this.ctx.quadraticCurveTo(s.points[i].x, s.points[i].y, xc, yc);
            }
            this.ctx.stroke();
        });
    }
}

window.handDraw = new HandDraw();

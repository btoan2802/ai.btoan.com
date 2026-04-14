/**
 * Btoan AI - Air Draw Module v4.0
 * Restored for v11.0. Connected to Shape Spawning.
 */
class HandDraw {
    constructor() {
        this.canvas = document.getElementById('draw-canvas');
        if (!this.canvas) return;
        this.ctx = this.canvas.getContext('2d');
        this.strokes = [];
        this.currentStroke = null;
        this.resize();
        window.addEventListener('resize', () => this.resize());
    }
    resize() {
        this.canvas.width = window.innerWidth;
        this.canvas.height = window.innerHeight;
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
        if (!this.currentStroke) return;
        if (this.currentStroke.points.length > 15) {
            const result = window.handGeometry.classify(this.currentStroke.points);
            if (result) {
                window.shapeManager.spawn(result.type, result.bounds.x + result.bounds.w/2, result.bounds.y + result.bounds.h/2, 140);
                this.strokes.pop();
            }
        } else { this.strokes.pop(); }
        this.currentStroke = null;
        this.render();
    }
    clear() { this.strokes = []; this.render(); }
    render() {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        this.ctx.strokeStyle = '#00ffcc'; this.ctx.lineWidth = 2;
        this.strokes.forEach(s => {
            if (s.points.length < 2) return;
            this.ctx.beginPath();
            this.ctx.moveTo(s.points[0].x, s.points[0].y);
            s.points.forEach(p => this.ctx.lineTo(p.x, p.y));
            this.ctx.stroke();
        });
    }
}
window.handDraw = new HandDraw();

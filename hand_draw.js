/**
 * Btoan AI - Air Draw Module v1.0
 * Handles stroke management and multi-layered canvas rendering.
 */

class HandDraw {
    constructor() {
        this.canvas = document.getElementById('draw-canvas');
        this.ctx = this.canvas.getContext('2d');
        
        this.strokes = [];
        this.currentStroke = null;
        
        this.color = '#00ffcc';
        this.lineWidth = 4;
        
        this.resize();
        window.addEventListener('resize', () => this.resize());
    }

    resize() {
        this.canvas.width = window.innerWidth;
        this.canvas.height = window.innerHeight;
        this.render();
    }

    startStroke(x, y) {
        this.currentStroke = {
            points: [{x, y}],
            color: this.color,
            width: this.lineWidth
        };
        this.strokes.push(this.currentStroke);
    }

    addPoint(x, y) {
        if (!this.currentStroke) return;
        
        const points = this.currentStroke.points;
        const lastPoint = points[points.length - 1];
        
        // Minimum distance threshold (3px) to prevent tiny noise points
        const dist = Math.sqrt(Math.pow(x - lastPoint.x, 2) + Math.pow(y - lastPoint.y, 2));
        if (dist > 3) {
            points.push({x, y});
            this.render();
        }
    }

    endStroke() {
        this.currentStroke = null;
    }

    clear() {
        this.strokes = [];
        this.currentStroke = null;
        this.render();
    }

    undo() {
        this.strokes.pop();
        this.render();
    }

    render() {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        
        this.ctx.lineCap = 'round';
        this.ctx.lineJoin = 'round';

        this.strokes.forEach(stroke => {
            if (stroke.points.length < 2) return;
            
            this.ctx.beginPath();
            this.ctx.strokeStyle = stroke.color;
            this.ctx.lineWidth = stroke.width;
            
            // Neon Glow Effect
            this.ctx.shadowBlur = 10;
            this.ctx.shadowColor = stroke.color;
            
            this.ctx.moveTo(stroke.points[0].x, stroke.points[0].y);
            
            // Quadratic Curve for smoothness
            for (let i = 1; i < stroke.points.length - 1; i++) {
                const xc = (stroke.points[i].x + stroke.points[i+1].x) / 2;
                const yc = (stroke.points[i].y + stroke.points[i+1].y) / 2;
                this.ctx.quadraticCurveTo(stroke.points[i].x, stroke.points[i].y, xc, yc);
            }
            
            this.ctx.stroke();
        });
    }
}

window.handDraw = new HandDraw();

/**
 * Btoan AI - Geometry Recognition Module v1.0
 * Pure JS heuristic classifier for basic shapes.
 */

class HandGeometry {
    static classify(points) {
        if (points.length < 10) return null;

        const bbox = this.getBbox(points);
        const center = { x: bbox.x + bbox.w / 2, y: bbox.y + bbox.h / 2 };
        const radius = (bbox.w + bbox.h) / 4;

        // --- 1. CIRCLE CHECK (Distance Variance) ---
        let distVar = 0;
        points.forEach(p => {
            const d = Math.sqrt(Math.pow(p.x - center.x, 2) + Math.pow(p.y - center.y, 2));
            distVar += Math.pow(d - radius, 2);
        });
        const circleScore = Math.sqrt(distVar / points.length) / radius;

        if (circleScore < 0.18) return { type: 'circle', bounds: bbox };

        // --- 2. SQUARE vs TRIANGLE (Convex Hull / Corners simplified) ---
        const aspectRatio = bbox.w / bbox.h;
        const isSquareLike = aspectRatio > 0.7 && aspectRatio < 1.3;

        // Check for Star (Heuristic: alternating high/low distance from center)
        let alternatingPoints = 0;
        let lastD = 0;
        for (let i = 0; i < points.length; i++) {
            const d = Math.sqrt(Math.pow(points[i].x - center.x,2) + Math.pow(points[i].y - center.y,2));
            if (i > 0 && Math.abs(d - lastD) > radius * 0.3) alternatingPoints++;
            lastD = d;
        }

        if (alternatingPoints > 6) return { type: 'star', bounds: bbox };
        if (isSquareLike) return { type: 'square', bounds: bbox };
        
        return { type: 'triangle', bounds: bbox };
    }

    static getBbox(points) {
        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        points.forEach(p => {
            minX = Math.min(minX, p.x); minY = Math.min(minY, p.y);
            maxX = Math.max(maxX, p.x); maxY = Math.max(maxY, p.y);
        });
        return { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
    }
}

window.handGeometry = HandGeometry;

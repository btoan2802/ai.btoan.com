/**
 * Btoan AI - Geometry Recognition Module v1.1
 * Re-implemented for v11.0. Snap rough sketches to 3D.
 */
class HandGeometry {
    static classify(points) {
        if (points.length < 12) return null;
        const bbox = this.getBbox(points);
        const center = { x: bbox.x + bbox.w / 2, y: bbox.y + bbox.h / 2 };
        const radius = (bbox.w + bbox.h) / 4;

        let distVar = 0;
        points.forEach(p => {
            const d = Math.sqrt(Math.pow(p.x - center.x, 2) + Math.pow(p.y - center.y, 2));
            distVar += Math.pow(d - radius, 2);
        });
        const circleScore = Math.sqrt(distVar / points.length) / radius;

        if (circleScore < 0.22) return { type: 'box', bounds: bbox }; // Spawn box for circle
        return { type: 'box', bounds: bbox }; // Default to box for now
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

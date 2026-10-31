// One visible canvas. Street and cursor caches share one geographic projection.
const canvas = document.getElementById('roads');
const ctx = canvas.getContext('2d');
const main = document.getElementById('map');
const base = document.createElement('canvas');
const lit = document.createElement('canvas');
const glow = document.createElement('canvas');
const maskCanvas = document.createElement('canvas');
const motionPreference = matchMedia('(prefers-reduced-motion: reduce)');
const RADIUS = 180;
let width = 0, height = 0, dpr = 1, geometry = [], visible = true;
let pointer = null, pendingFrame = null, resizeTimer;

function project([lon, lat]) {
    // Fit the smaller city view; the highlight uses these exact same pixels.
    const latitudeScale = Math.cos(36.84 * Math.PI / 180);
    const scale = Math.min(width * 0.88 / (0.074 * latitudeScale), height * 0.92 / 0.044);
    return [(lon + 2.4679) * latitudeScale * scale + width * 0.66,
            (36.8402 - lat) * scale + height * 0.53];
}

function resize() {
    const nextDpr = Math.min(window.devicePixelRatio || 1, 2);
    if (width === main.clientWidth && height === main.clientHeight && dpr === nextDpr) return;
    width = main.clientWidth;
    height = main.clientHeight;
    dpr = nextDpr;
    for (const layer of [canvas, base, lit]) {
        layer.width = Math.round(width * dpr);
        layer.height = Math.round(height * dpr);
        layer.getContext('2d').setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    glow.width = glow.height = maskCanvas.width = maskCanvas.height = Math.ceil(RADIUS * 2 * dpr);
    const maskContext = maskCanvas.getContext('2d');
    maskContext.setTransform(dpr, 0, 0, dpr, 0, 0);
    const mask = maskContext.createRadialGradient(RADIUS, RADIUS, 0, RADIUS, RADIUS, RADIUS);
    mask.addColorStop(0, 'rgba(255,255,255,1)');
    mask.addColorStop(0.35, 'rgba(255,255,255,.85)');
    mask.addColorStop(1, 'rgba(255,255,255,0)');
    maskContext.fillStyle = mask;
    maskContext.fillRect(0, 0, RADIUS * 2, RADIUS * 2);
    cacheStreets();
    scheduleDraw();
}

function cacheStreets() {
    const baseContext = base.getContext('2d'), litContext = lit.getContext('2d');
    baseContext.clearRect(0, 0, width, height);
    litContext.clearRect(0, 0, width, height);
    const paths = [new Path2D(), new Path2D()];
    for (const road of geometry) {
        const points = road.coordinates.map(project);
        if (points.every(p => p[0] < 0) || points.every(p => p[0] > width) ||
            points.every(p => p[1] < 0) || points.every(p => p[1] > height)) continue;
        const path = paths[road.major ? 1 : 0];
        points.forEach(([x, y], i) => i ? path.lineTo(x, y) : path.moveTo(x, y));
    }
    for (const [i, path] of paths.entries()) {
        baseContext.strokeStyle = i ? 'rgba(115,217,226,.58)' : 'rgba(110,168,190,.36)';
        baseContext.lineWidth = i ? 1.35 : 0.85;
        baseContext.lineJoin = baseContext.lineCap = 'round';
        baseContext.stroke(path);
        litContext.strokeStyle = i ? '#b8f2d0' : '#77e7f5';
        litContext.lineWidth = i ? 1.8 : 1.2;
        litContext.lineJoin = litContext.lineCap = 'round';
        litContext.stroke(path);
    }
}

function draw() {
    pendingFrame = null;
    if (!visible || document.hidden) return;
    ctx.clearRect(0, 0, width, height);
    ctx.drawImage(base, 0, 0, width, height);
    if (!pointer || motionPreference.matches) return;
    const size = RADIUS * 2;
    const left = pointer.x - RADIUS, top = pointer.y - RADIUS;
    const glowContext = glow.getContext('2d');
    glowContext.setTransform(dpr, 0, 0, dpr, 0, 0);
    glowContext.globalCompositeOperation = 'source-over';
    glowContext.clearRect(0, 0, size, size);
    const x = Math.max(0, left), y = Math.max(0, top);
    const w = Math.min(width, left + size) - x, h = Math.min(height, top + size) - y;
    if (w > 0 && h > 0) {
        glowContext.drawImage(lit, x * dpr, y * dpr, w * dpr, h * dpr, x - left, y - top, w, h);
    }
    glowContext.globalCompositeOperation = 'destination-in';
    glowContext.drawImage(maskCanvas, 0, 0, size, size);
    ctx.drawImage(glow, left, top, size, size);
}

function scheduleDraw() {
    if (pendingFrame === null && visible && !document.hidden) pendingFrame = requestAnimationFrame(draw);
}
main.addEventListener('pointermove', event => {
    if (motionPreference.matches) return;
    const rect = main.getBoundingClientRect();
    pointer = {x: event.clientX - rect.left, y: event.clientY - rect.top};
    scheduleDraw();
}, {passive: true});
main.addEventListener('pointerleave', () => { pointer = null; scheduleDraw(); });
window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(resize, 100);
});
new IntersectionObserver(([entry]) => {
    visible = entry.isIntersecting;
    if (visible) scheduleDraw();
}).observe(main);
document.addEventListener('visibilitychange', scheduleDraw);
motionPreference.addEventListener('change', () => { pointer = null; scheduleDraw(); });
async function loadStreets() {
    try {
        const response = await fetch('assets/data/almeria-roads.geojson');
        if (!response.ok) throw Error('Street data unavailable');
        const data = await response.json();
        for (const feature of data.features || []) {
            const type = feature.properties?.highway || feature.properties?.fclass || '';
            const lines = feature.geometry?.type === 'LineString' ? [feature.geometry.coordinates]
                : feature.geometry?.type === 'MultiLineString' ? feature.geometry.coordinates : [];
            for (const coordinates of lines) {
                if (coordinates.length > 1) geometry.push({coordinates, major: /motorway|trunk|primary|secondary/.test(type)});
            }
        }
        if (!geometry.length) throw Error('No street geometry');
        cacheStreets();
        scheduleDraw();
    } catch (error) {
        console.warn('Unable to load the Almería street data.', error);
    }
}
resize();
loadStreets();

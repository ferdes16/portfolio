// Street geometry is projected and rasterized only on load or resize.
// Pointer frames composite cached layers; no per-segment gradients or shadows.
const canvas = document.getElementById('roads');
const ctx = canvas.getContext('2d');
const main = document.getElementById('map');
const status = document.getElementById('status');
const base = document.createElement('canvas');
const lit = document.createElement('canvas');
const glow = document.createElement('canvas');
// Static streets, cursor glow and traffic use separate visible layers.
base.id = 'street-base';
base.setAttribute('aria-hidden', 'true');
glow.id = 'street-glow';
glow.setAttribute('aria-hidden', 'true');
main.insertBefore(base, canvas);
main.insertBefore(glow, canvas);
const maskCanvas = document.createElement('canvas');
let glowDirty = true;
const motionPreference = matchMedia('(prefers-reduced-motion: reduce)');
const RADIUS = 180;
let width = 0, height = 0, dpr = 1, geometry = [], visible = true;
let pointer = null, pendingFrame = null, resizeTimer;
let trafficNodes = [], vehicles = [], lastTime = null;
let previousVehiclePositions = [];
const vehicleSprite = document.createElement('canvas');
vehicleSprite.width = vehicleSprite.height = 32;
const spriteCtx = vehicleSprite.getContext('2d');
const spriteGlow = spriteCtx.createRadialGradient(16, 16, 0, 16, 16, 16);
spriteGlow.addColorStop(0, '#effff4');
spriteGlow.addColorStop(0.16, '#b8f2d0');
spriteGlow.addColorStop(0.4, 'rgba(165,232,180,.35)');
spriteGlow.addColorStop(1, 'rgba(165,232,180,0)');
spriteCtx.fillStyle = spriteGlow;
spriteCtx.fillRect(0, 0, 32, 32);

function buildTraffic() {
    const nodes = new Map();
    function node(coordinate) {
        const key = coordinate.join(',');
        if (!nodes.has(key)) nodes.set(key, {point: project(coordinate), edges: []});
        return nodes.get(key);
    }
    for (const road of geometry) {
        if (!road.drivable) continue;
        for (let i = 1; i < road.coordinates.length; i++) {
            const a = node(road.coordinates[i - 1]), b = node(road.coordinates[i]);
            const length = Math.hypot(b.point[0] - a.point[0], b.point[1] - a.point[1]);
            if (length < 0.01) continue;
            a.edges.push({to: b, length, major: road.major});
            b.edges.push({to: a, length, major: road.major});
        }
    }
    trafficNodes = [...nodes.values()].filter(n => n.edges.length &&
        n.point[0] >= 0 && n.point[0] <= width && n.point[1] >= 0 && n.point[1] <= height);
    previousVehiclePositions = [];
    vehicles = Array.from({length: Math.min(width < 800 ? 60 : 120, trafficNodes.length)}, () => {
        const from = trafficNodes[Math.floor(Math.random() * trafficNodes.length)];
        const edge = from.edges[Math.floor(Math.random() * from.edges.length)];
        return {from, edge, distance: Math.random() * edge.length, speed: 10 + Math.random() * 15};
    });
    lastTime = null;
}

function drawTraffic(delta) {
    // Only erase the previous sprites, never redraw the full-screen street image.
    for (const [x, y] of previousVehiclePositions) ctx.clearRect(x - 7, y - 7, 14, 14);
    previousVehiclePositions = [];
    for (const vehicle of vehicles) {
        vehicle.distance += delta * vehicle.speed * (vehicle.edge.major ? 1.5 : 1);
        while (vehicle.distance >= vehicle.edge.length) {
            vehicle.distance -= vehicle.edge.length;
            const previous = vehicle.from;
            vehicle.from = vehicle.edge.to;
            const forward = vehicle.from.edges.filter(edge => edge.to !== previous);
            const choices = forward.length ? forward : vehicle.from.edges;
            vehicle.edge = choices[Math.floor(Math.random() * choices.length)];
        }
        const t = vehicle.distance / vehicle.edge.length;
        const a = vehicle.from.point, b = vehicle.edge.to.point;
        const x = a[0] + (b[0] - a[0]) * t, y = a[1] + (b[1] - a[1]) * t;
        if (x >= -5 && x <= width + 5 && y >= -5 && y <= height + 5) {
            ctx.drawImage(vehicleSprite, x - 5, y - 5, 10, 10);
            previousVehiclePositions.push([x, y]);
        }
    }
}

function project([lon, lat]) {
    // A closer, geographically proportioned view of central Almería.
    const scale = Math.max(width / 0.052, height / 0.030);
    return [(lon + 2.4679) * Math.cos(36.84 * Math.PI / 180) * scale + width * 0.66,
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
    glow.width = glow.height = Math.ceil(RADIUS * 2 * dpr);
    glow.style.width = glow.style.height = `${RADIUS * 2}px`;
    maskCanvas.width = maskCanvas.height = glow.width;
    const m = maskCanvas.getContext('2d');
    m.setTransform(dpr, 0, 0, dpr, 0, 0);
    const mask = m.createRadialGradient(RADIUS, RADIUS, 0, RADIUS, RADIUS, RADIUS);
    mask.addColorStop(0, 'rgba(255,255,255,1)');
    mask.addColorStop(0.35, 'rgba(255,255,255,.85)');
    mask.addColorStop(1, 'rgba(255,255,255,0)');
    m.fillStyle = mask;
    m.fillRect(0, 0, RADIUS * 2, RADIUS * 2);
    cacheStreets();
    glowDirty = true;
    scheduleDraw();
}

function cacheStreets() {
    const baseCtx = base.getContext('2d'), litCtx = lit.getContext('2d');
    baseCtx.clearRect(0, 0, width, height);
    litCtx.clearRect(0, 0, width, height);
    const paths = [new Path2D(), new Path2D()];
    let count = 0;
    for (const road of geometry) {
        const points = road.coordinates.map(project);
        // Discard streets wholly outside the viewport, preserving crossing lines.
        if (points.every(p => p[0] < 0) || points.every(p => p[0] > width) ||
            points.every(p => p[1] < 0) || points.every(p => p[1] > height)) continue;
        const path = paths[road.major ? 1 : 0];
        points.forEach(([x, y], i) => i ? path.lineTo(x, y) : path.moveTo(x, y));
        count++;
    }
    for (const [i, path] of paths.entries()) {
        baseCtx.strokeStyle = i ? 'rgba(115,217,226,.48)' : 'rgba(110,168,190,.28)';
        baseCtx.lineWidth = i ? 1.35 : 0.85;
        baseCtx.stroke(path);
        litCtx.strokeStyle = i ? '#b8f2d0' : '#77e7f5';
        litCtx.lineWidth = i ? 1.8 : 1.2;
        litCtx.stroke(path);
    }
    buildTraffic();
    status.textContent = geometry.length
        ? `● ALMERÍA / OPENSTREETMAP · ${count} VÍAS · TRÁFICO SIMULADO`
        : '○ DATOS LOCALES DE ALMERÍA NO DISPONIBLES';
}

function drawGlow() {
    if (!glowDirty) return;
    glowDirty = false;
    glow.style.visibility = pointer ? 'visible' : 'hidden';
    if (!pointer) return;
    const size = RADIUS * 2;
    const left = pointer.x - RADIUS, top = pointer.y - RADIUS;
    glow.style.transform = `translate(${left}px, ${top}px)`;
    const g = glow.getContext('2d');
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.globalCompositeOperation = 'source-over';
    g.clearRect(0, 0, size, size);
    // Copy just the patch intersecting the viewport, in physical source pixels.
    const x = Math.max(0, left), y = Math.max(0, top);
    const w = Math.min(width, left + size) - x, h = Math.min(height, top + size) - y;
    if (w > 0 && h > 0) {
        g.drawImage(lit, x * dpr, y * dpr, w * dpr, h * dpr, x - left, y - top, w, h);
    }
    g.globalCompositeOperation = 'destination-in';
    g.drawImage(maskCanvas, 0, 0, size, size);
}

function draw(timestamp) {
    pendingFrame = null;
    if (!visible || document.hidden) { lastTime = null; return; }
    drawGlow();
    const delta = lastTime === null ? 0 : Math.min((timestamp - lastTime) / 1000, 0.05);
    lastTime = timestamp;
    drawTraffic(motionPreference.matches ? 0 : delta);
    if (vehicles.length && !motionPreference.matches) scheduleDraw();
}

function scheduleDraw() {
    if (pendingFrame === null && visible && !document.hidden) {
        pendingFrame = requestAnimationFrame(draw);
    }
}
main.addEventListener('pointermove', event => {
    if (motionPreference.matches) return;
    const rect = main.getBoundingClientRect();
    pointer = {x: event.clientX - rect.left, y: event.clientY - rect.top};
    glowDirty = true;
    scheduleDraw();
}, {passive: true});
main.addEventListener('pointerleave', () => { pointer = null; glowDirty = true; scheduleDraw(); });
window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(resize, 100);
});
new IntersectionObserver(([entry]) => {
    visible = entry.isIntersecting;
    lastTime = null;
    if (visible) scheduleDraw();
}).observe(main);
document.addEventListener('visibilitychange', () => { lastTime = null; scheduleDraw(); });
motionPreference.addEventListener('change', () => { pointer = null; glowDirty = true; scheduleDraw(); });
function resetView() {
    pointer = null;
    glowDirty = true;
    scheduleDraw();
    window.scrollTo({top: 0, behavior: motionPreference.matches ? 'instant' : 'smooth'});
}
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
                if (coordinates.length > 1) geometry.push({coordinates, drivable: !/^(pedestrian|footway|path|steps|cycleway)$/.test(type), major: /motorway|trunk|primary|secondary/.test(type)});
            }
        }
        cacheStreets();
        glowDirty = true;
        scheduleDraw();
    } catch (error) {
        status.textContent = '○ NO SE HAN PODIDO CARGAR LAS CALLES DE ALMERÍA';
    }
}
resize();
loadStreets();

async function loadChallenge(){const gallery=document.getElementById('challenge-gallery');try{const response=await fetch('data/maps.json');if(!response.ok)throw Error('Maps unavailable');const maps=await response.json();if(!maps.length){gallery.className='empty-state';gallery.textContent='Colección en preparación. Próximamente: mapas, procesos y fuentes del 30 Day Map Challenge.';return}for(const map of maps){const card=document.createElement('article');card.className='card';const image=document.createElement('img');image.src=map.thumbnail;image.alt=map.title;image.loading='lazy';const meta=document.createElement('small');meta.textContent=`${map.edition} / DÍA ${map.day} / ${map.theme}`;const heading=document.createElement('h3');const link=document.createElement('a');link.href=map.url;link.textContent=map.title;heading.append(link);const description=document.createElement('p');description.textContent=map.description;card.append(image,meta,heading,description);gallery.append(card)}}catch(error){gallery.textContent='No se ha podido cargar la colección.'}}loadChallenge();

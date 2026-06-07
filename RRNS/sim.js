// Physics & Simulation State
const state = {
    // Controls
    windowSizeDeg: 90,
    rrRaw: 4.0,
    nsRaw: 5.0,
    zoomFactor: 1.5, // Interactive camera zoom factor
    
    // Computed Metrics
    kappa: 0,
    nsField: 0,
    variance: 0,
    
    // 3D Viewport Rotation
    rotation: {
        x: 0.35, // Pitch
        y: -0.65 // Yaw
    },
    drag: {
        isDragging: false,
        startX: 0,
        startY: 0
    },
    
    // Animation timer
    time: 0
};

// Canvas and contexts references
let canvas3D;
let ctx3D;
let canvasInset;
let ctxInset;

// Setup on load
window.addEventListener('DOMContentLoaded', () => {
    canvas3D = document.getElementById('canvas-3d');
    ctx3D = canvas3D.getContext('2d');
    
    canvasInset = document.getElementById('canvas-circle-inset');
    ctxInset = canvasInset.getContext('2d');
    
    resizeCanvases();
    window.addEventListener('resize', resizeCanvases);
    
    setupEventListeners();
    updatePhysics();
    
    // Start animation loop
    requestAnimationFrame(renderLoop);
});

function resizeCanvases() {
    // Resize main 3D canvas
    const rect3D = canvas3D.parentNode.getBoundingClientRect();
    canvas3D.width = rect3D.width * window.devicePixelRatio;
    canvas3D.height = rect3D.height * window.devicePixelRatio;
    canvas3D.style.width = rect3D.width + 'px';
    canvas3D.style.height = rect3D.height + 'px';
    ctx3D.scale(window.devicePixelRatio, window.devicePixelRatio);
    
    // Resize inset 2D canvas
    const rectInset = canvasInset.parentNode.getBoundingClientRect();
    const padding = 16; 
    const insetW = rectInset.width - padding;
    const insetH = rectInset.height - 35; // account for tag
    canvasInset.width = insetW * window.devicePixelRatio;
    canvasInset.height = insetH * window.devicePixelRatio;
    canvasInset.style.width = insetW + 'px';
    canvasInset.style.height = insetH + 'px';
    ctxInset.scale(window.devicePixelRatio, window.devicePixelRatio);
}

// Event Listeners for inputs, 3D drag, and mouse wheel zoom
function setupEventListeners() {
    const sliderWindow = document.getElementById('slider-window-size');
    sliderWindow.addEventListener('input', (e) => {
        state.windowSizeDeg = parseInt(e.target.value);
        document.getElementById('val-window-size').textContent = state.windowSizeDeg;
        updatePhysics();
    });

    const sliderRR = document.getElementById('slider-rr-charge');
    sliderRR.addEventListener('input', (e) => {
        state.rrRaw = parseFloat(e.target.value) / 10;
        document.getElementById('val-rr-raw').textContent = state.rrRaw.toFixed(1);
        updatePhysics();
    });

    const sliderNS = document.getElementById('slider-ns-field');
    sliderNS.addEventListener('input', (e) => {
        state.nsRaw = parseFloat(e.target.value) / 10;
        document.getElementById('val-ns-raw').textContent = state.nsRaw.toFixed(1);
        updatePhysics();
    });

    const sliderZoom = document.getElementById('slider-zoom');
    sliderZoom.addEventListener('input', (e) => {
        state.zoomFactor = parseFloat(e.target.value) / 10;
        document.getElementById('val-zoom').textContent = state.zoomFactor.toFixed(1);
    });

    // Mouse wheel scroll zoom directly on the main 3D canvas
    canvas3D.addEventListener('wheel', (e) => {
        e.preventDefault();
        const zoomDelta = e.deltaY * -0.0015;
        state.zoomFactor = Math.max(0.5, Math.min(4.0, state.zoomFactor + zoomDelta));
        
        // Sync to UI slider and labels
        document.getElementById('slider-zoom').value = Math.round(state.zoomFactor * 10);
        document.getElementById('val-zoom').textContent = state.zoomFactor.toFixed(1);
    }, { passive: false });

    // 3D drag rotation (drag on main canvas rotates the whole 3D scene)
    const container = canvas3D.parentNode;
    container.addEventListener('mousedown', (e) => {
        state.drag.isDragging = true;
        state.drag.startX = e.clientX;
        state.drag.startY = e.clientY;
    });

    window.addEventListener('mousemove', (e) => {
        if (!state.drag.isDragging) return;
        const dx = e.clientX - state.drag.startX;
        const dy = e.clientY - state.drag.startY;
        
        state.rotation.y += dx * 0.007; // Yaw
        state.rotation.x += dy * 0.007; // Pitch
        
        // Clamp pitch to avoid screen flipping
        state.rotation.x = Math.max(-Math.PI / 2 + 0.05, Math.min(Math.PI / 2 - 0.05, state.rotation.x));
        
        state.drag.startX = e.clientX;
        state.drag.startY = e.clientY;
    });

    window.addEventListener('mouseup', () => {
        state.drag.isDragging = false;
    });

    // Mobile/Tablet Touch support
    container.addEventListener('touchstart', (e) => {
        if (e.touches.length === 1) {
            state.drag.isDragging = true;
            state.drag.startX = e.touches[0].clientX;
            state.drag.startY = e.touches[0].clientY;
        }
    });

    window.addEventListener('touchmove', (e) => {
        if (!state.drag.isDragging || e.touches.length !== 1) return;
        const dx = e.touches[0].clientX - state.drag.startX;
        const dy = e.touches[0].clientY - state.drag.startY;
        
        state.rotation.y += dx * 0.007;
        state.rotation.x += dy * 0.007;
        state.rotation.x = Math.max(-Math.PI / 2 + 0.05, Math.min(Math.PI / 2 - 0.05, state.rotation.x));
        
        state.drag.startX = e.touches[0].clientX;
        state.drag.startY = e.touches[0].clientY;
    });

    window.addEventListener('touchend', () => {
        state.drag.isDragging = false;
    });
}

// Numerical Physics Engine
function updatePhysics() {
    const rr = state.rrRaw;
    const ns = state.nsRaw;
    const theta_rad = (state.windowSizeDeg * Math.PI) / 180;
    
    // Coupling strength kappa
    const kappa = rr * (Math.PI / (theta_rad + 0.1));
    state.kappa = kappa;
    
    // NS background field B_2
    const nsField = ns * 0.3;
    state.nsField = nsField;
    
    // Fluctuation variance σ² = B_2 / kappa
    const variance = (nsField * 15) / (kappa + 0.05);
    state.variance = variance;
    
    // Update metrics readouts
    document.getElementById('val-kappa').textContent = kappa.toFixed(3);
    document.getElementById('val-ns-field').textContent = nsField.toFixed(3);
    document.getElementById('val-variance').textContent = variance.toFixed(4);
}

// ANIMATION LOOP
function renderLoop() {
    state.time += 0.04;
    drawMain3DScene();
    drawInset2DScene();
    requestAnimationFrame(renderLoop);
}

// 1. DRAW MAIN ROTATABLE 3D VIEWPORT
function drawMain3DScene() {
    const w = canvas3D.width / window.devicePixelRatio;
    const h = canvas3D.height / window.devicePixelRatio;
    
    ctx3D.clearRect(0, 0, w, h);
    
    const cx = w * 0.5;
    const cy = h * 0.5;
    
    // Adjust scale factor based on container size and state zoomFactor
    const baseScale = Math.min(w, h) * 0.0022 * state.zoomFactor;
    
    // Setup rotation matrices
    const cosX = Math.cos(state.rotation.x);
    const sinX = Math.sin(state.rotation.x);
    const cosY = Math.cos(state.rotation.y);
    const sinY = Math.sin(state.rotation.y);
    
    // Unified 3D coordinates projection to screen space (centered on cx, cy)
    // Removed the buggy '* 100' coordinate multiplier to keep geometries in-viewport
    function project3D(x, y, z) {
        // Rotate around Y (Yaw)
        let x1 = x * cosY - z * sinY;
        let z1 = x * sinY + z * cosY;
        
        // Rotate around X (Pitch)
        let y2 = y * cosX - z1 * sinX;
        let z2 = y * sinX + z1 * cosX;
        
        const dist = 450;
        const scale = (dist / (dist + z2)) * baseScale;
        return {
            x: cx + x1 * scale,
            y: cy + y2 * scale,
            depth: z2
        };
    }
    
    // 3D rotation vector transformation
    function rotateVector3D(x, y, z) {
        let x1 = x * cosY - z * sinY;
        let z1 = x * sinY + z * cosY;
        let y2 = y * cosX - z1 * sinX;
        let z2 = y * sinX + z1 * cosX;
        return { x: x1, y: y2, z: z2 };
    }
    
    // Define 3D locations for objects
    const circleX3D = -70;
    const circleR3D = 32;
    
    const boxSize3D = {
        minX: 15, maxX: 85,
        minY: -40, maxY: 40,
        minZ: -40, maxZ: 40
    };
    
    // -------------------------------------------------------------
    // A. Draw Circle Window in 3D space
    // -------------------------------------------------------------
    
    // Draw 3D Circle Outline (lying in the Y-Z plane at circleX3D)
    ctx3D.strokeStyle = 'rgba(255, 255, 255, 0.05)';
    ctx3D.lineWidth = 1.5;
    ctx3D.beginPath();
    for (let theta = 0; theta <= Math.PI * 2; theta += 0.1) {
        const pt = project3D(circleX3D, circleR3D * Math.cos(theta), circleR3D * Math.sin(theta));
        if (theta === 0) ctx3D.moveTo(pt.x, pt.y);
        else ctx3D.lineTo(pt.x, pt.y);
    }
    ctx3D.closePath();
    ctx3D.stroke();
    
    // Draw the active Window Arc in 3D
    const windowHalfAngle = (state.windowSizeDeg * Math.PI) / 360;
    const startAngle = -windowHalfAngle;
    const endAngle = windowHalfAngle;
    
    ctx3D.shadowBlur = 15;
    ctx3D.shadowColor = 'hsl(186, 100%, 50%)';
    ctx3D.strokeStyle = 'hsla(186, 100%, 50%, 0.2)';
    ctx3D.lineWidth = 7;
    ctx3D.beginPath();
    for (let theta = startAngle; theta <= endAngle; theta += 0.05) {
        const pt = project3D(circleX3D, circleR3D * Math.cos(theta), circleR3D * Math.sin(theta));
        if (theta === startAngle) ctx3D.moveTo(pt.x, pt.y);
        else ctx3D.lineTo(pt.x, pt.y);
    }
    ctx3D.stroke();
    
    ctx3D.strokeStyle = 'hsl(186, 100%, 50%)';
    ctx3D.lineWidth = 3;
    ctx3D.beginPath();
    for (let theta = startAngle; theta <= endAngle; theta += 0.05) {
        const pt = project3D(circleX3D, circleR3D * Math.cos(theta), circleR3D * Math.sin(theta));
        if (theta === startAngle) ctx3D.moveTo(pt.x, pt.y);
        else ctx3D.lineTo(pt.x, pt.y);
    }
    ctx3D.stroke();
    ctx3D.shadowBlur = 0; // Reset
    
    // Draw glowing boundary orbits on the 3D circle
    const o1Pt = project3D(circleX3D, circleR3D * Math.cos(startAngle), circleR3D * Math.sin(startAngle));
    const o2Pt = project3D(circleX3D, circleR3D * Math.cos(endAngle), circleR3D * Math.sin(endAngle));
    
    ctx3D.shadowBlur = 10;
    ctx3D.shadowColor = 'hsl(317, 100%, 54%)';
    ctx3D.fillStyle = 'hsl(317, 100%, 54%)';
    
    ctx3D.beginPath(); ctx3D.arc(o1Pt.x, o1Pt.y, 5, 0, Math.PI * 2); ctx3D.fill();
    ctx3D.beginPath(); ctx3D.arc(o2Pt.x, o2Pt.y, 5, 0, Math.PI * 2); ctx3D.fill();
    ctx3D.shadowBlur = 0;
    
    // Label for 3D Window
    const windowLabelPt = project3D(circleX3D, circleR3D * 1.35, 0);
    ctx3D.fillStyle = 'hsl(186, 100%, 50%)';
    ctx3D.font = 'bold 10px Outfit';
    ctx3D.fillText('𝔒 (Boundary Window)', windowLabelPt.x - 45, windowLabelPt.y);
    
    // -------------------------------------------------------------
    // B. Draw 𝔅₃-Brane Wireframe Box in 3D
    // -------------------------------------------------------------
    const vertices = [
        {x: boxSize3D.minX, y: boxSize3D.minY, z: boxSize3D.minZ},
        {x: boxSize3D.maxX, y: boxSize3D.minY, z: boxSize3D.minZ},
        {x: boxSize3D.maxX, y: boxSize3D.maxY, z: boxSize3D.minZ},
        {x: boxSize3D.minX, y: boxSize3D.maxY, z: boxSize3D.minZ},
        {x: boxSize3D.minX, y: boxSize3D.minY, z: boxSize3D.maxZ},
        {x: boxSize3D.maxX, y: boxSize3D.minY, z: boxSize3D.maxZ},
        {x: boxSize3D.maxX, y: boxSize3D.maxY, z: boxSize3D.maxZ},
        {x: boxSize3D.minX, y: boxSize3D.maxY, z: boxSize3D.maxZ}
    ];
    
    const projectedVertices = vertices.map(v => project3D(v.x, v.y, v.z));
    
    const edges = [
        [0, 1], [1, 2], [2, 3], [3, 0], // Front face
        [4, 5], [5, 6], [6, 7], [7, 4], // Back face
        [0, 4], [1, 5], [2, 6], [3, 7]  // Connectors
    ];
    
    ctx3D.strokeStyle = 'rgba(265, 89, 63, 0.22)';
    ctx3D.lineWidth = 1.5;
    edges.forEach(edge => {
        const p1 = projectedVertices[edge[0]];
        const p2 = projectedVertices[edge[1]];
        ctx3D.beginPath();
        ctx3D.moveTo(p1.x, p1.y);
        ctx3D.lineTo(p2.x, p2.y);
        ctx3D.stroke();
    });
    
    // Draw internal grid alignment lines on box faces
    ctx3D.strokeStyle = 'rgba(265, 89, 63, 0.05)';
    for (let xVal = boxSize3D.minX + 20; xVal < boxSize3D.maxX; xVal += 20) {
        const p1 = project3D(xVal, boxSize3D.minY, boxSize3D.minZ);
        const p2 = project3D(xVal, boxSize3D.maxY, boxSize3D.minZ);
        ctx3D.beginPath(); ctx3D.moveTo(p1.x, p1.y); ctx3D.lineTo(p2.x, p2.y); ctx3D.stroke();
    }
    
    // Label for 𝔅₃
    const b3LabelPt = project3D(boxSize3D.maxX, boxSize3D.maxY, boxSize3D.maxZ);
    ctx3D.fillStyle = 'rgba(265, 89, 63, 0.7)';
    ctx3D.font = 'bold 11px Outfit';
    ctx3D.fillText('𝔅₃-Brane Volume', b3LabelPt.x - 90, b3LabelPt.y + 12);
    
    // -------------------------------------------------------------
    // C. Draw Thick Glowing String (interpolated in 3D space)
    // -------------------------------------------------------------
    
    // Anchor coordinates in 3D
    const anchor3D = { x: circleX3D, y: circleR3D, z: 0 };
    
    // Mean endpoint inside the 3-brane box
    const meanEndpoint3D = { x: (boxSize3D.minX + boxSize3D.maxX) * 0.5, y: 0, z: 0 };
    
    // Coordinates fluctuations calculations
    const stdDev = Math.sqrt(state.variance);
    const rrAmp = state.rrRaw * 0.15;
    const intAmp = state.rrRaw * stdDev * 0.35;
    
    const timeFactor = state.time * 0.55;
    
    // Fluctuation orbit at string endpoint
    const epFluc = {
        x: (stdDev * (Math.sin(1.8 * timeFactor) + Math.cos(2.8 * timeFactor)) * 6.5) +
           (intAmp * (Math.cos(3.8 * timeFactor) + Math.sin(1.5 * timeFactor)) * 6.5),
        y: (stdDev * (Math.sin(2.2 * timeFactor) + Math.sin(3.5 * timeFactor)) * 6.5) +
           (intAmp * (Math.sin(4.2 * timeFactor) + Math.cos(2.5 * timeFactor)) * 6.5),
        z: (stdDev * (Math.cos(2.0 * timeFactor) + Math.sin(3.1 * timeFactor)) * 6.5) +
           (intAmp * (Math.cos(2.9 * timeFactor) + Math.sin(4.9 * timeFactor)) * 6.5)
    };
    
    const actualEndpoint3D = {
        x: meanEndpoint3D.x + epFluc.x,
        y: meanEndpoint3D.y + epFluc.y,
        z: meanEndpoint3D.z + epFluc.z
    };
    
    // Project endpoint coordinates
    const projectedEndpoint = project3D(actualEndpoint3D.x, actualEndpoint3D.y, actualEndpoint3D.z);
    
    // Discretized 3D string segments calculation
    const numSegments = 80;
    const stringPoints = [];
    
    for (let i = 0; i <= numSegments; i++) {
        const s = i / numSegments;
        
        // Base coordinate interpolator in 3D
        let px = anchor3D.x + (actualEndpoint3D.x - anchor3D.x) * s;
        let py = anchor3D.y + (actualEndpoint3D.y - anchor3D.y) * s;
        let pz = anchor3D.z + (actualEndpoint3D.z - anchor3D.z) * s;
        
        // 1) Subtle pure RR wave: peaks near s = 0.33, vanishes at endpoints
        const envRR = 4 * s * Math.pow(1 - s, 2);
        const rrX = Math.sin(timeFactor * 3.5 - s * 8) * 1.5 * rrAmp;
        const rrY = Math.cos(timeFactor * 2.8 - s * 9) * 1.5 * rrAmp;
        const rrZ = Math.sin(timeFactor * 3.1 - s * 6) * 1.5 * rrAmp;
        
        // 2) Pure NS wave: peaks at s = 1
        const envNS = s * s;
        const nsX = Math.sin(timeFactor * 2.8 - s * 4.5) * 1.8 * stdDev;
        const nsY = Math.cos(timeFactor * 2.3 - s * 5.5) * 1.8 * stdDev;
        const nsZ = Math.sin(timeFactor * 1.9 - s * 3.8) * 1.8 * stdDev;
        
        // 3) RR-NS Interaction: peaks at s = 1
        const envInt = s * s;
        const intX = Math.cos(timeFactor * 4.2 - s * 12) * 1.8 * intAmp;
        const intY = Math.sin(timeFactor * 4.8 - s * 10) * 1.8 * intAmp;
        const intZ = Math.cos(timeFactor * 3.9 - s * 8) * 1.8 * intAmp;
        
        px += rrX * envRR + nsX * envNS + intX * envInt;
        py += rrY * envRR + nsY * envNS + intY * envInt;
        pz += rrZ * envRR + nsZ * envNS + intZ * envInt;
        
        // Project final 3D point to screen coordinates
        const ptScreen = project3D(px, py, pz);
        
        // Choropleth decay profile:
        const lambda = 1.0 + 0.24 * state.rrRaw;
        const chargeDensity = Math.exp(-lambda * s * 4.5);
        
        stringPoints.push({
            x: ptScreen.x,
            y: ptScreen.y,
            density: chargeDensity,
            s: s
        });
    }
    
    // Draw Thick Glowing String (using three pass strokes)
    for (let i = 0; i < stringPoints.length - 1; i++) {
        const p1 = stringPoints[i];
        const p2 = stringPoints[i+1];
        
        const density = (p1.density + p2.density) * 0.5;
        const hue = 180 + p1.s * 130; 
        const alpha = 0.15 + 0.85 * density;
        
        // PASS 1: Outer glow envelope (thick, high transparency)
        ctx3D.strokeStyle = `hsla(${hue}, 100%, 55%, ${alpha * 0.14})`;
        ctx3D.lineWidth = 14;
        ctx3D.beginPath();
        ctx3D.moveTo(p1.x, p1.y);
        ctx3D.lineTo(p2.x, p2.y);
        ctx3D.stroke();
        
        // PASS 2: Glowing core (medium width with drop shadow blur)
        ctx3D.strokeStyle = `hsla(${hue}, 100%, 55%, ${alpha * 0.45})`;
        ctx3D.lineWidth = 7.5;
        ctx3D.shadowBlur = 12 * density;
        ctx3D.shadowColor = `hsla(${hue}, 100%, 55%, 0.75)`;
        ctx3D.beginPath();
        ctx3D.moveTo(p1.x, p1.y);
        ctx3D.lineTo(p2.x, p2.y);
        ctx3D.stroke();
        
        // PASS 3: Bright white/cyan central fiber (thin)
        ctx3D.strokeStyle = `hsla(${hue}, 100%, 85%, ${alpha * 0.95})`;
        ctx3D.lineWidth = 2.5;
        ctx3D.shadowBlur = 0; // Reset
        ctx3D.beginPath();
        ctx3D.moveTo(p1.x, p1.y);
        ctx3D.lineTo(p2.x, p2.y);
        ctx3D.stroke();
    }
    
    // Draw endpoint sphere inside 𝔅₃-brane box
    ctx3D.shadowBlur = 18;
    ctx3D.shadowColor = 'hsl(317, 100%, 54%)';
    ctx3D.fillStyle = 'hsl(317, 100%, 54%)';
    ctx3D.beginPath();
    ctx3D.arc(projectedEndpoint.x, projectedEndpoint.y, 7.5, 0, Math.PI * 2);
    ctx3D.fill();
    ctx3D.shadowBlur = 0; // Reset
    
    ctx3D.fillStyle = 'rgba(255, 255, 255, 0.85)';
    ctx3D.font = 'bold 11px Outfit';
    ctx3D.fillText('Endpoint', projectedEndpoint.x + 12, projectedEndpoint.y + 4);
}

// 2. DRAW FIXED 2D INSET OVERLAY (BOTTOM-LEFT CORNER)
function drawInset2DScene() {
    const w = canvasInset.width / window.devicePixelRatio;
    const h = canvasInset.height / window.devicePixelRatio;
    
    ctxInset.clearRect(0, 0, w, h);
    
    const cx = w / 2;
    const cy = h / 2;
    const r = Math.min(w, h) * 0.38;
    
    // Flat Circle background
    ctxInset.strokeStyle = 'rgba(255, 255, 255, 0.05)';
    ctxInset.lineWidth = 1.5;
    ctxInset.beginPath();
    ctxInset.arc(cx, cy, r, 0, Math.PI * 2);
    ctxInset.stroke();
    
    // Highlighted window arc O
    const windowHalfAngle = (state.windowSizeDeg * Math.PI) / 360;
    const startAngle = -windowHalfAngle;
    const endAngle = windowHalfAngle;
    
    // Draw glowing window arc
    ctxInset.shadowBlur = 10;
    ctxInset.shadowColor = 'hsl(186, 100%, 50%)';
    ctxInset.strokeStyle = 'hsla(186, 100%, 50%, 0.3)';
    ctxInset.lineWidth = 6;
    ctxInset.beginPath();
    ctxInset.arc(cx, cy, r, startAngle, endAngle);
    ctxInset.stroke();
    
    ctxInset.strokeStyle = 'hsl(186, 100%, 50%)';
    ctxInset.lineWidth = 2.5;
    ctxInset.beginPath();
    ctxInset.arc(cx, cy, r, startAngle, endAngle);
    ctxInset.stroke();
    ctxInset.shadowBlur = 0; // Reset
    
    // Boundary orbits
    ctxInset.fillStyle = 'hsl(317, 100%, 54%)';
    
    const o1x = cx + r * Math.cos(startAngle);
    const o1y = cy + r * Math.sin(startAngle);
    const o2x = cx + r * Math.cos(endAngle);
    const o2y = cy + r * Math.sin(endAngle);
    
    ctxInset.beginPath(); ctxInset.arc(o1x, o1y, 4.5, 0, Math.PI * 2); ctxInset.fill();
    ctxInset.beginPath(); ctxInset.arc(o2x, o2y, 4.5, 0, Math.PI * 2); ctxInset.fill();
    
    // Tiny Labels
    ctxInset.fillStyle = 'rgba(255, 255, 255, 0.6)';
    ctxInset.font = 'bold 8px Outfit';
    ctxInset.fillText('𝔬₁', o1x - 12, o1y - 3);
    ctxInset.fillText('𝔬₂', o2x - 12, o2y + 9);
    
    // Show localized RR potential density trace
    const traceIntensity = state.rrRaw * 2.5;
    ctxInset.strokeStyle = 'hsla(186, 100%, 50%, 0.15)';
    ctxInset.lineWidth = traceIntensity;
    ctxInset.beginPath();
    ctxInset.arc(cx, cy, r, startAngle, endAngle);
    ctxInset.stroke();
}

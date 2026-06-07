// Physics & Simulation State
const state = {
    // String 1 Controls (Left)
    windowSizeDeg: 90,
    rrRaw: 4.0,
    
    // String 2 Controls (Right)
    windowSizeDeg2: 90,
    rrRaw2: 4.0,
    
    // Shared Controls
    nsRaw: 5.0,
    zoomFactor: 1.5,
    
    // Computed Metrics
    kappa1: 0,
    kappa2: 0,
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
    
    // Resize inset 2D canvas (wider layout)
    const rectInset = canvasInset.parentNode.getBoundingClientRect();
    const padding = 16; 
    const insetW = rectInset.width - padding;
    const insetH = rectInset.height - 35; 
    canvasInset.width = insetW * window.devicePixelRatio;
    canvasInset.height = insetH * window.devicePixelRatio;
    canvasInset.style.width = insetW + 'px';
    canvasInset.style.height = insetH + 'px';
    ctxInset.scale(window.devicePixelRatio, window.devicePixelRatio);
}

// Event Listeners for inputs, 3D drag, and mouse wheel zoom
function setupEventListeners() {
    // String 1 (Left)
    const sliderWindow1 = document.getElementById('slider-window-size');
    sliderWindow1.addEventListener('input', (e) => {
        state.windowSizeDeg = parseInt(e.target.value);
        document.getElementById('val-window-size').textContent = state.windowSizeDeg;
        updatePhysics();
    });

    const sliderRR1 = document.getElementById('slider-rr-charge');
    sliderRR1.addEventListener('input', (e) => {
        state.rrRaw = parseFloat(e.target.value) / 10;
        document.getElementById('val-rr-raw').textContent = state.rrRaw.toFixed(1);
        updatePhysics();
    });

    // String 2 (Right)
    const sliderWindow2 = document.getElementById('slider-window-size-2');
    sliderWindow2.addEventListener('input', (e) => {
        state.windowSizeDeg2 = parseInt(e.target.value);
        document.getElementById('val-window-size-2').textContent = state.windowSizeDeg2;
        updatePhysics();
    });

    const sliderRR2 = document.getElementById('slider-rr-charge-2');
    sliderRR2.addEventListener('input', (e) => {
        state.rrRaw2 = parseFloat(e.target.value) / 10;
        document.getElementById('val-rr-raw-2').textContent = state.rrRaw2.toFixed(1);
        updatePhysics();
    });

    // Shared Fields
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

    // Scroll zoom on main canvas
    canvas3D.addEventListener('wheel', (e) => {
        e.preventDefault();
        const zoomDelta = e.deltaY * -0.0015;
        state.zoomFactor = Math.max(0.5, Math.min(4.0, state.zoomFactor + zoomDelta));
        
        document.getElementById('slider-zoom').value = Math.round(state.zoomFactor * 10);
        document.getElementById('val-zoom').textContent = state.zoomFactor.toFixed(1);
    }, { passive: false });

    // 3D drag rotation
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
        state.rotation.x = Math.max(-Math.PI / 2 + 0.05, Math.min(Math.PI / 2 - 0.05, state.rotation.x));
        
        state.drag.startX = e.clientX;
        state.drag.startY = e.clientY;
    });

    window.addEventListener('mouseup', () => {
        state.drag.isDragging = false;
    });

    // Touch support
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
    const rr1 = state.rrRaw;
    const rr2 = state.rrRaw2;
    const ns = state.nsRaw;
    
    const theta_rad1 = (state.windowSizeDeg * Math.PI) / 180;
    const theta_rad2 = (state.windowSizeDeg2 * Math.PI) / 180;
    
    // Coupling strength calculations
    const kappa1 = rr1 * (Math.PI / (theta_rad1 + 0.1));
    const kappa2 = rr2 * (Math.PI / (theta_rad2 + 0.1));
    state.kappa1 = kappa1;
    state.kappa2 = kappa2;
    
    // NS field B_2
    const nsField = ns * 0.3;
    state.nsField = nsField;
    
    // Shared Fluctuation Variance stabilized by BOTH strings
    // variance = B_2 / (kappa1 + kappa2)
    const variance = (nsField * 15) / (kappa1 + kappa2 + 0.05);
    state.variance = variance;
    
    // Update metric readouts
    document.getElementById('val-kappa1').textContent = kappa1.toFixed(3);
    document.getElementById('val-kappa2').textContent = kappa2.toFixed(3);
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
    const baseScale = Math.min(w, h) * 0.0022 * state.zoomFactor;
    
    // Rotation matrices
    const cosX = Math.cos(state.rotation.x);
    const sinX = Math.sin(state.rotation.x);
    const cosY = Math.cos(state.rotation.y);
    const sinY = Math.sin(state.rotation.y);
    
    // 3D coordinate projection
    function project3D(x, y, z) {
        let x1 = x * cosY - z * sinY;
        let z1 = x * sinY + z * cosY;
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
    
    // 3D rotation transform
    function rotateVector3D(x, y, z) {
        let x1 = x * cosY - z * sinY;
        let z1 = x * sinY + z * cosY;
        let y2 = y * cosX - z1 * sinX;
        let z2 = y * sinX + z1 * cosX;
        return { x: x1, y: y2, z: z2 };
    }
    
    // Objects positions in 3D coordinate space
    const circleX_L = -70; // Left circle
    const circleX_R = 70;  // Right circle
    const circleR3D = 28;
    
    // Central 𝔅₃-Brane box centered at 0
    const boxSize3D = {
        minX: -22, maxX: 22,
        minY: -35, maxY: 35,
        minZ: -35, maxZ: 35
    };
    
    // -------------------------------------------------------------
    // A. Draw Left & Right Circles in 3D Space
    // -------------------------------------------------------------
    
    // Draw Left Circle (lying in Y-Z plane at circleX_L)
    ctx3D.strokeStyle = 'rgba(255, 255, 255, 0.04)';
    ctx3D.lineWidth = 1.5;
    ctx3D.beginPath();
    for (let theta = 0; theta <= Math.PI * 2; theta += 0.1) {
        const pt = project3D(circleX_L, circleR3D * Math.cos(theta), circleR3D * Math.sin(theta));
        if (theta === 0) ctx3D.moveTo(pt.x, pt.y);
        else ctx3D.lineTo(pt.x, pt.y);
    }
    ctx3D.closePath();
    ctx3D.stroke();
    
    // Draw Left Window Arc (centered at 0 radians, pointing rightwards)
    const wHalf1 = (state.windowSizeDeg * Math.PI) / 360;
    ctx3D.shadowBlur = 12;
    ctx3D.shadowColor = 'hsl(186, 100%, 50%)';
    ctx3D.strokeStyle = 'hsla(186, 100%, 50%, 0.2)';
    ctx3D.lineWidth = 6;
    ctx3D.beginPath();
    for (let t = -wHalf1; t <= wHalf1; t += 0.05) {
        const pt = project3D(circleX_L, circleR3D * Math.cos(t), circleR3D * Math.sin(t));
        if (t === -wHalf1) ctx3D.moveTo(pt.x, pt.y);
        else ctx3D.lineTo(pt.x, pt.y);
    }
    ctx3D.stroke();
    ctx3D.strokeStyle = 'hsl(186, 100%, 50%)';
    ctx3D.lineWidth = 2.5;
    ctx3D.beginPath();
    for (let t = -wHalf1; t <= wHalf1; t += 0.05) {
        const pt = project3D(circleX_L, circleR3D * Math.cos(t), circleR3D * Math.sin(t));
        if (t === -wHalf1) ctx3D.moveTo(pt.x, pt.y);
        else ctx3D.lineTo(pt.x, pt.y);
    }
    ctx3D.stroke();
    ctx3D.shadowBlur = 0;
    
    // Draw Left boundary orbits
    const o1PtL = project3D(circleX_L, circleR3D * Math.cos(-wHalf1), circleR3D * Math.sin(-wHalf1));
    const o2PtL = project3D(circleX_L, circleR3D * Math.cos(wHalf1), circleR3D * Math.sin(wHalf1));
    ctx3D.fillStyle = 'hsl(317, 100%, 54%)';
    ctx3D.beginPath(); ctx3D.arc(o1PtL.x, o1PtL.y, 4, 0, Math.PI * 2); ctx3D.fill();
    ctx3D.beginPath(); ctx3D.arc(o2PtL.x, o2PtL.y, 4, 0, Math.PI * 2); ctx3D.fill();
    
    
    // Draw Right Circle (lying in Y-Z plane at circleX_R)
    ctx3D.strokeStyle = 'rgba(255, 255, 255, 0.04)';
    ctx3D.lineWidth = 1.5;
    ctx3D.beginPath();
    for (let theta = 0; theta <= Math.PI * 2; theta += 0.1) {
        const pt = project3D(circleX_R, circleR3D * Math.cos(theta), circleR3D * Math.sin(theta));
        if (theta === 0) ctx3D.moveTo(pt.x, pt.y);
        else ctx3D.lineTo(pt.x, pt.y);
    }
    ctx3D.closePath();
    ctx3D.stroke();
    
    // Draw Right Window Arc (centered at PI radians, pointing leftwards)
    const wHalf2 = (state.windowSizeDeg2 * Math.PI) / 360;
    ctx3D.shadowBlur = 12;
    ctx3D.shadowColor = 'hsl(317, 100%, 54%)';
    ctx3D.strokeStyle = 'hsla(317, 100%, 54%, 0.2)';
    ctx3D.lineWidth = 6;
    ctx3D.beginPath();
    for (let t = Math.PI - wHalf2; t <= Math.PI + wHalf2; t += 0.05) {
        const pt = project3D(circleX_R, circleR3D * Math.cos(t), circleR3D * Math.sin(t));
        if (t === Math.PI - wHalf2) ctx3D.moveTo(pt.x, pt.y);
        else ctx3D.lineTo(pt.x, pt.y);
    }
    ctx3D.stroke();
    ctx3D.strokeStyle = 'hsl(317, 100%, 54%)';
    ctx3D.lineWidth = 2.5;
    ctx3D.beginPath();
    for (let t = Math.PI - wHalf2; t <= Math.PI + wHalf2; t += 0.05) {
        const pt = project3D(circleX_R, circleR3D * Math.cos(t), circleR3D * Math.sin(t));
        if (t === Math.PI - wHalf2) ctx3D.moveTo(pt.x, pt.y);
        else ctx3D.lineTo(pt.x, pt.y);
    }
    ctx3D.stroke();
    ctx3D.shadowBlur = 0;
    
    // Draw Right boundary orbits
    const o1PtR = project3D(circleX_R, circleR3D * Math.cos(Math.PI - wHalf2), circleR3D * Math.sin(Math.PI - wHalf2));
    const o2PtR = project3D(circleX_R, circleR3D * Math.cos(Math.PI + wHalf2), circleR3D * Math.sin(Math.PI + wHalf2));
    ctx3D.fillStyle = 'hsl(186, 100%, 50%)';
    ctx3D.beginPath(); ctx3D.arc(o1PtR.x, o1PtR.y, 4, 0, Math.PI * 2); ctx3D.fill();
    ctx3D.beginPath(); ctx3D.arc(o2PtR.x, o2PtR.y, 4, 0, Math.PI * 2); ctx3D.fill();
    
    
    // -------------------------------------------------------------
    // B. Draw Central 𝔅₃-Brane Box
    // -------------------------------------------------------------
    const boxVertices = [
        {x: boxSize3D.minX, y: boxSize3D.minY, z: boxSize3D.minZ},
        {x: boxSize3D.maxX, y: boxSize3D.minY, z: boxSize3D.minZ},
        {x: boxSize3D.maxX, y: boxSize3D.maxY, z: boxSize3D.minZ},
        {x: boxSize3D.minX, y: boxSize3D.maxY, z: boxSize3D.minZ},
        {x: boxSize3D.minX, y: boxSize3D.minY, z: boxSize3D.maxZ},
        {x: boxSize3D.maxX, y: boxSize3D.minY, z: boxSize3D.maxZ},
        {x: boxSize3D.maxX, y: boxSize3D.maxY, z: boxSize3D.maxZ},
        {x: boxSize3D.minX, y: boxSize3D.maxY, z: boxSize3D.maxZ}
    ];
    
    const projectedBox = boxVertices.map(v => project3D(v.x, v.y, v.z));
    
    const edges = [
        [0, 1], [1, 2], [2, 3], [3, 0], // Front face
        [4, 5], [5, 6], [6, 7], [7, 4], // Back face
        [0, 4], [1, 5], [2, 6], [3, 7]  // Connectors
    ];
    
    ctx3D.strokeStyle = 'rgba(255, 255, 255, 0.1)';
    ctx3D.lineWidth = 1;
    edges.forEach(edge => {
        const p1 = projectedBox[edge[0]];
        const p2 = projectedBox[edge[1]];
        ctx3D.beginPath();
        ctx3D.moveTo(p1.x, p1.y);
        ctx3D.lineTo(p2.x, p2.y);
        ctx3D.stroke();
    });
    
    // -------------------------------------------------------------
    // C. Draw Strings Meeting at Shared Endpoint
    // -------------------------------------------------------------
    
    // Anchor 3D coordinates
    // String 1 starts on Circle 1 Window center (left side angle 0: cos(0)=1, sin(0)=0)
    const anchor1_3D = { x: circleX_L, y: circleR3D, z: 0 };
    // String 2 starts on Circle 2 Window center (right side angle PI: cos(PI)=-1, sin(PI)=0)
    const anchor2_3D = { x: circleX_R, y: -circleR3D, z: 0 };
    
    // Mean shared endpoint in the center box
    const meanEndpoint3D = { x: 0, y: 0, z: 0 };
    
    // Shared dynamic fluctuations calculations
    const stdDev = Math.sqrt(state.variance);
    const rrAmp1 = state.rrRaw * 0.15;
    const rrAmp2 = state.rrRaw2 * 0.15;
    
    // Interaction coefficients from both strings
    const intAmp1 = state.rrRaw * stdDev * 0.25;
    const intAmp2 = state.rrRaw2 * stdDev * 0.25;
    
    const timeFactor = state.time * 0.55;
    
    // Shared Endpoint 3D Fluctuation: Driven by NS field + interactions from both strings
    const epFluc = {
        x: (stdDev * (Math.sin(1.8 * timeFactor) + Math.cos(2.8 * timeFactor)) * 6.5) +
           (intAmp1 * (Math.cos(3.8 * timeFactor) + Math.sin(1.5 * timeFactor)) * 5.0) +
           (intAmp2 * (Math.sin(3.1 * timeFactor) + Math.cos(4.2 * timeFactor)) * 5.0),
        y: (stdDev * (Math.sin(2.2 * timeFactor) + Math.sin(3.5 * timeFactor)) * 6.5) +
           (intAmp1 * (Math.sin(4.2 * timeFactor) + Math.cos(2.5 * timeFactor)) * 5.0) +
           (intAmp2 * (Math.cos(2.7 * timeFactor) + Math.sin(3.9 * timeFactor)) * 5.0),
        z: (stdDev * (Math.cos(2.0 * timeFactor) + Math.sin(3.1 * timeFactor)) * 6.5) +
           (intAmp1 * (Math.cos(2.9 * timeFactor) + Math.sin(4.9 * timeFactor)) * 5.0) +
           (intAmp2 * (Math.sin(1.9 * timeFactor) + Math.cos(3.3 * timeFactor)) * 5.0)
    };
    
    const sharedEndpoint3D = {
        x: meanEndpoint3D.x + epFluc.x,
        y: meanEndpoint3D.y + epFluc.y,
        z: meanEndpoint3D.z + epFluc.z
    };
    
    const projectedEndpoint = project3D(sharedEndpoint3D.x, sharedEndpoint3D.y, sharedEndpoint3D.z);
    
    // Helper function to build 3D string coordinates and project them
    function buildStringPoints(anchor, endpoint, rrRaw, rrAmp, intAmp) {
        const numSegments = 60;
        const pts = [];
        
        for (let i = 0; i <= numSegments; i++) {
            const s = i / numSegments;
            
            // 3D base linear interpolation
            let px = anchor.x + (endpoint.x - anchor.x) * s;
            let py = anchor.y + (endpoint.y - anchor.y) * s;
            let pz = anchor.z + (endpoint.z - anchor.z) * s;
            
            // Fluctuation components
            const envRR = 4 * s * Math.pow(1 - s, 2);
            const rrX = Math.sin(timeFactor * 3.5 - s * 8) * 1.5 * rrAmp;
            const rrY = Math.cos(timeFactor * 2.8 - s * 9) * 1.5 * rrAmp;
            const rrZ = Math.sin(timeFactor * 3.1 - s * 6) * 1.5 * rrAmp;
            
            const envNS = s * s;
            const nsX = Math.sin(timeFactor * 2.8 - s * 4.5) * 1.8 * stdDev;
            const nsY = Math.cos(timeFactor * 2.3 - s * 5.5) * 1.8 * stdDev;
            const nsZ = Math.sin(timeFactor * 1.9 - s * 3.8) * 1.8 * stdDev;
            
            const envInt = s * s;
            const intX = Math.cos(timeFactor * 4.2 - s * 12) * 1.8 * intAmp;
            const intY = Math.sin(timeFactor * 4.8 - s * 10) * 1.8 * intAmp;
            const intZ = Math.cos(timeFactor * 3.9 - s * 8) * 1.8 * intAmp;
            
            px += rrX * envRR + nsX * envNS + intX * envInt;
            py += rrY * envRR + nsY * envNS + intY * envInt;
            pz += rrZ * envRR + nsZ * envNS + intZ * envInt;
            
            // Project
            const ptScreen = project3D(px, py, pz);
            
            // Decay color density
            const lambda = 1.0 + 0.24 * rrRaw;
            const chargeDensity = Math.exp(-lambda * s * 4.5);
            
            pts.push({
                x: ptScreen.x,
                y: ptScreen.y,
                density: chargeDensity,
                s: s
            });
        }
        return pts;
    }
    
    // Generate both strings points
    const string1 = buildStringPoints(anchor1_3D, sharedEndpoint3D, state.rrRaw, rrAmp1, intAmp1);
    const string2 = buildStringPoints(anchor2_3D, sharedEndpoint3D, state.rrRaw2, rrAmp2, intAmp2);
    
    // Draw string helper
    function drawThickString(points, baseHue) {
        for (let i = 0; i < points.length - 1; i++) {
            const p1 = points[i];
            const p2 = points[i+1];
            
            const density = (p1.density + p2.density) * 0.5;
            const hue = baseHue + p1.s * 80; // slightly shift hue
            const alpha = 0.15 + 0.85 * density;
            
            // PASS 1: Outer glow
            ctx3D.strokeStyle = `hsla(${hue}, 100%, 55%, ${alpha * 0.14})`;
            ctx3D.lineWidth = 14;
            ctx3D.beginPath(); ctx3D.moveTo(p1.x, p1.y); ctx3D.lineTo(p2.x, p2.y); ctx3D.stroke();
            
            // PASS 2: Core glow
            ctx3D.strokeStyle = `hsla(${hue}, 100%, 55%, ${alpha * 0.45})`;
            ctx3D.lineWidth = 7.5;
            ctx3D.shadowBlur = 12 * density;
            ctx3D.shadowColor = `hsla(${hue}, 100%, 55%, 0.75)`;
            ctx3D.beginPath(); ctx3D.moveTo(p1.x, p1.y); ctx3D.lineTo(p2.x, p2.y); ctx3D.stroke();
            
            // PASS 3: Bright core fiber
            ctx3D.strokeStyle = `hsla(${hue}, 100%, 85%, ${alpha * 0.95})`;
            ctx3D.lineWidth = 2.5;
            ctx3D.shadowBlur = 0;
            ctx3D.beginPath(); ctx3D.moveTo(p1.x, p1.y); ctx3D.lineTo(p2.x, p2.y); ctx3D.stroke();
        }
    }
    
    // String 1 (cyan/blue theme, starts at hue 180)
    drawThickString(string1, 180);
    // String 2 (magenta/violet theme, starts at hue 310)
    drawThickString(string2, 310);
    
    // Draw glowing shared Endpoint sphere inside box
    ctx3D.shadowBlur = 20;
    ctx3D.shadowColor = 'hsl(265, 89%, 63%)';
    ctx3D.fillStyle = 'hsl(265, 89%, 63%)';
    ctx3D.beginPath();
    ctx3D.arc(projectedEndpoint.x, projectedEndpoint.y, 8, 0, Math.PI * 2);
    ctx3D.fill();
    ctx3D.shadowBlur = 0;
    
    // Label shared Endpoint
    ctx3D.fillStyle = 'rgba(255, 255, 255, 0.85)';
    ctx3D.font = 'bold 10px Outfit';
    ctx3D.fillText('Shared Endpoint', projectedEndpoint.x - 38, projectedEndpoint.y - 14);
}

// 2. DRAW FIXED DOUBLE 2D CIRCLE INSET OVERLAY (BOTTOM-LEFT CORNER)
function drawInset2DScene() {
    const w = canvasInset.width / window.devicePixelRatio;
    const h = canvasInset.height / window.devicePixelRatio;
    
    ctxInset.clearRect(0, 0, w, h);
    
    // Draw two circles side-by-side
    const circle1CX = w * 0.28;
    const circle2CX = w * 0.72;
    const cy = h * 0.5;
    const r = Math.min(w, h) * 0.32;
    
    // ---- Left Circle 1 ----
    ctxInset.strokeStyle = 'rgba(255, 255, 255, 0.04)';
    ctxInset.lineWidth = 1;
    ctxInset.beginPath(); ctxInset.arc(circle1CX, cy, r, 0, Math.PI * 2); ctxInset.stroke();
    
    const wHalf1 = (state.windowSizeDeg * Math.PI) / 360;
    ctxInset.shadowBlur = 8;
    ctxInset.shadowColor = 'hsl(186, 100%, 50%)';
    ctxInset.strokeStyle = 'hsl(186, 100%, 50%)';
    ctxInset.lineWidth = 2.5;
    ctxInset.beginPath();
    ctxInset.arc(circle1CX, cy, r, -wHalf1, wHalf1);
    ctxInset.stroke();
    ctxInset.shadowBlur = 0;
    
    // orbits
    ctxInset.fillStyle = 'hsl(317, 100%, 54%)';
    const o1x_1 = circle1CX + r * Math.cos(-wHalf1);
    const o1y_1 = cy + r * Math.sin(-wHalf1);
    const o2x_1 = circle1CX + r * Math.cos(wHalf1);
    const o2y_1 = cy + r * Math.sin(wHalf1);
    ctxInset.beginPath(); ctxInset.arc(o1x_1, o1y_1, 3.5, 0, Math.PI * 2); ctxInset.fill();
    ctxInset.beginPath(); ctxInset.arc(o2x_1, o2y_1, 3.5, 0, Math.PI * 2); ctxInset.fill();
    
    // Halo trace showing potential trace intensity
    ctxInset.strokeStyle = 'hsla(186, 100%, 50%, 0.12)';
    ctxInset.lineWidth = state.rrRaw * 2.2;
    ctxInset.beginPath(); ctxInset.arc(circle1CX, cy, r, -wHalf1, wHalf1); ctxInset.stroke();
    
    ctxInset.fillStyle = 'rgba(255, 255, 255, 0.5)';
    ctxInset.font = 'bold 8px Outfit';
    ctxInset.fillText('𝔒₁', circle1CX - 5, cy + 3);
    
    
    // ---- Right Circle 2 ----
    ctxInset.strokeStyle = 'rgba(255, 255, 255, 0.04)';
    ctxInset.lineWidth = 1;
    ctxInset.beginPath(); ctxInset.arc(circle2CX, cy, r, 0, Math.PI * 2); ctxInset.stroke();
    
    const wHalf2 = (state.windowSizeDeg2 * Math.PI) / 360;
    ctxInset.shadowBlur = 8;
    ctxInset.shadowColor = 'hsl(317, 100%, 54%)';
    ctxInset.strokeStyle = 'hsl(317, 100%, 54%)';
    ctxInset.lineWidth = 2.5;
    ctxInset.beginPath();
    ctxInset.arc(circle2CX, cy, r, Math.PI - wHalf2, Math.PI + wHalf2);
    ctxInset.stroke();
    ctxInset.shadowBlur = 0;
    
    // orbits
    ctxInset.fillStyle = 'hsl(186, 100%, 50%)';
    const o1x_2 = circle2CX + r * Math.cos(Math.PI - wHalf2);
    const o1y_2 = cy + r * Math.sin(Math.PI - wHalf2);
    const o2x_2 = circle2CX + r * Math.cos(Math.PI + wHalf2);
    const o2y_2 = cy + r * Math.sin(Math.PI + wHalf2);
    ctxInset.beginPath(); ctxInset.arc(o1x_2, o1y_2, 3.5, 0, Math.PI * 2); ctxInset.fill();
    ctxInset.beginPath(); ctxInset.arc(o2x_2, o2y_2, 3.5, 0, Math.PI * 2); ctxInset.fill();
    
    // Halo trace
    ctxInset.strokeStyle = 'hsla(317, 100%, 54%, 0.12)';
    ctxInset.lineWidth = state.rrRaw2 * 2.2;
    ctxInset.beginPath(); ctxInset.arc(circle2CX, cy, r, Math.PI - wHalf2, Math.PI + wHalf2); ctxInset.stroke();
    
    ctxInset.fillStyle = 'rgba(255, 255, 255, 0.5)';
    ctxInset.font = 'bold 8px Outfit';
    ctxInset.fillText('𝔒₂', circle2CX - 5, cy + 3);
}

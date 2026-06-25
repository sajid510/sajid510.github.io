// ─── NAV SCROLL EFFECT ───
const nav = document.getElementById('main-nav');

window.addEventListener('scroll', () => {
    nav.classList.toggle('scrolled', window.scrollY > 20);
}, { passive: true });

// ─── ACTIVE NAV LINK ON SCROLL ───
const sections = document.querySelectorAll('section[id]');
const navLinks = document.querySelectorAll('.nav-links a[data-section]');
const sectionObserver = new IntersectionObserver(entries => {
    entries.forEach(e => {
        if (e.isIntersecting) {
            const id = e.target.id;
            navLinks.forEach(a => a.classList.toggle('active', a.dataset.section === id));
        }
    });
}, { rootMargin: '-40% 0px -55% 0px' });
sections.forEach(s => sectionObserver.observe(s));

// ─── SCROLL REVEAL ───
const revealObs = new IntersectionObserver(entries => {
    entries.forEach(e => {
        if (e.isIntersecting) {
            e.target.classList.add('revealed');
            revealObs.unobserve(e.target);
        }
    });
}, { threshold: 0.1 });
document.querySelectorAll('.reveal').forEach(el => revealObs.observe(el));

// ─── LiDAR CANVAS ANIMATION ───
const canvas = document.getElementById('lidar');
if (canvas) {
    const ctx = canvas.getContext('2d');

    function resize() {
        const size = canvas.parentElement.clientWidth;
        canvas.width = size;
        canvas.height = size;
    }
    resize();
    window.addEventListener('resize', resize, { passive: true });

    let angle = 0;
    const SPEED = 0.007;
    const points = [];

    // Pre-compute a plausible room boundary (polar, indexed by degree)
    const roomProfile = [];
    for (let d = 0; d < 360; d++) {
        const r = d * Math.PI / 180;
        let dist;
        // Rough rectangular room shape with noise
        const a = Math.abs(Math.cos(r));
        const b = Math.abs(Math.sin(r));
        const base = 1 / (Math.max(a, b) + 0.001);
        const norm = base / (1 / 0.001);
        dist = 0.55 + norm * 0.28 + (Math.random() * 0.04 - 0.02);
        // Add a couple of "obstacles" at specific angles
        if (d >= 50 && d <= 62) dist = Math.min(dist, 0.35 + Math.random() * 0.04);
        if (d >= 195 && d <= 210) dist = Math.min(dist, 0.28 + Math.random() * 0.04);
        if (d >= 290 && d <= 302) dist = Math.min(dist, 0.42 + Math.random() * 0.04);
        roomProfile.push(Math.min(dist, 0.88));
    }

    function getDist(ang) {
        const d = ((ang * 180 / Math.PI) % 360 + 360) % 360;
        return roomProfile[Math.floor(d)] ?? 0.7;
    }

    function draw() {
        const W = canvas.width,
            H = canvas.height;
        const CX = W / 2,
            CY = H / 2;
        const R = Math.min(CX, CY) * 0.88;

        ctx.clearRect(0, 0, W, H);

        // Grid rings
        ctx.lineWidth = 0.5;
        for (let i = 1; i <= 4; i++) {
            ctx.strokeStyle = `rgba(0,212,255,${0.05 + i * 0.01})`;
            ctx.beginPath();
            ctx.arc(CX, CY, R * (i / 4), 0, Math.PI * 2);
            ctx.stroke();
        }

        // Cross-hairs
        ctx.strokeStyle = 'rgba(0,212,255,0.06)';
        ctx.lineWidth = 0.5;
        [
            [CX - R, CY, CX + R, CY],
            [CX, CY - R, CX, CY + R]
        ].forEach(([x1, y1, x2, y2]) => {
            ctx.beginPath();
            ctx.moveTo(x1, y1);
            ctx.lineTo(x2, y2);
            ctx.stroke();
        });

        // Diagonal faint lines
        ctx.strokeStyle = 'rgba(0,212,255,0.03)';
        [
            [CX - R * 0.707, CY - R * 0.707, CX + R * 0.707, CY + R * 0.707],
            [CX + R * 0.707, CY - R * 0.707, CX - R * 0.707, CY + R * 0.707]
        ].forEach(([x1, y1, x2, y2]) => {
            ctx.beginPath();
            ctx.moveTo(x1, y1);
            ctx.lineTo(x2, y2);
            ctx.stroke();
        });

        // Sweep trail — 60 degree cone behind scan line
        const TRAIL = Math.PI / 3;
        const STEPS = 36;
        for (let i = 0; i <= STEPS; i++) {
            const a = angle - TRAIL * (i / STEPS);
            const alpha = Math.pow(1 - i / STEPS, 1.6) * 0.22;
            ctx.strokeStyle = `rgba(0,212,255,${alpha})`;
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(CX, CY);
            ctx.lineTo(CX + R * Math.cos(a), CY + R * Math.sin(a));
            ctx.stroke();
        }

        // Main scan line
        ctx.strokeStyle = 'rgba(0,212,255,0.85)';
        ctx.lineWidth = 1.5;
        ctx.shadowColor = 'rgba(0,212,255,0.5)';
        ctx.shadowBlur = 6;
        ctx.beginPath();
        ctx.moveTo(CX, CY);
        ctx.lineTo(CX + R * Math.cos(angle), CY + R * Math.sin(angle));
        ctx.stroke();
        ctx.shadowBlur = 0;

        // Point cloud
        for (const p of points) {
            const alpha = Math.pow(p.life, 1.5);
            if (alpha < 0.01) continue;
            const size = 1.2 + alpha * 1.6;
            ctx.fillStyle = `rgba(0,212,255,${alpha})`;
            ctx.beginPath();
            ctx.arc(p.x, p.y, size, 0, Math.PI * 2);
            ctx.fill();
        }

        // Center dot
        ctx.fillStyle = 'rgba(0,212,255,0.25)';
        ctx.beginPath();
        ctx.arc(CX, CY, 10, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#00d4ff';
        ctx.beginPath();
        ctx.arc(CX, CY, 3.5, 0, Math.PI * 2);
        ctx.fill();

        // Corner decorations
        const corners = [
            [CX - R, CY - R],
            [CX + R, CY - R],
            [CX + R, CY + R],
            [CX - R, CY + R]
        ];
        ctx.strokeStyle = 'rgba(0,212,255,0.18)';
        ctx.lineWidth = 1.5;
        const cs = 10;
        corners.forEach(([x, y]) => {
            const sx = x < CX ? 1 : -1,
                sy = y < CY ? 1 : -1;
            ctx.beginPath();
            ctx.moveTo(x + sx * cs, y);
            ctx.lineTo(x, y);
            ctx.lineTo(x, y + sy * cs);
            ctx.stroke();
        });
    }

    function tick() {
        const W = canvas.width,
            H = canvas.height;
        const CX = W / 2,
            CY = H / 2;
        const R = Math.min(CX, CY) * 0.88;

        angle += SPEED;

        // Decay existing points
        for (const p of points) p.life -= 0.006;

        // Add new points along the current sweep direction
        const dist = getDist(angle);
        const px = CX + R * dist * Math.cos(angle);
        const py = CY + R * dist * Math.sin(angle);
        points.push({ x: px, y: py, life: 1 });

        // Prune dead points
        let i = points.length;
        while (i--) { if (points[i].life <= 0) points.splice(i, 1); }

        draw();
        requestAnimationFrame(tick);
    }

    tick();
}
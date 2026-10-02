/* ==========================================================================
   FANTASY — a sky kingdom in a dreamy daytime sky
   A pastel sky with two daytime moons and a faint rainbow. Floating islands
   bob in the air, pouring waterfalls into a sea of clouds; the largest carries
   a fairy-tale castle, the others glowing crystals. A dragon glides past now
   and then. A magic circle turns behind the wheel (faster, the other way,
   while it spins; gold on a win) and a small one follows the cursor with a
   sparkle trail. Glowing wisps drift, gather around the cursor, circle the
   wheel while it spins, and swarm the winner.
   ========================================================================== */
(() => {
    const { lerp, ease, rand, softSprite, followTarget, moveSpot, chaseLevel } = window.Stage;

    // Elder Futhark-style runes as line segments in a 0..1 box (x1, y1, x2, y2)
    const RUNES = [
        [[0.3, 0, 0.3, 1], [0.3, 0.15, 0.75, 0], [0.3, 0.45, 0.75, 0.3]],
        [[0.25, 1, 0.25, 0], [0.25, 0, 0.75, 0.35], [0.75, 0.35, 0.75, 1]],
        [[0.3, 0, 0.3, 1], [0.3, 0.25, 0.7, 0.5], [0.7, 0.5, 0.3, 0.75]],
        [[0.3, 0, 0.3, 1], [0.3, 0, 0.75, 0.25], [0.3, 0.3, 0.75, 0.55]],
        [[0.3, 0, 0.3, 1], [0.3, 0, 0.7, 0.25], [0.7, 0.25, 0.3, 0.5], [0.3, 0.5, 0.75, 1]],
        [[0.7, 0, 0.3, 0.5], [0.3, 0.5, 0.7, 1]],
        [[0.2, 0, 0.8, 1], [0.8, 0, 0.2, 1]],
        [[0.5, 0, 0.5, 1], [0.5, 0, 0.2, 0.3], [0.5, 0, 0.8, 0.3]],
        [[0.5, 0, 0.5, 1], [0.5, 0.35, 0.2, 0], [0.5, 0.35, 0.8, 0]],
        [[0.7, 0, 0.3, 0.4], [0.3, 0.4, 0.7, 0.6], [0.7, 0.6, 0.3, 1]],
        [[0.5, 0, 0.8, 0.35], [0.8, 0.35, 0.2, 1], [0.5, 0, 0.2, 0.35], [0.2, 0.35, 0.8, 1]]
    ];

    const WISP_COLORS = ['180, 140, 255', '120, 220, 255', '255, 150, 210', '255, 215, 120'];
    const VIOLET = '112, 70, 210';
    const GOLD = '214, 150, 20';

    let sky = null;               // pre-drawn sky, moons, rainbow and cloud sea
    let islands = [];
    let cloudPuffs = [];
    let motes = [];
    let wisps = [];
    let sparkles = [];
    let dragon = { active: false, next: 0 };
    let sigilSpin = 0, sigilGlow = 0;
    let chase = 0;
    let shimmer = 0;
    let burstDone = false;
    const lastCursor = { x: 0, y: 0 };
    const spot = {};

    // ---------- Drawing helpers ----------
    function strokeRunes(ctx, strokes, size) {
        ctx.beginPath();
        strokes.forEach(([x1, y1, x2, y2]) => { ctx.moveTo(x1 * size, y1 * size); ctx.lineTo(x2 * size, y2 * size); });
        ctx.stroke();
    }

    // A magic circle: rings, a hexagram, and runes around the edge
    function drawSigil(ctx, x, y, r, rot, color, alpha, width) {
        ctx.save();
        ctx.translate(x, y);
        ctx.strokeStyle = `rgba(${color}, ${alpha})`;
        ctx.lineWidth = width;
        ctx.lineCap = 'round';
        ctx.save();
        ctx.rotate(rot);
        [1, 0.86].forEach(k => { ctx.beginPath(); ctx.arc(0, 0, r * k, 0, Math.PI * 2); ctx.stroke(); });
        const count = Math.max(12, Math.round(r / 9));
        const glyph = r * 0.1;
        for (let i = 0; i < count; i++) {
            const a = (i / count) * Math.PI * 2;
            ctx.save();
            ctx.rotate(a);
            ctx.translate(-glyph / 2, -r * 0.93 - glyph / 2);
            strokeRunes(ctx, RUNES[i % RUNES.length], glyph);
            ctx.restore();
        }
        ctx.restore();
        // Inner hexagram turns the other way
        ctx.rotate(-rot * 1.6);
        [0, Math.PI].forEach(offset => {
            ctx.beginPath();
            for (let k = 0; k < 3; k++) {
                const a = offset + (k / 3) * Math.PI * 2 - Math.PI / 2;
                const px = Math.cos(a) * r * 0.84, py = Math.sin(a) * r * 0.84;
                k ? ctx.lineTo(px, py) : ctx.moveTo(px, py);
            }
            ctx.closePath();
            ctx.stroke();
        });
        ctx.beginPath(); ctx.arc(0, 0, r * 0.45, 0, Math.PI * 2); ctx.stroke();
        ctx.restore();
    }

    function drawSparkle(ctx, x, y, size, alpha, color) {
        ctx.fillStyle = `rgba(${color}, ${alpha})`;
        ctx.beginPath();
        ctx.moveTo(x, y - size);
        ctx.lineTo(x + size * 0.25, y - size * 0.25);
        ctx.lineTo(x + size, y);
        ctx.lineTo(x + size * 0.25, y + size * 0.25);
        ctx.lineTo(x, y + size);
        ctx.lineTo(x - size * 0.25, y + size * 0.25);
        ctx.lineTo(x - size, y);
        ctx.lineTo(x - size * 0.25, y - size * 0.25);
        ctx.closePath();
        ctx.fill();
    }

    function addSparkle(x, y, vx, vy, life) {
        if (sparkles.length > 400) sparkles.shift();
        sparkles.push({ x, y, vx, vy, life, age: 0, size: rand(2.5, 5),
                        color: Math.random() < 0.55 ? '230, 170, 40' : '140, 90, 230' });
    }

    function puff(g, x, y, r, color) {
        g.fillStyle = color;
        [[0, 0, 1], [-1, 0.2, 0.75], [1, 0.25, 0.8], [0.45, -0.4, 0.8], [-0.5, -0.3, 0.65]].forEach(([dx, dy, k]) => {
            g.beginPath(); g.arc(x + dx * r, y + dy * r, k * r, 0, Math.PI * 2); g.fill();
        });
    }

    // ---------- Scenery ----------
    function buildSky(s) {
        const { W, H, dpr } = s;
        sky = document.createElement('canvas');
        sky.width = Math.ceil(W * dpr);
        sky.height = Math.ceil(H * dpr);
        const g = sky.getContext('2d');
        g.scale(dpr, dpr);

        const grad = g.createLinearGradient(0, 0, 0, H);
        grad.addColorStop(0, '#a99be6');     // lavender
        grad.addColorStop(0.45, '#eab6d8');  // rose
        grad.addColorStop(0.8, '#ffe0c2');   // peach near the clouds
        g.fillStyle = grad;
        g.fillRect(0, 0, W, H);

        // Sun glow
        const sun = g.createRadialGradient(W * 0.5, H * 0.1, 0, W * 0.5, H * 0.1, Math.max(W, H) * 0.55);
        sun.addColorStop(0, 'rgba(255, 250, 230, 0.9)');
        sun.addColorStop(1, 'rgba(255, 250, 230, 0)');
        g.fillStyle = sun;
        g.fillRect(0, 0, W, H);

        // Faint rainbow arcing over everything
        const rbX = W * 0.5, rbY = H * 1.05, rbR = Math.max(W, H) * 0.78;
        ['255, 90, 90', '255, 170, 60', '255, 230, 90', '120, 220, 120', '90, 170, 255', '160, 110, 240'].forEach((c, i) => {
            g.strokeStyle = `rgba(${c}, 0.14)`;
            g.lineWidth = Math.max(8, W * 0.009);
            g.beginPath(); g.arc(rbX, rbY, rbR - i * g.lineWidth, Math.PI * 1.08, Math.PI * 1.92); g.stroke();
        });

        // Two pale daytime moons
        [[0.86, 0.12, 0.045], [0.93, 0.2, 0.022]].forEach(([fx, fy, fr]) => {
            const r = Math.max(10, Math.min(W, H) * fr);
            g.fillStyle = 'rgba(255, 255, 255, 0.55)';
            g.beginPath(); g.arc(fx * W, fy * H, r, 0, Math.PI * 2); g.fill();
            g.fillStyle = 'rgba(200, 180, 235, 0.35)';
            g.beginPath(); g.arc(fx * W + r * 0.3, fy * H - r * 0.2, r * 0.3, 0, Math.PI * 2); g.fill();
        });

        // Sea of clouds along the bottom (two layers)
        const top = H * 0.8;
        for (let x = -40; x < W + 60; x += 70) puff(g, x + rand(-10, 10), top + rand(0, 20), rand(40, 60), 'rgba(248, 226, 240, 0.95)');
        for (let x = -40; x < W + 60; x += 60) puff(g, x + rand(-10, 10), top + 55 + rand(0, 25), rand(45, 70), '#fff6fb');
        g.fillStyle = '#fff6fb';
        g.fillRect(0, top + 80, W, H);
    }

    // One floating island, drawn once into its own canvas so it can bob
    function buildIsland(w, kind) {
        const h = w * 1.25;
        const c = document.createElement('canvas');
        c.width = Math.ceil(w * 1.4);
        c.height = Math.ceil(h * 1.4);
        const g = c.getContext('2d');
        const cx = c.width / 2, topY = kind === 'castle' ? h * 0.72 : h * 0.3;

        // Rocky underside: a jagged inverted cone in soft lavender stone
        g.fillStyle = '#9486b8';
        g.beginPath();
        g.moveTo(cx - w / 2, topY);
        const steps = 7;
        for (let i = 0; i <= steps; i++) {
            const t = i / steps;
            const x = cx - w / 2 + w * t;
            const depth = Math.sin(t * Math.PI) * w * 0.62 * (0.8 + Math.random() * 0.3);
            g.lineTo(x, topY + depth);
        }
        g.lineTo(cx + w / 2, topY);
        g.closePath();
        g.fill();
        g.fillStyle = 'rgba(70, 55, 110, 0.35)';                  // strata
        for (let i = 1; i < 4; i++) {
            g.fillRect(cx - w * (0.45 - i * 0.07), topY + i * w * 0.08, w * (0.9 - i * 0.14), 3);
        }
        // Hanging vines
        g.strokeStyle = 'rgba(80, 150, 110, 0.7)';
        g.lineWidth = 1.5;
        for (let i = 0; i < 6; i++) {
            const x = cx - w * 0.4 + (w * 0.8) * (i / 5);
            g.beginPath(); g.moveTo(x, topY + 2); g.lineTo(x + rand(-4, 4), topY + rand(w * 0.08, w * 0.22)); g.stroke();
        }
        // Grassy top
        g.fillStyle = '#9fe0b0';
        g.beginPath(); g.ellipse(cx, topY, w / 2, w * 0.07, 0, 0, Math.PI * 2); g.fill();
        g.fillStyle = '#7fcf98';
        g.fillRect(cx - w / 2, topY, w, 3);

        if (kind === 'castle') {
            // Fairy-tale castle: pale walls, many slender spires with violet roofs and gold tips
            const s = w / 260;
            g.fillStyle = '#f5f0ff';
            g.fillRect(cx - 70 * s, topY - 60 * s, 140 * s, 60 * s);
            [[-78, 120, 14], [-45, 150, 16], [-10, 190, 18], [28, 160, 16], [62, 125, 14], [0, 95, 40]].forEach(([dx, th, tw]) => {
                const x = cx + dx * s, wdt = tw * s, top = topY - th * s;
                g.fillStyle = '#f5f0ff';
                g.fillRect(x - wdt / 2, top, wdt, th * s);
                g.fillStyle = '#6a3fb5';
                g.beginPath();
                g.moveTo(x - wdt * 0.75, top);
                g.lineTo(x, top - wdt * 2.4);
                g.lineTo(x + wdt * 0.75, top);
                g.closePath();
                g.fill();
                g.fillStyle = '#e8b53a';
                g.beginPath(); g.arc(x, top - wdt * 2.4, 2.2 * s + 1, 0, Math.PI * 2); g.fill();
                g.fillStyle = 'rgba(80, 50, 140, 0.6)';                  // windows
                g.fillRect(x - 1.5 * s, top + th * s * 0.25, 3 * s, 6 * s);
            });
            g.fillStyle = 'rgba(80, 50, 140, 0.55)';                     // gate
            g.beginPath(); g.arc(cx, topY - 4 * s, 12 * s, Math.PI, 0); g.fill();
            g.fillRect(cx - 12 * s, topY - 4 * s, 24 * s, 4 * s);
            g.fillStyle = '#e0508a';                                     // banner on the tallest spire
            const flagTop = topY - 190 * s - 18 * s * 2.4;
            g.beginPath(); g.moveTo(cx, flagTop); g.lineTo(cx + 20 * s, flagTop + 5 * s); g.lineTo(cx, flagTop + 10 * s); g.fill();
        } else {
            // Glowing crystals and a small tree
            [[-0.25, 0.22, '#9ff0ff'], [0.05, 0.3, '#f5a8e0'], [0.28, 0.18, '#c3a8ff']].forEach(([dx, hh, col]) => {
                const x = cx + dx * w, ch = hh * w;
                g.fillStyle = col;
                g.beginPath();
                g.moveTo(x - ch * 0.18, topY);
                g.lineTo(x, topY - ch);
                g.lineTo(x + ch * 0.18, topY);
                g.closePath();
                g.fill();
                g.fillStyle = 'rgba(255, 255, 255, 0.5)';
                g.beginPath(); g.moveTo(x, topY - ch); g.lineTo(x + ch * 0.18, topY); g.lineTo(x + ch * 0.05, topY); g.closePath(); g.fill();
            });
            g.fillStyle = '#6b5a8e';
            g.fillRect(cx - w * 0.38, topY - w * 0.14, w * 0.03, w * 0.14);
            g.fillStyle = '#e59ad0';                                     // blossom tree
            [[0, -0.2, 0.08], [-0.05, -0.16, 0.06], [0.05, -0.16, 0.06]].forEach(([dx, dy, r]) => {
                g.beginPath(); g.arc(cx - w * 0.365 + dx * w, topY + dy * w, r * w, 0, Math.PI * 2); g.fill();
            });
        }
        return { canvas: c, topY, w };
    }

    function drawDragon(ctx, d, now) {
        const flap = Math.sin(now * 0.006);
        const s = d.size;
        ctx.save();
        ctx.translate(d.x, d.y + Math.sin(now * 0.002) * 6);
        ctx.scale(d.dir, 1);
        ctx.fillStyle = 'rgba(95, 70, 150, 0.5)';
        ctx.strokeStyle = 'rgba(95, 70, 150, 0.5)';
        ctx.lineWidth = s * 0.08;
        ctx.lineCap = 'round';
        // body + neck + tail
        ctx.beginPath(); ctx.ellipse(0, 0, s * 0.35, s * 0.1, 0, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.moveTo(s * 0.3, -s * 0.02); ctx.quadraticCurveTo(s * 0.5, -s * 0.18, s * 0.62, -s * 0.12); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(s * 0.62, -s * 0.12); ctx.lineTo(s * 0.74, -s * 0.08); ctx.lineTo(s * 0.62, -s * 0.05); ctx.fill();
        ctx.beginPath(); ctx.moveTo(-s * 0.3, 0); ctx.quadraticCurveTo(-s * 0.6, s * 0.12, -s * 0.85, -s * 0.02); ctx.stroke();
        // wings
        [-1, 1].forEach(side => {
            ctx.beginPath();
            ctx.moveTo(-s * 0.05, 0);
            ctx.lineTo(-s * 0.3, -s * 0.55 * flap * side - s * 0.05);
            ctx.lineTo(s * 0.2, -s * 0.45 * flap * side);
            ctx.lineTo(s * 0.12, 0);
            ctx.closePath();
            ctx.fill();
        });
        ctx.restore();
    }

    window.Stage.rigs.fantasy = {
        kicker: 'The tale of',

        enter(s) {
            const { W, H } = s;
            buildSky(s);
            const big = Math.min(W * 0.24, 360);
            islands = [
                { ...buildIsland(big, 'castle'), x: W * 0.83, y: H * 0.56, bob: 0.0006, phase: 0 },
                { ...buildIsland(big * 0.55, 'crystal'), x: W * 0.14, y: H * 0.5, bob: 0.0008, phase: 1.8 },
                { ...buildIsland(big * 0.3, 'crystal'), x: W * 0.24, y: H * 0.2, bob: 0.001, phase: 3.2 },
                { ...buildIsland(big * 0.22, 'crystal'), x: W * 0.95, y: H * 0.72, bob: 0.0011, phase: 4.4 }
            ];
            cloudPuffs = Array.from({ length: 8 }, () => ({
                x: Math.random() * W, y: rand(H * 0.72, H * 0.9), r: rand(W * 0.1, W * 0.2),
                vx: rand(0.004, 0.012) * (Math.random() < 0.5 ? -1 : 1)
            }));
            motes = Array.from({ length: Math.round(Math.min(90, W * H / 12000)) }, (_, i) => ({
                x: Math.random() * W, y: Math.random() * H, r: rand(3, 8),
                vy: -rand(0.006, 0.02), sway: rand(0, 6), color: WISP_COLORS[i % WISP_COLORS.length]
            }));
            wisps = Array.from({ length: Math.round(Math.min(12, W / 100)) }, (_, i) => ({
                x: Math.random() * W, y: rand(H * 0.3, H * 0.85), vx: 0, vy: 0,
                heading: rand(0, Math.PI * 2), orbit: rand(1.3, 1.8), follower: i % 2 === 0,
                color: WISP_COLORS[i % WISP_COLORS.length], trail: []
            }));
            sparkles = [];
            dragon = { active: false, next: performance.now() + rand(4000, 9000) };
        },

        back(ctx, s) {
            const { W, H, dt, now, geo, still } = s;
            ctx.drawImage(sky, 0, 0, W, H);

            // Dragon gliding across the far sky every so often
            if (!still) {
                if (!dragon.active && now > dragon.next && !s.spinning) {
                    const dir = Math.random() < 0.5 ? 1 : -1;
                    dragon = { active: true, dir, x: dir > 0 ? -120 : W + 120, y: rand(H * 0.1, H * 0.26),
                               size: rand(70, 110) * Math.max(0.7, W / 1400), speed: rand(0.08, 0.12) };
                }
                if (dragon.active) {
                    dragon.x += dragon.dir * dragon.speed * dt;
                    drawDragon(ctx, dragon, now);
                    if (dragon.x < -160 || dragon.x > W + 160) dragon = { active: false, next: now + rand(14000, 24000) };
                }
            }

            // Floating islands bob, and pour waterfalls into the clouds
            islands.forEach(isl => {
                const bob = still ? 0 : Math.sin(now * isl.bob + isl.phase) * 8;
                const left = isl.x - isl.canvas.width / 2;
                const top = isl.y - isl.topY + bob;
                // waterfall from the island's edge
                const fx = isl.x + isl.w * 0.28;
                const fy = isl.y + bob + 2;
                const fall = ctx.createLinearGradient(0, fy, 0, H * 0.85);
                fall.addColorStop(0, 'rgba(210, 240, 255, 0.85)');
                fall.addColorStop(1, 'rgba(210, 240, 255, 0)');
                ctx.fillStyle = fall;
                const fw = Math.max(4, isl.w * 0.05);
                ctx.fillRect(fx - fw / 2, fy, fw, H * 0.85 - fy);
                // shimmering streaks sliding down the water
                ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
                const offset = still ? 0 : (now * 0.08) % 24;     // how fast the water streaks slide down
                for (let y = fy + offset; y < H * 0.8; y += 24) ctx.fillRect(fx - fw * 0.2, y, fw * 0.25, 9);
                ctx.drawImage(isl.canvas, left, top);
            });

            // Drifting cloud puffs over the cloud sea
            const cloud = softSprite('255, 245, 252', 128);
            cloudPuffs.forEach(c => {
                if (!still) {
                    c.x += c.vx * dt;
                    if (c.x < -c.r) c.x = W + c.r;
                    if (c.x > W + c.r) c.x = -c.r;
                }
                ctx.globalAlpha = 0.55;
                ctx.drawImage(cloud, c.x - c.r, c.y - c.r * 0.45, c.r * 2, c.r * 0.9);
            });
            ctx.globalAlpha = 1;

            // Rising motes of magic
            motes.forEach(m => {
                if (!still) {
                    m.y += m.vy * dt;
                    m.x += Math.sin(now * 0.001 + m.sway) * 0.01 * dt;
                    if (m.y < -10) { m.y = H + 10; m.x = Math.random() * W; }
                }
                const glow = softSprite(m.color, 32);
                ctx.globalAlpha = 0.55;
                ctx.drawImage(glow, m.x - m.r, m.y - m.r, m.r * 2, m.r * 2);
            });
            ctx.globalAlpha = 1;

            // The great magic circle behind the wheel
            sigilGlow = lerp(sigilGlow, s.landed ? 1 : 0, ease(dt, s.landed ? 200 : 700));
            if (!still) sigilSpin += dt * (s.spinning ? -(0.0004 + s.v * 0.004) : 0.00012);
            const sigilColor = sigilGlow > 0.5 ? GOLD : VIOLET;
            const sigilAlpha = 0.36 + 0.2 * s.v + 0.44 * sigilGlow;
            const sigilR = geo.radius * 1.3;                                  // just outside the rune ring
            drawSigil(ctx, geo.cx, geo.cy, sigilR, sigilSpin, sigilColor, sigilAlpha * 0.35, 6);   // soft glow pass
            drawSigil(ctx, geo.cx, geo.cy, sigilR, sigilSpin, sigilColor, sigilAlpha, 1.6);

            // A small magic circle following the cursor
            moveSpot(spot, followTarget(s, {
                landR: 0.9, landA: 0, spinR: 1.4, spinA: 0,
                cursorR: 36, cursorA: 0.75, idleR: 36, idleA: 0
            }), s, 120);
            if (spot.a > 0.03) drawSigil(ctx, spot.x, spot.y, 36, now * 0.0012, VIOLET, spot.a, 1.3);

            // Sparkle trail from the cursor, and a burst from the pointer on a win
            if (!still) {
                const moved = Math.hypot(s.cursor.x - lastCursor.x, s.cursor.y - lastCursor.y);
                if (s.cursor.active && moved > 3) {
                    const n = Math.min(3, Math.ceil(moved / 12));
                    for (let i = 0; i < n; i++) {
                        const t = i / n;
                        addSparkle(lerp(lastCursor.x, s.cursor.x, t) + rand(-4, 4), lerp(lastCursor.y, s.cursor.y, t) + rand(-4, 4),
                                   rand(-0.02, 0.02), rand(0.01, 0.04), rand(600, 1000));
                    }
                }
                if (s.landed && !burstDone) {
                    burstDone = true;
                    for (let i = 0; i < 90; i++) {
                        const a = rand(0, Math.PI * 2), sp = rand(0.05, 0.3);
                        addSparkle(geo.tipX, geo.tipY + 10, Math.cos(a) * sp, Math.sin(a) * sp - 0.06, rand(900, 1600));
                    }
                }
            }
            if (!s.landed) burstDone = false;
            lastCursor.x = s.cursor.x;
            lastCursor.y = s.cursor.y;

            sparkles = sparkles.filter(p => (p.age += dt) < p.life);
            sparkles.forEach(p => {
                p.x += p.vx * dt;
                p.y += p.vy * dt;
                p.vy += 0.00012 * dt;
                const fade = 1 - p.age / p.life;
                drawSparkle(ctx, p.x, p.y, p.size * (0.6 + 0.4 * fade), fade * (0.6 + 0.4 * Math.sin(p.age * 0.03)), p.color);
            });

            // Wisps: glowing orbs with trails (they flock like the other themes' lights)
            wisps.forEach((w, i) => {
                if (!still) {
                    let tx = null, ty = null, strength = 0.00035;
                    if (s.landed) {
                        const a = now * 0.0009 + i;
                        tx = geo.tipX + Math.cos(a) * geo.radius * 0.55;
                        ty = geo.tipY + geo.radius * 0.2 + Math.sin(a) * geo.radius * 0.25;
                        strength = 0.0009;
                    } else if (s.spinning) {
                        const a = now * (0.0006 + s.v * 0.003) + (i / wisps.length) * Math.PI * 2;
                        tx = geo.cx + Math.cos(a) * geo.radius * w.orbit;
                        ty = geo.cy + Math.sin(a) * geo.radius * w.orbit;
                        strength = 0.0012;
                    } else if (s.cursor.active && w.follower) {
                        const a = now * 0.001 + i;
                        tx = s.cursor.x + Math.cos(a) * 70;
                        ty = s.cursor.y + Math.sin(a * 1.3) * 50;
                        strength = 0.0006;
                    }
                    w.heading += rand(-0.004, 0.004) * dt;
                    let ax = Math.cos(w.heading) * 0.00003, ay = Math.sin(w.heading) * 0.00003;
                    if (tx !== null) { ax += (tx - w.x) * strength * 0.001; ay += (ty - w.y) * strength * 0.001; }
                    w.vx = (w.vx + ax * dt) * 0.985;
                    w.vy = (w.vy + ay * dt) * 0.985;
                    const speed = Math.hypot(w.vx, w.vy), max = s.spinning ? 0.5 : 0.14;
                    if (speed > max) { w.vx *= max / speed; w.vy *= max / speed; }
                    w.x += w.vx * dt;
                    w.y += w.vy * dt;
                    if (w.x < -20) w.x = W + 20; if (w.x > W + 20) w.x = -20;
                    if (w.y < -20) w.y = H + 20; if (w.y > H + 20) w.y = -20;
                    w.trail.push([w.x, w.y]);
                    if (w.trail.length > 14) w.trail.shift();
                }
                const glow = softSprite(w.color, 64);
                w.trail.forEach(([tx, ty], k) => {
                    const t = (k + 1) / w.trail.length;
                    ctx.globalAlpha = t * 0.35;
                    const r = 4 + t * 6;
                    ctx.drawImage(glow, tx - r, ty - r, r * 2, r * 2);
                });
                ctx.globalAlpha = 0.95;
                ctx.drawImage(glow, w.x - 16, w.y - 16, 32, 32);
                ctx.fillStyle = '#ffffff';
                ctx.beginPath(); ctx.arc(w.x, w.y, 2.6, 0, Math.PI * 2); ctx.fill();
            });
            ctx.globalAlpha = 1;
        },

        // A pearl band that shimmers through pastel colors, with runes glowing
        // deep violet in sequence (gold on a win)
        ring(ctx, s) {
            const { size, pad } = s.ring;
            if (!size) return;
            const c = size / 2, r = c - pad / 2;
            const glyph = Math.max(6, pad * 0.52);
            let count = Math.round((2 * Math.PI * r) / (glyph * 1.7));
            count -= count % 3;

            // Moonstone shimmer: a slowly turning rainbow of pastels (plain pearl if unsupported)
            if (!s.still) shimmer += s.dt * (0.00015 + s.v * 0.003);
            let band = '#f3ecfb';
            if (ctx.createConicGradient) {
                band = ctx.createConicGradient(shimmer, c, c);
                ['#f6effd', '#d9ccf6', '#f7f1fb', '#cdeef4', '#f8eff6', '#f6d3e6', '#f7f1fb', '#f5e6c4', '#f6effd']
                    .forEach((col, k, all) => band.addColorStop(k / (all.length - 1), col));
            }
            ctx.lineWidth = pad * 0.8;
            ctx.strokeStyle = band;
            ctx.beginPath(); ctx.arc(c, c, r, 0, Math.PI * 2); ctx.stroke();
            ctx.lineWidth = 1.5;
            ctx.strokeStyle = '#c9a24a';
            [r - pad * 0.4, r + pad * 0.4].forEach(rr => { ctx.beginPath(); ctx.arc(c, c, rr, 0, Math.PI * 2); ctx.stroke(); });

            if (!s.still) chase += s.dt * (0.002 + s.v * 0.035);
            ctx.lineCap = 'round';
            for (let i = 0; i < count; i++) {
                const level = chaseLevel(i, s, chase);
                const a = (i / count) * Math.PI * 2 - Math.PI / 2;
                const color = s.landed ? '200, 140, 20' : (i % 2 ? '90, 45, 180' : '170, 50, 140');
                ctx.save();
                ctx.translate(c + Math.cos(a) * r, c + Math.sin(a) * r);
                ctx.rotate(a + Math.PI / 2);                         // rune tops face outward
                ctx.translate(-glyph / 2, -glyph / 2);
                const strokes = RUNES[i % RUNES.length];
                const pass = (width, alpha) => {
                    ctx.lineWidth = width;
                    ctx.strokeStyle = level > 0.3 ? `rgba(${color}, ${alpha * level})` : 'rgba(150, 130, 190, 0.55)';
                    strokeRunes(ctx, strokes, glyph);
                };
                if (level > 0.3) pass(glyph * 0.32, 0.22);                    // soft glow
                pass(Math.max(1.3, glyph * 0.12), 1);
                ctx.restore();
            }
        }
    };
})();

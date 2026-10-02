/* ==========================================================================
   CYBERPUNK — neon city at night
   A skyline with a glowing grid floor that rushes toward you faster as the
   wheel spins, rain, and lasers scanning the sky from the rooftops.
   One laser always tracks the cursor; on a win they all lock onto the winner.
   ========================================================================== */
(() => {
    const { lerp, ease, rand, followTarget, moveSpot, chaseLevel, vignette } = window.Stage;

    const CYAN = '0, 240, 255';
    const PINK = '255, 0, 127';

    let skyline = null, horizon = 0;
    let rooftops = [];
    let rain = [];
    let lasers = [];
    let gridOffset = 0;
    let lockMix = 0;
    let chase = 0;
    const spot = {};

    function buildSkyline(s) {
        const { W, H } = s;
        horizon = Math.round(H * 0.66);
        skyline = document.createElement('canvas');
        skyline.width = Math.ceil(W * s.dpr);
        skyline.height = Math.ceil(horizon * s.dpr);
        const g = skyline.getContext('2d');
        g.scale(s.dpr, s.dpr);                     // crisp on high-density screens
        rooftops = [];

        // Two rows of buildings: far (lighter) and near (darker, taller)
        [[0.22, '#12052a', 0.5], [0.42, '#08020f', 1]].forEach(([maxH, color, windowChance]) => {
            let x = -10;
            while (x < W + 10) {
                const w = rand(26, 70);
                const h = rand(0.25, 1) * maxH * H;
                const top = horizon - h;
                g.fillStyle = color;
                g.fillRect(x, top, w, h);
                // Windows
                for (let wy = top + 6; wy < horizon - 6; wy += 7) {
                    for (let wx = x + 4; wx < x + w - 4; wx += 6) {
                        if (Math.random() < 0.18 * windowChance) {
                            g.fillStyle = Math.random() < 0.5 ? `rgba(${CYAN}, 0.55)` : `rgba(${PINK}, 0.5)`;
                            g.fillRect(wx, wy, 2, 3);
                        }
                    }
                }
                if (maxH > 0.3 && h > maxH * H * 0.7) rooftops.push({ x: x + w / 2, y: top });
                x += w + rand(0, 6);
            }
        });
    }

    window.Stage.rigs.cyberpunk = {
        kicker: 'Target acquired',

        enter(s) {
            buildSkyline(s);
            // Laser origins on the tallest rooftops, spread across the screen
            const picks = [0.12, 0.38, 0.62, 0.88].map(f => {
                let best = rooftops[0] || { x: f * s.W, y: horizon };
                rooftops.forEach(r => { if (Math.abs(r.x - f * s.W) < Math.abs(best.x - f * s.W)) best = r; });
                return best;
            });
            lasers = picks.map((p, i) => ({
                ox: p.x, oy: p.y,
                base: [0.35, 0.12, -0.12, -0.35][i],
                amp: 0.45, speed: [0.0007, 0.0005, 0.0006, 0.00075][i],
                phase: i * 1.7, color: i % 2 ? PINK : CYAN, angle: 0,
                tracker: i === 1                          // this one follows the cursor
            }));
            const drops = Math.round(Math.min(140, s.W / 9));
            rain = Array.from({ length: drops }, () => ({
                x: Math.random() * s.W, y: Math.random() * s.H, len: rand(8, 18), speed: rand(0.7, 1.2)
            }));
        },

        back(ctx, s) {
            const { W, H, dt, v, geo } = s;

            // Sky
            const sky = ctx.createLinearGradient(0, 0, 0, horizon);
            sky.addColorStop(0, '#030008');
            sky.addColorStop(1, '#1d0636');
            ctx.fillStyle = sky;
            ctx.fillRect(0, 0, W, horizon);

            // Glow along the horizon
            const glow = ctx.createRadialGradient(W / 2, horizon, 0, W / 2, horizon, W * 0.6);
            glow.addColorStop(0, `rgba(${PINK}, 0.28)`);
            glow.addColorStop(1, `rgba(${PINK}, 0)`);
            ctx.fillStyle = glow;
            ctx.fillRect(0, 0, W, H);

            ctx.drawImage(skyline, 0, 0, W, horizon);

            // Blinking red aircraft lights on the rooftops
            if (!s.still) {
                rooftops.forEach((r, i) => {
                    if (Math.sin(s.now * 0.003 + i * 2.3) > 0.6) {
                        ctx.fillStyle = 'rgba(255, 40, 60, 0.9)';
                        ctx.fillRect(r.x - 1, r.y - 3, 2, 2);
                    }
                });
            }

            // Floor + perspective grid
            ctx.fillStyle = '#05000c';
            ctx.fillRect(0, horizon, W, H - horizon);
            if (!s.still) gridOffset = (gridOffset + dt * (0.00025 + v * 0.004)) % 1;

            ctx.save();
            ctx.beginPath();
            ctx.rect(0, horizon, W, H - horizon);
            ctx.clip();
            const vx = W / 2;
            const rows = 14;
            const drawGrid = (width, alpha) => {
                ctx.lineWidth = width;
                ctx.strokeStyle = `rgba(${PINK}, ${alpha})`;
                ctx.beginPath();
                for (let i = -14; i <= 14; i++) {
                    ctx.moveTo(vx, horizon);
                    ctx.lineTo(vx + i * W * 0.16, H);
                }
                for (let k = 0; k < rows; k++) {
                    const t = (k + gridOffset) / rows;
                    const y = horizon + (H - horizon) * Math.pow(t, 2.2);
                    ctx.moveTo(0, y);
                    ctx.lineTo(W, y);
                }
                ctx.stroke();
            };
            drawGrid(4, 0.1 + 0.08 * v);
            drawGrid(1, 0.55 + 0.3 * v);
            // Fade the grid into the horizon haze
            const fade = ctx.createLinearGradient(0, horizon, 0, horizon + (H - horizon) * 0.35);
            fade.addColorStop(0, 'rgba(5, 0, 12, 1)');
            fade.addColorStop(1, 'rgba(5, 0, 12, 0)');
            ctx.fillStyle = fade;
            ctx.fillRect(0, horizon, W, H - horizon);
            ctx.restore();

            // Cursor glow (follows the same rules as other themes' spotlights)
            moveSpot(spot, followTarget(s, {
                landR: 0.9, landA: 0.3, spinR: 1.5, spinA: 0.18,
                cursorR: 180, cursorA: 0.22, idleR: 220, idleA: 0.12
            }), s, 160);
            ctx.globalCompositeOperation = 'lighter';
            const pool = ctx.createRadialGradient(spot.x, spot.y, 0, spot.x, spot.y, spot.r);
            pool.addColorStop(0, `rgba(${CYAN}, ${spot.a})`);
            pool.addColorStop(0.5, `rgba(112, 0, 255, ${spot.a * 0.4})`);
            pool.addColorStop(1, 'rgba(112, 0, 255, 0)');
            ctx.fillStyle = pool;
            ctx.fillRect(spot.x - spot.r, spot.y - spot.r, spot.r * 2, spot.r * 2);

            // Lasers
            lockMix = lerp(lockMix, s.landed ? 1 : 0, ease(dt, s.landed ? 180 : 600));
            const len = H * 1.6;
            lasers.forEach(l => {
                if (!s.still) l.phase += dt * l.speed * (1 + v * 8);
                let free = l.base + l.amp * Math.sin(l.phase);
                if (l.tracker) free = Math.atan2(spot.x - l.ox, l.oy - spot.y);
                const lock = Math.atan2(geo.tipX - l.ox, l.oy - geo.tipY);
                l.angle = lerp(free, lock, lockMix);
                const ex = l.ox + Math.sin(l.angle) * len;
                const ey = l.oy - Math.cos(l.angle) * len;
                const grad = ctx.createLinearGradient(l.ox, l.oy, ex, ey);
                const strength = 0.6 + 0.4 * lockMix;
                grad.addColorStop(0, `rgba(${l.color}, ${strength})`);
                grad.addColorStop(1, `rgba(${l.color}, 0)`);
                ctx.strokeStyle = grad;
                ctx.lineCap = 'round';
                [[8, 0.18], [3, 0.5], [1.2, 1]].forEach(([width, a]) => {
                    ctx.globalAlpha = a;
                    ctx.lineWidth = width;
                    ctx.beginPath();
                    ctx.moveTo(l.ox, l.oy);
                    ctx.lineTo(ex, ey);
                    ctx.stroke();
                });
            });
            ctx.globalAlpha = 1;

            // Rain
            ctx.strokeStyle = 'rgba(150, 220, 255, 0.22)';
            ctx.lineWidth = 1;
            ctx.beginPath();
            rain.forEach(d => {
                if (!s.still) {
                    d.y += d.speed * dt;
                    d.x -= d.speed * dt * 0.18;
                    if (d.y > H) { d.y = -d.len; d.x = Math.random() * (W + 100); }
                }
                ctx.moveTo(d.x, d.y);
                ctx.lineTo(d.x + d.len * 0.18, d.y - d.len);
            });
            ctx.stroke();

            ctx.globalCompositeOperation = 'source-over';
            vignette(ctx, s, 0.55);
        },

        // LED ring: short neon segments chasing in cyan and pink
        ring(ctx, s) {
            const { size, pad } = s.ring;
            if (!size) return;
            const c = size / 2, r = c - pad / 2;
            let count = Math.round((2 * Math.PI * r) / 14);
            count -= count % 3;
            const seg = (Math.PI * 2) / count;

            ctx.lineWidth = pad * 0.55;
            ctx.strokeStyle = 'rgba(10, 2, 22, 0.9)';
            ctx.beginPath(); ctx.arc(c, c, r, 0, Math.PI * 2); ctx.stroke();

            if (!s.still) chase += s.dt * (0.004 + s.v * 0.05);

            for (let i = 0; i < count; i++) {
                const level = chaseLevel(i, s, chase);
                const color = s.landed ? PINK : (i % 2 ? PINK : CYAN);
                const a0 = i * seg - Math.PI / 2 + seg * 0.2;
                const a1 = a0 + seg * 0.6;
                ctx.strokeStyle = `rgba(${color}, ${0.15 * level})`;
                ctx.lineWidth = pad * 0.6;
                ctx.beginPath(); ctx.arc(c, c, r, a0, a1); ctx.stroke();
                ctx.strokeStyle = `rgba(${color}, ${0.15 + 0.85 * level})`;
                ctx.lineWidth = pad * 0.22;
                ctx.beginPath(); ctx.arc(c, c, r, a0, a1); ctx.stroke();
            }
        }
    };
})();

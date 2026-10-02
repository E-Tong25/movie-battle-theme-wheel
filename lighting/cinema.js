/* ==========================================================================
   CINEMA — premiere night
   Searchlights sweep a night sky, dust drifts in the beams, a follow-spot
   trails the cursor, and marquee bulbs chase around the wheel.
   On a win every beam swings onto the winner.
   ========================================================================== */
(() => {
    const { lerp, ease, followTarget, moveSpot, chaseLevel, beamLight, vignette } = window.Stage;

    const beams = [
        { x: 0.08, base:  0.30, amp: 0.34, speed: 0.00050, phase: 0.0 },
        { x: 0.33, base:  0.10, amp: 0.30, speed: 0.00038, phase: 2.1 },
        { x: 0.67, base: -0.10, amp: 0.30, speed: 0.00043, phase: 4.0 },
        { x: 0.92, base: -0.30, amp: 0.34, speed: 0.00055, phase: 1.2 }
    ];
    beams.forEach(b => { b.angle = b.base; });

    let sprite = null, length = 0, farWidth = 0;
    let haze = [];
    let aimMix = 0;             // 0 = free sweep, 1 = every beam on the winner
    let chase = 0;
    const spot = {};

    function buildBeam(s) {
        length = s.H * 1.4;
        farWidth = Math.max(200, s.W * 0.17);
        sprite = document.createElement('canvas');
        sprite.width = Math.ceil(farWidth + 20);
        sprite.height = Math.ceil(length);
        const b = sprite.getContext('2d');
        const w = sprite.width, h = sprite.height;
        // Stacked cones of shrinking width = soft edges and a bright core
        for (let n = 0; n < 7; n++) {
            const k = 1 - n / 7;
            const far = farWidth * k, near = 6 + 10 * k;
            const grad = b.createLinearGradient(0, h, 0, 0);
            grad.addColorStop(0, 'rgba(255, 238, 205, 0.10)');
            grad.addColorStop(0.35, 'rgba(255, 238, 205, 0.06)');
            grad.addColorStop(1, 'rgba(255, 238, 205, 0)');
            b.fillStyle = grad;
            b.beginPath();
            b.moveTo(w / 2 - near / 2, h);
            b.lineTo(w / 2 - far / 2, 0);
            b.lineTo(w / 2 + far / 2, 0);
            b.lineTo(w / 2 + near / 2, h);
            b.closePath();
            b.fill();
        }
    }

    window.Stage.rigs.cinema = {
        kicker: "Tonight's feature",

        enter(s) {
            buildBeam(s);
            const count = Math.round(Math.min(240, (s.W * s.H) / 5500));
            haze = Array.from({ length: count }, () => ({
                x: Math.random() * s.W, y: Math.random() * s.H,
                r: 0.6 + Math.random() * 1.8,
                vx: (Math.random() - 0.5) * 0.012, vy: -0.004 - Math.random() * 0.012,
                glow: 0.5 + Math.random() * 0.5
            }));
        },

        back(ctx, s) {
            const { W, H, dt, v, geo } = s;

            const sky = ctx.createLinearGradient(0, 0, 0, H);
            sky.addColorStop(0, '#06070d');
            sky.addColorStop(0.6, '#0e0c11');
            sky.addColorStop(1, '#1d150d');
            ctx.fillStyle = sky;
            ctx.fillRect(0, 0, W, H);

            // Searchlights
            aimMix = lerp(aimMix, s.landed ? 1 : 0, ease(dt, s.landed ? 260 : 700));
            const alpha = Math.min(0.55 + 0.3 * v + 0.25 * aimMix, 1);
            const oy = H + 12;
            ctx.globalCompositeOperation = 'lighter';
            beams.forEach(b => {
                if (!s.still) b.phase += dt * b.speed * (1 + v * 7);
                const sweep = b.base + b.amp * Math.sin(b.phase);
                b.ox = b.x * W;
                b.oy = oy;
                const aim = Math.atan2(geo.tipX - b.ox, oy - geo.tipY);
                b.angle = lerp(sweep, aim, aimMix);
                ctx.save();
                ctx.globalAlpha = alpha;
                ctx.translate(b.ox, oy);
                ctx.rotate(b.angle);
                ctx.drawImage(sprite, -sprite.width / 2, -sprite.height);
                ctx.restore();
            });
            ctx.globalAlpha = 1;

            // Follow-spot
            moveSpot(spot, followTarget(s, {
                landR: 0.75, landA: 0.34, spinR: 1.45, spinA: 0.22,
                cursorR: 200, cursorA: 0.2, idleR: 240, idleA: 0.13
            }), s);
            const pool = ctx.createRadialGradient(spot.x, spot.y, 0, spot.x, spot.y, spot.r);
            pool.addColorStop(0, `rgba(255, 228, 180, ${spot.a})`);
            pool.addColorStop(0.55, `rgba(255, 214, 150, ${spot.a * 0.45})`);
            pool.addColorStop(1, 'rgba(255, 214, 150, 0)');
            ctx.fillStyle = pool;
            ctx.fillRect(spot.x - spot.r, spot.y - spot.r, spot.r * 2, spot.r * 2);

            // Dust only shows where light hits it
            haze.forEach(p => {
                if (!s.still) {
                    p.x += p.vx * dt;
                    p.y += p.vy * dt;
                    if (p.y < -5) { p.y = H + 5; p.x = Math.random() * W; }
                    if (p.x < -5) p.x = W + 5;
                    if (p.x > W + 5) p.x = -5;
                }
                let light = 0;
                for (const b of beams) light += beamLight(p.x, p.y, b, length, 8, farWidth / 2) * alpha;
                const d = Math.hypot(p.x - spot.x, p.y - spot.y);
                if (d < spot.r) light += (1 - d / spot.r) * spot.a * 2.2;
                if (light < 0.03) return;
                ctx.fillStyle = `rgba(255, 240, 215, ${Math.min(light * 0.7 * p.glow, 0.9)})`;
                ctx.beginPath();
                ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
                ctx.fill();
            });

            ctx.globalCompositeOperation = 'source-over';
            vignette(ctx, s, 0.7);
        },

        // Marquee bulbs
        ring(ctx, s) {
            const { size, pad } = s.ring;
            if (!size) return;
            const c = size / 2, ringR = c - pad / 2;
            const bulbR = Math.max(2.5, Math.min(5, pad * 0.2));
            let count = Math.round((2 * Math.PI * ringR) / (bulbR * 5));
            count -= count % 3;

            ctx.lineWidth = pad * 0.72;
            ctx.strokeStyle = '#1f150b';
            ctx.beginPath(); ctx.arc(c, c, ringR, 0, Math.PI * 2); ctx.stroke();
            ctx.lineWidth = 1;
            ctx.strokeStyle = 'rgba(212, 175, 55, 0.8)';
            [ringR - pad * 0.36, ringR + pad * 0.36].forEach(r => {
                ctx.beginPath(); ctx.arc(c, c, r, 0, Math.PI * 2); ctx.stroke();
            });

            if (!s.still) chase += s.dt * (0.0025 + s.v * 0.03);

            for (let i = 0; i < count; i++) {
                const level = chaseLevel(i, s, chase);
                const a = (i / count) * Math.PI * 2 - Math.PI / 2;
                const x = c + Math.cos(a) * ringR, y = c + Math.sin(a) * ringR;
                if (level > 0.2) {
                    const glow = ctx.createRadialGradient(x, y, 0, x, y, bulbR * 3.2);
                    glow.addColorStop(0, `rgba(255, 210, 120, ${0.5 * level})`);
                    glow.addColorStop(1, 'rgba(255, 210, 120, 0)');
                    ctx.fillStyle = glow;
                    ctx.fillRect(x - bulbR * 3.2, y - bulbR * 3.2, bulbR * 6.4, bulbR * 6.4);
                }
                ctx.fillStyle = `rgb(${Math.round(lerp(74, 255, level))}, ${Math.round(lerp(56, 244, level))}, ${Math.round(lerp(24, 214, level))})`;
                ctx.beginPath(); ctx.arc(x, y, bulbR, 0, Math.PI * 2); ctx.fill();
            }
        }
    };
})();

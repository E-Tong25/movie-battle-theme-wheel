/* ==========================================================================
   NOIR — a streetlight through venetian blinds
   Slats of light fall across the back wall and shift as the cursor moves
   (like moving the light outside the window). Car headlights sweep across
   now and then, faster while spinning. Cigarette smoke hangs in the room.
   On a win, the blinds dim and a hard interrogation lamp hits the winner.
   ========================================================================== */
(() => {
    const { lerp, ease, rand, softSprite, followTarget, moveSpot, vignette } = window.Stage;

    let smoke = [];
    let lampMix = 0;             // 0 = blinds, 1 = interrogation lamp
    let sweepPhase = 0;
    let dialAngle = 0;          // how far the safe dial has turned
    const light = {};            // where the "streetlight" is (drives the blind shadows)

    window.Stage.rigs.noir = {
        kicker: 'The case of',

        enter(s) {
            const count = Math.round(Math.min(26, s.W / 50));
            smoke = Array.from({ length: count }, () => ({
                x: Math.random() * s.W, y: rand(s.H * 0.2, s.H),
                r: rand(90, 220), vy: -rand(0.004, 0.012), wobble: rand(0, Math.PI * 2),
                a: rand(0.025, 0.06)
            }));
        },

        back(ctx, s) {
            const { W, H, dt, v, geo } = s;

            // Plaster wall, lit a little from the window side
            const wall = ctx.createLinearGradient(W, 0, 0, H);
            wall.addColorStop(0, '#1c1c1c');
            wall.addColorStop(1, '#070707');
            ctx.fillStyle = wall;
            ctx.fillRect(0, 0, W, H);

            lampMix = lerp(lampMix, s.landed ? 1 : 0, ease(dt, s.landed ? 200 : 600));

            // The streetlight follows the same target as other themes' spotlights
            moveSpot(light, followTarget(s, {
                landR: 0.9, landA: 0.9, spinR: 1, spinA: 0.2,
                cursorR: 1, cursorA: 0.2, idleR: 1, idleA: 0.15
            }), s, 420);

            // --- Venetian blind pattern ---
            const pw = Math.min(W * 0.62, 720);
            const ph = pw * 0.85;
            // Parallax: the pattern moves opposite the light, and skews with it
            const px = W * 0.6 - (light.x - W / 2) * 0.35;
            const py = H * 0.42 - (light.y - H / 2) * 0.25;
            const skew = -0.45 + ((light.x / W) - 0.5) * 0.5;

            // Headlight sweep: a brighter band travelling across the slats
            if (!s.still) sweepPhase += dt / (s.spinning ? 1100 - 700 * v : 6500);
            const sweepX = ((sweepPhase % 1) * 2.4 - 1.2) * pw;

            const slats = 9;
            const pitch = ph / slats;
            const blindsAlpha = 1 - lampMix * 0.75;

            ctx.save();
            ctx.translate(px, py);
            ctx.transform(1, 0, skew, 1, 0, 0);
            ctx.globalCompositeOperation = 'lighter';
            for (let i = 0; i < slats; i++) {
                const y = -ph / 2 + i * pitch;
                const band = ctx.createLinearGradient(-pw / 2, 0, pw / 2, 0);
                const base = 0.075 * blindsAlpha;
                band.addColorStop(0, 'rgba(235, 235, 235, 0)');
                band.addColorStop(0.15, `rgba(235, 235, 235, ${base})`);
                band.addColorStop(0.85, `rgba(235, 235, 235, ${base})`);
                band.addColorStop(1, 'rgba(235, 235, 235, 0)');
                ctx.fillStyle = band;
                ctx.fillRect(-pw / 2, y, pw, pitch * 0.55);
                // soft edge
                ctx.fillStyle = `rgba(235, 235, 235, ${base * 0.35})`;
                ctx.fillRect(-pw / 2 + pw * 0.08, y - 2, pw * 0.84, pitch * 0.55 + 4);
            }
            // Headlight band
            const head = ctx.createLinearGradient(sweepX - pw * 0.25, 0, sweepX + pw * 0.25, 0);
            head.addColorStop(0, 'rgba(255, 255, 255, 0)');
            head.addColorStop(0.5, `rgba(255, 255, 255, ${0.09 * blindsAlpha * (1 + v)})`);
            head.addColorStop(1, 'rgba(255, 255, 255, 0)');
            for (let i = 0; i < slats; i++) {
                ctx.fillStyle = head;
                ctx.fillRect(-pw / 2, -ph / 2 + i * pitch, pw, pitch * 0.55);
            }
            ctx.globalCompositeOperation = 'source-over';
            // Window frame (the cross of the window bars)
            ctx.fillStyle = 'rgba(6, 6, 6, 0.85)';
            ctx.fillRect(-8, -ph / 2 - 10, 16, ph + 20);
            ctx.restore();

            // --- Smoke ---
            const puff = softSprite('200, 200, 200', 128);
            smoke.forEach(p => {
                if (!s.still) {
                    p.wobble += dt * 0.0006;
                    p.y += p.vy * dt;
                    p.x += Math.sin(p.wobble) * 0.02 * dt;
                    if (p.y < -p.r) { p.y = H + p.r; p.x = Math.random() * W; }
                }
                ctx.globalAlpha = p.a * (1 - lampMix * 0.5);
                ctx.drawImage(puff, p.x - p.r, p.y - p.r, p.r * 2, p.r * 2);
            });
            ctx.globalAlpha = 1;

            // --- Soft pool where the cursor is, so the room answers you ---
            if (lampMix < 0.99) {
                const r = 220;
                const pool = ctx.createRadialGradient(light.x, light.y, 0, light.x, light.y, r);
                pool.addColorStop(0, `rgba(230, 230, 230, ${0.08 * (1 - lampMix)})`);
                pool.addColorStop(1, 'rgba(230, 230, 230, 0)');
                ctx.fillStyle = pool;
                ctx.fillRect(light.x - r, light.y - r, r * 2, r * 2);
            }

            // --- Interrogation lamp: hard-edged circle on the winner ---
            if (lampMix > 0.01) {
                const r = geo.radius * 1.15;
                const x = geo.cx, y = geo.tipY + geo.radius * 0.35;
                const lamp = ctx.createRadialGradient(x, y, 0, x, y, r);
                lamp.addColorStop(0, `rgba(255, 255, 255, ${0.28 * lampMix})`);
                lamp.addColorStop(0.9, `rgba(255, 255, 255, ${0.18 * lampMix})`);
                lamp.addColorStop(1, 'rgba(255, 255, 255, 0)');
                ctx.fillStyle = lamp;
                ctx.fillRect(x - r, y - r, r * 2, r * 2);
            }

            vignette(ctx, s, 0.8 + lampMix * 0.15);

            // Faint projector flicker
            if (!s.still) {
                ctx.fillStyle = `rgba(0, 0, 0, ${Math.random() * 0.035})`;
                ctx.fillRect(0, 0, W, H);
            }
        },

        // A safe dial: gunmetal bezel with ticks and numbers. It turns against the
        // wheel while spinning (someone cracking the safe) and clicks home on a win.
        ring(ctx, s) {
            const { size, pad } = s.ring;
            if (!size) return;
            const c = size / 2, r = c - pad / 2;
            const tick = Math.PI / 50;

            if (!s.still) {
                if (s.spinning) dialAngle -= s.dt * s.v * 0.0012;
                else dialAngle = lerp(dialAngle, Math.round(dialAngle / tick) * tick, ease(s.dt, 90));
            }

            // Brushed-metal band
            let band = '#2a2a2a';
            if (ctx.createConicGradient) {
                band = ctx.createConicGradient(0.6, c, c);
                ['#3a3a3a', '#1a1a1a', '#4a4a4a', '#161616', '#3a3a3a', '#1c1c1c', '#3a3a3a']
                    .forEach((col, k, all) => band.addColorStop(k / (all.length - 1), col));
            }
            ctx.lineWidth = pad * 0.9;
            ctx.strokeStyle = band;
            ctx.beginPath(); ctx.arc(c, c, r, 0, Math.PI * 2); ctx.stroke();
            ctx.lineWidth = 1;
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.28)';
            ctx.beginPath(); ctx.arc(c, c, r + pad * 0.45, 0, Math.PI * 2); ctx.stroke();
            ctx.strokeStyle = 'rgba(0, 0, 0, 0.85)';
            ctx.beginPath(); ctx.arc(c, c, r - pad * 0.45, 0, Math.PI * 2); ctx.stroke();

            // 100 ticks, numbers every 10
            const bright = s.landed ? 1 : 0.9;
            const fontSize = Math.max(9, pad * 0.48);
            ctx.save();
            ctx.translate(c, c);
            ctx.rotate(dialAngle);
            ctx.font = `${fontSize}px "Special Elite", monospace`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            for (let i = 0; i < 100; i++) {
                const major = i % 10 === 0, mid = i % 5 === 0;
                const len = major ? pad * 0.26 : mid ? pad * 0.2 : pad * 0.12;
                ctx.save();
                ctx.rotate((i / 100) * Math.PI * 2);
                ctx.strokeStyle = `rgba(230, 230, 230, ${(major ? 0.95 : 0.55) * bright})`;
                ctx.lineWidth = major ? 1.6 : 1;
                ctx.beginPath();
                ctx.moveTo(0, -(r + pad * 0.42));
                ctx.lineTo(0, -(r + pad * 0.42) + len);
                ctx.stroke();
                if (major) {
                    ctx.fillStyle = `rgba(245, 245, 245, ${bright})`;
                    ctx.fillText(String(i), 0, -(r - pad * 0.1));
                }
                ctx.restore();
            }
            ctx.restore();
        }
    };
})();

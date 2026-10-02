/* ==========================================================================
   HORROR — lights out
   The page sits in darkness and the cursor is a flashlight that flickers
   (more while the wheel spins). Fog creeps along the floor and lightning
   strikes now and then. On a win, the flashlight steadies on the winner and
   lightning cracks once.
   Blood: an uneven band of blood coats the wheel's rim. Drips form along the
   bottom: a bead swells, runs down and slows, gets heavy, stretches and breaks
   off as a falling drop, then the trail fades and a new drip starts. Droplets
   fling off while it spins, and a drop falls from the pointer onto the winner.
   The controls, result text and SPIN button stay above the darkness
   (see lighting.css) so the page is always usable.
   Reduced motion: no flicker, no lightning, fog holds still.
   ========================================================================== */
(() => {
    const { lerp, ease, rand, softSprite, followTarget, moveSpot, vignette } = window.Stage;

    let fog = [];
    let nextStrike = 0, strikeAt = -Infinity;
    let flickerUntil = 0, flickerLevel = 1;
    let landStrikeDone = false;
    const beam = {};

    // ---------- Blood ----------
    const BLOOD = [160, 6, 6];               // base color; drips get a glossy highlight
    const RIM_STEPS = 120;
    let rimShape = [];                       // smooth random thickness around the rim (chosen in enter)
    let rimDrips = [];                       // drips forming along the bottom of the rim
    let droplets = [];                       // falling / flung drops
    let pointerDrip = null;                  // the drop that forms on the pointer after a win
    let darknessNow = 0.76;                  // shared by front() so blood can match the darkness

    function makeRimShape() {
        let raw = Array.from({ length: RIM_STEPS }, () => rand(0.75, 1.25));
        for (let pass = 0; pass < 3; pass++) {             // smooth it so the band undulates, not jitters
            raw = raw.map((v, i) => (raw[(i - 1 + RIM_STEPS) % RIM_STEPS] + v * 2 + raw[(i + 1) % RIM_STEPS]) / 4);
        }
        return raw;
    }

    // Thickness of the blood band at angle a (0 = right, PI/2 = bottom), in pixels.
    // ring() draws the band with this and every drip starts on its exact edge.
    function bandThickness(a, pad) {
        if (!rimShape.length) return pad * 0.3;
        const t = ((((a / (Math.PI * 2)) % 1) + 1) % 1) * RIM_STEPS;
        const i = Math.floor(t) % RIM_STEPS, f = t - Math.floor(t);
        const shape = lerp(rimShape[i], rimShape[(i + 1) % RIM_STEPS], f);
        const gravity = 0.6 + 0.4 * Math.max(0, Math.sin(a));     // pools toward the bottom
        return pad * 0.42 * gravity * shape;
    }

    // A drip's life: bead -> run -> neck -> (drop falls) -> drain -> new drip
    function resetDrip(d, first) {
        d.angle = rand(0.55, Math.PI - 0.55);                    // bottom of the rim only
        d.phase = 'bead';
        d.t = first ? -rand(0, 5000) : -rand(500, 2500);         // a pause before it starts
        d.maxLen = rand(20, 58);
        d.tau = rand(700, 1500);                                 // how quickly it runs
        d.width = rand(3.5, 6);
        d.len = 0; d.bead = 0; d.neck = 0; d.alpha = 1;
        return d;
    }

    function updateDrip(d, dt, still, x, y, onDrop) {
        if (still) {                                             // reduced motion: a still, hanging drip
            d.phase = 'run'; d.t = 0; d.len = d.maxLen * 0.7; d.bead = d.width * 0.75; d.neck = 0; d.alpha = 1;
            return;
        }
        d.t += dt;
        if (d.t < 0) return;
        if (d.phase === 'bead') {                                // a bead swells at the edge
            const beadMs = d.beadMs || 900;
            d.bead = d.width * 0.75 * Math.min(1, d.t / beadMs);
            if (d.t >= beadMs) { d.phase = 'run'; d.t = 0; }
        } else if (d.phase === 'run') {                          // runs down fast, then slows as it thins
            d.len = d.maxLen * (1 - Math.exp(-d.t / d.tau));
            d.bead = d.width * (0.75 + 0.2 * d.len / d.maxLen);  // the tip gets heavier
            if (d.len > d.maxLen * 0.93) { d.phase = 'neck'; d.t = 0; }
        } else if (d.phase === 'neck') {                         // the heavy bead stretches...
            const neckMs = d.neckMs || 320;
            d.neck = d.width * 1.8 * Math.min(1, d.t / neckMs);
            if (d.t >= neckMs) {                                 // ...and breaks off
                droplets.push({ x, y: y + d.len + d.neck, vx: 0, vy: 0.04, r: d.bead * 0.85, life: 0, ...(onDrop || {}) });
                d.phase = 'drain'; d.t = 0; d.neck = 0; d.bead = d.width * 0.45;
            }
        } else if (d.phase === 'drain') {                        // the trail left behind fades
            d.alpha = Math.max(0, 1 - d.t / 2600);
            if (d.t >= 2600) {
                if (d.once) d.phase = 'done';
                else resetDrip(d, false);
            }
        }
    }

    // Wide where it meets the band, a thin trail, a round bead at the tip
    function drawDrip(ctx, x, y, d, shade) {
        if (d.phase === 'done' || (d.phase === 'bead' && d.t < 0)) return;
        const [r, g, b] = BLOOD.map(v => Math.round(v * 0.82 * shade));   // a touch darker than fresh drops
        const trail = Math.max(1.8, d.width * 0.55);
        const tipY = y + d.len;
        ctx.globalAlpha = d.alpha;
        ctx.fillStyle = `rgb(${r}, ${g}, ${b})`;
        // root: overlaps into the band so the drip is always attached
        ctx.beginPath();
        ctx.ellipse(x, y - 1.5, d.width * 0.95, 3.5, 0, 0, Math.PI * 2);
        ctx.fill();
        // trail, slightly wider at the top
        if (d.len > 1) {
            ctx.beginPath();
            ctx.moveTo(x - trail * 0.75, y);
            ctx.lineTo(x - trail * 0.5, tipY);
            ctx.lineTo(x + trail * 0.5, tipY);
            ctx.lineTo(x + trail * 0.75, y);
            ctx.closePath();
            ctx.fill();
        }
        // the neck while it stretches, then the bead
        const beadY = (d.len > 1 ? tipY : y + d.bead * 0.6) + d.neck;
        if (d.neck > 0) ctx.fillRect(x - trail * 0.25, tipY, trail * 0.5, d.neck);
        if (d.bead > 0.3) {
            ctx.beginPath();
            ctx.ellipse(x, beadY, d.bead, d.bead * (1 + d.neck / (d.width * 6)), 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = `rgba(255, 140, 140, ${0.45 * shade})`;          // glossy highlight
            ctx.beginPath();
            ctx.arc(x - d.bead * 0.35, beadY - d.bead * 0.35, Math.max(0.8, d.bead * 0.25), 0, Math.PI * 2);
            ctx.fill();
        }
        if (d.len > 4) {
            ctx.fillStyle = `rgba(255, 120, 120, ${0.25 * shade})`;
            ctx.fillRect(x - trail * 0.45, y + 1, Math.max(0.8, trail * 0.2), d.len * 0.85);
        }
        ctx.globalAlpha = 1;
    }

    // How dark the page is at (x, y): the flashlight hole lets light through
    function darkAt(x, y) {
        const r = beam.r * (0.9 + 0.1 * flickerLevel);
        const d = Math.hypot(x - beam.x, y - beam.y) / r;
        let open = 0;
        if (d < 0.15) open = 0.95;
        else if (d < 0.75) open = lerp(0.95, 0.8, (d - 0.15) / 0.6);
        else if (d < 1) open = lerp(0.8, 0, (d - 0.75) / 0.25);
        return darknessNow * (1 - open * flickerLevel);
    }

    // Lightning brightness over time: a bright crack, then a weaker echo
    function lightning(now) {
        const t = now - strikeAt;
        if (t < 0 || t > 450) return 0;
        const pulse = (start, width, peak) => {
            const x = (t - start) / width;
            return x > 0 && x < 1 ? Math.sin(x * Math.PI) * peak : 0;
        };
        return pulse(0, 90, 0.32) + pulse(170, 140, 0.2);
    }

    window.Stage.rigs.horror = {
        kicker: 'It has chosen…',

        enter(s) {
            const count = Math.round(Math.min(16, s.W / 90));
            fog = Array.from({ length: count }, () => ({
                x: Math.random() * s.W, y: rand(s.H * 0.62, s.H * 1.05),
                r: rand(s.W * 0.14, s.W * 0.3), vx: rand(0.004, 0.016) * (Math.random() < 0.5 ? -1 : 1),
                a: rand(0.1, 0.22)
            }));
            nextStrike = performance.now() + rand(6000, 12000);
            rimShape = makeRimShape();
            rimDrips = Array.from({ length: 7 }, () => resetDrip({}, true));
            droplets = [];
            pointerDrip = null;
        },

        back(ctx, s) {
            const { W, H, dt, now } = s;

            const room = ctx.createLinearGradient(0, 0, 0, H);
            room.addColorStop(0, '#040000');
            room.addColorStop(1, '#170303');
            ctx.fillStyle = room;
            ctx.fillRect(0, 0, W, H);

            // Lightning timing
            if (!s.still) {
                if (now > nextStrike && !s.spinning) {
                    strikeAt = now;
                    nextStrike = now + rand(8000, 16000);
                }
                if (s.landed && !landStrikeDone && s.sinceLand > 250) {
                    strikeAt = now;
                    landStrikeDone = true;
                }
            }
            if (!s.landed) landStrikeDone = false;

            // Fog along the floor
            const puff = softSprite('70, 40, 40', 128);
            fog.forEach(f => {
                if (!s.still) {
                    f.x += f.vx * dt;
                    if (f.x < -f.r) f.x = W + f.r;
                    if (f.x > W + f.r) f.x = -f.r;
                }
                ctx.globalAlpha = f.a;
                ctx.drawImage(puff, f.x - f.r, f.y - f.r * 0.5, f.r * 2, f.r);
            });
            ctx.globalAlpha = 1;

            // Flashlight on the back wall (the darkness layer cuts a matching hole)
            moveSpot(beam, followTarget(s, {
                landR: 0.95, landA: 1, spinR: 1.25, spinA: 0.9,
                cursorR: 170, cursorA: 1, idleR: 190, idleA: 0.85
            }), s, 140);
            const flash = ctx.createRadialGradient(beam.x, beam.y, 0, beam.x, beam.y, beam.r);
            flash.addColorStop(0, `rgba(255, 236, 200, ${0.16 * flickerLevel})`);
            flash.addColorStop(0.7, `rgba(255, 220, 170, ${0.07 * flickerLevel})`);
            flash.addColorStop(1, 'rgba(255, 220, 170, 0)');
            ctx.fillStyle = flash;
            ctx.fillRect(beam.x - beam.r, beam.y - beam.r, beam.r * 2, beam.r * 2);

            const bolt = lightning(now);
            if (bolt > 0) {
                ctx.fillStyle = `rgba(210, 200, 225, ${bolt})`;
                ctx.fillRect(0, 0, W, H);
            }

            vignette(ctx, s, 0.8);
        },

        // Darkness over the page with a flashlight-shaped hole in it
        front(ctx, s) {
            const { W, H, dt, now } = s;

            // Flicker: random short dips, more often while spinning, none once landed
            if (!s.still && !s.landed) {
                if (now > flickerUntil) {
                    flickerLevel = lerp(flickerLevel, 1, ease(dt, 60));
                    const chance = dt * (0.00035 + s.v * 0.004);
                    if (Math.random() < chance) {
                        flickerUntil = now + rand(50, 160);
                        flickerLevel = rand(0.15, 0.6);
                    }
                }
            } else {
                flickerLevel = lerp(flickerLevel, 1, ease(dt, 80));
            }

            const bolt = lightning(now);
            const darkness = Math.max(0, (s.landed ? 0.82 : 0.76) - bolt * 1.6);
            darknessNow = darkness;
            ctx.fillStyle = `rgba(0, 0, 0, ${darkness})`;
            ctx.fillRect(0, 0, W, H);

            const r = beam.r * (0.9 + 0.1 * flickerLevel);
            ctx.globalCompositeOperation = 'destination-out';
            const hole = ctx.createRadialGradient(beam.x, beam.y, r * 0.15, beam.x, beam.y, r);
            hole.addColorStop(0, `rgba(0, 0, 0, ${0.95 * flickerLevel})`);
            hole.addColorStop(0.75, `rgba(0, 0, 0, ${0.8 * flickerLevel})`);
            hole.addColorStop(1, 'rgba(0, 0, 0, 0)');
            ctx.fillStyle = hole;
            ctx.fillRect(beam.x - r, beam.y - r, r * 2, r * 2);
            ctx.globalCompositeOperation = 'source-over';

            // ---- Blood (drawn after the hole, shaded to match the darkness) ----
            const { geo } = s;
            const pad = s.ring.pad;

            // Drips along the bottom of the rim, each starting on the band's edge
            rimDrips.forEach(d => {
                const edge = geo.radius + bandThickness(d.angle, pad);
                const x = geo.cx + Math.cos(d.angle) * edge;
                const y = geo.cy + Math.sin(d.angle) * edge;
                updateDrip(d, dt, s.still, x, y);
                drawDrip(ctx, x, y, d, 1 - darkAt(x, y + d.len / 2));
            });

            // Flung off the rim while spinning (the wheel turns clockwise)
            if (!s.still && s.spinning && Math.random() < s.dt * s.v * 0.03) {
                const a = rand(0, Math.PI * 2);
                const edge = geo.radius + bandThickness(a, pad);
                const speed = 0.15 + s.v * 0.5;
                droplets.push({ x: geo.cx + Math.cos(a) * edge, y: geo.cy + Math.sin(a) * edge,
                                vx: -Math.sin(a) * speed, vy: Math.cos(a) * speed, r: rand(1.5, 3.2), life: 0 });
            }

            // After a win, a drop forms on the pointer tip and falls onto the winner
            if (s.landed && !pointerDrip) {
                // quick, so the drop hits the winner before the title card opens
                pointerDrip = { ...resetDrip({}, false), t: 0, maxLen: 12, tau: 170, width: 5.5, beadMs: 150, neckMs: 180, once: true };
            }
            if (!s.landed) pointerDrip = null;
            if (pointerDrip) {
                const x = geo.tipX, y = geo.tipY - 3;
                updateDrip(pointerDrip, dt, s.still, x, y, { splat: geo.tipY + geo.radius * 0.35 });
                drawDrip(ctx, x, y, pointerDrip, 1 - darkAt(x, y));
            }

            // Falling and flung drops (they stretch a little as they speed up)
            droplets = droplets.filter(p => {
                p.life += dt;
                p.vy += 0.0012 * dt;
                p.x += p.vx * dt;
                p.y += p.vy * dt;
                if (p.splat && p.y >= p.splat) {                  // the pointer drop hits the winner
                    for (let k = 0; k < 7; k++) {
                        const a = rand(Math.PI * 1.05, Math.PI * 1.95);
                        droplets.push({ x: p.x, y: p.splat, vx: Math.cos(a) * rand(0.05, 0.14), vy: Math.sin(a) * rand(0.05, 0.14), r: rand(1, 2), life: 0 });
                    }
                    return false;
                }
                if (p.y > H + 10 || p.life > 3000) return false;
                const shade = 1 - darkAt(p.x, p.y);
                ctx.fillStyle = `rgb(${Math.round(BLOOD[0] * shade)}, ${Math.round(BLOOD[1] * shade)}, ${Math.round(BLOOD[2] * shade)})`;
                ctx.beginPath();
                ctx.ellipse(p.x, p.y, p.r, p.r * Math.min(2, 1 + Math.abs(p.vy) * 1.2), 0, 0, Math.PI * 2);
                ctx.fill();
                return true;
            });
        },

        // Blood coating the wheel's rim: uneven, thicker toward the bottom, glossy on top
        ring(ctx, s) {
            const { size, pad } = s.ring;
            if (!size) return;
            const c = size / 2;
            const inner = c - pad;                     // the wheel's edge
            const steps = RIM_STEPS;
            ctx.beginPath();
            for (let i = 0; i <= steps; i++) {
                const a = (i / steps) * Math.PI * 2;
                const t = bandThickness(a, pad);
                const x = c + Math.cos(a) * (inner + t), y = c + Math.sin(a) * (inner + t);
                i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
            }
            for (let i = steps; i >= 0; i--) {
                const a = (i / steps) * Math.PI * 2;
                ctx.lineTo(c + Math.cos(a) * (inner - 2), c + Math.sin(a) * (inner - 2));
            }
            ctx.closePath();
            ctx.fillStyle = `rgb(${Math.round(BLOOD[0] * 0.78)}, ${Math.round(BLOOD[1] * 0.78)}, ${Math.round(BLOOD[2] * 0.78)})`;
            ctx.fill();
            ctx.strokeStyle = 'rgba(255, 90, 90, 0.35)';      // glossy highlight along the top
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            ctx.arc(c, c, inner + pad * 0.12, Math.PI * 1.15, Math.PI * 1.85);
            ctx.stroke();
        }
    };
})();

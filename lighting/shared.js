/* ==========================================================================
   STAGE LIGHTING — shared helpers
   Each theme registers a "rig" in Stage.rigs (see cinema.js, noir.js, ...).
   engine.js runs whichever rig matches <body data-theme="...">.

   A rig can define:
     kicker        text shown above the winner on the title card
     enter(s)      called when the theme turns on or the window resizes
     back(ctx, s)  paints the full-screen background canvas (behind everything)
     ring(ctx, s)  paints the ring around the wheel (optional)
     front(ctx, s) paints an overlay above the page (optional, used by Horror)

   The state object `s` has:
     W, H          viewport size in CSS pixels
     dt, now       ms since last frame, current time
     still         true when the user prefers reduced motion
     v             wheel speed 0..1
     spinning      wheel is turning
     landed        a winner is showing; sinceLand = ms since it landed
     geo           wheel geometry: cx, cy, radius, tipX, tipY (pointer tip)
     cursor        x, y, active (moved in the last 4s)
     ring          size and pad of the ring canvas
   ========================================================================== */
window.Stage = (() => {
    const lerp = (a, b, t) => a + (b - a) * t;
    const ease = (dt, ms) => 1 - Math.exp(-dt / ms);      // frame-rate independent smoothing
    const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
    const rand = (lo, hi) => lo + Math.random() * (hi - lo);

    // Soft round blob (fog, smoke, glows), drawn once and reused
    const spriteCache = {};
    function softSprite(rgb, size = 128) {
        const key = rgb + size;
        if (spriteCache[key]) return spriteCache[key];
        const c = document.createElement('canvas');
        c.width = c.height = size;
        const g = c.getContext('2d');
        const grad = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
        grad.addColorStop(0, `rgba(${rgb}, 1)`);
        grad.addColorStop(0.5, `rgba(${rgb}, 0.35)`);
        grad.addColorStop(1, `rgba(${rgb}, 0)`);
        g.fillStyle = grad;
        g.fillRect(0, 0, size, size);
        return (spriteCache[key] = c);
    }

    // Where a follow-light should be right now.
    // o: radius (in wheel radii) and alpha for each situation.
    function followTarget(s, o) {
        const { geo } = s;
        if (s.landed) {
            return { x: geo.tipX, y: geo.tipY + geo.radius * 0.25, r: geo.radius * o.landR, a: o.landA };
        }
        if (s.spinning) {
            return { x: geo.cx, y: geo.cy, r: geo.radius * o.spinR, a: o.spinA + 0.1 * s.v };
        }
        if (s.cursor.active) {
            return { x: s.cursor.x, y: s.cursor.y, r: o.cursorR, a: o.cursorA };
        }
        const t = s.still ? 0 : s.now * 0.0004;               // lazy drift around the wheel
        return {
            x: geo.cx + Math.cos(t) * geo.radius * 0.5,
            y: geo.cy + Math.sin(t * 1.3) * geo.radius * 0.35,
            r: o.idleR, a: o.idleA
        };
    }

    // Glide a light toward its target with a hand-operated lag
    function moveSpot(spot, target, s, lagMs = 240) {
        if (!spot.ready) { Object.assign(spot, target); spot.ready = true; return; }
        const k = ease(s.dt, s.landed ? 180 : lagMs);
        spot.x = lerp(spot.x, target.x, k);
        spot.y = lerp(spot.y, target.y, k);
        spot.r = lerp(spot.r, target.r, ease(s.dt, 300));
        spot.a = lerp(spot.a, target.a, ease(s.dt, 300));
    }

    // Brightness of ring light i: chases while idle/spinning, flashes on a win, then stays on
    function chaseLevel(i, s, offset) {
        if (s.still) return 0.85;
        if (s.landed && s.sinceLand < 1400) return Math.floor(s.sinceLand / 175) % 2 === 0 ? 1 : 0.12;
        if (s.landed) return 1;
        const pos = (((offset - i) % 3) + 3) % 3;
        return pos < 1 ? 1 - pos * 0.6 : 0.15;
    }

    // Is point (px, py) inside a beam? Returns 0..1 brightness.
    function beamLight(px, py, beam, length, halfNear, halfFar) {
        const dx = px - beam.ox, dy = py - beam.oy;
        const sin = Math.sin(beam.angle), cos = Math.cos(beam.angle);
        const along = dx * sin - dy * cos;
        if (along <= 0 || along >= length) return 0;
        const across = Math.abs(dx * cos + dy * sin);
        const half = halfNear + (halfFar - halfNear) * (along / length);
        return across < half ? (1 - across / half) * (1 - along / length) : 0;
    }

    function vignette(ctx, s, strength = 0.7) {
        const { W, H } = s;
        const g = ctx.createRadialGradient(W / 2, H * 0.55, Math.min(W, H) * 0.35, W / 2, H * 0.55, Math.max(W, H) * 0.8);
        g.addColorStop(0, 'rgba(0, 0, 0, 0)');
        g.addColorStop(1, `rgba(0, 0, 0, ${strength})`);
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, W, H);
    }

    return { lerp, ease, clamp, rand, softSprite, followTarget, moveSpot, chaseLevel, beamLight, vignette, rigs: {} };
})();

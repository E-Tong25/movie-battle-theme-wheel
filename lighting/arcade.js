/* ==========================================================================
   ARCADE — inside the cabinet
   A pixel starfield scrolls like a shoot-'em-up and stretches into warp
   streaks while the wheel spins. The cursor glow is drawn in dithered pixels.
   CRT scanlines sit over everything (see lighting.css). Pixel blocks chase
   around the wheel. The whole background renders at 1/4 resolution and is
   scaled up without smoothing, so everything comes out chunky on purpose.
   ========================================================================== */
(() => {
    const { followTarget, moveSpot, chaseLevel } = window.Stage;

    const PIXEL = 4;             // one "arcade pixel" = 4 screen pixels
    // 4x4 ordered-dither thresholds (Bayer matrix)
    const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map(n => (n + 0.5) / 16);

    let low = null, lctx = null, lw = 0, lh = 0;
    let stars = [];
    let chase = 0;
    const spot = {};

    const LAYERS = [
        { count: 70, speed: 0.004, color: [20, 90, 20] },
        { count: 40, speed: 0.009, color: [60, 190, 60] },
        { count: 20, speed: 0.018, color: [190, 255, 190] }
    ];

    window.Stage.rigs.arcade = {
        kicker: 'Next stage',

        enter(s) {
            lw = Math.ceil(s.W / PIXEL);
            lh = Math.ceil(s.H / PIXEL);
            low = document.createElement('canvas');
            low.width = lw;
            low.height = lh;
            lctx = low.getContext('2d', { willReadFrequently: true });   // its pixels are read every frame
            stars = [];
            LAYERS.forEach((layer, li) => {
                const n = Math.round(layer.count * (lw * lh) / (320 * 200));
                for (let i = 0; i < n; i++) stars.push({ x: Math.random() * lw, y: Math.random() * lh, layer: li });
            });
        },

        back(ctx, s) {
            const { dt, v } = s;
            lctx.fillStyle = '#000';
            lctx.fillRect(0, 0, lw, lh);

            // Stars (streak into warp lines while spinning)
            const warp = 1 + v * 30;
            stars.forEach(st => {
                const layer = LAYERS[st.layer];
                if (!s.still) {
                    st.y += layer.speed * warp * dt;
                    if (st.y > lh) { st.y = -2; st.x = Math.random() * lw; }
                }
                const [r, g, b] = layer.color;
                lctx.fillStyle = `rgb(${r}, ${g}, ${b})`;
                const trail = Math.max(1, Math.round(v * (st.layer + 1) * 6));
                lctx.fillRect(Math.floor(st.x), Math.floor(st.y) - trail + 1, 1, trail);
            });

            // Dithered glow around the cursor / wheel
            moveSpot(spot, followTarget(s, {
                landR: 0.9, landA: 0.9, spinR: 1.5, spinA: 0.55,
                cursorR: 170, cursorA: 0.6, idleR: 210, idleA: 0.4
            }), s, 200);
            const cx = spot.x / PIXEL, cy = spot.y / PIXEL, r = spot.r / PIXEL;
            const x0 = Math.max(0, Math.floor(cx - r)), x1 = Math.min(lw, Math.ceil(cx + r));
            const y0 = Math.max(0, Math.floor(cy - r)), y1 = Math.min(lh, Math.ceil(cy + r));
            if (x1 > x0 && y1 > y0) {
                const img = lctx.getImageData(x0, y0, x1 - x0, y1 - y0);
                const d = img.data;
                const w = x1 - x0;
                for (let y = y0; y < y1; y++) {
                    for (let x = x0; x < x1; x++) {
                        const dist = Math.hypot(x - cx, y - cy) / r;
                        if (dist >= 1) continue;
                        const level = (1 - dist) * spot.a;
                        const threshold = BAYER[(x & 3) + ((y & 3) << 2)];
                        const i = ((y - y0) * w + (x - x0)) * 4;
                        if (level > threshold) { d[i + 1] = Math.max(d[i + 1], 70); d[i] = Math.max(d[i], 8); }
                        if (level > threshold + 0.45) { d[i + 1] = Math.max(d[i + 1], 140); }
                    }
                }
                lctx.putImageData(img, x0, y0);
            }

            // One mild green flash when the wheel lands
            if (s.landed && s.sinceLand < 140 && !s.still) {
                lctx.fillStyle = 'rgba(0, 255, 0, 0.18)';
                lctx.fillRect(0, 0, lw, lh);
            }

            ctx.imageSmoothingEnabled = false;
            ctx.drawImage(low, 0, 0, lw * PIXEL, lh * PIXEL);
            ctx.imageSmoothingEnabled = true;
        },

        // Square pixel blocks that chase in steps (no smooth fading: it's 8-bit)
        ring(ctx, s) {
            const { size, pad } = s.ring;
            if (!size) return;
            const c = size / 2, r = c - pad / 2;
            const block = Math.max(4, Math.round(pad * 0.36));
            let count = Math.round((2 * Math.PI * r) / (block * 2.2));
            count -= count % 3;
            if (!s.still) chase += s.dt * (0.003 + s.v * 0.04);
            const steppedChase = Math.floor(chase);                  // jump a whole block at a time

            for (let i = 0; i < count; i++) {
                const level = chaseLevel(i, s, steppedChase);
                const a = (i / count) * Math.PI * 2 - Math.PI / 2;
                const x = Math.round(c + Math.cos(a) * r - block / 2);
                const y = Math.round(c + Math.sin(a) * r - block / 2);
                ctx.fillStyle = level > 0.5 ? '#00ff00' : '#003300';
                ctx.fillRect(x, y, block, block);
                if (level > 0.5) {
                    ctx.fillStyle = 'rgba(0, 255, 0, 0.25)';
                    ctx.fillRect(x - 2, y - 2, block + 4, block + 4);
                }
            }
        }
    };
})();

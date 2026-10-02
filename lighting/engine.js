/* ==========================================================================
   STAGE LIGHTING — engine
   Creates the drawing layers, tracks the wheel and cursor, and runs the rig
   for the current theme every frame. Rigs live in lighting/<theme>.js.
   ========================================================================== */
(() => {
    const Stage = window.Stage;
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
    const body = document.body;
    const wheelBox = document.querySelector('.wheel-container');
    const pointerEl = document.getElementById('pointer');

    // ---------- Layers ----------
    function makeCanvas(cls) {
        const c = document.createElement('canvas');
        c.className = `stage-layer ${cls}`;
        c.setAttribute('aria-hidden', 'true');
        return c;
    }
    function makeDiv(cls) {
        const d = document.createElement('div');
        d.className = cls;
        d.setAttribute('aria-hidden', 'true');
        return d;
    }

    const back = makeCanvas('stage-back');      // behind the page
    const ring = makeCanvas('stage-ring');      // around the wheel
    const front = makeCanvas('stage-front');    // over the page (Horror darkness)
    body.prepend(back);
    wheelBox.appendChild(ring);
    body.append(front, makeDiv('stage-crt'), makeDiv('stage-grain'),
                makeDiv('stage-bar stage-bar-top'), makeDiv('stage-bar stage-bar-bottom'));

    const kicker = document.createElement('p');
    kicker.className = 'stage-kicker';
    const winnerHeading = document.getElementById('modalWinner');
    winnerHeading.parentNode.insertBefore(kicker, winnerHeading);

    const bctx = back.getContext('2d');
    const rctx = ring.getContext('2d');
    const fctx = front.getContext('2d');

    // Film grain: a noise tile saved as lighting/film-grain.png (set in lighting.css, shown or
    // hidden per theme). A saved file, not one drawn at load time, so the site's strict
    // security policy (_headers) doesn't need to allow embedded images.

    // ---------- Shared state handed to every rig ----------
    const s = {
        W: 0, H: 0, dpr: 1, dt: 16, now: 0, still: false, v: 0,
        spinning: false, landed: false, landedAt: 0, sinceLand: 0, spinStartAt: -Infinity,
        geo: { cx: 0, cy: 0, radius: 180, tipX: 0, tipY: 0 },
        cursor: { x: 0, y: 0, lastMove: -Infinity, active: false },
        ring: { size: 0, pad: 0 }
    };

    let rig = null;
    let rigName = '';

    function resize() {
        s.dpr = Math.min(window.devicePixelRatio || 1, 2);
        s.W = window.innerWidth;
        s.H = window.innerHeight;
        [[back, bctx], [front, fctx]].forEach(([c, ctx]) => {
            c.width = s.W * s.dpr;
            c.height = s.H * s.dpr;
            ctx.setTransform(s.dpr, 0, 0, s.dpr, 0, 0);
        });
        const rr = ring.getBoundingClientRect();
        s.ring.size = rr.width;
        s.ring.pad = (rr.width - wheelBox.getBoundingClientRect().width) / 2;
        ring.width = rr.width * s.dpr;
        ring.height = rr.height * s.dpr;
        rctx.setTransform(s.dpr, 0, 0, s.dpr, 0, 0);
        if (rig && rig.enter) rig.enter(s);
    }

    window.addEventListener('resize', resize);
    new ResizeObserver(() => { if (rig) resize(); }).observe(wheelBox);

    window.addEventListener('pointermove', e => {
        s.cursor.x = e.clientX;
        s.cursor.y = e.clientY;
        s.cursor.lastMove = performance.now();
    });
    document.documentElement.addEventListener('pointerleave', () => { s.cursor.lastMove = -Infinity; });

    window.addEventListener('wheel:spin', () => { s.spinStartAt = performance.now(); });
    window.addEventListener('wheel:land', () => {
        s.landed = true;
        s.landedAt = performance.now();
        body.classList.add('stage-landed');
    });
    window.addEventListener('wheel:closed', () => {
        s.landed = false;
        body.classList.remove('stage-landed');
    });

    function readWheel() {
        const w = wheelBox.getBoundingClientRect();
        const p = pointerEl.getBoundingClientRect();
        s.geo.cx = w.left + w.width / 2;
        s.geo.cy = w.top + w.height / 2;
        s.geo.radius = w.width / 2;
        s.geo.tipX = p.left + p.width / 2;
        s.geo.tipY = p.bottom;
    }

    // ---------- Loop ----------
    let running = false;
    let last = 0;

    function frame(now) {
        if (!running || !rig) return;
        s.dt = Math.min(now - last, 50);
        s.now = now;
        last = now;
        s.still = reducedMotion.matches;
        const motion = window.wheelMotion || {};
        s.spinning = !!motion.spinning;
        s.v = Math.min((motion.velocity || 0) / 3, 1);
        s.sinceLand = now - s.landedAt;
        s.cursor.active = now - s.cursor.lastMove < 4000;
        readWheel();

        bctx.globalCompositeOperation = 'source-over';
        bctx.globalAlpha = 1;
        rig.back(bctx, s);

        if (rig.ring) {
            rctx.clearRect(0, 0, s.ring.size, s.ring.size);
            rig.ring(rctx, s);
        }
        if (rig.front) {
            fctx.clearRect(0, 0, s.W, s.H);
            rig.front(fctx, s);
        }
        requestAnimationFrame(frame);
    }

    function sync() {
        const name = body.dataset.theme;
        const next = Stage.rigs[name] || null;
        body.classList.toggle('stage', !!next);
        body.classList.toggle('stage-has-ring', !!(next && next.ring));
        body.classList.toggle('stage-has-front', !!(next && next.front));

        if (next !== rig) {
            rig = next;
            rigName = name;
            if (rig) {
                kicker.textContent = rig.kicker || '';
                resize();                                    // also calls rig.enter()
            }
        }

        const shouldRun = !!rig && !document.hidden;
        if (shouldRun && !running) {
            running = true;
            last = performance.now();
            requestAnimationFrame(frame);
        } else if (!shouldRun) {
            running = false;
        }
    }

    new MutationObserver(sync).observe(body, { attributes: true, attributeFilter: ['data-theme'] });
    document.addEventListener('visibilitychange', sync);
    sync();
})();

/* Battle Night: the reveal (montage, its sound, the slam-in) and the revealed page */
import { audioCtx } from '../core/sounds.js';
import { el, h } from '../core/page-elements.js';
import { coinFlip } from './actions.js';
import { dress, movieArt } from './movie-art.js';
import { render, tick } from './page.js';
import { posterEl } from './movie-picker.js';
import { S, me, nameOf, proto, saveProto, them } from './shared-state.js';

export function revealCards() {
    const card = side => h('div', { class: 'reveal-card' },
        h('p', { class: 'night-kicker' }, side === me() ? 'Your champion' : `${nameOf(side)}\u2019s champion`),
        posterEl(S.night.players[side].movie, S.night.players[side].pick, 'medium', side),
        h('p', { class: 'reveal-title' }, S.night.players[side].pick,
            S.night.players[side].movie && S.night.players[side].movie.year ? h('span', { class: 'pick-year' }, ` (${S.night.players[side].movie.year})`) : null),
        S.night.watchOrder ? h('p', { class: 'reveal-order' }, S.night.watchOrder === side ? 'Plays first' : 'Plays second') : null);
    return h('div', { class: 'reveal-row' }, card(me()), h('span', { class: 'reveal-vs' }, 'VS'), card(them()));
}

export function renderWatchOrder(main) {
    if (S.night.watchOrder) {
        const first = S.night.watchOrder;
        main.append(h('p', { class: 'night-center night-ok' }, `${nameOf(first)}\u2019s pick, ${S.night.players[first].pick}, plays first.`));
        return;
    }
    const coin = h('span', { class: 'coin', 'aria-hidden': 'true' });
    main.append(h('section', { class: 'night-card night-center' },
        h('p', {}, 'Who goes first?'), coin,
        h('button', { type: 'button', class: 'night-btn primary', onclick: e => { e.currentTarget.disabled = true; coinFlip(coin, side => { S.night.watchOrder = side; }); } }, 'Flip for watch order')));
}

// ---------- The reveal montage ----------
// Full-screen stills from the two movies, alternating, speeding up with every cut,
// timed to the reveal sound: the posters slam in on its impact.
const REVEAL_SOUND = 'audio/reveal-windup.mp3';
const IMPACT = 9.21;               // seconds into the sound where the big hit starts
const SLAM_LEAD = 0.4;             // start the slam-in this much earlier, so the posters land on the hit
const MONTAGE_END = IMPACT - SLAM_LEAD;
const TOTAL_CUTS = 30;             // 15 stills per movie, alternating
const MIN_CUT = 0.125;             // never faster than 8 cuts a second
const SPEED_UP = 0.88;             // each cut is 12% shorter than the one before (until the minimum)
const BLACK_OPEN = 1.0;            // the sound starts over black; the first image begins rising after this
const FADE_CUTS = 3;               // the first three images slowly fade up from (and back into) darkness
const REEL_MIN = 3;                // a movie with fewer stills than this: countdown instead
const START_WITH = 2;              // stills per movie that must be loaded before the montage starts
const TARGET_LUMA = 0.3;           // every still is evened out to about this brightness (0-1)

// When each cut starts, in seconds into the sound (after the black opening). Solves for
// the first cut's length so all 30 end exactly on time.
function cutTimes() {
    const span = MONTAGE_END - BLACK_OPEN;
    const total = n => d0 => Array.from({ length: n }, (_, i) => Math.max(MIN_CUT, d0 * Math.pow(SPEED_UP, i))).reduce((a, b) => a + b, 0);
    let lo = MIN_CUT, hi = 5;
    for (let k = 0; k < 40; k++) { const mid = (lo + hi) / 2; if (total(TOTAL_CUTS)(mid) > span) hi = mid; else lo = mid; }
    const lengths = Array.from({ length: TOTAL_CUTS }, (_, i) => Math.max(MIN_CUT, lo * Math.pow(SPEED_UP, i)));
    const starts = []; let t = BLACK_OPEN;
    lengths.forEach(len => { starts.push(t); t += len; });
    return { starts, lengths };
}

// How bright a still is (0-1), so every frame can be evened out. Needs TMDB's images to
// allow it (they send CORS headers); if not, the still is simply shown without evening out.
function measureLuma(img) {
    try {
        const c = document.createElement('canvas'); c.width = 32; c.height = 18;
        const g = c.getContext('2d', { willReadFrequently: true }); g.drawImage(img, 0, 0, 32, 18);
        const d = g.getImageData(0, 0, 32, 18).data; let sum = 0;
        for (let i = 0; i < d.length; i += 4) sum += (0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2]) / 255;
        return sum / (d.length / 4);
    } catch (e) { return null; }
}
// Loads a still and fully decodes it before it's needed, then keeps that ready image.
// Showing a prepared image means the browser never draws it in pieces mid-cut (which can
// flash a dark block, often in a corner, for a frame).
function loadStill(src) {
    const attempt = cors => new Promise(resolve => {
        const img = new Image();
        if (cors) img.crossOrigin = 'anonymous';
        img.decoding = 'async';
        img.alt = '';
        img.className = 'mt-img';
        img.onload = async () => {
            try { if (img.decode) await img.decode(); } catch (e) { /* drawn normally instead */ }
            resolve({ src, img, luma: cors ? measureLuma(img) : null });
        };
        img.onerror = () => resolve(null);
        img.src = src;
    });
    return attempt(true).then(r => r || attempt(false));
}
// Each movie's reel: the list of stills, plus the ones loaded so far (filled in as they arrive)
async function prepareReel(movie) {
    const d = await movieArt(movie);
    const small = window.innerWidth < 700 || document.body.dataset.theme === 'arcade';
    const list = d ? ((small ? d.stillsSmall : d.stills) || []) : [];
    const reel = { total: list.length, loaded: [], ready: null };
    let resolveReady;
    reel.ready = new Promise(r => { resolveReady = r; });
    if (list.length < REEL_MIN) { resolveReady(false); return reel; }
    let done = 0;
    list.forEach((src, i) => loadStill(src).then(still => {
        done++;
        if (still) reel.loaded.push({ ...still, order: i });
        if (reel.loaded.length >= START_WITH) resolveReady(true);
        else if (done === list.length) resolveReady(reel.loaded.length >= 1);
    }));
    return reel;
}

// ---------- The reveal sound ----------
// Shares js/core/sounds.js's audio context when it exists, otherwise makes one of its own (once)
let ownAudioContext = null;
const sfxContext = () => (typeof audioCtx !== 'undefined' ? audioCtx
    : (ownAudioContext = ownAudioContext || new (window.AudioContext || window.webkitAudioContext)()));
let revealBufferJob = null;
function loadRevealSound() {                  // decoded once, then reused
    if (!revealBufferJob) revealBufferJob = (async () => {
        try {
            const data = await (await fetch(REVEAL_SOUND)).arrayBuffer();
            return await new Promise((res, rej) => sfxContext().decodeAudioData(data, res, rej));
        } catch (e) { return null; }
    })();
    return revealBufferJob;
}
// Plays the sound from `offset` seconds. Returns a clock (seconds into the sound) that the
// montage follows, so the cuts stay locked to the audio. If sound can't play (not allowed
// yet, or opened from files), a plain timer keeps the same timing silently.
async function playRevealSound(offset, delay = 0) {
    const buffer = await loadRevealSound();
    const ctx = sfxContext();
    if (buffer) {
        try { if (ctx.state === 'suspended') await ctx.resume(); } catch (e) { /* not allowed yet */ }
        if (ctx.state === 'running') {
            const src = ctx.createBufferSource(), gain = ctx.createGain();
            src.buffer = buffer;
            src.connect(gain); gain.connect(ctx.destination);
            const startAt = ctx.currentTime + 0.05 + delay;
            // starting partway through the build: ease in instead of cutting in at full volume
            gain.gain.setValueAtTime(offset > 0 ? 0 : 0.9, startAt);
            if (offset > 0) gain.gain.linearRampToValueAtTime(0.9, startAt + 0.5);
            src.start(startAt, offset);
            return { now: () => ctx.currentTime - startAt + offset,
                     stop: () => { try { gain.gain.setTargetAtTime(0, ctx.currentTime, 0.08); src.stop(ctx.currentTime + 0.4); } catch (e) { /* already stopped */ } } };
        }
    }
    const t0 = performance.now();
    const timerClock = () => offset + (performance.now() - t0) / 1000 - delay;
    try {
        const el = new Audio(REVEAL_SOUND);
        el.volume = offset > 0 ? 0.4 : 0.9;
        el.preload = 'auto';
        let playing = false;
        const begin = () => el.play().then(() => {
            if (offset) el.currentTime = offset;
            playing = true;
            if (offset > 0) setTimeout(() => { try { el.volume = 0.9; } catch (e) { /* iPhones: fixed volume */ } }, 400);
        });
        if (delay > 0) setTimeout(() => begin().catch(() => {}), delay * 1000);
        else await begin();
        // the element's own clock can lag at the very start; use whichever is further along
        return { now: () => (playing ? Math.max(el.currentTime, timerClock() - 0.25) : timerClock()), stop: () => el.pause() };
    } catch (e) {
        return { now: timerClock, stop: () => {} };
    }
}

// ---------- The theatrical reveal ----------
const SHOW_LINES = {
    cyberpunk: 'Decrypting champions', cinema: 'Now presenting', noir: 'The evidence',
    arcade: 'Player select', horror: 'They have been summoned', fantasy: 'The prophecy is revealed'
};
export let showing = false;
export const revealKey = () => `${S.night.id}:${S.night.players.a.pick}:${S.night.players.b.pick}:${me()}`;

export function playRevealShow() {
    if (showing || !S.night) return;
    proto.seen[revealKey()] = true;
    saveProto();
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;   // posters show directly instead
    showing = true;
    const theme = document.body.dataset.theme || 'cinema';
    const num = h('span', { class: 'rs-num' }, '3');
    const leader = h('div', { class: 'rs-leader', 'aria-hidden': 'true' }, h('div', { class: 'rs-sweep' }), h('div', { class: 'rs-cross' }), num);
    const art = {};
    const fig = (side, cls) => {
        const logo = h('img', { class: 'rs-logo', alt: S.night.players[side].pick, hidden: true });
        const title = h('span', { class: 'rs-title' }, S.night.players[side].pick);
        art[side] = { logo, title, bg: h('div', { class: `rs-bd ${cls}`, 'aria-hidden': 'true' }) };
        return h('figure', { class: `rs-poster ${cls}` },
            posterEl(S.night.players[side].movie, S.night.players[side].pick, 'large', side),
            h('figcaption', {}, h('span', { class: 'rs-who' }, side === me() ? 'You' : nameOf(side)), logo, title));
    };
    const cont = h('button', { type: 'button', class: 'night-btn primary rs-continue' }, 'Continue');
    const duel = h('div', { class: 'rs-duel' }, fig(me(), 'left'), h('span', { class: 'rs-vs' }, 'VS'), fig(them(), 'right'));
    // The montage stage: two stacked full-screen layers, so every cut blends in over the last
    const layers = [h('div', { class: 'mt-layer' }), h('div', { class: 'mt-layer' })];
    const stage = h('div', { class: 'mt-stage', 'aria-hidden': 'true' }, ...layers);   // pictures only, no text
    const show = h('div', { class: `reveal-show rs-${theme} waiting`, role: 'dialog', 'aria-modal': 'true', 'aria-label': `Champions revealed: ${S.night.players[me()].pick} versus ${S.night.players[them()].pick}` },
        art[me()].bg, art[them()].bg,                                   // each movie's backdrop fills its half after the slam
        stage,
        h('div', { class: 'rs-beams', 'aria-hidden': 'true' }),
        h('div', { class: 'rs-burst', 'aria-hidden': 'true' }),
        h('div', { class: 'rs-flash', 'aria-hidden': 'true' }),
        h('p', { class: 'rs-kicker' }, SHOW_LINES[theme] || 'Now presenting'),
        leader,
        duel,
        cont);
    document.body.append(show);
    [me(), them()].forEach(side => dress(S.night.players[side].movie,
        { ...art[side], onBackdrop: () => show.classList.add('has-backdrops') }));
    cont.focus();

    // ---------- The sequence ----------
    const timers = [];
    let stopped = false, sound = null, impactPlayed = false;
    const wait = ms => new Promise(r => timers.push(setTimeout(r, ms)));
    const tick = n => { num.textContent = n; leader.classList.remove('tick'); void leader.offsetWidth; leader.classList.add('tick'); };
    const frameUntil = (clock, t) => new Promise(resolve => {
        const step = () => { if (stopped || clock.now() >= t) return resolve(); requestAnimationFrame(step); };
        requestAnimationFrame(step);
    });
    loadRevealSound();                                            // decode while the stills load
    const reelsJob = Promise.all([me(), them()].map(side => prepareReel(S.night.players[side].movie)));

    // One cut: the next still punches in (slight zoom, drifting sideways) over the last one
    let turn = 0;
    function showFrame(still, lengthS, i) {
        turn ^= 1;
        const next = layers[turn], prev = layers[turn ^ 1];
        const drift = Math.random() < 0.5 ? -2.5 : 2.5;
        next.style.transition = 'none';
        next.replaceChildren(still.img);                             // the already-decoded image
        // even out brightness so cuts between a dark and a bright still aren't a flash
        const even = still.luma ? Math.min(1.5, Math.max(0.55, TARGET_LUMA / Math.max(0.05, still.luma))) : 1;
        next.style.setProperty('--even', even.toFixed(3));
        next.style.transform = `scale(1.14) translateX(${drift}%)`;
        next.style.zIndex = 2;
        prev.style.zIndex = 1;
        void next.offsetWidth;
        const move = `transform ${Math.round(lengthS * 1000 + 300)}ms cubic-bezier(0.2, 0.8, 0.2, 1)`;
        if (i < FADE_CUTS) {
            // Rising out of darkness: the last image sinks to black first, then this one fades up
            const sink = i === 0 ? 0 : 280;
            const rise = Math.round(Math.min(1200, lengthS * 1000 * 0.8));      // slow, out of the dark
            prev.style.transition = `opacity ${sink}ms ease-in`;
            prev.style.opacity = '0';
            next.style.transition = `opacity ${rise}ms ease-out ${sink}ms, ${move}`;
        } else {
            // Up to speed: quick blends from one still to the next
            next.style.transition = `opacity 80ms linear, ${move}`;
            timers.push(setTimeout(() => { prev.style.opacity = '0'; }, 80));
        }
        next.style.opacity = '1';
        next.style.transform = 'scale(1.02)';
    }
    async function runMontage(reels, clock) {
        const { starts, lengths } = cutTimes();
        show.classList.remove('waiting');
        show.classList.add('montage');
        let shown = -1;
        await new Promise(resolve => {
            const step = () => {
                if (stopped) return resolve();
                const t = clock.now();
                if (t >= MONTAGE_END) return resolve();
                let i = shown;
                while (i + 1 < starts.length && t >= starts[i + 1]) i++;
                if (i !== shown && i >= 0) {
                    shown = i;
                    const reel = reels[i % 2];                          // alternate: you, them, you, them...
                    const k = Math.floor(i / 2);
                    // the still meant for this cut, or one of this movie's already-loaded stills
                    const still = reel.loaded.find(s => s.order === k % reel.total) || reel.loaded[k % reel.loaded.length];
                    if (still) showFrame(still, lengths[i], i);
                }
                requestAnimationFrame(step);
            };
            requestAnimationFrame(step);
        });
    }
    const slam = () => {
        show.classList.remove('montage');
        show.classList.add('duel');
        impactPlayed = true;
        const accent = getComputedStyle(document.body).getPropertyValue('--log-accent').trim() || '#ffffff';
        if (typeof confetti === 'function') {
            confetti({ particleCount: 90, angle: 60, spread: 70, origin: { x: 0, y: 0.65 }, colors: [accent, '#ffffff'], zIndex: 2147483647 });
            confetti({ particleCount: 90, angle: 120, spread: 70, origin: { x: 1, y: 0.65 }, colors: [accent, '#ffffff'], zIndex: 2147483647 });
        }
    };
    (async () => {
        // Wait (up to 2.5s) for the stills, over plain darkness
        const reels = await reelsJob;
        const ready = await Promise.race([Promise.all(reels.map(r => r.ready)), wait(2500).then(() => null)]);
        if (stopped) return;
        if (ready && ready.every(Boolean)) {
            sound = await playRevealSound(0);                         // the sound starts over black; the pictures follow
            if (stopped) { sound.stop(); return; }
            await runMontage(reels, sound);
        } else {
            // Fallback: the 3-2-1 countdown over the end of the build, so the hit still lands on the slam
            show.classList.remove('waiting');
            sound = await playRevealSound(MONTAGE_END - 2.4);
            if (stopped) { sound.stop(); return; }
            const start = sound.now();
            tick('3');
            await frameUntil(sound, start + 0.8); if (stopped) return; tick('2');
            await frameUntil(sound, start + 1.6); if (stopped) return; tick('1');
            await frameUntil(sound, start + 2.4);
        }
        if (stopped) return;
        slam();
        await wait(1200);
        cont.classList.add('ready');
    })();
    const finish = () => {
        stopped = true;
        timers.forEach(clearTimeout);
        if (sound && !impactPlayed) sound.stop();                     // skipped early: cut the sound too
        show.classList.add('leaving');
        showing = false;
        render();                                                     // now draw the revealed page underneath
        setTimeout(() => { show.remove(); const t = document.getElementById('nightTheme'); if (t) t.focus(); }, 350);
    };
    cont.addEventListener('click', finish);
    show.addEventListener('keydown', e => {
        if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); finish(); }
        if (e.key === 'Tab') { e.preventDefault(); cont.focus(); }
    });
}

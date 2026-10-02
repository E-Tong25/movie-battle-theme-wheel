import { audioCtx } from '../core/sounds.js';
import { el } from '../core/page-elements.js';
import { BattleLog } from './battle-log.js';
import { GenreEditor } from './genre-editor.js';
import { Welcome } from './welcome-walkthrough.js';
import { BattleNight } from '../battle-night/page.js';
import { themePipeline } from '../wheel/themes.js';

/* ==========================================================================
   BACKGROUND MUSIC
   Each theme can have a looping track (set `music:` on its entry in
   themePipeline in js/wheel/themes.js). Music plays only while the wheel is waiting to
   be spun:
     - fades out when someone hits SPIN, and stays off through the spin and
       the title card; comes back when the result is closed
     - crossfades when you switch themes (Shift Spin doesn't matter: nothing
       plays during a spin)
     - softens while the Battle Log or Genre Editor is open
     - stops while the Battle Night page is open, or the tab is hidden
   Browsers block sound until the page is clicked, so music starts on the
   first click or tap anywhere (or on the Music button).

   On a hosted site, tracks play through the Web Audio mixer, which loops
   without gaps and fades smoothly everywhere (including iPhones). Opened
   straight from files, it falls back to a plain audio element.
   ========================================================================== */
const PREF_KEY = 'movieBattle.music';
const MASTER = 0.55;            // overall music level (0..1), under the tick and win sounds
const DUCKED = 0.4;             // level while a side panel is open
const FADE_IN = 1.2, FADE_OUT = 0.6, CROSSFADE = 1.0;   // seconds

const btn = document.getElementById('musicBtn');
let enabled = true;
try { enabled = localStorage.getItem(PREF_KEY) !== 'off'; } catch (e) { /* default on */ }
let unlocked = false;           // becomes true on the first click/tap/key
let idle = true;                // the wheel is waiting to be spun
let current = null;             // { url, stop(fade), setLevel(level, fade) }
let currentUrl = '';

// ---------- Which track goes with the current theme ----------
function themeTrack() {
    const name = document.body.dataset.theme;
    const entry = (typeof themePipeline !== 'undefined')
        ? themePipeline.find(t => t.css === `css/theme-${name}.css`) : null;
    return entry && entry.music ? entry.music : '';
}

// ---------- Audio plumbing ----------
let ctx = null, master = null;
function audio() {
    if (!ctx) {
        ctx = (typeof audioCtx !== 'undefined') ? audioCtx : new (window.AudioContext || window.webkitAudioContext)();
        master = ctx.createGain();
        master.gain.value = MASTER;
        master.connect(ctx.destination);
    }
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
}

const buffers = new Map();      // url -> Promise<AudioBuffer|null>
function loadBuffer(url) {
    if (!buffers.has(url)) {
        buffers.set(url, fetch(url)
            .then(r => { if (!r.ok) throw new Error(r.status); return r.arrayBuffer(); })
            .then(data => new Promise((res, rej) => audio().decodeAudioData(data, res, rej)))
            .catch(() => null));                      // e.g. opened from files: use the fallback
    }
    return buffers.get(url);
}

// Gapless looping through the mixer
function bufferVoice(buffer) {
    const c = audio();
    const src = c.createBufferSource();
    src.buffer = buffer;
    src.loop = true;
    const gain = c.createGain();
    gain.gain.value = 0;
    src.connect(gain);
    gain.connect(master);
    src.start();
    return {
        setLevel(level, fade) {
            const t = c.currentTime;
            gain.gain.cancelScheduledValues(t);
            gain.gain.setValueAtTime(gain.gain.value, t);
            gain.gain.linearRampToValueAtTime(level, t + fade);
        },
        stop(fade) {
            this.setLevel(0, fade);
            src.stop(c.currentTime + fade + 0.05);
        }
    };
}

// Fallback: a plain looping <audio> element with a hand-rolled fade
function elementVoice(url) {
    const el = new Audio(url);
    el.loop = true;
    el.volume = 0;
    el.play().catch(() => {});
    let target = 0, raf = 0;
    const fadeTo = (level, fade, done) => {
        cancelAnimationFrame(raf);
        const from = el.volume, start = performance.now(), ms = Math.max(1, fade * 1000);
        const step = t => {
            const k = Math.min(1, (t - start) / ms);
            try { el.volume = Math.max(0, Math.min(1, from + (level - from) * k)); } catch (e) { /* iPhones: volume is fixed */ }
            if (k < 1) raf = requestAnimationFrame(step); else if (done) done();
        };
        raf = requestAnimationFrame(step);
    };
    return {
        setLevel(level, fade) { target = level * MASTER; fadeTo(target, fade); },
        stop(fade) { fadeTo(0, fade, () => { el.pause(); el.src = ''; }); }
    };
}

// ---------- What should be playing right now? ----------
function wantedLevel() {
    if (!enabled || !unlocked || !idle || document.hidden) return 0;
    if (BattleNight && BattleNight.isOpen()) return 0;
    const panelOpen = (BattleLog && BattleLog.isOpen()) || (GenreEditor && GenreEditor.isOpen()) || (Welcome && Welcome.isOpen());
    return panelOpen ? DUCKED : 1;
}

let updating = Promise.resolve();
function update() { updating = updating.then(apply).catch(() => {}); return updating; }

let lastLevel = 0;
async function apply() {
    const level = wantedLevel();
    lastLevel = level;
    const url = level > 0 ? themeTrack() : '';

    if (!url) {                                        // silence: fade out whatever is playing
        if (current) { current.stop(FADE_OUT); current = null; currentUrl = ''; }
        renderButton();
        return;
    }
    if (current && currentUrl === url) {              // same track: just adjust the level
        current.setLevel(level, 0.4);
        renderButton();
        return;
    }
    // New track (first start, or a theme change): crossfade
    const old = current;
    currentUrl = url;
    const buffer = await loadBuffer(url);
    if (currentUrl !== url) return;                    // something changed while loading
    const voice = buffer ? bufferVoice(buffer) : elementVoice(url);
    if (old) old.stop(CROSSFADE);
    voice.setLevel(wantedLevel() || 0, old ? CROSSFADE : FADE_IN);
    current = voice;
    renderButton();
}

// ---------- The Music button ----------
function renderButton() {
    if (!btn) return;
    const hasTrack = !!themeTrack();
    btn.textContent = !enabled ? 'Music off' : (!unlocked ? 'Play music' : 'Music on');
    btn.setAttribute('aria-pressed', String(enabled));
    btn.title = hasTrack ? '' : 'This theme doesn\u2019t have music yet';
    btn.classList.toggle('no-track', !hasTrack);
}
if (btn) btn.addEventListener('click', () => {
    if (!unlocked) { unlocked = true; enabled = true; audio(); preloadAll(); }   // first press just starts it
    else enabled = !enabled;
    try { localStorage.setItem(PREF_KEY, enabled ? 'on' : 'off'); } catch (e) { /* ignore */ }
    update();
});

// ---------- Listen for what the rest of the app is doing ----------
const unlock = e => {
    if (unlocked) return;
    if (btn && e.target && btn.contains(e.target)) return;   // the button handles itself
    unlocked = true;
    audio();
    preloadAll();
    update();
};
['pointerdown', 'keydown', 'change'].forEach(ev => document.addEventListener(ev, unlock, { capture: true }));

// Load every theme's track once sound is allowed, so theme switches start instantly
function preloadAll() {
    if (typeof themePipeline === 'undefined') return;
    themePipeline.forEach(t => { if (t.music) loadBuffer(t.music); });
}

window.addEventListener('wheel:spin', () => { idle = false; update(); });
window.addEventListener('wheel:land', () => { idle = false; update(); });     // also covers the grand finale
window.addEventListener('wheel:closed', () => { idle = true; update(); });
document.addEventListener('visibilitychange', update);

// Theme changes, Battle Night opening/closing, and side panels opening/closing
new MutationObserver(update).observe(document.body, { attributes: true, attributeFilter: ['data-theme', 'class'] });
['logPanel', 'genrePanel'].forEach(id => {
    const el = document.getElementById(id);
    if (el) new MutationObserver(update).observe(el, { attributes: true, attributeFilter: ['hidden'] });
});
// The welcome walkthrough is created by welcome-walkthrough.js
setTimeout(() => {
    const w = document.querySelector('.welcome');
    if (w) new MutationObserver(update).observe(w, { attributes: true, attributeFilter: ['hidden'] });
}, 0);

renderButton();
export const Music = { update, isEnabled: () => enabled, isPlaying: () => !!current, track: () => currentUrl, level: () => (current ? lastLevel : 0),
                 mode: () => (current && current.setLevel && currentUrl && buffers.has(currentUrl) ? 'checking' : 'none') };

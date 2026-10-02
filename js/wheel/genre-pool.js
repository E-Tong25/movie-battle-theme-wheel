/* Wheel: the genre pool (up to 12 on the wheel, the rest on the bench) */
import { BattleStore, GenreStore } from '../core/saved-data.js';
import { drawWheel, normalizeChoice, resizeCanvasForHDPI } from './drawing.js';
import { themes } from './genres-and-colors.js';
import { isSpinning } from './spin.js';
import { UI } from './shared-state.js';

export let runtimeChoices = [];

/* --- GENRE POOL ---
   Every genre lives in allGenres. Up to WHEEL_MAX are on the wheel
   (runtimeChoices); the rest wait on the bench. Knocking one out ("HELL YA")
   pulls a random genre off the bench to take its place. Draws can favor genres
   you haven't battled yet (using the Battle Log). */
const WHEEL_MAX = 12;
export let allGenres = [];              // [{ id, title, label }]
export let eliminated = new Set();      // ids knocked out this session
let favorUnplayed = true;
let battleHistory = [];          // battles from the Battle Log (for favoring unplayed genres)

function defaultGenres() {
    const source = (typeof themes !== 'undefined' && themes.length) ? themes
        : ["Blah", "Blah", "Blah", "Blah", "Blah", "Blah", "Blah", "Blah"];
    return source.map((choice, i) => ({ id: `g${i + 1}`, ...normalizeChoice(choice) }));
}

// How likely a genre is to be drawn onto the wheel (never zero)
function genreWeight(genre) {
    if (!favorUnplayed || !battleHistory.length) return 1;
    const plays = battleHistory.filter(b => b.theme === genre.title);
    if (!plays.length) return 1;                                       // never battled: full chance
    const recent = [...battleHistory]
        .sort((x, y) => (y.date || '').localeCompare(x.date || '') || (y.createdAt || 0) - (x.createdAt || 0))
        .slice(0, 3).some(b => b.theme === genre.title);
    return Math.max(0.12, 0.6 / plays.length) * (recent ? 0.5 : 1);     // played often or lately: less likely
}

function weightedPick(list) {
    const total = list.reduce((sum, g) => sum + genreWeight(g), 0);
    let r = Math.random() * total;
    for (const g of list) {
        r -= genreWeight(g);
        if (r <= 0) return g;
    }
    return list[list.length - 1];
}

function benchGenres() {
    const onWheel = new Set(runtimeChoices.map(c => c.id));
    return allGenres.filter(g => !eliminated.has(g.id) && !onWheel.has(g.id));
}

// A fresh set for the wheel: everything if it fits, otherwise a (weighted) random 12
export function drawWheelSet() {
    let candidates = allGenres.filter(g => !eliminated.has(g.id));
    if (!candidates.length) { eliminated.clear(); candidates = [...allGenres]; }
    if (candidates.length <= WHEEL_MAX) {
        runtimeChoices = [...candidates];
        return;
    }
    const pool = [...candidates];
    runtimeChoices = [];
    while (runtimeChoices.length < WHEEL_MAX) {
        const g = weightedPick(pool);
        runtimeChoices.push(g);
        pool.splice(pool.indexOf(g), 1);
    }
}

// Fill any empty spots on the wheel from the bench (the first one at `atIndex`)
export function fillWheel(atIndex) {
    while (runtimeChoices.length < WHEEL_MAX) {
        const bench = benchGenres();
        if (!bench.length) break;
        const g = weightedPick(bench);
        if (atIndex !== undefined && atIndex <= runtimeChoices.length) {
            runtimeChoices.splice(atIndex, 0, g);
            atIndex = undefined;
        } else {
            runtimeChoices.push(g);
        }
    }
}

// "12 on the wheel · 5 on the bench"
export function renderBench() {
    if (!UI.benchInfo) return;
    const bench = benchGenres().length;
    const on = runtimeChoices.length;
    UI.benchInfo.textContent = bench
        ? `${on} on the wheel · ${bench} on the bench`
        : `${on} on the wheel`;
    if (UI.shuffleBtn) UI.shuffleBtn.disabled = isSpinning || bench === 0;
}

export function shuffleWheel() {
    if (isSpinning) return;
    drawWheelSet();
    drawWheel();
    renderBench();
}

// Called by the Genre Editor (and Import) with a new genre list
async function updateGenres(list, options = {}) {
    allGenres = list.map((g, i) => ({ id: g.id || `g${Date.now()}${i}`, ...normalizeChoice(g) }));
    if (typeof options.favorUnplayed === 'boolean') favorUnplayed = options.favorUnplayed;
    if (GenreStore) await GenreStore.save({ genres: allGenres, favorUnplayed });

    // Keep what's on the wheel where possible; drop deleted genres, pick up edits
    const byId = new Map(allGenres.map(g => [g.id, g]));
    eliminated = new Set([...eliminated].filter(id => byId.has(id)));
    runtimeChoices = runtimeChoices.map(c => byId.get(c.id)).filter(g => g && !eliminated.has(g.id));
    if (!runtimeChoices.length) drawWheelSet(); else fillWheel();
    drawWheel();
    renderBench();
    window.dispatchEvent(new CustomEvent('genres:changed', { detail: { genres: allGenres } }));
}

// Back to the starting list in js/wheel/genres-and-colors.js
async function resetGenres() {
    eliminated.clear();
    runtimeChoices = [];                  // empty wheel, so updateGenres draws a fresh set
    await updateGenres(defaultGenres(), { favorUnplayed: true });
}

// For the Genre Editor and Battle Log
export const MovieBattle = {
    genres: () => allGenres.map(g => ({ ...g })),
    favorUnplayed: () => favorUnplayed,
    updateGenres,
    resetGenres,
    defaultGenres,
    snapshotWheel,
    restoreWheel,
    wheelMax: WHEEL_MAX
};

// Keep the "favor unplayed" weights current as battles are logged
window.addEventListener('battlelog:changed', e => {
    battleHistory = (e.detail && e.detail.battles) || [];
});

function setupWheel() {
    if (runtimeChoices.length === 0) drawWheelSet();

    // Compute crisp screen boundaries before firing vectors
    resizeCanvasForHDPI();
    drawWheel();
    renderBench();
}

// A copy of the wheel's state, so an action can be undone
export function snapshotWheel() {
    return { choices: [...runtimeChoices], eliminated: new Set(eliminated) };
}
export function restoreWheel(snap) {
    if (isSpinning) return false;
    runtimeChoices = [...snap.choices];
    eliminated = new Set(snap.eliminated);
    drawWheel();
    renderBench();
    return true;
}
// Load the saved genre list (or the starting one in js/wheel/genres-and-colors.js) and draw the first wheel
export async function initGenres() {
    const saved = GenreStore ? await GenreStore.load() : null;
    allGenres = (saved && saved.genres.length >= 2)
        ? saved.genres.map((g, i) => ({ id: g.id || `g${i + 1}`, ...normalizeChoice(g) }))
        : defaultGenres();
    favorUnplayed = saved ? saved.favorUnplayed !== false : true;
    if (BattleStore) battleHistory = (await BattleStore.load()).battles || [];
    setupWheel();
}

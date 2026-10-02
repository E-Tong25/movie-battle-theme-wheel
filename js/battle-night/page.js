/* Battle Night: the page itself, drawing it, the once-a-second timer, and opening/closing */
import { el, h } from '../core/page-elements.js';
import { NightStore } from '../core/saved-data.js';
import { Toast } from '../features/messages.js';
import { startNight } from './actions.js';
import { renderChampions, renderSame } from './champions.js';
import { renderClueRecap, renderClues } from './clues.js';
import { posterSetupCard } from './movie-picker.js';
import { playRevealShow, renderWatchOrder, revealCards, revealKey, showing } from './reveal.js';
import { clueTimes, locked, phase, resolveMoments } from './rules.js';
import { bigCountdown, renderSchedule, scheduleSummary, updateBig } from './schedule.js';
import { S, me, names, now, proto, save, saveProto } from './shared-state.js';
import { fmtClock, fmtLeft } from './time-format.js';
import { prototypeBar, renderDone, renderForfeit, renderJudging, renderResults } from './verdict.js';
import { MovieBattle } from '../wheel/genre-pool.js';
import { eliminateOption } from '../wheel/title-card.js';

let lastWinner = '';
let opener = null;
let lastKey = '';

// ---------- Page shell ----------
const page = h('div', { id: 'nightPage', class: 'night-page', role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'nightTheme', hidden: true });
const sheet = h('div', { class: 'night-sheet' });
page.append(sheet);
document.body.append(page);
page.addEventListener('click', e => { if (e.target === page) close(); });

// ---------- Render ----------
export function render() {
    if (!S.night) { sheet.textContent = ''; return; }
    const ph = phase();
    lastKey = phaseKey();
    const n = names();
    const headerSub = { schedule: 'Pick a time', countdown: 'Countdown', same: 'Same-movie check', reveal: 'The reveal', judging: 'Judging', results: 'The verdict', forfeit: 'Forfeit', done: 'Logged' }[ph] || '';
    sheet.textContent = '';
    sheet.append(h('header', { class: 'night-header' },
        h('div', {},
            h('p', { class: 'night-kicker' }, `Battle night · ${headerSub}`),
            h('h2', { id: 'nightTheme', tabindex: '-1' }, S.night.theme),
            h('p', { class: 'night-players' }, `${n.a} vs ${n.b}`)),
        h('div', { class: 'night-header-actions' },
            h('button', { type: 'button', class: 'night-btn small', 'aria-expanded': String(!!S.ui.posterSetup), onclick: () => { S.ui.posterSetup = !S.ui.posterSetup; render(); } }, 'Posters'),
            h('button', { type: 'button', class: 'night-close', 'aria-label': 'Close battle night', onclick: close }, '\u00D7'))));

    const main = h('div', { class: 'night-main' });
    if (S.ui.posterSetup) main.append(posterSetupCard());
    if (ph === 'schedule') renderSchedule(main);
    if (ph === 'countdown') {
        if (S.night.extendedUntil) main.append(h('p', { class: 'night-warn' }, `Someone hasn\u2019t picked yet, so the reveal moved to ${fmtClock(S.night.extendedUntil)}. Miss this one and it\u2019s a forfeit.`));
        main.append(bigCountdown(S.night.battleAt, 'Until the battle'), scheduleSummary());
        renderChampions(main);
        renderClues(main);
    }
    if (ph === 'same') renderSame(main);
    // Nothing about the picks is drawn until the reveal sequence has played: the page stays
    // empty underneath it and fills in when it finishes
    const holdBack = (ph === 'reveal' || ph === 'judging') && (showing ||
        (!proto.seen[revealKey()] && !window.matchMedia('(prefers-reduced-motion: reduce)').matches));
    if (ph === 'reveal' && !holdBack) {
        main.append(h('p', { class: 'night-kicker night-center' }, 'Champions revealed'), revealCards(),
            h('div', { class: 'night-center' }, h('button', { type: 'button', class: 'night-link', onclick: playRevealShow }, 'Replay the reveal')));
        renderWatchOrder(main);
        main.append(bigCountdown(S.night.battleAt, 'Until the battle'), scheduleSummary());
        renderClueRecap(main);
    }
    if (ph === 'judging' && !holdBack) { main.append(revealCards()); renderJudging(main); }
    if (ph === 'results') renderResults(main);
    if (ph === 'forfeit') renderForfeit(main);
    if (ph === 'done') renderDone(main);
    sheet.append(main, prototypeBar());
    updateBenchButton();
    if ((ph === 'reveal' || ph === 'judging') && holdBack && !showing) playRevealShow();
}

// What would change the page: the phase, how many clues are out, who's locked in, etc.
function phaseKey() {
    if (!S.night) return 'none';
    const t = now();
    const clues = S.night.status === 'scheduled' ? clueTimes(S.night).filter(at => t >= at).length : 0;
    return [phase(), clues, locked('a'), locked('b'), !!S.night.extendedUntil, !!S.night.forfeit, S.night.same && S.night.same.loser, S.night.watchOrder,
            !!S.night.judging.a, !!S.night.judging.b, me(), S.night.status, S.night.proposal && S.night.proposal.by].join('|');
}

// ---------- Every second: countdowns, and re-render when a moment arrives ----------
export async function tick(force) {
    if (S.night) await resolveMoments();
    if (!page.hidden) {
        if (force || phaseKey() !== lastKey) render();
        else {
            page.querySelectorAll('[data-until]').forEach(el => { el.textContent = fmtLeft(Number(el.dataset.until) - now()); });
            page.querySelectorAll('[data-big-until]').forEach(updateBig);
            const c = page.querySelector('.proto-clock');
            if (c) c.textContent = proto.offset ? `+${fmtLeft(proto.offset)}` : 'now';
        }
    }
    updateBenchButton();
}
setInterval(() => tick(false), 1000);

// ---------- The "Battle night" button under the wheel ----------
const benchBtn = document.getElementById('nightBtn');
export function updateBenchButton() {
    if (!benchBtn) return;
    const ph = phase();
    benchBtn.hidden = ph === 'none' || ph === 'done';
    if (benchBtn.hidden) return;
    const text = {
        schedule: S.night.proposal ? (S.night.proposal.by === me() ? 'Waiting on a yes' : 'Battle invite!') : 'Pick a time',
        countdown: `Battle in ${fmtLeft(S.night.battleAt - now())}`,
        same: 'Same movie!', reveal: 'Champions revealed', judging: 'Judge now', results: 'See the verdict', forfeit: 'Forfeit!'
    }[ph];
    if (benchBtn.textContent !== text) benchBtn.textContent = text;
}

// ---------- Open / close ----------
const FOCUSABLE = 'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';
const isOpen = () => !page.hidden;
export function open() {
    if (!S.night) return;
    opener = document.activeElement;
    page.hidden = false;
    document.body.classList.add('night-open');
    render();
    const title = document.getElementById('nightTheme');
    if (title) title.focus();
}
export function close() {
    page.hidden = true;
    document.body.classList.remove('night-open');
    if (opener && opener.focus && document.contains(opener)) opener.focus();
}
document.addEventListener('keydown', e => {
    if (!isOpen() || showing) return;              // the reveal handles its own keys
    if (e.key === 'Escape') { e.preventDefault(); close(); return; }
    if (e.key === 'Tab') {
        const items = [...page.querySelectorAll(FOCUSABLE)].filter(x => x.offsetParent !== null && !x.disabled);
        if (!items.length) return;
        const first = items[0], last = items[items.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
});
if (benchBtn) benchBtn.addEventListener('click', open);

// ---------- "Lock it in" on the winner's title card ----------
window.addEventListener('wheel:land', e => { lastWinner = (e.detail && e.detail.winner) || ''; });
const scheduleBtn = document.getElementById('scheduleBtn');
if (scheduleBtn) scheduleBtn.addEventListener('click', async () => {
    if (!lastWinner) return;
    const replacing = S.night && S.night.status !== 'done' ? S.night : null;
    const wheelBefore = MovieBattle ? MovieBattle.snapshotWheel() : null;
    const offsetBefore = proto.offset;
    const theme = lastWinner;
    if (typeof eliminateOption === 'function') eliminateOption();   // it's your theme now, so it comes off the wheel
    proto.offset = 0; saveProto();
    await startNight(theme);
    open();
    if (replacing && Toast) {
        Toast.show(`Replaced your battle night for \u201C${replacing.theme}\u201D.`, {
            undo: async () => {
                S.night = replacing;
                proto.offset = offsetBefore; saveProto();
                await save();
                if (wheelBefore) MovieBattle.restoreWheel(wheelBefore);
                if (isOpen()) render();
                updateBenchButton();
            }
        });
    }
});

// ---------- Start ----------
(async () => {
    S.night = await NightStore.load();
    updateBenchButton();
})();

export const BattleNight = { isOpen, open, close };

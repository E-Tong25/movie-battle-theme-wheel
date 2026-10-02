/* Battle Night: clues, clue ideas, and the clue recap */
import { h } from '../core/page-elements.js';
import { ClueIdeas } from '../features/clue-ideas.js';
import { MovieDB } from '../features/movie-lookup.js';
import { open, render } from './page.js';
import { clueTimes, locked } from './rules.js';
import { countdownEl } from './schedule.js';
import { S, me, nameOf, now, save, them } from './shared-state.js';
import { fmtTime } from './time-format.js';

export function renderClues(main) {
    const times = clueTimes(S.night);
    const t = now();
    const mine = S.night.players[me()];
    const theirs = S.night.players[them()];

    const myList = h('ol', { class: 'clue-list' });
    const ideaSlots = [];                       // clue boxes that can show suggestions
    times.forEach((at, k) => {
        const open = t < at;
        const li = h('li', { class: `clue ${open ? '' : 'is-out'}` });
        if (open) {
            const box = h('textarea', { rows: 2, maxLength: 80, value: mine.clues[k], placeholder: 'Optional. Keep it cryptic.', 'aria-label': `Clue ${k + 1}`,
                oninput: () => { mine.clues[k] = box.value; save(); } });
            const ideasEl = h('div', { class: 'clue-ideas', 'aria-live': 'polite' });
            ideaSlots.push({ k, box, ideasEl });
            li.append(h('span', { class: 'clue-when' }, `Clue ${k + 1} · shown to ${nameOf(them())} `, countdownEl(at, 'inline'), ` (${fmtTime(at)})`), box, ideasEl);
        } else {
            li.append(h('span', { class: 'clue-when' }, `Clue ${k + 1} · revealed`), h('p', { class: 'clue-text' }, mine.clues[k].trim() || '(You gave no clue. Mysterious.)'));
        }
        myList.append(li);
    });

    const theirList = h('ol', { class: 'clue-list' });
    times.forEach((at, k) => {
        if (t >= at) {
            const text = theirs.clues[k].trim();
            theirList.append(h('li', { class: 'clue is-out' }, h('span', { class: 'clue-when' }, `Clue ${k + 1}`),
                h('p', { class: `clue-text ${text ? '' : 'none'}` }, text ? `\u201C${text}\u201D` : 'No clue given. Suspicious.')));
        } else {
            theirList.append(h('li', { class: 'clue is-locked' }, h('span', { class: 'clue-when' }, `Clue ${k + 1} unlocks in `, countdownEl(at, 'inline'))));
        }
    });

    fillClueIdeas(mine, ideaSlots);
    main.append(h('div', { class: 'clue-row' },
        h('section', { class: 'night-card' }, h('h3', {}, 'Your clues'), h('p', { class: 'night-hint' }, 'Up to three, all optional. Each one is shown when its time comes and can\u2019t be changed after.'), myList),
        h('section', { class: 'night-card' }, h('h3', {}, `${nameOf(them())}\u2019s clues`), theirList)));
}

// ---------- Clue ideas from TMDB (only the picker sees them) ----------
const IDEAS_SHOWN = 2;
async function fillClueIdeas(mine, slots) {
    if (!slots.length) return;
    const say = text => slots.forEach(({ ideasEl }) => { ideasEl.textContent = ''; ideasEl.append(h('span', { class: 'idea-note' }, text)); });
    if (!MovieDB || !MovieDB.hasKey()) {
        slots.forEach(({ ideasEl }) => { ideasEl.textContent = ''; ideasEl.append(h('span', { class: 'idea-note' }, 'Want clue ideas? ',
            h('button', { type: 'button', class: 'night-link', onclick: () => { S.ui.posterSetup = true; render(); } }, 'Set up Posters'), ' (free).')); });
        return;
    }
    if (!mine.movie || !mine.movie.id || !locked(me())) {
        say('Lock in a champion picked from the search list to get clue ideas.');
        return;
    }
    say('Finding ideas\u2026');
    let ideas;
    try { ideas = ClueIdeas.generate(await MovieDB.details(mine.movie.id)); }
    catch (e) { say('Couldn\u2019t load clue ideas right now.'); return; }
    S.ui.ideaOffset = S.ui.ideaOffset || {};

    const paint = ({ k, box, ideasEl }) => {
        if (!document.contains(box)) return;                      // the page has re-rendered
        const used = new Set(mine.clues.map(c => c.trim()));
        const pool = (ideas[k + 1] || []).filter(i => !used.has(i));
        ideasEl.textContent = '';
        if (!pool.length) { ideasEl.append(h('span', { class: 'idea-note' }, 'No more ideas for this one. Time to get creative.')); return; }
        const offset = (S.ui.ideaOffset[k] || 0) % pool.length;
        const shown = [...pool.slice(offset), ...pool.slice(0, offset)].slice(0, IDEAS_SHOWN);
        ideasEl.append(h('span', { class: 'idea-label' }, 'Ideas:'),
            ...shown.map(idea => h('button', { type: 'button', class: 'idea-chip', title: 'Use this clue (you can still edit it)', onclick: () => {
                box.value = idea;
                mine.clues[k] = idea;
                save();
                slots.forEach(paint);                               // it won't be offered for another box
                box.focus();
            } }, idea)),
            pool.length > IDEAS_SHOWN ? h('button', { type: 'button', class: 'night-link idea-more', onclick: () => {
                S.ui.ideaOffset[k] = (S.ui.ideaOffset[k] || 0) + IDEAS_SHOWN;
                paint({ k, box, ideasEl });
            } }, 'More ideas') : null);
    };
    slots.forEach(paint);
    // Typing in a box can free up (or use up) a suggestion elsewhere
    slots.forEach(({ box }) => box.addEventListener('change', () => slots.forEach(paint)));
}

export function renderClueRecap(main) {
    const recap = side => h('div', {}, h('p', { class: 'night-kicker' }, `${nameOf(side)}\u2019s clues`),
        h('ol', { class: 'clue-list recap' }, S.night.players[side].clues.map(c => h('li', {}, c.trim() ? `\u201C${c.trim()}\u201D` : 'No clue given. Suspicious.'))));
    main.append(h('section', { class: 'night-card clue-recap' }, recap(me()), recap(them())));
}

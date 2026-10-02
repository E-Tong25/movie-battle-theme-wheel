/* Battle Night: locking in champions, and the same-movie re-pick */
import { h } from '../core/page-elements.js';
import { coinFlip } from './actions.js';
import { render } from './page.js';
import { lockButton, moviePicker, posterEl } from './movie-picker.js';
import { checkSame, locked, normalize } from './rules.js';
import { S, me, nameOf, now, save, them } from './shared-state.js';

export function renderChampions(main) {
    const mine = S.night.players[me()];
    const myCard = h('section', { class: 'night-card champion mine' }, h('p', { class: 'night-kicker' }, 'Your champion'));
    if (locked(me())) {
        myCard.append(
            h('div', { class: 'locked-pick' }, posterEl(mine.movie, mine.pick, 'thumb'),
                h('p', { class: 'night-big' }, mine.pick, mine.movie && mine.movie.year ? h('span', { class: 'pick-year' }, ` (${mine.movie.year})`) : null)),
            h('p', { class: 'night-ok' }, `Locked in. ${nameOf(them())} can\u2019t see it until the reveal.`),
            h('button', { type: 'button', class: 'night-link', onclick: async () => { mine.lockedAt = null; await save(); render(); } }, 'Change my pick'));
    } else {
        const picker = moviePicker(mine.pick, mine.movie, 'Your champion movie');
        picker.input.addEventListener('input', () => { mine.pick = picker.input.value; save(); });
        const err = h('p', { class: 'form-error', role: 'alert' });
        myCard.append(picker.el, err, lockButton(picker, err, async (title, movie) => {
            mine.pick = title;
            mine.movie = movie;
            mine.lockedAt = now();
            await save();
            await checkSame();                 // same movie? find out right now
            render();
        }));
    }
    const theirCard = h('section', { class: `night-card champion theirs ${locked(them()) ? 'is-sealed' : ''}` },
        h('p', { class: 'night-kicker' }, `${nameOf(them())}\u2019s champion`),
        h('div', { class: `seal ${locked(them()) ? 'is-sealed' : 'is-open'}`, 'aria-hidden': 'true' }),   // drawn envelope (see css/battle-night.css)
        h('p', {}, locked(them()) ? `Sealed. ${nameOf(them())} has locked in a champion.` : `${nameOf(them())} is still choosing\u2026`));
    main.append(h('div', { class: 'champion-row' }, myCard, theirCard));
}

export function renderSame(main) {
    // Show the fuller spelling ("The Matrix" rather than "matrix")
    const side = S.night.players.a.pick.length >= S.night.players.b.pick.length ? 'a' : 'b';
    const title = S.night.players[side].pick;
    main.append(h('section', { class: 'night-card night-center same-card' },
        h('p', { class: 'night-kicker' }, 'Same-movie check'),
        posterEl(S.night.players[side].movie, title, 'medium'),
        h('p', { class: 'night-big' }, `You both picked ${title}.`),
        h('p', {}, 'Great minds\u2026 now fight about it. Someone has to pick something else.')));
    const loser = S.night.same.loser;
    if (!loser) {
        const coin = h('span', { class: 'coin', 'aria-hidden': 'true' });
        main.append(h('section', { class: 'night-card night-center' }, coin,
            h('button', { type: 'button', class: 'night-btn primary', onclick: e => { e.currentTarget.disabled = true; coinFlip(coin, s => { S.night.same.loser = s; }); } }, 'Flip to see who re-picks')));
        return;
    }
    if (loser === me()) {
        const picker = moviePicker('', null, 'Your new champion');
        const err = h('p', { class: 'form-error', role: 'alert' });
        main.append(h('section', { class: 'night-card' },
            h('p', {}, 'The coin says you re-pick. Your new champion stays sealed until the reveal.'), picker.el, err,
            lockButton(picker, err, async (newTitle, movie) => {
                const other = S.night.players[them()];
                const clash = movie && other.movie && movie.id ? movie.id === other.movie.id : normalize(newTitle) === normalize(other.pick);
                if (clash) { err.textContent = 'Nice try. Pick a different movie.'; return; }
                Object.assign(S.night.players[me()], { pick: newTitle, movie, lockedAt: now() });
                S.night.same = null;
                await save();
                await checkSame();
                render();
            })));
    } else {
        main.append(h('p', { class: 'night-center' }, `The coin says ${nameOf(loser)} re-picks. You keep your champion. Waiting for their new one\u2026`));
    }
}

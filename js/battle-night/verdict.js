/* Battle Night: judging, the verdict, forfeits, and the prototype bar */
import { h } from '../core/page-elements.js';
import { NightStore } from '../core/saved-data.js';
import { BattleLog } from '../features/battle-log.js';
import { computeResults, logResult, startNight } from './actions.js';
import { dress } from './movie-art.js';
import { close, render, tick, updateBenchButton } from './page.js';
import { posterEl } from './movie-picker.js';
import { clueTimes, effectiveReveal } from './rules.js';
import { CATEGORIES, HOUR, S, me, nameOf, now, proto, save, saveProto, them } from './shared-state.js';
import { fmtLeft, toLocalInput } from './time-format.js';

export function renderJudging(main) {
    const mine = S.night.judging[me()];
    const order = S.night.watchOrder ? [S.night.watchOrder, S.night.watchOrder === 'a' ? 'b' : 'a'] : ['a', 'b'];
    if (mine) {
        main.append(h('section', { class: 'night-card night-center' },
            h('p', { class: 'night-ok' }, 'Your scores are locked in.'),
            h('p', {}, S.night.judging[them()] ? '' : `Waiting for ${nameOf(them())} to finish judging. Their scores stay hidden until you\u2019ve both submitted.`)));
        return;
    }
    const draft = S.ui.draftScores[S.night.id] || (S.ui.draftScores[S.night.id] = { a: {}, b: {} });
    const submit = h('button', { type: 'button', class: 'night-btn primary', disabled: true }, 'Submit my scores');
    const complete = () => ['a', 'b'].every(m => CATEGORIES.every(c => draft[m][c.key]));
    const cards = order.map(movie => {
        const rows = CATEGORIES.map(c => {
            const group = h('div', { class: 'score-buttons', role: 'radiogroup', 'aria-label': `${c.label} for ${S.night.players[movie].pick}` });
            for (let v = 1; v <= 5; v++) {
                const b = h('button', { type: 'button', class: 'score-btn', role: 'radio', 'aria-checked': String(draft[movie][c.key] === v), onclick: () => {
                    draft[movie][c.key] = v;
                    group.querySelectorAll('.score-btn').forEach((x, i) => x.setAttribute('aria-checked', String(i + 1 === v)));
                    submit.disabled = !complete();
                } }, String(v));
                group.append(b);
            }
            return h('div', { class: 'score-row-line' }, h('span', {}, c.label), group);
        });
        return h('section', { class: 'night-card judge-card' },
            h('p', { class: 'night-kicker' }, movie === me() ? 'Your pick' : `${nameOf(movie)}\u2019s pick`),
            h('div', { class: 'locked-pick' }, posterEl(S.night.players[movie].movie, S.night.players[movie].pick, 'thumb'), h('p', { class: 'night-strong' }, S.night.players[movie].pick)), ...rows);
    });
    submit.disabled = !complete();
    submit.addEventListener('click', async () => {
        S.night.judging[me()] = { scores: JSON.parse(JSON.stringify(draft)), at: now() };
        await save();
        render();
    });
    main.append(h('p', { class: 'night-intro' }, `Score both movies, 1 to 5. ${nameOf(them())} won\u2019t see your scores until you\u2019ve both submitted.`),
        h('div', { class: 'judge-row' }, ...cards), h('div', { class: 'night-center' }, submit),
        h('p', { class: 'night-center night-hint' }, S.night.judging[them()] ? `${nameOf(them())} has submitted.` : `${nameOf(them())} is still judging.`));
}

export function renderResults(main) {
    const r = computeResults();
    const A = S.night.players.a.pick, B = S.night.players.b.pick;
    const headline = r.winner === 'tie'
        ? 'It\u2019s a tie. Nobody gets to be smug.'
        : `${nameOf(r.winner)} wins with ${S.night.players[r.winner].pick}!`;
    const table = h('table', { class: 'results-table' },
        h('thead', {}, h('tr', {}, h('th', {}, ''), h('th', {}, A), h('th', {}, B))),
        h('tbody', {}, ...CATEGORIES.map(c => h('tr', {}, h('th', {}, c.label), h('td', {}, r.byCat[c.key].a), h('td', {}, r.byCat[c.key].b))),
            h('tr', { class: 'total' }, h('th', {}, 'Total'), h('td', {}, r.total.a), h('td', {}, r.total.b))));
    main.append(verdictHero(r));
    main.append(h('section', { class: 'night-card night-center results-card' },
        h('p', { class: 'night-kicker' }, 'The verdict'),
        h('p', { class: 'night-big' }, headline),
        h('p', { class: 'results-score' }, `${r.total.a} \u2013 ${r.total.b}`),
        h('div', { class: 'table-wrap' }, table),
        h('p', { class: 'night-hint' }, 'Both judges\u2019 scores added together (out of 30 per movie).'),
        h('button', { type: 'button', class: 'night-btn primary', onclick: () => logResult({
            date: toLocalInput(S.night.battleAt).slice(0, 10), theme: S.night.theme, movieA: A, movieB: B, winner: r.winner,
            notes: `Scored ${r.total.a}\u2013${r.total.b}` + (S.night.watchOrder ? ` · ${nameOf(S.night.watchOrder)}\u2019s pick played first` : '')
        }) }, 'Save to Battle Log')));
}

// The winner's backdrop fills the stage with its title logo; the loser's poster
// sits small, faded to black and white, with a stamp. A tie splits the stage.
function verdictHero(r) {
    const score = `${r.total.a}\u2013${r.total.b}`;
    const block = side => {
        const p = S.night.players[side];
        const logo = h('img', { class: 'vh-logo', alt: p.pick, hidden: true });
        const title = h('p', { class: 'vh-title' }, p.pick);
        const bg = h('div', { class: 'vh-bg', 'aria-hidden': 'true' });
        dress(p.movie, { bg, logo, title, posterFallback: true });
        return { logo, title, bg };
    };
    if (r.winner === 'tie') {
        const a = block('a'), b = block('b');
        return h('section', { class: 'verdict-hero is-tie' },
            h('div', { class: 'vh-half' }, a.bg, h('div', { class: 'vh-content' }, a.logo, a.title, h('p', { class: 'vh-who' }, `${nameOf('a')}\u2019s pick`))),
            h('div', { class: 'vh-half' }, b.bg, h('div', { class: 'vh-content' }, b.logo, b.title, h('p', { class: 'vh-who' }, `${nameOf('b')}\u2019s pick`))),
            h('p', { class: 'vh-tie' }, `Dead heat \u00B7 ${score}`));
    }
    const win = r.winner, lose = win === 'a' ? 'b' : 'a';
    const winnerFirst = `${r.total[win]}\u2013${r.total[lose]}`;          // "28–18", winner's score first
    const w = block(win);
    const hero = h('section', { class: 'verdict-hero' }, w.bg,
        h('div', { class: 'vh-content' },
            h('p', { class: 'vh-label' }, 'The winner'),
            w.logo, w.title,
            h('p', { class: 'vh-who' }, `${nameOf(win)}\u2019s pick \u00B7 ${winnerFirst}`)),
        h('figure', { class: 'vh-loser' },
            posterEl(S.night.players[lose].movie, S.night.players[lose].pick, 'medium', lose),
            h('span', { class: 'vh-stamp' }, 'Better luck next time'),
            h('figcaption', {}, S.night.players[lose].pick)));
    // Confetti the first time each player sees the verdict
    const key = `verdict:${S.night.id}:${me()}`;
    if (!proto.seen[key] && !window.matchMedia('(prefers-reduced-motion: reduce)').matches && typeof confetti === 'function') {
        proto.seen[key] = true; saveProto();
        setTimeout(() => confetti({ particleCount: 160, spread: 90, origin: { y: 0.35 }, zIndex: 2147483647 }), 300);
    }
    return hero;
}

export function renderForfeit(main) {
    const missing = S.night.forfeit.missing;
    if (missing.length === 2) {
        main.append(h('section', { class: 'night-card night-center' },
            h('p', { class: 'night-big' }, 'Nobody picked a champion.'),
            h('p', {}, 'Two critics, zero movies. Pick a new time and try again?'),
            h('button', { type: 'button', class: 'night-btn primary', onclick: async () => { const theme = S.night.theme; await startNight(theme); render(); } }, 'Reschedule')));
        return;
    }
    const loser = missing[0], winner = loser === 'a' ? 'b' : 'a';
    main.append(h('section', { class: 'night-card night-center' },
        h('p', { class: 'night-kicker' }, 'Forfeit'),
        h('p', { class: 'night-big' }, `${nameOf(loser)} didn\u2019t pick in time. ${nameOf(winner)} wins by default.`),
        h('p', {}, 'Harsh? Yes. Fair? Also yes.'),
        h('button', { type: 'button', class: 'night-btn primary', onclick: () => logResult({
            date: toLocalInput(S.night.battleAt).slice(0, 10), theme: S.night.theme,
            movieA: S.night.players.a.pick && loser !== 'a' ? S.night.players.a.pick : (loser === 'a' ? '(no pick: forfeit)' : S.night.players.a.pick),
            movieB: S.night.players.b.pick && loser !== 'b' ? S.night.players.b.pick : (loser === 'b' ? '(no pick: forfeit)' : S.night.players.b.pick),
            winner, notes: `${nameOf(loser)} forfeited by missing the pick deadline.`
        }) }, 'Save to Battle Log')));
}

export function renderDone(main) {
    main.append(h('section', { class: 'night-card night-center' },
        h('p', { class: 'night-big' }, 'Battle logged.'),
        h('p', {}, 'The scoreboard has been updated. Spin the wheel whenever you\u2019re ready for the next one.'),
        h('div', { class: 'night-actions center' },
            h('button', { type: 'button', class: 'night-btn primary', onclick: () => { close(); if (BattleLog) BattleLog.open(); } }, 'Open Battle Log'),
            h('button', { type: 'button', class: 'night-btn', onclick: close }, 'Close'))));
}

export function prototypeBar() {
    const who = side => h('button', { type: 'button', class: `proto-btn ${me() === side ? 'on' : ''}`, 'aria-pressed': String(me() === side),
        onclick: () => { proto.viewAs = side; saveProto(); render(); } }, nameOf(side));
    const next = () => {
        if (!S.night) return;
        const t = now();
        const moments = [S.night.proposal && S.night.proposal.at];
        if (S.night.status === 'scheduled') moments.push(...clueTimes(S.night), effectiveReveal(S.night), S.night.battleAt);
        const upcoming = moments.filter(m => m && m > t).sort((x, y) => x - y)[0];
        proto.offset += (upcoming ? upcoming - t + 1000 : HOUR);
        saveProto();
        tick(true);
    };
    return h('footer', { class: 'proto-bar' },
        h('span', { class: 'proto-tag' }, 'Prototype'),
        h('span', { class: 'proto-group' }, 'Playing as ', who('a'), who('b')),
        h('span', { class: 'proto-group' }, 'Clock ', h('span', { class: 'proto-clock' }, proto.offset ? `+${fmtLeft(proto.offset)}` : 'now'),
            h('button', { type: 'button', class: 'proto-btn', onclick: next }, 'Skip to next moment'),
            h('button', { type: 'button', class: 'proto-btn', onclick: () => { proto.offset += HOUR; saveProto(); tick(true); } }, '+1 hour'),
            proto.offset ? h('button', { type: 'button', class: 'proto-btn', onclick: () => { proto.offset = 0; saveProto(); tick(true); } }, 'Back to now') : null),
        h('button', { type: 'button', class: 'proto-btn danger', onclick: async () => {
            if (!confirm('End this battle night? Its schedule, picks and clues will be cleared.')) return;
            await NightStore.clear(); S.night = null; proto.offset = 0; saveProto(); close(); updateBenchButton();
        } }, 'End battle night'));
}

/* Battle Night: proposing, accepting, coin flips, results and the calendar invite */
import { el, h } from '../core/page-elements.js';
import { BattleLog } from '../features/battle-log.js';
import { Toast } from '../features/messages.js';
import { render } from './page.js';
import { CATEGORIES, HOUR, MIN, S, me, names, newId, now, save } from './shared-state.js';

// ---------- Actions ----------
export async function startNight(theme) {
    S.night = {
        id: newId(), theme, status: 'proposed', createdAt: now(),
        proposal: null, battleAt: null, scheduledAt: null,
        deadline: 'extend', extendedUntil: null, forfeit: null,
        players: { a: { pick: '', movie: null, lockedAt: null, clues: ['', '', ''] }, b: { pick: '', movie: null, lockedAt: null, clues: ['', '', ''] } },
        same: null, sameChecked: false, watchOrder: null, judging: { a: null, b: null }, loggedId: null
    };
    S.ui = { reproposing: false, draftScores: {} };
    await save();
}

export async function propose(ms, deadline) {
    S.night.proposal = { by: me(), at: ms };
    S.night.deadline = deadline;
    S.night.status = 'proposed';
    S.ui.reproposing = false;
    await save();
    render();
}

export async function accept() {
    if (S.night.proposal.at <= now() + 5 * MIN) {
        if (Toast) Toast.show('That time has already passed (or is only minutes away). Suggest a new one.');
        S.ui.reproposing = true;
        return render();
    }
    S.night.battleAt = S.night.proposal.at;
    S.night.scheduledAt = now();
    S.night.status = 'scheduled';
    await save();
    render();
}

export async function coinFlip(el, apply) {
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (el && !reduce) {
        el.classList.add('flipping');
        await new Promise(r => setTimeout(r, 1200));
    }
    apply(Math.random() < 0.5 ? 'a' : 'b');
    await save();
    render();
}

export function computeResults() {
    const total = { a: 0, b: 0 };
    const byCat = {};
    CATEGORIES.forEach(c => { byCat[c.key] = { a: 0, b: 0 }; });
    ['a', 'b'].forEach(judge => {
        const s = S.night.judging[judge].scores;
        ['a', 'b'].forEach(movie => CATEGORIES.forEach(c => {
            const v = Number(s[movie][c.key]) || 0;
            total[movie] += v;
            byCat[c.key][movie] += v;
        }));
    });
    const winner = total.a === total.b ? 'tie' : (total.a > total.b ? 'a' : 'b');
    return { total, byCat, winner };
}

export async function logResult(entry) {
    if (!BattleLog) return;
    S.night.loggedId = await BattleLog.addBattle(entry);
    S.night.status = 'done';
    await save();
    render();
}

export function downloadICS() {
    const stamp = ms => new Date(ms).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
    const esc = t => String(t).replace(/[\\,;]/g, m => '\\' + m).replace(/\n/g, '\\n');
    const n = names();
    const ics = [
        'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Movie Battle//EN', 'BEGIN:VEVENT',
        `UID:${S.night.id}@movie-battle`, `DTSTAMP:${stamp(Date.now())}`,
        `DTSTART:${stamp(S.night.battleAt)}`, `DTEND:${stamp(S.night.battleAt + 4 * HOUR)}`,
        `SUMMARY:${esc(`Movie Battle: ${S.night.theme}`)}`,
        `DESCRIPTION:${esc(`${n.a} vs ${n.b}. Champions are revealed an hour before. Two critics. One couch. Zero mercy.`)}`,
        'BEGIN:VALARM', 'ACTION:DISPLAY', 'DESCRIPTION:Champions are revealed now!', 'TRIGGER:-PT1H', 'END:VALARM',
        'END:VEVENT', 'END:VCALENDAR'
    ].join('\r\n');
    const url = URL.createObjectURL(new Blob([ics], { type: 'text/calendar' }));
    const a = h('a', { href: url, download: 'movie-battle.ics' });
    document.body.append(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
}

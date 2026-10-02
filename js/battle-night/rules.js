/* Battle Night: the rules (reveal and clue times, locking in, the same-movie check, deadlines) */
import { CLUES, EXTENSION, REVEAL_BEFORE, S, now, save } from './shared-state.js';

const revealAt = n => n.battleAt - REVEAL_BEFORE;
export const effectiveReveal = n => n.extendedUntil || revealAt(n);
export function clueTimes(n) {
    const start = n.scheduledAt, end = revealAt(n);
    if (!start || end <= start) return Array(CLUES).fill(start || 0);
    return Array.from({ length: CLUES }, (_, k) => start + ((k + 1) / (CLUES + 1)) * (end - start));
}
export const locked = side => !!S.night.players[side].lockedAt && !!S.night.players[side].pick;
function samePick() {
    const a = S.night.players.a, b = S.night.players.b;
    if (a.movie && b.movie && a.movie.id && b.movie.id) return a.movie.id === b.movie.id;
    return normalize(a.pick) === normalize(b.pick);
}
// Runs the moment both champions are locked (not at the reveal)
export async function checkSame() {
    if (!S.night || S.night.status !== 'scheduled' || !(locked('a') && locked('b'))) return;
    const pair = `${S.night.players.a.pick}|${S.night.players.b.pick}|${S.night.players.a.lockedAt}|${S.night.players.b.lockedAt}`;
    if (S.night.checkedPair === pair) return;
    S.night.checkedPair = pair;
    if (samePick() && !(S.night.same && !S.night.same.resolved)) S.night.same = { loser: null, resolved: false };
    await save();
}
export const normalize = t => (t || '').toLowerCase().replace(/^the\s+/, '').replace(/[^a-z0-9]/g, '');

// ---------- Where are we? ----------
export function phase() {
    if (!S.night) return 'none';
    if (S.night.status === 'done') return 'done';
    if (S.night.status !== 'scheduled') return 'schedule';
    if (S.night.forfeit) return 'forfeit';
    if (S.night.same && !S.night.same.resolved) return 'same';
    const t = now();
    if (t < effectiveReveal(S.night) || !(locked('a') && locked('b'))) return 'countdown';
    if (t < S.night.battleAt) return 'reveal';
    if (S.night.judging.a && S.night.judging.b) return 'results';
    return 'judging';
}

// Deadline rules and the same-movie check, applied once their moment arrives
export async function resolveMoments() {
    if (!S.night || S.night.status !== 'scheduled' || S.night.forfeit) return;
    const t = now();
    if (t < effectiveReveal(S.night)) return;
    const missing = ['a', 'b'].filter(side => !locked(side));
    if (missing.length) {
        if (S.night.deadline === 'extend' && !S.night.extendedUntil) S.night.extendedUntil = revealAt(S.night) + EXTENSION;
        else S.night.forfeit = { missing };
        await save();
        return;
    }
    await checkSame();
}

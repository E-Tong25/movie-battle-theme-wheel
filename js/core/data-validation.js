/* Validate files and saved data before they reach the page. No DOM or storage here. */
const sides = ['a', 'b'];
const categories = ['fit', 'fun', 'rewatch'];
const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const text = (value, limit = 500) => typeof value === 'string' ? value.trim().slice(0, limit) : '';
const timestamp = value => typeof value === 'number' && Number.isFinite(value) && value > 0 && value <= 8640000000000000;
const id = () => globalThis.crypto?.randomUUID?.() || `b${Date.now()}${Math.random().toString(36).slice(2)}`;

export function validDate(value) {
    if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
    const date = new Date(`${value}T00:00:00Z`);
    return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}
const today = () => {
    const d = new Date(), pad = n => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

export function normalizeBattle(value) {
    if (!object(value) || !text(value.movieA, 80) || !text(value.movieB, 80) ||
        !text(value.theme, 60) || !['a', 'b', 'tie'].includes(value.winner)) return null;
    // Older backups may omit dates, but a supplied invalid date is never trusted.
    if (value.date !== undefined && !validDate(value.date)) return null;
    return {
        id: text(value.id, 100) || id(), date: value.date || today(),
        theme: text(value.theme, 60), movieA: text(value.movieA, 80), movieB: text(value.movieB, 80),
        winner: value.winner, notes: text(value.notes, 10000),
        createdAt: timestamp(value.createdAt) ? value.createdAt : Date.now()
    };
}

export function normalizeLog(value) {
    if (!object(value) || (value.version !== undefined && value.version !== 1) || !Array.isArray(value.battles)) throw new Error('Invalid Battle Log.');
    const battles = [], known = new Set();
    let skipped = 0;
    for (const entry of value.battles) {
        const battle = normalizeBattle(entry);
        if (!battle) { skipped++; continue; }
        if (!known.has(battle.id)) { known.add(battle.id); battles.push(battle); }
    }
    return {
        log: { version: 1, players: { a: text(value.players?.a, 24) || 'Player 1', b: text(value.players?.b, 24) || 'Player 2' },
            lastTheme: text(value.lastTheme, 60), battles },
        skipped
    };
}

export function normalizeGenres(value) {
    if (!object(value) || !Array.isArray(value.genres)) throw new Error('Invalid genre list.');
    const known = new Set();
    const genres = value.genres.filter(g => object(g) && text(g.title, 60)).map(g => {
        let genreId = text(g.id, 100) || id();
        if (known.has(genreId)) genreId = id();
        known.add(genreId);
        return { id: genreId, title: text(g.title, 60), label: text(g.label, 20) || text(g.title, 20) };
    });
    if (genres.length < 2) throw new Error('Keep at least two valid genres.');
    return { genres, favorUnplayed: value.favorUnplayed !== false };
}

export const emptyScores = () => ({ a: {}, b: {} });
export function normalizeScores(value, complete = false) {
    const result = emptyScores();
    for (const movie of sides) for (const category of categories) {
        const score = value?.[movie]?.[category];
        if (Number.isInteger(score) && score >= 1 && score <= 5) result[movie][category] = score;
        else if (complete) throw new Error('Incomplete or invalid submitted scores.');
    }
    return result;
}
export const scoresComplete = value => sides.every(movie => categories.every(category =>
    Number.isInteger(value?.[movie]?.[category]) && value[movie][category] >= 1 && value[movie][category] <= 5));

function normalizeMovie(value, pick) {
    if (!object(value) || !Number.isSafeInteger(value.id) || value.id <= 0 || value.title !== pick) return null;
    const image = src => {
        try {
            const url = new URL(src);
            return url.origin === 'https://image.tmdb.org' && url.pathname.startsWith('/t/p/') ? url.href : '';
        } catch { return ''; }
    };
    return { id: value.id, title: pick, year: text(value.year, 4), poster: image(value.poster), posterLarge: image(value.posterLarge) };
}

export function normalizeNight(value) {
    if (value === null) return null;
    if (!object(value) || !text(value.id, 100) || !text(value.theme, 60) || !['proposed', 'scheduled', 'done'].includes(value.status) ||
        !object(value.players) || !sides.every(side => object(value.players[side]) && typeof value.players[side].pick === 'string')) throw new Error('Invalid active battle.');
    if (value.status !== 'proposed' && (!timestamp(value.battleAt) || !timestamp(value.scheduledAt))) throw new Error('Invalid battle schedule.');
    const night = {
        id: text(value.id, 100), theme: text(value.theme, 60), status: value.status,
        createdAt: timestamp(value.createdAt) ? value.createdAt : Date.now(),
        proposal: null, battleAt: timestamp(value.battleAt) ? value.battleAt : null,
        scheduledAt: timestamp(value.scheduledAt) ? value.scheduledAt : null,
        deadline: value.deadline === 'forfeit' ? 'forfeit' : 'extend',
        extendedUntil: timestamp(value.extendedUntil) ? value.extendedUntil : null,
        // Infer quick-start for older, short-notice scheduled battles too.
        quickStart: typeof value.quickStart === 'boolean' ? value.quickStart :
            !!(value.scheduledAt && value.battleAt && value.battleAt - value.scheduledAt <= 3600000),
        players: {}, judging: { a: null, b: null }, draftScores: { a: emptyScores(), b: emptyScores() },
        forfeit: null, same: null, watchOrder: sides.includes(value.watchOrder) ? value.watchOrder : null,
        loggedId: text(value.loggedId, 100) || null
    };
    if (value.proposal !== null && value.proposal !== undefined) {
        if (!object(value.proposal) || !sides.includes(value.proposal.by) || !timestamp(value.proposal.at)) throw new Error('Invalid battle proposal.');
        night.proposal = { by: value.proposal.by, at: value.proposal.at };
    }
    if (value.extendedUntil != null && (!timestamp(value.extendedUntil) || value.extendedUntil <= value.battleAt - 3600000)) throw new Error('Invalid extension deadline.');
    for (const side of sides) {
        const player = value.players[side], pick = text(player.pick, 80);
        night.players[side] = { pick, movie: normalizeMovie(player.movie, pick),
            lockedAt: pick && timestamp(player.lockedAt) ? player.lockedAt : null,
            clues: Array.from({ length: 3 }, (_, k) => text(player.clues?.[k], 80)) };
        if (value.judging?.[side] != null) {
            night.judging[side] = { scores: normalizeScores(value.judging[side].scores, true),
                at: timestamp(value.judging[side].at) ? value.judging[side].at : Date.now() };
        }
        night.draftScores[side] = normalizeScores(value.draftScores?.[side]);
    }
    if (value.forfeit != null) {
        if (!Array.isArray(value.forfeit.missing) || !value.forfeit.missing.length || !value.forfeit.missing.every(s => sides.includes(s))) throw new Error('Invalid forfeit.');
        night.forfeit = { missing: [...new Set(value.forfeit.missing)] };
    }
    if (value.same != null) {
        if (!object(value.same) || (value.same.loser != null && !sides.includes(value.same.loser))) throw new Error('Invalid same-movie check.');
        night.same = { loser: value.same.loser || null, resolved: value.same.resolved === true };
    }
    return night;
}

export function prepareBackup(value) {
    const data = Array.isArray(value) ? { battles: value } : value;
    const { log, skipped } = normalizeLog(data);
    if (data.backupVersion !== undefined && ![1, 2].includes(data.backupVersion)) throw new Error('Unsupported backup version.');
    // A file with only invalid records must not replace genres or an active battle.
    if (data.battles.length && !log.battles.length) throw new Error('No valid battles in this file.');
    const genres = data.genres === undefined ? null : normalizeGenres(data);
    const night = data.night === undefined || data.night === null ? null : normalizeNight(data.night);
    return { log, skipped, genres, night };
}

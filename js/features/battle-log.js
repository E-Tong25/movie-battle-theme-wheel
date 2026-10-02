import { $, el } from '../core/page-elements.js';
import { BattleStore } from '../core/saved-data.js';
import { Toast } from './messages.js';
import { themes } from '../wheel/genres-and-colors.js';
import { MovieBattle } from '../wheel/genre-pool.js';

const els = {
    btn: $('logBtn'), panel: $('logPanel'), backdrop: $('logBackdrop'), close: $('logClose'),
    warning: $('logWarning'),
    nameA: $('nameA'), nameB: $('nameB'), scoreA: $('scoreA'), scoreB: $('scoreB'),
    detail: $('scoreDetail'), quip: $('scoreQuip'),
    form: $('battleForm'), formTitle: $('formTitle'), date: $('fDate'), theme: $('fTheme'),
    movieA: $('fMovieA'), movieB: $('fMovieB'), notes: $('fNotes'),
    labelMovieA: $('labelMovieA'), labelMovieB: $('labelMovieB'), labelWinA: $('labelWinA'), labelWinB: $('labelWinB'),
    error: $('formError'), save: $('formSave'), cancel: $('formCancel'),
    list: $('historyList'), empty: $('historyEmpty'),
    exportBtn: $('exportBtn'), importFile: $('importFile'), status: $('logStatus')
};

let log = BattleStore.emptyLog();
let editingId = null;
let opener = null;

// ---------- Helpers ----------
const todayISO = () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
const niceDate = iso => {
    const [y, m, d] = (iso || '').split('-').map(Number);
    if (!y) return iso || '';
    return new Date(y, m - 1, d).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
};
const newId = () => (window.crypto && crypto.randomUUID) ? crypto.randomUUID() : `b${Date.now()}${Math.random().toString(36).slice(2, 8)}`;
const nameOf = side => (log.players[side] || '').trim() || (side === 'a' ? 'Player 1' : 'Player 2');
function sortedBattles() {
    return [...log.battles].sort((x, y) => (y.date || '').localeCompare(x.date || '') || (y.createdAt || 0) - (x.createdAt || 0));
}
function setStatus(message) {
    els.status.textContent = message;
    clearTimeout(setStatus.timer);
    setStatus.timer = setTimeout(() => { els.status.textContent = ''; }, 4000);
}
const announce = () => window.dispatchEvent(new CustomEvent('battlelog:changed', { detail: { battles: log.battles } }));
async function persist() {
    const ok = await BattleStore.save(log);
    announce();                                   // lets the wheel favor genres you haven't battled
    if (!ok && BattleStore.isPersistent()) setStatus('Could not save. Try exporting a backup.');
}

// ---------- Scoreboard ----------
function stats() {
    const s = { a: 0, b: 0, tie: 0, total: log.battles.length, streakSide: null, streak: 0 };
    log.battles.forEach(b => { if (s[b.winner] !== undefined) s[b.winner]++; });
    for (const b of sortedBattles()) {                  // newest first
        if (b.winner === 'tie') break;
        if (!s.streakSide) s.streakSide = b.winner;
        if (b.winner !== s.streakSide) break;
        s.streak++;
    }
    return s;
}

function quip(s) {
    const A = nameOf('a'), B = nameOf('b');
    if (s.total === 0) return 'No battles yet. The couch is quiet… for now.';
    if (s.streak >= 3) return `${nameOf(s.streakSide)} has won ${s.streak} in a row and is absolutely insufferable about it.`;
    const lead = Math.abs(s.a - s.b);
    if (lead === 0) return "Dead even. Nobody gets to be smug. Yet.";
    const leader = s.a > s.b ? A : B, trailer = s.a > s.b ? B : A;
    if (lead >= 3) return `${leader} is up by ${lead}. ${trailer}, this is getting embarrassing.`;
    return `${leader} leads, but it's anyone's couch.`;
}

function renderScore() {
    const s = stats();
    els.scoreA.textContent = s.a;
    els.scoreB.textContent = s.b;
    els.scoreA.classList.toggle('leading', s.a > s.b);
    els.scoreB.classList.toggle('leading', s.b > s.a);
    const parts = [`${s.total} battle${s.total === 1 ? '' : 's'}`];
    if (s.tie) parts.push(`${s.tie} tie${s.tie === 1 ? '' : 's'}`);
    if (s.streak >= 2) parts.push(`${nameOf(s.streakSide)}: ${s.streak} in a row`);
    els.detail.textContent = parts.join(' · ');
    els.quip.textContent = quip(s);
}

// ---------- Names ----------
function renderNames() {
    if (document.activeElement !== els.nameA) els.nameA.value = log.players.a;
    if (document.activeElement !== els.nameB) els.nameB.value = log.players.b;
    const A = nameOf('a'), B = nameOf('b');
    els.labelMovieA.textContent = `${A}'s movie`;
    els.labelMovieB.textContent = `${B}'s movie`;
    els.labelWinA.textContent = A;
    els.labelWinB.textContent = B;
}
[['a', els.nameA], ['b', els.nameB]].forEach(([side, input]) => {
    input.addEventListener('change', async () => {
        log.players[side] = input.value.trim() || (side === 'a' ? 'Player 1' : 'Player 2');
        await persist();
        renderAll();
    });
});

// ---------- Theme choices ----------
function renderThemeOptions(selected) {
    const titles = MovieBattle
        ? MovieBattle.genres().map(g => g.title)
        : (typeof themes !== 'undefined' ? themes : []).map(t => typeof t === 'string' ? t : (t.title || t.label));
    const all = [...new Set([...titles, ...log.battles.map(b => b.theme), log.lastTheme].filter(Boolean))];
    els.theme.textContent = '';
    all.forEach(t => els.theme.appendChild(Object.assign(el('option', '', t), { value: t })));
    if (selected && all.includes(selected)) els.theme.value = selected;
}

// ---------- Form ----------
function resetForm() {
    editingId = null;
    els.form.reset();
    els.date.value = todayISO();
    renderThemeOptions(log.lastTheme);
    els.formTitle.textContent = 'Log a battle';
    els.save.textContent = 'Save battle';
    els.cancel.hidden = true;
    els.error.textContent = '';
}

function startEdit(battle) {
    editingId = battle.id;
    renderThemeOptions(battle.theme);
    els.date.value = battle.date;
    els.movieA.value = battle.movieA;
    els.movieB.value = battle.movieB;
    els.notes.value = battle.notes || '';
    const radio = els.form.querySelector(`input[name="fWinner"][value="${battle.winner}"]`);
    if (radio) radio.checked = true;
    els.formTitle.textContent = 'Edit battle';
    els.save.textContent = 'Save changes';
    els.cancel.hidden = false;
    els.error.textContent = '';
    els.form.scrollIntoView({ behavior: 'smooth', block: 'start' });
    els.movieA.focus();
}

els.cancel.addEventListener('click', resetForm);

els.form.addEventListener('submit', async e => {
    e.preventDefault();
    const winner = (els.form.querySelector('input[name="fWinner"]:checked') || {}).value;
    const entry = {
        date: els.date.value || todayISO(),
        theme: els.theme.value,
        movieA: els.movieA.value.trim(),
        movieB: els.movieB.value.trim(),
        winner,
        notes: els.notes.value.trim()
    };
    if (!entry.movieA || !entry.movieB) { els.error.textContent = 'Both movies need a name.'; return; }
    if (!entry.winner) { els.error.textContent = 'Pick a winner (or call it a tie).'; return; }

    if (editingId) {
        const i = log.battles.findIndex(b => b.id === editingId);
        if (i > -1) log.battles[i] = { ...log.battles[i], ...entry };
        setStatus('Battle updated.');
    } else {
        log.battles.push({ id: newId(), createdAt: Date.now(), ...entry });
        setStatus(winner === 'tie' ? 'Logged. A tie? Coward energy from both of you.' : `Logged. ${nameOf(winner)} wins this round.`);
    }
    await persist();
    resetForm();
    renderAll();
});

// ---------- History ----------
function renderHistory() {
    const battles = sortedBattles();
    els.list.textContent = '';
    els.empty.hidden = battles.length > 0;
    battles.forEach(b => {
        const li = el('li', `battle${b.winner === 'tie' ? ' is-tie' : ''}`);
        const meta = el('div', 'battle-meta');
        meta.append(el('span', 'battle-date', niceDate(b.date)), el('span', 'battle-theme', b.theme));

        const match = el('div', 'battle-match');
        [['a', b.movieA], ['b', b.movieB]].forEach(([side, movie], k) => {
            const pick = el('div', `battle-pick${b.winner === side ? ' won' : ''}`);
            pick.append(el('span', 'pick-movie', movie), el('span', 'pick-who', b.winner === side ? `${nameOf(side)} \u00B7 Winner` : nameOf(side)));
            match.append(pick);
            if (k === 0) match.append(el('span', 'battle-vs', b.winner === 'tie' ? 'Tie' : 'vs'));
        });

        li.append(meta, match);
        if (b.notes) li.append(el('p', 'battle-notes', b.notes));

        const actions = el('div', 'battle-actions');
        const edit = el('button', 'log-link', 'Edit');
        edit.type = 'button';
        edit.addEventListener('click', () => startEdit(b));
        const del = el('button', 'log-link danger', 'Delete');
        del.type = 'button';
        del.addEventListener('click', async () => {
            const removed = log.battles.find(x => x.id === b.id);
            log.battles = log.battles.filter(x => x.id !== b.id);
            if (editingId === b.id) resetForm();
            await persist();
            renderAll();
            const undo = async () => { log.battles.push(removed); await persist(); renderAll(); };
            if (Toast) Toast.show(`Deleted \u201C${b.movieA} vs ${b.movieB}\u201D.`, { undo });
            else setStatus('Battle deleted.');
        });
        actions.append(edit, del);
        li.append(actions);
        els.list.append(li);
    });
}

function renderAll() {
    renderNames();
    renderScore();
    renderHistory();
}

// ---------- Export / import ----------
els.exportBtn.addEventListener('click', () => {
    // The backup includes your genre list too, so it can move to another device
    const backup = MovieBattle
        ? { ...log, genres: MovieBattle.genres(), favorUnplayed: MovieBattle.favorUnplayed() }
        : log;
    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `movie-battle-log-${todayISO()}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    setStatus(`Exported ${log.battles.length} battle${log.battles.length === 1 ? '' : 's'}.`);
});

function validBattle(b) {
    return b && typeof b === 'object' && typeof b.movieA === 'string' && typeof b.movieB === 'string'
        && ['a', 'b', 'tie'].includes(b.winner) && typeof b.theme === 'string';
}

els.importFile.addEventListener('change', () => {
    const file = els.importFile.files && els.importFile.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async () => {
        try {
            const data = JSON.parse(reader.result);
            const incoming = Array.isArray(data) ? data : data.battles;
            if (!Array.isArray(incoming)) throw new Error('no battles');
            const known = new Set(log.battles.map(b => b.id));
            let added = 0, skipped = 0;
            incoming.forEach(b => {
                if (!validBattle(b)) { skipped++; return; }
                const id = b.id || newId();
                if (known.has(id)) return;                 // already have it
                log.battles.push({ id, date: b.date || todayISO(), theme: b.theme, movieA: b.movieA, movieB: b.movieB,
                                   winner: b.winner, notes: typeof b.notes === 'string' ? b.notes : '', createdAt: b.createdAt || Date.now() });
                known.add(id);
                added++;
            });
            // Take the names from the backup if this log still has the default ones
            if (data.players) {
                ['a', 'b'].forEach(side => {
                    const current = log.players[side];
                    if ((current === 'Player 1' || current === 'Player 2') && data.players[side]) log.players[side] = String(data.players[side]).slice(0, 24);
                });
            }
            // Offer the backup's genre list too, if it has one that differs from yours
            let genresNote = '';
            if (MovieBattle && Array.isArray(data.genres) && data.genres.length >= 2) {
                const clean = data.genres.filter(g => g && typeof g.title === 'string' && g.title.trim())
                    .map(g => ({ id: g.id, title: g.title.trim().slice(0, 60), label: String(g.label || g.title).trim().slice(0, 20) }));
                const same = JSON.stringify(clean.map(g => [g.title, g.label])) ===
                             JSON.stringify(MovieBattle.genres().map(g => [g.title, g.label]));
                if (clean.length >= 2 && !same) {
                    const previous = MovieBattle.genres(), previousFavor = MovieBattle.favorUnplayed();
                    await MovieBattle.updateGenres(clean, typeof data.favorUnplayed === 'boolean' ? { favorUnplayed: data.favorUnplayed } : {});
                    genresNote = ` Genres updated (${clean.length}).`;
                    if (Toast) Toast.show(`Your genres were replaced with the ${clean.length} from the backup.`, {
                        undo: () => MovieBattle.updateGenres(previous, { favorUnplayed: previousFavor })
                    });
                }
            }
            await persist();
            renderAll();
            setStatus(`Imported ${added} battle${added === 1 ? '' : 's'}${skipped ? ` (${skipped} unreadable skipped)` : ''}.${genresNote}`);
        } catch (err) {
            setStatus("That file doesn't look like a Movie Battle log.");
        }
        els.importFile.value = '';
    };
    reader.readAsText(file);
});

// ---------- Open / close ----------
const FOCUSABLE = 'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';
function isOpen() { return !els.panel.hidden; }

function open() {
    opener = document.activeElement;
    renderAll();
    if (!editingId) resetForm();
    els.panel.hidden = false;
    els.backdrop.hidden = false;
    requestAnimationFrame(() => {
        els.panel.classList.add('open');
        els.backdrop.classList.add('open');
    });
    document.getElementById('logTitle').focus();       // start at the top, without a focus box on a button
}

function close() {
    els.panel.classList.remove('open');
    els.backdrop.classList.remove('open');
    const finish = () => {
        els.panel.hidden = true;
        els.backdrop.hidden = true;
    };
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduce) finish(); else setTimeout(finish, 280);
    if (opener && opener.focus) opener.focus();
}

els.btn.addEventListener('click', open);
els.close.addEventListener('click', close);
els.backdrop.addEventListener('click', close);
document.addEventListener('keydown', e => {
    if (!isOpen()) return;
    if (e.key === 'Escape') { e.preventDefault(); close(); return; }
    if (e.key === 'Tab') {                                  // keep focus inside the panel
        const items = [...els.panel.querySelectorAll(FOCUSABLE)].filter(x => !x.hidden && x.offsetParent !== null && !x.disabled);
        if (!items.length) return;
        const first = items[0], last = items[items.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
});

// Remember the theme the wheel picks, to pre-fill the next entry
window.addEventListener('wheel:land', async e => {
    const theme = e.detail && e.detail.winner;
    if (!theme) return;
    log.lastTheme = theme;
    await persist();
    if (!editingId) renderThemeOptions(theme);
});

// New or renamed genres show up in the theme choices
window.addEventListener('genres:changed', () => { if (!editingId) renderThemeOptions(els.theme.value || log.lastTheme); });

// ---------- Start ----------
(async () => {
    log = await BattleStore.load();
    els.warning.hidden = BattleStore.isPersistent();
    resetForm();
    renderAll();
    announce();
})();

// Used by Battle Night to read names and save a finished battle
async function addBattle(entry) {
    const battle = { id: newId(), createdAt: Date.now(), notes: '', ...entry };
    log.battles.push(battle);
    await persist();
    renderAll();
    return battle.id;
}
const players = () => ({ a: nameOf('a'), b: nameOf('b') });
const hasNames = () => !['Player 1', 'Player 2'].includes(log.players.a) || !['Player 1', 'Player 2'].includes(log.players.b);
async function setPlayers(a, b) {
    log.players.a = (a || '').trim().slice(0, 24) || 'Player 1';
    log.players.b = (b || '').trim().slice(0, 24) || 'Player 2';
    await persist();
    renderAll();
}

export const BattleLog = { isOpen, open, close, addBattle, players, hasNames, setPlayers };

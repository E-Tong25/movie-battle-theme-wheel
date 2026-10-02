import { $, el } from '../core/page-elements.js';
import { Toast } from './messages.js';
import { MovieBattle } from '../wheel/genre-pool.js';

const els = {
    btn: $('editGenresBtn'), panel: $('genrePanel'), backdrop: $('genreBackdrop'), close: $('genreClose'),
    title: $('genreTitle'), summary: $('genreSummary'),
    addForm: $('genreAddForm'), addTitle: $('gTitle'), addLabel: $('gLabel'), error: $('genreError'),
    favor: $('gFavor'), list: $('genreList'), reset: $('genreReset'), status: $('genreStatus')
};
const MIN_GENRES = 2;
const LONG_LABEL = 14;
let opener = null;

const MB = () => MovieBattle;
function setStatus(message) {
    els.status.textContent = message;
    clearTimeout(setStatus.timer);
    setStatus.timer = setTimeout(() => { els.status.textContent = ''; }, 3500);
}
const newId = () => (window.crypto && crypto.randomUUID) ? crypto.randomUUID() : `g${Date.now()}${Math.random().toString(36).slice(2, 7)}`;

// Re-render after the current event finishes, so a Tab press has already
// moved focus to the next field (and render can put it back there)
let renderQueued = false;
function scheduleRender() {
    if (renderQueued) return;
    renderQueued = true;
    setTimeout(() => { renderQueued = false; render(); }, 0);
}

async function save(list, message) {
    await MB().updateGenres(list, { favorUnplayed: els.favor.checked });
    scheduleRender();
    if (message) setStatus(message);
}

// ---------- Render ----------
function render() {
    const genres = MB().genres();
    const max = MB().wheelMax;
    const n = genres.length;
    els.summary.textContent = n > max
        ? `${n} genres. ${max} fit on the wheel at a time; the other ${n - max} wait on the bench.`
        : `${n} genre${n === 1 ? '' : 's'}, all on the wheel. Add more than ${max} and the extras wait on the bench.`;
    els.favor.checked = MB().favorUnplayed();

    // Remember which field had focus, so re-rendering doesn't knock you out of it
    const active = document.activeElement;
    const activeRow = active && active.closest ? [...els.list.children].indexOf(active.closest('.genre-row')) : -1;
    const activeKind = active && active.classList ? ['genre-title-input', 'genre-label-input', 'genre-delete'].find(c => active.classList.contains(c)) : null;

    els.list.textContent = '';
    genres.forEach((g, i) => {
        const li = el('li', 'genre-row');

        const fields = el('div', 'genre-fields');
        const title = el('input', 'genre-title-input');
        title.type = 'text'; title.maxLength = 60; title.value = g.title;
        title.setAttribute('aria-label', `Full name of genre ${i + 1}`);
        const label = el('input', 'genre-label-input');
        label.type = 'text'; label.maxLength = 20;
        label.value = g.label !== g.title ? g.label : '';
        label.placeholder = 'Wheel label (optional)';
        label.setAttribute('aria-label', `Short wheel label for ${g.title}`);
        fields.append(title, label);

        const shown = (label.value || title.value).trim();
        if (shown.length > LONG_LABEL) {
            fields.append(el('span', 'hint genre-long', `"${shown}" is long for the wheel; a short label will read better.`));
        }

        const del = el('button', 'log-icon-btn genre-delete', '\u00D7');
        del.type = 'button';
        del.setAttribute('aria-label', `Delete ${g.title}`);
        del.disabled = genres.length <= MIN_GENRES;
        if (del.disabled) del.title = `Keep at least ${MIN_GENRES} genres`;

        const commit = async () => {
            const newTitle = title.value.trim();
            if (!newTitle) { title.value = g.title; setStatus('A genre needs a name.'); return; }
            const newLabel = label.value.trim();
            if (newTitle === g.title && (newLabel || newTitle) === g.label) return;
            const list = MB().genres();
            list[i] = { ...list[i], title: newTitle, label: newLabel || newTitle };
            await save(list, 'Saved.');
        };
        title.addEventListener('change', commit);
        label.addEventListener('change', commit);

        del.addEventListener('click', async () => {
            const previous = MB().genres();
            const list = previous.filter(x => x.id !== g.id);
            await save(list);
            if (Toast) Toast.show(`Deleted \u201C${g.title}\u201D.`, { undo: () => save(previous) });
            else setStatus(`Deleted "${g.title}".`);
        });

        li.append(fields, del);
        els.list.append(li);
    });

    if (activeRow > -1 && activeKind) {
        const row = els.list.children[Math.min(activeRow, els.list.children.length - 1)];
        const target = row && row.querySelector('.' + activeKind);
        if (target && !target.disabled) target.focus();
    }
}

// ---------- Add ----------
els.addForm.addEventListener('submit', async e => {
    e.preventDefault();
    const title = els.addTitle.value.trim();
    const label = els.addLabel.value.trim();
    if (!title) { els.error.textContent = 'Give the genre a name.'; return; }
    const list = MB().genres();
    if (list.some(g => g.title.toLowerCase() === title.toLowerCase())) {
        els.error.textContent = 'You already have a genre with that name.';
        return;
    }
    els.error.textContent = '';
    list.push({ id: newId(), title, label: label || title });
    await save(list, `Added "${title}".`);
    els.addForm.reset();
    els.addTitle.focus();
});

els.favor.addEventListener('change', () => save(MB().genres(), els.favor.checked
    ? "Unplayed genres will be favored."
    : 'Every genre has the same chance again.'));

els.reset.addEventListener('click', async () => {
    const previous = MB().genres(), previousFavor = MB().favorUnplayed();
    await MB().resetGenres();
    render();
    const undo = async () => { await MB().updateGenres(previous, { favorUnplayed: previousFavor }); render(); };
    if (Toast) Toast.show('Back to the original genre list.', { undo });
    else setStatus('Back to the original list.');
});

// ---------- Open / close ----------
const FOCUSABLE = 'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';
const isOpen = () => !els.panel.hidden;

function open() {
    if (!MB()) return;
    opener = document.activeElement;
    render();
    els.panel.hidden = false;
    els.backdrop.hidden = false;
    requestAnimationFrame(() => {
        els.panel.classList.add('open');
        els.backdrop.classList.add('open');
    });
    els.title.focus();
}

function close() {
    els.panel.classList.remove('open');
    els.backdrop.classList.remove('open');
    const finish = () => { els.panel.hidden = true; els.backdrop.hidden = true; };
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) finish(); else setTimeout(finish, 280);
    if (opener && opener.focus) opener.focus();
}

els.btn.addEventListener('click', open);
els.close.addEventListener('click', close);
els.backdrop.addEventListener('click', close);
document.addEventListener('keydown', e => {
    if (!isOpen()) return;
    if (e.key === 'Escape') { e.preventDefault(); close(); return; }
    if (e.key === 'Tab') {
        const items = [...els.panel.querySelectorAll(FOCUSABLE)].filter(x => x.offsetParent !== null && !x.disabled);
        if (!items.length) return;
        const first = items[0], last = items[items.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
});

// If genres change elsewhere (e.g. imported with a Battle Log backup), refresh
window.addEventListener('genres:changed', () => { if (isOpen()) scheduleRender(); });

export const GenreEditor = { isOpen, open, close };

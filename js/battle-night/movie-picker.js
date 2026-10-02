/* Battle Night: the movie search, posters, and setting up the poster key */
import { h } from '../core/page-elements.js';
import { MovieDB } from '../features/movie-lookup.js';
import { close, render } from './page.js';
import { S, nameOf } from './shared-state.js';

// ---------- Movie picker: search TMDB as you type (or just type a title) ----------
export function moviePicker(initialTitle, initialMovie, label) {
    const state = { movie: initialMovie || null };
    const wrap = h('div', { class: 'picker' });
    const listId = `pick-${Math.random().toString(36).slice(2, 8)}`;
    const input = h('input', { type: 'text', maxLength: 80, value: initialTitle || '', placeholder: 'Start typing a movie title', 'aria-label': label,
        role: 'combobox', 'aria-autocomplete': 'list', 'aria-expanded': 'false', 'aria-controls': listId, autocomplete: 'off' });
    const list = h('ul', { class: 'picker-list', id: listId, role: 'listbox', hidden: true });
    const chip = h('div', { class: 'picker-chip', hidden: true });
    const note = h('p', { class: 'night-hint picker-note' });
    let results = [], active = -1, timer = null, seq = 0;

    function showChip() {
        chip.textContent = '';
        if (!state.movie) { chip.hidden = true; return; }
        chip.hidden = false;
        chip.append(posterEl(state.movie, state.movie.title, 'thumb'),
            h('span', {}, h('strong', {}, state.movie.title), state.movie.year ? ` (${state.movie.year})` : ''),
            h('button', { type: 'button', class: 'night-link', onclick: () => { state.movie = null; showChip(); input.focus(); } }, 'Change'));
    }
    function close() { list.hidden = true; input.setAttribute('aria-expanded', 'false'); active = -1; }
    function choose(m) {
        state.movie = m;
        input.value = m.title;
        close();
        showChip();
    }
    function paint() {
        list.textContent = '';
        results.forEach((m, i) => {
            const li = h('li', { role: 'option', id: `${listId}-${i}`, class: `picker-option ${i === active ? 'active' : ''}`, 'aria-selected': String(i === active),
                onmousedown: e => { e.preventDefault(); choose(m); } },
                posterEl(m, m.title, 'thumb'), h('span', {}, h('strong', {}, m.title), m.year ? ` (${m.year})` : ''));
            list.append(li);
        });
        list.hidden = !results.length;
        input.setAttribute('aria-expanded', String(!!results.length));
        if (active > -1) input.setAttribute('aria-activedescendant', `${listId}-${active}`); else input.removeAttribute('aria-activedescendant');
    }
    input.addEventListener('input', () => {
        state.movie = null; showChip();
        if (!MovieDB || !MovieDB.hasKey()) return;
        clearTimeout(timer);
        const q = input.value;
        timer = setTimeout(async () => {
            const mine = ++seq;
            try {
                const found = await MovieDB.search(q);
                if (mine !== seq) return;                       // a newer search already started
                results = found; active = -1; note.textContent = ''; paint();
            } catch (e) {
                note.textContent = e.message === 'bad-key'
                    ? 'Your TMDB key didn\u2019t work. Check it under Posters. You can still type the title.'
                    : 'Couldn\u2019t reach the movie database. You can still type the title.';
            }
        }, 300);
    });
    input.addEventListener('keydown', e => {
        if (list.hidden) return;
        if (e.key === 'ArrowDown') { e.preventDefault(); active = Math.min(active + 1, results.length - 1); paint(); }
        else if (e.key === 'ArrowUp') { e.preventDefault(); active = Math.max(active - 1, 0); paint(); }
        else if (e.key === 'Enter' && active > -1) { e.preventDefault(); choose(results[active]); }
        else if (e.key === 'Escape') { e.stopPropagation(); close(); }
    });
    input.addEventListener('blur', () => setTimeout(close, 150));
    if (!MovieDB || !MovieDB.hasKey()) {
        note.append('Want real posters? ', h('button', { type: 'button', class: 'night-link', onclick: () => { S.ui.posterSetup = true; render(); } }, 'Set up Posters'), ' (free).');
    }
    showChip();
    wrap.append(input, list, chip, note);
    return { el: wrap, input, get: () => ({ title: input.value.trim(), movie: state.movie && state.movie.title === input.value.trim() ? state.movie : null }) };
}

// A poster: the real one if we have it, otherwise a stand-in with fake credits
export function posterEl(movie, title, size, side) {
    const src = movie && (size === 'thumb' ? movie.poster : (movie.posterLarge || movie.poster));
    const fallback = () => {
        if (size === 'thumb') return h('span', { class: 'poster thumb poster-fallback', 'aria-hidden': 'true' }, (title || '?').trim().charAt(0).toUpperCase());
        return h('div', { class: `poster ${size} poster-fallback`, role: 'img', 'aria-label': `Stand-in poster for ${title}` },
            h('span', { class: 'pf-credit' }, side ? `${/^[aeiou]/i.test(nameOf(side)) ? 'An' : 'A'} ${nameOf(side)} Production` : 'Now Showing'),
            h('span', { class: 'pf-title' }, title),
            movie && movie.year ? h('span', { class: 'pf-year' }, movie.year) : null,
            h('span', { class: 'pf-billing' }, 'Starring a questionable choice · Directed by the wheel · Rated S for Smug'));
    };
    if (!src) return fallback();
    const img = h('img', { class: `poster ${size}`, src, alt: size === 'thumb' ? '' : `Poster for ${title}`, loading: 'eager', decoding: 'async' });
    img.addEventListener('error', () => img.replaceWith(fallback()), { once: true });
    return img;
}

export function posterSetupCard() {
    const has = MovieDB && MovieDB.hasKey();
    const input = h('input', { type: 'text', placeholder: 'Paste your TMDB API key or read access token', 'aria-label': 'TMDB API key', autocomplete: 'off' });
    const status = h('p', { class: 'night-hint', role: 'status' }, has ? 'A key is saved on this device.' : '');
    return h('section', { class: 'night-card poster-setup' },
        h('h3', {}, 'Movie posters'),
        h('p', {}, 'Posters and movie search come from TMDB, a free movie database. To turn them on:'),
        h('ol', { class: 'setup-steps' },
            h('li', {}, 'Make a free account at ', h('a', { href: 'https://www.themoviedb.org/signup', target: '_blank', rel: 'noopener' }, 'themoviedb.org'), '.'),
            h('li', {}, 'Go to Settings \u2192 API and request a key for personal use.'),
            h('li', {}, 'Copy the "API Key" (or the longer "Read Access Token") and paste it here.')),
        input,
        h('div', { class: 'night-actions' },
            h('button', { type: 'button', class: 'night-btn primary', onclick: async () => {
                if (!input.value.trim()) { status.textContent = 'Paste a key first.'; return; }
                MovieDB.setKey(input.value);
                status.textContent = 'Checking\u2026';
                status.textContent = await MovieDB.test()
                    ? 'It works. Start typing a title when you pick your champion.'
                      : 'TMDB didn\u2019t accept that key (or couldn\u2019t be reached). It\u2019s saved anyway; double-check it.';
            } }, 'Save key'),
            has ? h('button', { type: 'button', class: 'night-btn', onclick: () => { MovieDB.clearKey(); render(); } }, 'Remove key') : null,
            h('button', { type: 'button', class: 'night-link', onclick: () => { S.ui.posterSetup = false; render(); } }, 'Done')),
        status,
        h('p', { class: 'night-hint' }, 'The key is saved only in this browser. This product uses the TMDB API but is not endorsed or certified by TMDB.'));
}

export function lockButton(picker, err, onLocked) {
    return h('button', {
        type: 'button', class: 'night-btn primary', onclick: async () => {
            const { title, movie } = picker.get();
            if (!title) { err.textContent = 'Name your champion first.'; return; }
            await onLocked(title, movie);
        }
    }, 'Lock in champion');
}

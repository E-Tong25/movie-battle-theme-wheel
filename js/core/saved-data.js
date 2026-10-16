/* Browser storage with an in-memory copy and explicit failure reporting.
   A failed write never discards the current session's work. Retry and Export
   can use it even when the browser blocks storage or runs out of space. */
import { normalizeGenres, normalizeLog, normalizeNight } from './data-validation.js';

const issues = new Map();
const stores = [];
const recovery = new Map();
export const storageRecovery = () => Object.fromEntries(recovery);
export const storageIssues = () => [...issues.values()];
function report(key, message, retryable) {
    if (message) issues.set(key, { key, message, retryable });
    else issues.delete(key);
    if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('storage:changed'));
}

function createStore(key, fresh, validate) {
    let memory = fresh(), loaded = false, pending = null;
    const store = {
        async load() {
            if (loaded) return memory;
            loaded = true;
            let raw = null;
            try {
                raw = localStorage.getItem(key);
                if (raw !== null) {
                    const result = validate(JSON.parse(raw));
                    memory = result.value;
                    if (result.warning) { recovery.set(key, raw); report(key, result.warning, false); }
                }
            } catch (error) {
                if (raw !== null) recovery.set(key, raw);
                report(key, 'Some saved data could not be read. Download a backup to preserve any recoverable data.', false);
                console.warn('Saved data could not be read.', error);
            }
            return memory;
        },
        async save(value) {
            memory = value;
            loaded = true;
            pending = 'save';
            return store.retry();
        },
        async clear() {
            memory = fresh();
            loaded = true;
            pending = 'clear';
            return store.retry();
        },
        async retry() {
            if (!pending) return true;
            try {
                if (pending === 'clear') localStorage.removeItem(key);
                else localStorage.setItem(key, JSON.stringify(memory));
                pending = null;
                // A successful write does not dismiss a warning about a bad read.
                if (issues.get(key)?.retryable) report(key, null);
                return true;
            } catch {
                report(key, 'Changes aren’t saved. Keep this tab open and download a backup.', true);
                return false;
            }
        },
        isPersistent() { return !issues.get(key)?.retryable; }
    };
    stores.push(store);
    return store;
}

export function emptyLog() {
    return { version: 1, players: { a: 'Player 1', b: 'Player 2' }, lastTheme: '', battles: [] };
}
export const BattleStore = createStore('movieBattle.log.v1', emptyLog, data => {
    const { log, skipped } = normalizeLog(data);
    return { value: log, warning: skipped ? `${skipped} invalid saved battle(s) were skipped. Export a backup of the recovered log.` : '' };
});
BattleStore.emptyLog = emptyLog;

export const GenreStore = createStore('movieBattle.genres.v1', () => null, data => ({ value: normalizeGenres(data) }));
export const NightStore = createStore('movieBattle.night.v1', () => null, data => ({ value: normalizeNight(data) }));

export async function retrySaves() {
    const results = await Promise.all(stores.map(store => store.retry()));
    return results.every(Boolean);
}

// Probe once, so a browser that blocks saving warns before the first edit.
try {
    const probe = 'movieBattle.storage.probe';
    localStorage.setItem(probe, '1');
    localStorage.removeItem(probe);
} catch {
    report('storage', 'This browser isn’t saving your data. Keep this tab open and download a backup.', true);
}
export async function retryStorage() {
    const ok = await retrySaves();
    try {
        localStorage.setItem('movieBattle.storage.probe', '1');
        localStorage.removeItem('movieBattle.storage.probe');
        report('storage', null);
    } catch { return false; }
    return ok;
}

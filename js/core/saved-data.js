/* ==========================================================================
   BATTLE LOG STORAGE
   Everything the Battle Log saves goes through this one object, so switching
   storage later (e.g. to Firebase so both of you share one log) means
   replacing only this file. Keep the same three functions:

     await BattleStore.load()      -> the log object (or a fresh empty one)
     await BattleStore.save(log)   -> true if it was saved
     BattleStore.isPersistent()    -> false if this browser can't save

   The log object looks like:
     {
       version: 1,
       players: { a: 'Player 1', b: 'Player 2' },
       lastTheme: 'Food from Another World',     // last theme the wheel picked
       battles: [
         { id, date: 'YYYY-MM-DD', theme, movieA, movieB,
           winner: 'a' | 'b' | 'tie', notes, createdAt }
       ]
     }
   ========================================================================== */
const LOG_KEY = 'movieBattle.log.v1';

function emptyLog() {
    return { version: 1, players: { a: 'Player 1', b: 'Player 2' }, lastTheme: '', battles: [] };
}

// Some browsers (private windows, strict settings) refuse to save
let persistent = true;
try {
    const probe = LOG_KEY + '.probe';
    localStorage.setItem(probe, '1');
    localStorage.removeItem(probe);
} catch (e) {
    persistent = false;
}

let memoryCopy = emptyLog();          // used when the browser can't save

export const BattleStore = {
    emptyLog,

    isPersistent() { return persistent; },

    async load() {
        if (!persistent) return memoryCopy;
        try {
            const raw = localStorage.getItem(LOG_KEY);
            if (!raw) return emptyLog();
            const log = JSON.parse(raw);
            return { ...emptyLog(), ...log, players: { ...emptyLog().players, ...(log.players || {}) } };
        } catch (e) {
            console.warn('Battle log could not be read; starting fresh.', e);
            return emptyLog();
        }
    },

    async save(log) {
        if (!persistent) { memoryCopy = log; return false; }
        try {
            localStorage.setItem(LOG_KEY, JSON.stringify(log));
            return true;
        } catch (e) {
            console.warn('Battle log could not be saved.', e);
            return false;
        }
    }
};

/* ==========================================================================
   GENRE STORAGE
   The genre list you edit in the app (Genre Editor). Same idea as BattleStore:
   swap this out later to share genres between devices.

     await GenreStore.load()   -> { genres: [{ id, title, label }], favorUnplayed } or null
                                  (null = nothing saved yet; the app uses js/wheel/genres-and-colors.js)
     await GenreStore.save(data)
     await GenreStore.clear()  -> forget saved genres (back to js/wheel/genres-and-colors.js)
   ========================================================================== */
const GENRES_KEY = 'movieBattle.genres.v1';

export const GenreStore = {
    async load() {
        try {
            const raw = localStorage.getItem(GENRES_KEY);
            if (!raw) return null;
            const data = JSON.parse(raw);
            if (!Array.isArray(data.genres)) return null;
            return data;
        } catch (e) {
            return null;
        }
    },
    async save(data) {
        try { localStorage.setItem(GENRES_KEY, JSON.stringify(data)); return true; }
        catch (e) { return false; }
    },
    async clear() {
        try { localStorage.removeItem(GENRES_KEY); } catch (e) { /* nothing saved anyway */ }
    }
};

/* ==========================================================================
   BATTLE NIGHT STORAGE
   The current battle night (schedule, picks, clues, judging). In this
   prototype both players share one device. With Firebase, this becomes a
   shared document, and security rules keep each player's pick sealed until
   the reveal time.

     await NightStore.load()   -> the battle night object, or null
     await NightStore.save(night)
     await NightStore.clear()
   ========================================================================== */
const NIGHT_KEY = 'movieBattle.night.v1';
export const NightStore = {
    async load() {
        try { const raw = localStorage.getItem(NIGHT_KEY); return raw ? JSON.parse(raw) : null; }
        catch (e) { return null; }
    },
    async save(night) {
        try { localStorage.setItem(NIGHT_KEY, JSON.stringify(night)); return true; }
        catch (e) { return false; }
    },
    async clear() {
        try { localStorage.removeItem(NIGHT_KEY); } catch (e) { /* nothing to clear */ }
    }
};

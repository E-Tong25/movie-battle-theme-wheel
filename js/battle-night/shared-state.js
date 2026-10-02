/* Battle Night: timing constants, the current night, who you’re playing as, and saving */
import { NightStore } from '../core/saved-data.js';
import { BattleLog } from '../features/battle-log.js';

/* ==========================================================================
   BATTLE NIGHT
   After a theme is picked: agree on a time, count down, lock in champions in
   secret, drop up to three optional clues (unlocked one at a time), reveal
   both picks an hour before, check for the same movie, flip for watch order,
   then judge both movies in secret and save the result to the Battle Log.

   PROTOTYPE: both players share this device. The bar at the bottom switches
   who you're playing as and can skip ahead in time. With Firebase, each phone
   is its own player and each pick stays sealed on the server until the reveal.
   ========================================================================== */
export const MIN = 60000, HOUR = 60 * MIN;
export const REVEAL_BEFORE = HOUR;              // champions are revealed this long before the battle
export const EXTENSION = 30 * MIN;              // "30 more minutes" deadline option
export const CLUES = 3;
export const CATEGORIES = [
    { key: 'fit', label: 'Fits the theme' },
    { key: 'fun', label: 'Entertainment' },
    { key: 'rewatch', label: 'Rewatch value' }
];

// ---------- Prototype state (who you are, clock offset) ----------
const PROTO_KEY = 'movieBattle.prototype.v1';
export let proto = { offset: 0, viewAs: 'a', seen: {} };
try { proto = { ...proto, ...JSON.parse(localStorage.getItem(PROTO_KEY) || '{}') }; } catch (e) { /* defaults */ }
export const saveProto = () => { try { localStorage.setItem(PROTO_KEY, JSON.stringify(proto)); } catch (e) { /* not critical */ } };
export const now = () => Date.now() + proto.offset;
// Values that several Battle Night files change live on one shared object
// (a module can read another module's variables, but not reassign them)
export const S = {
    night: null,                                   // the current battle night (see NightStore)
    ui: { reproposing: false, draftScores: {} }    // screen-only state: forms open, scores being entered
};

export const me = () => proto.viewAs;
export const them = () => (me() === 'a' ? 'b' : 'a');
export const names = () => (BattleLog ? BattleLog.players() : { a: 'Player 1', b: 'Player 2' });
export const nameOf = side => names()[side];
export const newId = () => (window.crypto && crypto.randomUUID) ? crypto.randomUUID() : `n${Date.now()}${Math.random().toString(36).slice(2, 7)}`;

export async function save() { await NightStore.save(S.night); }

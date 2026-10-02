/* Battle Night: date, time and countdown formatting */
import { HOUR, now } from './shared-state.js';

// ---------- Time helpers ----------
export const fmtTime = ms => new Date(ms).toLocaleString(undefined, { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
export const fmtClock = ms => new Date(ms).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
export function fmtLeft(ms) {
    if (ms <= 0) return 'now';
    const s = Math.floor(ms / 1000), d = Math.floor(s / 86400), hr = Math.floor((s % 86400) / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
    if (d) return `${d}d ${hr}h`;
    if (hr) return `${hr}h ${m}m`;
    if (m) return `${m}m ${sec}s`;
    return `${sec}s`;
}
export function toLocalInput(ms) {
    const d = new Date(ms), p = n => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}
export function defaultBattleTime() {
    const d = new Date(now() + 24 * HOUR);            // tomorrow at 8 PM
    d.setHours(20, 0, 0, 0);
    return d.getTime();
}

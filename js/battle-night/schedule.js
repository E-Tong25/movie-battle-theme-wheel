/* Battle Night: picking a time, and the countdown */
import { el, h } from '../core/page-elements.js';
import { accept, downloadICS, propose } from './actions.js';
import { render } from './page.js';
import { effectiveReveal } from './rules.js';
import { MIN, S, me, nameOf, now, them } from './shared-state.js';
import { defaultBattleTime, fmtClock, fmtLeft, fmtTime, toLocalInput } from './time-format.js';

// ---------- Pieces ----------
export const countdownEl = (target, cls = '') => h('span', { class: `countdown ${cls}`, 'data-until': target }, fmtLeft(target - now()));

export function bigCountdown(target, label) {
    const box = h('div', { class: 'big-countdown', 'data-big-until': target, role: 'timer', 'aria-label': label });
    box.append(...['days', 'hrs', 'min', 'sec'].map(u => h('div', { class: 'cd-unit' }, h('span', { class: 'cd-num', 'data-unit': u }, '00'), h('span', { class: 'cd-label' }, u))));
    updateBig(box);
    return h('section', { class: 'night-card countdown-card' }, h('p', { class: 'night-kicker' }, label), box);
}
export function updateBig(box) {
    const left = Math.max(0, Number(box.dataset.bigUntil) - now());
    const s = Math.floor(left / 1000);
    const v = { days: Math.floor(s / 86400), hrs: Math.floor((s % 86400) / 3600), min: Math.floor((s % 3600) / 60), sec: s % 60 };
    box.querySelectorAll('[data-unit]').forEach(el => { el.textContent = String(v[el.dataset.unit]).padStart(2, '0'); });
}

function scheduleForm(defaultMs) {
    const input = h('input', { type: 'datetime-local', value: toLocalInput(defaultMs), required: true, id: 'nightWhen' });
    const policy = S.night.deadline || 'extend';
    const radio = (value, label) => h('label', { class: 'night-radio' },
        h('input', { type: 'radio', name: 'deadline', value, checked: policy === value }), ' ', label);
    const error = h('p', { class: 'form-error', role: 'alert' });
    const form = h('form', {
        class: 'night-card night-form', novalidate: true, onsubmit: async e => {
            e.preventDefault();
            const ms = new Date(input.value).getTime();
            if (!input.value || isNaN(ms)) { error.textContent = 'Pick a date and time.'; return; }
            if (ms < now() + 10 * MIN) { error.textContent = 'Pick a time at least 10 minutes from now.'; return; }
            const deadline = form.querySelector('input[name="deadline"]:checked').value;
            await propose(ms, deadline);
        }
    },
        h('h3', {}, 'When is the battle?'),
        h('label', { class: 'night-field' }, 'Date and time', input),
        h('fieldset', { class: 'night-fieldset' }, h('legend', {}, 'If someone hasn\u2019t picked a champion by the reveal'),
            radio('extend', 'Give them 30 more minutes, then it\u2019s a forfeit'),
            radio('forfeit', 'Instant forfeit. No mercy.')),
        error,
        h('button', { type: 'submit', class: 'night-btn primary' }, `Propose this time to ${nameOf(them())}`)
    );
    return form;
}

export function renderSchedule(main) {
    const p = S.night.proposal;
    if (!p || S.ui.reproposing) {
        main.append(h('p', { class: 'night-intro' }, `Pick a time for the battle and send it to ${nameOf(them())}. Champions are revealed one hour before it starts.`));
        main.append(scheduleForm(p ? p.at : defaultBattleTime()));
        if (S.ui.reproposing) main.append(h('button', { type: 'button', class: 'night-link', onclick: () => { S.ui.reproposing = false; render(); } }, 'Never mind'));
        return;
    }
    const policyText = S.night.deadline === 'forfeit' ? 'a missed pick is an instant forfeit' : 'a missed pick gets 30 more minutes, then forfeits';
    if (p.by === me()) {
        main.append(h('section', { class: 'night-card' },
            h('p', { class: 'night-kicker' }, 'Waiting for an answer'),
            h('p', { class: 'night-big' }, fmtTime(p.at)),
            h('p', {}, `You proposed this time. Waiting for ${nameOf(them())} to accept or suggest another. Deadline rule: ${policyText}.`),
            h('button', { type: 'button', class: 'night-btn', onclick: () => { S.ui.reproposing = true; render(); } }, 'Change the time')));
    } else {
        main.append(h('section', { class: 'night-card' },
            h('p', { class: 'night-kicker' }, `${nameOf(them())} wants to battle`),
            h('p', { class: 'night-big' }, fmtTime(p.at)),
            h('p', {}, 'In ', countdownEl(p.at), `. Deadline rule: ${policyText}.`),
            h('div', { class: 'night-actions' },
                h('button', { type: 'button', class: 'night-btn primary', onclick: accept }, 'Accept the challenge'),
                h('button', { type: 'button', class: 'night-btn', onclick: () => { S.ui.reproposing = true; render(); } }, 'Suggest another time'))));
    }
}

export function scheduleSummary() {
    const ext = S.night.extendedUntil;
    return h('section', { class: 'night-card night-summary' },
        h('div', {},
            h('p', { class: 'night-kicker' }, 'Battle starts'),
            h('p', { class: 'night-strong' }, fmtTime(S.night.battleAt))),
        h('div', {},
            h('p', { class: 'night-kicker' }, ext ? 'Reveal pushed back' : 'Champions revealed'),
            h('p', { class: 'night-strong' }, fmtClock(effectiveReveal(S.night)), ' · ', countdownEl(effectiveReveal(S.night)))),
        h('button', { type: 'button', class: 'night-btn small', onclick: downloadICS }, 'Add to calendar'));
}

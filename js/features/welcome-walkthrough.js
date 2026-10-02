import { h } from '../core/page-elements.js';
import { BattleLog } from './battle-log.js';

/* ==========================================================================
   WELCOME WALKTHROUGH
   Three quick steps explaining how a movie battle works, then both names.
   Shows once on the first visit; reopen it any time from the Battle Log
   ("How it works"). Skippable at every step.
   ========================================================================== */
const KEY = 'movieBattle.welcomed';
const STEPS = [
    { title: 'Spin for tonight\u2019s theme',
      body: 'Spin the wheel. Like the pick? Lock it in. Not feeling it? Spin again. Add your own genres any time with Edit genres.' },
    { title: 'Pick your champions in secret',
      body: 'Agree on a time, then each choose a movie without telling the other. Drop up to three cryptic clues along the way. Both champions are revealed an hour before the battle.' },
    { title: 'Watch, judge, gloat',
      body: 'Watch both movies back to back, score them in secret, and the verdict goes on the scoreboard in the Battle Log.' },
    { title: 'Who\u2019s battling?', body: 'Two critics. One couch. Zero mercy.', names: true }
];

let step = 0, opener = null;

const overlay = h('div', { class: 'welcome', role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'welcomeTitle' });
overlay.hidden = true;
const card = h('div', { class: 'welcome-card' });
overlay.append(card);
document.body.append(overlay);

const isOpen = () => !overlay.hidden;
const remember = () => { try { localStorage.setItem(KEY, '1'); } catch (e) { /* ignore */ } };

function render() {
    const s = STEPS[step];
    card.textContent = '';
    const skip = h('button', { type: 'button', class: 'welcome-skip', onclick: finish }, step === STEPS.length - 1 ? 'Close' : 'Skip');
    const head = h('div', { class: 'welcome-head' },
        h('span', { class: 'welcome-count' }, s.names ? 'Last thing' : `Step ${step + 1} of ${STEPS.length - 1}`), skip);
    const body = [];
    if (!s.names) body.push(h('div', { class: 'welcome-num', 'aria-hidden': 'true' }, String(step + 1)));
    body.push(h('h2', { id: 'welcomeTitle', tabindex: '-1' }, s.title), h('p', { class: 'welcome-body' }, s.body));

    let a = null, b = null;
    if (s.names) {
        const current = BattleLog ? BattleLog.players() : { a: '', b: '' };
        const isDefault = v => v === 'Player 1' || v === 'Player 2';
        a = h('input', { type: 'text', maxlength: '24', placeholder: 'Your name', 'aria-label': 'First player\u2019s name' });
        b = h('input', { type: 'text', maxlength: '24', placeholder: 'Their name', 'aria-label': 'Second player\u2019s name' });
        a.value = isDefault(current.a) ? '' : current.a;
        b.value = isDefault(current.b) ? '' : current.b;
        body.push(h('div', { class: 'welcome-names' }, a, h('span', { class: 'welcome-vs' }, 'vs'), b),
            h('p', { class: 'welcome-hint' }, 'You can change these later in the Battle Log.'));
    }

    const dots = h('div', { class: 'welcome-dots', 'aria-hidden': 'true' },
        STEPS.map((_, i) => h('span', { class: i === step ? 'on' : '' })));
    const back = step > 0 ? h('button', { type: 'button', class: 'welcome-btn', onclick: () => { step--; render(); } }, 'Back') : h('span');
    const next = s.names
        ? h('button', { type: 'button', class: 'welcome-btn primary', onclick: async () => {
            if (BattleLog && (a.value.trim() || b.value.trim())) await BattleLog.setPlayers(a.value, b.value);
            finish();
        } }, 'Let\u2019s battle')
        : h('button', { type: 'button', class: 'welcome-btn primary', onclick: () => { step++; render(); } }, 'Next');

    card.append(head, ...body, h('div', { class: 'welcome-foot' }, back, dots, next));
    const focusTarget = s.names ? a : card.querySelector('h2');
    if (focusTarget) focusTarget.focus();
}

function open() {
    opener = document.activeElement;
    step = 0;
    overlay.hidden = false;
    render();
}
function finish() {
    remember();
    overlay.hidden = true;
    if (opener && opener.focus && document.contains(opener)) opener.focus();
}

overlay.addEventListener('keydown', e => {
    if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); finish(); }
    if (e.key === 'Tab') {
        const items = [...card.querySelectorAll('button, input')];
        const first = items[0], last = items[items.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
});

const howBtn = document.getElementById('howItWorksBtn');
if (howBtn) howBtn.addEventListener('click', () => { if (BattleLog) BattleLog.close(); setTimeout(open, 300); });

// First visit: show it once the page has settled
let seen = false;
try { seen = localStorage.getItem(KEY) === '1'; } catch (e) { seen = true; }
if (!seen) setTimeout(open, 600);

export const Welcome = { open, isOpen, close: finish };

/* ==========================================================================
   TOASTS: short themed messages at the bottom of the screen, with Undo
   Used instead of the browser's plain confirm/alert boxes: things happen
   right away, and a message offers a few seconds to take it back.

     Toast.show('Removed "Alien Food"', { undo: () => {...} })
     Toast.show('That time has passed. Pick another.')      // no Undo
   ========================================================================== */
const DURATION = 6000;
const el = document.createElement('div');
el.className = 'toast';
el.setAttribute('role', 'status');
el.setAttribute('aria-live', 'polite');
el.hidden = true;
const text = document.createElement('span');
text.className = 'toast-text';
const undoBtn = document.createElement('button');
undoBtn.type = 'button';
undoBtn.className = 'toast-undo';
undoBtn.textContent = 'Undo';
const closeBtn = document.createElement('button');
closeBtn.type = 'button';
closeBtn.className = 'toast-close';
closeBtn.setAttribute('aria-label', 'Dismiss');
closeBtn.textContent = '\u00D7';
el.append(text, undoBtn, closeBtn);
document.body.append(el);

let timer = null, undoFn = null, remaining = 0, startedAt = 0;

function hide() {
    clearTimeout(timer);
    undoFn = null;
    el.classList.remove('show');
    setTimeout(() => { if (!el.classList.contains('show')) el.hidden = true; }, 250);
}
function schedule(ms) {
    clearTimeout(timer);
    remaining = ms;
    startedAt = Date.now();
    timer = setTimeout(hide, ms);
}

function show(message, options = {}) {
    text.textContent = message;                 // text only, never HTML
    undoFn = typeof options.undo === 'function' ? options.undo : null;
    undoBtn.hidden = !undoFn;
    el.hidden = false;
    requestAnimationFrame(() => el.classList.add('show'));
    schedule(options.duration || (undoFn ? DURATION : 3500));
}

undoBtn.addEventListener('click', async () => {
    const fn = undoFn;
    hide();
    if (fn) {
        await fn();
        show('Undone.', { duration: 2000 });
    }
});
closeBtn.addEventListener('click', hide);

// Pause the countdown while someone is reading or reaching for Undo
const pause = () => { clearTimeout(timer); remaining -= Date.now() - startedAt; };
const resume = () => { if (!el.hidden) schedule(Math.max(1500, remaining)); };
el.addEventListener('mouseenter', pause);
el.addEventListener('mouseleave', resume);
el.addEventListener('focusin', pause);
el.addEventListener('focusout', resume);

export const Toast = { show, hide };

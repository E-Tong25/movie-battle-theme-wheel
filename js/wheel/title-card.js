/* Wheel: the winner's title card and its choices */
import { Toast } from '../features/messages.js';
import { drawWheel } from './drawing.js';
import { drawWheelSet, eliminated, fillWheel, renderBench, restoreWheel, runtimeChoices, snapshotWheel } from './genre-pool.js';
import { unlockWheel } from './spin.js';
import { UI, announce, state } from './shared-state.js';
import { themePipeline } from './themes.js';

// Winner heading as separate pieces so themes can restyle it (e.g. hide the emoji)
export function setWinnerTitle(before, name, after) {
    UI.winner.textContent = '';
    [['winner-deco', before], ['winner-name', name], ['winner-deco', after]].forEach(([cls, text]) => {
        const span = document.createElement('span');
        span.className = cls;
        span.textContent = text;
        UI.winner.appendChild(span);
    });
}

// "Let's Dance!" stays "Let's Dance!" (not "Let's Dance!!"); other titles get an exclamation mark
export function exclaim(title) {
    return /[!?.…]$/.test(title.trim()) ? title : `${title}!`;
}

// Put the current theme's prompt in the result line
function showPrompt() {
    state.showingPrompt = true;
    UI.result.innerText = themePipeline[state.currentThemeIndex].prompt || 'Spin it. No take-backs.';
}

export function openModal() {
    UI.modal.style.display = "flex";
    (UI.scheduleBtn || UI.eliminateBtn).focus();      // "Lock it in" is the main choice
}

export function eliminateOption(options = {}) {
    const before = snapshotWheel();
    if (state.lastWinningIndex > -1) {
        const [gone] = runtimeChoices.splice(state.lastWinningIndex, 1);
        if (gone && options.undoable && Toast) {
            Toast.show(`Removed \u201C${gone.title}\u201D from the wheel.`, { undo: () => restoreWheel(before) });
        }
        if (gone) eliminated.add(gone.id);
        if (runtimeChoices.length === 0) {           // "Reset Wheel" after the grand finale
            eliminated.clear();
            drawWheelSet();
        } else {
            fillWheel(state.lastWinningIndex);             // a genre from the bench takes its spot
        }
        state.lastWinningIndex = -1;
        drawWheel();
        renderBench();
    }
    closeModal();
}

export function closeModal() {
    UI.modal.style.display = "none";
    unlockWheel();
    showPrompt();                   // back to the theme's prompt, ready for the next spin
    announce('closed');
    UI.spinBtn.focus();
}
